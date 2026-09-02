import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
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
  ChevronDownIcon,
  ClockIcon,
  CloseIcon,
  Icon,
  PhoneIcon,
  RemoveIcon,
  SearchIcon,
} from '@/components/ui/icon';
import { goBackOr } from '../../../../src/utils/navigation';
import { extractErrorMessage } from '../../../../src/utils/errors';
import { createCliente } from '../../../../src/services/clienti';
import {
  createPrenotazioneAsporto,
  getPrenotazioniPerOrario,
  type PrenotazioniPerOrario,
} from '../../../../src/services/prenotazioni';
import {
  createVoceOrdine,
  getConfigurazioneAsporto,
  listProdotti,
  type ConfigurazioneAsporto,
  type Prodotto,
} from '../../../../src/services/menu';
import {
  formatDisplayDate,
  formatTime,
  generaSlotOrario,
  nowHHMM,
  parseHHMMToMinutes,
  raggruppaSlotPerOra,
  toISODate,
} from '../../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../../src/utils/prezzi';

// Creazione manuale di un ordine walk-in (cliente al banco/al telefono) dalla pagina "Storico
// Ordini" — stesso principio del "+ Nuovo cliente" sulla mappa piscina (PiscinaSheetsContext,
// sezione 5 di CLAUDE.md): crea anagrafica + ordine già CONFIRMED, senza attesa. A differenza
// della piscina, qui vive in una pagina dedicata (non un Actionsheet) perché scegliere i prodotti
// dal catalogo richiede più spazio verticale di un foglio.

// Sotto questo numero di prenotazioni ancora accettabili per un orario, mostriamo il conteggio
// residuo sotto lo slot — stessa soglia/stesso principio delle pagine cliente asporto (abbassata
// a 2 il 2026-08-28 insieme al passaggio del limite dai prodotti alle prenotazioni, stesso motivo:
// numeri molto più piccoli in gioco).
const SOGLIA_AVVISO_RESIDUO_ORARIO = 2;

// Estratte perché ripetute identiche su 4 sezioni della pagina (rilevato da SonarQube — regola
// "Define a constant instead of duplicating this literal"): un solo punto da aggiornare se lo
// stile di titolo/card sezione cambia, invece di quattro.
const SEZIONE_TITOLO_CLASS = 'font-bold uppercase tracking-wide text-sky-700';
const SEZIONE_CARD_CLASS = 'w-full rounded-2xl border border-sky-200 bg-white p-4';

// `generaSlotOrario`/`raggruppaSlotPerOra`/`BloccoOrario` sono importate da `utils/piscinaMappa.ts`
// (2026-08-26, SonarQube — duplicazione): nessun anticipo minimo qui, a differenza delle pagine
// cliente, applicato invece a valle nel filtro `passato`/`disabilitato` sotto — lo staff ha
// visibilità diretta sulla cucina (stesso principio per cui bypassa GiornoPienoPiscina/
// GiornoChiusoAsporto online, sezioni 2/15): un walk-in può benissimo essere ritirato "adesso",
// quindi un orario coincidente con l'ora corrente resta selezionabile. Solo gli orari già passati
// (prima di adesso, non prima di adesso+un margine) sono disabilitati — un ordine per un orario
// già trascorso oggi non avrebbe comunque senso.

// Descrizione leggibile di entrambi i turni insieme (pranzo/cena, sezione 15) — stessa forma di
// `descrizione_orari()` lato backend (menu/models.py, ConfigurazioneAsporto).
function descrizioneOrari(configurazione: ConfigurazioneAsporto): string {
  const turni = [`dalle ${formatTime(configurazione.orario_apertura)} alle ${formatTime(configurazione.orario_chiusura)}`];
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    turni.push(`dalle ${formatTime(configurazione.orario_apertura_2)} alle ${formatTime(configurazione.orario_chiusura_2)}`);
  }
  return turni.join(' e ');
}

