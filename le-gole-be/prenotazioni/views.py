from datetime import datetime

from django.db import transaction
from django.db.models import Count
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
import weasyprint

from struttura.models import PiscinaInventario
from .models import PrenotazionePiscina, OccupazionePostazione, GiornoPienoPiscina
from .serializers import (
    PrenotazionePiscinaSerializer,
    OccupazionePostazioneSerializer,
    GiornoPienoPiscinaSerializer,
)
from .utils import calcola_disponibilita

class PrenotazionePiscinaViewSet(viewsets.ModelViewSet):
    """
    CRUD Prenotazioni Piscina.
    """
    queryset = PrenotazionePiscina.objects.all()
    serializer_class = PrenotazionePiscinaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['data', 'stato', 'cliente_id']

    def get_permissions(self):
        # 'create' è pubblico per il flusso di prenotazione self-service lato Area Cliente
        # (stesso pattern di ClienteViewSet.create, vedi users/views.py): il cliente finale non
        # ha un token JWT. 'disponibilita' e 'scarica_biglietto' hanno permission_classes dedicate
        # via @action qui sotto; tutte le altre azioni (list/retrieve/update/delete) restano
        # riservate allo staff per non esporre pubblicamente nome/telefono/note degli altri clienti.
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        # OccupazionePostazione.prenotazione è SET_NULL: senza intervento esplicito, cancellare
        # una prenotazione lascerebbe le postazioni già assegnate "occupate" sulla mappa (solo
        # scollegate). Le eliminiamo insieme alla prenotazione, liberando davvero le postazioni.
        prenotazione = self.get_object()
        with transaction.atomic():
            OccupazionePostazione.objects.filter(prenotazione=prenotazione).delete()
            self.perform_destroy(prenotazione)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def scarica_biglietto(self, request, pk=None):
        """
        Endpoint per generare e scaricare il biglietto PDF, pubblico (AllowAny): il cliente
        self-service (Area Cliente) non ha un token JWT e deve poter scaricare il biglietto
        della propria prenotazione subito dopo averla effettuata. Sicurezza: nessun altro dato
        è esposto da questo endpoint se non quelli già presenti sul biglietto stesso, e l'unico
        modo per indovinare l'URL è conoscere già l'UUID v4 della prenotazione (non enumerabile,
        a differenza di un ID incrementale) — lo stesso principio usato da molti link di conferma
        ordine/prenotazione "a capacità" (chi ha l'URL può vedere il biglietto).
        Chiamata: GET /api/v1/prenotazioni/piscina/{id_prenotazione}/scarica_biglietto/
        """
        prenotazione = self.get_object()

        # Bloccato solo per le prenotazioni cancellate: una prenotazione PENDING (self-service,
        # in attesa di conferma staff) genera comunque il biglietto, che funge da riepilogo della
        # richiesta da mostrare in biglietteria — dove lo staff la confermerà fisicamente. Il PDF
        # riporta lo stato reale (vedi template), quindi non c'è ambiguità per chi lo controlla.
        if prenotazione.stato == 'CANCELLED':
            return Response(
                {"detail": "Il biglietto non è disponibile per le prenotazioni cancellate."},
                status=400
            )

        # Preparazione del contesto per il template HTML
        context = {
            'prenotazione': prenotazione,
            'cliente': prenotazione.cliente_id
        }

        # Rendering dell'HTML in stringa
        html_string = render_to_string('ticket_piscina.html', context)
        html = weasyprint.HTML(string=html_string)
        
        # Generazione del PDF in formato binario
        pdf = html.write_pdf()

        # Creazione della risposta HTTP
        response = HttpResponse(pdf, content_type='application/pdf')
        # Il parametro 'attachment' forza il browser (o l'app React Native) a scaricare il file
        response['Content-Disposition'] = f'attachment; filename="ticket_{prenotazione.id}.pdf"'

        return response

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def disponibilita(self, request):
        """
        Residuo di ombrelloni/gazebi/lettini/sdraie per un inventario in una data, pubblico
        (nessun dato personale dei clienti, solo conteggi aggregati) — usato dal flusso di
        prenotazione self-service in Area Cliente per mostrare la disponibilità residua prima
        dell'invio, senza dover autenticare il cliente per leggere /piscina/?data=... (che invece
        esporrebbe nome/telefono/note di tutte le prenotazioni di quel giorno).
        Chiamata: GET /api/v1/prenotazioni/piscina/disponibilita/?inventario={id}&data=YYYY-MM-DD
        """
        inventario_id = request.query_params.get('inventario')
        data_str = request.query_params.get('data')
        if not inventario_id or not data_str:
            return Response(
                {"detail": "Parametri 'inventario' e 'data' obbligatori."}, status=400
            )

        try:
            inventario = PiscinaInventario.objects.get(pk=inventario_id)
        except (PiscinaInventario.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Inventario non trovato."}, status=404)

        try:
            data_richiesta = datetime.strptime(data_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Formato data non valido, atteso YYYY-MM-DD."}, status=400)

        residui = calcola_disponibilita(inventario, data_richiesta)
        # 'pieno': flag manuale impostato dallo staff (GiornoPienoPiscinaViewSet), indipendente
        # dai conteggi residui sopra — copre i casi (evento privato, chiusura straordinaria...)
        # in cui la piscina è comunque al completo anche con risorse numericamente disponibili.
        residui['pieno'] = GiornoPienoPiscina.objects.filter(
            inventario=inventario, data=data_richiesta
        ).exists()
        return Response(residui)

    @action(detail=False, methods=['get'])
    def conteggi(self, request):
        """
        Numero di prenotazioni (non cancellate) per giorno, in un dato mese, per un inventario —
        usato dal calendario di selezione data lato staff per mostrare quante prenotazioni ci
        sono in ogni giorno del mese visibile (anche passati) senza doverle richiedere una alla
        volta. Riservato allo staff (permessi di default della viewset, IsAuthenticated) come
        list/retrieve: a differenza di 'disponibilita' qui non servirebbe nascondere dati
        personali (sono solo conteggi), ma non ha comunque senso esporlo pubblicamente dato che è
        pensato solo per il calendario della mappa staff.
        Chiamata: GET /api/v1/prenotazioni/piscina/conteggi/?inventario={id}&anno=2026&mese=7
        Risposta: {"2026-07-01": 3, "2026-07-05": 1, ...} (sparso: i giorni assenti hanno 0)
        """
        inventario_id = request.query_params.get('inventario')
        anno = request.query_params.get('anno')
        mese = request.query_params.get('mese')
        if not inventario_id or not anno or not mese:
            return Response(
                {"detail": "Parametri 'inventario', 'anno' e 'mese' obbligatori."}, status=400
            )

        try:
            anno_int = int(anno)
            mese_int = int(mese)
        except ValueError:
            return Response({"detail": "'anno' e 'mese' devono essere numerici."}, status=400)

        conteggi = (
            PrenotazionePiscina.objects.filter(
                inventario_id=inventario_id, data__year=anno_int, data__month=mese_int
            )
            .exclude(stato='CANCELLED')
            .values('data')
            .annotate(totale=Count('id'))
        )
        return Response({row['data'].isoformat(): row['totale'] for row in conteggi})


class OccupazionePostazioneViewSet(viewsets.ModelViewSet):
    """
    Assegnazione giornaliera delle postazioni (ombrelloni/gazebi) ai clienti.
    """
    queryset = OccupazionePostazione.objects.all()
    serializer_class = OccupazionePostazioneSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['data', 'postazione', 'postazione__inventario']


class GiornoPienoPiscinaViewSet(viewsets.ModelViewSet):
    """
    Marcatura/rimozione "giorno tutto prenotato" per un inventario, riservata allo staff
    (permessi di default della viewset, IsAuthenticated) — vedi GiornoPienoPiscina e
    PrenotazionePiscinaSerializer.validate() per l'effetto lato prenotazioni self-service.
    Nessuna azione custom di scrittura: il frontend crea/elimina per attivare/disattivare il
    flag su una data (basta list/create/destroy standard del ModelViewSet). 'calendario' è
    l'unica azione pubblica, di sola lettura (vedi sotto).
    """
    queryset = GiornoPienoPiscina.objects.all()
    serializer_class = GiornoPienoPiscinaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['inventario', 'data']

    def get_permissions(self):
        if self.action == 'calendario':
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def calendario(self, request):
        """
        Elenco delle sole DATE (nessun altro dato) marcate "tutto prenotato" per un inventario in
        un dato mese — pubblico, usato dal calendario di selezione data lato Area Cliente per
        marcare visivamente i giorni completi prima ancora che il cliente li selezioni (analogo a
        'conteggi' su PrenotazionePiscinaViewSet, ma pubblico e senza numeri, solo le date).
        Chiamata: GET /api/v1/prenotazioni/giorni-pieni/calendario/?inventario={id}&anno=2026&mese=7
        Risposta: ["2026-07-05", "2026-07-12"]
        """
        inventario_id = request.query_params.get('inventario')
        anno = request.query_params.get('anno')
        mese = request.query_params.get('mese')
        if not inventario_id or not anno or not mese:
            return Response(
                {"detail": "Parametri 'inventario', 'anno' e 'mese' obbligatori."}, status=400
            )

        try:
            anno_int = int(anno)
            mese_int = int(mese)
        except ValueError:
            return Response({"detail": "'anno' e 'mese' devono essere numerici."}, status=400)

        date_piene = GiornoPienoPiscina.objects.filter(
            inventario_id=inventario_id, data__year=anno_int, data__month=mese_int
        ).values_list('data', flat=True)
        return Response([d.isoformat() for d in date_piene])