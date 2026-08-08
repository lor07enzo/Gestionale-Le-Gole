import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { AlertCircleIcon, CheckCircleIcon, CheckIcon, ClockIcon, EditIcon, Icon, SlashIcon } from '@/components/ui/icon';
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
import {
  formatDisplayDate,
  formatIngressiSummary,
  formatTime,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
} from '../../../../utils/piscinaMappa';
import type { ClienteDelGiornoEntry } from '../../../../types/piscinaMappa';
import type { PrenotazionePiscina } from '../../../../services/prenotazioni';

function ClienteDelGiornoRow({
  entry,
  onSelect,
  onEdit,
  onCancel,
  onConfirm,
  isConfirming,
  readOnly,
}: Readonly<{
  entry: ClienteDelGiornoEntry;
  onSelect: (p: PrenotazionePiscina) => void;
  onEdit: (p: PrenotazionePiscina) => void;
  onCancel: (p: PrenotazionePiscina) => void;
  onConfirm: (p: PrenotazionePiscina) => void;
  isConfirming: boolean;
  readOnly: boolean;
}>) {
  const { prenotazione: p, residui, completo, occupazioni } = entry;
  const isPending = p.stato === 'PENDING';
  const arrivati = occupazioni.filter((o) => o.arrivato).length;

  return (
    <Box className="rounded-2xl border border-sky-100 bg-white p-3 shadow-sm">
      <HStack space="sm" className="items-start justify-between">
        <Pressable className="flex-1" onPress={() => onSelect(p)}>
          <VStack space="xs" className="flex-1">
            <HStack space="xs" className="flex-wrap items-center">
              <Text size="sm" className="font-semibold text-sky-900">
                {p.cliente_nome}
              </Text>
              <HStack
                space="xs"
                className={`items-center rounded-full border px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[p.stato].bg} border-transparent`}
              >
                <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[p.stato].text}`}>
                  {STATO_PRENOTAZIONE_LABEL[p.stato]}
                </Text>
              </HStack>
              <HStack
                space="xs"
                className={`items-center rounded-full border px-2.5 py-1 ${
                  completo ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <Icon
                  as={completo ? CheckCircleIcon : AlertCircleIcon}
                  size="2xs"
                  className={completo ? 'text-emerald-700' : 'text-amber-700'}
                />
                <Text
                  size="2xs"
                  className={`font-bold ${completo ? 'text-emerald-700' : 'text-amber-700'}`}
                >
                  {completo ? 'Assegnato' : 'Da assegnare'}
                </Text>
              </HStack>
              <HStack space="xs" className="items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1">
                <Icon as={ClockIcon} size="2xs" className="text-sky-700" />
                <Text size="2xs" className="font-bold text-sky-700">
                  {formatTime(entry.orarioEffettivo) || '—'}
                </Text>
              </HStack>
              {occupazioni.length > 0 ? (
                <HStack
                  space="xs"
                  className={`items-center rounded-full border px-2.5 py-1 ${
                    arrivati === occupazioni.length
                      ? 'border-emerald-200 bg-emerald-50'
                      : 'border-sky-200 bg-sky-50'
                  }`}
                >
                  <Text
                    size="2xs"
                    className={`font-bold ${
                      arrivati === occupazioni.length ? 'text-emerald-700' : 'text-sky-700'
                    }`}
                  >
                    ✅ {arrivati}/{occupazioni.length} arrivati
                  </Text>
                </HStack>
              ) : null}
            </HStack>
            <Text size="xs" className="text-muted-foreground">
              {p.cliente_telefono}
            </Text>
            {p.note ? (
              <Text size="xs" className="italic text-sky-900/70">
                📝 {p.note}
              </Text>
            ) : null}
            <Text size="xs" className="text-sky-900/70">
              Prenotato: {formatIngressiSummary(p)}{' '}
              {p.ombrellone > 0 ? `⛱️ ${p.ombrellone} ` : ''}
              {p.gazebo > 0 ? `⛺ ${p.gazebo} ` : ''}
              {p.lettino > 0 ? `🛏️ ${p.lettino} ` : ''}
              {p.sdraia > 0 ? `🪑 ${p.sdraia}` : ''}
            </Text>
            {!completo && residui ? (
              <Text size="xs" className="font-medium text-amber-700">
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
          {isPending ? (
            <Pressable
              accessibilityLabel={`Conferma prenotazione di ${p.cliente_nome}`}
              onPress={() => onConfirm(p)}
              disabled={readOnly || isConfirming}
              className={`h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 active:bg-emerald-100 ${
                readOnly ? 'opacity-40' : ''
              }`}
            >
              {isConfirming ? <Spinner size="small" /> : <Icon as={CheckIcon} size="sm" className="text-emerald-700" />}
            </Pressable>
          ) : null}
          <Pressable
            accessibilityLabel={`Modifica prenotazione di ${p.cliente_nome}`}
            onPress={() => onEdit(p)}
            disabled={readOnly}
            className={`h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 active:bg-sky-100 ${readOnly ? 'opacity-40' : ''}`}
          >
            <Icon as={EditIcon} size="sm" className="text-sky-700" />
          </Pressable>
          <Pressable
            accessibilityLabel={`Annulla prenotazione di ${p.cliente_nome}`}
            onPress={() => onCancel(p)}
            disabled={readOnly}
            className={`h-8 w-8 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 active:bg-destructive/20 ${readOnly ? 'opacity-40' : ''}`}
          >
            <Icon as={SlashIcon} size="sm" className="text-destructive" />
          </Pressable>
        </VStack>
      </HStack>
    </Box>
  );
}

export function ClientiDelGiornoSheet() {
  const { selectedDate, clientiDelGiorno } = usePiscinaMappaData();
  const { selectPrenotazioneCandidate } = usePiscinaSelection();
  const {
    isPastDate,
    isClientListOpen,
    setIsClientListOpen,
    openEditPrenotazione,
    handleCancelPrenotazione,
    confirmPrenotazione,
    confirmingPrenotazioneId,
  } = usePiscinaSheets();

  // clientiDelGiorno arriva già ordinato per stato di assegnazione + orario (vedi
  // PiscinaMappaDataContext): qui lo dividiamo solo per renderizzare due sezioni separate,
  // l'ordine relativo all'interno di ciascuna resta invariato.
  const daAssegnare = clientiDelGiorno.filter((c) => !c.completo);
  const assegnati = clientiDelGiorno.filter((c) => c.completo);

  const handleSelect = (p: PrenotazionePiscina, completo: boolean) => {
    if (completo) return;
    selectPrenotazioneCandidate(p.id);
    setIsClientListOpen(false);
  };

  return (
    <Actionsheet isOpen={isClientListOpen} onClose={() => setIsClientListOpen(false)}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label="Clienti del giorno">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6 pt-1">
            <HStack className="items-center justify-between px-1">
              <Heading size="sm">Clienti del {formatDisplayDate(selectedDate)}</Heading>
              <Box className="rounded-full bg-sky-100 px-2.5 py-1">
                <Text size="2xs" className="font-bold text-sky-700">
                  {clientiDelGiorno.length}
                </Text>
              </Box>
            </HStack>

            {clientiDelGiorno.length === 0 ? (
              <Text size="sm" className="px-1 text-muted-foreground">
                Nessuna prenotazione per questa data.
              </Text>
            ) : (
              <>
                {daAssegnare.length > 0 ? (
                  <VStack space="sm">
                    <HStack space="xs" className="items-center px-1">
                      <Icon as={AlertCircleIcon} size="xs" className="text-amber-700" />
                      <Text size="xs" className="font-bold uppercase tracking-wide text-amber-700">
                        Da assegnare ({daAssegnare.length})
                      </Text>
                    </HStack>
                    {daAssegnare.map((entry) => (
                      <ClienteDelGiornoRow
                        key={entry.prenotazione.id}
                        entry={entry}
                        onSelect={(p) => handleSelect(p, false)}
                        onEdit={openEditPrenotazione}
                        onCancel={handleCancelPrenotazione}
                        onConfirm={confirmPrenotazione}
                        isConfirming={confirmingPrenotazioneId === entry.prenotazione.id}
                        readOnly={isPastDate}
                      />
                    ))}
                  </VStack>
                ) : null}

                {assegnati.length > 0 ? (
                  <VStack space="sm">
                    <HStack space="xs" className="items-center px-1">
                      <Icon as={CheckCircleIcon} size="xs" className="text-emerald-700" />
                      <Text size="xs" className="font-bold uppercase tracking-wide text-emerald-700">
                        Assegnati ({assegnati.length})
                      </Text>
                    </HStack>
                    {assegnati.map((entry) => (
                      <ClienteDelGiornoRow
                        key={entry.prenotazione.id}
                        entry={entry}
                        onSelect={(p) => handleSelect(p, true)}
                        onEdit={openEditPrenotazione}
                        onCancel={handleCancelPrenotazione}
                        onConfirm={confirmPrenotazione}
                        isConfirming={confirmingPrenotazioneId === entry.prenotazione.id}
                        readOnly={isPastDate}
                      />
                    ))}
                  </VStack>
                ) : null}
              </>
            )}
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
