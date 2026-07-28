import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import type { PiscinaSheetsValue } from '../../../../context/PiscinaSheetsContext';
import { formatOrarioInput } from '../../../../utils/piscinaMappa';

// Non chiama usePiscinaSheets() da sé: è un figlio di <Actionsheet>, teleportato fuori
// dall'albero del Provider da gluestack-ui (vedi il commento in PostazioneSheet.tsx).
export function OccupantForm({ sheets }: Readonly<{ sheets: PiscinaSheetsValue }>) {
  const {
    isPastDate,
    targetPostazione,
    sheetForm,
    updateSheetForm,
    maxLettini,
    maxSdraie,
    sheetError,
    isSubmittingSheet,
    confirmOccupantEdit,
    liberaPostazione,
  } = sheets;

  if (!targetPostazione) return null;

  return (
    <>
      <Heading size="md">Postazione #{targetPostazione.numero}</Heading>
      {isPastDate ? (
        <Text size="sm" className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          Sola lettura: le assegnazioni non sono modificabili per un giorno passato.
        </Text>
      ) : null}
      <VStack space="xs">
        <Text size="sm" className="font-medium">
          Nome cliente
        </Text>
        <Input isDisabled={isPastDate}>
          <InputField
            placeholder="Nome e cognome"
            value={sheetForm.clienteNome}
            onChangeText={(text) => updateSheetForm({ clienteNome: text })}
            editable={!isPastDate}
          />
        </Input>
      </VStack>
      <VStack space="xs">
        <Text size="sm" className="font-medium">
          Orario di arrivo previsto
        </Text>
        <Input isDisabled={isPastDate}>
          <InputField
            placeholder="Es. 15:30"
            keyboardType="numeric"
            maxLength={5}
            value={sheetForm.orarioArrivo}
            onChangeText={(text) =>
              updateSheetForm({ orarioArrivo: formatOrarioInput(sheetForm.orarioArrivo, text) })
            }
            editable={!isPastDate}
          />
        </Input>
      </VStack>
      <HStack space="sm">
        <VStack space="xs" className="flex-1">
          <Text size="sm" className="font-medium">
            Lettini{maxLettini !== null ? ` (max ${maxLettini})` : ''}
          </Text>
          <Input isDisabled={isPastDate}>
            <InputField
              keyboardType="numeric"
              value={sheetForm.lettini}
              onChangeText={(text) => updateSheetForm({ lettini: text })}
              editable={!isPastDate}
            />
          </Input>
        </VStack>
        <VStack space="xs" className="flex-1">
          <Text size="sm" className="font-medium">
            Sdraie{maxSdraie !== null ? ` (max ${maxSdraie})` : ''}
          </Text>
          <Input isDisabled={isPastDate}>
            <InputField
              keyboardType="numeric"
              value={sheetForm.sdraie}
              onChangeText={(text) => updateSheetForm({ sdraie: text })}
              editable={!isPastDate}
            />
          </Input>
        </VStack>
      </HStack>
      {sheetError ? (
        <Text size="sm" className="text-center text-destructive">
          {sheetError}
        </Text>
      ) : null}
      <Button onPress={confirmOccupantEdit} disabled={isSubmittingSheet || isPastDate}>
        {isSubmittingSheet ? <ButtonSpinner /> : <ButtonText>Salva modifiche</ButtonText>}
      </Button>
      <Button
        variant="outline"
        className="border-2 border-destructive bg-destructive/10"
        onPress={liberaPostazione}
        disabled={isPastDate}
      >
        <ButtonText className="font-semibold text-destructive">Libera postazione</ButtonText>
      </Button>
    </>
  );
}
