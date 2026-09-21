from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/users/', include('users.urls')),
    path('api/v1/struttura/', include('struttura.urls')),
    path('api/v1/prenotazioni/', include('prenotazioni.urls')),
    path('api/v1/menu/', include('menu.urls')),
    # Documentazione API (sezione 17). Lo schema e le due UI sono pubblici: descrivono solo la
    # FORMA degli endpoint, mai dati reali, e una parte consistente dell'API e' gia' pubblica di
    # suo (flusso self-service). Chiuderli dietro autenticazione renderebbe la documentazione
    # inutilizzabile proprio a chi integra il lato cliente.
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/v1/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
    path(
        'api/v1/redoc/',
        SpectacularRedocView.as_view(url_name='schema'),
        name='redoc',
    ),
]
