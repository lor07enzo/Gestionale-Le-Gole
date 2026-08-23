from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AllergeneViewSet,
    CategoriaViewSet,
    ConfigurazioneAsportoView,
    GiornoChiusoAsportoViewSet,
    ProdottoViewSet,
    VoceOrdineViewSet,
)

router = DefaultRouter()
router.register(r'categorie', CategoriaViewSet, basename='categoria')
router.register(r'allergeni', AllergeneViewSet, basename='allergene')
router.register(r'prodotti', ProdottoViewSet, basename='prodotto')
router.register(r'voci-ordine', VoceOrdineViewSet, basename='voce-ordine')
router.register(r'giorni-chiusi-asporto', GiornoChiusoAsportoViewSet, basename='giorno-chiuso-asporto')

urlpatterns = [
    path('configurazione-asporto/', ConfigurazioneAsportoView.as_view(), name='configurazione-asporto'),
    path('', include(router.urls)),
]
