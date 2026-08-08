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


class TestCapacitaPerTipo:
    def test_rifiuta_oltre_il_totale_ombrelloni(self):
        inventario = PiscinaInventarioFactory(totale_ombrelloni=2)
        PostazioneFactory(inventario=inventario, tipo="OMBRELLONE", numero=1)
        PostazioneFactory(inventario=inventario, tipo="OMBRELLONE", numero=2)

        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 3, "pos_x": 10, "pos_y": 10}
        )

        assert not serializer.is_valid()
        assert "tipo" in serializer.errors

    def test_accetta_fino_al_totale_gazebi(self):
        inventario = PiscinaInventarioFactory(totale_gazebi=1)

        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "GAZEBO", "numero": 1, "pos_x": 10, "pos_y": 10}
        )

        assert serializer.is_valid(), serializer.errors

    def test_il_conteggio_e_indipendente_per_tipo(self):
        # 2 gazebi esistenti non devono influire sul limite degli ombrelloni.
        inventario = PiscinaInventarioFactory(totale_ombrelloni=1, totale_gazebi=5)
        PostazioneFactory(inventario=inventario, tipo="GAZEBO", numero=1)
        PostazioneFactory(inventario=inventario, tipo="GAZEBO", numero=2)

        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 3, "pos_x": 10, "pos_y": 10}
        )

        assert serializer.is_valid(), serializer.errors

    def test_le_postazioni_eliminate_non_contano_per_il_limite(self):
        inventario = PiscinaInventarioFactory(totale_ombrelloni=1)
        eliminata = PostazioneFactory(inventario=inventario, tipo="OMBRELLONE", numero=1)
        eliminata.deleted_at = timezone.now()
        eliminata.save(update_fields=["deleted_at"])

        serializer = PostazioneSerializer(
            data={"inventario": inventario.pk, "tipo": "OMBRELLONE", "numero": 2, "pos_x": 10, "pos_y": 10}
        )

        assert serializer.is_valid(), serializer.errors

    def test_il_limite_non_si_applica_in_modifica(self):
        # Se il totale viene abbassato dopo che le postazioni sono state create, quelle
        # eccedenti restano comunque modificabili (es. per riposizionarle), il limite blocca
        # solo l'aggiunta di nuove postazioni.
        inventario = PiscinaInventarioFactory(totale_ombrelloni=1)
        PostazioneFactory(inventario=inventario, tipo="OMBRELLONE", numero=1)
        eccedente = PostazioneFactory(inventario=inventario, tipo="OMBRELLONE", numero=2)

        serializer = PostazioneSerializer(instance=eccedente, data={"pos_x": 30, "pos_y": 30}, partial=True)

        assert serializer.is_valid(), serializer.errors

    def test_nessun_controllo_capacita_senza_inventario_risolvibile(self):
        # Guardia difensiva: un partial=True senza istanza (mai prodotto dal ModelViewSet reale,
        # che passa sempre self.get_object() come instance su un PATCH) non deve far esplodere
        # i validator invece di limitarsi a saltare i controlli che richiedono un inventario.
        serializer = PostazioneSerializer(data={"tipo": "OMBRELLONE"}, partial=True)

        assert serializer.is_valid(), serializer.errors
