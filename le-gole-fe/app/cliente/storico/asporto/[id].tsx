import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Input, InputField } from '@/components/ui/input';
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
  getProssimeChiusureAsporto,
  type ConfigurazioneAsporto,
} from '../../../../src/services/menu';
import { apriBigliettoPdf } from '../../../../src/utils/biglietto';
import {
  computeDefaultOrario,
  formatDateDDMMYYYY,
  formatOrarioInput,
  formatTime,
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

  const [isReordering, setIsReordering] = useState(false);
  const [oraRiordino, setOraRiordino] = useState('');
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [isSubmittingReorder, setIsSubmittingReorder] = useState(false);

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
    Promise.all([getDettaglioPubblicoAsporto(id), getConfigurazioneAsporto(), getProssimeChiusureAsporto()])
      .then(([ordineData, configurazioneData, chiusureData]) => {
        if (cancelled) return;
        setOrdine(ordineData);
        setConfigurazione(configurazioneData);
        setChiusoOggi(chiusureData.includes(toISODate(new Date())));
        setOraRiordino(computeDefaultOrario(null, new Date(), formatTime(configurazioneData.orario_apertura)));
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
    if (configurazione) {
      const apertura = parseHHMMToMinutes(formatTime(configurazione.orario_apertura));
      const chiusura = parseHHMMToMinutes(formatTime(configurazione.orario_chiusura));
      if (apertura !== null && chiusura !== null && (minuti < apertura || minuti > chiusura)) {
        setReorderError(
          `Il servizio asporto è attivo dalle ${formatTime(configurazione.orario_apertura)} alle ${formatTime(configurazione.orario_chiusura)}.`
        );
        return;
      }
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
                <Input>
                  <InputField
                    placeholder="Es. 19:30"
                    keyboardType="numeric"
                    maxLength={5}
                    value={oraRiordino}
                    onChangeText={(text) => setOraRiordino(formatOrarioInput(oraRiordino, text))}
                  />
                </Input>
                {configurazione ? (
                  <Text size="2xs" className="text-emerald-900/70">
                    Servizio attivo dalle {formatTime(configurazione.orario_apertura)} alle{' '}
                    {formatTime(configurazione.orario_chiusura)}.
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
