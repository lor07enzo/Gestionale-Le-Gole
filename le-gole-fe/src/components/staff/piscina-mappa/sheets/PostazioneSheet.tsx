import { VStack } from '@/components/ui/vstack';
import { Button, ButtonText } from '@/components/ui/button';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';
import { AddPostazioneForm } from './AddPostazioneForm';
import { AssignPostazioneForm } from './AssignPostazioneForm';
import { OccupantForm } from './OccupantForm';

// Foglio unico per i tre stati mutuamente esclusivi legati a una singola postazione: creazione,
// assegnazione a un cliente in attesa, o modifica dell'occupante già assegnato.
export function PostazioneSheet() {
  const { sheetMode, sheetAriaLabel, closeSheet } = usePiscinaSheets();

  return (
    <Actionsheet isOpen={sheetMode !== null} onClose={closeSheet}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label={sheetAriaLabel}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6">
            {sheetMode === 'add-postazione' ? <AddPostazioneForm /> : null}
            {sheetMode === 'assign' ? <AssignPostazioneForm /> : null}
            {sheetMode === 'occupant' ? <OccupantForm /> : null}

            <Button variant="link" onPress={closeSheet}>
              <ButtonText>Annulla</ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
