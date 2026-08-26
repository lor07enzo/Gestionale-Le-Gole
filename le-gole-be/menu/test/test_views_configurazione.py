import pytest
from django.urls import reverse
from rest_framework import status

from menu.models import ConfigurazioneAsporto

pytestmark = pytest.mark.django_db


class TestConfigurazioneAsportoLettura:
    def test_anonimo_puo_leggere(self, api_client):
        response = api_client.get(reverse("configurazione-asporto"))
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura"] == "11:00:00"
        assert response.data["orario_chiusura"] == "22:00:00"

    def test_la_riga_singleton_non_si_duplica_tra_richieste(self, api_client):
        api_client.get(reverse("configurazione-asporto"))
        api_client.get(reverse("configurazione-asporto"))
        assert ConfigurazioneAsporto.objects.count() == 1


class TestConfigurazioneAsportoScrittura:
    def test_anonimo_non_puo_modificare(self, api_client):
        response = api_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura": "12:00"}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_staff_puo_modificare_un_solo_campo(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura": "12:30"}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura"] == "12:30:00"
        # L'altro campo, omesso dal payload, resta invariato al default.
        assert response.data["orario_chiusura"] == "22:00:00"

    def test_staff_puo_modificare_entrambi_i_campi(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "09:00", "orario_chiusura": "15:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura"] == "09:00:00"
        assert response.data["orario_chiusura"] == "15:00:00"

    def test_modifica_persiste_sulla_stessa_riga_singleton(self, auth_client):
        auth_client.patch(reverse("configurazione-asporto"), {"orario_apertura": "08:00"}, format="json")
        response = auth_client.get(reverse("configurazione-asporto"))
        assert response.data["orario_apertura"] == "08:00:00"
        assert ConfigurazioneAsporto.objects.count() == 1


class TestConfigurazioneAsportoValidazione:
    def test_rifiuta_apertura_uguale_a_chiusura(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "12:00", "orario_chiusura": "12:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura" in response.data

    def test_rifiuta_apertura_dopo_chiusura(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "20:00", "orario_chiusura": "10:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura" in response.data

    def test_valida_un_solo_campo_contro_il_valore_gia_presente_sull_istanza(self, auth_client):
        # orario_chiusura di default è 22:00: un PATCH parziale che sposta solo l'apertura
        # oltre quella soglia deve comunque fallire, senza che il payload la ripeta.
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura": "23:00"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura" in response.data


class TestConfigurazioneAsportoSecondoTurno:
    # Secondo turno opzionale (pranzo/cena, sezione 15) — entrambi i campi vanno impostati
    # insieme o lasciati entrambi vuoti, e il turno deve iniziare non prima della chiusura del
    # primo (i due turni non si sovrappongono mai).
    def test_nessun_secondo_turno_di_default(self, api_client):
        response = api_client.get(reverse("configurazione-asporto"))
        assert response.data["orario_apertura_2"] is None
        assert response.data["orario_chiusura_2"] is None

    def test_staff_puo_impostare_il_secondo_turno(self, auth_client):
        # Il primo turno di default chiude alle 22:00: va ristretto prima, altrimenti un secondo
        # turno che inizia alle 19:00 si sovrapporrebbe (rifiutato, vedi test dedicato sotto).
        auth_client.patch(
            reverse("configurazione-asporto"), {"orario_chiusura": "15:30"}, format="json"
        )
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": "19:00", "orario_chiusura_2": "22:30"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura_2"] == "19:00:00"
        assert response.data["orario_chiusura_2"] == "22:30:00"

    def test_staff_puo_rimuovere_il_secondo_turno_impostando_entrambi_a_null(self, auth_client):
        auth_client.patch(
            reverse("configurazione-asporto"), {"orario_chiusura": "15:30"}, format="json"
        )
        auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": "19:00", "orario_chiusura_2": "22:30"},
            format="json",
        )
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": None, "orario_chiusura_2": None},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["orario_apertura_2"] is None
        assert response.data["orario_chiusura_2"] is None

    def test_rifiuta_solo_apertura_2_senza_chiusura_2(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"orario_apertura_2": "19:00"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura_2" in response.data

    def test_rifiuta_solo_chiusura_2_senza_apertura_2(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"orario_chiusura_2": "22:30"}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura_2" in response.data

    def test_rifiuta_apertura_2_uguale_a_chiusura_2(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": "19:00", "orario_chiusura_2": "19:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_chiusura_2" in response.data

    def test_rifiuta_secondo_turno_sovrapposto_al_primo(self, auth_client):
        # Primo turno di default 11:00-22:00: un secondo turno che inizia prima delle 22:00
        # si sovrapporrebbe.
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": "19:00", "orario_chiusura_2": "23:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "orario_apertura_2" in response.data

    def test_accetta_secondo_turno_che_inizia_esattamente_alla_chiusura_del_primo(self, auth_client):
        auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura": "12:00", "orario_chiusura": "15:30"},
            format="json",
        )
        response = auth_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": "15:30", "orario_chiusura_2": "22:00"},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK

    def test_anonimo_non_puo_impostare_il_secondo_turno(self, api_client):
        response = api_client.patch(
            reverse("configurazione-asporto"),
            {"orario_apertura_2": "19:00", "orario_chiusura_2": "22:30"},
            format="json",
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestLimiteProdottiOrario:
    def test_nessun_limite_di_default(self, api_client):
        response = api_client.get(reverse("configurazione-asporto"))
        assert response.data["limite_prodotti_orario"] is None

    def test_staff_puo_impostare_il_limite(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"limite_prodotti_orario": 15}, format="json"
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["limite_prodotti_orario"] == 15

        response = auth_client.get(reverse("configurazione-asporto"))
        assert response.data["limite_prodotti_orario"] == 15

    def test_staff_puo_rimuovere_il_limite_impostandolo_a_null(self, auth_client):
        auth_client.patch(reverse("configurazione-asporto"), {"limite_prodotti_orario": 15}, format="json")

        response = auth_client.patch(
            reverse("configurazione-asporto"), {"limite_prodotti_orario": None}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["limite_prodotti_orario"] is None

    def test_rifiuta_un_limite_a_zero(self, auth_client):
        response = auth_client.patch(
            reverse("configurazione-asporto"), {"limite_prodotti_orario": 0}, format="json"
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "limite_prodotti_orario" in response.data

    def test_anonimo_non_puo_impostare_il_limite(self, api_client):
        response = api_client.patch(
            reverse("configurazione-asporto"), {"limite_prodotti_orario": 15}, format="json"
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
