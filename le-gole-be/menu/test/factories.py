import datetime
from decimal import Decimal

import factory

from menu.models import Allergene, Categoria, GiornoChiusoAsporto, Prodotto, VoceOrdine
from prenotazioni.test.factories import PrenotazioneAsportoFactory


class CategoriaFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Categoria

    nome = factory.Sequence(lambda n: f"Categoria Test {n}")


class AllergeneFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Allergene

    nome = factory.Sequence(lambda n: f"Allergene Test {n}")


class ProdottoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Prodotto

    nome = factory.Sequence(lambda n: f"Prodotto Test {n}")
    categoria = factory.SubFactory(CategoriaFactory)
    prezzo = Decimal("8.50")
    disponibile = True


class GiornoChiusoAsportoFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = GiornoChiusoAsporto

    # Sequenza di date future distinte, per non collidere con l'unicità di `data` quando un test
    # ne crea più di una senza specificarla esplicitamente.
    data = factory.Sequence(lambda n: datetime.date(2026, 12, 1) + datetime.timedelta(days=n))


class VoceOrdineFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = VoceOrdine

    prenotazione = factory.SubFactory(PrenotazioneAsportoFactory)
    prodotto = factory.SubFactory(ProdottoFactory)
    quantita = 1
    prezzo_unitario = Decimal("8.50")
