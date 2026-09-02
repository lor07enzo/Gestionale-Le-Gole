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
from .models import PrenotazionePiscina, PrenotazioneAsporto, OccupazionePostazione, GiornoPienoPiscina
from .serializers import (
    PrenotazionePiscinaSerializer,
    PrenotazioneAsportoSerializer,
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
        # 'create' è pubblico per il flusso self-service Area Cliente.
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Stato e creata_da_staff sono forzati qui (mai dal payload, 'create' è pubblica): una
        # richiesta anonima nasce sempre CONFIRMED e creata_da_staff=False.
        request = self.request
        is_richiesta_pubblica = not (request.user and request.user.is_authenticated)
        if is_richiesta_pubblica:
            serializer.save(stato='CONFIRMED', creata_da_staff=False)
        else:
            serializer.save(creata_da_staff=True)

    def destroy(self, request, *args, **kwargs):
        # OccupazionePostazione.prenotazione è SET_NULL: eliminiamo esplicitamente insieme alla
        # prenotazione, altrimenti le postazioni resterebbero "occupate".
        prenotazione = self.get_object()
        with transaction.atomic():
            OccupazionePostazione.objects.filter(prenotazione=prenotazione).delete()
            self.perform_destroy(prenotazione)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_update(self, serializer):
        # Annullare una prenotazione libera automaticamente le postazioni già assegnate. Stato
        # confrontato PRIMA del save per non ripetere l'eliminazione ad ogni ulteriore PATCH.
        era_cancellata = serializer.instance.stato == 'CANCELLED'
        with transaction.atomic():
            prenotazione = serializer.save()
            if not era_cancellata and prenotazione.stato == 'CANCELLED':
                OccupazionePostazione.objects.filter(prenotazione=prenotazione).delete()

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def scarica_biglietto(self, request, pk=None):
        """
        Genera e scarica il biglietto PDF. Pubblico: l'UUID v4 della prenotazione funge da segreto.
        GET /api/v1/prenotazioni/piscina/{id_prenotazione}/scarica_biglietto/
        """
        prenotazione = self.get_object()

        if prenotazione.stato == 'CANCELLED':
            return Response(
                {"detail": "Il biglietto non è disponibile per le prenotazioni cancellate."},
                status=400
            )

        context = {
            'prenotazione': prenotazione,
            'cliente': prenotazione.cliente_id
        }

        html_string = render_to_string('ticket_piscina.html', context)
        html = weasyprint.HTML(string=html_string)
        pdf = html.write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ticket_{prenotazione.id}.pdf"'

        return response

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def disponibilita(self, request):
        """
        Residuo ombrelloni/gazebi/lettini/sdraie per inventario+data, pubblico e aggregato.
        GET /api/v1/prenotazioni/piscina/disponibilita/?inventario={id}&data=YYYY-MM-DD
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
        # Flag manuale staff, indipendente dai conteggi.
        residui['pieno'] = GiornoPienoPiscina.objects.filter(
            inventario=inventario, data=data_richiesta
        ).exists()
        return Response(residui)

    @action(detail=False, methods=['get'])
    def recenti(self, request):
        """
        Le prenotazioni più recenti per data di creazione, per il pannello notifiche staff.
        Esclude 'creata_da_staff': un walk-in registrato dallo staff non deve notificare se stesso.
        GET /api/v1/prenotazioni/piscina/recenti/?limit=50
        """
        try:
            limit = min(int(request.query_params.get('limit', 50)), 200)
        except ValueError:
            limit = 50

        queryset = (
            PrenotazionePiscina.objects.exclude(stato='CANCELLED')
            .filter(creata_da_staff=False)
            .select_related('inventario', 'cliente_id')
            .order_by('-created_at')[:limit]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def storico_telefono(self, request):
        """
        Storico completo (tutti gli stati, incluse CANCELLED) delle prenotazioni piscina per un
        numero di telefono esatto — pubblico, per la consultazione self-service "Le mie
        prenotazioni" lato Area Cliente (nessun login cliente esiste in questo progetto: il
        numero di telefono è l'unico "segreto" richiesto, stesso principio di fiducia già usato
        per il biglietto PDF via UUID). Match esatto (non icontains) per non trasformare questo
        endpoint in una ricerca libera che permetterebbe di scorrere l'anagrafica clienti per
        frammenti di numero — a differenza di ClienteViewSet.get_queryset() (?search=), riservato
        allo staff proprio perché fa un OR case-insensitive su nome/telefono.
        GET /api/v1/prenotazioni/piscina/storico_telefono/?telefono=...
        """
        telefono = request.query_params.get('telefono', '').strip()
        if not telefono:
            return Response({"detail": "Parametro 'telefono' obbligatorio."}, status=400)

        queryset = (
            PrenotazionePiscina.objects.filter(cliente_id__telefono=telefono)
            .select_related('inventario', 'cliente_id')
            .order_by('-data', '-ora')
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def dettaglio_pubblico(self, request, pk=None):
        """
        Dettaglio completo di una singola prenotazione, pubblico — l'UUID v4 della prenotazione
        funge da segreto, stesso principio già usato per scarica_biglietto/storico_telefono.
        Usato dalla pagina di dettaglio self-service "Le mie prenotazioni" (Area Cliente, sezione
        7/15), raggiunta dalle card di storico_telefono: qui il singolo record viene riletto per
        id, senza richiedere di nuovo il telefono. Nessuna restrizione sullo stato (a differenza
        di scarica_biglietto): consultare i dettagli di una prenotazione cancellata resta lecito,
        è solo il PDF a non avere senso in quel caso.
        GET /api/v1/prenotazioni/piscina/{id}/dettaglio_pubblico/
        """
        prenotazione = self.get_object()
        serializer = self.get_serializer(prenotazione)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def conteggi(self, request):
        """
        Numero di prenotazioni (non cancellate) per giorno in un mese, per il calendario staff.
        GET /api/v1/prenotazioni/piscina/conteggi/?inventario={id}&anno=2026&mese=7
        Risposta: {"2026-07-01": 3, ...} (sparso: i giorni assenti hanno 0)
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


