import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
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
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  CloseIcon,
  DownloadIcon,
  Icon,
  SlidersIcon,
} from '@/components/ui/icon';
import { BackButton } from '../../../src/components/cliente/BackButton';
import { ClienteFooter } from '../../../src/components/cliente/ClienteFooter';
import {
  getBigliettoUrl,
  getRicevutaUrl,
  getStoricoAsportoPerTelefono,
  getStoricoPiscinaPerTelefono,
  type PrenotazioneAsporto,
  type PrenotazionePiscina,
  type StatoPrenotazione,
} from '../../../src/services/prenotazioni';
import {
  getBigliettoPadelUrl,
  getStoricoPadelPerTelefono,
  type PrenotazionePadel,
} from '../../../src/services/padel';
import { apriBigliettoPdf } from '../../../src/utils/biglietto';
import {
  formatDateDDMMYYYY,
  formatTime,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
} from '../../../src/utils/piscinaMappa';
import { formatFasciaPartita } from '../../../src/utils/padel';
import { formatPrezzo } from '../../../src/utils/prezzi';

// Pagina raggiunta dalla ricerca sulla landing Area Cliente (StoricoPrenotazioniSearch,
// app/cliente/index.tsx) — presuppone che esista già almeno una prenotazione per il numero
// passato come query param (il controllo di esistenza è già stato fatto lì prima di navigare
// qui, sezione 7/15 di CLAUDE.md): questa pagina si limita a caricare e mostrare, senza dover
// rigestire il caso "nessun risultato" come errore bloccante — se capitasse comunque (link
// salvato, dati cambiati nel frattempo) mostra semplicemente uno stato vuoto, non un errore.
//
// Convertita da file piatto a directory (2026-08-22) per ospitare le pagine di dettaglio
// app/cliente/storico/piscina/[id].tsx e app/cliente/storico/asporto/[id].tsx — stesso schema
// già usato per app/cliente/asporto.tsx -> asporto/index.tsx (sezione 15).
//
// Filtri categoria/stato + ordinamento unificato per data/ora (2026-09-07): le tre categorie
// erano mostrate in sezioni separate (prima piscina, poi asporto, poi padel), ciascuna ordinata
// internamente per data/ora decrescente — non un vero elenco unico "dalla più recente alla meno
// recente" come richiesto esplicitamente dall'utente. Le tre liste vengono ora unite in un solo
// array taggato per categoria, ordinato globalmente, con due righe di chip (Servizio/Stato) per
// restringere la vista — stesso linguaggio "chip con conteggio, tono sky" già usato per i filtri
// del menu asporto cliente (sezione 15).
//
// Sezioni "In programma" / "Storico" (2026-09-07, su richiesta esplicita dell'utente — "avevo
// pensato di fare nello stesso modo che abbiamo fatto nella sezione asporto, però adattato"):
// stesso identico pattern già in uso in PiscinaTabContent/AsportoTabContent/PadelTabContent
// della scheda cliente staff (sezione 5) — "In programma" (non cancellata, data >= oggi) sempre
// per esteso e ordinata **ascendente** (la più vicina nel tempo per prima, il criterio più utile
// per "cosa succede a breve"), "Storico" (tutto il resto: passate o cancellate) collassata di
// default dietro un pulsante con conteggio, ordinata discendente come il resto della pagina. La
// differenza rispetto al pattern staff (che divide per categoria in tab separate) è che qui la
// divisione si applica al **flusso unico già filtrato** da categoria/stato — coerente con
// l'unificazione introdotta subito sopra, non un terzo sistema di sotto-sezioni per categoria.
//
// Filtri spostati in un foglio "Filtri" (2026-09-07, stesso giorno, poco dopo, su richiesta
// esplicita dell'utente — "i filtri rappresentameli in un altro modo"): le due righe di chip
// sempre visibili in pagina sono state sostituite da un solo pulsante con badge numerico, che
// apre un `Actionsheet` con le stesse due sezioni (Servizio/Stato) dentro — stesso identico
// pattern "Filtri" già introdotto per il menu asporto cliente (sezione 15, `FiltriSheet`/
// `FiltroAttivoChip`), qui adattato: single-select per gruppo (un solo servizio/stato alla
// volta, non multi-select come le categorie/allergeni dell'asporto — i due filtri restano
// mutuamente esclusivi al proprio interno, "Tutti"/"Tutte" incluso). A foglio chiuso restano
// visibili solo i filtri realmente attivi, come chip rimovibili in una riga sotto il pulsante.

