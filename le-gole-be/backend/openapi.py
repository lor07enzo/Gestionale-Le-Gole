"""
Pezzi riusabili per lo schema OpenAPI (drf-spectacular, sezione 17 di CLAUDE.md).

Perché questo modulo esiste: drf-spectacular deduce da sé richiesta e risposta di ogni azione
standard di un ModelViewSet (list/create/retrieve/update/destroy) leggendo il serializer, ma
**non può dedurre nulla** per le `@action` custom — né i parametri di query, che vivono dentro
il corpo della funzione come `request.query_params.get(...)`, né la forma della risposta quando
non è il serializer della viewset (le azioni `disponibilita`/`conteggi`/`occupate`/`calendario`
restituiscono dizionari o liste costruiti a mano). Senza annotazione esplicita quelle azioni
comparirebbero in Swagger senza alcun parametro e con una risposta dichiarata sbagliata: una
documentazione peggio che assente, perché fuorviante.

Le stesse identiche quaterne di parametri (`inventario`+`data`, `anno`+`mese`, `telefono`,
`limit`) si ripetono su più viewset di app diverse, quindi vivono qui invece di essere riscritte
a ogni decoratore.
"""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, inline_serializer
from rest_framework import serializers

# --- Parametri di query condivisi -------------------------------------------------------------

PARAM_INVENTARIO = OpenApiParameter(
    name='inventario',
    type=str,
    location=OpenApiParameter.QUERY,
    required=True,
    description="UUID del listino piscina (`struttura.PiscinaInventario`).",
)

PARAM_DATA = OpenApiParameter(
    name='data',
    type=str,
    location=OpenApiParameter.QUERY,
    required=True,
    description='Giorno di riferimento nel formato `YYYY-MM-DD`.',
)

PARAM_ANNO = OpenApiParameter(
    name='anno',
    type=int,
    location=OpenApiParameter.QUERY,
    required=True,
    description='Anno del mese da conteggiare, es. `2026`.',
)

PARAM_MESE = OpenApiParameter(
    name='mese',
    type=int,
    location=OpenApiParameter.QUERY,
    required=True,
    description='Mese da conteggiare, 1-12.',
)

PARAM_TELEFONO = OpenApiParameter(
    name='telefono',
    type=str,
    location=OpenApiParameter.QUERY,
    required=True,
    description=(
        'Numero di telefono del cliente. Il confronto è **esatto**, mai parziale: '
        'un match parziale renderebbe questo endpoint pubblico una ricerca libera '
        "sull'intera anagrafica clienti."
    ),
)

PARAM_SEARCH_CLIENTE = OpenApiParameter(
    name='search',
    type=str,
    location=OpenApiParameter.QUERY,
    required=False,
    description=(
        'Ricerca testuale staff: match parziale **case-insensitive** in OR su nome **e** '
        'telefono. Non ottenibile con `filterset_fields` (che fa AND per campo), quindi '
        'filtrato a mano in `get_queryset()` e invisibile a drf-spectacular senza questa voce.'
    ),
)

PARAM_DATA_STORICA = OpenApiParameter(
    name='data',
    type=str,
    location=OpenApiParameter.QUERY,
    required=False,
    description=(
        'Giorno `YYYY-MM-DD` di cui ricostruire la mappa **come era**: include le postazioni '
        'eliminate dopo quella data, esclude quelle create dopo, e sovrascrive `pos_x`/`pos_y` '
        'con la posizione storica. Per oggi o una data futura (o se omesso) restituisce la '
        'mappa corrente, invariata.'
    ),
)

PARAM_LIMIT = OpenApiParameter(
    name='limit',
    type=int,
    location=OpenApiParameter.QUERY,
    required=False,
    description='Quante prenotazioni restituire al massimo (default 50, tetto 200).',
)


# --- Risposte condivise ------------------------------------------------------------------------

# Costruito UNA volta sola e riusato: `inline_serializer` genera una classe nuova a ogni chiamata,
# quindi crearlo dentro `errore()` produrrebbe decine di classi diverse con lo stesso nome e
# altrettanti avvisi "2 components with identical names" da drf-spectacular.
DettaglioErroreSerializer = inline_serializer(
    name='DettaglioErrore',
    fields={'detail': serializers.CharField()},
)


def errore(descrizione):
    """Risposta `{"detail": "..."}`, la forma che ogni errore gestito a mano usa nel progetto."""
    return OpenApiResponse(response=DettaglioErroreSerializer, description=descrizione)


# Stessa forma `{"detail": "..."}` ma su un 200: i flussi account (attivazione, reset password)
# rispondono con un messaggio, non con una risorsa. Componente separato da DettaglioErrore solo
# perché vedere "DettaglioErrore" su una risposta di successo sarebbe fuorviante in Swagger.
MessaggioSerializer = inline_serializer(
    name='Messaggio',
    fields={'detail': serializers.CharField()},
)


def messaggio(descrizione, esempio=None):
    """Risposta `{"detail": "..."}` di successo."""
    esempi = [OpenApiExample('Messaggio', value={'detail': esempio})] if esempio else None
    return OpenApiResponse(
        response=MessaggioSerializer, description=descrizione, examples=esempi
    )


