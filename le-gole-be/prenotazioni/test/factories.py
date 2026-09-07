import datetime
from decimal import Decimal

import factory
from django.utils import timezone

from prenotazioni.models import (
    GiornoPienoPiscina,
    NoleggioRacchetta,
    OccupazionePostazione,
    PrenotazioneAsporto,
    PrenotazionePadel,
    PrenotazionePiscina,
)
from struttura.test.factories import (
    PiscinaInventarioFactory,
    PostazioneFactory,
    RacchettaPadelFactory,
)
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


class PrenotazionePadelFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PrenotazionePadel

    cliente_id = factory.SubFactory(ClienteFactory)
    data = factory.LazyFunction(timezone.localdate)
    # datetime.time, non la stringa "10:00" usata dalle altre factory: PrenotazionePadel.orario_fine
    # legge `ora` in memoria senza rileggerla dal DB, e un valore-stringa non verrebbe convertito
    # (stesso gotcha già documentato per i Decimal nelle factory di menu).
    ora = datetime.time(10, 0)
    stato = "CONFIRMED"
    partecipanti = 4
    # Snapshot coerenti con la fixture `configurazione_padel` (conftest): la factory scrive
    # direttamente via ORM, quindi non passa da perform_create() che li imposterebbe da sé.
    durata_minuti = 60
    prezzo_partita = Decimal('30.00')
    prezzo_palline = Decimal('5.00')


class NoleggioRacchettaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = NoleggioRacchetta

    prenotazione = factory.SubFactory(PrenotazionePadelFactory)
    racchetta = factory.SubFactory(RacchettaPadelFactory)
    quantita = 1
    # Snapshot: la factory scrive via ORM, quindi non passa da perform_create() che lo
    # imposterebbe da sé dal prezzo corrente a catalogo.
    prezzo_unitario = Decimal('5.00')
