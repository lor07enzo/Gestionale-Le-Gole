import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { usePiscinaSelection } from '../../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';

export function AssignPostazioneForm() {
  const { selectedWalkInCliente } = usePiscinaSelection();
  const {
    targetPostazione,
    clientiSelezionabiliPerTarget,
    sheetForm,
    updateSheetForm,
    sheetError,
    isSubmittingSheet,
    confirmAssign,
    setIsClientPickerOpen,
    handleDeletePostazione,
  } = usePiscinaSheets();

  if (!targetPostazione) return null;

  return (
    <>
      <Heading size="md">Assegna postazione #{targetPostazione.numero}</Heading>

      {selectedWalkInCliente ? (
        <VStack space="xs">
          <Text size="sm" className="font-medium">
            Cliente
          </Text>
          <Box className="rounded-md border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5">
            <Text size="sm" className="font-semibold text-sky-900">
              {selectedWalkInCliente.nome}
            </Text>
            <Text size="xs" className="text-muted-foreground">
              {selectedWalkInCliente.telefono}
            </Text>
          </Box>
        </VStack>
      ) : clientiSelezionabiliPerTarget.length === 0 ? (
        <Text size="sm" className="text-muted-foreground">
          Nessun cliente in attesa per questa postazione. Seleziona una prenotazione dal pannello "Da
          assegnare", oppure crea un nuovo cliente con "+ Nuovo cliente" prima di toccare la mappa.
        </Text>
      ) : (
        <VStack space="xs">
          <Text size="sm" className="font-medium">
            Cliente
          </Text>
          <Pressable
            onPress={() => setIsClientPickerOpen(true)}
            className="flex-row items-center justify-between rounded-md border-2 border-sky-300 bg-white px-3 py-2.5"
          >
            <VStack>
              <Text
                size="sm"
                className={sheetForm.clienteNome ? 'font-semibold text-sky-900' : 'text-muted-foreground'}
              >
                {sheetForm.clienteNome || 'Seleziona cliente'}
              </Text>
              {sheetForm.clienteTelefono ? (
                <Text size="xs" className="text-muted-foreground">
                  {sheetForm.clienteTelefono}
                </Text>
              ) : null}
            </VStack>
            <Text size="sm" className="font-bold text-sky-900">
              ▾
            </Text>
          </Pressable>
        </VStack>
      )}

      {selectedWalkInCliente || clientiSelezionabiliPerTarget.length > 0 ? (
        <>
          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Orario di arrivo previsto
            </Text>
            <Input>
              <InputField
                placeholder="Es. 15:30"
                value={sheetForm.orarioArrivo}
                onChangeText={(text) => updateSheetForm({ orarioArrivo: text })}
              />
            </Input>
          </VStack>

          <HStack space="sm">
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Lettini
              </Text>
              <Input>
                <InputField
                  keyboardType="numeric"
                  value={sheetForm.lettini}
                  onChangeText={(text) => updateSheetForm({ lettini: text })}
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
                  value={sheetForm.sdraie}
                  onChangeText={(text) => updateSheetForm({ sdraie: text })}
                />
              </Input>
            </VStack>
          </HStack>
          {sheetError ? (
            <Text size="sm" className="text-center text-destructive">
              {sheetError}
            </Text>
          ) : null}
          <Button onPress={confirmAssign} disabled={isSubmittingSheet}>
            {isSubmittingSheet ? <ButtonSpinner /> : <ButtonText>Assegna</ButtonText>}
          </Button>
        </>
      ) : null}
      <Button
        variant="outline"
        className="border-2 border-destructive bg-destructive/10"
        onPress={() => handleDeletePostazione(targetPostazione)}
      >
        <ButtonText className="font-semibold text-destructive">Elimina postazione</ButtonText>
      </Button>
    </>
  );
}
