from django.conf import settings
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from menu.models import ConfigurazioneAsporto, Prodotto
from struttura.models import ConfigurazionePadel, PiscinaInventario


class ServiziDisponibiliView(APIView):
    """
    Quali servizi sono prenotabili online, in una sola richiesta: serve alla home dell'Area
    Cliente, che prima scaricava listini, catalogo prodotti e due configurazioni solo per
    ricavarne tre booleani. Qui sono tre query `exists()`/singleton, senza serializzare nulla.

    Vive nel progetto e non in un'app perché incrocia struttura e menu.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=['servizi'],
        responses=inline_serializer(
            name='ServiziDisponibili',
            fields={
                'piscina': serializers.BooleanField(),
                'asporto': serializers.BooleanField(),
                'padel': serializers.BooleanField(),
            },
        ),
    )
    def get(self, request):
        return Response({
            'piscina': PiscinaInventario.objects.filter(isActive=True).exists(),
            'asporto': ConfigurazioneAsporto.get_solo().attivo
            and Prodotto.objects.filter(disponibile=True).exists(),
            'padel': ConfigurazionePadel.get_solo().attivo,
        })


class VersioneAppView(APIView):
    """
    Versione minima dell'app nativa e link agli store, letti all'avvio da Android e iOS: sotto la
    minima l'app mostra una schermata bloccante "aggiorna". Valori da variabili d'ambiente
    (settings.APP_*), nessuna query: è chiamata a ogni apertura dell'app.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        tags=['servizi'],
        responses=inline_serializer(
            name='VersioneApp',
            fields={
                'versione_minima': serializers.CharField(),
                'url_android': serializers.CharField(),
                'url_ios': serializers.CharField(),
            },
        ),
    )
    def get(self, request):
        return Response({
            'versione_minima': settings.APP_VERSIONE_MINIMA,
            'url_android': settings.APP_STORE_URL_ANDROID,
            'url_ios': settings.APP_STORE_URL_IOS,
        })
