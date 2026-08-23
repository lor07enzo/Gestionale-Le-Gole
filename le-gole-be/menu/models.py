import datetime
import uuid
from django.db import models
from prenotazioni.models import PrenotazioneAsporto

# Riga singleton fissa per ConfigurazioneAsporto (sotto) — un id noto in anticipo, non generato
# a runtime, così get_or_create(pk=...) può sempre puntare alla stessa riga.
CONFIGURAZIONE_ASPORTO_PK = uuid.UUID("00000000-0000-0000-0000-000000000001")


class Categoria(models.Model):
    """
    Categoria del menu asporto (es. "Pizze", "Antipasti", "Bevande"), creata dallo staff prima
    dei prodotti — un Prodotto deve appartenere a una categoria già esistente (FK, sotto), non
    più a un testo libero digitato a mano.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100, unique=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Categoria Menu"
        verbose_name_plural = "Categorie Menu"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class Allergene(models.Model):
    """
    Allergene assegnabile a un Prodotto, gestito dallo staff in una sezione dedicata — stesso
    principio di Categoria: creato prima, poi assegnato ai prodotti. `icona` (emoji libera,
    opzionale) permette di riconoscerlo a colpo d'occhio nei badge del catalogo invece di dover
    leggere ogni volta il nome per esteso — stesso linguaggio "emoji come icona" già usato altrove
    nell'app (categorie di servizio, tab del pannello notifiche). I 14 allergeni previsti dal
    Reg. UE 1169/2011 sono seminati con un'icona di default da una data migration
    (0006_allergene_icona.py), ma restano righe normali: modificabili/eliminabili come qualunque
    altro Allergene creato dallo staff, nessuna distinzione a livello di modello.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100, unique=True)
    icona = models.CharField(max_length=8, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Allergene"
        verbose_name_plural = "Allergeni"
        ordering = ['nome']

    def __str__(self):
        return self.nome


class ConfigurazioneAsporto(models.Model):
    """
    Configurazione singleton (un'unica riga condivisa) del servizio asporto: orario di inizio
    e fine disponibilità, impostato dallo staff. A differenza della piscina, l'asporto non ha
    un concetto di "listino/inventario" per cui questi campi possano vivere per-oggetto
    (sezione 1) — è un'unica impostazione per l'intero servizio, non per singolo prodotto o
    categoria. Nessun pacchetto tipo django-solo: un get_or_create su un pk fisso basta.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    orario_apertura = models.TimeField(
        default=datetime.time(11, 0), verbose_name="Orario di inizio disponibilità"
    )
    orario_chiusura = models.TimeField(
        default=datetime.time(22, 0), verbose_name="Orario di fine disponibilità"
    )

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Configurazione Asporto"

    def __str__(self):
        return f"Asporto: {self.orario_apertura.strftime('%H:%M')} - {self.orario_chiusura.strftime('%H:%M')}"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=CONFIGURAZIONE_ASPORTO_PK)
        return obj


class Prodotto(models.Model):
    """
    Catalogo food & beverage per l'asporto.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=150)
    descrizione = models.TextField(blank=True, default="")
    # PROTECT: una categoria con prodotti collegati non è eliminabile (stesso principio di
    # Piscina_Inventario su Prenotazione_Piscina, sezione 1) — va prima riassegnato/eliminato
    # ogni prodotto di quella categoria.
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name='prodotti')
    # Un prodotto può avere zero o più allergeni; nessun vincolo di eliminazione a catena qui,
    # una ManyToManyField non supporta on_delete=PROTECT sul lato "target" — eliminare un
    # Allergene si limita a scollegarlo dai prodotti che lo referenziavano.
    allergeni = models.ManyToManyField(Allergene, blank=True, related_name='prodotti')
    prezzo = models.DecimalField(max_digits=6, decimal_places=2)
    # Nasconde il prodotto dal menu pubblico senza eliminarlo: le VoceOrdine passate continuano
    # a referenziarlo (PROTECT, sotto), quindi non è comunque eliminabile una volta ordinato.
    disponibile = models.BooleanField(default=True)
    # Caricata su Cloudinary (STORAGES, backend/settings.py), non sul filesystem locale — quello
    # di Render è effimero e si svuoterebbe ad ogni deploy. Opzionale: un prodotto può non avere
    # ancora una foto.
    immagine = models.ImageField(upload_to='prodotti', blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Prodotto"
        verbose_name_plural = "Prodotti"
        ordering = ['categoria__nome', 'nome']

    def __str__(self):
        return f"{self.nome} - €{self.prezzo}"


class GiornoChiusoAsporto(models.Model):
    """
    Giorno in cui il servizio asporto non è disponibile (festività, chiusura straordinaria),
    impostato dallo staff — a differenza di ConfigurazioneAsporto (orario giornaliero), qui si
    chiude l'intera giornata. Nessun concetto di inventario/listino per l'asporto (sezione 1),
    quindi a differenza di prenotazioni.GiornoPienoPiscina (per-inventario) una sola riga per
    data basta per l'intero servizio.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    data = models.DateField(unique=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Giorno Chiuso Asporto"
        verbose_name_plural = "Giorni Chiusi Asporto"
        ordering = ['data']

    def __str__(self):
        return f"Asporto chiuso il {self.data}"


class VoceOrdine(models.Model):
    """
    Singola riga di un ordine asporto (prodotto + quantità). `prezzo_unitario` è uno snapshot
    del prezzo del prodotto al momento dell'ordine: se Prodotto.prezzo cambia in seguito, gli
    ordini già effettuati non devono variare di prezzo retroattivamente.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    prenotazione = models.ForeignKey(PrenotazioneAsporto, on_delete=models.CASCADE, related_name='voci')
    # PROTECT: preserva lo storico ordini, stesso principio di Piscina_Inventario su
    # Prenotazione_Piscina (sezione 1) — un prodotto con voci d'ordine collegate non è eliminabile.
    prodotto = models.ForeignKey(Prodotto, on_delete=models.PROTECT, related_name='voci_ordine')

    quantita = models.PositiveSmallIntegerField(default=1)
    prezzo_unitario = models.DecimalField(max_digits=6, decimal_places=2)
    note = models.CharField(max_length=255, blank=True, default="", verbose_name="Note aggiuntive")

    class Meta:
        verbose_name = "Voce Ordine"
        verbose_name_plural = "Voci Ordine"

    def __str__(self):
        return f"{self.quantita}x {self.prodotto.nome}"

    @property
    def subtotale(self):
        return self.quantita * self.prezzo_unitario
