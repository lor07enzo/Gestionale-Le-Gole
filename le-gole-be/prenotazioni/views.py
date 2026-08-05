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
        # 'create' è pubblico per il flusso self-service Area Cliente (stesso pattern di
        # ClienteViewSet.create, users/views.py); le altre azioni restano riservate allo staff.
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    def destroy(self, request, *args, **kwargs):
        # OccupazionePostazione.prenotazione è SET_NULL: le eliminiamo esplicitamente insieme
        # alla prenotazione, altrimenti le postazioni resterebbero "occupate" (solo scollegate).
        prenotazione = self.get_object()
        with transaction.atomic():
            OccupazionePostazione.objects.filter(prenotazione=prenotazione).delete()
            self.perform_destroy(prenotazione)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny])
    def scarica_biglietto(self, request, pk=None):
        """
        Genera e scarica il biglietto PDF. Pubblico (AllowAny): il cliente self-service non ha
        un token JWT. L'UUID v4 della prenotazione, non enumerabile, funge da unico "segreto".
        GET /api/v1/prenotazioni/piscina/{id_prenotazione}/scarica_biglietto/
        """
        prenotazione = self.get_object()

        # Bloccato solo per le prenotazioni cancellate: una PENDING genera comunque il biglietto
        # come riepilogo da mostrare in biglietteria, dove lo staff la conferma fisicamente.
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
        Residuo ombrelloni/gazebi/lettini/sdraie per inventario+data, pubblico (solo conteggi
        aggregati, nessun dato personale) — usato dal self-service per non dover autenticare il
        cliente per leggere /piscina/?data=... (che esporrebbe le prenotazioni altrui).
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
        # Flag manuale staff, indipendente dai conteggi: copre i casi (evento privato, chiusura
        # straordinaria) in cui la piscina è al completo pur con risorse numericamente disponibili.
        residui['pieno'] = GiornoPienoPiscina.objects.filter(
            inventario=inventario, data=data_richiesta
        ).exists()
        return Response(residui)

    @action(detail=False, methods=['get'])
    def conteggi(self, request):
        """
        Numero di prenotazioni (non cancellate) per giorno in un mese, per il calendario staff.
        Riservato allo staff (permessi di default della viewset).
        GET /api/v1/prenotazioni/piscina/conteggi/?inventario={id}&anno=2026&mese=7
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

    def get_permissions(self):
        # 'occupate' è pubblica per la mappa piscina self-service (Area Cliente): espone solo gli
        # id delle postazioni occupate, mai i dati personali del cliente occupante (nome/telefono),
        # a differenza della list ordinaria di questa viewset che resta riservata allo staff.
        if self.action == 'occupate':
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def occupate(self, request):
        """
        Elenco degli id delle Postazione occupate per un inventario+data, pubblico e privo di
        qualunque dato personale — usato dalla mappa piscina lato Area Cliente per mostrare quali
        postazioni sono già assegnate senza esporre nome/telefono/note del cliente occupante.
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
    Marcatura/rimozione "giorno tutto prenotato" per un inventario, riservata allo staff — vedi
    GiornoPienoPiscina e PrenotazionePiscinaSerializer.validate(). Solo list/create/destroy
    standard; 'calendario' è l'unica azione pubblica, di sola lettura.
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
        Elenco delle sole date "tutto prenotato" per un inventario in un mese — pubblico, per il
        calendario Area Cliente (analogo a 'conteggi' sopra, ma senza numeri, solo le date).
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