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

export function NewClienteSheet() {
  const {
    isNewClienteSheetOpen,
    newClienteForm,
    updateNewClienteForm,
    newClienteError,
    isSubmittingNewCliente,
    confirmCreateWalkInCliente,
    closeNewClienteSheet,
  } = usePiscinaSheets();

  return (
    <Actionsheet isOpen={isNewClienteSheetOpen} onClose={closeNewClienteSheet}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label="Nuovo cliente">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6">
            <Heading size="md">Nuovo cliente</Heading>
            <Text size="xs" className="text-muted-foreground">
              Crea un cliente senza prenotazione (walk-in): resterà selezionato per assegnarlo subito a
              una postazione libera sulla mappa.
            </Text>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Nome cliente
              </Text>
              <Input>
                <InputField
                  placeholder="Nome e cognome"
                  value={newClienteForm.nome}
                  onChangeText={(text) => updateNewClienteForm({ nome: text })}
                />
              </Input>
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Telefono
              </Text>
              <Input>
                <InputField
                  keyboardType="phone-pad"
                  placeholder="Numero di telefono"
                  value={newClienteForm.telefono}
                  onChangeText={(text) => updateNewClienteForm({ telefono: text })}
                />
              </Input>
            </VStack>
            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Note (opzionale)
              </Text>
              <Input>
                <InputField
                  placeholder="Es. allergie, richieste particolari..."
                  value={newClienteForm.note}
                  onChangeText={(text) => updateNewClienteForm({ note: text })}
                />
              </Input>
            </VStack>

            {newClienteError ? (
              <Text size="sm" className="text-center text-destructive">
                {newClienteError}
              </Text>
            ) : null}
            <Button onPress={confirmCreateWalkInCliente} disabled={isSubmittingNewCliente}>
              {isSubmittingNewCliente ? <ButtonSpinner /> : <ButtonText>Crea cliente</ButtonText>}
            </Button>
            <Button variant="link" onPress={closeNewClienteSheet}>
              <ButtonText>Annulla</ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
