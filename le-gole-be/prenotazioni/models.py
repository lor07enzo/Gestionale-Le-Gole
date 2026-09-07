import datetime
import uuid
from decimal import Decimal
from django.db import models
from users.models import Cliente
from struttura.models import PiscinaInventario, Postazione, RacchettaPadel

class Prenotazione(models.Model):
    STATO_CHOICES = [
        ('PENDING', 'In Attesa'),
        ('CONFIRMED', 'Confermata'),
        ('CANCELLED', 'Cancellata'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    cliente_id = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name="%(class)s_prenotazioni")
    data = models.DateField()
    ora = models.TimeField()
    stato = models.CharField(max_length=20, choices=STATO_CHOICES, default='PENDING')
    note = models.TextField(blank=True, default='', verbose_name="Note aggiuntive")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Data di creazione")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Ultima modifica")

    class Meta:
        abstract = True
        ordering = ['-data', '-ora']


class PrenotazionePiscina(Prenotazione):
    # Colleghiamo la prenotazione al listino/inventario attivo nel momento in cui viene effettuata
    inventario = models.ForeignKey(PiscinaInventario, on_delete=models.PROTECT, related_name='prenotazioni')
    
    # `ingressi` è la tariffa intera; le altre sono contatori indipendenti per le tariffe
    # alternative (PiscinaInventario.prezzo_ingresso_ridotto/bambino), senza vincoli tra loro.
    ingressi = models.PositiveSmallIntegerField(default=1)
    ingressi_ridotti = models.PositiveSmallIntegerField(default=0, verbose_name="Ingressi Ridotti Pomeridiani")
    ingressi_bambini = models.PositiveSmallIntegerField(default=0, verbose_name="Ingressi Bambini")
    # Sotto l'età minima: ingresso gratuito ma comunque conteggiato.
    ingressi_gratuiti = models.PositiveSmallIntegerField(default=0, verbose_name="Ingressi Gratuiti")
    ombrellone = models.PositiveSmallIntegerField(default=0)
    gazebo = models.PositiveSmallIntegerField(default=0)
    lettino = models.PositiveSmallIntegerField(default=0)
    sdraia = models.PositiveSmallIntegerField(default=0)
    # Forzato da perform_create() in base all'autenticazione, mai dal payload.
    creata_da_staff = models.BooleanField(default=False, verbose_name="Creata dallo staff")

    class Meta:
        verbose_name = "Prenotazione Piscina"
        verbose_name_plural = "Prenotazioni Piscina"

    def __str__(self):
        return f"Piscina - {self.cliente_id.nome} del {self.data}"


class PrenotazioneAsporto(Prenotazione):
    """
    Ordine da ritirare in loco: `ora` (ereditato da Prenotazione) è l'orario di ritiro previsto,
    stesso riuso già fatto per PrenotazionePiscina.ora come orario di arrivo. Le righe d'ordine
    vivono in menu.VoceOrdine (FK verso questo modello, related_name='voci') — nessun totale
    persistito qui: si ricava sempre sommando le VoceOrdine collegate (stesso principio per cui
    il totale stimato lato piscina non viene mai salvato lato backend, sezione 7).
    """
    creata_da_staff = models.BooleanField(default=False, verbose_name="Creato dallo staff")

    class Meta:
        verbose_name = "Prenotazione Asporto"
        verbose_name_plural = "Prenotazioni Asporto"

    def __str__(self):
        return f"Asporto - {self.cliente_id.nome} del {self.data}"

    @property
    def totale(self):
        return sum((voce.subtotale for voce in self.voci.all()), Decimal('0.00'))


