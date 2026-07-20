import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { usePiscinaSheets } from '../../../../context/PiscinaSheetsContext';

export function OccupantForm() {
  const {
    targetPostazione,
    sheetForm,
    updateSheetForm,
    sheetError,
    isSubmittingSheet,
    confirmOccupantEdit,
    liberaPostazione,
  } = usePiscinaSheets();

  if (!targetPostazione) return null;

  return (
    <>
      <Heading size="md">Postazione #{targetPostazione.numero}</Heading>
      <VStack space="xs">
        <Text size="sm" className="font-medium">
          Nome cliente
        </Text>
        <Input>
          <InputField
            placeholder="Nome e cognome"
            value={sheetForm.clienteNome}
            onChangeText={(text) => updateSheetForm({ clienteNome: text })}
          />
        </Input>
      </VStack>
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
      <Button onPress={confirmOccupantEdit} disabled={isSubmittingSheet}>
        {isSubmittingSheet ? <ButtonSpinner /> : <ButtonText>Salva modifiche</ButtonText>}
      </Button>
      <Button
        variant="outline"
        className="border-2 border-destructive bg-destructive/10"
        onPress={liberaPostazione}
      >
        <ButtonText className="font-semibold text-destructive">Libera postazione</ButtonText>
      </Button>
    </>
  );
}