// True se `minuti` rientra nel primo turno o, se configurato, nel secondo — stessa logica di
// `ConfigurazioneAsporto.orario_valido()` lato backend.
function isOraInFinestre(configurazione: ConfigurazioneAsporto, minuti: number): boolean {
  const apertura1 = parseHHMMToMinutes(formatTime(configurazione.orario_apertura));
  const chiusura1 = parseHHMMToMinutes(formatTime(configurazione.orario_chiusura));
  if (apertura1 !== null && chiusura1 !== null && minuti >= apertura1 && minuti <= chiusura1) return true;
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    const apertura2 = parseHHMMToMinutes(formatTime(configurazione.orario_apertura_2));
    const chiusura2 = parseHHMMToMinutes(formatTime(configurazione.orario_chiusura_2));
    if (apertura2 !== null && chiusura2 !== null && minuti >= apertura2 && minuti <= chiusura2) return true;
  }
  return false;
}

// Estratte dai rispettivi JSX (ternari annidati, rilevati da SonarQube — regola "Ternary operators
// should not be nested") in funzioni pure con un solo livello di if/return ciascuna: stesso
// risultato visivo, complessità cognitiva più bassa sia qui sia nei due `.map()` che le usano.
function fasciaClassName(nonSelezionabile: boolean, isEspansa: boolean, contieneSelezionato: boolean): string {
  if (nonSelezionabile) return 'border-sky-100 bg-white opacity-40';
  if (isEspansa) return 'border-sky-600 bg-sky-600';
  if (contieneSelezionato) return 'border-sky-600 bg-white';
  return 'border-sky-300 bg-white active:bg-sky-50';
}

function fasciaTextClassName(nonSelezionabile: boolean, isEspansa: boolean): string {
  if (nonSelezionabile) return 'text-muted-foreground';
  if (isEspansa) return 'text-white';
  return 'text-sky-900';
}

function slotClassName(selezionato: boolean, disabilitato: boolean): string {
  if (selezionato) return 'border-sky-600 bg-sky-600';
  if (disabilitato) return 'border-sky-100 bg-white opacity-40';
  return 'border-sky-300 bg-white active:bg-sky-100';
}

function slotTextClassName(selezionato: boolean, disabilitato: boolean): string {
  if (selezionato) return 'font-bold text-white';
  if (disabilitato) return 'text-muted-foreground';
  return 'font-medium text-sky-900';
}

