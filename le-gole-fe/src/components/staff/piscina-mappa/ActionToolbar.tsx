import { HStack } from '@/components/ui/hstack';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { AddIcon } from '@/components/ui/icon';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';

export function ActionToolbar() {
  const { isPastDate, openAddPostazioneSheet, openNewClienteSheet } = usePiscinaSheets();

  return (
    <HStack space="sm" className="flex-wrap">
      <Button size="sm" onPress={openAddPostazioneSheet} disabled={isPastDate} className={isPastDate ? 'opacity-40' : undefined}>
        <ButtonText>+ Aggiungi postazione</ButtonText>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`rounded-full border-2 border-emerald-400 bg-emerald-50 shadow-sm active:bg-emerald-100 ${isPastDate ? 'opacity-40' : ''}`}
        onPress={openNewClienteSheet}
        disabled={isPastDate}
      >
        <ButtonIcon as={AddIcon} className="text-emerald-800" />
        <ButtonText className="font-semibold text-emerald-800">Nuovo cliente</ButtonText>
      </Button>
    </HStack>
  );
}
