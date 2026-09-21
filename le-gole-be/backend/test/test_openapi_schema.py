"""
Guardia sullo schema OpenAPI (drf-spectacular, sezione 17).

Perché questi test esistono: lo schema è **derivato** dalle viewset, non scritto a mano, quindi
non può andare "fuori sincrono" con il codice — ma può degradare in silenzio. Aggiungere una
`@action` senza `@extend_schema`, un `SerializerMethodField` senza type hint o una `APIView`
senza serializer non rompe nulla a runtime: produce solo un avviso in `manage.py spectacular`,
che nessuno legge, e una documentazione sbagliata (o un endpoint che sparisce del tutto dalla
UI — è esattamente ciò che succedeva alle due configurazioni singleton prima di annotarle).

Il test più importante è quindi il primo: **zero warning ed errori di generazione**. Gli altri
fissano le poche proprietà che una regressione renderebbe silenziosamente fuorviante.
"""

import pytest
from django.urls import reverse
from drf_spectacular.drainage import GENERATOR_STATS
from drf_spectacular.generators import SchemaGenerator


@pytest.fixture
def schema():
    """Lo schema generato una volta sola, come lo produce `manage.py spectacular`."""
    return SchemaGenerator().get_schema(request=None, public=True)


class TestGenerazione:
    def test_nessun_warning_ne_errore(self):
        """
        Il gate vero e proprio. Se fallisce, il messaggio elenca le voci da annotare: quasi
        sempre una `@action` nuova senza `@extend_schema`.
        """
        GENERATOR_STATS.reset()
        with GENERATOR_STATS.silence():
            SchemaGenerator().get_schema(request=None, public=True)

        problemi = list(GENERATOR_STATS._warn_cache) + list(GENERATOR_STATS._error_cache)
        assert not problemi, 'drf-spectacular segnala:\n- ' + '\n- '.join(problemi)

    def test_e_openapi_3(self, schema):
        assert schema['openapi'].startswith('3.')

    def test_autenticazione_jwt_dichiarata(self, schema):
        """Senza questo, il pulsante "Authorize" di Swagger UI non comparirebbe."""
        assert 'jwtAuth' in schema['components']['securitySchemes']


class TestCopertura:
    """Ogni endpoint reale del progetto deve comparire: una documentazione con dei buchi è peggio
    che nessuna documentazione, perché non si distingue "non esiste" da "non documentato"."""

    @pytest.mark.parametrize('percorso', [
        '/api/v1/users/staff/',
        '/api/v1/users/clienti/',
        '/api/v1/struttura/inventario-piscina/',
        '/api/v1/struttura/postazioni/',
        '/api/v1/struttura/racchette-padel/',
        '/api/v1/prenotazioni/piscina/',
        '/api/v1/prenotazioni/asporto/',
        '/api/v1/prenotazioni/padel/',
        '/api/v1/prenotazioni/occupazioni-postazione/',
        '/api/v1/menu/prodotti/',
        '/api/v1/menu/voci-ordine/',
    ])
    def test_le_risorse_principali_sono_documentate(self, schema, percorso):
        assert percorso in schema['paths']

    @pytest.mark.parametrize('percorso', [
        # Le due configurazioni singleton sono APIView senza serializer_class: drf-spectacular
        # le SCARTAVA in silenzio finché non sono state annotate a mano (sezione 17).
        '/api/v1/struttura/configurazione-padel/',
        '/api/v1/menu/configurazione-asporto/',
    ])
    def test_le_configurazioni_singleton_sono_documentate(self, schema, percorso):
        operazioni = schema['paths'][percorso]
        assert set(operazioni) == {'get', 'patch'}

    def test_lo_schema_non_documenta_se_stesso(self, schema):
        """SERVE_INCLUDE_SCHEMA=False: /schema/ e le due UI non sono endpoint dell'API."""
        assert not [p for p in schema['paths'] if 'schema' in p or 'docs' in p]