function slotAccessibilityLabel(
  slot: string,
  passato: boolean,
  esaurito: boolean,
  mostraResiduo: boolean,
  residuo: number | null
): string {
  if (passato) return `Orario di ritiro ${slot}, già passato`;
  if (esaurito) return `Orario di ritiro ${slot}, esaurito: numero massimo di prenotazioni raggiunto per questo orario`;
  if (mostraResiduo) {
    return `Orario di ritiro ${slot}, solo ${residuo} ${residuo === 1 ? 'posto libero' : 'posti liberi'} per questo orario`;
  }
  return `Orario di ritiro ${slot}`;
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
          Usa questa pagina per un cliente al banco o al telefono: l'ordine viene creato già
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
  if (!isOraInFinestre(configurazione, minuti)) {
    return `Il servizio asporto è attivo ${descrizioneOrari(configurazione)}.`;
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
  // Fascia oraria espansa nel picker a due livelli — stesso identico principio delle pagine
  // cliente asporto, nessuna precompilazione: lo staff sceglie sempre esplicitamente uno slot.
  const [oraEspansa, setOraEspansa] = useState<string | null>(null);
  const [configurazione, setConfigurazione] = useState<ConfigurazioneAsporto | null>(null);
  const [prenotazioniPerOrario, setPrenotazioniPerOrario] = useState<PrenotazioniPerOrario>({});

  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [isLoadingCatalogo, setIsLoadingCatalogo] = useState(true);
  const [query, setQuery] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getConfigurazioneAsporto(), listProdotti(), getPrenotazioniPerOrario(toISODate(new Date()))])
      .then(([config, prodottiList, prenotazioni]) => {
        setConfigurazione(config);
        setProdotti(prodottiList);
        setPrenotazioniPerOrario(prenotazioni);
      })
      .catch(() => setError("Impossibile caricare l'orario/il catalogo del servizio."))
      .finally(() => setIsLoadingCatalogo(false));
  }, []);

  // A differenza delle pagine cliente (che mostrano un turno alla volta, switch dopo la
  // chiusura), lo staff vede sempre gli slot di ENTRAMBI i turni insieme — ha visibilità diretta
  // sulla cucina e può voler registrare un walk-in per la cena anche a metà mattina, senza dover
  // aspettare che il pranzo chiuda.
  const blocchiOrario = useMemo(() => {
    if (!configurazione) return [];
    const slotsTurno1 = generaSlotOrario(formatTime(configurazione.orario_apertura), formatTime(configurazione.orario_chiusura));
    const slotsTurno2 =
      configurazione.orario_apertura_2 && configurazione.orario_chiusura_2
        ? generaSlotOrario(formatTime(configurazione.orario_apertura_2), formatTime(configurazione.orario_chiusura_2))
        : [];
    return raggruppaSlotPerOra([...slotsTurno1, ...slotsTurno2]);
  }, [configurazione]);

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
  const totaleArticoli = useMemo(() => cartLines.reduce((sum, line) => sum + line.quantita, 0), [cartLines]);

  // Limite globale di PRENOTAZIONI per orario (ConfigurazioneAsporto.limite_prenotazioni_orario,
  // sezione 15) — vincolato anche per lo staff (a differenza dell'anticipo minimo, che qui non
  // esiste affatto): riflette quanti ordini distinti la cucina/lo staff può gestire nella stessa
  // finestra, non un gate sul solo canale online. Il submit crea sempre esattamente UNA
  // prenotazione, a prescindere da quanti prodotti/righe contiene il carrello che si sta
  // componendo — basta confrontare quante prenotazioni ci sono già con il limite.
  const limitePrenotazioniOrario = configurazione?.limite_prenotazioni_orario ?? null;

  // Pulsante fluttuante "vai al carrello" (sotto, solo se cartLines non è vuoto) — stesso
  // meccanismo ref+scrollIntoView già usato per `scrollToCarrello`/`cartSectionRef` in
  // app/cliente/asporto/index.tsx, qui riportato identico (principio "copia diretta", sezione
  // 15/7 di CLAUDE.md). Il ref va sull'unico `Box` reale (non su una `VStack`, la cui resa web
  // non garantisce che il ref raggiunga il vero nodo DOM — stesso gotcha già documentato per
  // `CategoriaCard`/`scrollToCategoria`).
  const cartSectionRef = useRef<unknown>(null);
  const registerCartRef = (node: unknown) => {
    cartSectionRef.current = node;
  };
  const scrollToCarrello = () => {
    if (Platform.OS !== 'web') return;
    const node = cartSectionRef.current as { scrollIntoView?: (opts: unknown) => void } | undefined;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  // Il pulsante non ha senso quando la sezione "Riepilogo ordine" è già visibile a schermo — su
  // richiesta esplicita dell'utente, sparisce mentre lo staff sta già guardando il carrello.
  // Stesso `IntersectionObserver` (solo web) già usato per lo scroll-spy delle categorie nelle
  // pagine cliente asporto (`activeCategoriaId`), qui applicato a un solo nodo invece che a N.
  const [isCarrelloInView, setIsCarrelloInView] = useState(false);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = cartSectionRef.current as Element | null;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsCarrelloInView(entry.isIntersecting), {
      threshold: 0.15,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const isSlotEsaurito = (slot: string) => {
    if (limitePrenotazioniOrario === null) return false;
    const prenotate = prenotazioniPerOrario[slot] ?? 0;
    return prenotate >= limitePrenotazioniOrario;
  };
  // Residuo dello slot (limite meno quante prenotazioni già presenti) — stesso principio delle
  // pagine cliente.
  const residuoSlot = (slot: string): number | null => {
    if (limitePrenotazioniOrario === null) return null;
    const prenotate = prenotazioniPerOrario[slot] ?? 0;
    return limitePrenotazioniOrario - prenotate;
  };

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
    if (isSlotEsaurito(ora.trim())) {
      setError('Numero massimo di prodotti raggiunto per questo orario: scegli un altro orario.');
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

  // Calcolato qui, non con un ternario a tre rami nel JSX (rilevato da SonarQube — stessa regola
  // "Ternary operators should not be nested" già risolta altrove in questo file): un if/else in
  // sequenza, nessun annidamento.
  let catalogoContent: React.ReactNode;
  if (isLoadingCatalogo) {
    catalogoContent = (
      <HStack className="items-center justify-center py-6">
        <Spinner size="small" />
      </HStack>
    );
  } else if (prodottiFiltrati.length === 0) {
    catalogoContent = (
      <Text size="sm" className="text-center text-muted-foreground">
        Nessun prodotto trovato.
      </Text>
    );
  } else {
    catalogoContent = (
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
    );
  }

  return (
    <>
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full">
          <NuovoOrdineHeader />

        <VStack space="sm" className={SEZIONE_CARD_CLASS}>
          <Text size="xs" className={SEZIONE_TITOLO_CLASS}>
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

        <VStack space="sm" className={SEZIONE_CARD_CLASS}>
          <Text size="xs" className={SEZIONE_TITOLO_CLASS}>
            Ritiro
          </Text>

          <HStack space="sm" className="items-center rounded-xl border border-sky-100 bg-sky-50/60 p-2.5">
            <Text size="sm" className="font-bold capitalize text-sky-900">
              Oggi, {formatDisplayDate(oggi)}
            </Text>
          </HStack>
          <Text size="2xs" className="text-muted-foreground">
            Il ritiro è sempre per oggi: non è possibile scegliere un altro giorno.
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
            {/* Livello 1 — fasce orarie: stesso identico picker a due livelli delle pagine
                cliente asporto (checkout/riordino), ma senza anticipo minimo — lo staff, a
                differenza del cliente self-service, può registrare un walk-in per "adesso"
                (vede direttamente la cucina). Disabilitata solo se OGNI orario al suo interno è
                già passato (non "troppo vicino", proprio nel passato): un orario di ritiro
                precedente a questo momento non avrebbe comunque senso per un ordine di oggi. */}
            <HStack space="xs" className="flex-wrap">
              {blocchiOrario.map((blocco) => {
                const isEspansa = blocco.ora === oraEspansa;
                const contieneSelezionato = blocco.slots.includes(ora);
                const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
                const tuttiNonSelezionabili = blocco.slots.every(
                  (slot) => parseHHMMToMinutes(slot)! < nowMinuti || isSlotEsaurito(slot)
                );
                return (
                  <Pressable
                    key={blocco.ora}
                    onPress={() =>
                      !tuttiNonSelezionabili && setOraEspansa((prev) => (prev === blocco.ora ? null : blocco.ora))
                    }
                    disabled={tuttiNonSelezionabili}
                    accessibilityRole="button"
                    accessibilityLabel={`Fascia oraria ${blocco.label}${tuttiNonSelezionabili ? ', non più disponibile' : ''}`}
                    accessibilityState={{ expanded: isEspansa, selected: contieneSelezionato, disabled: tuttiNonSelezionabili }}
                    className={`rounded-full border-2 px-3 py-1.5 ${fasciaClassName(tuttiNonSelezionabili, isEspansa, contieneSelezionato)}`}
                  >
                    <Text size="xs" className={`font-medium ${fasciaTextClassName(tuttiNonSelezionabili, isEspansa)}`}>
                      {contieneSelezionato && !isEspansa ? '✓ ' : ''}
                      {blocco.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>

            {/* Livello 2 — orari ogni 15 minuti dentro la fascia scelta sopra. */}
            {oraEspansa ? (
              <HStack space="xs" className="flex-wrap rounded-xl border border-sky-100 bg-sky-50/60 p-2">
                {(blocchiOrario.find((b) => b.ora === oraEspansa)?.slots ?? []).map((slot) => {
                  const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
                  const passato = parseHHMMToMinutes(slot)! < nowMinuti;
                  const esaurito = !passato && isSlotEsaurito(slot);
                  const disabilitato = passato || esaurito;
                  const selezionato = ora === slot;
                  const residuo = residuoSlot(slot);
                  const mostraResiduo =
                    !disabilitato && residuo !== null && residuo <= SOGLIA_AVVISO_RESIDUO_ORARIO;
                  return (
                    <Pressable
                      key={slot}
                      onPress={() => !disabilitato && setOra(slot)}
                      disabled={disabilitato}
                      accessibilityRole="button"
                      accessibilityLabel={slotAccessibilityLabel(slot, passato, esaurito, mostraResiduo, residuo)}
                      className={`rounded-full border-2 px-3 py-1.5 ${slotClassName(selezionato, disabilitato)}`}
                    >
                      <VStack className="items-center">
                        <Text size="xs" className={slotTextClassName(selezionato, disabilitato)}>
                          {slot}
                          {esaurito ? ' · Esaurito' : ''}
                        </Text>
                        {mostraResiduo ? (
                          <Text size="2xs" className={selezionato ? 'text-white/80' : 'font-medium text-amber-700'}>
                            {residuo === 1 ? '1 posto libero' : `${residuo} posti liberi`}
                          </Text>
                        ) : null}
                      </VStack>
                    </Pressable>
                  );
                })}
              </HStack>
            ) : (
              <Text size="2xs" className="text-sky-900/50">
                Tocca una fascia per vedere e scegliere l'orario preciso al suo interno.
              </Text>
            )}

            {configurazione ? (
              <Text size="2xs" className="text-muted-foreground">
                L'asporto è attivo {descrizioneOrari(configurazione)}.
              </Text>
            ) : null}
            {limitePrenotazioniOrario !== null ? (
              <VStack space="xs">
                <Text size="2xs" className="text-muted-foreground">
                  Ogni orario accetta al massimo {limitePrenotazioniOrario} prenotazioni.
                </Text>
                <Text size="2xs" className="text-muted-foreground">
                  Quando restano pochi posti, lo slot lo indica sotto l'orario.
                </Text>
              </VStack>
            ) : null}
          </VStack>
        </VStack>

        <VStack space="sm" className={SEZIONE_CARD_CLASS}>
          <Text size="xs" className={SEZIONE_TITOLO_CLASS}>
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

          {catalogoContent}
        </VStack>

        <Box ref={registerCartRef} className={SEZIONE_CARD_CLASS}>
          <VStack space="sm">
            <Text size="xs" className={SEZIONE_TITOLO_CLASS}>
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
        </Box>

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

      {/* Pulsante fluttuante "vai al carrello" — visibile solo con almeno un prodotto nel
          carrello, porta subito alla sezione "Riepilogo ordine" in fondo alla pagina senza dover
          scorrere manualmente. Sparisce da sé quando quella sezione è già in vista */}
      {cartLines.length > 0 && !isCarrelloInView ? (
        <Pressable
          onPress={scrollToCarrello}
          accessibilityRole="button"
          accessibilityLabel="Vai al riepilogo dell'ordine"
          className="web:fixed bottom-6 right-6 z-20 flex-row items-center gap-1.5 rounded-full bg-sky-600 px-4 py-3 shadow-lg active:bg-sky-700"
        >
          <Text size="sm" className="font-semibold text-white">
            🛒 {totaleArticoli} · €{formatPrezzo(totale.toFixed(2))}
          </Text>
          <Icon as={ChevronDownIcon} size="sm" className="text-white" />
        </Pressable>
      ) : null}
    </>
  );
}
