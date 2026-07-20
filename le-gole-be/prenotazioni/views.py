from django.db import transaction
from django.http import HttpResponse
from django.template.loader import render_to_string
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import weasyprint

from .models import PrenotazionePiscina, OccupazionePostazione
from .serializers import PrenotazionePiscinaSerializer, OccupazionePostazioneSerializer

class PrenotazionePiscinaViewSet(viewsets.ModelViewSet):
    """
    CRUD Prenotazioni Piscina.
    """
    queryset = PrenotazionePiscina.objects.all()
    serializer_class = PrenotazionePiscinaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['data', 'stato', 'cliente_id']

    def destroy(self, request, *args, **kwargs):
        # OccupazionePostazione.prenotazione è SET_NULL: senza intervento esplicito, cancellare
        # una prenotazione lascerebbe le postazioni già assegnate "occupate" sulla mappa (solo
        # scollegate). Le eliminiamo insieme alla prenotazione, liberando davvero le postazioni.
        prenotazione = self.get_object()
        with transaction.atomic():
            OccupazionePostazione.objects.filter(prenotazione=prenotazione).delete()
            self.perform_destroy(prenotazione)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['get'])
    def scarica_biglietto(self, request, pk=None):
        """
        Endpoint per generare e scaricare il biglietto PDF.
        Chiamata: GET /api/prenotazioni/piscina/{id_prenotazione}/scarica_biglietto/
        """
        prenotazione = self.get_object()

        # Verifica che la prenotazione sia confermata
        if prenotazione.stato != 'CONFIRMED':
            return Response(
                {"detail": "Il biglietto è disponibile solo per le prenotazioni confermate."}, 
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


class OccupazionePostazioneViewSet(viewsets.ModelViewSet):
    """
    Assegnazione giornaliera delle postazioni (ombrelloni/gazebi) ai clienti.
    """
    queryset = OccupazionePostazione.objects.all()
    serializer_class = OccupazionePostazioneSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['data', 'postazione', 'postazione__inventario']