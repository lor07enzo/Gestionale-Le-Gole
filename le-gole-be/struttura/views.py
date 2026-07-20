from django.db import transaction
from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from .models import PiscinaInventario, Postazione
from .serializers import PiscinaInventarioSerializer, PostazioneSerializer

# Import "verticale" da prenotazioni (app transazionale): non crea un ciclo perché
# prenotazioni.models importa da struttura.models, non da struttura.views.
from prenotazioni.models import PrenotazionePiscina

class PiscinaInventarioViewSet(viewsets.ModelViewSet):
    """
    Gestione Inventari e Listini Piscina.
    Il CRUD è utile per il pannello Admin.
    """
    queryset = PiscinaInventario.objects.all()
    serializer_class = PiscinaInventarioSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def destroy(self, request, *args, **kwargs):
        inventario = self.get_object()
        oggi = timezone.localdate()

        # Un listino con prenotazioni odierne o future non può essere eliminato: chi ha già
        # prenotato conta su quella disponibilità/prezzo. Le prenotazioni passate, invece,
        # sono solo storico e vengono ripulite automaticamente per permettere l'eliminazione
        # (PrenotazionePiscina.inventario è PROTECT).
        ha_prenotazioni_correnti_o_future = PrenotazionePiscina.objects.filter(
            inventario=inventario, data__gte=oggi
        ).exists()

        if ha_prenotazioni_correnti_o_future:
            return Response(
                {
                    "detail": (
                        "Impossibile eliminare questo listino: esistono prenotazioni piscina "
                        "per la data odierna o per date future."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                PrenotazionePiscina.objects.filter(inventario=inventario, data__lt=oggi).delete()
                self.perform_destroy(inventario)
        except ProtectedError:
            # Rete di sicurezza per eventuali riferimenti PROTECT residui non previsti sopra:
            # meglio un 400 leggibile che un 500 grezzo.
            return Response(
                {
                    "detail": (
                        "Impossibile eliminare questo listino: esistono ancora prenotazioni "
                        "piscina collegate ad esso."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def attivo(self, request):
        """
        Endpoint custom rapido per recuperare subito il listino attivo (isActive=True)
        Chiamata: GET /api/v1/struttura/inventario-piscina/attivo/
        """
        inventario_attivo = PiscinaInventario.objects.filter(isActive=True).first()
        if inventario_attivo:
            serializer = self.get_serializer(inventario_attivo)
            return Response(serializer.data)
        return Response({"detail": "Nessun inventario attivo trovato."}, status=404)


class PostazioneViewSet(viewsets.ModelViewSet):
    """
    Gestione delle postazioni fisiche (ombrelloni/gazebi) sulla mappa di un inventario.
    """
    queryset = Postazione.objects.all()
    serializer_class = PostazioneSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filterset_fields = ['inventario', 'tipo']