import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ClockIcon, Icon } from '@/components/ui/icon';
import type { PiscinaSheetsValue } from '../../../../context/PiscinaSheetsContext';

// Non chiama usePiscinaSheets() da sé: è un figlio di <Actionsheet>, teleportato fuori
// dall'albero del Provider da gluestack-ui (vedi il commento in PostazioneSheet.tsx).
export function AssignPostazioneForm({ sheets }: Readonly<{ sheets: PiscinaSheetsValue }>) {
  const {
    isPastDate,
    targetPostazione,
    clientiSelezionabiliPerTarget,
    sheetForm,
    maxLettini,
    maxSdraie,
    sheetError,
    isSubmittingSheet,
    confirmAssign,
    setIsClientPickerOpen,
    handleDeletePostazione,
    updateSheetForm,
  } = sheets;

  if (!targetPostazione) return null;

  return (
    <>
      <Heading size="md">Assegna postazione #{targetPostazione.numero}</Heading>

      {isPastDate ? (
        <Text size="sm" className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
          Sola lettura: le postazioni non sono modificabili per un giorno passato.
        </Text>
      ) : null}

      {clientiSelezionabiliPerTarget.length === 0 ? (
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
            disabled={isPastDate}
            className={`flex-row items-center justify-between rounded-md border-2 border-sky-300 bg-white px-3 py-2.5 ${isPastDate ? 'opacity-50' : ''}`}
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

      {clientiSelezionabiliPerTarget.length > 0 ? (
        <>
          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Orario di arrivo previsto
            </Text>
            <Box className="flex-row items-center gap-2 rounded-md border-2 border-sky-100 bg-sky-50 px-3 py-2.5">
              <Icon as={ClockIcon} size="sm" className="text-sky-700" />
              <Text size="sm" className="font-semibold text-sky-900">
                {sheetForm.orarioArrivo || '—'}
              </Text>
            </Box>
            <Text size="2xs" className="text-muted-foreground">
              Impostato dall'orario scelto al momento della prenotazione — non modificabile da qui.
            </Text>
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
          <Button onPress={confirmAssign} disabled={isSubmittingSheet || isPastDate}>
            {isSubmittingSheet ? <ButtonSpinner /> : <ButtonText>Assegna</ButtonText>}
          </Button>
        </>
      ) : null}
      <Button
        variant="outline"
        className="border-2 border-destructive bg-destructive/10"
        onPress={() => handleDeletePostazione(targetPostazione)}
        disabled={isPastDate}
      >
        <ButtonText className="font-semibold text-destructive">Elimina postazione</ButtonText>
      </Button>
    </>
  );
}
