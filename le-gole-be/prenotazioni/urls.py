from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    PrenotazionePiscinaViewSet,
    PrenotazioneAsportoViewSet,
    OccupazionePostazioneViewSet,
    GiornoPienoPiscinaViewSet,
)

router = DefaultRouter()
router.register(r'piscina', PrenotazionePiscinaViewSet, basename='prenotazione-piscina')
router.register(r'asporto', PrenotazioneAsportoViewSet, basename='prenotazione-asporto')
router.register(r'occupazioni-postazione', OccupazionePostazioneViewSet, basename='occupazione-postazione')
router.register(r'giorni-pieni', GiornoPienoPiscinaViewSet, basename='giorno-pieno-piscina')

urlpatterns = [
    path('', include(router.urls)),
]