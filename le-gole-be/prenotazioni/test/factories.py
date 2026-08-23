import factory
from django.utils import timezone

from prenotazioni.models import GiornoPienoPiscina, OccupazionePostazione, PrenotazioneAsporto, PrenotazionePiscina
from struttura.test.factories import PiscinaInventarioFactory, PostazioneFactory
from users.test.factories import ClienteFactory


class PrenotazionePiscinaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PrenotazionePiscina

    cliente_id = factory.SubFactory(ClienteFactory)
    inventario = factory.SubFactory(PiscinaInventarioFactory)
    data = factory.LazyFunction(timezone.localdate)
    ora = "12:00"
    stato = "CONFIRMED"
    ingressi = 1


class PrenotazioneAsportoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PrenotazioneAsporto

    cliente_id = factory.SubFactory(ClienteFactory)
    data = factory.LazyFunction(timezone.localdate)
    ora = "12:00"
    stato = "CONFIRMED"


class OccupazionePostazioneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = OccupazionePostazione

    postazione = factory.SubFactory(PostazioneFactory)
    data = factory.LazyFunction(timezone.localdate)
    orario_arrivo_previsto = "12:00"


class GiornoPienoPiscinaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = GiornoPienoPiscina

    inventario = factory.SubFactory(PiscinaInventarioFactory)
    data = factory.LazyFunction(timezone.localdate)
