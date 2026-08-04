import uuid
from django.db import models
from users.models import Cliente
from struttura.models import PiscinaInventario, Postazione

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
    # Bambini sotto PiscinaInventario.eta_minima_bambino: ingresso gratuito, ma comunque
    # conteggiati (utile per lo staff sapere quanti bambini gratuiti sono inclusi, non solo il
    # totale a pagamento).
    ingressi_gratuiti = models.PositiveSmallIntegerField(default=0, verbose_name="Ingressi Gratuiti")
    ombrellone = models.PositiveSmallIntegerField(default=0)
    gazebo = models.PositiveSmallIntegerField(default=0)
    lettino = models.PositiveSmallIntegerField(default=0)
    sdraia = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "Prenotazione Piscina"
        verbose_name_plural = "Prenotazioni Piscina"

    def __str__(self):
        return f"Piscina - {self.cliente_id.nome} del {self.data}"


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
    # Distinto da Prenotazione.ora: quello è l'orario della prenotazione originale (se esiste),
    # questo è l'orario di arrivo previsto per QUESTA postazione/giorno, compilabile anche per i
    # clienti walk-in che non hanno una prenotazione reale a monte. Obbligatorio.
    orario_arrivo_previsto = models.TimeField()

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
    # Giorno da cui questa posizione è diventata effettiva (data di creazione o dell'ultimo
    # spostamento in quel giorno — al più una riga per postazione per giorno, vedi
    # PostazioneViewSet: più drag nello stesso giorno aggiornano la stessa riga).
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
