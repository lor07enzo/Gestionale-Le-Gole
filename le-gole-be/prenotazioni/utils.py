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
