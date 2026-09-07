from datetime import datetime

from django.db import transaction
from django.db.models import ProtectedError, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.views import APIView
from .models import (
    ConfigurazionePadel,
    GiornoChiusoPadel,
    PiscinaInventario,
    Postazione,
    RacchettaPadel,
)
from .serializers import (
    ConfigurazionePadelSerializer,
    GiornoChiusoPadelSerializer,
    PiscinaInventarioSerializer,
    PostazioneSerializer,
    RacchettaPadelSerializer,
)

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

        # Prenotazioni odierne/future non cancellate bloccano l'eliminazione; le CANCELLED sono
        # escluse (non impegnano più alcuna risorsa) e vengono ripulite sotto.
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
                # Ogni prenotazione rimasta collegata è passata o futura CANCELLED: va ripulita
                # qui, altrimenti farebbe fallire perform_destroy() con un ProtectedError.
                PrenotazionePiscina.objects.filter(inventario=inventario).delete()
                self.perform_destroy(inventario)
        except ProtectedError:
            # Rete di sicurezza per riferimenti PROTECT residui non previsti sopra.
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
        Se ?data=YYYY-MM-DD è una data passata, ricostruisce la mappa "come era" quel giorno:
        include le postazioni eliminate dopo quella data, esclude quelle create dopo, e
        sovrascrive pos_x/pos_y con la posizione storica effettiva. Per oggi/il futuro invariato.
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

class ConfigurazionePadelView(APIView):
    """
    Configurazione singleton del servizio padel (attivazione, orari, durata, prezzi, partecipanti
    massimi). Non un ModelViewSet: non esiste alcun concetto di lista/creazione/eliminazione per
    questa risorsa, solo lettura e aggiornamento dell'unica riga condivisa — stesso identico
    pattern di menu.ConfigurazioneAsportoView. Lettura pubblica (il flusso self-service deve poter
    mostrare orari, durata e prezzi senza autenticarsi), scrittura riservata allo staff.
    """
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        serializer = ConfigurazionePadelSerializer(ConfigurazionePadel.get_solo())
        return Response(serializer.data)

    def patch(self, request):
        config = ConfigurazionePadel.get_solo()
        serializer = ConfigurazionePadelSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class GiornoChiusoPadelViewSet(viewsets.ModelViewSet):
    """
    Giorni in cui il campo da padel è chiuso per l'intera giornata, gestiti dallo staff da un
    calendario (crea per marcare, elimina per riaprire — nessun update: un giorno o è chiuso o non
    lo è). 'prossime' è l'unica azione pubblica, di sola lettura, usata dal flusso self-service
    per marcare in anticipo le date non prenotabili sul calendario — stesso identico pattern di
    menu.GiornoChiusoAsportoViewSet.
    """
    queryset = GiornoChiusoPadel.objects.all()
    serializer_class = GiornoChiusoPadelSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == 'prossime':
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def prossime(self, request):
        """
        Date di chiusura da oggi in poi (oggi incluso), ordinate crescenti — pubblico.
        GET /api/v1/struttura/giorni-chiusi-padel/prossime/
        Risposta: ["2026-09-10", "2026-09-11"]
        """
        oggi = timezone.localdate()
        date_chiuse = GiornoChiusoPadel.objects.filter(data__gte=oggi).values_list('data', flat=True)
        return Response([d.isoformat() for d in date_chiuse])


class RacchettaPadelViewSet(viewsets.ModelViewSet):
    """
    Catalogo delle racchette noleggiabili, gestito dallo staff. Lettura pubblica (il cliente deve
    poter scegliere marca e vedere la tariffa senza autenticarsi), scrittura riservata allo staff
    — stesso identico pattern di menu.ProdottoViewSet. Filtrabile per `disponibile`.
    """
    queryset = RacchettaPadel.objects.all()
    serializer_class = RacchettaPadelSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filterset_fields = ['disponibile']

    def destroy(self, request, *args, **kwargs):
        # NoleggioRacchetta.racchetta è PROTECT: senza questa gestione esplicita, eliminare una
        # racchetta già noleggiata solleverebbe un ProtectedError propagato da DRF come 500
        # grezzo — stesso identico fix già applicato a ProdottoViewSet/CategoriaViewSet.
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": (
                        "Impossibile eliminare questa racchetta: esistono prenotazioni collegate "
                        "ad essa. Puoi toglierla dal noleggio invece di eliminarla."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