type FiltroCategoria = 'TUTTI' | 'PISCINA' | 'ASPORTO' | 'PADEL';
type FiltroStato = 'TUTTI' | StatoPrenotazione;

type ItemStorico =
  | { categoria: 'PISCINA'; id: string; data: string; ora: string; stato: StatoPrenotazione; item: PrenotazionePiscina }
  | { categoria: 'ASPORTO'; id: string; data: string; ora: string; stato: StatoPrenotazione; item: PrenotazioneAsporto }
  | { categoria: 'PADEL'; id: string; data: string; ora: string; stato: StatoPrenotazione; item: PrenotazionePadel };

const CATEGORIA_META: Record<Exclude<FiltroCategoria, 'TUTTI'>, { emoji: string; label: string }> = {
  PISCINA: { emoji: '🏊', label: 'Piscina' },
  ASPORTO: { emoji: '🥡', label: 'Asporto' },
  PADEL: { emoji: '🎾', label: 'Padel' },
};

function StatoBadge({ stato }: Readonly<{ stato: StatoPrenotazione }>) {
  return (
    <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[stato].bg}`}>
      <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[stato].text}`}>
        {STATO_PRENOTAZIONE_LABEL[stato]}
      </Text>
    </Box>
  );
}

// Badge categoria mostrato su ogni card ora che l'elenco è unificato — nella vecchia resa a
// sezioni separate il titolo di sezione ("🏊 Piscina" ecc.) bastava da solo, mescolate insieme
// serve un indizio diretto sulla card stessa.
function CategoriaBadge({ categoria }: Readonly<{ categoria: Exclude<FiltroCategoria, 'TUTTI'> }>) {
  const meta = CATEGORIA_META[categoria];
  return (
    <Box className="rounded-full bg-sky-50 px-2 py-0.5">
      <Text size="2xs" className="font-semibold text-sky-700">
        {meta.emoji} {meta.label}
      </Text>
    </Box>
  );
}

// Stessa forma/stesso linguaggio visivo di FiltroChip in app/cliente/asporto/index.tsx (sezione
// 15) — copiato localmente invece di condiviso, un solo chiamante in più non giustifica ancora
// un modulo comune (stesso principio "copia diretta" già seguito altrove nel progetto).
function FiltroChip({
  label,
  selected,
  count,
  onPress,
}: Readonly<{ label: string; selected: boolean; count: number; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'prenotazione' : 'prenotazioni'}${selected ? ', filtro attivo' : ''}`}
      className={`min-h-9 items-center justify-center rounded-full border-2 px-3.5 py-1.5 ${
        selected ? 'border-sky-600 bg-sky-600' : 'border-sky-200 bg-white active:bg-sky-50'
      }`}
    >
      <Text size="xs" className={`font-medium ${selected ? 'text-white' : 'text-sky-800'}`}>
        {label} ({count})
      </Text>
    </Pressable>
  );
}

// Chip "rimuovibile" della riga riepilogo filtri attivi, sotto il pulsante Filtri a foglio
// chiuso — stessa identica forma di `FiltroAttivoChip` in app/cliente/asporto/index.tsx.
function FiltroAttivoChip({ label, onRemove }: Readonly<{ label: string; onRemove: () => void }>) {
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Rimuovi filtro ${label}`}
      className="flex-row items-center gap-1 rounded-full border-2 border-sky-600 bg-sky-600 px-3 py-1.5 active:bg-sky-700"
    >
      <Text size="xs" className="font-medium text-white">
        {label}
      </Text>
      <Icon as={CloseIcon} size="xs" className="text-white" />
    </Pressable>
  );
}

