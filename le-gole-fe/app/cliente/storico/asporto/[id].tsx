import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { ArrowLeftIcon, ClockIcon, DownloadIcon, Icon, RepeatIcon } from '@/components/ui/icon';
import { goBackOr } from '../../../../src/utils/navigation';
import { ClienteFooter } from '../../../../src/components/cliente/ClienteFooter';
import { ConfermaOrdineAsporto, type RigaRiepilogoOrdineAsporto } from '../../../../src/components/cliente/ConfermaOrdineAsporto';
import {
  createPrenotazioneAsporto,
  getDettaglioPubblicoAsporto,
  getRicevutaUrl,
  type PrenotazioneAsportoDettaglio,
} from '../../../../src/services/prenotazioni';
import {
  createVoceOrdine,
  getConfigurazioneAsporto,
  getProdottiPrenotatiPerOrario,
  getProssimeChiusureAsporto,
  listProdotti,
  type ConfigurazioneAsporto,
  type Prodotto,
  type ProdottiPrenotatiPerOrario,
} from '../../../../src/services/menu';
import { apriBigliettoPdf } from '../../../../src/utils/biglietto';
import { extractErrorMessage } from '../../../../src/utils/errors';
import {
  formatDateDDMMYYYY,
  formatTime,
  generaSlotOrario,
  nowHHMM,
  parseHHMMToMinutes,
  raggruppaSlotPerOra,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
  type BloccoOrario,
} from '../../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../../src/utils/prezzi';

// Pagina di dettaglio raggiunta da una card di app/cliente/storico/index.tsx — stesso identico
// principio "UUID come segreto" di quella piscina (nessun telefono richiesto qui). In più offre
// il riordino (2026-08-22, su richiesta esplicita dell'utente): ricrea un nuovo ordine con le
// stesse righe prodotto, sempre per OGGI (un ordine asporto non ha mai una data scelta, sezione
// 15 — il riordino eredita questa stessa regola), chiedendo al cliente solo l'orario di ritiro.

// Stesso anticipo minimo standard del checkout self-service (app/cliente/asporto/index.tsx) —
// qui non esiste un concetto di carrello/quantità pizze da rileggere (`PrenotazioneAsportoDettaglio.voci`
// non porta la categoria del prodotto), quindi nessuna variante "estesa" a 30 minuti: un solo
// anticipo fisso, sufficiente perché il riordino è comunque sempre per oggi.
const ANTICIPO_MINUTI_RIORDINO = 15;
// Sotto questo numero di prodotti ancora prenotabili per un orario, mostriamo il conteggio
// residuo sotto lo slot — stessa soglia/stesso principio del checkout self-service.
const SOGLIA_AVVISO_RESIDUO_ORARIO = 5;
// Sotto questa ulteriore soglia il testo passa da ambra a rosa — stessa scala e stessa soglia del
// checkout self-service (app/cliente/asporto/index.tsx), duplicata identica qui.
const RESIDUO_CRITICO = 2;

// Colore del testo "N rimasti" — sta FUORI dal bottone dello slot (didascalia sotto, non più un
// badge annidato dentro il bottone), stessa funzione identica del checkout self-service.
function residuoTextClassName(residuo: number): string {
  return residuo <= RESIDUO_CRITICO ? 'text-rose-600' : 'text-amber-600';
}

type FinestraOraria = { apertura: string; chiusura: string };

// "Mostra un turno alla volta" (sezione 15) — stessa identica logica del checkout self-service
// (app/cliente/asporto/index.tsx): la finestra attiva è la prima non ancora chiusa, così lo
// switch tra pranzo e cena avviene da solo dopo la chiusura del turno in corso.
function getFinestraAttiva(configurazione: ConfigurazioneAsporto, nowMinuti: number): FinestraOraria {
  const finestre: FinestraOraria[] = [
    { apertura: formatTime(configurazione.orario_apertura), chiusura: formatTime(configurazione.orario_chiusura) },
  ];
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    finestre.push({
      apertura: formatTime(configurazione.orario_apertura_2),
      chiusura: formatTime(configurazione.orario_chiusura_2),
    });
  }
  return finestre.find((f) => parseHHMMToMinutes(f.chiusura)! > nowMinuti) ?? finestre.at(-1)!;
}

