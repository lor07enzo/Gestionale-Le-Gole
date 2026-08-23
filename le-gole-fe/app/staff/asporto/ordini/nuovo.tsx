import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  AddIcon,
  ArrowLeftIcon,
  ClockIcon,
  CloseIcon,
  Icon,
  PhoneIcon,
  RemoveIcon,
  SearchIcon,
} from '@/components/ui/icon';
import { goBackOr } from '../../../../src/utils/navigation';
import { createCliente } from '../../../../src/services/clienti';
import { createPrenotazioneAsporto } from '../../../../src/services/prenotazioni';
import {
  createVoceOrdine,
  getConfigurazioneAsporto,
  listProdotti,
  type ConfigurazioneAsporto,
  type Prodotto,
} from '../../../../src/services/menu';
import {
  computeDefaultOrario,
  formatDisplayDate,
  formatOrarioInput,
  formatTime,
  parseHHMMToMinutes,
  toISODate,
} from '../../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../../src/utils/prezzi';

// Creazione manuale di un ordine walk-in (cliente al banco/al telefono) dalla pagina "Storico
// Ordini" — stesso principio del "+ Nuovo cliente" sulla mappa piscina (PiscinaSheetsContext,
// sezione 5 di CLAUDE.md): crea anagrafica + ordine già CONFIRMED, senza attesa. A differenza
// della piscina, qui vive in una pagina dedicata (non un Actionsheet) perché scegliere i prodotti
// dal catalogo richiede più spazio verticale di un foglio.

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: unknown } })?.response?.data;
  if (detail && typeof detail === 'object') {
    const message = Object.values(detail as Record<string, unknown>).flat().join(' ');
    if (message) return message;
  }
  return fallback;
}

function RequiredLabel({ children }: Readonly<{ children: string }>) {
  return (
    <HStack space="xs" className="items-center">
      <Text size="sm" className="font-medium">
        {children}
      </Text>
      <Text size="xs" className="text-destructive">
        *
      </Text>
    </HStack>
  );
}

function NuovoOrdineHeader() {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff/asporto/ordini')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Nuovo ordine</Heading>
        <Text size="sm" className="text-muted-foreground">
          Registra un ordine al banco o per telefono: crea l'anagrafica cliente e l'ordine, già
          confermato.
        </Text>
      </VStack>
    </HStack>
  );
}

function ProdottoPickerRow({
  prodotto,
  quantita,
  isLast,
  onChange,
}: Readonly<{ prodotto: Prodotto; quantita: number; isLast: boolean; onChange: (next: number) => void }>) {
  return (
    <HStack
      space="sm"
      className={`items-center justify-between px-3 py-2.5 ${isLast ? '' : 'border-b border-sky-100'}`}
    >
      <VStack className="flex-1">
        <Text size="sm" className="font-medium text-sky-900">
          {prodotto.nome}
        </Text>
        <Text size="2xs" className="text-muted-foreground">
          {prodotto.categoria_nome} · €{formatPrezzo(prodotto.prezzo)}
          {!prodotto.disponibile ? ' · Nascosto dal menu' : ''}
        </Text>
      </VStack>
      <HStack space="xs" className="items-center">
        <Pressable
          onPress={() => onChange(quantita - 1)}
          disabled={quantita <= 0}
          accessibilityLabel={`Diminuisci ${prodotto.nome}`}
          className={`h-8 w-8 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
            quantita <= 0 ? 'opacity-40' : ''
          }`}
        >
          <Icon as={RemoveIcon} size="xs" className="text-sky-900" />
        </Pressable>
        <Text size="sm" className="w-5 text-center font-bold text-sky-900">
          {quantita}
        </Text>
        <Pressable
          onPress={() => onChange(quantita + 1)}
          accessibilityLabel={`Aumenta ${prodotto.nome}`}
          className="h-8 w-8 items-center justify-center rounded-full border-2 border-sky-300 bg-white active:bg-sky-50"
        >
          <Icon as={AddIcon} size="xs" className="text-sky-900" />
        </Pressable>
      </HStack>
    </HStack>
  );
}

