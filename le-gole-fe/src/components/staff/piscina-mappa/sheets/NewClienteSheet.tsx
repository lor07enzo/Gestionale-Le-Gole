import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ClockIcon, Icon, PhoneIcon } from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { usePiscinaMappaData } from '../../../../context/PiscinaMappaDataContext';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';
import { formatOrarioInput } from '../../../../utils/piscinaMappa';

function RequiredLabel({ children }: Readonly<{ children: string }>) {
  return (
    <HStack space="xs" className="items-center">
      <Text size="sm" className="font-medium">
        {children}
      </Text>
      <Text size="xs" className="text-destructive">
        *
      </Text>
    </HStack>
  );
}

export function NewClienteSheet() {
  const { inventario } = usePiscinaMappaData();
  const {
    isPastDate,
    isNewClienteSheetOpen,
    newClienteForm,
    updateNewClienteForm,
    newClienteError,
    isSubmittingNewCliente,
    confirmCreateCliente,
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
              Crea l'anagrafica e una prenotazione già confermata: se prenota ombrellone o gazebo,
              resterà selezionato per assegnarlo subito a una postazione libera sulla mappa.
            </Text>

            <VStack space="sm" className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
              <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                Dati cliente
              </Text>

              <VStack space="xs">
                <RequiredLabel>Nome cliente</RequiredLabel>
                <Input>
                  <InputField
                    placeholder="Nome e cognome"
                    value={newClienteForm.nome}
                    onChangeText={(text) => updateNewClienteForm({ nome: text })}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Icon as={PhoneIcon} size="sm" className="text-sky-700" />
                  <Text size="sm" className="font-medium">
                    Telefono
                  </Text>
                  <Text size="xs" className="text-destructive">
                    *
                  </Text>
                </HStack>
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
                <HStack space="xs" className="items-center">
                  <Text size="sm" className="font-medium">
                    Note
                  </Text>
                  <Text size="xs" className="text-muted-foreground">
                    (opzionale)
                  </Text>
                </HStack>
                <Input>
                  <InputField
                    placeholder="Es. allergie, richieste particolari..."
                    value={newClienteForm.note}
                    onChangeText={(text) => updateNewClienteForm({ note: text })}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <HStack space="xs" className="items-center">
                  <Icon as={ClockIcon} size="sm" className="text-sky-700" />
                  <Text size="sm" className="font-medium">
                    Orario di arrivo previsto
                  </Text>
                  <Text size="xs" className="text-destructive">
                    *
                  </Text>
                </HStack>
                <Input>
                  <InputField
                    placeholder="Es. 15:30"
                    keyboardType="numeric"
                    maxLength={5}
                    value={newClienteForm.orarioArrivo}
                    onChangeText={(text) =>
                      updateNewClienteForm({ orarioArrivo: formatOrarioInput(newClienteForm.orarioArrivo, text) })
                    }
                  />
                </Input>
              </VStack>
            </VStack>

            <VStack space="sm" className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
              <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                Cosa prenota
              </Text>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Ingressi interi
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={newClienteForm.ingressi}
                    onChangeText={(text) => updateNewClienteForm({ ingressi: text })}
                  />
                </Input>
              </VStack>
              {inventario && Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0 ? (
                <VStack space="xs">
                  <Text size="sm" className="font-medium">
                    Ingressi ridotti (dalle {inventario.orario_inizio_ridotto.slice(0, 5)})
                  </Text>
                  <Input>
                    <InputField
                      keyboardType="numeric"
                      value={newClienteForm.ingressiRidotti}
                      onChangeText={(text) => updateNewClienteForm({ ingressiRidotti: text })}
                    />
                  </Input>
                </VStack>
              ) : null}
              {inventario && Number.parseFloat(inventario.prezzo_ingresso_bambino) > 0 ? (
                <>
                  <VStack space="xs">
                    <Text size="sm" className="font-medium">
                      Ingressi bambini ({inventario.eta_minima_bambino}-{inventario.eta_massima_bambino} anni)
                    </Text>
                    <Input>
                      <InputField
                        keyboardType="numeric"
                        value={newClienteForm.ingressiBambini}
                        onChangeText={(text) => updateNewClienteForm({ ingressiBambini: text })}
                      />
                    </Input>
                  </VStack>
                  <VStack space="xs">
                    <Text size="sm" className="font-medium">
                      Ingressi gratuiti (sotto {inventario.eta_minima_bambino} anni)
                    </Text>
                    <Input>
                      <InputField
                        keyboardType="numeric"
                        value={newClienteForm.ingressiGratuiti}
                        onChangeText={(text) => updateNewClienteForm({ ingressiGratuiti: text })}
                      />
                    </Input>
                  </VStack>
                </>
              ) : null}
              <HStack space="sm">
                <VStack space="xs" className="flex-1">
                  <Text size="sm" className="font-medium">
                    Ombrelloni
                  </Text>
                  <Input>
                    <InputField
                      keyboardType="numeric"
                      value={newClienteForm.ombrellone}
                      onChangeText={(text) => updateNewClienteForm({ ombrellone: text })}
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
                      value={newClienteForm.gazebo}
                      onChangeText={(text) => updateNewClienteForm({ gazebo: text })}
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
                      value={newClienteForm.lettino}
                      onChangeText={(text) => updateNewClienteForm({ lettino: text })}
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
                      value={newClienteForm.sdraia}
                      onChangeText={(text) => updateNewClienteForm({ sdraia: text })}
                    />
                  </Input>
                </VStack>
              </HStack>
            </VStack>

            {newClienteError ? (
              <Text size="sm" className="text-center text-destructive">
                {newClienteError}
              </Text>
            ) : null}
            <Button onPress={confirmCreateCliente} disabled={isSubmittingNewCliente || isPastDate}>
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
