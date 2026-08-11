from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.db.models import Q
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from .models import Cliente
from .permissions import IsSuperUser
from .serializers import (
    UtenteSerializer,
    UtenteCreateSerializer,
    ActivateAccountSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ClienteSerializer,
)
from .utils import send_activation_email, send_password_reset_email

Utente = get_user_model()


class UtenteViewSet(viewsets.ModelViewSet):
    queryset = Utente.objects.all()
    serializer_class = UtenteSerializer
    permission_classes = [IsSuperUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return UtenteCreateSerializer
        return UtenteSerializer

    def get_permissions(self):
        if self.action == 'me':
            return [IsAuthenticated()]
        if self.action in ('activate', 'reset_password_request', 'reset_password_confirm'):
            return [AllowAny()]
        return super().get_permissions()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_activation_email(user)
        return Response(UtenteSerializer(user).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        # Un superuser può sempre essere disattivato (set_active, sotto) ma mai eliminato
        # definitivamente — a differenza di uno staff normale, è l'unico tipo di account che
        # gestisce gli altri account: perderlo per errore (o per un abuso da parte di un altro
        # superuser) non avrebbe altro rimedio se non manage.py createsuperuser da terminale.
        # Vale sempre, non solo per l'account che sta facendo la richiesta (quel guardrail più
        # stretto è già coperto separatamente da set_active).
        user = self.get_object()
        if user.is_superuser:
            return Response(
                {'detail': 'Un account superuser non può essere eliminato. Puoi solo disattivarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UtenteSerializer(request.user)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def activate(self, request):
        serializer = ActivateAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            uid = force_str(urlsafe_base64_decode(data['uid']))
            user = Utente.objects.get(pk=uid)
        except (Utente.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'detail': 'Link di attivazione non valido.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, data['token']):
            return Response({'detail': 'Link di attivazione scaduto o non valido.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data['password'])
        user.save()
        return Response({'detail': 'Account attivato con successo.'})

    @action(detail=False, methods=['post'], url_path='reset-password/request')
    def reset_password_request(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email']

        try:
            user = Utente.objects.get(email__iexact=email, is_active=True)
            send_password_reset_email(user)
        except Utente.DoesNotExist:
            pass

        return Response({'detail': "Se l'indirizzo è registrato, riceverai un'email con le istruzioni."})

    @action(detail=False, methods=['post'], url_path='reset-password/confirm')
    def reset_password_confirm(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            uid = force_str(urlsafe_base64_decode(data['uid']))
            user = Utente.objects.get(pk=uid)
        except (Utente.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response({'detail': 'Link non valido.'}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, data['token']):
            return Response({'detail': 'Link scaduto o non valido.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data['password'])
        user.save()
        return Response({'detail': 'Password reimpostata con successo.'})

    @action(detail=True, methods=['patch'], url_path='set-active')
    def set_active(self, request, pk=None):
        user = self.get_object()

        if user.pk == request.user.pk:
            return Response(
                {'detail': 'Non puoi disattivare il tuo stesso account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        is_active = request.data.get('is_active')
        if not isinstance(is_active, bool):
            return Response(
                {'is_active': 'Campo obbligatorio, deve essere true o false.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = is_active
        user.save(update_fields=['is_active'])
        return Response(UtenteSerializer(user).data)


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all().order_by('nome')
    serializer_class = ClienteSerializer

    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        # Ricerca staff: un'unica query testuale su nome O telefono — niente filterset_fields
        # perché qui serve un OR tra i due campi, non l'AND di default di DjangoFilterBackend.
        queryset = super().get_queryset()
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(Q(nome__icontains=search) | Q(telefono__icontains=search))
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # 'telefono' non è unique a livello di DB: get_or_create() userebbe .get(), a rischio
            # di MultipleObjectsReturned; filter().first() tollera duplicati pre-esistenti.
            cliente = Cliente.objects.filter(telefono=data['telefono']).order_by('created_at').first()
            created = cliente is None
            if created:
                cliente = Cliente.objects.create(
                    telefono=data['telefono'],
                    nome=data['nome'],
                )
            else:
                cliente.nome = data['nome']
                cliente.save(update_fields=['nome', 'updated_at'])

        response_serializer = self.get_serializer(cliente)
        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(response_serializer.data, status=status_code)