function validateOra(value: string, configurazione: ConfigurazioneAsporto | null): string | null {
  if (!value.trim()) return "Inserisci l'orario di ritiro.";
  const minuti = parseHHMMToMinutes(value);
  if (minuti === null) return 'Formato orario non valido (HH:MM).';
  if (!configurazione) return null;
  const apertura = parseHHMMToMinutes(formatTime(configurazione.orario_apertura));
  const chiusura = parseHHMMToMinutes(formatTime(configurazione.orario_chiusura));
  if (apertura !== null && chiusura !== null && (minuti < apertura || minuti > chiusura)) {
    return `Il servizio asporto è attivo dalle ${formatTime(configurazione.orario_apertura)} alle ${formatTime(configurazione.orario_chiusura)}.`;
  }
  return null;
}

export default function NuovoOrdineAsportoScreen() {
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [note, setNote] = useState('');

  // Un ordine walk-in registrato dallo staff è sempre per il ritiro odierno — nessuna data futura
  // selezionabile (a differenza della piscina, dove "+ Nuovo cliente" può prenotare per un giorno
  // diverso): fissata una sola volta al mount, non un campo del form.
  const [oggi] = useState(() => new Date());
  const [ora, setOra] = useState('');
  const [configurazione, setConfigurazione] = useState<ConfigurazioneAsporto | null>(null);

  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [isLoadingCatalogo, setIsLoadingCatalogo] = useState(true);
  const [query, setQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getConfigurazioneAsporto(), listProdotti()])
      .then(([config, prodottiList]) => {
        setConfigurazione(config);
        setProdotti(prodottiList);
      })
      .catch(() => setError("Impossibile caricare l'orario/il catalogo del servizio."))
      .finally(() => setIsLoadingCatalogo(false));
  }, []);

  // Precompilato una sola volta (non appena la configurazione è nota): "adesso" se oggi e già
  // dentro l'orario di apertura, altrimenti l'orario di apertura stesso — non sovrascrive un
  // valore che lo staff ha già iniziato a digitare.
  useEffect(() => {
    if (!configurazione) return;
    setOra((prev) => prev || computeDefaultOrario(null, oggi, formatTime(configurazione.orario_apertura)));
  }, [configurazione, oggi]);

  const prodottiFiltrati = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return prodotti;
    return prodotti.filter((p) => p.nome.toLowerCase().includes(q));
  }, [prodotti, query]);

  const cartLines = useMemo(
    () =>
      prodotti
        .filter((p) => (quantities[p.id] ?? 0) > 0)
        .map((p) => ({ prodotto: p, quantita: quantities[p.id] })),
    [prodotti, quantities]
  );

  const totale = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.quantita * (Number.parseFloat(line.prodotto.prezzo) || 0), 0),
    [cartLines]
  );

  const setQuantita = (prodottoId: string, next: number) => {
    setQuantities((prev) => {
      if (next <= 0) {
        const { [prodottoId]: _omit, ...rest } = prev;
        return rest;
      }
      return { ...prev, [prodottoId]: next };
    });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!nome.trim()) {
      setError('Inserisci il nome del cliente.');
      return;
    }
    if (!telefono.trim()) {
      setError('Inserisci il telefono del cliente.');
      return;
    }
    const oraError = validateOra(ora, configurazione);
    if (oraError) {
      setError(oraError);
      return;
    }
    if (cartLines.length === 0) {
      setError("Aggiungi almeno un prodotto all'ordine.");
      return;
    }

    setIsSubmitting(true);
    try {
      const cliente = await createCliente({ nome: nome.trim(), telefono: telefono.trim() });
      const prenotazione = await createPrenotazioneAsporto({
        cliente_id: cliente.id,
        data: toISODate(oggi),
        ora: ora.trim(),
        stato: 'CONFIRMED',
        note: note.trim(),
      });
      await Promise.all(
        cartLines.map((line) =>
          createVoceOrdine({ prenotazione: prenotazione.id, prodotto: line.prodotto.id, quantita: line.quantita })
        )
      );
      router.replace(`/staff/asporto/ordini/${prenotazione.id}` as Href);
    } catch (err) {
      setError(extractErrorMessage(err, "Impossibile creare l'ordine. Riprova."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <NuovoOrdineHeader />

        <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
          <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
            Dati cliente
          </Text>

          <VStack space="xs">
            <RequiredLabel>Nome cliente</RequiredLabel>
            <Input>
              <InputField placeholder="Nome e cognome" value={nome} onChangeText={setNome} />
            </Input>
          </VStack>

          <VStack space="xs">
            <HStack space="xs" className="items-center">
              <Icon as={PhoneIcon} size="sm" className="text-sky-700" />
              <Text size="sm" className="font-medium">
                Telefono
              </Text>
              <Text size="xs" className="text-destructive">
                *
              </Text>
            </HStack>
            <Input>
              <InputField
                keyboardType="phone-pad"
                placeholder="Numero di telefono"
                value={telefono}
                onChangeText={setTelefono}
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <HStack space="xs" className="items-center">
              <Text size="sm" className="font-medium">
                Note
              </Text>
              <Text size="xs" className="text-muted-foreground">
                (opzionale)
              </Text>
            </HStack>
            <Input>
              <InputField
                placeholder="Es. allergie, richieste particolari..."
                value={note}
                onChangeText={setNote}
              />
            </Input>
          </VStack>
        </VStack>

        <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
          <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
            Ritiro
          </Text>

          <HStack space="sm" className="items-center rounded-xl border border-sky-100 bg-sky-50/60 p-2.5">
            <Text size="sm" className="font-bold capitalize text-sky-900">
              Oggi, {formatDisplayDate(oggi)}
            </Text>
          </HStack>
          <Text size="2xs" className="text-muted-foreground">
            Un ordine walk-in è sempre registrato per il ritiro odierno.
          </Text>

          <VStack space="xs">
            <HStack space="xs" className="items-center">
              <Icon as={ClockIcon} size="sm" className="text-sky-700" />
              <Text size="sm" className="font-medium">
                Orario di ritiro
              </Text>
              <Text size="xs" className="text-destructive">
                *
              </Text>
            </HStack>
            <Input>
              <InputField
                placeholder="Es. 19:30"
                keyboardType="numeric"
                maxLength={5}
                value={ora}
                onChangeText={(text) => setOra(formatOrarioInput(ora, text))}
              />
            </Input>
            {configurazione ? (
              <Text size="2xs" className="text-muted-foreground">
                Servizio attivo dalle {formatTime(configurazione.orario_apertura)} alle{' '}
                {formatTime(configurazione.orario_chiusura)}.
              </Text>
            ) : null}
          </VStack>
        </VStack>

        <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
          <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
            Prodotti
          </Text>

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

          {isLoadingCatalogo ? (
            <HStack className="items-center justify-center py-6">
              <Spinner size="small" />
            </HStack>
          ) : prodottiFiltrati.length === 0 ? (
            <Text size="sm" className="text-center text-muted-foreground">
              Nessun prodotto trovato.
            </Text>
          ) : (
            <VStack className="rounded-xl border border-sky-100">
              {prodottiFiltrati.map((prodotto, index) => (
                <ProdottoPickerRow
                  key={prodotto.id}
                  prodotto={prodotto}
                  quantita={quantities[prodotto.id] ?? 0}
                  isLast={index === prodottiFiltrati.length - 1}
                  onChange={(next) => setQuantita(prodotto.id, next)}
                />
              ))}
            </VStack>
          )}
        </VStack>

        <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
          <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
            Riepilogo ordine
          </Text>

          {cartLines.length === 0 ? (
            <Text size="sm" className="text-muted-foreground">
              Nessun prodotto selezionato.
            </Text>
          ) : (
            <VStack space="xs">
              {cartLines.map((line) => (
                <HStack key={line.prodotto.id} className="items-center justify-between">
                  <Text size="sm" className="flex-1 text-sky-900">
                    {line.quantita}x {line.prodotto.nome}
                  </Text>
                  <Text size="sm" className="font-medium text-sky-900">
                    €{formatPrezzo((line.quantita * Number.parseFloat(line.prodotto.prezzo)).toFixed(2))}
                  </Text>
                </HStack>
              ))}
              <Box className="h-px w-full bg-sky-100" />
              <HStack className="items-center justify-between">
                <Text size="sm" className="font-semibold text-sky-900">
                  Totale
                </Text>
                <Text size="md" className="font-bold text-sky-900">
                  €{formatPrezzo(totale.toFixed(2))}
                </Text>
              </HStack>
            </VStack>
          )}
        </VStack>

        {error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : null}

        <Button onPress={handleSubmit} disabled={isSubmitting} isDisabled={isSubmitting}>
          {isSubmitting ? (
            <ButtonSpinner />
          ) : (
            <ButtonText>
              Crea ordine{cartLines.length > 0 ? ` · €${formatPrezzo(totale.toFixed(2))}` : ''}
            </ButtonText>
          )}
        </Button>
      </VStack>
    </ScrollView>
  );
}
