from django.db.models import Sum
from django.utils import timezone


def registra_posizione_storico(postazione):
    """
    Upsert dello storico posizione per OGGI (data server-side, non fornita dal client): una sola
    riga per postazione per giorno, così più drag nella stessa giornata aggiornano la stessa riga
    invece di accumularne una per ogni movimento. Va chiamata dopo ogni create/update di
    Postazione (vedi struttura/views.py) — è idempotente e innocua anche se pos_x/pos_y non sono
    effettivamente cambiati in questa scrittura.
    """
    from .models import PostazionePosizioneStorico

    PostazionePosizioneStorico.objects.update_or_create(
        postazione=postazione,
        data=timezone.localdate(),
        defaults={'pos_x': postazione.pos_x, 'pos_y': postazione.pos_y},
    )


def posizioni_effettive(postazione_ids, data):
    """
    {postazione_id (str): (pos_x, pos_y)} ricostruendo, per ciascuna postazione, l'ultima
    posizione nota con storico.data <= data richiesta — usato per mostrare la mappa "come era"
    in un giorno passato, dato che Postazione.pos_x/pos_y riflette solo il presente. Le
    postazioni senza alcuno storico anteriore o pari alla data richiesta sono assenti dal
    risultato: il chiamante ricade sulla posizione live di Postazione (può succedere solo per
    date precedenti alla creazione della postazione stessa).
    """
    from .models import PostazionePosizioneStorico

    righe = (
        PostazionePosizioneStorico.objects
        .filter(postazione_id__in=postazione_ids, data__lte=data)
        .order_by('data')  # ascendente: l'ultima riga letta per postazione è la più recente
        .values('postazione_id', 'pos_x', 'pos_y')
    )
    risultato = {}
    for riga in righe:
        risultato[str(riga['postazione_id'])] = (riga['pos_x'], riga['pos_y'])
    return risultato


def calcola_disponibilita(inventario, data, exclude_id=None):
    """
    Residuo di ombrelloni/gazebi/lettini/sdraie per un inventario in una data, al netto delle
    prenotazioni già attive (esclude 'CANCELLED' e, in caso di update, la prenotazione stessa).
    Condivisa tra PrenotazionePiscinaSerializer.validate() e l'azione pubblica 'disponibilita'
    per evitare di duplicare la logica anti-overbooking in due punti che potrebbero divergere.
    """
    from .models import PrenotazionePiscina

    prenotazioni_attive = PrenotazionePiscina.objects.filter(
        data=data, inventario=inventario
    ).exclude(stato='CANCELLED')

    if exclude_id:
        prenotazioni_attive = prenotazioni_attive.exclude(id=exclude_id)

    somme = prenotazioni_attive.aggregate(
        tot_ombrelloni=Sum('ombrellone'),
        tot_gazebi=Sum('gazebo'),
        tot_lettini=Sum('lettino'),
        tot_sdraie=Sum('sdraia'),
    )

    occupati = {
        'ombrellone': somme['tot_ombrelloni'] or 0,
        'gazebo': somme['tot_gazebi'] or 0,
        'lettino': somme['tot_lettini'] or 0,
        'sdraia': somme['tot_sdraie'] or 0,
    }

    return {
        'ombrellone': inventario.totale_ombrelloni - occupati['ombrellone'],
        'gazebo': inventario.totale_gazebi - occupati['gazebo'],
        'lettino': inventario.totale_lettini - occupati['lettino'],
        'sdraia': inventario.totale_sdraie - occupati['sdraia'],
    }


def _minuti_da_mezzanotte(ora):
    return ora.hour * 60 + ora.minute


def intervalli_padel_occupati(data, exclude_id=None):
    """
    [(inizio_minuti, fine_minuti)] delle partite già prenotate in una data — esclude le CANCELLED
    e, in caso di update, la prenotazione stessa (altrimenti si bloccherebbe da sola su un PATCH
    che non tocca affatto l'orario, stesso accorgimento di calcola_disponibilita()).

    Confronto per *intervallo* e non per uguaglianza dell'orario di inizio: ogni prenotazione
    porta con sé il proprio snapshot di durata (PrenotazionePadel.durata_minuti), quindi partite
    create prima di un cambio di durata possono sovrapporsi alla nuova griglia di slot senza
    condividere lo stesso orario di inizio.
    """
    from .models import PrenotazionePadel

    prenotazioni_attive = PrenotazionePadel.objects.filter(data=data).exclude(stato='CANCELLED')
    if exclude_id:
        prenotazioni_attive = prenotazioni_attive.exclude(id=exclude_id)

    intervalli = []
    for ora, durata in prenotazioni_attive.values_list('ora', 'durata_minuti'):
        inizio = _minuti_da_mezzanotte(ora)
        intervalli.append((inizio, inizio + durata))
    return intervalli


def slot_padel_libero(data, ora, durata_minuti, exclude_id=None):
    """
    True se una partita che inizia a `ora` e dura `durata_minuti` non si sovrappone ad alcuna
    prenotazione già presente in quella data. La struttura ha un solo campo, quindi "sovrapposta"
    equivale a "non prenotabile".

    La durata è un parametro esplicito, non letta dalla configurazione: su un update va usato lo
    snapshot della prenotazione stessa (PrenotazionePadel.durata_minuti), che può differire dalla
    durata configurata oggi.
    """
    inizio = _minuti_da_mezzanotte(ora)
    fine = inizio + durata_minuti
    return all(
        fine <= occupato_inizio or inizio >= occupato_fine
        for occupato_inizio, occupato_fine in intervalli_padel_occupati(data, exclude_id=exclude_id)
    )


def calcola_disponibilita_padel(configurazione, data, exclude_id=None):
    """
    Stato di ciascuno slot della griglia per una data: [{'ora': 'HH:MM', 'disponibile': bool}].
    Condivisa tra PrenotazionePadelSerializer.validate() e l'azione pubblica 'disponibilita',
    per non duplicare la logica di sovrapposizione in due punti che potrebbero divergere —
    stesso principio di calcola_disponibilita() per la piscina.
    """
    occupati = intervalli_padel_occupati(data, exclude_id=exclude_id)
    durata = configurazione.durata_partita_minuti

    slots = []
    for ora in configurazione.slot_disponibili():
        inizio = _minuti_da_mezzanotte(ora)
        fine = inizio + durata
        libero = all(
            fine <= occupato_inizio or inizio >= occupato_fine
            for occupato_inizio, occupato_fine in occupati
        )
        slots.append({'ora': ora.strftime('%H:%M'), 'disponibile': libero})
    return slots