// Descrizione leggibile di entrambi i turni insieme — stessa forma di `descrizione_orari()` lato
// backend (menu/models.py, ConfigurazioneAsporto).
function descrizioneOrari(configurazione: ConfigurazioneAsporto): string {
  const turni = [`dalle ${formatTime(configurazione.orario_apertura)} alle ${formatTime(configurazione.orario_chiusura)}`];
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    turni.push(`dalle ${formatTime(configurazione.orario_apertura_2)} alle ${formatTime(configurazione.orario_chiusura_2)}`);
  }
  return turni.join(' e ');
}

// True se `minuti` rientra nel primo turno o, se configurato, nel secondo — stessa logica di
// `ConfigurazioneAsporto.orario_valido()` lato backend (menu/models.py), qui su minuti anziché
// su un `datetime.time`.
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

// Estratte dal JSX del picker orario (ternari annidati, rilevati da SonarQube — regola "Ternary
// operators should not be nested"/S3358, più i template literal annidati/S4624 dell'accessibility
// label) in funzioni pure con un solo livello di if/return ciascuna — stesso pattern già
// introdotto per lo stesso picker in app/staff/asporto/ordini/nuovo.tsx (sezione 15 di CLAUDE.md),
// qui in tinta emerald invece di sky.
function fasciaClassName(nonSelezionabile: boolean, isEspansa: boolean, contieneSelezionato: boolean): string {
  if (nonSelezionabile) return 'border-emerald-100 bg-white opacity-40';
  if (isEspansa) return 'border-emerald-600 bg-emerald-600';
  if (contieneSelezionato) return 'border-emerald-600 bg-white';
  return 'border-emerald-300 bg-white active:bg-emerald-100';
}

function fasciaTextClassName(nonSelezionabile: boolean, isEspansa: boolean): string {
  if (nonSelezionabile) return 'text-muted-foreground';
  if (isEspansa) return 'text-white';
  return 'text-emerald-900';
}

function slotClassName(selezionato: boolean, disabilitato: boolean): string {
  if (selezionato) return 'border-emerald-600 bg-emerald-600';
  if (disabilitato) return 'border-emerald-100 bg-white opacity-40';
  return 'border-emerald-300 bg-white active:bg-emerald-100';
}

function slotTextClassName(selezionato: boolean, disabilitato: boolean): string {
  if (selezionato) return 'font-bold text-white';
  if (disabilitato) return 'text-muted-foreground';
  return 'font-medium text-emerald-900';
}

function slotAccessibilityLabel(slot: string, esaurito: boolean, mostraResiduo: boolean, residuo: number | null): string {
  if (esaurito) return `Orario di ritiro ${slot}, esaurito: numero massimo di prodotti raggiunto per questo orario`;
  if (mostraResiduo) return `Orario di ritiro ${slot}, solo ${residuo} prodotti ancora disponibili per questo orario`;
  return `Orario di ritiro ${slot}`;
}

type PickerOrarioRiordinoProps = {
  blocchi: BloccoOrario[];
  oraEspansa: string | null;
  onToggleEspansa: (ora: string) => void;
  oraSelezionata: string;
  onSelectOra: (slot: string) => void;
  isSlotEsaurito: (slot: string) => boolean;
  residuoSlot: (slot: string) => number | null;
};

