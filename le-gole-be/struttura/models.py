import datetime
import uuid
from django.db import models

class PiscinaInventario(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=100, help_text="Es. 'Listino Estate 2026'")
    descrizione = models.TextField(blank=True, default="")

    # Prezzi (DecimalField per precisione valutaria)
    prezzo_ingresso = models.DecimalField(max_digits=6, decimal_places=2, default=0.00)
    # Tariffe alternative alla intera, opzionali (default 0.00 = non configurata, nascosta nei
    # form); soglie sotto sono solo testo guida, non validate lato server.
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

    # Soglie indicative per le tariffe ingresso alternative sopra — non validate lato server,
    # solo mostrate come testo guida nei form (vedi commento su prezzo_ingresso_ridotto).
    orario_inizio_ridotto = models.TimeField(
        default=datetime.time(14, 0),
        verbose_name="Orario Inizio Ridotto Pomeridiano",
        help_text="Da questo orario in poi l'ingresso ridotto pomeridiano è normalmente proposto.",
    )
    # Fascia d'età per la tariffa bambini: [eta_minima_bambino, eta_massima_bambino] paga
    # prezzo_ingresso_bambino, sotto eta_minima_bambino l'ingresso è indicativamente gratuito
    # (vedi PrenotazionePiscina.ingressi_gratuiti) — entrambe solo testo guida, non validate.
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

    # Soft delete: eliminare per davvero cancellerebbe lo storico (CASCADE su
    # OccupazionePostazione/PostazionePosizioneStorico) e altererebbe retroattivamente cosa
    # risultava "esistito" nei giorni passati. PostazioneViewSet filtra di conseguenza in base
    # alla data consultata (vedi views.py).
    deleted_at = models.DateTimeField(null=True, blank=True, default=None)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Postazione"
        verbose_name_plural = "Postazioni"
        ordering = ['numero']
        constraints = [
            # Non un semplice unique_together: un numero deve poter essere riutilizzato da una
            # nuova postazione dopo che la precedente con lo stesso numero è stata eliminata
            # (soft-delete) — l'unicità vale solo tra le postazioni ancora attive.
            models.UniqueConstraint(
                fields=['inventario', 'numero'],
                condition=models.Q(deleted_at__isnull=True),
                name='postazione_numero_unico_tra_le_attive',
            ),
        ]

    def __str__(self):
        return f"{self.get_tipo_display()} #{self.numero} ({self.inventario.nome})"
