from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/users/', include('users.urls')),
    path('api/v1/struttura/', include('struttura.urls')),
    path('api/v1/prenotazioni/', include('prenotazioni.urls')),
    path('api/v1/menu/', include('menu.urls')),
]
