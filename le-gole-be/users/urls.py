from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import UtenteViewSet, ClienteViewSet

router = DefaultRouter()

# rotte per Utenti e Clienti
router.register(r'staff', UtenteViewSet, basename='staff')
router.register(r'clienti', ClienteViewSet, basename='clienti')

urlpatterns = [
    # Endpoint per l'autenticazione (Login)
    path('login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Le altre tue rotte API per gli utenti
    path('', include(router.urls)),
]