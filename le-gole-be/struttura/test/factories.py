from decimal import Decimal

import factory
from django.utils import timezone

from prenotazioni.models import PostazionePosizioneStorico
from struttura.models import GiornoChiusoPadel, PiscinaInventario, Postazione, RacchettaPadel


class PiscinaInventarioFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PiscinaInventario

    nome = factory.Sequence(lambda n: f"Listino Test {n}")
    isActive = True
    totale_ombrelloni = 10
    totale_gazebi = 5
    totale_lettini = 20
    totale_sdraie = 20


class PostazioneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Postazione

    inventario = factory.SubFactory(PiscinaInventarioFactory)
    tipo = "OMBRELLONE"
    numero = factory.Sequence(lambda n: n + 1)
    pos_x = 50.0
    pos_y = 50.0


class PostazionePosizioneStoricoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PostazionePosizioneStorico

    postazione = factory.SubFactory(PostazioneFactory)
    pos_x = 50.0
    pos_y = 50.0


class GiornoChiusoPadelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = GiornoChiusoPadel

    data = factory.LazyFunction(timezone.localdate)


class RacchettaPadelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RacchettaPadel

    # Sequence sul nome: `nome` è unique, senza sarebbe una collisione al secondo uso nello
    # stesso test (stesso accorgimento delle factory di menu.Categoria/Allergene).
    nome = factory.Sequence(lambda n: f"Racchetta Test {n}")
    prezzo_noleggio = Decimal("5.00")
    quantita_disponibile = 4
