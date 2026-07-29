import factory

from prenotazioni.models import PostazionePosizioneStorico
from struttura.models import PiscinaInventario, Postazione


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
