from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.db.models import Q
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from backend import openapi
from .models import Cliente, DispositivoStaff
from .permissions import IsSuperUser
from .serializers import (
    UtenteSerializer,
    UtenteCreateSerializer,
    ActivateAccountSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    ClienteSerializer,
    DispositivoStaffSerializer,
)
from .utils import send_activation_email, send_password_reset_email

Utente = get_user_model()


@extend_schema_view(
    create=extend_schema(
        summary='Invita un nuovo account staff (superuser)',
        description=(
            "L'account nasce **senza password utilizzabile** (`set_unusable_password()`) e riceve "
            "subito un'email di attivazione: la password la imposta lo staff stesso da "
            '`POST /users/staff/activate/`. Il body accetta solo `username` ed `email`.'
        ),
        request=UtenteCreateSerializer,
        responses={201: UtenteSerializer, 400: openapi.errore('Username o email già in uso.')},
    ),
    destroy=extend_schema(
        summary='Elimina un account staff (superuser)',
        responses={
            204: None,
            400: openapi.errore(
                'Un account superuser non è mai eliminabile, nemmeno da un altro superuser: '
                'può solo essere disattivato con `set-active`.'
            ),
        },
    ),
)
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
        # Un superuser è disattivabile (set_active) ma mai eliminabile: perderlo per errore non
        # avrebbe rimedio se non da manage.py createsuperuser. Vale sempre, non solo su se stesso.
        user = self.get_object()
        if user.is_superuser:
            return Response(
                {'detail': 'Un account superuser non può essere eliminato. Puoi solo disattivarlo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @extend_schema(
        summary="Profilo dell'account autenticato",
        responses={200: UtenteSerializer},
    )
    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = UtenteSerializer(request.user)
        return Response(serializer.data)

    @extend_schema(
        summary="Imposta la prima password e attiva l'account (pubblico)",
        description=(
            "`uid` e `token` arrivano dal link nell'email di invito. Il token è tempo-limitato "
            'e a uso singolo (invalidato dal cambio password stesso).'
        ),
        request=ActivateAccountSerializer,
        responses={
            200: openapi.messaggio('Account attivato.', 'Account attivato con successo.'),
            400: openapi.errore('Link di attivazione non valido o scaduto.'),
        },
    )
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

    @extend_schema(
        summary='Richiedi il reset della password (pubblico)',
        description=(
            'Risponde **sempre** con lo stesso messaggio, esista o meno un account con '
            "quell'indirizzo: rivelare quali email sono registrate permetterebbe di enumerare "
            "gli account staff."
        ),
        request=PasswordResetRequestSerializer,
        responses={
            200: openapi.messaggio(
                'Messaggio generico, identico in entrambi i casi.',
                "Se l'indirizzo è registrato, riceverai un'email con le istruzioni.",
            ),
            400: openapi.errore('Email mancante o malformata.'),
        },
    )
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

    @extend_schema(
        summary='Conferma il reset e imposta la nuova password (pubblico)',
        request=PasswordResetConfirmSerializer,
        responses={
            200: openapi.messaggio('Password aggiornata.', 'Password reimpostata con successo.'),
            400: openapi.errore('Link non valido o scaduto.'),
        },
    )
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

    @extend_schema(
        summary='Attiva o disattiva un account staff (superuser)',
        description=(
            'Un superuser **non** può disattivare se stesso (si chiuderebbe fuori senza rimedio '
            'se non da `manage.py createsuperuser`), ma può disattivarne un altro.'
        ),
        request={
            'application/json': {
                'type': 'object',
                'properties': {'is_active': {'type': 'boolean'}},
                'required': ['is_active'],
            }
        },
        responses={
            200: UtenteSerializer,
            400: openapi.errore(
                "`is_active` mancante o non booleano, oppure è il proprio stesso account."
            ),
        },
    )
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


@extend_schema_view(
    create=extend_schema(
        summary='Registra il dispositivo per le notifiche push (staff)',
        description=(
            "**Upsert per `token`**, non una semplice creazione: il token identifica "
            "l'installazione dell'app, non la persona. Se un altro account fa login sullo stesso "
            'dispositivo la riga non si duplica, cambia proprietario — altrimenti chi si è '
            'disconnesso continuerebbe a ricevere notifiche su un telefono che non usa più.'
        ),
        responses={
            201: DispositivoStaffSerializer,
            200: OpenApiResponse(
                response=DispositivoStaffSerializer,
                description='Dispositivo già registrato: aggiornato, non duplicato.',
            ),
            400: openapi.errore('Token push malformato.'),
        },
    ),
)
class DispositivoStaffViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """
    Registrazione dei dispositivi su cui recapitare le notifiche push (users/push.py).

    Nessun `list`/`retrieve`/`destroy` standard: l'elenco dei propri dispositivi non serve a
    niente lato app, e la cancellazione passa da `rimuovi` perché un Expo push token contiene
    parentesi quadre, scomode da mettere in un path come pk.
    """
    queryset = DispositivoStaff.objects.all()
    serializer_class = DispositivoStaffSerializer
    permission_classes = [IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        dispositivo, created = DispositivoStaff.objects.update_or_create(
            token=data['token'],
            defaults={'utente': request.user, 'piattaforma': data.get('piattaforma', '')},
        )

        status_code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(self.get_serializer(dispositivo).data, status=status_code)

    @extend_schema(
        summary='Rimuove il dispositivo dalle notifiche push (staff)',
        description=(
            'Da chiamare al logout, **prima** di scartare il token JWT. Rimuove solo un '
            'dispositivo proprio: un account non può silenziare il telefono di un collega.'
        ),
        request=DispositivoStaffSerializer,
        responses={
            204: None,
            400: openapi.errore('Token push mancante o malformato.'),
        },
    )
    @action(detail=False, methods=['post'])
    def rimuovi(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        DispositivoStaff.objects.filter(
            token=serializer.validated_data['token'], utente=request.user
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema_view(
    list=extend_schema(
        summary='Elenco clienti, con ricerca testuale (staff)',
        parameters=[openapi.PARAM_SEARCH_CLIENTE],
    ),
    create=extend_schema(
        summary='Crea o aggiorna un cliente per numero di telefono (pubblico)',
        description=(
            "**Upsert**, non una semplice creazione: `telefono` è la chiave d'identità del "
            'cliente. Se esiste già, il record viene aggiornato con il nuovo `nome` invece di '
            'essere duplicato — da cui il `200` accanto al `201`.'
        ),
        responses={
            201: ClienteSerializer,
            200: OpenApiResponse(
                response=ClienteSerializer,
                description='Cliente già esistente con quel telefono: aggiornato, non creato.',
            ),
        },
    ),
)
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