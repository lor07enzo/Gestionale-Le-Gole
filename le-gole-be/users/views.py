from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from .models import Cliente
from .permissions import IsSuperUser
from .serializers import UtenteSerializer, ClienteSerializer

Utente = get_user_model()

class UtenteViewSet(viewsets.ModelViewSet):
    queryset = Utente.objects.all()
    serializer_class = UtenteSerializer
    permission_classes = [IsSuperUser]

    def get_permissions(self):
        # Ogni utente autenticato può leggere il proprio profilo; gestire l'elenco
        # e gli account altrui resta riservato ai superuser (IsSuperUser sopra).
        if self.action == 'me':
            return [IsAuthenticated()]
        return super().get_permissions()

    @action(detail=False, methods=['get'])
    def me(self, request):
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
