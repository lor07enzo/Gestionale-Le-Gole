import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';
import type { ViewStyle } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { StaffPageHeader } from '../../../../src/components/staff/StaffPageHeader';
import { ClienteInfoCard } from '../../../../src/components/staff/ClienteInfoCard';
import { PrenotazionePadelCard } from '../../../../src/components/staff/padel/PrenotazionePadelCard';
import { NoleggiRacchetteEditor } from '../../../../src/components/staff/padel/NoleggiRacchetteEditor';
import { EditPrenotazionePadelSheet } from '../../../../src/components/staff/padel/EditPrenotazionePadelSheet';
import {
  getPrenotazionePadel,
  updatePrenotazionePadel,
  type NoleggioRacchetta,
  type PrenotazionePadel,
} from '../../../../src/services/padel';
import { toISODate } from '../../../../src/utils/piscinaMappa';
import { extractErrorMessage } from '../../../../src/utils/errors';

// Solo web: riserva sempre lo spazio della scrollbar verticale, così il padding destro dello
// ScrollView non si assottiglia rispetto al sinistro quando il contenuto trabocca.
const scrollViewStyle =
  Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as unknown as ViewStyle) : undefined;

function avvisa(messaggio: string) {
  if (Platform.OS === 'web') {
    window.alert(messaggio);
  } else {
    Alert.alert('Errore', messaggio);
  }
}

export default function DettaglioPartitaPadelScreen() {
  const { prenotazioneId } = useLocalSearchParams<{ prenotazioneId: string }>();
  const [prenotazione, setPrenotazione] = useState<PrenotazionePadel | null>(null);
  // Sorgente di verità per le righe di noleggio finché si resta su questa pagina: si modificano
  // dal proprio endpoint, quindi il campo annidato della prenotazione resta indietro.
  const [noleggi, setNoleggi] = useState<NoleggioRacchetta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (!prenotazioneId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getPrenotazionePadel(prenotazioneId)
      .then((partita) => {
        if (cancelled) return;
        setPrenotazione(partita);
        setNoleggi(partita.noleggi);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare la partita. Riprova.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [prenotazioneId]);

  // Mai il futuro, solo il passato: calcolato sulla data della partita, non su una data condivisa.
  const editable = prenotazione ? prenotazione.data >= toISODate(new Date()) : false;

  const applicaAggiornamento = (aggiornata: PrenotazionePadel) => {
    setPrenotazione(aggiornata);
    setNoleggi(aggiornata.noleggi);
  };

  const handleConfirm = async () => {
    if (!prenotazione || !editable) return;
    setIsConfirming(true);
    try {
      applicaAggiornamento(await updatePrenotazionePadel(prenotazione.id, { stato: 'CONFIRMED' }));
    } catch (err) {
      avvisa(extractErrorMessage(err, 'Impossibile confermare la partita.'));
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    if (!prenotazione || !editable || prenotazione.stato === 'CANCELLED') return;
    const messaggio = `La partita di ${prenotazione.cliente_nome} verrà annullata e l'orario tornerà libero. Resterà comunque visibile qui come cancellata.`;

    const annulla = async () => {
      setIsCancelling(true);
      try {
        applicaAggiornamento(await updatePrenotazionePadel(prenotazione.id, { stato: 'CANCELLED' }));
      } catch (err) {
        avvisa(extractErrorMessage(err, 'Impossibile annullare la partita.'));
      } finally {
        setIsCancelling(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(messaggio)) annulla();
      return;
    }
    Alert.alert('Annullare la partita?', messaggio, [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla partita', style: 'destructive', onPress: annulla },
    ]);
  };

  if (!prenotazioneId || isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !prenotazione) {
    return (
      <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
        style={scrollViewStyle}
      >
        <VStack space="lg" className="w-full">
          <StaffPageHeader title="Dettaglio partita" fallbackHref="/staff/padel/prenotazioni" />
          <Text size="sm" className="text-center text-destructive">
            {error ?? 'Partita non trovata.'}
          </Text>
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
      style={scrollViewStyle}
    >
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Dettaglio partita"
          subtitle={prenotazione.cliente_nome}
          fallbackHref="/staff/padel/prenotazioni"
        />

        <ClienteInfoCard
          nome={prenotazione.cliente_nome}
          telefono={prenotazione.cliente_telefono}
          clienteId={prenotazione.cliente_id}
        />

        <PrenotazionePadelCard
          prenotazione={prenotazione}
          noleggi={noleggi}
          editable={editable}
          isConfirming={isConfirming}
          isCancelling={isCancelling}
          onEdit={() => setIsEditing(true)}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          showTelefono={false}
        />

        <Box className="w-full rounded-2xl border border-sky-200 bg-white p-4">
          <NoleggiRacchetteEditor
            prenotazioneId={prenotazione.id}
            noleggi={noleggi}
            partecipanti={prenotazione.partecipanti}
            onChange={setNoleggi}
            readOnly={!editable || prenotazione.stato === 'CANCELLED'}
          />
        </Box>
      </VStack>

      <EditPrenotazionePadelSheet
        prenotazione={isEditing ? prenotazione : null}
        onClose={() => setIsEditing(false)}
        onSaved={(aggiornata) => {
          applicaAggiornamento(aggiornata);
          setIsEditing(false);
        }}
      />
    </ScrollView>
  );
}
