import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import type { PiscinaSheetsValue } from '../../../../context/PiscinaSheetsContext';

// Non chiama usePiscinaSheets() da sé: è un figlio di <Actionsheet>, teleportato fuori
// dall'albero del Provider da gluestack-ui (vedi il commento in PostazioneSheet.tsx).
export function AddPostazioneForm({ sheets }: Readonly<{ sheets: PiscinaSheetsValue }>) {
  const {
    newTipo,
    setNewTipo,
    newNumero,
    setNewNumero,
    sheetError,
    isSubmittingSheet,
    confirmAddPostazione,
  } = sheets;

  return (
    <>
      <Heading size="md">Nuova postazione</Heading>
      <HStack space="sm">
        <Button
          size="sm"
          variant={newTipo === 'OMBRELLONE' ? 'default' : 'outline'}
          className={`flex-1 ${newTipo === 'OMBRELLONE' ? '' : 'border-2 border-sky-300'}`}
          onPress={() => setNewTipo('OMBRELLONE')}
        >
          <ButtonText className={newTipo === 'OMBRELLONE' ? '' : 'font-semibold text-sky-900'}>
            ⛱️ Ombrellone
          </ButtonText>
        </Button>
        <Button
          size="sm"
          variant={newTipo === 'GAZEBO' ? 'default' : 'outline'}
          className={`flex-1 ${newTipo === 'GAZEBO' ? '' : 'border-2 border-sky-300'}`}
          onPress={() => setNewTipo('GAZEBO')}
        >
          <ButtonText className={newTipo === 'GAZEBO' ? '' : 'font-semibold text-sky-900'}>
            ⛺ Gazebo
          </ButtonText>
        </Button>
      </HStack>
      <VStack space="xs">
        <Text size="sm" className="font-medium">
          Numero
        </Text>
        <Input>
          <InputField
            keyboardType="numeric"
            placeholder="Es. 12"
            value={newNumero}
            onChangeText={setNewNumero}
          />
        </Input>
      </VStack>
      {sheetError ? (
        <Text size="sm" className="text-center text-destructive">
          {sheetError}
        </Text>
      ) : null}
      <Button onPress={confirmAddPostazione} disabled={isSubmittingSheet}>
        {isSubmittingSheet ? <ButtonSpinner /> : <ButtonText>Aggiungi</ButtonText>}
      </Button>
    </>
  );
}
