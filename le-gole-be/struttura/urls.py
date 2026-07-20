from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PiscinaInventarioViewSet, PostazioneViewSet

router = DefaultRouter()
router.register(r'inventario-piscina', PiscinaInventarioViewSet, basename='inventariopiscina')
router.register(r'postazioni', PostazioneViewSet, basename='postazione')

urlpatterns = [
    path('', include(router.urls)),
]