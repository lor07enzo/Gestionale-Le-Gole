import datetime
import uuid
from django.db import models

# Riga singleton fissa per ConfigurazionePadel (sotto) — un id noto in anticipo, non
# generato a runtime, così get_or_create(pk=...) punta sempre alla stessa riga. Stesso
# identico pattern di menu.CONFIGURAZIONE_ASPORTO_PK.
CONFIGURAZIONE_PADEL_PK = uuid.UUID("00000000-0000-0000-0000-000000000002")

class PiscinaInventario(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100, help_text="Es. 'Listino Estate 2026'")
    descrizione = models.TextField(blank=True, default="")

    # Prezzi (DecimalField per precisione valutaria)
    prezzo_ingresso = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    # 0.00 = non configurata, nascosta nei form.
    prezzo_ingresso_ridotto = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.00,
        verbose_name="Prezzo Ingresso Ridotto Pomeridiano",
    )
    prezzo_ingresso_bambino = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.00,
        verbose_name="Prezzo Ingresso Bambini",
    )
    prezzo_ombrellone = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    prezzo_gazebo = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    prezzo_lettino = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    prezzo_sdraia = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)

    # Capacità massime disponibili
    totale_ombrelloni = models.PositiveSmallIntegerField(default=0)
    totale_gazebi = models.PositiveSmallIntegerField(default=0)
    totale_lettini = models.PositiveSmallIntegerField(default=0)
    totale_sdraie = models.PositiveSmallIntegerField(default=0)

    orario_apertura = models.TimeField(default=datetime.time(10, 0), verbose_name="Orario di Apertura")
    orario_chiusura = models.TimeField(default=datetime.time(19, 0), verbose_name="Orario di Chiusura")

    # Soglia indicativa, non validata lato server.
    orario_inizio_ridotto = models.TimeField(
        default=datetime.time(14, 0),
        verbose_name="Orario Inizio Ridotto Pomeridiano",
        help_text="Da questo orario in poi l'ingresso ridotto pomeridiano è normalmente proposto.",
    )
    # Fascia [eta_minima_bambino, eta_massima_bambino], solo testo guida non validato.
    eta_minima_bambino = models.PositiveSmallIntegerField(
        default=3,
        verbose_name="Età Minima Bambino",
        help_text="Sotto questa età l'ingresso è indicativamente gratuito.",
    )
    eta_massima_bambino = models.PositiveSmallIntegerField(
        default=12,
        verbose_name="Età Massima Bambino",
        help_text="Età massima (inclusa) indicativamente ammessa alla tariffa bambini.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Flag per definire quale listino/inventario interrogare
    isActive = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Inventario Piscina"
        verbose_name_plural = "Inventari Piscina"

    def __str__(self):
        stato = "Attivo" if self.isActive else "Inattivo"
        return f"{self.nome} ({stato}) - [{self.orario_apertura.strftime('%H:%M')} - {self.orario_chiusura.strftime('%H:%M')}]"


class Postazione(models.Model):
    """
    Spot fisico (ombrellone o gazebo) posizionato sulla mappa di un inventario.
    La posizione (pos_x/pos_y) è indipendente dallo zoom del frontend: percentuale 0-100
    relativa al canvas della mappa.
    """
    TIPO_CHOICES = [
        ('OMBRELLONE', 'Ombrellone'),
        ('GAZEBO', 'Gazebo'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inventario = models.ForeignKey(PiscinaInventario, on_delete=models.CASCADE, related_name='postazioni')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES)
    numero = models.PositiveIntegerField(help_text="Numero identificativo della postazione")

    pos_x = models.FloatField(default=50.0, help_text="Posizione orizzontale in percentuale (0-100) sul canvas")
    pos_y = models.FloatField(default=50.0, help_text="Posizione verticale in percentuale (0-100) sul canvas")

    # Gazebo "attaccati" creati in blocco: stesso `gruppo` si spostano sempre insieme come corpo
    # rigido. Nullo per l'ombrellone e per un gazebo creato singolarmente. Generato lato frontend.
    gruppo = models.UUIDField(null=True, blank=True, db_index=True)

    # Soft delete: eliminare per davvero cancellerebbe lo storico (CASCADE) e altererebbe
    # retroattivamente cosa risultava "esistito" nei giorni passati.
    deleted_at = models.DateTimeField(null=True, blank=True, default=None)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Postazione"
        verbose_name_plural = "Postazioni"
        ordering = ['numero']
        constraints = [
            # Unicità solo tra le postazioni attive: un numero è riutilizzabile dopo soft-delete.
            models.UniqueConstraint(
                fields=['inventario', 'numero'],
                condition=models.Q(deleted_at__isnull=True),
                name='postazione_numero_unico_tra_le_attive',
            ),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} #{self.numero} ({self.inventario.nome})"


class ConfigurazionePadel(models.Model):
    """
    Configurazione singleton (un'unica riga condivisa) del servizio padel — stesso identico
    pattern di menu.ConfigurazioneAsporto, non un "listino" per-oggetto come PiscinaInventario:
    la struttura ha **un solo campo da padel**, quindi non esiste nulla da configurare per
    risorsa (decisione esplicita dell'utente, 2026-09-04). Nessun modello `CampoPadel`: una sola
    partita per volta, quindi l'anti-overbooking si riduce a "quella fascia oraria è già
    occupata" (vedi prenotazioni.utils.slot_padel_occupati).

    `attivo` è l'interruttore generale del servizio: a False il padel non è prenotabile online
    (blocca solo il self-service pubblico, mai lo staff — stesso principio di GiornoPienoPiscina
    e GiornoChiusoAsporto). Stesso ruolo che PiscinaInventario.isActive ha per la piscina.

    Prezzi e durata sono la fonte per lo *snapshot* copiato su ogni PrenotazionePadel al momento
    della creazione: a differenza della piscina (dove il listino è PROTECT e quindi lo storico
    resta leggibile), qui la riga è unica e mutabile, quindi senza snapshot cambiare un prezzo
    riscriverebbe retroattivamente il costo di ogni prenotazione già effettuata — stesso
    principio di menu.VoceOrdine.prezzo_unitario.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    attivo = models.BooleanField(
        default=False,
        verbose_name="Servizio padel attivo",
        help_text="Se disattivato, il padel non è prenotabile online (lo staff può comunque registrare una partita).",
    )

    orario_apertura = models.TimeField(default=datetime.time(9, 0), verbose_name="Orario di Apertura")
    orario_chiusura = models.TimeField(default=datetime.time(22, 0), verbose_name="Orario di Chiusura")

    # Durata unica per ogni partita: gli slot prenotabili si generano automaticamente a passi di
    # questo valore a partire dall'orario di apertura (vedi slot_disponibili()). Non un elenco di
    # durate selezionabili dal cliente (decisione esplicita dell'utente): un solo prezzo, una sola
    # griglia di orari, nessuna sovrapposizione possibile tra slot di durata diversa.
    durata_partita_minuti = models.PositiveSmallIntegerField(
        default=90,
        verbose_name="Durata di una partita (minuti)",
    )

    prezzo_partita = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.00,
        verbose_name="Costo di una partita",
        help_text="Prezzo fisso per la prenotazione del campo, indipendente dal numero di partecipanti.",
    )

    # Tetto sul campo PrenotazionePadel.partecipanti, mai un moltiplicatore di prezzo (il costo
    # è fisso a partita, sopra). Vincolante per chiunque, staff incluso: è un limite fisico del
    # campo, non una regola del solo canale online.
    max_partecipanti = models.PositiveSmallIntegerField(
        default=4,
        verbose_name="Numero massimo di partecipanti",
    )

    # Le racchette NON hanno un prezzo qui: ognuna ha il proprio, sul catalogo RacchettaPadel
    # (sotto). Le palline restano invece un'unica tariffa per l'intero servizio — non esiste un
    # catalogo di marche di palline, si noleggiano o no. 0.00 = tariffa non configurata, stesso
    # trattamento dei prezzi a 0 su PiscinaInventario.
    prezzo_noleggio_palline = models.DecimalField(
        max_digits=6, decimal_places=2, default=0.00,
        verbose_name="Costo noleggio palline",
        help_text="Prezzo per il set di palline, addebitato una sola volta per prenotazione.",
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configurazione Padel"
        verbose_name_plural = "Configurazione Padel"

    def __str__(self):
        stato = "Attivo" if self.attivo else "Disattivato"
        return f"Padel ({stato}) - {self.descrizione_orari()} - partite da {self.durata_partita_minuti} min"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=CONFIGURAZIONE_PADEL_PK)
        return obj

    def descrizione_orari(self):
        """Stringa leggibile dell'orario di disponibilità, usata nei messaggi di errore."""
        return (
            f"dalle {self.orario_apertura.strftime('%H:%M')} "
            f"alle {self.orario_chiusura.strftime('%H:%M')}"
        )

    def slot_disponibili(self):
        """
        Orari di inizio prenotabili (datetime.time), a passi di `durata_partita_minuti` a partire
        dall'apertura: viene incluso solo lo slot che *termina* entro l'orario di chiusura, così
        una partita non sfora mai oltre la chiusura. Lista vuota se la durata è più lunga
        dell'intera finestra di apertura (configurazione comunque rifiutata dal serializer).
        """
        durata = datetime.timedelta(minutes=self.durata_partita_minuti)
        giorno = datetime.date(2000, 1, 1)  # data fittizia: servono solo le ore
        cursore = datetime.datetime.combine(giorno, self.orario_apertura)
        fine_servizio = datetime.datetime.combine(giorno, self.orario_chiusura)

        slots = []
        while cursore + durata <= fine_servizio:
            slots.append(cursore.time())
            cursore += durata
        return slots

    def orario_valido(self, ora):
        """
        True solo se `ora` è esattamente uno degli slot della griglia — non un semplice "dentro
        l'intervallo di apertura" come per l'asporto. Con un solo campo e una durata fissa, un
        orario disallineato (es. 10:15 su una griglia da 90 minuti che parte alle 10:00) creerebbe
        una partita sovrapposta a quella delle 10:00 che nessun confronto per uguaglianza di `ora`
        rileverebbe: l'allineamento è quindi parte dell'anti-overbooking, non un vezzo di UI.
        """
        return ora in self.slot_disponibili()


class GiornoChiusoPadel(models.Model):
    """
    Giorno in cui il campo da padel non è disponibile per l'intera giornata (festività, chiusura
    straordinaria, manutenzione), impostato dallo staff da un calendario — stesso identico
    modello/ruolo di menu.GiornoChiusoAsporto, incluso il non avere un campo `note` (non
    richiesto: se in futuro servirà mostrare un motivo al cliente andrà aggiunto come campo
    dedicato). A differenza di prenotazioni.GiornoPienoPiscina non è per-inventario: il padel non
    ha alcun concetto di listino, una riga per data basta per l'intero servizio.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data = models.DateField(unique=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Giorno Chiuso Padel"
        verbose_name_plural = "Giorni Chiusi Padel"
        ordering = ['data']

    def __str__(self):
        return f"Padel chiuso il {self.data}"


class RacchettaPadel(models.Model):
    """
    Racchetta noleggiabile, registrata dallo staff con la propria tariffa — stesso ruolo che
    menu.Prodotto ha per l'asporto: un catalogo, non una configurazione. Sostituisce (2026-09-04)
    il precedente `ConfigurazionePadel.prezzo_noleggio_racchetta`, un prezzo unico valido per
    qualunque racchetta: tenerli entrambi avrebbe lasciato due fonti di verità in conflitto sul
    prezzo da applicare, quindi quel campo è stato rimosso, non affiancato.

    `quantita_disponibile` è il numero di pezzi realmente posseduti, usato come **tetto per
    singola prenotazione** e non come disponibilità da calcolare per data/ora: la struttura ha un
    solo campo (vedi ConfigurazionePadel), quindi in una fascia oraria esiste sempre al massimo
    una partita e le racchette non sono mai contese tra prenotazioni diverse.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(
        max_length=120, unique=True,
        help_text="Marca ed eventuale modello, es. 'Babolat Air Viper'.",
    )
    prezzo_noleggio = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    quantita_disponibile = models.PositiveSmallIntegerField(
        default=1,
        verbose_name="Pezzi disponibili",
        help_text="Quante racchette di questo tipo possiede la struttura.",
    )
    # Nasconde la racchetta dal noleggio online senza eliminarla: i noleggi passati continuano a
    # referenziarla (PROTECT su NoleggioRacchetta), quindi non sarebbe comunque eliminabile —
    # stesso identico principio di Prodotto.disponibile.
    disponibile = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Racchetta Padel"
        verbose_name_plural = "Racchette Padel"
        ordering = ['nome']

    def __str__(self):
        return f"{self.nome} - €{self.prezzo_noleggio}"
