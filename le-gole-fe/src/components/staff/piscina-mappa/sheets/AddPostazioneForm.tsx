import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import type { PiscinaSheetsValue } from '../../../../context/PiscinaSheetsContext';

// Non chiama usePiscinaSheets() da sé: è un figlio di <Actionsheet>, teleportato fuori
// dall'albero del Provider da gluestack-ui (vedi il commento in PostazioneSheet.tsx).
export function AddPostazioneForm({ sheets }: Readonly<{ sheets: PiscinaSheetsValue }>) {
  const {
    newTipo,
    setNewTipo,
    newNumero,
    capacitaOmbrelloni,
    capacitaGazebi,
    sheetError,
    isSubmittingSheet,
    confirmAddPostazione,
  } = sheets;

  const capacita = newTipo === 'OMBRELLONE' ? capacitaOmbrelloni : capacitaGazebi;
  const limiteRaggiunto = capacita.usati >= capacita.totale;

  return (
    <>
      <VStack space="xs">
        <Heading size="md">Nuova postazione</Heading>
        <Text size="xs" className="text-sky-900/70">
          Scegli se è un ombrellone o un gazebo: il numero viene assegnato in automatico (il primo
          libero) e la postazione compare al centro della mappa, pronta da trascinare nella
          posizione giusta.
        </Text>
      </VStack>
      <HStack space="sm">
        <VStack space="xs" className="flex-1">
          <Button
            size="sm"
            variant={newTipo === 'OMBRELLONE' ? 'default' : 'outline'}
            className={newTipo === 'OMBRELLONE' ? '' : 'border-2 border-sky-300'}
            onPress={() => setNewTipo('OMBRELLONE')}
          >
            <ButtonText className={newTipo === 'OMBRELLONE' ? '' : 'font-semibold text-sky-900'}>
              ⛱️ Ombrellone
            </ButtonText>
          </Button>
          <Text
            size="2xs"
            className={`text-center ${
              capacitaOmbrelloni.usati >= capacitaOmbrelloni.totale ? 'font-medium text-destructive' : 'text-muted-foreground'
            }`}
          >
            {capacitaOmbrelloni.usati}/{capacitaOmbrelloni.totale} posizionati
          </Text>
        </VStack>
        <VStack space="xs" className="flex-1">
          <Button
            size="sm"
            variant={newTipo === 'GAZEBO' ? 'default' : 'outline'}
            className={newTipo === 'GAZEBO' ? '' : 'border-2 border-sky-300'}
            onPress={() => setNewTipo('GAZEBO')}
          >
            <ButtonText className={newTipo === 'GAZEBO' ? '' : 'font-semibold text-sky-900'}>
              ⛺ Gazebo
            </ButtonText>
          </Button>
          <Text
            size="2xs"
            className={`text-center ${
              capacitaGazebi.usati >= capacitaGazebi.totale ? 'font-medium text-destructive' : 'text-muted-foreground'
            }`}
          >
            {capacitaGazebi.usati}/{capacitaGazebi.totale} posizionati
          </Text>
        </VStack>
      </HStack>
      <VStack space="xs">
        <Text size="sm" className="font-medium">
          Numero assegnato
        </Text>
        <Box className="min-h-9 w-full justify-center rounded-md border border-border bg-sky-50 px-3 py-2">
          <Text size="sm" className="font-semibold text-sky-900">
            #{newNumero || '—'}
          </Text>
        </Box>
      </VStack>
      {limiteRaggiunto ? (
        <Text size="sm" className="text-center text-destructive">
          Limite raggiunto: il listino prevede al massimo {capacita.totale}{' '}
          {newTipo === 'OMBRELLONE' ? 'ombrelloni' : 'gazebi'}.
        </Text>
      ) : null}
      {sheetError ? (
        <Text size="sm" className="text-center text-destructive">
          {sheetError}
        </Text>
      ) : null}
      <Button onPress={confirmAddPostazione} disabled={isSubmittingSheet || limiteRaggiunto}>
        {isSubmittingSheet ? <ButtonSpinner /> : <ButtonText>Aggiungi</ButtonText>}
      </Button>
    </>
  );
}
