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