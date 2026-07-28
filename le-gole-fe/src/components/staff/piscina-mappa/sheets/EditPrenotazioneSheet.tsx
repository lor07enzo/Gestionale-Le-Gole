import { Box } from '@/components/ui/box';
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
import { usePiscinaMappaData } from '../../../../context/PiscinaMappaDataContext';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';
import {
  formatOrarioInput,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
} from '../../../../utils/piscinaMappa';

export function EditPrenotazioneSheet() {
  const { inventario } = usePiscinaMappaData();
  const {
    isPastDate,
    editingPrenotazione,
    editForm,
    updateEditForm,
    editError,
    isSubmittingEdit,
    confirmEditPrenotazione,
    closeEditPrenotazione,
    confirmPrenotazione,
    confirmingPrenotazioneId,
  } = usePiscinaSheets();

  const isPending = editingPrenotazione?.stato === 'PENDING';
  const isConfirming = editingPrenotazione ? confirmingPrenotazioneId === editingPrenotazione.id : false;

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
            <HStack space="sm" className="items-center justify-between">
              <Heading size="md" className="flex-1">
                Modifica prenotazione — {editingPrenotazione?.cliente_nome}
              </Heading>
              {editingPrenotazione ? (
                <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[editingPrenotazione.stato].bg}`}>
                  <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[editingPrenotazione.stato].text}`}>
                    {STATO_PRENOTAZIONE_LABEL[editingPrenotazione.stato]}
                  </Text>
                </Box>
              ) : null}
            </HStack>
            <Text size="xs" className="text-muted-foreground">
              Nome e telefono si modificano dall'anagrafica cliente, non da qui.
            </Text>
            {isPastDate ? (
              <Text size="sm" className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                Sola lettura: le prenotazioni non sono modificabili per un giorno passato.
              </Text>
            ) : null}
            {isPending && !isPastDate ? (
              <Box className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <Text size="xs" className="text-amber-800">
                  Prenotazione effettuata online, in attesa di conferma da parte dello staff.
                </Text>
                <Button
                  size="sm"
                  className="mt-2 bg-emerald-600 active:bg-emerald-700"
                  onPress={() => editingPrenotazione && confirmPrenotazione(editingPrenotazione)}
                  disabled={isConfirming}
                >
                  {isConfirming ? <ButtonSpinner /> : <ButtonText>Conferma prenotazione</ButtonText>}
                </Button>
              </Box>
            ) : null}

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Note
              </Text>
              <Input>
                <InputField
                  placeholder="Es. allergie, richieste particolari..."
                  value={editForm.note}
                  onChangeText={(text) => updateEditForm({ note: text })}
                />
              </Input>
            </VStack>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Orario
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 15:30"
                  keyboardType="numeric"
                  maxLength={5}
                  value={editForm.ora}
                  onChangeText={(text) => updateEditForm({ ora: formatOrarioInput(editForm.ora, text) })}
                />
              </Input>
            </VStack>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Ingressi interi
              </Text>
              <Input>
                <InputField
                  keyboardType="numeric"
                  value={editForm.ingressi}
                  onChangeText={(text) => updateEditForm({ ingressi: text })}
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
                    value={editForm.ingressiRidotti}
                    onChangeText={(text) => updateEditForm({ ingressiRidotti: text })}
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
                      value={editForm.ingressiBambini}
                      onChangeText={(text) => updateEditForm({ ingressiBambini: text })}
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
                      value={editForm.ingressiGratuiti}
                      onChangeText={(text) => updateEditForm({ ingressiGratuiti: text })}
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
            <Button onPress={confirmEditPrenotazione} disabled={isSubmittingEdit || isPastDate}>
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
