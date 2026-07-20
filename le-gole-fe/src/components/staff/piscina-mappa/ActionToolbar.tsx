import { HStack } from '@/components/ui/hstack';
import { Button, ButtonText } from '@/components/ui/button';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';

export function ActionToolbar() {
  const { openAddPostazioneSheet, openNewClienteSheet } = usePiscinaSheets();

  return (
    <HStack space="sm" className="flex-wrap">
      <Button size="sm" onPress={openAddPostazioneSheet}>
        <ButtonText>+ Aggiungi postazione</ButtonText>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-2 border-emerald-400 bg-emerald-50"
        onPress={openNewClienteSheet}
      >
        <ButtonText className="font-semibold text-emerald-800">+ Nuovo cliente</ButtonText>
      </Button>
    </HStack>
  );
}
