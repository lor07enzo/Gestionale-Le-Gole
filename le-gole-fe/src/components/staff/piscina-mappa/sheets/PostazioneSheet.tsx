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
//
// I tre form sotto sono figli di <Actionsheet>, che gluestack-ui monta tramite un
// OverlayProvider "teleportato" vicino alla radice dell'app (fuori dall'albero di
// PiscinaSheetsProvider, scoped a questa sola schermata) — se quei form chiamassero
// usePiscinaSheets() da sé, l'hook non troverebbe il Provider. PostazioneSheet, invece, è
// instanziato direttamente dentro PiscinaMappaContent (posizione corretta nell'albero): legge
// il context qui e passa il valore già risolto come prop.
export function PostazioneSheet() {
  const sheets = usePiscinaSheets();
  const { sheetMode, sheetAriaLabel, closeSheet } = sheets;

  return (
    <Actionsheet isOpen={sheetMode !== null} onClose={closeSheet}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label={sheetAriaLabel}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6">
            {sheetMode === 'add-postazione' ? <AddPostazioneForm sheets={sheets} /> : null}
            {sheetMode === 'assign' ? <AssignPostazioneForm sheets={sheets} /> : null}
            {sheetMode === 'occupant' ? <OccupantForm sheets={sheets} /> : null}

            <Button variant="link" onPress={closeSheet}>
              <ButtonText>Annulla</ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
