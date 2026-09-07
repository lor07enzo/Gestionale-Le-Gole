import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { AddIcon, Icon, RemoveIcon, TrashIcon } from '@/components/ui/icon';
import {
  createNoleggioRacchetta,
  deleteNoleggioRacchetta,
  listRacchettePadel,
  updateNoleggioRacchetta,
  type NoleggioRacchetta,
  type RacchettaPadel,
} from '../../../services/padel';
import { formatPrezzo } from '../../../utils/prezzi';
import { racchetteNoleggiate } from '../../../utils/padel';
import { extractErrorMessage } from '../../../utils/errors';

function avvisa(messaggio: string) {
  if (Platform.OS === 'web') {
    window.alert(messaggio);
  } else {
    Alert.alert('Errore', messaggio);
  }
}

type NoleggiRacchetteEditorProps = {
  prenotazioneId: string;
  noleggi: NoleggioRacchetta[];
  partecipanti: number;
  onChange: (next: NoleggioRacchetta[]) => void;
  readOnly?: boolean;
};

// Ogni modifica si salva subito, senza un pulsante "Salva": stesso two-tier già usato per le
// righe di un ordine asporto, dove i campi della prenotazione hanno un salvataggio esplicito e le
// righe no. Il tetto è il numero di partecipanti (non ha senso più racchette che giocatori) e i
// pezzi posseduti per marca — entrambi rivalidati comunque dal backend.
export function NoleggiRacchetteEditor({
  prenotazioneId,
  noleggi,
  partecipanti,
  onChange,
  readOnly = false,
}: Readonly<NoleggiRacchetteEditorProps>) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [catalogo, setCatalogo] = useState<RacchettaPadel[]>([]);
  const [isLoadingCatalogo, setIsLoadingCatalogo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!isPickerOpen || catalogo.length > 0) return;
    setIsLoadingCatalogo(true);
    listRacchettePadel()
      .then(setCatalogo)
      .catch(() => avvisa('Impossibile caricare il catalogo racchette.'))
      .finally(() => setIsLoadingCatalogo(false));
  }, [isPickerOpen, catalogo.length]);

  const totaleNoleggiate = racchetteNoleggiate(noleggi);
  const residuo = partecipanti - totaleNoleggiate;

  const giaNelleRighe = useMemo(() => new Set(noleggi.map((riga) => riga.racchetta)), [noleggi]);

  const handleAggiungi = async (racchetta: RacchettaPadel) => {
    setIsPickerOpen(false);
    setBusyId(racchetta.id);
    try {
      const creata = await createNoleggioRacchetta({
        prenotazione: prenotazioneId,
        racchetta: racchetta.id,
        quantita: 1,
      });
      onChange([...noleggi, creata]);
    } catch (err) {
      avvisa(extractErrorMessage(err, 'Impossibile aggiungere la racchetta.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleQuantita = async (riga: NoleggioRacchetta, prossima: number) => {
    if (prossima < 1) return;
    setBusyId(riga.id);
    try {
      const aggiornata = await updateNoleggioRacchetta(riga.id, prossima);
      onChange(noleggi.map((r) => (r.id === aggiornata.id ? aggiornata : r)));
    } catch (err) {
      avvisa(extractErrorMessage(err, 'Impossibile aggiornare il noleggio.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleRimuovi = async (riga: NoleggioRacchetta) => {
    setBusyId(riga.id);
    try {
      await deleteNoleggioRacchetta(riga.id);
      onChange(noleggi.filter((r) => r.id !== riga.id));
    } catch (err) {
      avvisa(extractErrorMessage(err, 'Impossibile rimuovere il noleggio.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <VStack space="sm" className="w-full">
      <HStack space="sm" className="items-center justify-between">
        <Heading size="sm">Racchette noleggiate</Heading>
        <Text size="2xs" className="text-muted-foreground">
          {totaleNoleggiate}/{partecipanti}
        </Text>
      </HStack>

      {noleggi.length === 0 ? (
        <Text size="xs" className="text-muted-foreground">
          Nessuna racchetta noleggiata per questa partita.
        </Text>
      ) : (
        <VStack space="xs" className="w-full">
          {noleggi.map((riga) => {
            const isBusy = busyId === riga.id;
            return (
              <HStack
                key={riga.id}
                space="sm"
                className="w-full flex-wrap items-center justify-between rounded-xl border border-sky-100 bg-white px-3 py-2"
              >
                <VStack className="min-w-32 flex-1">
                  <Text size="sm" className="font-medium text-sky-900">
                    {riga.racchetta_nome}
                  </Text>
                  <Text size="2xs" className="text-muted-foreground">
                    € {formatPrezzo(riga.prezzo_unitario)} · subtotale € {formatPrezzo(riga.subtotale)}
                  </Text>
                </VStack>

                {readOnly ? (
                  <Text size="sm" className="font-bold text-sky-900">
                    ×{riga.quantita}
                  </Text>
                ) : (
                  <HStack space="xs" className="items-center">
                    <Pressable
                      onPress={() => handleQuantita(riga, riga.quantita - 1)}
                      disabled={isBusy || riga.quantita <= 1}
                      accessibilityRole="button"
                      accessibilityLabel={`Diminuisci ${riga.racchetta_nome}`}
                      className={`h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
                        riga.quantita <= 1 ? 'opacity-40' : 'active:bg-sky-50'
                      }`}
                    >
                      <Icon as={RemoveIcon} size="xs" className="text-sky-900" />
                    </Pressable>
                    <Text size="sm" className="w-6 text-center font-bold text-sky-900">
                      {riga.quantita}
                    </Text>
                    <Pressable
                      onPress={() => handleQuantita(riga, riga.quantita + 1)}
                      disabled={isBusy || residuo <= 0}
                      accessibilityRole="button"
                      accessibilityLabel={`Aumenta ${riga.racchetta_nome}`}
                      className={`h-10 w-10 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
                        residuo <= 0 ? 'opacity-40' : 'active:bg-sky-50'
                      }`}
                    >
                      <Icon as={AddIcon} size="xs" className="text-sky-900" />
                    </Pressable>
                    <Pressable
                      onPress={() => handleRimuovi(riga)}
                      disabled={isBusy}
                      accessibilityRole="button"
                      accessibilityLabel={`Rimuovi ${riga.racchetta_nome}`}
                      className="h-10 w-10 items-center justify-center rounded-full active:bg-rose-50"
                    >
                      {isBusy ? <Spinner size="small" /> : <Icon as={TrashIcon} size="sm" className="text-rose-600" />}
                    </Pressable>
                  </HStack>
                )}
              </HStack>
            );
          })}
        </VStack>
      )}

      {!readOnly ? (
        <>
          <Button
            size="sm"
            variant="outline"
            className="min-h-11 self-start border-2 border-sky-300 bg-white"
            onPress={() => setIsPickerOpen(true)}
            disabled={residuo <= 0}
            isDisabled={residuo <= 0}
          >
            <ButtonIcon as={AddIcon} className="text-sky-700" />
            <ButtonText className="text-sky-700">Aggiungi racchetta</ButtonText>
          </Button>
          {residuo <= 0 ? (
            <Text size="2xs" className="text-muted-foreground">
              Hai già una racchetta per ogni partecipante: aumenta i partecipanti per noleggiarne altre.
            </Text>
          ) : null}
        </>
      ) : null}

      <Actionsheet isOpen={isPickerOpen} onClose={() => setIsPickerOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[80vh]" aria-label="Scegli una racchetta">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetScrollView className="w-full">
            <VStack space="sm" className="w-full pb-6">
              <Heading size="md">Scegli una racchetta</Heading>

              {isLoadingCatalogo ? (
                <HStack className="items-center justify-center py-6">
                  <Spinner size="small" />
                </HStack>
              ) : null}

              {!isLoadingCatalogo && catalogo.length === 0 ? (
                <Text size="sm" className="text-muted-foreground">
                  Nessuna racchetta a catalogo. Aggiungine una dalla pagina Padel.
                </Text>
              ) : null}

              {catalogo.map((racchetta) => {
                const giaPresente = giaNelleRighe.has(racchetta.id);
                return (
                  <Pressable
                    key={racchetta.id}
                    onPress={() => !giaPresente && handleAggiungi(racchetta)}
                    disabled={giaPresente}
                    accessibilityRole="button"
                    accessibilityLabel={`Noleggia ${racchetta.nome}`}
                    className={`w-full rounded-xl border border-sky-100 bg-white px-4 py-3 ${
                      giaPresente ? 'opacity-40' : 'active:bg-sky-50'
                    }`}
                  >
                    <HStack className="items-center justify-between">
                      <VStack className="flex-1">
                        <Text size="sm" className="font-medium text-sky-900">
                          {racchetta.nome}
                        </Text>
                        <Text size="2xs" className="text-muted-foreground">
                          € {formatPrezzo(racchetta.prezzo_noleggio)} · {racchetta.quantita_disponibile} pezzi
                          {racchetta.disponibile ? '' : ' · nascosta online'}
                        </Text>
                      </VStack>
                      {giaPresente ? (
                        <Text size="2xs" className="font-bold text-sky-700">
                          già scelta
                        </Text>
                      ) : (
                        <Icon as={AddIcon} size="sm" className="text-sky-700" />
                      )}
                    </HStack>
                  </Pressable>
                );
              })}
            </VStack>
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
}
