import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { AddIcon, RemoveIcon } from '@/components/ui/icon';
import type { PiscinaSheetsValue } from '../../../../context/PiscinaSheetsContext';

// Numeri contigui mostrati come intervallo compatto, altrimenti elencati singolarmente. La
// differenza assoluta (non solo +1) riconosce come contiguo anche l'ordine decrescente.
function formatNumeriPreview(numeri: number[]): string {
  if (numeri.length === 0) return '—';
  if (numeri.length === 1) return `#${numeri[0]}`;
  const contigui = numeri.every((n, i) => i === 0 || Math.abs(n - numeri[i - 1]) === 1);
  return contigui
    ? `da #${numeri[0]} a #${numeri[numeri.length - 1]} (${numeri.length} postazioni)`
    : numeri.map((n) => `#${n}`).join(', ');
}

// Non chiama usePiscinaSheets() da sé: è un figlio di <Actionsheet>, teleportato fuori
// dall'albero del Provider da gluestack-ui (vedi il commento in PostazioneSheet.tsx).
export function AddPostazioneForm({ sheets }: Readonly<{ sheets: PiscinaSheetsValue }>) {
  const {
    newTipo,
    setNewTipo,
    newNumero,
    newQuantita,
    setNewQuantita,
    newOrientamento,
    setNewOrientamento,
    newOrdineNumeri,
    setNewOrdineNumeri,
    newNumeriPreview,
    capacitaOmbrelloni,
    capacitaGazebi,
    sheetError,
    isSubmittingSheet,
    confirmAddPostazione,
  } = sheets;

  const capacita = newTipo === 'OMBRELLONE' ? capacitaOmbrelloni : capacitaGazebi;
  const postiResidui = Math.max(capacita.totale - capacita.usati, 0);
  // Creazione in blocco solo per i gazebi: per un ombrellone la quantità è sempre 1.
  const isGazebo = newTipo === 'GAZEBO';
  const quantita = isGazebo ? Number.parseInt(newQuantita, 10) || 1 : 1;
  const limiteRaggiunto = postiResidui <= 0 || quantita > postiResidui;

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

      {isGazebo ? (
        <VStack space="sm" className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <Text size="sm" className="font-medium text-sky-900">
            Posiziona più gazebi in una volta
          </Text>
          <Text size="2xs" className="text-sky-900/70">
            Scegli quanti gazebi aggiungere, se metterli in colonna (verticale) o in riga
            (orizzontale) e se numerarli in ordine crescente o decrescente: vengono piazzati uno
            dopo l'altro in automatico, come un unico blocco che si sposta sempre tutto insieme
            (non si divide né si unisce trascinando un singolo gazebo).
          </Text>
          <HStack space="sm" className="items-center">
            <Text size="sm" className="flex-1 font-medium">
              Quantità
            </Text>
            <HStack space="xs" className="items-center">
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full border-2 border-sky-300 bg-white"
                onPress={() => setNewQuantita(String(Math.max(1, quantita - 1)))}
                disabled={quantita <= 1}
                accessibilityLabel="Diminuisci quantità gazebi"
              >
                <ButtonIcon as={RemoveIcon} className="text-sky-900" />
              </Button>
              <Text size="md" className="w-8 text-center font-bold text-sky-900">
                {quantita}
              </Text>
              <Button
                size="icon"
                variant="outline"
                className="h-9 w-9 rounded-full border-2 border-sky-300 bg-white"
                onPress={() => setNewQuantita(String(quantita + 1))}
                disabled={quantita >= postiResidui}
                accessibilityLabel="Aumenta quantità gazebi"
              >
                <ButtonIcon as={AddIcon} className="text-sky-900" />
              </Button>
            </HStack>
          </HStack>
          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Orientamento
            </Text>
            <HStack space="sm">
              <Button
                size="sm"
                className="flex-1"
                variant={newOrientamento === 'verticale' ? 'default' : 'outline'}
                onPress={() => setNewOrientamento('verticale')}
              >
                <ButtonText className={newOrientamento === 'verticale' ? '' : 'font-semibold text-sky-900'}>
                  ↕️ In colonna
                </ButtonText>
              </Button>
              <Button
                size="sm"
                className="flex-1"
                variant={newOrientamento === 'orizzontale' ? 'default' : 'outline'}
                onPress={() => setNewOrientamento('orizzontale')}
              >
                <ButtonText className={newOrientamento === 'orizzontale' ? '' : 'font-semibold text-sky-900'}>
                  ↔️ In riga
                </ButtonText>
              </Button>
            </HStack>
          </VStack>
          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Numerazione
            </Text>
            <HStack space="sm">
              <Button
                size="sm"
                className="flex-1"
                variant={newOrdineNumeri === 'crescente' ? 'default' : 'outline'}
                onPress={() => setNewOrdineNumeri('crescente')}
              >
                <ButtonText className={newOrdineNumeri === 'crescente' ? '' : 'font-semibold text-sky-900'}>
                  🔼 Crescenti
                </ButtonText>
              </Button>
              <Button
                size="sm"
                className="flex-1"
                variant={newOrdineNumeri === 'decrescente' ? 'default' : 'outline'}
                onPress={() => setNewOrdineNumeri('decrescente')}
              >
                <ButtonText className={newOrdineNumeri === 'decrescente' ? '' : 'font-semibold text-sky-900'}>
                  🔽 Decrescenti
                </ButtonText>
              </Button>
            </HStack>
          </VStack>
        </VStack>
      ) : null}

      <VStack space="xs">
        <Text size="sm" className="font-medium">
          {quantita > 1 ? 'Numeri assegnati' : 'Numero assegnato'}
        </Text>
        <Box className="min-h-9 w-full justify-center rounded-md border border-border bg-sky-50 px-3 py-2">
          <Text size="sm" className="font-semibold text-sky-900">
            {quantita > 1 ? formatNumeriPreview(newNumeriPreview) : `#${newNumero || '—'}`}
          </Text>
        </Box>
      </VStack>
      {limiteRaggiunto ? (
        <Text size="sm" className="text-center text-destructive">
          {postiResidui <= 0
            ? `Limite raggiunto: il listino prevede al massimo ${capacita.totale} ${
                newTipo === 'OMBRELLONE' ? 'ombrelloni' : 'gazebi'
              }.`
            : `Il listino prevede al massimo ${capacita.totale} ${
                newTipo === 'OMBRELLONE' ? 'ombrelloni' : 'gazebi'
              }: ne restano da posizionare solo ${postiResidui}.`}
        </Text>
      ) : null}
      {sheetError ? (
        <Text size="sm" className="text-center text-destructive">
          {sheetError}
        </Text>
      ) : null}
      <Button onPress={confirmAddPostazione} disabled={isSubmittingSheet || limiteRaggiunto}>
        {isSubmittingSheet ? (
          <ButtonSpinner />
        ) : (
          <ButtonText>{quantita > 1 ? `Aggiungi ${quantita} gazebi` : 'Aggiungi'}</ButtonText>
        )}
      </Button>
    </>
  );
}
