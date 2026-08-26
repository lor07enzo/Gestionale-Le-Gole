from django.db import migrations


def seed_categorie_bevande_vini(apps, schema_editor):
    Categoria = apps.get_model('menu', 'Categoria')
    Categoria.objects.get_or_create(nome='Bevande')
    Categoria.objects.get_or_create(nome='Vini')


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0010_configurazioneasporto_limite_prodotti_orario'),
    ]

    operations = [
        migrations.RunPython(seed_categorie_bevande_vini, noop_reverse),
    ]
