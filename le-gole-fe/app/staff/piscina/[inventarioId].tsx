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
  const { inventarioId } = useLocalSearchParams<{ inventarioId: string }>();

  if (!inventarioId) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <PiscinaMappaProviders inventarioId={inventarioId}>
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

        <DateNavigator />
        <GiornoPienoToggle />
        <DisponibilitaRow />
        <MappaCanvas />
        <ActionToolbar />
        <DaAssegnarePanel />
        <SoloIngressoPanel />
      </VStack>

      <PostazioneSheet />
      <ClientPickerSheet />
      <ClientiDelGiornoSheet />
      <EditPrenotazioneSheet />
      <NewClienteSheet />
    </ScrollView>
  );
}
