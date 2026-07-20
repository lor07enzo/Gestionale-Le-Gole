import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { usePiscinaSelection } from '../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';

export function DaAssegnarePanel() {
  const { daAssegnare, remainingByPrenotazione } = usePiscinaMappaData();
  const { selectedPrenotazioneId, selectedWalkInCliente, selectPrenotazioneCandidate, selectWalkInCliente } =
    usePiscinaSelection();
  const { setIsClientListOpen } = usePiscinaSheets();

  return (
    <VStack space="xs">
      <HStack className="items-center justify-between">
        <Heading size="sm">Da assegnare</Heading>
        <Button
          size="sm"
          variant="outline"
          className="border-2 border-sky-300 bg-white shadow-sm"
          onPress={() => setIsClientListOpen(true)}
        >
          <ButtonText className="text-xs font-semibold text-sky-900">Clienti del giorno →</ButtonText>
        </Button>
      </HStack>
      {daAssegnare.length === 0 && !selectedWalkInCliente ? (
        <Text size="sm" className="text-muted-foreground">
          Nessuna prenotazione con ombrellone/gazebo in attesa per questa data.
        </Text>
      ) : (
        <HStack space="sm" className="flex-wrap">
          {selectedWalkInCliente ? (
            <Pressable onPress={() => selectWalkInCliente(null)}>
              <Box className="rounded-full border border-emerald-500 bg-emerald-100 px-3 py-2">
                <Text size="sm" className="font-medium text-emerald-900">
                  🆕 {selectedWalkInCliente.nome}
                </Text>
                <Text size="2xs" className="text-emerald-900/70">
                  nuovo cliente
                </Text>
              </Box>
            </Pressable>
          ) : null}
          {daAssegnare.map((p) => {
            const residui = remainingByPrenotazione.get(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => selectPrenotazioneCandidate(selectedPrenotazioneId === p.id ? null : p.id)}
              >
                <Box
                  className={`rounded-full border px-3 py-2 ${
                    selectedPrenotazioneId === p.id ? 'border-amber-500 bg-amber-100' : 'border-sky-200 bg-white'
                  }`}
                >
                  <Text size="sm" className="font-medium text-sky-900">
                    {p.cliente_nome}
                  </Text>
                  <Text size="2xs" className="text-sky-900/70">
                    {residui && residui.ombrellone > 0 ? `⛱️ ${residui.ombrellone} ` : ''}
                    {residui && residui.gazebo > 0 ? `⛺ ${residui.gazebo} ` : ''}
                    {residui && residui.lettino > 0 ? `🛏️ ${residui.lettino} ` : ''}
                    {residui && residui.sdraia > 0 ? `🪑 ${residui.sdraia}` : ''}
                  </Text>
                </Box>
              </Pressable>
            );
          })}
        </HStack>
      )}
      {selectedPrenotazioneId || selectedWalkInCliente ? (
        <Text size="2xs" className="text-amber-700">
          Tocca una postazione libera sulla mappa per assegnarla.
        </Text>
      ) : null}
    </VStack>
  );
}
