import pytest
from django.urls import reverse
from rest_framework import status

from users.models import Cliente

from .factories import ClienteFactory

pytestmark = pytest.mark.django_db


class TestCreateCliente:
    def test_anonimo_puo_creare(self, api_client):
        response = api_client.post(
            reverse("clienti-list"), {"nome": "Mario Rossi", "telefono": "3331112222"}, format="json"
        )

        assert response.status_code == status.HTTP_201_CREATED
        assert Cliente.objects.filter(telefono="3331112222", nome="Mario Rossi").exists()

    def test_stesso_telefono_aggiorna_il_nome_invece_di_duplicare(self, api_client):
        esistente = ClienteFactory(nome="Mario Rossi", telefono="3331112222")

        response = api_client.post(
            reverse("clienti-list"), {"nome": "Mario Rossi Bis", "telefono": "3331112222"}, format="json"
        )

        assert response.status_code == status.HTTP_200_OK
        assert Cliente.objects.filter(telefono="3331112222").count() == 1

        esistente.refresh_from_db()
        assert esistente.nome == "Mario Rossi Bis"


class TestListRetrieveCliente:
    def test_anonimo_non_puo_elencare(self, api_client):
        response = api_client.get(reverse("clienti-list"))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_utente_autenticato_puo_elencare_senza_essere_superuser(self, staff_client, cliente):
        response = staff_client.get(reverse("clienti-list"))
        assert response.status_code == status.HTTP_200_OK


class TestRicercaCliente:
    def test_filtra_per_nome(self, staff_client):
        ClienteFactory(nome="Anna Bianchi", telefono="3330000001")
        ClienteFactory(nome="Marco Neri", telefono="3330000002")

        response = staff_client.get(reverse("clienti-list"), {"search": "bianchi"})

        risultati = [c["nome"] for c in response.data]
        assert risultati == ["Anna Bianchi"]

    def test_filtra_per_telefono(self, staff_client):
        ClienteFactory(nome="Anna Bianchi", telefono="3330000001")
        ClienteFactory(nome="Marco Neri", telefono="3330000002")

        response = staff_client.get(reverse("clienti-list"), {"search": "0000002"})

        risultati = [c["nome"] for c in response.data]
        assert risultati == ["Marco Neri"]

    def test_senza_query_restituisce_tutti(self, staff_client):
        ClienteFactory.create_batch(2)

        response = staff_client.get(reverse("clienti-list"))

        assert len(response.data) == 2
