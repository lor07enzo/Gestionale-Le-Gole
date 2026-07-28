import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Icon, LockIcon, UnlockIcon } from '@/components/ui/icon';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';

// Marcatura manuale "giorno tutto prenotato" per la data selezionata: blocca solo le nuove
// prenotazioni self-service pubbliche (Area Cliente), non la mappa/i walk-in dello staff — vedi
// GiornoPienoPiscina lato backend.
export function GiornoPienoToggle() {
  const { giornoPieno, isTogglingGiornoPieno, toggleGiornoPieno, isPastDate } = usePiscinaMappaData();

  // Nei giorni passati il flag non è più azionabile (non avrebbe alcun effetto), ma se era stato
  // impostato resta comunque utile mostrarlo come informazione storica.
  if (isPastDate) {
    if (!giornoPieno) return null;
    return (
      <Box className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
        <HStack space="xs" className="items-center">
          <Icon as={LockIcon} size="sm" className="text-rose-700" />
          <Text size="sm" className="font-medium text-rose-700">
            Quel giorno era stato segnato come tutto prenotato.
          </Text>
        </HStack>
      </Box>
    );
  }

  if (giornoPieno) {
    return (
      <Box className="w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
        <VStack space="sm">
          <HStack space="xs" className="items-center">
            <Icon as={LockIcon} size="sm" className="text-rose-700" />
            <Text size="sm" className="flex-1 font-semibold text-rose-700">
              Giorno segnato come tutto prenotato: le nuove prenotazioni online sono bloccate.
            </Text>
          </HStack>
          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-rose-300 bg-white"
            onPress={toggleGiornoPieno}
            disabled={isTogglingGiornoPieno}
          >
            {isTogglingGiornoPieno ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={UnlockIcon} className="text-rose-700" />
                <ButtonText className="text-rose-700">Rimuovi blocco</ButtonText>
              </>
            )}
          </Button>
        </VStack>
      </Box>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="self-start border-2 border-sky-300 bg-white shadow-sm"
      onPress={toggleGiornoPieno}
      disabled={isTogglingGiornoPieno}
    >
      {isTogglingGiornoPieno ? (
        <ButtonSpinner />
      ) : (
        <>
          <ButtonIcon as={LockIcon} className="text-sky-700" />
          <ButtonText className="text-sky-700">Segna giorno come tutto prenotato</ButtonText>
        </>
      )}
    </Button>
  );
}
