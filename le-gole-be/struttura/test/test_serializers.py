import pytest
from django.utils import timezone

from struttura.serializers import PostazioneSerializer

from .factories import PiscinaInventarioFactory, PostazioneFactory

pytestmark = pytest.mark.django_db


class TestPosizioneRange:
    def test_rifiuta_pos_x_fuori_range(self):
        inventario = PiscinaInventarioFactory()
        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 1, "pos_x": 150, "pos_y": 50}
        )
        assert not serializer.is_valid()
        assert "pos_x" in serializer.errors

    def test_rifiuta_pos_y_fuori_range(self):
        inventario = PiscinaInventarioFactory()
        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 1, "pos_x": 50, "pos_y": -1}
        )
        assert not serializer.is_valid()
        assert "pos_y" in serializer.errors

    def test_accetta_estremi_validi(self):
        inventario = PiscinaInventarioFactory()
        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 1, "pos_x": 0, "pos_y": 100}
        )
        assert serializer.is_valid(), serializer.errors


class TestNumeroUnicoTraLeAttive:
    def test_rifiuta_numero_duplicato_tra_le_postazioni_attive(self):
        inventario = PiscinaInventarioFactory()
        PostazioneFactory(inventario=inventario, numero=5)

        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 5, "pos_x": 10, "pos_y": 10}
        )

        assert not serializer.is_valid()
        assert "numero" in serializer.errors

    def test_permette_di_riusare_il_numero_di_una_postazione_eliminata(self):
        inventario = PiscinaInventarioFactory()
        eliminata = PostazioneFactory(inventario=inventario, numero=5)
        eliminata.deleted_at = timezone.now()
        eliminata.save(update_fields=["deleted_at"])

        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 5, "pos_x": 10, "pos_y": 10}
        )

        assert serializer.is_valid(), serializer.errors

    def test_permette_di_salvare_la_stessa_postazione_senza_cambiare_numero(self):
        inventario = PiscinaInventarioFactory()
        postazione = PostazioneFactory(inventario=inventario, numero=5)

        serializer = PostazioneSerializer(
            instance=postazione,
            data={"pos_x": 20, "pos_y": 20},
            partial=True,
        )

        assert serializer.is_valid(), serializer.errors

    def test_rifiuta_numero_duplicato_anche_di_un_altro_inventario_e_va_bene_cosi(self):
        # Il vincolo è per (inventario, numero): stesso numero su un inventario diverso
        # non è affatto un conflitto.
        primo = PiscinaInventarioFactory()
        secondo = PiscinaInventarioFactory()
        PostazioneFactory(inventario=primo, numero=5)

        serializer = PostazioneSerializer(
            data={"inventario": secondo.pk, "tipo": "OMBRELLONE", "numero": 5, "pos_x": 10, "pos_y": 10}
        )

        assert serializer.is_valid(), serializer.errors