# Le tre azioni `scarica_*` restituiscono un HttpResponse Django grezzo, non una Response DRF:
# drf-spectacular non ha modo di dedurne il media type e lo dichiarerebbe `application/json`.
# La chiave di risposta è quindi la tupla `(200, 'application/pdf')` — una forma che agisce solo
# sullo schema, senza toccare i renderer della view e quindi senza alcun rischio di cambiare la
# risposta reale di un endpoint già in produzione.
PDF_200 = (200, 'application/pdf')

RESPONSE_PDF = OpenApiResponse(
    response=OpenApiTypes.BINARY,
    description='Il PDF pronto da scaricare (`Content-Disposition: attachment`).',
)


def mappa_conteggi(nome, descrizione, esempio):
    """
    Risposta "dizionario sparso" — `{"2026-07-01": 3, ...}` o `{"12:15": 2, ...}`: chiavi non note
    in anticipo, quindi in OpenAPI si descrive con `additionalProperties`, non con un oggetto a
    campi fissi.
    """
    return OpenApiResponse(
        response={'type': 'object', 'additionalProperties': {'type': 'integer'}},
        description=descrizione,
        examples=[OpenApiExample(nome, value=esempio)],
    )


def lista_date(descrizione, esempio):
    """Risposta `["2026-07-05", "2026-07-12"]` — solo date, nessun altro campo."""
    return OpenApiResponse(
        response={'type': 'array', 'items': {'type': 'string', 'format': 'date'}},
        description=descrizione,
        examples=[OpenApiExample('Date', value=esempio)],
    )


# Le due `disponibilita` pubbliche non restituiscono il serializer della propria viewset ma un
# riepilogo aggregato costruito a mano: senza queste due forme esplicite Swagger dichiarerebbe
# una PrenotazionePiscina/PrenotazionePadel, cioè esattamente i dati personali che queste azioni
# esistono per NON esporre.
DISPONIBILITA_PISCINA = OpenApiResponse(
    response=inline_serializer(
        name='DisponibilitaPiscina',
        fields={
            'ombrellone': serializers.IntegerField(),
            'gazebo': serializers.IntegerField(),
            'lettino': serializers.IntegerField(),
            'sdraia': serializers.IntegerField(),
            'pieno': serializers.BooleanField(
                help_text='Giorno marcato manualmente "tutto prenotato" dallo staff, '
                          'indipendente dai conteggi residui qui sopra.'
            ),
        },
    ),
    description='Solo conteggi aggregati: nessun nome, telefono o nota di altri clienti.',
)

DISPONIBILITA_PADEL = OpenApiResponse(
    response=inline_serializer(
        name='DisponibilitaPadel',
        fields={
            'attivo': serializers.BooleanField(),
            'chiuso': serializers.BooleanField(),
            'durata_minuti': serializers.IntegerField(),
            'max_partecipanti': serializers.IntegerField(),
            'prezzo_partita': serializers.CharField(),
            'prezzo_noleggio_palline': serializers.CharField(),
            'slots': inline_serializer(
                name='SlotPadel',
                many=True,
                fields={
                    'ora': serializers.CharField(help_text='Orario di inizio, "HH:MM".'),
                    'disponibile': serializers.BooleanField(),
                },
            ),
        },
    ),
    description=(
        'Se il servizio è disattivato o il giorno è chiuso, `slots` è una lista vuota: '
        'non vengono proposti orari che il serializer rifiuterebbe comunque al submit.'
    ),
)

# `dettaglio_pubblico` dell'asporto è l'unico endpoint che restituisce la prenotazione **più** le
# sue righe d'ordine annidate sotto `voci` — composte a mano nella view, quindi invisibili a
# drf-spectacular, che altrimenti dichiarerebbe il solo PrenotazioneAsporto e lascerebbe credere
# che `voci` non esista.
#
# Composto con due `$ref` invece che con un inline_serializer perché `VoceOrdineSerializer` vive
# in `menu` e `prenotazioni/views.py` lo importa **dentro** la funzione, mai a livello di modulo
# (invariante deliberata, sezione 1: la dipendenza inversa prenotazioni → menu resta circoscritta
# a un solo punto). Un decoratore viene valutato all'import, quindi referenziarlo lì avrebbe
# richiesto di rompere proprio quell'invariante. I due componenti esistono comunque già nello
# schema: li generano PrenotazioneAsportoViewSet e menu.VoceOrdineViewSet.
DETTAGLIO_ASPORTO = OpenApiResponse(
    response={
        'allOf': [
            {'$ref': '#/components/schemas/PrenotazioneAsporto'},
            {
                'type': 'object',
                'properties': {
                    'voci': {
                        'type': 'array',
                        'items': {'$ref': '#/components/schemas/VoceOrdine'},
                    },
                },
            },
        ],
    },
    description="L'ordine con le proprie righe prodotto annidate in `voci`.",
)


LISTA_UUID = OpenApiResponse(
    response={'type': 'array', 'items': {'type': 'string', 'format': 'uuid'}},
    description="Solo gli id delle postazioni occupate, nessun dato personale dell'occupante.",
    examples=[
        OpenApiExample(
            'Postazioni occupate',
            value=['3f1c2b8e-0f4a-4d3e-9a6b-2c5d7e8f9a01'],
        )
    ],
)
