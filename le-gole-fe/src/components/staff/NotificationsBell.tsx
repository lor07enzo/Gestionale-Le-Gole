import { useState } from 'react';
import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { BellIcon, CheckIcon, ClockIcon, Icon } from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { useStaffNotifications } from '../../context/StaffNotificationsContext';
import { formatDateDDMMYYYY, formatIngressiSummary, formatTime } from '../../utils/piscinaMappa';
import type { PrenotazionePiscina } from '../../services/prenotazioni';

function NotificaRow({
  prenotazione,
  onConfirm,
  isConfirming,
}: Readonly<{
  prenotazione: PrenotazionePiscina;
  onConfirm: (p: PrenotazionePiscina) => void;
  isConfirming: boolean;
}>) {
  return (
    <Box className="rounded-2xl border border-amber-100 bg-amber-50/40 p-3">
      <HStack space="sm" className="items-start justify-between">
        <VStack space="xs" className="flex-1">
          <HStack space="xs" className="flex-wrap items-center">
            <Text size="sm" className="font-semibold text-sky-900">
              {prenotazione.cliente_nome}
            </Text>
            <HStack space="xs" className="items-center rounded-full border border-sky-200 bg-white px-2.5 py-1">
              <Icon as={ClockIcon} size="2xs" className="text-sky-700" />
              <Text size="2xs" className="font-bold text-sky-700">
                {formatDateDDMMYYYY(prenotazione.data)} · {formatTime(prenotazione.ora)}
              </Text>
            </HStack>
          </HStack>
          <Text size="xs" className="text-muted-foreground">
            {prenotazione.cliente_telefono}
          </Text>
          {prenotazione.note ? (
            <Text size="xs" className="italic text-sky-900/70">
              📝 {prenotazione.note}
            </Text>
          ) : null}
          <Text size="xs" className="text-sky-900/70">
            {formatIngressiSummary(prenotazione)}{' '}
            {prenotazione.ombrellone > 0 ? `⛱️ ${prenotazione.ombrellone} ` : ''}
            {prenotazione.gazebo > 0 ? `⛺ ${prenotazione.gazebo} ` : ''}
            {prenotazione.lettino > 0 ? `🛏️ ${prenotazione.lettino} ` : ''}
            {prenotazione.sdraia > 0 ? `🪑 ${prenotazione.sdraia}` : ''}
          </Text>
        </VStack>
        <Pressable
          accessibilityLabel={`Conferma prenotazione di ${prenotazione.cliente_nome}`}
          onPress={() => onConfirm(prenotazione)}
          disabled={isConfirming}
          className="h-8 w-8 items-center justify-center rounded-lg border border-emerald-300 bg-emerald-50 active:bg-emerald-100"
        >
          {isConfirming ? <Spinner size="small" /> : <Icon as={CheckIcon} size="sm" className="text-emerald-700" />}
        </Pressable>
      </HStack>
    </Box>
  );
}

// Banner "a comparsa" per una nuova prenotazione rilevata durante il polling — montato subito
// sotto l'header staff (app/staff/_layout.tsx), sopra il contenuto della pagina corrente.
export function NotificationsBanner() {
  const { banner, dismissBanner } = useStaffNotifications();
  if (!banner) return null;

  return (
    <Pressable onPress={dismissBanner} accessibilityRole="button" accessibilityLabel="Chiudi avviso">
      <Box className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 md:px-8">
        <Text size="sm" className="text-center font-medium text-amber-800">
          🔔 {banner}
        </Text>
      </Box>
    </Pressable>
  );
}

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { pendenti, nuoveCount, isLoading, error, markAllAsSeen, confirmingId, confirmPrenotazione } =
    useStaffNotifications();

  const handleOpen = () => {
    setIsOpen(true);
    markAllAsSeen();
  };

  return (
    <>
      <Pressable
        className="relative h-9 w-9 items-center justify-center md:h-10 md:w-10"
        onPress={handleOpen}
        accessibilityRole="button"
        accessibilityLabel={nuoveCount > 0 ? `Notifiche prenotazioni, ${nuoveCount} nuove` : 'Notifiche prenotazioni'}
      >
        <Icon as={BellIcon} size="md" className="text-sky-700" />
        {nuoveCount > 0 ? (
          <Box className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full border border-background bg-amber-100 px-1">
            <Text size="2xs" className="text-center font-bold leading-none text-amber-700">
              {nuoveCount > 9 ? '9+' : nuoveCount}
            </Text>
          </Box>
        ) : null}
      </Pressable>

      <Actionsheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[85vh]" aria-label="Notifiche prenotazioni">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetScrollView className="w-full">
            <VStack space="md" className="w-full pb-6 pt-1">
              <HStack className="items-center justify-between px-1">
                <Heading size="sm">Prenotazioni in attesa</Heading>
                <Box className="rounded-full bg-amber-100 px-2.5 py-1">
                  <Text size="2xs" className="font-bold text-amber-700">
                    {pendenti.length}
                  </Text>
                </Box>
              </HStack>

              {isLoading && pendenti.length === 0 ? (
                <Box className="items-center py-6">
                  <Spinner size="small" />
                </Box>
              ) : null}

              {error ? (
                <Text size="xs" className="px-1 text-destructive">
                  {error}
                </Text>
              ) : null}

              {!isLoading && pendenti.length === 0 && !error ? (
                <Text size="sm" className="px-1 text-muted-foreground">
                  Nessuna prenotazione in attesa di conferma.
                </Text>
              ) : null}

              {pendenti.map((p) => (
                <NotificaRow
                  key={p.id}
                  prenotazione={p}
                  onConfirm={(pren) => confirmPrenotazione(pren.id)}
                  isConfirming={confirmingId === p.id}
                />
              ))}
            </VStack>
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
