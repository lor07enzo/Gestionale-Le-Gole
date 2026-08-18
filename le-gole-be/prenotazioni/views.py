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