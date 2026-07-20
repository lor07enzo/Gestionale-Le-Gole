from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PrenotazionePiscinaViewSet, OccupazionePostazioneViewSet

router = DefaultRouter()
router.register(r'piscina', PrenotazionePiscinaViewSet, basename='prenotazione-piscina')
router.register(r'occupazioni-postazione', OccupazionePostazioneViewSet, basename='occupazione-postazione')

urlpatterns = [
    path('', include(router.urls)),
]