class TestAzioniCustom:
    """
    I parametri di query delle `@action` vivono dentro il corpo della funzione
    (`request.query_params.get(...)`): drf-spectacular non può dedurli, vanno dichiarati. Senza,
    Swagger mostrerebbe un endpoint "senza parametri" che in realtà risponde 400 se chiamato così.
    """

    @pytest.mark.parametrize('percorso,attesi', [
        ('/api/v1/prenotazioni/piscina/disponibilita/', {'inventario', 'data'}),
        ('/api/v1/prenotazioni/piscina/conteggi/', {'inventario', 'anno', 'mese'}),
        ('/api/v1/prenotazioni/piscina/storico_telefono/', {'telefono'}),
        ('/api/v1/prenotazioni/asporto/prenotazioni_per_orario/', {'data'}),
        ('/api/v1/prenotazioni/asporto/conteggi/', {'anno', 'mese'}),
        ('/api/v1/prenotazioni/padel/disponibilita/', {'data'}),
        ('/api/v1/prenotazioni/occupazioni-postazione/occupate/', {'inventario', 'data'}),
        ('/api/v1/prenotazioni/giorni-pieni/calendario/', {'inventario', 'anno', 'mese'}),
    ])
    def test_i_parametri_obbligatori_sono_dichiarati(self, schema, percorso, attesi):
        parametri = schema['paths'][percorso]['get'].get('parameters', [])
        obbligatori = {p['name'] for p in parametri if p['in'] == 'query' and p['required']}
        assert obbligatori == attesi

    def test_storico_telefono_non_dichiara_i_filtri_di_lista(self, schema):
        """
        La viewset ha `filterset_fields`, ma questa azione non chiama mai `filter_queryset()`:
        senza `filters=False` lo schema prometterebbe filtri data/stato/cliente_id inesistenti.
        """
        parametri = schema['paths']['/api/v1/prenotazioni/piscina/storico_telefono/']['get']['parameters']
        nomi = {p['name'] for p in parametri if p['in'] == 'query'}
        assert nomi == {'telefono'}

    @pytest.mark.parametrize('percorso', [
        '/api/v1/prenotazioni/piscina/{id}/scarica_biglietto/',
        '/api/v1/prenotazioni/asporto/{id}/scarica_ricevuta/',
        '/api/v1/prenotazioni/padel/{id}/scarica_biglietto/',
    ])
    def test_i_pdf_sono_dichiarati_come_pdf(self, schema, percorso):
        """Restituiscono un HttpResponse Django grezzo: senza annotazione sarebbero 'application/json'."""
        risposta_ok = schema['paths'][percorso]['get']['responses']['200']
        assert list(risposta_ok['content']) == ['application/pdf']

    def test_disponibilita_non_promette_dati_personali(self, schema):
        """
        L'azione esiste proprio per NON esporre nome/telefono/note altrui: se lo schema
        dichiarasse il serializer della viewset starebbe descrivendo l'opposto di ciò che fa.
        """
        risposta = schema['paths']['/api/v1/prenotazioni/piscina/disponibilita/']['get']['responses']['200']
        riferimento = risposta['content']['application/json']['schema']['$ref']
        assert riferimento.endswith('/DisponibilitaPiscina')

        campi = schema['components']['schemas']['DisponibilitaPiscina']['properties']
        assert set(campi) == {'ombrellone', 'gazebo', 'lettino', 'sdraia', 'pieno'}


class TestCorpoRichiesta:
    """
    L'unica classe di difetto che il test "zero warning" sopra **non può** rilevare: per un'azione
    custom senza `request=` esplicito, drf-spectacular non avvisa — ripiega in silenzio sul
    serializer della viewset. Le quattro azioni del flusso account sono state documentate a lungo
    con `Utente` (`username`/`email`) invece del proprio serializer: chi avesse usato "Try it out"
    su `activate/` avrebbe inviato i campi sbagliati e ricevuto un 400 su ognuno di quelli veri.
    """

    @pytest.mark.parametrize('percorso,metodo,componente', [
        ('/api/v1/users/staff/activate/', 'post', 'ActivateAccount'),
        ('/api/v1/users/staff/reset-password/request/', 'post', 'PasswordResetRequest'),
        ('/api/v1/users/staff/reset-password/confirm/', 'post', 'PasswordResetConfirm'),
        ('/api/v1/users/staff/', 'post', 'UtenteCreate'),
    ])
    def test_il_corpo_e_quello_del_serializer_realmente_usato(
        self, schema, percorso, metodo, componente
    ):
        corpo = schema['paths'][percorso][metodo]['requestBody']['content']['application/json']
        assert corpo['schema']['$ref'].endswith(f'/{componente}')

    def test_set_active_accetta_solo_il_booleano(self, schema):
        """Legge `request.data.get('is_active')` a mano: senza annotazione chiedeva PatchedUtente."""
        corpo = schema['paths']['/api/v1/users/staff/{id}/set-active/']['patch']
        campi = corpo['requestBody']['content']['application/json']['schema']
        assert set(campi['properties']) == {'is_active'}
        assert campi['required'] == ['is_active']


class TestParametriFiltratiAMano:
    """
    Parametri letti da `get_queryset()`/`list()` invece che da `filterset_fields`: drf-spectacular
    documenta da sé solo i secondi, quindi questi sparivano pur essendo l'intero scopo
    dell'endpoint (la ricerca clienti staff, la mappa postazioni "come era").
    """

    def test_ricerca_clienti(self, schema):
        parametri = schema['paths']['/api/v1/users/clienti/']['get'].get('parameters', [])
        assert 'search' in {p['name'] for p in parametri if p['in'] == 'query'}

    def test_mappa_postazioni_storica(self, schema):
        operazione = schema['paths']['/api/v1/struttura/postazioni/']['get']
        nomi = {p['name'] for p in operazione.get('parameters', []) if p['in'] == 'query'}
        assert nomi == {'data', 'inventario', 'tipo'}
        # La data malformata risponde 400 a mano, non è una 400 generica di validazione DRF.
        assert '400' in operazione['responses']


class TestEndpointServiti:
    """Lo schema può essere valido e le rotte comunque non raggiungibili: qui si verifica la
    risposta HTTP reale, non il documento generato."""

    def test_schema_scaricabile(self, client):
        risposta = client.get(reverse('schema'))
        assert risposta.status_code == 200

    @pytest.mark.parametrize('nome_rotta', ['swagger-ui', 'redoc'])
    def test_ui_raggiungibili_senza_autenticazione(self, client, nome_rotta):
        """
        Pubbliche di proposito: descrivono la forma degli endpoint, mai dati reali, e buona parte
        dell'API è già pubblica di suo (flusso self-service).
        """
        risposta = client.get(reverse(nome_rotta))
        assert risposta.status_code == 200
