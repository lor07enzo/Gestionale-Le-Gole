from django.db import migrations


def seed_categoria_pizze(apps, schema_editor):
    Categoria = apps.get_model('menu', 'Categoria')
    Categoria.objects.get_or_create(nome='Pizze')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0007_seed_allergeni_standard'),
    ]

    operations = [
        migrations.RunPython(seed_categoria_pizze, noop_reverse),
    ]
