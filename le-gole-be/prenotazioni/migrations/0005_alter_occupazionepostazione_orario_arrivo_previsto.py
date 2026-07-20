from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('prenotazioni', '0004_occupazionepostazione_orario_arrivo_previsto'),
    ]

    operations = [
        migrations.AlterField(
            model_name='occupazionepostazione',
            name='orario_arrivo_previsto',
            field=models.TimeField(),
        ),
    ]
