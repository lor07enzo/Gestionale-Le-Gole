from django.db.models import ProtectedError
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Allergene, Categoria, ConfigurazioneAsporto, GiornoChiusoAsporto, Prodotto, VoceOrdine
from .serializers import (
    AllergeneSerializer,
    CategoriaSerializer,
    ConfigurazioneAsportoSerializer,
    GiornoChiusoAsportoSerializer,
    ProdottoSerializer,
    VoceOrdineSerializer,
)


class ConfigurazioneAsportoView(APIView):
    """
    Configurazione singleton dell'orario di disponibilità del servizio asporto. Non un
    ModelViewSet: non esiste alcun concetto di lista/creazione/eliminazione per questa
    risorsa, solo lettura e aggiornamento dell'unica riga condivisa (ConfigurazioneAsporto.get_solo()).
    Lettura pubblica (un futuro flusso self-service dovrà poter mostrare l'orario senza
    autenticarsi, stesso principio di PiscinaInventarioViewSet), scrittura riservata allo staff.
    """
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get(self, request):
        serializer = ConfigurazioneAsportoSerializer(ConfigurazioneAsporto.get_solo())
        return Response(serializer.data)

    def patch(self, request):
        config = ConfigurazioneAsporto.get_solo()
        serializer = ConfigurazioneAsportoSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class CategoriaViewSet(viewsets.ModelViewSet):
    """
    Categorie del menu asporto, create dallo staff prima dei prodotti. Lettura pubblica (il
    cliente deve poter vedere il menu organizzato per categoria senza autenticarsi), scrittura
    riservata allo staff — stesso pattern di ProdottoViewSet.
    """
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def destroy(self, request, *args, **kwargs):
        # Prodotto.categoria è PROTECT: senza questa gestione esplicita, eliminare una categoria
        # con prodotti collegati solleverebbe un ProtectedError che DRF propagherebbe come 500
        # grezzo — stesso identico problema/fix già documentato per PiscinaInventarioViewSet
        # (struttura/views.py, sezione 1).
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Impossibile eliminare questa categoria: esistono prodotti collegati ad essa."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class AllergeneViewSet(viewsets.ModelViewSet):
    """
    Allergeni assegnabili ai prodotti, gestiti dallo staff in una sezione dedicata. Nessuna
    protezione da eliminazione necessaria: una ManyToManyField non supporta on_delete sul lato
    target, eliminare un allergene si limita a scollegarlo dai prodotti che lo referenziavano.
    """
    queryset = Allergene.objects.all()
    serializer_class = AllergeneSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]


class ProdottoViewSet(viewsets.ModelViewSet):
    """
    Catalogo prodotti asporto. Lettura pubblica (il cliente deve poter sfogliare il menu senza
    autenticarsi), scrittura riservata allo staff — stesso pattern di PiscinaInventarioViewSet.
    """
    queryset = Prodotto.objects.all()
    serializer_class = ProdottoSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]
    filterset_fields = ['categoria', 'disponibile']


class GiornoChiusoAsportoViewSet(viewsets.ModelViewSet):
    """
    Giorni in cui il servizio asporto è chiuso per l'intera giornata (festività, chiusura
    straordinaria), gestiti dallo staff — 'prossime' è l'unica azione pubblica, di sola lettura,
    usata dal flusso self-service per avvisare in anticipo di una chiusura imminente.
    """
    queryset = GiornoChiusoAsporto.objects.all()
    serializer_class = GiornoChiusoAsportoSerializer
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action == 'prossime':
            return [AllowAny()]
        return super().get_permissions()

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def prossime(self, request):
        """
        Date di chiusura da oggi in poi (oggi incluso), ordinate crescenti — pubblico.
        GET /api/v1/menu/giorni-chiusi-asporto/prossime/
        Risposta: ["2026-08-25", "2026-08-26"]
        """
        oggi = timezone.localdate()
        date_chiuse = GiornoChiusoAsporto.objects.filter(data__gte=oggi).values_list('data', flat=True)
        return Response([d.isoformat() for d in date_chiuse])


class VoceOrdineViewSet(viewsets.ModelViewSet):
    """
    Righe di un ordine asporto (prodotto + quantità). Endpoint separato da
    PrenotazioneAsporto, stesso pattern con cui OccupazionePostazione è separata da
    PrenotazionePiscina: il cliente self-service crea prima l'ordine, poi una riga per ogni
    prodotto scelto.
    """
    queryset = VoceOrdine.objects.all()
    serializer_class = VoceOrdineSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['prenotazione', 'prodotto']

    def get_permissions(self):
        # 'create' è pubblica per il flusso self-service (stesso pattern di
        # OccupazionePostazioneViewSet.create per la piscina).
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()

    def perform_create(self, serializer):
        # prezzo_unitario è read-only nel serializer: va sempre impostato qui dal prezzo
        # corrente del prodotto, mai fidandosi di un valore inviato dal client.
        prodotto = serializer.validated_data['prodotto']
        serializer.save(prezzo_unitario=prodotto.prezzo)
