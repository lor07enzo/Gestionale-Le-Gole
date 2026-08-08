from datetime import datetime

from django.db import transaction
from django.db.models import ProtectedError, Q
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
from prenotazioni.utils import posizioni_effettive, registra_posizione_storico

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

        # Prenotazioni odierne/future NON cancellate bloccano l'eliminazione (chi ha prenotato
        # conta su quella disponibilità) — le CANCELLED sono escluse: da quando l'annullamento
        # (stato='CANCELLED') ha sostituito l'eliminazione definitiva come azione normale dello
        # staff (sezione 5), una prenotazione futura annullata non impegna più alcuna risorsa e
        # non deve poter bloccare per sempre l'eliminazione del listino. Le prenotazioni passate
        # sono solo storico e vengono comunque ripulite (qualsiasi stato) per liberare il PROTECT
        # su PrenotazionePiscina.inventario.
        ha_prenotazioni_correnti_o_future = (
            PrenotazionePiscina.objects.filter(inventario=inventario, data__gte=oggi)
            .exclude(stato='CANCELLED')
            .exists()
        )

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
                # A questo punto ogni prenotazione rimasta collegata è o passata (qualsiasi stato)
                # o futura ma CANCELLED (l'unico caso non bloccato sopra) — in entrambi i casi va
                # ripulita qui, altrimenti una futura CANCELLED farebbe comunque fallire
                # perform_destroy() sotto con un ProtectedError (PrenotazionePiscina.inventario è
                # PROTECT). Non basta più filtrare solo su data__lt=oggi come prima.
                PrenotazionePiscina.objects.filter(inventario=inventario).delete()
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
    serializer_class = PostazioneSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filterset_fields = ['inventario', 'tipo']

    def get_queryset(self):
        # Le postazioni soft-deleted (vedi destroy()) non compaiono nelle viste "live" — la
        # vista storica in list(), sotto, interroga il modello direttamente quando serve.
        return Postazione.objects.filter(deleted_at__isnull=True)

    def perform_create(self, serializer):
        postazione = serializer.save()
        registra_posizione_storico(postazione)

    def perform_update(self, serializer):
        postazione = serializer.save()
        registra_posizione_storico(postazione)

    def destroy(self, request, *args, **kwargs):
        # Soft delete, non un DELETE reale — vedi il commento su Postazione.deleted_at.
        postazione = self.get_object()
        postazione.deleted_at = timezone.now()
        postazione.save(update_fields=['deleted_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def list(self, request, *args, **kwargs):
        """
        Se è presente ?data=YYYY-MM-DD ED è una data passata, ricostruisce la mappa "come era"
        quel giorno invece di quella attuale:
        - include anche le postazioni nel frattempo eliminate (soft-delete), se lo sono state
          DOPO quella data — esistevano ancora allora;
        - esclude le postazioni create DOPO quella data — non esistevano ancora;
        - sovrascrive pos_x/pos_y con la posizione storica effettiva in quel giorno (vedi
          prenotazioni.utils.posizioni_effettive).
        Per oggi/il futuro (o senza 'data') il comportamento è quello live invariato.
        """
        data_str = request.query_params.get('data')
        if not data_str:
            return super().list(request, *args, **kwargs)

        try:
            data_richiesta = datetime.strptime(data_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Formato data non valido, atteso YYYY-MM-DD."}, status=400)

        if data_richiesta >= timezone.localdate():
            return super().list(request, *args, **kwargs)

        queryset = Postazione.objects.filter(created_at__date__lte=data_richiesta).filter(
            Q(deleted_at__isnull=True) | Q(deleted_at__date__gt=data_richiesta)
        )
        queryset = self.filter_queryset(queryset)

        serializer = self.get_serializer(queryset, many=True)
        payload = serializer.data

        overrides = posizioni_effettive([item['id'] for item in payload], data_richiesta)
        for item in payload:
            pos = overrides.get(str(item['id']))
            if pos:
                item['pos_x'], item['pos_y'] = pos

        return Response(payload)