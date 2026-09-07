from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ConfigurazionePadelView,
    GiornoChiusoPadelViewSet,
    PiscinaInventarioViewSet,
    PostazioneViewSet,
    RacchettaPadelViewSet,
)

router = DefaultRouter()
router.register(r'inventario-piscina', PiscinaInventarioViewSet, basename='inventariopiscina')
router.register(r'postazioni', PostazioneViewSet, basename='postazione')
router.register(r'giorni-chiusi-padel', GiornoChiusoPadelViewSet, basename='giorno-chiuso-padel')
router.register(r'racchette-padel', RacchettaPadelViewSet, basename='racchetta-padel')

urlpatterns = [
    path('configurazione-padel/', ConfigurazionePadelView.as_view(), name='configurazione-padel'),
    path('', include(router.urls)),
]
