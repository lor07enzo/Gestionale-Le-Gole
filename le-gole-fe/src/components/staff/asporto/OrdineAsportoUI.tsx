import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import {
  AddIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  EditIcon,
  Icon,
  PhoneIcon,
  RemoveIcon,
  SearchIcon,
  SlashIcon,
  TrashIcon,
} from '@/components/ui/icon';
import {
  updatePrenotazioneAsporto,
  type PrenotazioneAsporto,
} from '../../../services/prenotazioni';
import {
  createVoceOrdine,
  deleteVoceOrdine,
  getConfigurazioneAsporto,
  listProdotti,
  updateVoceOrdine,
  type ConfigurazioneAsporto,
  type Prodotto,
  type VoceOrdine,
} from '../../../services/menu';
import {
  formatOrarioInput,
  formatTime,
  generaSlotOrario,
  parseHHMMToMinutes,
  raggruppaSlotPerOra,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  type BloccoOrario,
} from '../../../utils/piscinaMappa';
import { formatPrezzo } from '../../../utils/prezzi';
import { extractErrorMessage } from '../../../utils/errors';

// Pezzi condivisi tra "Storico Ordini" (app/staff/asporto/ordini.tsx, per giorno) e la scheda
// cliente (app/staff/clienti/[clienteId].tsx, storico completo su più giorni) — stessa card
// ordine, stesso foglio di modifica orario/note/prodotti, stesso picker prodotti. Estratti qui
// invece di duplicati identici in entrambi i file: la logica di editing righe ordine (stepper
// quantità, aggiunta/rimozione prodotto, salvataggio isolato per azione) è sostanziosa abbastanza
// da giustificare un modulo condiviso, a differenza di un piccolo helper.

// Re-esportata per non rompere i chiamanti (`app/staff/clienti/[clienteId].tsx`,
// `app/staff/asporto/ordini/[ordineId].tsx`) che la importano già da questo modulo condiviso —
// l'implementazione vera vive in `utils/errors.ts` dal 2026-08-26 (SonarQube, duplicazione).
export { extractErrorMessage };

export function calcolaTotale(voci: VoceOrdine[]): number {
  return voci.reduce((sum, voce) => sum + (Number.parseFloat(voce.subtotale) || 0), 0);
}

