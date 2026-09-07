import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { PiscinaMappaProviders } from '../../../src/context/PiscinaMappaProviders';
import { usePiscinaMappaData } from '../../../src/context/PiscinaMappaDataContext';
import { ActionToolbar } from '../../../src/components/staff/piscina-mappa/ActionToolbar';
import { DaAssegnarePanel } from '../../../src/components/staff/piscina-mappa/DaAssegnarePanel';
import { DateNavigator } from '../../../src/components/staff/piscina-mappa/DateNavigator';
import { DisponibilitaRow } from '../../../src/components/staff/piscina-mappa/DisponibilitaRow';
import { GiornoPienoToggle } from '../../../src/components/staff/piscina-mappa/GiornoPienoToggle';
import { MappaCanvas } from '../../../src/components/staff/piscina-mappa/MappaCanvas';
import { MappaHeader } from '../../../src/components/staff/piscina-mappa/MappaHeader';
import { SoloIngressoPanel } from '../../../src/components/staff/piscina-mappa/SoloIngressoPanel';
import { ClientPickerSheet } from '../../../src/components/staff/piscina-mappa/sheets/ClientPickerSheet';
import { ClientiDelGiornoSheet } from '../../../src/components/staff/piscina-mappa/sheets/ClientiDelGiornoSheet';
import { EditPrenotazioneSheet } from '../../../src/components/staff/piscina-mappa/sheets/EditPrenotazioneSheet';
import { NewClienteSheet } from '../../../src/components/staff/piscina-mappa/sheets/NewClienteSheet';
import { PostazioneSheet } from '../../../src/components/staff/piscina-mappa/sheets/PostazioneSheet';

export default function PiscinaMappaScreen() {
  // 'data' opzionale (?data=YYYY-MM-DD): usato dal pannello notifiche staff (NotificationsBell)
  // per riportare la mappa direttamente sul giorno della prenotazione, invece che su oggi.
  const { inventarioId, data } = useLocalSearchParams<{ inventarioId: string; data?: string }>();

  if (!inventarioId) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <PiscinaMappaProviders inventarioId={inventarioId} initialDate={data}>
      <PiscinaMappaContent />
    </PiscinaMappaProviders>
  );
}

function PiscinaMappaContent() {
  const { inventario, isLoading, error } = usePiscinaMappaData();

  if (isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="md" className="w-full">
        <MappaHeader nome={inventario?.nome} />

        {error ? (
          <Text size="sm" className="text-destructive">
            {error}
          </Text>
        ) : null}

        {/* Fascia "di controllo" a tutta larghezza: giorno selezionato, blocco prenotazioni online
            e disponibilità residua restano in cima a ogni dimensione di schermo. */}
        <DateNavigator />
        <GiornoPienoToggle />
        <DisponibilitaRow />

        {/* Da tablet landscape in su (lg, >= 1024px) la mappa si affianca a una colonna laterale con
            "Da assegnare" e "Solo ingresso": assegnare un cliente a una postazione non richiede più
            di scorrere avanti e indietro tra la lista e la mappa. Sotto quella soglia (telefono e
            tablet in portrait, dove una mappa da ~370px sarebbe inservibile) resta l'impilamento
            verticale di sempre, nello stesso ordine di prima. */}
        <Box className="w-full gap-4 lg:flex-row lg:items-start">
          <VStack space="md" className="w-full lg:flex-1">
            <MappaCanvas />
            <ActionToolbar />
          </VStack>
          <VStack space="md" className="w-full lg:w-80">
            <DaAssegnarePanel />
            <SoloIngressoPanel />
          </VStack>
        </Box>
      </VStack>

      <PostazioneSheet />
      <ClientPickerSheet />
      <ClientiDelGiornoSheet />
      <EditPrenotazioneSheet />
      <NewClienteSheet />
    </ScrollView>
  );
}
