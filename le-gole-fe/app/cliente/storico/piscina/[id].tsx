import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { ClienteFooter } from '../../../../src/components/cliente/ClienteFooter';
import { ConfermaPrenotazionePiscina } from '../../../../src/components/cliente/ConfermaPrenotazionePiscina';
import {
  DETTAGLIO_SCROLL_CONTENT,
  DettaglioErrore,
  DettaglioHeader,
  DettaglioLoading,
  DownloadPdfButton,
  InfoRow,
  RiepilogoCard,
  RiprenotaButton,
  RiprenotaPanel,
  SezioneDettaglio,
} from '../../../../src/components/cliente/storico/DettaglioStoricoUI';
import { useScaricaPdf } from '../../../../src/hooks/useScaricaPdf';
import {
  createPrenotazionePiscina,
  getBigliettoUrl,
  getDettaglioPubblicoPiscina,
  getDisponibilitaPiscina,
  getGiorniPieniMese,
  type DettaglioPiscinaPubblico,
} from '../../../../src/services/prenotazioni';
import { getPiscinaInventario, type PiscinaInventario } from '../../../../src/services/struttura';
import { dateToMap } from '../../../../src/utils/calendar';
import { extractErrorMessage } from '../../../../src/utils/errors';
import {
  formatDateDDMMYYYY,
  formatDisplayDate,
  formatOrarioInput,
  formatTime,
  parseHHMMToMinutes,
  toISODate,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
  validateOrarioPiscina,
} from '../../../../src/utils/piscinaMappa';

// Pagina di dettaglio raggiunta da una card di app/cliente/storico/index.tsx: carica il singolo
// record per id (l'UUID funge da segreto, stesso principio del biglietto PDF).

const RISORSE_ROWS: Array<{
  key: 'ingressi' | 'ingressi_ridotti' | 'ingressi_bambini' | 'ingressi_gratuiti' | 'ombrellone' | 'gazebo' | 'lettino' | 'sdraia';
  icon: string;
  label: string;
}> = [
  { key: 'ingressi', icon: '🎟️', label: 'Ingressi interi' },
  { key: 'ingressi_ridotti', icon: '🌇', label: 'Ingressi ridotti' },
  { key: 'ingressi_bambini', icon: '🧒', label: 'Ingressi bambini' },
  { key: 'ingressi_gratuiti', icon: '🆓', label: 'Ingressi gratuiti' },
  { key: 'ombrellone', icon: '⛱️', label: 'Ombrelloni' },
  { key: 'gazebo', icon: '⛺', label: 'Gazebi' },
  { key: 'lettino', icon: '🛏️', label: 'Lettini' },
  { key: 'sdraia', icon: '🪑', label: 'Sdraie' },
];

const header = <DettaglioHeader titolo="Dettaglio prenotazione" sottotitolo="Piscina" />;

// Stesse regole del form di prenotazione originale, applicate ai contatori ingressi della
// prenotazione copiata (non modificabili qui).
function erroreOrarioRiprenotazione(
  orario: string,
  prenotazione: DettaglioPiscinaPubblico,
  inventario: PiscinaInventario | null,
  data: Date
): string | null {
  // Fallback minimo se l'inventario non è ancora caricato: il backend rivalida comunque tutto.
  if (!inventario) return parseHHMMToMinutes(orario) === null ? 'Inserisci un orario valido (HH:MM).' : null;
  const soglia = inventario.orario_inizio_ridotto;
  return (
    validateOrarioPiscina(orario, inventario, data) ??
    validateOrarioIngressoRidotto(orario, prenotazione.ingressi_ridotti, soglia) ??
    (Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0
      ? validateOrarioIngressoIntero(orario, prenotazione.ingressi, soglia)
      : null)
  );
}

export default function DettaglioPrenotazionePiscinaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [prenotazione, setPrenotazione] = useState<DettaglioPiscinaPubblico | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const download = useScaricaPdf('Impossibile scaricare il biglietto. Riprova.');

  // Inventario della prenotazione originale, caricato dopo il dettaglio solo per validare la
  // riprenotazione: un suo fallimento non fa fallire la pagina.
  const [inventario, setInventario] = useState<PiscinaInventario | null>(null);

  // Riprenotazione: stesse risorse della prenotazione originale, il cliente sceglie solo data e
  // orario (nessuna riselezione di postazioni: nasce "Da assegnare" per lo staff).
  const [isRiprenotando, setIsRiprenotando] = useState(false);
  const [dataRiprenotazione, setDataRiprenotazione] = useState<Date | null>(null);
  const [oraRiprenotazione, setOraRiprenotazione] = useState('');
  const [fullByDate, setFullByDate] = useState<Record<string, boolean>>({});
  const [riprenotazioneError, setRiprenotazioneError] = useState<string | null>(null);
  const [isSubmittingRiprenotazione, setIsSubmittingRiprenotazione] = useState(false);
  const [riepilogoRiprenotazione, setRiepilogoRiprenotazione] = useState<{
    nomeInventario: string;
    dataLabel: string;
    orario: string;
    prenotazioneId: string;
  } | null>(null);
  const downloadRiprenotazione = useScaricaPdf('Impossibile scaricare il biglietto. Riprova.');

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getDettaglioPubblicoPiscina(id)
      .then((data) => {
        if (cancelled) return;
        setPrenotazione(data);
        setIsLoading(false);
        getPiscinaInventario(data.inventario)
          .then((inv) => {
            if (!cancelled) setInventario(inv);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) {
          setError('Prenotazione non trovata.');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleVisibleMonthChange = (anno: number, mese: number) => {
    if (!prenotazione) return;
    getGiorniPieniMese({ inventario: prenotazione.inventario, anno, mese })
      .then((date) => setFullByDate((prev) => ({ ...prev, ...dateToMap(date) })))
      .catch(() => {});
  };

  const handleSubmitRiprenotazione = async () => {
    if (!prenotazione) return;
    if (!dataRiprenotazione) {
      setRiprenotazioneError('Scegli la data della nuova prenotazione.');
      return;
    }
    const orario = oraRiprenotazione.trim();
    const erroreOrario = erroreOrarioRiprenotazione(orario, prenotazione, inventario, dataRiprenotazione);
    if (erroreOrario) {
      setRiprenotazioneError(erroreOrario);
      return;
    }

    setRiprenotazioneError(null);
    setIsSubmittingRiprenotazione(true);
    try {
      const dataISO = toISODate(dataRiprenotazione);
      const disponibilita = await getDisponibilitaPiscina({ inventario: prenotazione.inventario, data: dataISO });
      if (disponibilita.pieno) {
        setRiprenotazioneError('Il giorno scelto è già al completo: scegline un altro.');
        return;
      }
      const nuova = await createPrenotazionePiscina({
        cliente_id: prenotazione.cliente_id,
        data: dataISO,
        ora: orario,
        stato: 'CONFIRMED',
        inventario: prenotazione.inventario,
        ingressi: prenotazione.ingressi,
        ingressi_ridotti: prenotazione.ingressi_ridotti,
        ingressi_bambini: prenotazione.ingressi_bambini,
        ingressi_gratuiti: prenotazione.ingressi_gratuiti,
        ombrellone: prenotazione.ombrellone,
        gazebo: prenotazione.gazebo,
        lettino: prenotazione.lettino,
        sdraia: prenotazione.sdraia,
        note: prenotazione.note,
      });
      setRiepilogoRiprenotazione({
        nomeInventario: prenotazione.inventario_nome,
        dataLabel: formatDisplayDate(dataRiprenotazione),
        orario,
        prenotazioneId: nuova.id,
      });
    } catch (err) {
      setRiprenotazioneError(extractErrorMessage(err, 'Impossibile completare la riprenotazione. Riprova.'));
    } finally {
      setIsSubmittingRiprenotazione(false);
    }
  };

  if (isLoading) return <DettaglioLoading />;

  if (error || !prenotazione) {
    return <DettaglioErrore header={header} messaggio={error ?? 'Prenotazione non trovata.'} />;
  }

  if (riepilogoRiprenotazione) {
    const nuovaId = riepilogoRiprenotazione.prenotazioneId;
    return (
      <ConfermaPrenotazionePiscina
        nomeInventario={riepilogoRiprenotazione.nomeInventario}
        dataLabel={riepilogoRiprenotazione.dataLabel}
        orario={riepilogoRiprenotazione.orario}
        isDownloading={downloadRiprenotazione.isDownloading}
        onScaricaBiglietto={() => downloadRiprenotazione.scarica(getBigliettoUrl(nuovaId), nuovaId)}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={downloadRiprenotazione.error}
      />
    );
  }

  const risorse = RISORSE_ROWS.filter((row) => prenotazione[row.key] > 0);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName={DETTAGLIO_SCROLL_CONTENT}>
      <VStack space="lg" className="w-full">
        {header}

        <RiepilogoCard
          titolo={prenotazione.inventario_nome}
          quando={`${formatDateDDMMYYYY(prenotazione.data)} · ${formatTime(prenotazione.ora)}`}
          stato={prenotazione.stato}
          clienteNome={prenotazione.cliente_nome}
          clienteTelefono={prenotazione.cliente_telefono}
          note={prenotazione.note}
        >
          {risorse.length > 0 ? (
            <SezioneDettaglio titolo="Risorse prenotate">
              {risorse.map((row) => (
                <InfoRow key={row.key} icon={row.icon} label={row.label} value={prenotazione[row.key]} />
              ))}
            </SezioneDettaglio>
          ) : null}
        </RiepilogoCard>

        {prenotazione.stato === 'CANCELLED' ? null : (
          <DownloadPdfButton
            etichetta="Scarica biglietto (PDF)"
            isDownloading={download.isDownloading}
            onPress={() => download.scarica(getBigliettoUrl(prenotazione.id), prenotazione.id)}
          />
        )}

        {isRiprenotando ? (
          <RiprenotaPanel
            cosa="prenotazione"
            descrizione="Verrà creata una nuova prenotazione con le stesse risorse di questa (ingressi, ombrellone/gazebo, lettini/sdraie). Scegli solo la data e l'orario."
            data={dataRiprenotazione}
            onSelectData={setDataRiprenotazione}
            fullDates={fullByDate}
            calendarCaption="I giorni evidenziati in rosa sono già al completo."
            onVisibleMonthChange={handleVisibleMonthChange}
            error={riprenotazioneError}
            isSubmitting={isSubmittingRiprenotazione}
            onSubmit={handleSubmitRiprenotazione}
            onAnnulla={() => setIsRiprenotando(false)}
          >
            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Orario
              </Text>
              <Input className="border-2 border-emerald-300 bg-white">
                <InputField
                  value={oraRiprenotazione}
                  onChangeText={(text) => setOraRiprenotazione(formatOrarioInput(oraRiprenotazione, text))}
                  placeholder="Es. 15:30"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </Input>
              {inventario ? (
                <Text size="2xs" className="text-emerald-900/70">
                  La piscina è aperta dalle {inventario.orario_apertura.slice(0, 5)} alle{' '}
                  {inventario.orario_chiusura.slice(0, 5)}.
                </Text>
              ) : null}
            </VStack>
          </RiprenotaPanel>
        ) : (
          <RiprenotaButton etichetta="Riprenota questa prenotazione" onPress={() => setIsRiprenotando(true)} />
        )}

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
