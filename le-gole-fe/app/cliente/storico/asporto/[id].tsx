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
  type ConfigurazioneAsporto,
  type ProdottiPrenotatiPerOrario,
} from '../../../../src/services/menu';
import { apriBigliettoPdf } from '../../../../src/utils/biglietto';
import {
  formatDateDDMMYYYY,
  formatTime,
  minutesToHHMM,
  nowHHMM,
  parseHHMMToMinutes,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
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

type BloccoOrario = { ora: string; label: string; slots: string[] };

// Stesse identiche funzioni pure di app/cliente/asporto/index.tsx (generaSlotOrario/raggruppaSlotPerOra)
// — duplicate qui invece di astratte in un modulo condiviso, stesso principio "copia diretta" già
// seguito per `scrollChipIntoView` tra le pagine asporto (nessuna infrastruttura condivisa in più
// del necessario per due soli chiamanti).
function generaSlotOrario(apertura: string, chiusura: string, stepMinuti = 15): string[] {
  const inizio = parseHHMMToMinutes(apertura);
  const fine = parseHHMMToMinutes(chiusura);
  if (inizio === null || fine === null) return [];
  const slots: string[] = [];
  for (let minuti = inizio; minuti <= fine; minuti += stepMinuti) {
    slots.push(minutesToHHMM(minuti));
  }
  return slots;
}

function raggruppaSlotPerOra(slots: string[]): BloccoOrario[] {
  const blocchi: BloccoOrario[] = [];
  for (const slot of slots) {
    const ora = slot.slice(0, 2);
    const ultimo = blocchi[blocchi.length - 1];
    if (ultimo && ultimo.ora === ora) {
      ultimo.slots.push(slot);
      continue;
    }
    const oraFine = String((Number.parseInt(ora, 10) + 1) % 24).padStart(2, '0');
    blocchi.push({ ora, label: `${ora}:00-${oraFine}:00`, slots: [slot] });
  }
  return blocchi;
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
  return finestre.find((f) => parseHHMMToMinutes(f.chiusura)! > nowMinuti) ?? finestre[finestre.length - 1];
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

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: unknown } })?.response?.data;
  if (detail && typeof detail === 'object') {
    const message = Object.values(detail as Record<string, unknown>).flat().join(' ');
    if (message) return message;
  }
  return fallback;
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
    ])
      .then(([ordineData, configurazioneData, chiusureData, prenotatiData]) => {
        if (cancelled) return;
        setOrdine(ordineData);
        setConfigurazione(configurazioneData);
        setChiusoOggi(chiusureData.includes(toISODate(new Date())));
        setPrenotatiPerOrario(prenotatiData);
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
            disabled={ordine.voci.length === 0 || chiusoOggi}
            isDisabled={ordine.voci.length === 0 || chiusoOggi}
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

                {/* Livello 1 — fasce orarie: stesso identico picker a due livelli del checkout
                    self-service (app/cliente/asporto/index.tsx), qui in tinta emerald per restare
                    coerente col riquadro "Riordina" che lo ospita. Una fascia con tutti e 4 gli
                    orari al suo interno troppo vicini all'ora attuale è disabilitata (non solo i
                    singoli slot), stessa regola introdotta lì. */}
                <HStack space="xs" className="flex-wrap">
                  {blocchiOrarioRiordino.map((blocco) => {
                    const isEspansa = blocco.ora === oraEspansaRiordino;
                    const contieneSelezionato = blocco.slots.includes(oraRiordino);
                    const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
                    const tuttiDisabilitati = blocco.slots.every(
                      (slot) =>
                        parseHHMMToMinutes(slot)! < nowMinuti + ANTICIPO_MINUTI_RIORDINO || isSlotEsaurito(slot)
                    );
                    return (
                      <Pressable
                        key={blocco.ora}
                        onPress={() =>
                          !tuttiDisabilitati &&
                          setOraEspansaRiordino((prev) => (prev === blocco.ora ? null : blocco.ora))
                        }
                        disabled={tuttiDisabilitati}
                        accessibilityRole="button"
                        accessibilityLabel={`Fascia oraria ${blocco.label}${tuttiDisabilitati ? ', non più disponibile' : ''}`}
                        accessibilityState={{ expanded: isEspansa, selected: contieneSelezionato, disabled: tuttiDisabilitati }}
                        className={`rounded-full border-2 px-3 py-1.5 ${
                          tuttiDisabilitati
                            ? 'border-emerald-100 bg-white opacity-40'
                            : isEspansa
                              ? 'border-emerald-600 bg-emerald-600'
                              : contieneSelezionato
                                ? 'border-emerald-600 bg-white'
                                : 'border-emerald-300 bg-white active:bg-emerald-100'
                        }`}
                      >
                        <Text
                          size="xs"
                          className={`font-medium ${
                            tuttiDisabilitati ? 'text-muted-foreground' : isEspansa ? 'text-white' : 'text-emerald-900'
                          }`}
                        >
                          {contieneSelezionato && !isEspansa ? '✓ ' : ''}
                          {blocco.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </HStack>

                {/* Livello 2 — orari ogni 15 minuti dentro la fascia scelta sopra. */}
                {oraEspansaRiordino ? (
                  <HStack space="xs" className="flex-wrap rounded-xl border border-emerald-200 bg-emerald-100/50 p-2">
                    {(blocchiOrarioRiordino.find((b) => b.ora === oraEspansaRiordino)?.slots ?? []).map((slot) => {
                      const minutiSlot = parseHHMMToMinutes(slot)!;
                      const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
                      const troppoVicino = minutiSlot < nowMinuti + ANTICIPO_MINUTI_RIORDINO;
                      const esaurito = !troppoVicino && isSlotEsaurito(slot);
                      const disabilitato = troppoVicino || esaurito;
                      const selezionato = oraRiordino === slot;
                      const residuo = residuoSlot(slot);
                      const mostraResiduo =
                        !disabilitato && residuo !== null && residuo <= SOGLIA_AVVISO_RESIDUO_ORARIO;
                      return (
                        <VStack key={slot} className="items-center">
                          <Pressable
                            onPress={() => !disabilitato && setOraRiordino(slot)}
                            disabled={disabilitato}
                            accessibilityRole="button"
                            accessibilityLabel={`Orario di ritiro ${slot}${esaurito ? ', esaurito: numero massimo di prodotti raggiunto per questo orario' : mostraResiduo ? `, solo ${residuo} prodotti ancora disponibili per questo orario` : ''}`}
                            className={`rounded-full border-2 px-3 py-1.5 ${
                              selezionato
                                ? 'border-emerald-600 bg-emerald-600'
                                : disabilitato
                                  ? 'border-emerald-100 bg-white opacity-40'
                                  : 'border-emerald-300 bg-white active:bg-emerald-100'
                            }`}
                          >
                            <Text
                              size="xs"
                              className={
                                selezionato
                                  ? 'font-bold text-white'
                                  : disabilitato
                                    ? 'text-muted-foreground'
                                    : 'font-medium text-emerald-900'
                              }
                            >
                              {slot}
                              {esaurito ? ' · Esaurito' : ''}
                            </Text>
                          </Pressable>
                          {/* Didascalia FUORI dal bottone, esattamente sotto — stessa scelta e
                              stesso gotcha del checkout self-service (app/cliente/asporto/index.tsx):
                              font ridotto tramite la prop nativa `style` (fontSize: 9), non una
                              classe Tailwind arbitraria `text-[9px]` (non applicata da
                              NativeWind/react-native-css su questo target web). */}
                          {mostraResiduo ? (
                            <Text
                              style={{ fontSize: 9 }}
                              className={`font-semibold ${residuoTextClassName(residuo!)}`}
                            >
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

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
