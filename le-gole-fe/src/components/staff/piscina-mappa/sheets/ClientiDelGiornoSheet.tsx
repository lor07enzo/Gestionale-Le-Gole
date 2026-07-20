import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { usePiscinaMappaData } from '../../../../context/PiscinaMappaDataContext';
import { usePiscinaSelection } from '../../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';
import { formatDisplayDate, formatTime } from '../../../../utils/piscinaMappa';

export function ClientiDelGiornoSheet() {
  const { selectedDate, clientiDelGiorno } = usePiscinaMappaData();
  const { selectPrenotazioneCandidate } = usePiscinaSelection();
  const { isClientListOpen, setIsClientListOpen, openEditPrenotazione, handleDeletePrenotazione } =
    usePiscinaSheets();

  return (
    <Actionsheet isOpen={isClientListOpen} onClose={() => setIsClientListOpen(false)}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label="Clienti del giorno">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="xs" className="w-full pb-6 pt-1">
            <Heading size="sm" className="px-1 pb-2">
              Clienti del {formatDisplayDate(selectedDate)}
            </Heading>
            {clientiDelGiorno.length === 0 ? (
              <Text size="sm" className="px-1 text-muted-foreground">
                Nessuna prenotazione per questa data.
              </Text>
            ) : (
              clientiDelGiorno.map(({ prenotazione: p, residui, completo }) => (
                <HStack key={p.id} space="xs" className="items-center rounded-lg px-1 py-1.5">
                  <Pressable
                    className="flex-1"
                    onPress={() => {
                      if (completo) return;
                      selectPrenotazioneCandidate(p.id);
                      setIsClientListOpen(false);
                    }}
                  >
                    <VStack className="flex-1">
                      <HStack space="sm" className="items-center">
                        <Text size="sm" className="font-semibold text-sky-900">
                          {p.cliente_nome}
                        </Text>
                        <Box className="rounded-full bg-sky-100 px-2 py-0.5">
                          <Text size="2xs" className="font-bold text-sky-700">
                            🕐 {formatTime(p.ora) || '—'}
                          </Text>
                        </Box>
                        <Box className={`rounded-full px-2 py-0.5 ${completo ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                          <Text
                            size="2xs"
                            className={`font-bold ${completo ? 'text-emerald-700' : 'text-amber-700'}`}
                          >
                            {completo ? 'Completo' : 'Da assegnare'}
                          </Text>
                        </Box>
                      </HStack>
                      <Text size="xs" className="text-muted-foreground">
                        {p.cliente_telefono}
                      </Text>
                      {p.cliente_note ? (
                        <Text size="xs" className="italic text-sky-900/70">
                          📝 {p.cliente_note}
                        </Text>
                      ) : null}
                      <Text size="xs" className="text-sky-900/70">
                        Prenotato: 🎟️ {p.ingressi}{' '}
                        {p.ombrellone > 0 ? `⛱️ ${p.ombrellone} ` : ''}
                        {p.gazebo > 0 ? `⛺ ${p.gazebo} ` : ''}
                        {p.lettino > 0 ? `🛏️ ${p.lettino} ` : ''}
                        {p.sdraia > 0 ? `🪑 ${p.sdraia}` : ''}
                      </Text>
                      {!completo && residui ? (
                        <Text size="xs" className="text-amber-700">
                          {residui.ombrellone > 0 ? `⛱️ ${residui.ombrellone} ` : ''}
                          {residui.gazebo > 0 ? `⛺ ${residui.gazebo} ` : ''}
                          {residui.lettino > 0 ? `🛏️ ${residui.lettino} ` : ''}
                          {residui.sdraia > 0 ? `🪑 ${residui.sdraia}` : ''}
                          da assegnare
                        </Text>
                      ) : null}
                    </VStack>
                  </Pressable>
                  <VStack space="xs">
                    <Pressable
                      accessibilityLabel={`Modifica prenotazione di ${p.cliente_nome}`}
                      onPress={() => openEditPrenotazione(p)}
                      className="h-7 w-7 items-center justify-center rounded-md border border-sky-300 bg-white"
                    >
                      <Text size="xs">✏️</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Elimina prenotazione di ${p.cliente_nome}`}
                      onPress={() => handleDeletePrenotazione(p)}
                      className="h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-destructive/10"
                    >
                      <Text size="xs">🗑️</Text>
                    </Pressable>
                  </VStack>
                </HStack>
              ))
            )}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