// Foglio filtri, stesso pattern "Filtri" già collaudato nel menu asporto cliente (sezione 15) —
// a differenza di quello (multi-select per gruppo), qui ogni sezione resta a scelta singola:
// "Tutti"/"Tutte" è semplicemente un'altra opzione dello stesso gruppo, non un pulsante separato.
function FiltriSheet({
  isOpen,
  onClose,
  mostraCategoria,
  mostraStato,
  categorieConRisultati,
  statiConRisultati,
  conteggiCategoria,
  conteggiStato,
  filtroCategoria,
  filtroStato,
  onSelectCategoria,
  onSelectStato,
  onClear,
  risultati,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  mostraCategoria: boolean;
  mostraStato: boolean;
  categorieConRisultati: readonly Exclude<FiltroCategoria, 'TUTTI'>[];
  statiConRisultati: readonly StatoPrenotazione[];
  conteggiCategoria: Record<FiltroCategoria, number>;
  conteggiStato: Record<FiltroStato, number>;
  filtroCategoria: FiltroCategoria;
  filtroStato: FiltroStato;
  onSelectCategoria: (c: FiltroCategoria) => void;
  onSelectStato: (s: FiltroStato) => void;
  onClear: () => void;
  risultati: number;
}>) {
  const haFiltriAttivi = filtroCategoria !== 'TUTTI' || filtroStato !== 'TUTTI';
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent aria-label="Filtri">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ActionsheetScrollView className="w-full">
          <VStack space="lg" className="w-full pb-6">
            <HStack className="items-center justify-between">
              <Heading size="md">Filtri</Heading>
              {haFiltriAttivi ? (
                <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Cancella tutti i filtri">
                  <Text size="xs" className="font-semibold text-sky-700">
                    Cancella tutti
                  </Text>
                </Pressable>
              ) : null}
            </HStack>

            {mostraCategoria ? (
              <VStack space="xs">
                <Text size="sm" className="font-semibold text-sky-900">
                  Servizio
                </Text>
                <HStack space="xs" className="flex-wrap">
                  <FiltroChip
                    label="Tutti"
                    selected={filtroCategoria === 'TUTTI'}
                    count={conteggiCategoria.TUTTI}
                    onPress={() => onSelectCategoria('TUTTI')}
                  />
                  {categorieConRisultati.map((c) => (
                    <FiltroChip
                      key={c}
                      label={`${CATEGORIA_META[c].emoji} ${CATEGORIA_META[c].label}`}
                      selected={filtroCategoria === c}
                      count={conteggiCategoria[c]}
                      onPress={() => onSelectCategoria(c)}
                    />
                  ))}
                </HStack>
              </VStack>
            ) : null}

            {mostraStato ? (
              <VStack space="xs">
                <Text size="sm" className="font-semibold text-sky-900">
                  Stato
                </Text>
                <HStack space="xs" className="flex-wrap">
                  <FiltroChip
                    label="Tutte"
                    selected={filtroStato === 'TUTTI'}
                    count={conteggiStato.TUTTI}
                    onPress={() => onSelectStato('TUTTI')}
                  />
                  {statiConRisultati.map((s) => (
                    <FiltroChip
                      key={s}
                      label={STATO_PRENOTAZIONE_LABEL[s]}
                      selected={filtroStato === s}
                      count={conteggiStato[s]}
                      onPress={() => onSelectStato(s)}
                    />
                  ))}
                </HStack>
              </VStack>
            ) : null}

            <Button onPress={onClose}>
              <ButtonText>
                Mostra {risultati} {risultati === 1 ? 'prenotazione' : 'prenotazioni'}
              </ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

// Le card sono cliccabili (2026-08-22, su richiesta esplicita dell'utente) — ma il pulsante di
// download deve restare un target separato: due `Pressable` sorelle, non annidate (stesso
// principio anti-`<button>`-dentro-`<button>` già documentato altrove nel progetto, es.
// NotificaCard/ProdottoRigaCliccabile) — la parte informativa apre il dettaglio, il pulsante
// sotto il divisore scarica il PDF senza mai navigare.
function PiscinaCard({ prenotazione }: Readonly<{ prenotazione: PrenotazionePiscina }>) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Icone ingresso costruite in linea, non tramite la condivisa `formatIngressiSummary()` —
  // quella mostra deliberatamente "🎟️ 0" anche a zero ingressi interi (coerenza tabellare in
  // altri punti del progetto, es. ClientiDelGiornoSheet.tsx staff), fuorviante qui invece: stesso
  // fix già applicato il 2026-09-07 a PrenotazioneRow nella scheda cliente staff (sezione 5),
  // ora esteso a questa card cliente — stesso criterio "> 0" già usato per le altre risorse.
  const risorse = [
    prenotazione.ingressi > 0 ? `🎟️ ${prenotazione.ingressi}` : null,
    prenotazione.ingressi_ridotti > 0 ? `🌇 ${prenotazione.ingressi_ridotti}` : null,
    prenotazione.ingressi_bambini > 0 ? `🧒 ${prenotazione.ingressi_bambini}` : null,
    prenotazione.ingressi_gratuiti > 0 ? `🆓 ${prenotazione.ingressi_gratuiti}` : null,
    prenotazione.ombrellone > 0 ? `⛱️ ${prenotazione.ombrellone}` : null,
    prenotazione.gazebo > 0 ? `⛺ ${prenotazione.gazebo}` : null,
    prenotazione.lettino > 0 ? `🛏️ ${prenotazione.lettino}` : null,
    prenotazione.sdraia > 0 ? `🪑 ${prenotazione.sdraia}` : null,
  ]
    .filter((v): v is string => v !== null)
    .join(' ');

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getBigliettoUrl(prenotazione.id), prenotazione.id);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box className="w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <Pressable
        onPress={() => router.push(`/cliente/storico/piscina/${prenotazione.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Vedi dettaglio prenotazione piscina del ${formatDateDDMMYYYY(prenotazione.data)}`}
        className="p-4 active:bg-sky-50"
      >
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack>
              <Text size="sm" className="font-semibold text-sky-900">
                {prenotazione.inventario_nome}
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
                <Text size="xs" className="text-sky-900/70">
                  {formatDateDDMMYYYY(prenotazione.data)} · {formatTime(prenotazione.ora)}
                </Text>
              </HStack>
            </VStack>
            <VStack space="xs" className="items-end">
              <StatoBadge stato={prenotazione.stato} />
              <CategoriaBadge categoria="PISCINA" />
            </VStack>
          </HStack>

          {risorse ? (
            <Text size="xs" className="text-sky-900/80">
              {risorse}
            </Text>
          ) : null}

          {prenotazione.note ? (
            <Text size="xs" className="italic text-sky-900/70">
              📝 {prenotazione.note}
            </Text>
          ) : null}

          <HStack className="items-center justify-end">
            <Text size="xs" className="font-semibold text-sky-600">
              Vedi dettaglio
            </Text>
            <Icon as={ChevronRightIcon} size="xs" className="text-sky-600" />
          </HStack>
        </VStack>
      </Pressable>

      {prenotazione.stato !== 'CANCELLED' ? (
        <Box className="border-t border-sky-100 p-3">
          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-sky-300 bg-white"
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Scarica biglietto</ButtonText>
              </>
            )}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

function AsportoCard({ ordine }: Readonly<{ ordine: PrenotazioneAsporto }>) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getRicevutaUrl(ordine.id), ordine.id, 'ricevuta');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box className="w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <Pressable
        onPress={() => router.push(`/cliente/storico/asporto/${ordine.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Vedi dettaglio ordine asporto del ${formatDateDDMMYYYY(ordine.data)}`}
        className="p-4 active:bg-sky-50"
      >
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack>
              <Text size="sm" className="font-semibold text-sky-900">
                Ritiro asporto
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
                <Text size="xs" className="text-sky-900/70">
                  {formatDateDDMMYYYY(ordine.data)} · {formatTime(ordine.ora)}
                </Text>
              </HStack>
            </VStack>
            <VStack space="xs" className="items-end">
              <StatoBadge stato={ordine.stato} />
              <CategoriaBadge categoria="ASPORTO" />
            </VStack>
          </HStack>

          <Text size="xs" className="font-semibold text-sky-900">
            Totale: €{formatPrezzo(ordine.totale)}
          </Text>

          {ordine.note ? (
            <Text size="xs" className="italic text-sky-900/70">
              📝 {ordine.note}
            </Text>
          ) : null}

          <HStack className="items-center justify-end">
            <Text size="xs" className="font-semibold text-sky-600">
              Vedi dettaglio
            </Text>
            <Icon as={ChevronRightIcon} size="xs" className="text-sky-600" />
          </HStack>
        </VStack>
      </Pressable>

      {ordine.stato !== 'CANCELLED' ? (
        <Box className="border-t border-sky-100 p-3">
          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-sky-300 bg-white"
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Scarica ricevuta</ButtonText>
              </>
            )}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

function PadelCard({ partita }: Readonly<{ partita: PrenotazionePadel }>) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getBigliettoPadelUrl(partita.id), partita.id, 'biglietto-padel');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Box className="w-full overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm">
      <Pressable
        onPress={() => router.push(`/cliente/storico/padel/${partita.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Vedi dettaglio partita padel del ${formatDateDDMMYYYY(partita.data)}`}
        className="p-4 active:bg-sky-50"
      >
        <VStack space="sm">
          <HStack className="items-start justify-between">
            <VStack>
              <Text size="sm" className="font-semibold text-sky-900">
                Campo da padel
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={ClockIcon} size="2xs" className="text-sky-600" />
                <Text size="xs" className="text-sky-900/70">
                  {formatDateDDMMYYYY(partita.data)} · {formatFasciaPartita(partita.ora, partita.orario_fine)}
                </Text>
              </HStack>
            </VStack>
            <VStack space="xs" className="items-end">
              <StatoBadge stato={partita.stato} />
              <CategoriaBadge categoria="PADEL" />
            </VStack>
          </HStack>

          <Text size="xs" className="text-sky-900/80">
            {partita.partecipanti} {partita.partecipanti === 1 ? 'giocatore' : 'giocatori'}
            {partita.palline_noleggiate ? ' · 🎾 palline' : ''}
            {partita.racchette_totali > 0 ? ` · ${partita.racchette_totali} racchette` : ''}
          </Text>

          <Text size="xs" className="font-semibold text-sky-900">
            Totale: €{formatPrezzo(partita.totale)}
          </Text>

          {partita.note ? (
            <Text size="xs" className="italic text-sky-900/70">
              📝 {partita.note}
            </Text>
          ) : null}

          <HStack className="items-center justify-end">
            <Text size="xs" className="font-semibold text-sky-600">
              Vedi dettaglio
            </Text>
            <Icon as={ChevronRightIcon} size="xs" className="text-sky-600" />
          </HStack>
        </VStack>
      </Pressable>

      {partita.stato !== 'CANCELLED' ? (
        <Box className="border-t border-sky-100 p-3">
          <Button
            size="sm"
            variant="outline"
            className="self-start border-2 border-sky-300 bg-white"
            onPress={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Scarica biglietto</ButtonText>
              </>
            )}
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}

export default function StoricoPrenotazioniScreen() {
  const { telefono } = useLocalSearchParams<{ telefono: string }>();
  const [piscina, setPiscina] = useState<PrenotazionePiscina[]>([]);
  const [asporto, setAsporto] = useState<PrenotazioneAsporto[]>([]);
  const [padel, setPadel] = useState<PrenotazionePadel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('TUTTI');
  const [filtroStato, setFiltroStato] = useState<FiltroStato>('TUTTI');
  const [isFiltriOpen, setIsFiltriOpen] = useState(false);
  const [isStoricoOpen, setIsStoricoOpen] = useState(false);

  useEffect(() => {
    if (!telefono) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([
      getStoricoPiscinaPerTelefono(telefono),
      getStoricoAsportoPerTelefono(telefono),
      getStoricoPadelPerTelefono(telefono),
    ])
      .then(([piscinaData, asportoData, padelData]) => {
        if (cancelled) return;
        setPiscina(piscinaData);
        setAsporto(asportoData);
        setPadel(padelData);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare lo storico. Riprova più tardi.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [telefono]);

  const nomeCliente = piscina[0]?.cliente_nome ?? asporto[0]?.cliente_nome ?? padel[0]?.cliente_nome ?? null;

  // Le tre liste, unite in un unico array taggato e ordinato dalla più recente alla meno
  // recente — di default (nessun filtro attivo) è esattamente questo array a essere mostrato,
  // come richiesto esplicitamente dall'utente. Ordinamento per confronto lessicografico su
  // "data" poi "ora" (entrambi formati ordinabili come stringa, "YYYY-MM-DD"/"HH:MM:SS" — stesso
  // principio già usato per lo storico prenotazioni della scheda cliente staff, sezione 5).
  const tutte: ItemStorico[] = useMemo(() => {
    const combinate: ItemStorico[] = [
      ...piscina.map((item) => ({ categoria: 'PISCINA' as const, id: item.id, data: item.data, ora: item.ora, stato: item.stato, item })),
      ...asporto.map((item) => ({ categoria: 'ASPORTO' as const, id: item.id, data: item.data, ora: item.ora, stato: item.stato, item })),
      ...padel.map((item) => ({ categoria: 'PADEL' as const, id: item.id, data: item.data, ora: item.ora, stato: item.stato, item })),
    ];
    return combinate.sort((a, b) => {
      const chiaveA = `${a.data}T${a.ora}`;
      const chiaveB = `${b.data}T${b.ora}`;
      return chiaveB.localeCompare(chiaveA);
    });
  }, [piscina, asporto, padel]);

  // Conteggi calcolati sull'intero elenco unificato, non incrociati con l'altro filtro già
  // attivo — stesso principio "conteggio sul catalogo intero, non ricalcolato dinamicamente" già
  // seguito per i filtri del menu asporto cliente (sezione 15).
  const conteggiCategoria: Record<FiltroCategoria, number> = {
    TUTTI: tutte.length,
    PISCINA: piscina.length,
    ASPORTO: asporto.length,
    PADEL: padel.length,
  };
  const conteggiStato: Record<FiltroStato, number> = {
    TUTTI: tutte.length,
    PENDING: tutte.filter((i) => i.stato === 'PENDING').length,
    CONFIRMED: tutte.filter((i) => i.stato === 'CONFIRMED').length,
    CANCELLED: tutte.filter((i) => i.stato === 'CANCELLED').length,
  };

  const filtrate = useMemo(
    () =>
      tutte.filter(
        (i) =>
          (filtroCategoria === 'TUTTI' || i.categoria === filtroCategoria) &&
          (filtroStato === 'TUTTI' || i.stato === filtroStato)
      ),
    [tutte, filtroCategoria, filtroStato]
  );

  // "In programma" / "Storico", applicate al flusso già filtrato da categoria/stato — stesso
  // identico criterio già in uso per piscina/asporto/padel nella scheda cliente staff (sezione
  // 5): non cancellata e non ancora passata (solo la data, non l'orario esatto, stesso criterio
  // usato ovunque nel progetto). "In programma" ordinata ascendente (ricalcolata invertendo
  // `filtrate`, già discendente); "Storico" mantiene l'ordine discendente già presente.
  const oggiISO = useMemo(() => toISODate(new Date()), []);
  const inProgramma = useMemo(
    () =>
      [...filtrate].filter((i) => i.stato !== 'CANCELLED' && i.data >= oggiISO).reverse(),
    [filtrate, oggiISO]
  );
  const storico = useMemo(
    () => filtrate.filter((i) => i.stato === 'CANCELLED' || i.data < oggiISO),
    [filtrate, oggiISO]
  );

  // Le righe di filtro compaiono solo se c'è davvero qualcosa da distinguere — un cliente con
  // sole prenotazioni piscina, tutte confermate, non ha bisogno di vedere due righe di chip che
  // non farebbero altro che duplicare "Tutti (N)".
  const categorieConRisultati = (['PISCINA', 'ASPORTO', 'PADEL'] as const).filter((c) => conteggiCategoria[c] > 0);
  const mostraFiltroCategoria = categorieConRisultati.length > 1;
  const statiConRisultati = (['PENDING', 'CONFIRMED', 'CANCELLED'] as const).filter((s) => conteggiStato[s] > 0);
  const mostraFiltroStato = statiConRisultati.length > 1;

  const numeroFiltriAttivi = (filtroCategoria !== 'TUTTI' ? 1 : 0) + (filtroStato !== 'TUTTI' ? 1 : 0);
  const chipsFiltriAttivi: { key: string; label: string; onRemove: () => void }[] = [
    ...(filtroCategoria !== 'TUTTI'
      ? [
          {
            key: 'categoria',
            label: `${CATEGORIA_META[filtroCategoria].emoji} ${CATEGORIA_META[filtroCategoria].label}`,
            onRemove: () => setFiltroCategoria('TUTTI'),
          },
        ]
      : []),
    ...(filtroStato !== 'TUTTI'
      ? [{ key: 'stato', label: STATO_PRENOTAZIONE_LABEL[filtroStato], onRemove: () => setFiltroStato('TUTTI') }]
      : []),
  ];
  const clearFiltri = () => {
    setFiltroCategoria('TUTTI');
    setFiltroStato('TUTTI');
  };

  if (!telefono) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full">
          <Text size="sm" className="text-center text-destructive">
            Numero di telefono mancante.
          </Text>
          <BackButton fallbackHref="/cliente" />
        </VStack>
      </ScrollView>
    );
  }

  return (
    <>
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">📖 Le mie prenotazioni</Heading>
          <Text size="sm" className="text-muted-foreground">
            {nomeCliente ? `${nomeCliente} · ` : ''}
            {telefono}
          </Text>
        </VStack>

        {isLoading ? (
          <HStack className="items-center justify-center py-10">
            <Spinner size="large" />
          </HStack>
        ) : error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : tutte.length === 0 ? (
          <VStack
            space="sm"
            className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
          >
            <Text size="lg">🔍</Text>
            <Text size="sm" className="text-center text-muted-foreground">
              Nessuna prenotazione trovata per questo numero di telefono.
            </Text>
          </VStack>
        ) : (
          <>
            {mostraFiltroCategoria || mostraFiltroStato ? (
              <VStack space="sm">
                <Pressable
                  onPress={() => setIsFiltriOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Filtri${numeroFiltriAttivi > 0 ? `, ${numeroFiltriAttivi} attivi` : ''}`}
                  className="min-h-10 flex-row items-center gap-2 self-start rounded-full border-2 border-sky-300 bg-white px-4 py-2 active:bg-sky-50"
                >
                  <Icon as={SlidersIcon} size="sm" className="text-sky-700" />
                  <Text size="sm" className="font-semibold text-sky-800">
                    Filtri
                  </Text>
                  {numeroFiltriAttivi > 0 ? (
                    <Box className="h-5 w-5 items-center justify-center rounded-full bg-sky-600">
                      <Text size="2xs" className="font-bold text-white">
                        {numeroFiltriAttivi}
                      </Text>
                    </Box>
                  ) : null}
                </Pressable>

                {numeroFiltriAttivi > 0 ? (
                  <HStack space="xs" className="flex-wrap items-center">
                    {chipsFiltriAttivi.map((chip) => (
                      <FiltroAttivoChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
                    ))}
                  </HStack>
                ) : null}
              </VStack>
            ) : null}

            {filtrate.length === 0 ? (
              <Text size="sm" className="text-center text-muted-foreground">
                Nessuna prenotazione corrisponde ai filtri selezionati.
              </Text>
            ) : (
              <VStack space="lg">
                <VStack space="sm">
                  <Heading size="md">📅 In programma</Heading>
                  {inProgramma.length === 0 ? (
                    <Text size="sm" className="text-muted-foreground">
                      Nessuna prenotazione in programma.
                    </Text>
                  ) : (
                    inProgramma.map((i) => {
                      if (i.categoria === 'PISCINA') return <PiscinaCard key={i.id} prenotazione={i.item} />;
                      if (i.categoria === 'ASPORTO') return <AsportoCard key={i.id} ordine={i.item} />;
                      return <PadelCard key={i.id} partita={i.item} />;
                    })
                  )}
                </VStack>

                {storico.length > 0 ? (
                  <VStack space="sm">
                    <Pressable
                      onPress={() => setIsStoricoOpen((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={`${isStoricoOpen ? 'Nascondi' : 'Mostra'} storico, ${storico.length} ${storico.length === 1 ? 'prenotazione' : 'prenotazioni'}`}
                      className="min-h-9 flex-row items-center gap-1 self-start"
                    >
                      <Text size="md" className="font-bold text-sky-900">
                        🕘 Storico ({storico.length})
                      </Text>
                      <Icon as={isStoricoOpen ? ChevronUpIcon : ChevronDownIcon} size="sm" className="text-sky-700" />
                    </Pressable>

                    {isStoricoOpen ? (
                      <VStack space="sm">
                        {storico.map((i) => {
                          if (i.categoria === 'PISCINA') return <PiscinaCard key={i.id} prenotazione={i.item} />;
                          if (i.categoria === 'ASPORTO') return <AsportoCard key={i.id} ordine={i.item} />;
                          return <PadelCard key={i.id} partita={i.item} />;
                        })}
                      </VStack>
                    ) : null}
                  </VStack>
                ) : null}
              </VStack>
            )}
          </>
        )}

        <BackButton fallbackHref="/cliente" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
    <FiltriSheet
      isOpen={isFiltriOpen}
      onClose={() => setIsFiltriOpen(false)}
      mostraCategoria={mostraFiltroCategoria}
      mostraStato={mostraFiltroStato}
      categorieConRisultati={categorieConRisultati}
      statiConRisultati={statiConRisultati}
      conteggiCategoria={conteggiCategoria}
      conteggiStato={conteggiStato}
      filtroCategoria={filtroCategoria}
      filtroStato={filtroStato}
      onSelectCategoria={setFiltroCategoria}
      onSelectStato={setFiltroStato}
      onClear={clearFiltri}
      risultati={filtrate.length}
    />
    </>
  );
}
