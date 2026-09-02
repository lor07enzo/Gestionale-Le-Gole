# Rinomina (2026-08-28, su richiesta esplicita dell'utente) il limite globale per orario di
# ritiro da "prodotti" (somma delle quantità ordinate) a "prenotazioni" (numero di ordini
# distinti) — stessa colonna, stesso tipo, solo nome e significato cambiati. RenameField preserva
# il valore già impostato dallo staff (se presente), nessuna migrazione dati necessaria.
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0012_configurazioneasporto_orario_apertura_2_and_more'),
    ]

    operations = [
        migrations.RenameField(
            model_name='configurazioneasporto',
            old_name='limite_prodotti_orario',
            new_name='limite_prenotazioni_orario',
        ),
        migrations.AlterField(
            model_name='configurazioneasporto',
            name='limite_prenotazioni_orario',
            field=models.PositiveSmallIntegerField(blank=True, null=True, verbose_name='Limite massimo di prenotazioni per orario'),
        ),
    ]
