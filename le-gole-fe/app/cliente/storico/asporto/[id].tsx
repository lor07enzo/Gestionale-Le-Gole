import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { RepeatIcon } from '@/components/ui/icon';
import { ClienteFooter } from '../../../../src/components/cliente/ClienteFooter';
import { ConfermaOrdineAsporto, type RigaRiepilogoOrdineAsporto } from '../../../../src/components/cliente/ConfermaOrdineAsporto';
import {
  DETTAGLIO_SCROLL_CONTENT,
  DettaglioErrore,
  DettaglioHeader,
  DettaglioLoading,
  Divisore,
  DownloadPdfButton,
  RiepilogoCard,
  SezioneDettaglio,
} from '../../../../src/components/cliente/storico/DettaglioStoricoUI';
import { PickerOrarioAsporto, type StatoSlot } from '../../../../src/components/shared/PickerOrarioAsporto';
import { useScaricaPdf } from '../../../../src/hooks/useScaricaPdf';
import {
  createPrenotazioneAsporto,
  getDettaglioPubblicoAsporto,
  getPrenotazioniPerOrario,
  getRicevutaUrl,
  type PrenotazioneAsportoDettaglio,
  type PrenotazioniPerOrario,
} from '../../../../src/services/prenotazioni';
import {
  createVoceOrdine,
  getConfigurazioneAsporto,
  getProssimeChiusureAsporto,
  listProdotti,
  type ConfigurazioneAsporto,
  type Prodotto,
} from '../../../../src/services/menu';
import { descrizioneOrari, getFinestraAttiva, isOraInFinestre, residuoPrenotazioni } from '../../../../src/utils/asporto';
import { extractErrorMessage } from '../../../../src/utils/errors';
import {
  formatDateDDMMYYYY,
  formatTime,
  generaSlotOrario,
  nowHHMM,
  parseHHMMToMinutes,
  raggruppaSlotPerOra,
  toISODate,
} from '../../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../../src/utils/prezzi';

// Pagina di dettaglio raggiunta da una card di app/cliente/storico/index.tsx (UUID come segreto).
// In più offre il riordino: un nuovo ordine con le stesse righe prodotto, sempre per OGGI, in cui
// il cliente sceglie solo l'orario di ritiro.

// Stesso anticipo minimo standard del checkout. Nessuna variante "pizze": le righe del dettaglio
// non portano la categoria del prodotto.
const ANTICIPO_MINUTI_RIORDINO = 15;

const header = <DettaglioHeader titolo="Dettaglio ordine" sottotitolo="Asporto" />;

function messaggioNonDisponibili(nomi: string[]): string {
  return nomi.length === 1
    ? `${nomi[0]} non è più disponibile: non è possibile riordinare finché non torna disponibile.`
    : `${nomi.join(', ')} non sono più disponibili: non è possibile riordinare finché non tornano disponibili.`;
}

export default function DettaglioOrdineAsportoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ordine, setOrdine] = useState<PrenotazioneAsportoDettaglio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const download = useScaricaPdf('Impossibile scaricare la ricevuta. Riprova.');

  const [configurazione, setConfigurazione] = useState<ConfigurazioneAsporto | null>(null);
  const [chiusoOggi, setChiusoOggi] = useState(false);
  const [prenotazioniPerOrario, setPrenotazioniPerOrario] = useState<PrenotazioniPerOrario>({});
  // Catalogo completo (anche i prodotti nascosti): serve a scoprire se un prodotto dell'ordine
  // originale è stato nascosto nel frattempo. Il backend rifiuterebbe comunque quella riga per una
  // richiesta anonima, ma solo DOPO aver creato l'ordine: meglio bloccare il riordino in anticipo.
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);

  const [isReordering, setIsReordering] = useState(false);
  const [oraRiordino, setOraRiordino] = useState('');
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [isSubmittingReorder, setIsSubmittingReorder] = useState(false);
  const [riepilogoRiordino, setRiepilogoRiordino] = useState<{
    nome: string;
    orario: string;
    righe: RigaRiepilogoOrdineAsporto[];
    totale: number;
    prenotazioneId: string;
  } | null>(null);
  const downloadRiordino = useScaricaPdf('Impossibile scaricare la ricevuta. Riprova.');

  // Il cliente vede un turno alla volta: la finestra attiva passa da sé alla cena dopo la chiusura del pranzo.
  const finestraAttiva = useMemo(
    () => (configurazione ? getFinestraAttiva(configurazione, parseHHMMToMinutes(nowHHMM())!) : null),
    [configurazione]
  );
  const blocchiOrarioRiordino = useMemo(
    () => (finestraAttiva ? raggruppaSlotPerOra(generaSlotOrario(finestraAttiva.apertura, finestraAttiva.chiusura)) : []),
    [finestraAttiva]
  );

  // Il riordino crea sempre UNA prenotazione: basta confrontare le prenotazioni già presenti con il limite.
  const limitePrenotazioniOrario = configurazione?.limite_prenotazioni_orario ?? null;
  const residuoSlot = (slot: string) => residuoPrenotazioni(limitePrenotazioniOrario, prenotazioniPerOrario, slot);
  const isSlotEsaurito = (slot: string) => (residuoSlot(slot) ?? 1) <= 0;
  const statoSlot = (slot: string): StatoSlot => {
    if (parseHHMMToMinutes(slot)! < parseHHMMToMinutes(nowHHMM())! + ANTICIPO_MINUTI_RIORDINO) return 'passato';
    return isSlotEsaurito(slot) ? 'esaurito' : null;
  };

  const nomiProdottiNonDisponibili = useMemo(() => {
    if (!ordine || prodotti.length === 0) return [];
    const nomi = new Set<string>();
    for (const voce of ordine.voci) {
      const prodotto = prodotti.find((p) => p.id === voce.prodotto);
      if (!prodotto?.disponibile) nomi.add(voce.prodotto_nome);
    }
    return Array.from(nomi);
  }, [ordine, prodotti]);
  const riordinoBloccatoPerDisponibilita = nomiProdottiNonDisponibili.length > 0;

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
      getPrenotazioniPerOrario(toISODate(new Date())),
      listProdotti(),
    ])
      .then(([ordineData, configurazioneData, chiusureData, prenotazioniData, prodottiData]) => {
        if (cancelled) return;
        setOrdine(ordineData);
        setConfigurazione(configurazioneData);
        setChiusoOggi(chiusureData.includes(toISODate(new Date())));
        setPrenotazioniPerOrario(prenotazioniData);
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

  // Backstop dei controlli già riflessi nella UI (pulsante/slot disabilitati): mai fidarsi solo
  // del `disabled`, altrimenti l'ordine verrebbe creato e fallirebbe a metà sulle righe.
  const erroreRiordino = (): string | null => {
    if (riordinoBloccatoPerDisponibilita) {
      const verbo = nomiProdottiNonDisponibili.length === 1 ? 'è più disponibile' : 'sono più disponibili';
      return `Non è possibile riordinare: ${nomiProdottiNonDisponibili.join(', ')} non ${verbo}.`;
    }
    const minuti = parseHHMMToMinutes(oraRiordino);
    if (minuti === null) return 'Inserisci un orario di ritiro valido (HH:MM).';
    if (configurazione && !isOraInFinestre(configurazione, minuti)) {
      return `Il servizio asporto è attivo ${descrizioneOrari(configurazione)}.`;
    }
    if (minuti < parseHHMMToMinutes(nowHHMM())! + ANTICIPO_MINUTI_RIORDINO) {
      return `Con il riordino serve un anticipo di almeno ${ANTICIPO_MINUTI_RIORDINO} minuti rispetto all'ora attuale.`;
    }
    if (isSlotEsaurito(oraRiordino.trim())) {
      return 'Numero massimo di prenotazioni raggiunto per questo orario: scegli un altro orario.';
    }
    return null;
  };

  const handleSubmitRiordino = async () => {
    if (!ordine) return;
    const errore = erroreRiordino();
    if (errore) {
      setReorderError(errore);
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
      // Ogni riga creata torna già con lo snapshot di prezzo corrente: riusata per il riepilogo.
      const nuoveVoci = await Promise.all(
        ordine.voci.map((voce) =>
          createVoceOrdine({ prenotazione: nuovo.id, prodotto: voce.prodotto, quantita: voce.quantita })
        )
      );
      const righe = nuoveVoci.map((voce) => ({
        id: voce.id,
        nome: voce.prodotto_nome,
        quantita: voce.quantita,
        subtotale: Number.parseFloat(voce.subtotale) || 0,
      }));
      setRiepilogoRiordino({
        nome: ordine.cliente_nome,
        orario: oraRiordino.trim(),
        righe,
        totale: righe.reduce((sum, riga) => sum + riga.subtotale, 0),
        prenotazioneId: nuovo.id,
      });
    } catch (err) {
      setReorderError(extractErrorMessage(err, 'Impossibile completare il riordino. Riprova.'));
    } finally {
      setIsSubmittingReorder(false);
    }
  };

  if (isLoading) return <DettaglioLoading />;

  if (error || !ordine) {
    return <DettaglioErrore header={header} messaggio={error ?? 'Ordine non trovato.'} />;
  }

  if (riepilogoRiordino) {
    const nuovoId = riepilogoRiordino.prenotazioneId;
    return (
      <ConfermaOrdineAsporto
        nome={riepilogoRiordino.nome}
        orario={riepilogoRiordino.orario}
        righe={riepilogoRiordino.righe}
        totale={riepilogoRiordino.totale}
        isDownloading={downloadRiordino.isDownloading}
        onScaricaRicevuta={() => downloadRiordino.scarica(getRicevutaUrl(nuovoId), nuovoId, 'ricevuta')}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={downloadRiordino.error}
      />
    );
  }

  const riordinoDisabilitato = ordine.voci.length === 0 || chiusoOggi || riordinoBloccatoPerDisponibilita;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName={DETTAGLIO_SCROLL_CONTENT}>
      <VStack space="lg" className="w-full">
        {header}

        <RiepilogoCard
          titolo="Ritiro asporto"
          quando={`${formatDateDDMMYYYY(ordine.data)} · ${formatTime(ordine.ora)}`}
          stato={ordine.stato}
          clienteNome={ordine.cliente_nome}
          clienteTelefono={ordine.cliente_telefono}
          note={ordine.note}
        >
          <SezioneDettaglio titolo="Prodotti ordinati">
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
            <Divisore />
            <HStack className="items-center justify-between">
              <Text size="sm" className="font-semibold text-sky-900">
                Totale
              </Text>
              <Text size="md" className="font-bold text-sky-900">
                €{formatPrezzo(ordine.totale)}
              </Text>
            </HStack>
          </SezioneDettaglio>
        </RiepilogoCard>

        {ordine.stato === 'CANCELLED' ? null : (
          <DownloadPdfButton
            etichetta="Scarica ricevuta (PDF)"
            isDownloading={download.isDownloading}
            onPress={() => download.scarica(getRicevutaUrl(ordine.id), ordine.id, 'ricevuta')}
            outline
          />
        )}

        {isReordering ? (
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
                  <Text size="2xs" className="font-medium text-emerald-700">
                    Turno attuale: dalle {finestraAttiva.apertura} alle {finestraAttiva.chiusura}.
                  </Text>
                ) : null}

                <PickerOrarioAsporto
                  blocchi={blocchiOrarioRiordino}
                  value={oraRiordino}
                  onChange={setOraRiordino}
                  statoSlot={statoSlot}
                  residuoSlot={residuoSlot}
                  tono="emerald"
                />

                {configurazione ? (
                  <Text size="2xs" className="text-emerald-900/70">
                    Servizio attivo {descrizioneOrari(configurazione)}.
                  </Text>
                ) : null}
                {limitePrenotazioniOrario === null ? null : (
                  <Text size="2xs" className="text-emerald-900/70">
                    Ogni orario accetta solo un numero massimo di prenotazioni: se ne restano
                    poche te lo segnaliamo sotto l'orario.
                  </Text>
                )}
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
        ) : (
          <Button onPress={() => setIsReordering(true)} disabled={riordinoDisabilitato} isDisabled={riordinoDisabilitato}>
            <ButtonIcon as={RepeatIcon} />
            <ButtonText>Riordina questo ordine</ButtonText>
          </Button>
        )}

        {chiusoOggi ? (
          <Text size="xs" className="text-center text-destructive">
            Il servizio asporto è chiuso oggi: non è possibile riordinare in questo momento.
          </Text>
        ) : null}

        {!chiusoOggi && riordinoBloccatoPerDisponibilita ? (
          <Text size="xs" className="text-center text-destructive">
            {messaggioNonDisponibili(nomiProdottiNonDisponibili)}
          </Text>
        ) : null}

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
