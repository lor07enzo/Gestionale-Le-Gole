from rest_framework import serializers
from django.db.models import Sum
from .models import PrenotazionePiscina, OccupazionePostazione
from struttura.models import PiscinaInventario

class PrenotazionePiscinaSerializer(serializers.ModelSerializer):
    # Comodo per il frontend (es. mappa postazioni): evita una join lato client con /users/clienti/
    cliente_nome = serializers.CharField(source='cliente_id.nome', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente_id.telefono', read_only=True)
    cliente_note = serializers.CharField(source='cliente_id.note', read_only=True)

    class Meta:
        model = PrenotazionePiscina
        fields = '__all__'

    def validate(self, data):
        # Un PATCH parziale (es. dal form di modifica prenotazione) invia solo i campi cambiati:
        # per i campi omessi ricadiamo sui valori già presenti sull'istanza, altrimenti
        # 'inventario'/'data' risulterebbero None e il controllo di disponibilità sotto fallirebbe.
        instance = self.instance
        data_richiesta = data.get('data', instance.data if instance else None)
        ora_richiesta = data.get('ora', instance.ora if instance else None)
        inventario = data.get('inventario', instance.inventario if instance else None)

        # Verifichiamo se l'orario richiesto è fuori dal range del listino attivo
        if ora_richiesta:
            if ora_richiesta < inventario.orario_apertura or ora_richiesta > inventario.orario_chiusura:
                raise serializers.ValidationError({
                    "ora": f"La piscina è aperta dalle {inventario.orario_apertura.strftime('%H:%M')} alle {inventario.orario_chiusura.strftime('%H:%M')}."
                })

        # Recuperiamo la PK in caso di aggiornamento (patch/put) per escludere la prenotazione corrente dal conteggio
        instance_id = instance.id if instance else None

        # Aggreghiamo le risorse già prenotate e confermate (o in attesa) per quella data
        prenotazioni_attive = PrenotazionePiscina.objects.filter(
            data=data_richiesta,
            inventario=inventario
        ).exclude(stato='CANCELLED')

        if instance_id:
            prenotazioni_attive = prenotazioni_attive.exclude(id=instance_id)

        # Calcoliamo le somme, se res restituisce None (nessuna riga) forziamo a 0
        somme = prenotazioni_attive.aggregate(
            tot_ombrelloni=Sum('ombrellone'),
            tot_gazebi=Sum('gazebo'),
            tot_lettini=Sum('lettino'),
            tot_sdraie=Sum('sdraia')
        )
        
        ombrelloni_occupati = somme['tot_ombrelloni'] or 0
        gazebi_occupati = somme['tot_gazebi'] or 0
        lettini_occupati = somme['tot_lettini'] or 0
        sdraie_occupate = somme['tot_sdraie'] or 0

        # Controllo Anti-Overbooking
        richiesta_ombrelloni = data.get('ombrellone', instance.ombrellone if instance else 0)
        if (ombrelloni_occupati + richiesta_ombrelloni) > inventario.totale_ombrelloni:
            raise serializers.ValidationError({"ombrellone": f"Disponibilità ombrelloni esaurita. Residui: {inventario.totale_ombrelloni - ombrelloni_occupati}"})

        richiesta_gazebi = data.get('gazebo', instance.gazebo if instance else 0)
        if (gazebi_occupati + richiesta_gazebi) > inventario.totale_gazebi:
            raise serializers.ValidationError({"gazebo": f"Disponibilità gazebi esaurita. Residui: {inventario.totale_gazebi - gazebi_occupati}"})

        richiesta_lettini = data.get('lettino', instance.lettino if instance else 0)
        if (lettini_occupati + richiesta_lettini) > inventario.totale_lettini:
            raise serializers.ValidationError({"lettino": f"Disponibilità lettini esaurita. Residui: {inventario.totale_lettini - lettini_occupati}"})

        richiesta_sdraie = data.get('sdraia', instance.sdraia if instance else 0)
        if (sdraie_occupate + richiesta_sdraie) > inventario.totale_sdraie:
            raise serializers.ValidationError({"sdraia": f"Disponibilità sdraie esaurita. Residui: {inventario.totale_sdraie - sdraie_occupate}"})

        return data


class OccupazionePostazioneSerializer(serializers.ModelSerializer):
    class Meta:
        model = OccupazionePostazione
        fields = '__all__'