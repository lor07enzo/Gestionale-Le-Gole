from django.db import migrations

# I 14 allergeni la cui presenza va dichiarata per legge nella ristorazione (Reg. UE n. 1169/2011,
# allegato II) — seminati qui invece di lasciare che lo staff li digiti a mano da zero: elimina il
# rischio di nomi incoerenti/duplicati tra locali diversi e parte già con un'icona per ciascuno
# (sotto). Restano righe Allergene normali: modificabili/eliminabili come qualunque voce creata a
# mano, nessuna distinzione a livello di modello (menu/models.py).
ALLERGENI_STANDARD = [
    ("Glutine", "🌾"),
    ("Crostacei", "🦐"),
    ("Uova", "🥚"),
    ("Pesce", "🐟"),
    ("Arachidi", "🥜"),
    ("Soia", "🌱"),
    ("Latte", "🥛"),
    ("Frutta a guscio", "🌰"),
    ("Sedano", "🥬"),
    ("Senape", "🌼"),
    ("Sesamo", "🥯"),
    ("Solfiti", "🍷"),
    ("Lupini", "🫛"),
    ("Molluschi", "🐚"),
]


def seed_allergeni_standard(apps, schema_editor):
    Allergene = apps.get_model('menu', 'Allergene')
    for nome, icona in ALLERGENI_STANDARD:
        allergene, created = Allergene.objects.get_or_create(nome=nome, defaults={'icona': icona})
        # Se la riga esisteva già (staff che l'aveva creata a mano prima di questa migration) ma
        # senza icona, gliela assegna comunque — non tocca un'icona diversa scelta di proposito.
        if not created and not allergene.icona:
            allergene.icona = icona
            allergene.save(update_fields=['icona'])


def noop_reverse(apps, schema_editor):
    # Nessun rollback: le righe seminate restano (potrebbero già essere in uso su prodotti reali),
    # coerente con l'idea che un allergene creato è comunque una voce normale, non "di sistema".
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0006_allergene_icona'),
    ]

    operations = [
        migrations.RunPython(seed_allergeni_standard, noop_reverse),
    ]
