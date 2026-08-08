import pytest
from django.urls import reverse
from rest_framework import status

from struttura.test.factories import PostazioneFactory

from prenotazioni.models import OccupazionePostazione

from .factories import OccupazionePostazioneFactory, PrenotazionePiscinaFactory

pytestmark = pytest.mark.django_db


class TestPatchParziale:
    def test_patch_di_un_solo_campo_non_richiede_gli_altri(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ora="12:00", ingressi=2)

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[prenotazione.pk]),
            {"note": "Allergia ai crostacei"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        prenotazione.refresh_from_db()
        assert prenotazione.note == "Allergia ai crostacei"
        # I campi non toccati dal PATCH restano quelli originali.
        assert prenotazione.ingressi == 2
        assert str(prenotazione.data) == "2026-08-01"


class TestAntiOverbookingSuUpdate:
    def test_una_prenotazione_gia_al_limite_puo_essere_modificata_su_un_altro_campo(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(
            inventario=inventario, data="2026-08-01", ombrellone=inventario.totale_ombrelloni
        )

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[prenotazione.pk]),
            {"note": "Confermata telefonicamente"},
            format="json",
        )

        # Senza l'esclusione della prenotazione corrente dal conteggio, questo fallirebbe:
        # il residuo verrebbe calcolato come (totale - se_stessa) < ombrellone richiesto.
        assert response.status_code == status.HTTP_200_OK

    def test_puo_aumentare_una_risorsa_se_ce_margine_complessivo(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ombrellone=3)

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[prenotazione.pk]),
            {"ombrellone": inventario.totale_ombrelloni},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_rifiuta_se_supera_il_residuo_tenendo_conto_delle_altre_prenotazioni(self, auth_client, inventario):
        PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ombrellone=inventario.totale_ombrelloni - 2)
        da_modificare = PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ombrellone=1)

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[da_modificare.pk]),
            {"ombrellone": 3},
            format="json",
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "ombrellone" in response.data


class TestAnnullamentoLiberaPostazioni:
    def test_annullare_una_prenotazione_libera_le_postazioni_assegnate(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ombrellone=1)
        occupazione = OccupazionePostazioneFactory(
            postazione=PostazioneFactory(inventario=inventario),
            data="2026-08-01",
            prenotazione=prenotazione,
        )

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[prenotazione.pk]),
            {"stato": "CANCELLED"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert not OccupazionePostazione.objects.filter(pk=occupazione.pk).exists()

    def test_patch_su_prenotazione_gia_cancellata_non_fallisce_in_assenza_di_occupazioni(self, auth_client, inventario):
        # Backstop: 'era_cancellata' evita di ripetere una DELETE su un queryset già vuoto ad ogni
        # ulteriore PATCH su una prenotazione già CANCELLED — verifichiamo solo che non fallisca.
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", stato="CANCELLED")

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[prenotazione.pk]),
            {"note": "Nota aggiornata"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK

    def test_modificare_un_altro_campo_non_tocca_le_postazioni_assegnate(self, auth_client, inventario):
        prenotazione = PrenotazionePiscinaFactory(inventario=inventario, data="2026-08-01", ombrellone=1)
        occupazione = OccupazionePostazioneFactory(
            postazione=PostazioneFactory(inventario=inventario),
            data="2026-08-01",
            prenotazione=prenotazione,
        )

        response = auth_client.patch(
            reverse("prenotazione-piscina-detail", args=[prenotazione.pk]),
            {"note": "Confermata telefonicamente"},
            format="json",
        )

        assert response.status_code == status.HTTP_200_OK
        assert OccupazionePostazione.objects.filter(pk=occupazione.pk).exists()
