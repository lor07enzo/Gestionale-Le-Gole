from django.db import models
import uuid
from django.contrib.auth.models import AbstractUser

class Utente(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        verbose_name = 'Utente Staff'
        verbose_name_plural = 'Utenti Staff'

    def __str__(self):
        return f"{self.username} (Staff)"


class DispositivoStaff(models.Model):
    """
    Un dispositivo su cui un account staff ha installato l'app e concesso il permesso alle
    notifiche. Serve a sapere dove spedire un avviso push quando arriva una prenotazione
    self-service (users/push.py).

    Un account può averne più di uno (telefono personale + tablet del locale), ma un `token` è
    unico: identifica l'installazione, non la persona. Se un altro account fa login sullo stesso
    dispositivo la riga non si duplica, cambia `utente` — altrimenti chi si è disconnesso
    continuerebbe a far arrivare notifiche su un telefono che non usa più.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    utente = models.ForeignKey(
        'Utente', on_delete=models.CASCADE, related_name='dispositivi'
    )
    token = models.CharField(max_length=255, unique=True, verbose_name='Expo push token')
    piattaforma = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Dispositivo Staff'
        verbose_name_plural = 'Dispositivi Staff'
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.utente.username} - {self.piattaforma or 'dispositivo'}"


class Cliente(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nome = models.CharField(max_length=255, verbose_name="Nome e Cognome")
    telefono = models.CharField(max_length=20, verbose_name="Numero di Telefono")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Cliente'
        verbose_name_plural = 'Clienti'
        indexes = [
            models.Index(fields=['telefono']),
        ]

    def __str__(self):
        return f"{self.nome} - {self.telefono}"