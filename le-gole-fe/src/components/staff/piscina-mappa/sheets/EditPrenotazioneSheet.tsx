import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';

export function EditPrenotazioneSheet() {
  const {
    editingPrenotazione,
    editForm,
    updateEditForm,
    editError,
    isSubmittingEdit,
    confirmEditPrenotazione,
    closeEditPrenotazione,
  } = usePiscinaSheets();

  return (
    <Actionsheet isOpen={editingPrenotazione !== null} onClose={closeEditPrenotazione}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        className="max-h-[85vh]"
        aria-label={`Modifica prenotazione${editingPrenotazione ? ` di ${editingPrenotazione.cliente_nome}` : ''}`}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6">
            <Heading size="md">Modifica prenotazione — {editingPrenotazione?.cliente_nome}</Heading>
            <Text size="xs" className="text-muted-foreground">
              Nome e telefono si modificano dall'anagrafica cliente, non da qui.
            </Text>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Orario
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 15:30"
                  value={editForm.ora}
                  onChangeText={(text) => updateEditForm({ ora: text })}
                />
              </Input>
            </VStack>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Ingressi
              </Text>
              <Input>
                <InputField
                  keyboardType="numeric"
                  value={editForm.ingressi}
                  onChangeText={(text) => updateEditForm({ ingressi: text })}
                />
              </Input>
            </VStack>

            <HStack space="sm">
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Ombrelloni
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={editForm.ombrellone}
                    onChangeText={(text) => updateEditForm({ ombrellone: text })}
                  />
                </Input>
              </VStack>
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Gazebi
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={editForm.gazebo}
                    onChangeText={(text) => updateEditForm({ gazebo: text })}
                  />
                </Input>
              </VStack>
            </HStack>

            <HStack space="sm">
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Lettini
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={editForm.lettino}
                    onChangeText={(text) => updateEditForm({ lettino: text })}
                  />
                </Input>
              </VStack>
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Sdraie
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={editForm.sdraia}
                    onChangeText={(text) => updateEditForm({ sdraia: text })}
                  />
                </Input>
              </VStack>
            </HStack>

            {editError ? (
              <Text size="sm" className="text-center text-destructive">
                {editError}
              </Text>
            ) : null}
            <Button onPress={confirmEditPrenotazione} disabled={isSubmittingEdit}>
              {isSubmittingEdit ? <ButtonSpinner /> : <ButtonText>Salva modifiche</ButtonText>}
            </Button>
            <Button variant="link" onPress={closeEditPrenotazione}>
              <ButtonText>Annulla</ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