// Picker prodotti annidato nel foglio di modifica — catalogo caricato una sola volta
// all'apertura, filtrabile per nome. Tap su una riga aggiunge subito una VoceOrdine con
// quantità 1 (lo staff può poi correggerla con lo stepper della riga appena creata); il foglio
// resta aperto per aggiungere più prodotti di seguito, si chiude solo esplicitamente.
function AggiungiProdottoSheet({
  isOpen,
  prenotazioneId,
  onClose,
  onAdded,
}: Readonly<{
  isOpen: boolean;
  prenotazioneId: string | null;
  onClose: () => void;
  onAdded: (voce: VoceOrdine) => void;
}>) {
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsLoading(true);
    listProdotti()
      .then(setProdotti)
      .catch(() => setError('Impossibile caricare il catalogo prodotti.'))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  const filtrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prodotti;
    return prodotti.filter((p) => p.nome.toLowerCase().includes(q));
  }, [prodotti, query]);

  const handleAdd = async (prodotto: Prodotto) => {
    if (!prenotazioneId) return;
    setAddingId(prodotto.id);
    setError(null);
    try {
      const voce = await createVoceOrdine({ prenotazione: prenotazioneId, prodotto: prodotto.id, quantita: 1 });
      onAdded(voce);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile aggiungere il prodotto.'));
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label="Aggiungi prodotto all'ordine">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6">
            <Heading size="md">Aggiungi prodotto</Heading>

            <Input>
              <InputSlot className="pl-3">
                <InputIcon as={SearchIcon} className="text-sky-400" />
              </InputSlot>
              <InputField placeholder="Cerca prodotto per nome..." value={query} onChangeText={setQuery} />
              {query ? (
                <InputSlot className="pr-3">
                  <Pressable onPress={() => setQuery('')} accessibilityLabel="Cancella ricerca">
                    <InputIcon as={CloseIcon} className="text-sky-400" />
                  </Pressable>
                </InputSlot>
              ) : null}
            </Input>

            {error ? (
              <Text size="sm" className="text-destructive">
                {error}
              </Text>
            ) : null}

            {isLoading ? (
              <HStack className="items-center justify-center py-6">
                <Spinner size="small" />
              </HStack>
            ) : filtrati.length === 0 ? (
              <Text size="sm" className="text-center text-muted-foreground">
                Nessun prodotto trovato.
              </Text>
            ) : (
              <VStack className="rounded-xl border border-sky-100">
                {filtrati.map((prodotto, index) => (
                  <HStack
                    key={prodotto.id}
                    space="sm"
                    className={`items-center justify-between px-3 py-2.5 ${
                      index === filtrati.length - 1 ? '' : 'border-b border-sky-100'
                    }`}
                  >
                    <VStack className="flex-1">
                      <Text size="sm" className="font-medium text-sky-900">
                        {prodotto.nome}
                      </Text>
                      <Text size="2xs" className="text-muted-foreground">
                        {prodotto.categoria_nome} · €{formatPrezzo(prodotto.prezzo)}
                      </Text>
                    </VStack>
                    <Pressable
                      onPress={() => handleAdd(prodotto)}
                      disabled={addingId === prodotto.id}
                      accessibilityLabel={`Aggiungi ${prodotto.nome} all'ordine`}
                      className="h-9 w-9 items-center justify-center rounded-full bg-sky-600 active:bg-sky-700"
                    >
                      {addingId === prodotto.id ? (
                        <Spinner size="small" />
                      ) : (
                        <Icon as={AddIcon} size="sm" className="text-white" />
                      )}
                    </Pressable>
                  </HStack>
                ))}
              </VStack>
            )}

            <Button variant="outline" className="border-2 border-sky-300 bg-white" onPress={onClose}>
              <ButtonText className="text-sky-700">Chiudi</ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

function VoceOrdineRow({
  voce,
  isBusy,
  isLast,
  onChangeQuantita,
  onRemove,
}: Readonly<{
  voce: VoceOrdine;
  isBusy: boolean;
  isLast: boolean;
  onChangeQuantita: (voce: VoceOrdine, next: number) => void;
  onRemove: (voce: VoceOrdine) => void;
}>) {
  return (
    <HStack
      space="sm"
      className={`items-center justify-between py-2 ${isLast ? '' : 'border-b border-sky-100'}`}
    >
      <VStack className="flex-1">
        <Text size="sm" className="font-medium text-sky-900">
          {voce.prodotto_nome}
        </Text>
        <Text size="2xs" className="text-muted-foreground">
          €{formatPrezzo(voce.prezzo_unitario)} x {voce.quantita} = €{formatPrezzo(voce.subtotale)}
        </Text>
      </VStack>
      <HStack space="xs" className="items-center">
        <Pressable
          onPress={() => onChangeQuantita(voce, voce.quantita - 1)}
          disabled={isBusy || voce.quantita <= 1}
          accessibilityLabel={`Diminuisci ${voce.prodotto_nome}`}
          className={`h-8 w-8 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
            voce.quantita <= 1 ? 'opacity-40' : ''
          }`}
        >
          <Icon as={RemoveIcon} size="xs" className="text-sky-900" />
        </Pressable>
        <Text size="sm" className="w-5 text-center font-bold text-sky-900">
          {voce.quantita}
        </Text>
        <Pressable
          onPress={() => onChangeQuantita(voce, voce.quantita + 1)}
          disabled={isBusy}
          accessibilityLabel={`Aumenta ${voce.prodotto_nome}`}
          className="h-8 w-8 items-center justify-center rounded-full border-2 border-sky-300 bg-white"
        >
          <Icon as={AddIcon} size="xs" className="text-sky-900" />
        </Pressable>
        <Pressable
          onPress={() => onRemove(voce)}
          disabled={isBusy}
          accessibilityLabel={`Rimuovi ${voce.prodotto_nome} dall'ordine`}
          className="h-8 w-8 items-center justify-center rounded-full active:bg-rose-50"
        >
          {isBusy ? <Spinner size="small" /> : <Icon as={TrashIcon} size="sm" className="text-rose-600" />}
        </Pressable>
      </HStack>
    </HStack>
  );
}

// Stesso picker a due livelli (fasce orarie → slot da 15 minuti) già usato per scegliere
// l'orario di ritiro altrove nell'app — checkout/riordino self-service (tinta sky/emerald) e
// creazione manuale walk-in (`app/staff/asporto/ordini/nuovo.tsx`, stessa tinta sky di qui) —
// così anche la modifica di un ordine esistente ha "la stessa formattazione degli altri orari",
// su richiesta esplicita dell'utente (2026-08-27). **Nessuno slot è mai disabilitato qui**, a
// differenza di tutte le altre occorrenze del picker: quelle riguardano sempre un orario non
// ancora scelto per un ordine nuovo/futuro (ha senso nascondere gli orari già passati o esauriti);
// questo invece modifica un ordine già esistente, il cui orario attuale è spessissimo già passato
// nel momento in cui lo staff lo rivede/corregge (l'ordine resta modificabile finché la sua
// `data` non è nel passato, non finché la sua `ora` lo è) — disabilitare gli orari passati
// nasconderebbe/disattiverebbe proprio il valore corrente, impedendo di correggere un ordine
// già scaduto o di lasciarlo con un altro orario ugualmente passato. Il backend resta comunque
// l'unica validazione reale (`ConfigurazioneAsporto.orario_valido()`, vincolante per chiunque,
// staff incluso) — qui il picker si limita a proporre solo gli orari dentro i turni configurati.
function fasciaClassName(isEspansa: boolean, contieneSelezionato: boolean): string {
  if (isEspansa) return 'border-sky-600 bg-sky-600';
  if (contieneSelezionato) return 'border-sky-600 bg-white';
  return 'border-sky-300 bg-white active:bg-sky-50';
}

function slotClassName(selezionato: boolean): string {
  return selezionato ? 'border-sky-600 bg-sky-600' : 'border-sky-300 bg-white active:bg-sky-100';
}

type PickerOrarioModificaProps = {
  blocchi: BloccoOrario[];
  oraEspansa: string | null;
  onToggleEspansa: (ora: string) => void;
  oraSelezionata: string;
  onSelectOra: (slot: string) => void;
};

function PickerOrarioModifica({
  blocchi,
  oraEspansa,
  onToggleEspansa,
  oraSelezionata,
  onSelectOra,
}: Readonly<PickerOrarioModificaProps>) {
  const slotsFasciaEspansa = blocchi.find((b) => b.ora === oraEspansa)?.slots ?? [];

  return (
    <VStack space="xs">
      <HStack space="xs" className="flex-wrap">
        {blocchi.map((blocco) => {
          const isEspansa = blocco.ora === oraEspansa;
          const contieneSelezionato = blocco.slots.includes(oraSelezionata);
          return (
            <Pressable
              key={blocco.ora}
              onPress={() => onToggleEspansa(blocco.ora)}
              accessibilityRole="button"
              accessibilityLabel={`Fascia oraria ${blocco.label}`}
              accessibilityState={{ expanded: isEspansa, selected: contieneSelezionato }}
              className={`rounded-full border-2 px-3 py-1.5 ${fasciaClassName(isEspansa, contieneSelezionato)}`}
            >
              <Text size="xs" className={`font-medium ${isEspansa ? 'text-white' : 'text-sky-900'}`}>
                {contieneSelezionato && !isEspansa ? '✓ ' : ''}
                {blocco.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      {oraEspansa ? (
        <HStack space="xs" className="flex-wrap rounded-xl border border-sky-100 bg-sky-50/60 p-2">
          {slotsFasciaEspansa.map((slot) => {
            const selezionato = oraSelezionata === slot;
            return (
              <Pressable
                key={slot}
                onPress={() => onSelectOra(slot)}
                accessibilityRole="button"
                accessibilityLabel={`Orario di ritiro ${slot}`}
                className={`rounded-full border-2 px-3 py-1.5 ${slotClassName(selezionato)}`}
              >
                <Text size="xs" className={selezionato ? 'font-bold text-white' : 'font-medium text-sky-900'}>
                  {slot}
                </Text>
              </Pressable>
            );
          })}
        </HStack>
      ) : (
        <Text size="2xs" className="text-muted-foreground">
          Tocca una fascia oraria per scegliere l'orario esatto.
        </Text>
      )}
    </VStack>
  );
}

export function EditOrdineSheet({
  ordine,
  voci,
  onClose,
  onSaved,
  onVociChange,
}: Readonly<{
  ordine: PrenotazioneAsporto | null;
  voci: VoceOrdine[];
  onClose: () => void;
  onSaved: (updated: PrenotazioneAsporto) => void;
  onVociChange: (prenotazioneId: string, next: VoceOrdine[]) => void;
}>) {
  const [ora, setOra] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyVoceId, setBusyVoceId] = useState<string | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);

  // Orario di ritiro — stesso picker a due livelli delle altre schermate (sopra), caricato solo
  // all'apertura del foglio (stesso principio "un componente, i propri dati" già usato da
  // `AggiungiProdottoSheet`). Se il caricamento fallisce, si ricade sul campo testuale mascherato
  // di prima (nessuna azione bloccata per un problema di rete).
  const [configurazione, setConfigurazione] = useState<ConfigurazioneAsporto | null>(null);
  // Vero fin da subito (non solo dopo il primo effetto): evita che il primissimo render di ogni
  // apertura mostri per un istante il fallback testuale prima che l'effetto sotto lo corregga.
  const [isLoadingOrario, setIsLoadingOrario] = useState(true);
  const [orarioLoadError, setOrarioLoadError] = useState(false);
  const [oraEspansa, setOraEspansa] = useState<string | null>(null);

  useEffect(() => {
    if (!ordine) return;
    setOra(formatTime(ordine.ora));
    setNote(ordine.note);
    setError(null);
    setConfigurazione(null);
    setOraEspansa(null);
    setOrarioLoadError(false);
    setIsLoadingOrario(true);
    getConfigurazioneAsporto()
      .then(setConfigurazione)
      .catch(() => setOrarioLoadError(true))
      .finally(() => setIsLoadingOrario(false));
  }, [ordine]);

  // Entrambi i turni concatenati (nessuno "switch" a un turno alla volta come lato cliente): lo
  // staff deve poter correggere un ordine verso qualunque orario di servizio, non solo quello in
  // corso — stesso principio già seguito in `app/staff/asporto/ordini/nuovo.tsx`.
  const blocchiOrario = useMemo(() => {
    if (!configurazione) return [];
    const slotsTurno1 = generaSlotOrario(formatTime(configurazione.orario_apertura), formatTime(configurazione.orario_chiusura));
    const slotsTurno2 =
      configurazione.orario_apertura_2 && configurazione.orario_chiusura_2
        ? generaSlotOrario(formatTime(configurazione.orario_apertura_2), formatTime(configurazione.orario_chiusura_2))
        : [];
    return raggruppaSlotPerOra([...slotsTurno1, ...slotsTurno2]);
  }, [configurazione]);

  // Espande da sé la fascia che contiene l'orario attuale dell'ordine, appena i blocchi sono
  // pronti — lo staff vede subito dove si trova il valore corrente invece di doverlo cercare a
  // tentoni tra le fasce.
  useEffect(() => {
    if (blocchiOrario.length === 0) return;
    setOraEspansa((prev) => prev ?? blocchiOrario.find((b) => b.slots.includes(ora))?.ora ?? null);
  }, [blocchiOrario, ora]);

  if (!ordine) {
    return <Actionsheet isOpen={false} onClose={onClose} />;
  }

  const handleChangeQuantita = async (voce: VoceOrdine, nextQuantita: number) => {
    if (nextQuantita < 1) return;
    setBusyVoceId(voce.id);
    setError(null);
    try {
      const updated = await updateVoceOrdine(voce.id, { quantita: nextQuantita });
      onVociChange(ordine.id, voci.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile aggiornare la quantità.'));
    } finally {
      setBusyVoceId(null);
    }
  };

  const handleRemove = (voce: VoceOrdine) => {
    const doRemove = async () => {
      setBusyVoceId(voce.id);
      setError(null);
      try {
        await deleteVoceOrdine(voce.id);
        onVociChange(ordine.id, voci.filter((v) => v.id !== voce.id));
      } catch (err) {
        setError(extractErrorMessage(err, 'Impossibile rimuovere il prodotto.'));
      } finally {
        setBusyVoceId(null);
      }
    };

    const message = `Rimuovere "${voce.prodotto_nome}" dall'ordine?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) doRemove();
      return;
    }
    Alert.alert('Rimuovere prodotto?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Rimuovi', style: 'destructive', onPress: doRemove },
    ]);
  };

  const handleAdded = (voce: VoceOrdine) => {
    onVociChange(ordine.id, [...voci, voce]);
  };

  const handleSave = async () => {
    if (!ora.trim() || parseHHMMToMinutes(ora) === null) {
      setError('Inserisci un orario di ritiro valido (HH:MM).');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await updatePrenotazioneAsporto(ordine.id, { ora: ora.trim(), note: note.trim() });
      onSaved(updated);
    } catch (err) {
      setError(extractErrorMessage(err, "Impossibile salvare le modifiche all'ordine."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const totale = calcolaTotale(voci);

  // Calcolato qui (non con un ternario nel JSX) per lo stesso motivo già seguito altrove nel
  // progetto per questo genere di scelta a tre rami: un if/else in sequenza, nessun annidamento.
  let orarioContent: React.ReactNode;
  if (isLoadingOrario) {
    orarioContent = (
      <HStack space="xs" className="items-center py-1">
        <Spinner size="small" />
        <Text size="xs" className="text-muted-foreground">
          Caricamento orari...
        </Text>
      </HStack>
    );
  } else if (orarioLoadError || blocchiOrario.length === 0) {
    // Fallback: campo testuale mascherato, comportamento identico a prima — usato solo se il
    // caricamento dell'orario del servizio fallisce (mai bloccare la modifica di un ordine per un
    // problema di rete su un dato accessorio).
    orarioContent = (
      <Input>
        <InputField
          placeholder="Es. 19:30"
          keyboardType="numeric"
          maxLength={5}
          value={ora}
          onChangeText={(text) => setOra(formatOrarioInput(ora, text))}
        />
      </Input>
    );
  } else {
    orarioContent = (
      <PickerOrarioModifica
        blocchi={blocchiOrario}
        oraEspansa={oraEspansa}
        onToggleEspansa={(o) => setOraEspansa((prev) => (prev === o ? null : o))}
        oraSelezionata={ora}
        onSelectOra={setOra}
      />
    );
  }

  return (
    <>
      <Actionsheet isOpen={ordine !== null} onClose={onClose}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[85vh]" aria-label={`Modifica ordine di ${ordine.cliente_nome}`}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          <ActionsheetScrollView className="w-full">
            <VStack space="md" className="w-full pb-6">
              <Heading size="md">Modifica ordine — {ordine.cliente_nome}</Heading>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Orario di ritiro
                </Text>
                {orarioContent}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Note
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. senza cipolla, allergie..."
                    value={note}
                    onChangeText={setNote}
                  />
                </Input>
              </VStack>

              <Box className="h-px w-full bg-sky-100" />

              <HStack className="items-center justify-between">
                <Heading size="sm">Prodotti ({voci.length})</Heading>
              </HStack>

              {voci.length === 0 ? (
                <Text size="sm" className="text-muted-foreground">
                  Nessun prodotto in questo ordine. Aggiungine uno dal catalogo.
                </Text>
              ) : (
                <VStack className="rounded-xl border border-sky-100 px-3">
                  {voci.map((voce, index) => (
                    <VoceOrdineRow
                      key={voce.id}
                      voce={voce}
                      isBusy={busyVoceId === voce.id}
                      isLast={index === voci.length - 1}
                      onChangeQuantita={handleChangeQuantita}
                      onRemove={handleRemove}
                    />
                  ))}
                </VStack>
              )}

              <Button
                size="sm"
                variant="outline"
                className="self-start border-2 border-sky-300 bg-white"
                onPress={() => setIsAddSheetOpen(true)}
              >
                <ButtonIcon as={AddIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Aggiungi prodotto</ButtonText>
              </Button>

              <HStack className="items-center justify-between">
                <Text size="sm" className="font-semibold text-sky-900">
                  Totale
                </Text>
                <Text size="md" className="font-bold text-sky-900">
                  €{totale.toFixed(2).replace('.', ',')}
                </Text>
              </HStack>

              {error ? (
                <Text size="sm" className="text-center text-destructive">
                  {error}
                </Text>
              ) : null}

              <Button onPress={handleSave} disabled={isSubmitting}>
                {isSubmitting ? <ButtonSpinner /> : <ButtonText>Salva orario e note</ButtonText>}
              </Button>
              <Text size="2xs" className="text-center text-muted-foreground">
                Le modifiche ai prodotti (quantità, aggiunte, rimozioni) si salvano subito, senza
                bisogno di premere "Salva".
              </Text>
              <Button variant="link" onPress={onClose}>
                <ButtonText>Chiudi</ButtonText>
              </Button>
            </VStack>
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>

      <AggiungiProdottoSheet
        isOpen={isAddSheetOpen}
        prenotazioneId={ordine.id}
        onClose={() => setIsAddSheetOpen(false)}
        onAdded={handleAdded}
      />
    </>
  );
}

export function OrdineRow({
  ordine,
  voci,
  editable,
  isCancelling,
  isConfirming,
  onEdit,
  onCancel,
  onConfirm,
  showTelefono = true,
  showActions = true,
}: Readonly<{
  ordine: PrenotazioneAsporto;
  voci: VoceOrdine[];
  editable: boolean;
  isCancelling: boolean;
  isConfirming: boolean;
  onEdit: (o: PrenotazioneAsporto) => void;
  onCancel: (o: PrenotazioneAsporto) => void;
  onConfirm: (o: PrenotazioneAsporto) => void;
  // Nascosto nella scheda cliente (il telefono è già mostrato in cima alla pagina, ripeterlo su
  // ogni riga d'ordine sarebbe ridondante) — mostrato di default per lo storico giornaliero, dove
  // la card raccoglie ordini di clienti diversi.
  showTelefono?: boolean;
  // Nasconde interamente il blocco pulsanti/didascalia — usato per le righe di uno storico
  // raggruppato (mai azionabili per definizione, sezione "In programma"/"Storico" della scheda
  // cliente), dove i pulsanti disabilitati + la didascalia "ordine passato..." sarebbero solo
  // rumore ripetuto riga dopo riga. Mostrato di default ovunque un ordine possa davvero avere
  // un'azione da compiere (es. "Storico Ordini", un solo giorno alla volta).
  showActions?: boolean;
}>) {
  const totale = calcolaTotale(voci);
  const azionabile = editable && ordine.stato !== 'CANCELLED';

  return (
    <Box className="w-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <VStack space="sm">
        <HStack space="xs" className="flex-wrap items-start justify-between">
          <VStack>
            <Text size="sm" className="font-semibold text-sky-900">
              {ordine.cliente_nome}
            </Text>
            <HStack space="xs" className="items-center">
              <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
              <Text size="xs" className="text-sky-900/70">
                Ritiro {formatTime(ordine.ora) || '—'}
              </Text>
            </HStack>
            {showTelefono ? (
              <HStack space="xs" className="items-center">
                <Icon as={PhoneIcon} size="2xs" className="text-sky-600" />
                <Text size="xs" className="text-sky-900/70">
                  {ordine.cliente_telefono}
                </Text>
              </HStack>
            ) : null}
          </VStack>
          <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[ordine.stato].bg}`}>
            <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[ordine.stato].text}`}>
              {STATO_PRENOTAZIONE_LABEL[ordine.stato]}
            </Text>
          </Box>
        </HStack>

        {ordine.note ? (
          <Text size="xs" className="italic text-sky-900/70">
            📝 {ordine.note}
          </Text>
        ) : null}

        <Box className="rounded-xl bg-sky-50 px-3 py-2">
          {voci.length === 0 ? (
            <Text size="xs" className="text-sky-900/60">
              Nessun prodotto registrato per questo ordine.
            </Text>
          ) : (
            <VStack space="xs">
              {voci.map((voce) => (
                <HStack key={voce.id} className="items-center justify-between">
                  <Text size="xs" className="flex-1 text-sky-900">
                    {voce.quantita}x {voce.prodotto_nome}
                  </Text>
                  <Text size="xs" className="font-medium text-sky-900">
                    €{formatPrezzo(voce.subtotale)}
                  </Text>
                </HStack>
              ))}
            </VStack>
          )}
          <Box className="my-1.5 h-px bg-sky-200" />
          <HStack className="items-center justify-between">
            <Text size="xs" className="font-semibold text-sky-900">
              Totale
            </Text>
            <Text size="xs" className="font-bold text-sky-900">
              €{totale.toFixed(2).replace('.', ',')}
            </Text>
          </HStack>
        </Box>

        {showActions && ordine.stato !== 'CANCELLED' ? (
          <VStack space="xs">
            {!editable ? (
              <Text size="2xs" className="text-muted-foreground">
                Ordine passato: non più modificabile né annullabile.
              </Text>
            ) : null}
            <HStack space="sm">
              {ordine.stato === 'PENDING' ? (
                <Pressable
                  onPress={() => onConfirm(ordine)}
                  disabled={!azionabile || isConfirming}
                  accessibilityLabel={`Conferma ordine di ${ordine.cliente_nome}`}
                  className={`h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-300 bg-emerald-50 ${
                    !azionabile ? 'opacity-40' : ''
                  }`}
                >
                  {isConfirming ? <Spinner size="small" /> : <Icon as={CheckIcon} size="sm" className="text-emerald-700" />}
                </Pressable>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-2 border-sky-300 bg-white"
                onPress={() => onEdit(ordine)}
                disabled={!azionabile}
              >
                <ButtonIcon as={EditIcon} className="text-sky-700" />
                <ButtonText className="text-sky-900">Modifica</ButtonText>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-2 border-amber-300 bg-amber-50"
                onPress={() => onCancel(ordine)}
                disabled={!azionabile || isCancelling}
              >
                {isCancelling ? (
                  <ButtonSpinner />
                ) : (
                  <>
                    <ButtonIcon as={SlashIcon} className="text-amber-700" />
                    <ButtonText className="text-amber-800">Annulla</ButtonText>
                  </>
                )}
              </Button>
            </HStack>
          </VStack>
        ) : null}
      </VStack>
    </Box>
  );
}