class PrenotazionePadel(Prenotazione):
    """
    Prenotazione del campo da padel: `ora` (ereditato da Prenotazione) è l'orario di *inizio*
    della partita, sempre allineato alla griglia di slot generata da
    struttura.ConfigurazionePadel.slot_disponibili() — stesso riuso del campo `ora` già fatto per
    l'orario di arrivo (piscina) e di ritiro (asporto).

    La struttura ha un solo campo, quindi non esiste alcuna FK verso una risorsa fisica: due
    prenotazioni non cancellate non possono sovrapporsi nel tempo, e basta questo come
    anti-overbooking (vedi prenotazioni.utils.slot_padel_occupati).

    Durata e prezzi sono **snapshot** della configurazione al momento della prenotazione, non
    letti a runtime: la configurazione è una riga unica e mutabile (a differenza del listino
    piscina, protetto da PROTECT), quindi senza snapshot un cambio di tariffa riscriverebbe
    retroattivamente il costo di ogni partita già prenotata — stesso identico principio di
    menu.VoceOrdine.prezzo_unitario. Sono tutti forzati server-side da
    PrenotazionePadelViewSet.perform_create(), mai accettati dal payload.
    """
    # Indicativo: non incide sul prezzo (fisso a partita), è solo il numero di giocatori attesi,
    # limitato da ConfigurazionePadel.max_partecipanti.
    partecipanti = models.PositiveSmallIntegerField(default=4, verbose_name="Numero di partecipanti")

    # Le racchette noleggiate NON sono un contatore qui: ognuna ha una marca e un prezzo propri,
    # quindi vivono in righe dedicate (NoleggioRacchetta, related_name='noleggi') — stesso
    # rapporto che PrenotazioneAsporto ha con menu.VoceOrdine. Le palline restano un booleano
    # con tariffa unica: non esiste un catalogo di marche di palline.
    palline_noleggiate = models.BooleanField(default=False, verbose_name="Palline noleggiate")

    durata_minuti = models.PositiveSmallIntegerField(default=90, verbose_name="Durata della partita (minuti)")
    prezzo_partita = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    prezzo_palline = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)

    # Forzato da perform_create() in base all'autenticazione, mai dal payload.
    creata_da_staff = models.BooleanField(default=False, verbose_name="Creata dallo staff")

    class Meta:
        verbose_name = "Prenotazione Padel"
        verbose_name_plural = "Prenotazioni Padel"

    def __str__(self):
        return f"Padel - {self.cliente_id.nome} del {self.data} alle {self.ora.strftime('%H:%M')}"

    @property
    def orario_fine(self):
        """Orario di fine partita (datetime.time), derivato dallo snapshot di durata."""
        giorno = datetime.date(2000, 1, 1)  # data fittizia: servono solo le ore
        fine = datetime.datetime.combine(giorno, self.ora) + datetime.timedelta(minutes=self.durata_minuti)
        return fine.time()

    @property
    def racchette_totali(self):
        """Numero complessivo di racchette noleggiate, sommando le righe di tutte le marche."""
        return sum(noleggio.quantita for noleggio in self.noleggi.all())

    @property
    def totale(self):
        """
        Costo della prenotazione: partita (snapshot) + righe di noleggio racchette (ciascuna col
        proprio snapshot di prezzo) + eventuale set di palline. Calcolato a runtime e mai
        persistito, stesso principio di PrenotazioneAsporto.totale — un totale salvato potrebbe
        disallinearsi da cio che lo compone.
        """
        totale = self.prezzo_partita + sum(
            (noleggio.subtotale for noleggio in self.noleggi.all()), Decimal('0.00')
        )
        if self.palline_noleggiate:
            totale += self.prezzo_palline
        return Decimal(totale).quantize(Decimal('0.01'))