class PrenotazioneAsportoViewSet(viewsets.ModelViewSet):
    """
    CRUD Prenotazioni Asporto. Le righe d'ordine vivono su menu.VoceOrdine (endpoint separato,
    filtrabile per 'prenotazione') — stesso pattern con cui OccupazionePostazione è separata da
    PrenotazionePiscina, sotto.
    """
    queryset = PrenotazioneAsporto.objects.all()
    serializer_class = PrenotazioneAsportoSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['data', 'stato', 'cliente_id']

    def get_permissions(self):
        # 'create' è pubblico per il flusso self-service Area Cliente.
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Stesso principio di PrenotazionePiscinaViewSet.perform_create(): una richiesta
        # anonima nasce sempre CONFIRMED e creata_da_staff=False, mai dal payload.
        request = self.request
        is_richiesta_pubblica = not (request.user and request.user.is_authenticated)
        if is_richiesta_pubblica:
            serializer.save(stato='CONFIRMED', creata_da_staff=False)
        else:
            serializer.save(creata_da_staff=True)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def scarica_ricevuta(self, request, pk=None):
        """
        Genera e scarica la ricevuta PDF dell'ordine. Pubblica, stesso identico principio di
        PrenotazionePiscinaViewSet.scarica_biglietto: l'UUID v4 dell'ordine funge da segreto,
        nessun altro dato richiesto per raggiungerla.
        GET /api/v1/prenotazioni/asporto/{id_prenotazione}/scarica_ricevuta/
        """
        prenotazione = self.get_object()

        if prenotazione.stato == 'CANCELLED':
            return Response(
                {"detail": "La ricevuta non è disponibile per gli ordini cancellati."},
                status=400
            )

        context = {
            'prenotazione': prenotazione,
            'cliente': prenotazione.cliente_id,
            # select_related sul prodotto: senza, il template genererebbe una query per riga
            # (voce.prodotto.nome) invece di una sola per l'intero ordine.
            'voci': prenotazione.voci.select_related('prodotto').all(),
            'totale': prenotazione.totale,
        }

        html_string = render_to_string('ricevuta_asporto.html', context)
        html = weasyprint.HTML(string=html_string)
        pdf = html.write_pdf()

        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="ricevuta_{prenotazione.id}.pdf"'

        return response

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def dettaglio_pubblico(self, request, pk=None):
        """
        Stesso identico principio di PrenotazionePiscinaViewSet.dettaglio_pubblico, con in più le
        righe VoceOrdine dell'ordine (annidate in 'voci') — l'unico punto in cui una lettura
        pubblica di VoceOrdine è esposta, deliberatamente ristretta a un singolo ordine già noto
        per UUID: VoceOrdineViewSet.list() resta IsAuthenticated, nessun elenco libero pubblico.
        Import locale di VoceOrdineSerializer (menu), stesso principio dell'eccezione già
        documentata in PrenotazioneAsportoSerializer.validate() (sezione 1 di CLAUDE.md).
        GET /api/v1/prenotazioni/asporto/{id}/dettaglio_pubblico/
        """
        from menu.serializers import VoceOrdineSerializer

        prenotazione = self.get_object()
        voci = prenotazione.voci.select_related('prodotto').all()
        data = self.get_serializer(prenotazione).data
        data['voci'] = VoceOrdineSerializer(voci, many=True).data
        return Response(data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def storico_telefono(self, request):
        """
        Storico completo (tutti gli stati) degli ordini asporto per un numero di telefono esatto
        — pubblico, stesso identico principio/pattern di PrenotazionePiscinaViewSet.storico_telefono.
        GET /api/v1/prenotazioni/asporto/storico_telefono/?telefono=...
        """
        telefono = request.query_params.get('telefono', '').strip()
        if not telefono:
            return Response({"detail": "Parametro 'telefono' obbligatorio."}, status=400)

        queryset = (
            PrenotazioneAsporto.objects.filter(cliente_id__telefono=telefono)
            .select_related('cliente_id')
            .order_by('-data', '-ora')
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def recenti(self, request):
        """
        Le prenotazioni asporto più recenti per data di creazione — stessa forma/scopo di
        PrenotazionePiscinaViewSet.recenti, pronta per il tab "Asporto" del pannello notifiche
        staff (sezione 11), non ancora collegata lato frontend.
        GET /api/v1/prenotazioni/asporto/recenti/?limit=50
        """
        try:
            limit = min(int(request.query_params.get('limit', 50)), 200)
        except ValueError:
            limit = 50

        queryset = (
            PrenotazioneAsporto.objects.exclude(stato='CANCELLED')
            .filter(creata_da_staff=False)
            .select_related('cliente_id')
            .order_by('-created_at')[:limit]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def prenotazioni_per_orario(self, request):
        """
        GET /api/v1/prenotazioni/asporto/prenotazioni_per_orario/?data=YYYY-MM-DD — pubblica.
        Risposta: {"12:15": 2, "13:00": 1, ...} — numero di PRENOTAZIONI (ordini distinti, non
        CANCELLED) già presenti per ciascun orario in quella data — sostituisce (2026-08-28) il
        precedente `menu.VoceOrdineViewSet.prenotati_per_orario`, che sommava le quantità dei
        prodotti anziché contare gli ordini. Usata insieme a
        ConfigurazioneAsporto.limite_prenotazioni_orario per calcolare lato client il residuo per
        ciascuno slot — solo gli orari con almeno una prenotazione compaiono, un orario assente
        equivale a 0. Stesso pattern pubblico di 'disponibilita' altrove nel progetto: un aiuto
        per la UI dei picker orario, non l'unico punto in cui il limite viene fatto rispettare
        (PrenotazioneAsportoSerializer.validate() resta l'ultima parola).
        """
        data_str = request.query_params.get('data')
        if not data_str:
            return Response({"detail": "Il parametro 'data' è obbligatorio."}, status=400)
        try:
            data_richiesta = datetime.strptime(data_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Formato data non valido, atteso YYYY-MM-DD."}, status=400)

        righe = (
            PrenotazioneAsporto.objects.filter(data=data_richiesta)
            .exclude(stato='CANCELLED')
            .values('ora')
            .annotate(totale=Count('id'))
        )
        return Response({riga['ora'].strftime('%H:%M'): riga['totale'] for riga in righe})


class OccupazionePostazioneViewSet(viewsets.ModelViewSet):
    """
    Assegnazione giornaliera delle postazioni (ombrelloni/gazebi) ai clienti.
    """
    queryset = OccupazionePostazione.objects.all()
    serializer_class = OccupazionePostazioneSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['data', 'postazione', 'postazione__inventario']

    def get_permissions(self):
        # 'occupate' espone solo gli id delle postazioni, mai dati personali. 'create' è pubblica
        # per l'assegnazione automatica dal flusso self-service.
        if self.action in ('occupate', 'create'):
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # Un chiamante anonimo non può registrare un check-in mai avvenuto ('arrivato' forzato).
        request = self.request
        is_richiesta_pubblica = not (request.user and request.user.is_authenticated)
        if is_richiesta_pubblica:
            serializer.save(arrivato=False)
        else:
            serializer.save()

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def occupate(self, request):
        """
        Elenco degli id delle Postazione occupate per un inventario+data, pubblico e privo di
        dati personali.
        GET /api/v1/prenotazioni/occupazioni-postazione/occupate/?inventario={id}&data=YYYY-MM-DD
        Risposta: ["<postazione_id>", ...]
        """
        inventario_id = request.query_params.get('inventario')
        data_str = request.query_params.get('data')
        if not inventario_id or not data_str:
            return Response(
                {"detail": "Parametri 'inventario' e 'data' obbligatori."}, status=400
            )

        try:
            PiscinaInventario.objects.get(pk=inventario_id)
        except (PiscinaInventario.DoesNotExist, ValueError, TypeError):
            return Response({"detail": "Inventario non trovato."}, status=404)

        try:
            data_richiesta = datetime.strptime(data_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({"detail": "Formato data non valido, atteso YYYY-MM-DD."}, status=400)

        postazioni_ids = OccupazionePostazione.objects.filter(
            postazione__inventario_id=inventario_id, data=data_richiesta
        ).values_list('postazione_id', flat=True)
        return Response([str(pk) for pk in postazioni_ids])


class GiornoPienoPiscinaViewSet(viewsets.ModelViewSet):
    """
    Marcatura/rimozione "giorno tutto prenotato" per un inventario, riservata allo staff.
    'calendario' è l'unica azione pubblica, di sola lettura.
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
        Elenco delle sole date "tutto prenotato" per un inventario in un mese — pubblico.
        GET /api/v1/prenotazioni/giorni-pieni/calendario/?inventario={id}&anno=2026&mese=7
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