// Intero picker a due livelli (fasce → slot da 15 minuti), estratto dal corpo della schermata
// principale — oltre a raccogliere i ternari sopra in funzioni pure, l'estrazione in un
// componente a sé toglie dalla `DettaglioOrdineAsportoScreen` le due `.map()` annidate che ne
// gonfiavano la complessità cognitiva (SonarQube S3776, "Refactor this function to reduce its
// Cognitive Complexity from 23 to the 15 allowed") — stesso principio già seguito altrove nel
// progetto (es. `PiscinaTabContent`/`AsportoTabContent` in app/staff/clienti/[clienteId].tsx,
// sezione 5 di CLAUDE.md) per lo stesso genere di refactor.
function PickerOrarioRiordino({
  blocchi,
  oraEspansa,
  onToggleEspansa,
  oraSelezionata,
  onSelectOra,
  isSlotEsaurito,
  residuoSlot,
}: Readonly<PickerOrarioRiordinoProps>) {
  const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
  const slotsFasciaEspansa = blocchi.find((b) => b.ora === oraEspansa)?.slots ?? [];

  return (
    <>
      <HStack space="xs" className="flex-wrap">
        {blocchi.map((blocco) => {
          const isEspansa = blocco.ora === oraEspansa;
          const contieneSelezionato = blocco.slots.includes(oraSelezionata);
          const nonSelezionabile = blocco.slots.every(
            (slot) => parseHHMMToMinutes(slot)! < nowMinuti + ANTICIPO_MINUTI_RIORDINO || isSlotEsaurito(slot)
          );
          return (
            <Pressable
              key={blocco.ora}
              onPress={() => !nonSelezionabile && onToggleEspansa(blocco.ora)}
              disabled={nonSelezionabile}
              accessibilityRole="button"
              accessibilityLabel={`Fascia oraria ${blocco.label}${nonSelezionabile ? ', non più disponibile' : ''}`}
              accessibilityState={{ expanded: isEspansa, selected: contieneSelezionato, disabled: nonSelezionabile }}
              className={`rounded-full border-2 px-3 py-1.5 ${fasciaClassName(nonSelezionabile, isEspansa, contieneSelezionato)}`}
            >
              <Text size="xs" className={`font-medium ${fasciaTextClassName(nonSelezionabile, isEspansa)}`}>
                {contieneSelezionato && !isEspansa ? '✓ ' : ''}
                {blocco.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      {oraEspansa ? (
        <HStack space="xs" className="flex-wrap rounded-xl border border-emerald-200 bg-emerald-100/50 p-2">
          {slotsFasciaEspansa.map((slot) => {
            const minutiSlot = parseHHMMToMinutes(slot)!;
            const troppoVicino = minutiSlot < nowMinuti + ANTICIPO_MINUTI_RIORDINO;
            const esaurito = !troppoVicino && isSlotEsaurito(slot);
            const disabilitato = troppoVicino || esaurito;
            const selezionato = oraSelezionata === slot;
            const residuo = residuoSlot(slot);
            const mostraResiduo = !disabilitato && residuo !== null && residuo <= SOGLIA_AVVISO_RESIDUO_ORARIO;
            return (
              <VStack key={slot} className="items-center">
                <Pressable
                  onPress={() => !disabilitato && onSelectOra(slot)}
                  disabled={disabilitato}
                  accessibilityRole="button"
                  accessibilityLabel={slotAccessibilityLabel(slot, esaurito, mostraResiduo, residuo)}
                  className={`rounded-full border-2 px-3 py-1.5 ${slotClassName(selezionato, disabilitato)}`}
                >
                  <Text size="xs" className={slotTextClassName(selezionato, disabilitato)}>
                    {slot}
                    {esaurito ? ' · Esaurito' : ''}
                  </Text>
                </Pressable>
                {/* Didascalia FUORI dal bottone, esattamente sotto — stesso gotcha del checkout
                    self-service (app/cliente/asporto/index.tsx): font ridotto tramite la prop
                    nativa `style` (fontSize: 9), non una classe Tailwind arbitraria `text-[9px]`
                    (non applicata da NativeWind/react-native-css su questo target web). */}
                {mostraResiduo ? (
                  <Text style={{ fontSize: 9 }} className={`font-semibold ${residuoTextClassName(residuo!)}`}>
                    {residuo} rimast{residuo === 1 ? 'o' : 'i'}
                  </Text>
                ) : null}
              </VStack>
            );
          })}
        </HStack>
      ) : (
        <Text size="2xs" className="text-emerald-900/60">
          Tocca una fascia oraria per scegliere l'orario esatto.
        </Text>
      )}
    </>
  );
}

function DettaglioHeader() {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/cliente')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Dettaglio ordine</Heading>
        <Text size="sm" className="text-muted-foreground">
          Asporto
        </Text>
      </VStack>
    </HStack>
  );
}

export default function DettaglioOrdineAsportoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ordine, setOrdine] = useState<PrenotazioneAsportoDettaglio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const [configurazione, setConfigurazione] = useState<ConfigurazioneAsporto | null>(null);
  const [chiusoOggi, setChiusoOggi] = useState(false);
  const [prenotatiPerOrario, setPrenotatiPerOrario] = useState<ProdottiPrenotatiPerOrario>({});
  // Catalogo completo (anche i prodotti nascosti, ProdottoViewSet non filtra per `disponibile` di
  // default) — serve solo a scoprire se uno dei prodotti dell'ordine originale è stato nascosto
  // dallo staff nel frattempo: un riordino self-service (richiesta anonima) verrebbe comunque
  // rifiutato dal backend per quel prodotto (VoceOrdineSerializer.validate_prodotto(), sezione 1
  // di CLAUDE.md), quindi qui blocchiamo l'azione in anticipo invece di lasciar fallire il submit
  // a metà (con una PrenotazioneAsporto già creata ma senza tutte le sue righe).
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);

  const [isReordering, setIsReordering] = useState(false);
  const [oraRiordino, setOraRiordino] = useState('');
  // Fascia oraria espansa nel picker orario del riordino — stesso identico principio
  // dell'accordion a due livelli del checkout self-service, nessuna precompilazione (il cliente
  // sceglie sempre esplicitamente uno slot tra quelli abilitati).
  const [oraEspansaRiordino, setOraEspansaRiordino] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [isSubmittingReorder, setIsSubmittingReorder] = useState(false);

  const finestraAttiva = useMemo(
    () => (configurazione ? getFinestraAttiva(configurazione, parseHHMMToMinutes(nowHHMM())!) : null),
    [configurazione]
  );

  const blocchiOrarioRiordino = useMemo(
    () => (finestraAttiva ? raggruppaSlotPerOra(generaSlotOrario(finestraAttiva.apertura, finestraAttiva.chiusura)) : []),
    [finestraAttiva]
  );

  // Stesso principio del checkout self-service (app/cliente/asporto/index.tsx): limite globale
  // di prodotti per orario (ConfigurazioneAsporto.limite_prodotti_orario, sezione 15), confrontato
  // con la quantità totale di prodotti che il riordino ricreerebbe — sempre la stessa dell'ordine
  // originale, nessun carrello da poter cambiare qui.
  const limiteProdottiOrario = configurazione?.limite_prodotti_orario ?? null;
  const richiestiRiordino = Math.max(
    ordine?.voci.reduce((sum, voce) => sum + voce.quantita, 0) ?? 0,
    1
  );
  const isSlotEsaurito = (slot: string) => {
    if (limiteProdottiOrario === null) return false;
    const prenotati = prenotatiPerOrario[slot] ?? 0;
    return limiteProdottiOrario - prenotati < richiestiRiordino;
  };
  // Residuo "grezzo" dello slot (limite meno quanto già prenotato da tutti) — stesso principio
  // del checkout self-service: non tiene conto di richiestiRiordino, serve solo a mostrare
  // "quanti ne restano in tutto".
  const residuoSlot = (slot: string): number | null => {
    if (limiteProdottiOrario === null) return null;
    const prenotati = prenotatiPerOrario[slot] ?? 0;
    return limiteProdottiOrario - prenotati;
  };

  // Nomi (deduplicati) dei prodotti dell'ordine originale non più disponibili — un riordino li
  // includerebbe comunque tutti (nessuna selezione parziale, sezione 15 di CLAUDE.md), quindi
  // basta uno solo non più disponibile per bloccare l'intera azione.
  const nomiProdottiNonDisponibili = useMemo(() => {
    if (!ordine || prodotti.length === 0) return [];
    const nomi = new Set<string>();
    for (const voce of ordine.voci) {
      const prodotto = prodotti.find((p) => p.id === voce.prodotto);
      if (!prodotto || !prodotto.disponibile) nomi.add(voce.prodotto_nome);
    }
    return Array.from(nomi);
  }, [ordine, prodotti]);
  const riordinoBloccatoPerDisponibilita = nomiProdottiNonDisponibili.length > 0;

  // Riepilogo del riordino appena completato — quando valorizzato, la pagina mostra la stessa
  // schermata di conferma del checkout self-service (`ConfermaOrdineAsporto`, condivisa con
  // app/cliente/asporto/index.tsx) invece di navigare al dettaglio del nuovo ordine, su richiesta
  // esplicita dell'utente (2026-08-23).
  const [riepilogoRiordino, setRiepilogoRiordino] = useState<{
    nome: string;
    orario: string;
    righe: RigaRiepilogoOrdineAsporto[];
    totale: number;
    prenotazioneId: string;
  } | null>(null);
  const [isDownloadingRiordino, setIsDownloadingRiordino] = useState(false);
  const [downloadRiordinoError, setDownloadRiordinoError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([
      getDettaglioPubblicoAsporto(id),
      getConfigurazioneAsporto(),
      getProssimeChiusureAsporto(),
      getProdottiPrenotatiPerOrario(toISODate(new Date())),
      listProdotti(),
    ])
      .then(([ordineData, configurazioneData, chiusureData, prenotatiData, prodottiData]) => {
        if (cancelled) return;
        setOrdine(ordineData);
        setConfigurazione(configurazioneData);
        setChiusoOggi(chiusureData.includes(toISODate(new Date())));
        setPrenotatiPerOrario(prenotatiData);
        setProdotti(prodottiData);
      })
      .catch(() => {
        if (!cancelled) setError('Ordine non trovato.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleScaricaRicevutaRiordino = async () => {
    if (!riepilogoRiordino) return;
    setIsDownloadingRiordino(true);
    try {
      await apriBigliettoPdf(getRicevutaUrl(riepilogoRiordino.prenotazioneId), riepilogoRiordino.prenotazioneId, 'ricevuta');
    } catch {
      setDownloadRiordinoError('Impossibile scaricare la ricevuta. Riprova.');
    } finally {
      setIsDownloadingRiordino(false);
    }
  };

  const handleDownload = async () => {
    if (!ordine) return;
    setIsDownloading(true);
    try {
      await apriBigliettoPdf(getRicevutaUrl(ordine.id), ordine.id, 'ricevuta');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSubmitRiordino = async () => {
    if (!ordine) return;
    // Backstop: il pulsante "Riordina" è già disabilitato in questo caso (sotto), ma la funzione
    // ripete comunque il controllo — stesso principio "mai fidarsi solo del disabled lato UI"
    // seguito ovunque nel progetto. Senza questo controllo, il submit creerebbe comunque la
    // PrenotazioneAsporto e solo dopo fallirebbe su una VoceOrdine (il backend rifiuta un prodotto
    // non più disponibile per una richiesta anonima), lasciando un ordine orfano/incompleto.
    if (riordinoBloccatoPerDisponibilita) {
      setReorderError(
        `Non è possibile riordinare: ${nomiProdottiNonDisponibili.join(', ')} non ${
          nomiProdottiNonDisponibili.length === 1 ? 'è più disponibile' : 'sono più disponibili'
        }.`
      );
      return;
    }
    const minuti = parseHHMMToMinutes(oraRiordino);
    if (minuti === null) {
      setReorderError('Inserisci un orario di ritiro valido (HH:MM).');
      return;
    }
    if (configurazione && !isOraInFinestre(configurazione, minuti)) {
      setReorderError(`Il servizio asporto è attivo ${descrizioneOrari(configurazione)}.`);
      return;
    }
    // Backstop: la UI (sotto) disabilita già ogni slot/fascia troppo vicina all'ora attuale, ma
    // la funzione ripete comunque il controllo — stesso principio "mai fidarsi solo del disabled
    // lato UI" seguito ovunque nel progetto.
    if (minuti < parseHHMMToMinutes(nowHHMM())! + ANTICIPO_MINUTI_RIORDINO) {
      setReorderError(`Con il riordino serve un anticipo di almeno ${ANTICIPO_MINUTI_RIORDINO} minuti rispetto all'ora attuale.`);
      return;
    }
    if (isSlotEsaurito(oraRiordino.trim())) {
      setReorderError('Numero massimo di prodotti raggiunto per questo orario: scegli un altro orario.');
      return;
    }

    setReorderError(null);
    setIsSubmittingReorder(true);
    try {
      const nuovo = await createPrenotazioneAsporto({
        cliente_id: ordine.cliente_id,
        data: toISODate(new Date()),
        ora: oraRiordino.trim(),
        stato: 'CONFIRMED',
        note: ordine.note,
      });
      // Ogni `createVoceOrdine` risolta ritorna già la riga con lo snapshot di prezzo *corrente*
      // (mai quello dell'ordine originale, sezione 1 di CLAUDE.md) — riusata direttamente per il
      // riepilogo, nessuna richiesta aggiuntiva necessaria per rileggere il nuovo ordine.
      const nuoveVoci = await Promise.all(
        ordine.voci.map((voce) =>
          createVoceOrdine({ prenotazione: nuovo.id, prodotto: voce.prodotto, quantita: voce.quantita })
        )
      );
      setRiepilogoRiordino({
        nome: ordine.cliente_nome,
        orario: oraRiordino.trim(),
        righe: nuoveVoci.map((voce) => ({
          id: voce.id,
          nome: voce.prodotto_nome,
          quantita: voce.quantita,
          subtotale: Number.parseFloat(voce.subtotale) || 0,
        })),
        totale: nuoveVoci.reduce((sum, voce) => sum + (Number.parseFloat(voce.subtotale) || 0), 0),
        prenotazioneId: nuovo.id,
      });
    } catch (err) {
      setReorderError(extractErrorMessage(err, 'Impossibile completare il riordino. Riprova.'));
    } finally {
      setIsSubmittingReorder(false);
    }
  };

  if (isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !ordine) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full">
          <DettaglioHeader />
          <Text size="sm" className="text-center text-destructive">
            {error ?? 'Ordine non trovato.'}
          </Text>
        </VStack>
      </ScrollView>
    );
  }

  if (riepilogoRiordino) {
    return (
      <ConfermaOrdineAsporto
        nome={riepilogoRiordino.nome}
        orario={riepilogoRiordino.orario}
        righe={riepilogoRiordino.righe}
        totale={riepilogoRiordino.totale}
        isDownloading={isDownloadingRiordino}
        onScaricaRicevuta={handleScaricaRicevutaRiordino}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={downloadRiordinoError}
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <DettaglioHeader />

        <Box className="w-full rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
          <VStack space="md">
            <HStack className="items-start justify-between">
              <VStack>
                <Text size="lg" className="font-bold text-sky-900">
                  Ritiro asporto
                </Text>
                <HStack space="xs" className="items-center">
                  <Icon as={ClockIcon} size="xs" className="text-sky-600" />
                  <Text size="sm" className="text-sky-900/70">
                    {formatDateDDMMYYYY(ordine.data)} · {formatTime(ordine.ora)}
                  </Text>
                </HStack>
              </VStack>
              <Box className={`rounded-full px-3 py-1.5 ${STATO_PRENOTAZIONE_BADGE[ordine.stato].bg}`}>
                <Text size="xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[ordine.stato].text}`}>
                  {STATO_PRENOTAZIONE_LABEL[ordine.stato]}
                </Text>
              </Box>
            </HStack>

            <Box className="h-px w-full bg-sky-100" />

            <VStack space="xs">
              <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                Cliente
              </Text>
              <HStack className="items-center justify-between py-1">
                <Text size="sm" className="text-sky-900/70">
                  👤 Nome
                </Text>
                <Text size="sm" className="font-semibold text-sky-900">
                  {ordine.cliente_nome}
                </Text>
              </HStack>
              <HStack className="items-center justify-between py-1">
                <Text size="sm" className="text-sky-900/70">
                  📞 Telefono
                </Text>
                <Text size="sm" className="font-semibold text-sky-900">
                  {ordine.cliente_telefono}
                </Text>
              </HStack>
            </VStack>

            <VStack space="xs">
              <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                Prodotti ordinati
              </Text>
              {ordine.voci.length === 0 ? (
                <Text size="sm" className="text-muted-foreground">
                  Nessun prodotto registrato per questo ordine.
                </Text>
              ) : (
                <VStack space="xs">
                  {ordine.voci.map((voce) => (
                    <HStack key={voce.id} className="items-center justify-between py-1">
                      <Text size="sm" className="flex-1 text-sky-900">
                        {voce.quantita}x {voce.prodotto_nome}
                      </Text>
                      <Text size="sm" className="font-medium text-sky-900">
                        €{formatPrezzo(voce.subtotale)}
                      </Text>
                    </HStack>
                  ))}
                </VStack>
              )}
              <Box className="h-px w-full bg-sky-100" />
              <HStack className="items-center justify-between">
                <Text size="sm" className="font-semibold text-sky-900">
                  Totale
                </Text>
                <Text size="md" className="font-bold text-sky-900">
                  €{formatPrezzo(ordine.totale)}
                </Text>
              </HStack>
            </VStack>

            {ordine.note ? (
              <VStack space="xs">
                <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
                  Note
                </Text>
                <Text size="sm" className="italic text-sky-900/80">
                  📝 {ordine.note}
                </Text>
              </VStack>
            ) : null}
          </VStack>
        </Box>

        {ordine.stato !== 'CANCELLED' ? (
          <Button variant="outline" className="border-2 border-sky-300 bg-white" onPress={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <ButtonSpinner />
            ) : (
              <>
                <ButtonIcon as={DownloadIcon} className="text-sky-700" />
                <ButtonText className="text-sky-700">Scarica ricevuta (PDF)</ButtonText>
              </>
            )}
          </Button>
        ) : null}

        {/* Riordino — sempre per oggi, l'unica scelta richiesta è l'orario di ritiro. */}
        {!isReordering ? (
          <Button
            onPress={() => setIsReordering(true)}
            disabled={ordine.voci.length === 0 || chiusoOggi || riordinoBloccatoPerDisponibilita}
            isDisabled={ordine.voci.length === 0 || chiusoOggi || riordinoBloccatoPerDisponibilita}
          >
            <ButtonIcon as={RepeatIcon} />
            <ButtonText>Riordina questo ordine</ButtonText>
          </Button>
        ) : (
          <Box className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <VStack space="sm">
              <Heading size="sm">🔁 Riordina — per oggi</Heading>
              <Text size="xs" className="text-emerald-900/70">
                Verrà creato un nuovo ordine con gli stessi prodotti, da ritirare oggi. Scegli solo
                l'orario di ritiro.
              </Text>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Orario di ritiro
                </Text>
                {configurazione?.orario_apertura_2 && configurazione.orario_chiusura_2 && finestraAttiva ? (
                  // Con un secondo turno configurato, gli slot sotto mostrano sempre e solo il
                  // turno "attivo" (getFinestraAttiva sopra) — chiarisce quale dei due si sta
                  // guardando adesso.
                  <Text size="2xs" className="font-medium text-emerald-700">
                    Turno attuale: dalle {finestraAttiva.apertura} alle {finestraAttiva.chiusura}.
                  </Text>
                ) : null}

                {/* Picker a due livelli (fasce → slot da 15 minuti), stesso identico picker del
                    checkout self-service (app/cliente/asporto/index.tsx), qui in tinta emerald
                    per restare coerente col riquadro "Riordina" che lo ospita — estratto in
                    `PickerOrarioRiordino` (sopra) per tenere la complessità cognitiva di questa
                    schermata sotto la soglia di SonarQube (S3776). Una fascia con tutti e 4 gli
                    orari al suo interno troppo vicini all'ora attuale è disabilitata (non solo i
                    singoli slot), stessa regola introdotta lì. */}
                <PickerOrarioRiordino
                  blocchi={blocchiOrarioRiordino}
                  oraEspansa={oraEspansaRiordino}
                  onToggleEspansa={(ora) => setOraEspansaRiordino((prev) => (prev === ora ? null : ora))}
                  oraSelezionata={oraRiordino}
                  onSelectOra={setOraRiordino}
                  isSlotEsaurito={isSlotEsaurito}
                  residuoSlot={residuoSlot}
                />

                {configurazione ? (
                  <Text size="2xs" className="text-emerald-900/70">
                    Servizio attivo {descrizioneOrari(configurazione)}.
                  </Text>
                ) : null}
                {limiteProdottiOrario !== null ? (
                  <Text size="2xs" className="text-emerald-900/70">
                    Ogni orario ha un numero massimo di prodotti prenotabili (bevande e vini
                    esclusi): se ne restano pochi te lo segnaliamo sotto l'orario.
                  </Text>
                ) : null}
              </VStack>

              {reorderError ? (
                <Text size="sm" className="text-center text-destructive">
                  {reorderError}
                </Text>
              ) : null}

              <Button onPress={handleSubmitRiordino} disabled={isSubmittingReorder} isDisabled={isSubmittingReorder}>
                {isSubmittingReorder ? <ButtonSpinner /> : <ButtonText>Conferma riordino</ButtonText>}
              </Button>
              <Button variant="link" onPress={() => setIsReordering(false)} disabled={isSubmittingReorder}>
                <ButtonText>Annulla</ButtonText>
              </Button>
            </VStack>
          </Box>
        )}

        {chiusoOggi ? (
          <Text size="xs" className="text-center text-destructive">
            Il servizio asporto è chiuso oggi: non è possibile riordinare in questo momento.
          </Text>
        ) : null}

        {!chiusoOggi && riordinoBloccatoPerDisponibilita ? (
          <Text size="xs" className="text-center text-destructive">
            {nomiProdottiNonDisponibili.length === 1
              ? `${nomiProdottiNonDisponibili[0]} non è più disponibile: non è possibile riordinare finché non torna disponibile.`
              : `${nomiProdottiNonDisponibili.join(', ')} non sono più disponibili: non è possibile riordinare finché non tornano disponibili.`}
          </Text>
        ) : null}

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
