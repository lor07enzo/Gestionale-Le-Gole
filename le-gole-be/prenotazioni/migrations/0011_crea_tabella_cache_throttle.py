from django.core.management import call_command
from django.db import migrations


def crea_tabella_cache(apps, schema_editor):
    # createcachetable è idempotente: non ricrea una tabella già esistente. Farlo in una
    # migrazione garantisce che la tabella esista ovunque giri `migrate` — produzione (CMD del
    # Dockerfile), Docker locale e database di test di pytest — senza un comando in più.
    call_command('createcachetable', database=schema_editor.connection.alias, verbosity=0)


class Migration(migrations.Migration):

    dependencies = [
        ('prenotazioni', '0010_prenotazionepadel_noleggioracchetta'),
    ]

    operations = [
        migrations.RunPython(crea_tabella_cache, migrations.RunPython.noop),
    ]