class NoleggioRacchetta(models.Model):
    """
    Singola riga di noleggio di una PrenotazionePadel: una marca di racchetta e quante se ne
    prendono. Stessa identica forma di menu.VoceOrdine — CASCADE verso la prenotazione (una riga
    non ha senso senza la sua partita), PROTECT verso il catalogo (una racchetta con noleggi
    storici non è eliminabile, resta solo nascondibile via `disponibile=False`), e
    `prezzo_unitario` come snapshot del prezzo al momento della prenotazione, così cambiare la
    tariffa non riscrive retroattivamente i noleggi già effettuati.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    prenotazione = models.ForeignKey(
        PrenotazionePadel, on_delete=models.CASCADE, related_name='noleggi'
    )
    racchetta = models.ForeignKey(
        RacchettaPadel, on_delete=models.PROTECT, related_name='noleggi'
    )
    quantita = models.PositiveSmallIntegerField(default=1)
    prezzo_unitario = models.DecimalField(max_digits=6, decimal_places=2)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Noleggio Racchetta"
        verbose_name_plural = "Noleggi Racchette"
        # Una sola riga per marca su una stessa prenotazione: due racchette Babolat sono
        # `quantita=2`, non due righe da 1 che renderebbero ambiguo il conteggio dei pezzi.
        unique_together = ('prenotazione', 'racchetta')
        ordering = ['racchetta__nome']

    def __str__(self):
        return f"{self.quantita}x {self.racchetta.nome} ({self.prenotazione_id})"

    @property
    def subtotale(self):
        return self.quantita * self.prezzo_unitario


class GiornoPienoPiscina(models.Model):
    """
    Marcatura manuale "tutto prenotato" per inventario+giorno: chiude le nuove prenotazioni
    self-service anche con conteggi ancora disponibili (evento privato, chiusura straordinaria).
    Non blocca lo staff (mappa/walk-in) — vedi PrenotazionePiscinaSerializer.validate().
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    inventario = models.ForeignKey(PiscinaInventario, on_delete=models.CASCADE, related_name='giorni_pieni')
    data = models.DateField()
    note = models.CharField(max_length=255, blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Giorno Pieno Piscina"
        verbose_name_plural = "Giorni Pieni Piscina"
        unique_together = ('inventario', 'data')
        ordering = ['-data']

    def __str__(self):
        return f"{self.inventario.nome} - {self.data} - TUTTO PRENOTATO"


class OccupazionePostazione(models.Model):
    """
    Assegnazione giornaliera di una Postazione (struttura) a un cliente/prenotazione.
    Non è un dato strutturale come Postazione: cambia ogni giorno.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    postazione = models.ForeignKey(Postazione, on_delete=models.CASCADE, related_name='occupazioni')
    data = models.DateField()

    # Collegamento opzionale alla prenotazione reale, se disponibile
    prenotazione = models.ForeignKey(
        PrenotazionePiscina,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='occupazione_postazione',
    )

    cliente_nome = models.CharField(max_length=255, blank=True, default="")
    numero_lettini = models.PositiveSmallIntegerField(default=0)
    numero_sdraie = models.PositiveSmallIntegerField(default=0)
    # Distinto da Prenotazione.ora: orario di arrivo previsto per QUESTA postazione/giorno.
    orario_arrivo_previsto = models.TimeField()
    # Check-in per singola postazione, non per prenotazione/cliente.
    arrivato = models.BooleanField(default=False, verbose_name="Cliente arrivato")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Occupazione Postazione"
        verbose_name_plural = "Occupazioni Postazione"
        unique_together = ('postazione', 'data')

    def __str__(self):
        return f"{self.postazione} - {self.data} - {self.cliente_nome or 'libera'}"


class PostazionePosizioneStorico(models.Model):
    """
    Storico delle posizioni di una Postazione: senza di esso, spostarla oggi farebbe "saltare"
    retroattivamente la sua posizione nei giorni passati già consultati. Una riga per ogni giorno
    in cui la posizione è cambiata, non una riga per postazione per giorno.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    postazione = models.ForeignKey(Postazione, on_delete=models.CASCADE, related_name='storico_posizioni')
    # Al più una riga per postazione per giorno: più drag nello stesso giorno aggiornano la stessa riga.
    data = models.DateField()
    pos_x = models.FloatField()
    pos_y = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Storico Posizione Postazione"
        verbose_name_plural = "Storico Posizioni Postazione"
        unique_together = ('postazione', 'data')
        ordering = ['-data']

    def __str__(self):
        return f"{self.postazione} @ {self.data} ({self.pos_x:.1f}, {self.pos_y:.1f})"
