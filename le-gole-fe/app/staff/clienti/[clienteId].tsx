import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Input, InputField } from '@/components/ui/input';
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
  ArrowLeftIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EditIcon,
  Icon,
  PhoneIcon,
  SlashIcon,
} from '@/components/ui/icon';
import { getCliente, type Cliente } from '../../../src/services/clienti';
import {
  listPrenotazioniAsportoByCliente,
  listPrenotazioniPiscinaByCliente,
  updatePrenotazioneAsporto,
  updatePrenotazionePiscina,
  type PrenotazioneAsporto,
  type PrenotazionePiscina,
} from '../../../src/services/prenotazioni';
import { getPiscinaInventario, type PiscinaInventario } from '../../../src/services/struttura';
import { listVociOrdine, type VoceOrdine } from '../../../src/services/menu';
import { goBackOr } from '../../../src/utils/navigation';
import {
  formatDateDDMMYYYY,
  formatIngressiSummary,
  formatOrarioInput,
  formatTime,
  STATO_PRENOTAZIONE_BADGE,
  STATO_PRENOTAZIONE_LABEL,
  toISODate,
  validateOrarioIngressoIntero,
  validateOrarioIngressoRidotto,
} from '../../../src/utils/piscinaMappa';
import { EMPTY_EDIT_PRENOTAZIONE_FORM, type EditPrenotazioneFormState } from '../../../src/types/piscinaMappa';
import {
  EditOrdineSheet,
  extractErrorMessage,
  OrdineRow,
} from '../../../src/components/staff/asporto/OrdineAsportoUI';

function ClienteDetailHeader({ nome }: Readonly<{ nome: string | undefined }>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff/clienti')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">{nome ?? 'Scheda cliente'}</Heading>
        <Text size="sm" className="text-muted-foreground">
          Anagrafica, storico piscina e asporto
        </Text>
      </VStack>
    </HStack>
  );
}

// Calcolato per singola prenotazione, non per una data selezionata: qui lo storico copre date diverse.
function isPrenotazionePassata(p: PrenotazionePiscina): boolean {
  return p.data < toISODate(new Date());
}

// Stesso principio, per un ordine asporto — la data dell'ordine, non una data selezionata: lo
// storico qui copre giorni diversi, a differenza di "Storico Ordini" (app/staff/asporto/ordini.tsx)
// che mostra un solo giorno alla volta.
function isOrdineAsportoPassato(o: PrenotazioneAsporto): boolean {
  return o.data < toISODate(new Date());
}

function PrenotazioneRow({
  prenotazione: p,
  onEdit,
  onCancel,
  isCancelling,
  showActions = true,
}: Readonly<{
  prenotazione: PrenotazionePiscina;
  onEdit: (p: PrenotazionePiscina) => void;
  onCancel: (p: PrenotazionePiscina) => void;
  isCancelling: boolean;
  // Nasconde pulsanti/didascalia — usato dalle righe dello "Storico" raggruppato (mai azionabili
  // per definizione), stesso principio di `OrdineRow.showActions` (OrdineAsportoUI.tsx).
  showActions?: boolean;
}>) {
  const passata = isPrenotazionePassata(p);
  const modificabile = p.stato !== 'CANCELLED' && !passata;

  return (
    <Box className="w-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <VStack space="sm">
        <HStack space="xs" className="flex-wrap items-start justify-between">
          <VStack>
            <Text size="sm" className="font-semibold text-sky-900">
              {formatDateDDMMYYYY(p.data)} · {formatTime(p.ora) || '—'}
            </Text>
            <Text size="2xs" className="text-muted-foreground">
              🏊 {p.inventario_nome}
            </Text>
          </VStack>
          <Box className={`rounded-full px-2.5 py-1 ${STATO_PRENOTAZIONE_BADGE[p.stato].bg}`}>
            <Text size="2xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[p.stato].text}`}>
              {STATO_PRENOTAZIONE_LABEL[p.stato]}
            </Text>
          </Box>
        </HStack>

        {p.note ? (
          <Text size="xs" className="italic text-sky-900/70">
            📝 {p.note}
          </Text>
        ) : null}

        <Box className="rounded-xl bg-sky-50 px-3 py-2">
          <Text size="xs" className="text-sky-900/80">
            {formatIngressiSummary(p)}{' '}
            {p.ombrellone > 0 ? `⛱️ ${p.ombrellone} ` : ''}
            {p.gazebo > 0 ? `⛺ ${p.gazebo} ` : ''}
            {p.lettino > 0 ? `🛏️ ${p.lettino} ` : ''}
            {p.sdraia > 0 ? `🪑 ${p.sdraia}` : ''}
          </Text>
        </Box>

        {showActions && p.stato !== 'CANCELLED' ? (
          <VStack space="xs">
            {passata ? (
              <Text size="2xs" className="text-muted-foreground">
                Prenotazione passata: non più modificabile né annullabile.
              </Text>
            ) : null}
            <HStack space="sm">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-2 border-sky-300 bg-white"
                onPress={() => onEdit(p)}
                disabled={!modificabile}
              >
                <ButtonIcon as={EditIcon} className="text-sky-700" />
                <ButtonText className="text-sky-900">Modifica</ButtonText>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-2 border-amber-300 bg-amber-50"
                onPress={() => onCancel(p)}
                disabled={!modificabile || isCancelling}
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

// Riquadro tratteggiato "nessun dato affatto" — usato solo quando una categoria (piscina/asporto)
// non ha alcuno storico, mai quando esiste storico ma è vuota solo una delle due sotto-sezioni
// (in quel caso basta un testo attenuato, sotto: un intero riquadro sarebbe sproporzionato).
function EmptyState({ icon, text }: Readonly<{ icon: string; text: string }>) {
  return (
    <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
      <Text size="lg">{icon}</Text>
      <Text size="sm" className="text-center text-muted-foreground">
        {text}
      </Text>
    </VStack>
  );
}

// Pulsante a pillola statistica, usato sia per mostrare un conteggio a colpo d'occhio sia come
// selettore di tab (piscina/asporto) — unisce le due funzioni invece di un riepilogo testuale
// separato da un segmented control muto, per non far leggere due volte la stessa informazione.
function TabStatCard({
  icona,
  etichetta,
  totale,
  sottotitolo,
  isActive,
  onPress,
}: Readonly<{
  icona: string;
  etichetta: string;
  totale: number;
  sottotitolo: string;
  isActive: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Mostra storico ${etichetta}`}
      className={`flex-1 rounded-2xl border-2 p-3.5 ${
        isActive ? 'border-sky-600 bg-sky-600' : 'border-sky-100 bg-white active:bg-sky-50'
      }`}
    >
      <Text size="xs" className={`font-semibold ${isActive ? 'text-sky-100' : 'text-sky-700'}`}>
        {icona} {etichetta}
      </Text>
      <Text size="2xl" className={`font-extrabold ${isActive ? 'text-white' : 'text-sky-900'}`}>
        {totale}
      </Text>
      <Text size="2xs" className={isActive ? 'text-sky-100' : 'text-muted-foreground'}>
        {sottotitolo}
      </Text>
    </Pressable>
  );
}

// Estratto dal `return` di `ClienteDetailScreen` (rilevato da SonarQube — complessità cognitiva
// troppo alta): l'intero corpo del tab piscina era un albero di ternari annidati (vuoto/pieno →
// "in programma" → "storico" a comparsa) valutato dentro la stessa funzione del componente
// principale. Spostandolo qui, la sua complessità viene misurata separatamente su questa funzione
// più piccola invece di sommarsi a quella di `ClienteDetailScreen`.
function PiscinaTabContent({
  prenotazioni,
  prenotazioniProssime,
  prenotazioniStoriche,
  storicoOpen,
  onToggleStorico,
  onEdit,
  onCancel,
  cancellingId,
}: Readonly<{
  prenotazioni: PrenotazionePiscina[];
  prenotazioniProssime: PrenotazionePiscina[];
  prenotazioniStoriche: PrenotazionePiscina[];
  storicoOpen: boolean;
  onToggleStorico: () => void;
  onEdit: (p: PrenotazionePiscina) => void;
  onCancel: (p: PrenotazionePiscina) => void;
  cancellingId: string | null;
}>) {
  if (prenotazioni.length === 0) {
    return (
      <VStack space="md" className="w-full">
        <EmptyState icon="📭" text="Nessuna prenotazione registrata per questo cliente." />
      </VStack>
    );
  }
  return (
    <VStack space="md" className="w-full">
      <VStack space="sm" className="w-full">
        <Heading size="sm">📅 In programma</Heading>
        {prenotazioniProssime.length === 0 ? (
          <Text size="sm" className="text-muted-foreground">
            Nessuna prenotazione in programma.
          </Text>
        ) : (
          prenotazioniProssime.map((p) => (
            <PrenotazioneRow
              key={p.id}
              prenotazione={p}
              onEdit={onEdit}
              onCancel={onCancel}
              isCancelling={cancellingId === p.id}
            />
          ))
        )}
      </VStack>

      {prenotazioniStoriche.length > 0 ? (
        <VStack space="sm" className="w-full">
          <Pressable
            onPress={onToggleStorico}
            accessibilityLabel={`${storicoOpen ? 'Nascondi' : 'Mostra'} storico prenotazioni piscina`}
          >
            <HStack className="items-center justify-between rounded-xl border border-sky-100 bg-white px-4 py-3">
              <Text size="sm" className="font-semibold text-sky-900">
                🕘 Storico ({prenotazioniStoriche.length})
              </Text>
              <Icon as={storicoOpen ? ChevronUpIcon : ChevronDownIcon} size="sm" className="text-sky-600" />
            </HStack>
          </Pressable>
          {storicoOpen ? (
            <VStack space="sm">
              {prenotazioniStoriche.map((p) => (
                <PrenotazioneRow
                  key={p.id}
                  prenotazione={p}
                  onEdit={onEdit}
                  onCancel={onCancel}
                  isCancelling={cancellingId === p.id}
                  showActions={false}
                />
              ))}
            </VStack>
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
}

// Stesso identico principio di `PiscinaTabContent` sopra, per il tab asporto.
function AsportoTabContent({
  ordiniAsporto,
  ordiniProssimi,
  ordiniStorici,
  vociByOrdine,
  storicoOpen,
  onToggleStorico,
  onEdit,
  onCancel,
  onConfirm,
  cancellingOrdineId,
  confirmingOrdineId,
}: Readonly<{
  ordiniAsporto: PrenotazioneAsporto[];
  ordiniProssimi: PrenotazioneAsporto[];
  ordiniStorici: PrenotazioneAsporto[];
  vociByOrdine: Record<string, VoceOrdine[]>;
  storicoOpen: boolean;
  onToggleStorico: () => void;
  onEdit: (o: PrenotazioneAsporto) => void;
  onCancel: (o: PrenotazioneAsporto) => void;
  onConfirm: (o: PrenotazioneAsporto) => void;
  cancellingOrdineId: string | null;
  confirmingOrdineId: string | null;
}>) {
  if (ordiniAsporto.length === 0) {
    return (
      <VStack space="md" className="w-full">
        <EmptyState icon="🥡" text="Nessun ordine asporto registrato per questo cliente." />
      </VStack>
    );
  }
  return (
    <VStack space="md" className="w-full">
      <VStack space="sm" className="w-full">
        <Heading size="sm">📅 In programma</Heading>
        {ordiniProssimi.length === 0 ? (
          <Text size="sm" className="text-muted-foreground">
            Nessun ordine in programma.
          </Text>
        ) : (
          ordiniProssimi.map((o) => (
            <OrdineRow
              key={o.id}
              ordine={o}
              voci={vociByOrdine[o.id] ?? []}
              editable={!isOrdineAsportoPassato(o)}
              isCancelling={cancellingOrdineId === o.id}
              isConfirming={confirmingOrdineId === o.id}
              onEdit={onEdit}
              onCancel={onCancel}
              onConfirm={onConfirm}
              showTelefono={false}
            />
          ))
        )}
      </VStack>

      {ordiniStorici.length > 0 ? (
        <VStack space="sm" className="w-full">
          <Pressable
            onPress={onToggleStorico}
            accessibilityLabel={`${storicoOpen ? 'Nascondi' : 'Mostra'} storico ordini asporto`}
          >
            <HStack className="items-center justify-between rounded-xl border border-sky-100 bg-white px-4 py-3">
              <Text size="sm" className="font-semibold text-sky-900">
                🕘 Storico ({ordiniStorici.length})
              </Text>
              <Icon as={storicoOpen ? ChevronUpIcon : ChevronDownIcon} size="sm" className="text-sky-600" />
            </HStack>
          </Pressable>
          {storicoOpen ? (
            <VStack space="sm">
              {ordiniStorici.map((o) => (
                <OrdineRow
                  key={o.id}
                  ordine={o}
                  voci={vociByOrdine[o.id] ?? []}
                  editable={!isOrdineAsportoPassato(o)}
                  isCancelling={cancellingOrdineId === o.id}
                  isConfirming={confirmingOrdineId === o.id}
                  onEdit={onEdit}
                  onCancel={onCancel}
                  onConfirm={onConfirm}
                  showTelefono={false}
                  showActions={false}
                />
              ))}
            </VStack>
          ) : null}
        </VStack>
      ) : null}
    </VStack>
  );
}

// Foglio standalone: lo storico copre date/piscine diverse, quindi l'inventario viene caricato
// al volo per la prenotazione aperta, non ereditato da un context.
function EditStoricoSheet({
  prenotazione,
  onClose,
  onSaved,
}: Readonly<{
  prenotazione: PrenotazionePiscina | null;
  onClose: () => void;
  onSaved: (updated: PrenotazionePiscina) => void;
}>) {
  const [inventario, setInventario] = useState<PiscinaInventario | null>(null);
  const [form, setForm] = useState<EditPrenotazioneFormState>(EMPTY_EDIT_PRENOTAZIONE_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!prenotazione) {
      setInventario(null);
      return;
    }
    setForm({
      ora: formatTime(prenotazione.ora),
      ingressi: String(prenotazione.ingressi),
      ingressiRidotti: String(prenotazione.ingressi_ridotti),
      ingressiBambini: String(prenotazione.ingressi_bambini),
      ingressiGratuiti: String(prenotazione.ingressi_gratuiti),
      ombrellone: String(prenotazione.ombrellone),
      gazebo: String(prenotazione.gazebo),
      lettino: String(prenotazione.lettino),
      sdraia: String(prenotazione.sdraia),
      note: prenotazione.note,
    });
    setError(null);
    getPiscinaInventario(prenotazione.inventario)
      .then(setInventario)
      .catch(() => setInventario(null));
  }, [prenotazione]);

  const updateForm = (patch: Partial<EditPrenotazioneFormState>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const handleConfirm = async () => {
    if (!prenotazione) return;
    if (!form.ora.trim()) {
      setError('Inserisci un orario valido.');
      return;
    }
    if (inventario) {
      const ridottoError = validateOrarioIngressoRidotto(
        form.ora,
        Number.parseInt(form.ingressiRidotti, 10) || 0,
        inventario.orario_inizio_ridotto
      );
      if (ridottoError) {
        setError(ridottoError);
        return;
      }
      if (Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0) {
        const interoError = validateOrarioIngressoIntero(
          form.ora,
          Number.parseInt(form.ingressi, 10) || 0,
          inventario.orario_inizio_ridotto
        );
        if (interoError) {
          setError(interoError);
          return;
        }
      }
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await updatePrenotazionePiscina(prenotazione.id, {
        ora: form.ora.trim(),
        note: form.note.trim(),
        ingressi: Number.parseInt(form.ingressi, 10) || 0,
        ingressi_ridotti: Number.parseInt(form.ingressiRidotti, 10) || 0,
        ingressi_bambini: Number.parseInt(form.ingressiBambini, 10) || 0,
        ingressi_gratuiti: Number.parseInt(form.ingressiGratuiti, 10) || 0,
        ombrellone: Number.parseInt(form.ombrellone, 10) || 0,
        gazebo: Number.parseInt(form.gazebo, 10) || 0,
        lettino: Number.parseInt(form.lettino, 10) || 0,
        sdraia: Number.parseInt(form.sdraia, 10) || 0,
      });
      onSaved(updated);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare le modifiche alla prenotazione.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Actionsheet isOpen={prenotazione !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        className="max-h-[85vh]"
        aria-label={`Modifica prenotazione del ${prenotazione ? formatDateDDMMYYYY(prenotazione.data) : ''}`}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ActionsheetScrollView className="w-full">
          <VStack space="md" className="w-full pb-6">
            <Heading size="md">
              Modifica prenotazione — {prenotazione ? formatDateDDMMYYYY(prenotazione.data) : ''}
            </Heading>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Note
              </Text>
              <Input>
                <InputField
                  placeholder="Es. allergie, richieste particolari..."
                  value={form.note}
                  onChangeText={(text) => updateForm({ note: text })}
                />
              </Input>
            </VStack>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Orario
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 15:30"
                  keyboardType="numeric"
                  maxLength={5}
                  value={form.ora}
                  onChangeText={(text) => updateForm({ ora: formatOrarioInput(form.ora, text) })}
                />
              </Input>
            </VStack>

            <VStack space="xs">
              <Text size="sm" className="font-medium">
                Ingressi interi
              </Text>
              <Input>
                <InputField
                  keyboardType="numeric"
                  value={form.ingressi}
                  onChangeText={(text) => updateForm({ ingressi: text })}
                />
              </Input>
            </VStack>

            {inventario && Number.parseFloat(inventario.prezzo_ingresso_ridotto) > 0 ? (
              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Ingressi ridotti (dalle {inventario.orario_inizio_ridotto.slice(0, 5)})
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={form.ingressiRidotti}
                    onChangeText={(text) => updateForm({ ingressiRidotti: text })}
                  />
                </Input>
              </VStack>
            ) : null}

            {inventario && Number.parseFloat(inventario.prezzo_ingresso_bambino) > 0 ? (
              <>
                <VStack space="xs">
                  <Text size="sm" className="font-medium">
                    Ingressi bambini ({inventario.eta_minima_bambino}-{inventario.eta_massima_bambino} anni)
                  </Text>
                  <Input>
                    <InputField
                      keyboardType="numeric"
                      value={form.ingressiBambini}
                      onChangeText={(text) => updateForm({ ingressiBambini: text })}
                    />
                  </Input>
                </VStack>
                <VStack space="xs">
                  <Text size="sm" className="font-medium">
                    Ingressi gratuiti (sotto {inventario.eta_minima_bambino} anni)
                  </Text>
                  <Input>
                    <InputField
                      keyboardType="numeric"
                      value={form.ingressiGratuiti}
                      onChangeText={(text) => updateForm({ ingressiGratuiti: text })}
                    />
                  </Input>
                </VStack>
              </>
            ) : null}

            <HStack space="sm">
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Ombrelloni
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={form.ombrellone}
                    onChangeText={(text) => updateForm({ ombrellone: text })}
                  />
                </Input>
              </VStack>
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Gazebi
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={form.gazebo}
                    onChangeText={(text) => updateForm({ gazebo: text })}
                  />
                </Input>
              </VStack>
            </HStack>

            <HStack space="sm">
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Lettini
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={form.lettino}
                    onChangeText={(text) => updateForm({ lettino: text })}
                  />
                </Input>
              </VStack>
              <VStack space="xs" className="flex-1">
                <Text size="sm" className="font-medium">
                  Sdraie
                </Text>
                <Input>
                  <InputField
                    keyboardType="numeric"
                    value={form.sdraia}
                    onChangeText={(text) => updateForm({ sdraia: text })}
                  />
                </Input>
              </VStack>
            </HStack>

            {error ? (
              <Text size="sm" className="text-center text-destructive">
                {error}
              </Text>
            ) : null}
            <Button onPress={handleConfirm} disabled={isSubmitting}>
              {isSubmitting ? <ButtonSpinner /> : <ButtonText>Salva modifiche</ButtonText>}
            </Button>
            <Button variant="link" onPress={onClose}>
              <ButtonText>Annulla</ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

export default function ClienteDetailScreen() {
  const { clienteId } = useLocalSearchParams<{ clienteId: string }>();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazionePiscina[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPrenotazione, setEditingPrenotazione] = useState<PrenotazionePiscina | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Storico ordini asporto — stesso trattamento dello storico piscina sopra, con in più le righe
  // prodotto (VoceOrdine) caricate eagerly per ogni ordine (stesso principio già in vigore in
  // "Storico Ordini", app/staff/asporto/ordini.tsx: pochi ordini per cliente, vederne subito il
  // contenuto vale più di un ulteriore tap per espanderli).
  const [ordiniAsporto, setOrdiniAsporto] = useState<PrenotazioneAsporto[]>([]);
  const [vociByOrdine, setVociByOrdine] = useState<Record<string, VoceOrdine[]>>({});
  const [editingOrdine, setEditingOrdine] = useState<PrenotazioneAsporto | null>(null);
  const [cancellingOrdineId, setCancellingOrdineId] = useState<string | null>(null);
  const [confirmingOrdineId, setConfirmingOrdineId] = useState<string | null>(null);

  // Un tab alla volta invece di due lunghe liste sempre entrambe in vista — la pagina era
  // segnalata come "poco intuitiva" perché piscina e asporto scorrevano una dopo l'altra senza
  // alcuna gerarchia: ora le due card statistiche sotto fungono anche da selettore. Ogni sezione
  // è a sua volta divisa in "In programma" (oggi/futuro, non cancellata — ciò che allo staff serve
  // davvero) e "Storico" (passato o cancellato, mai azionabile), quest'ultima ripiegata di default
  // per non affollare la pagina con card intere fatte solo di pulsanti disabilitati.
  const [activeTab, setActiveTab] = useState<'PISCINA' | 'ASPORTO'>('PISCINA');
  const [piscinaStoricoOpen, setPiscinaStoricoOpen] = useState(false);
  const [asportoStoricoOpen, setAsportoStoricoOpen] = useState(false);

  useEffect(() => {
    if (!clienteId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getCliente(clienteId),
      listPrenotazioniPiscinaByCliente(clienteId),
      listPrenotazioniAsportoByCliente(clienteId),
    ])
      .then(async ([clienteData, prenotazioniData, ordiniData]) => {
        if (cancelled) return;
        setCliente(clienteData);
        // Storico più recente per primo: confronto lessicografico su "YYYY-MM-DD"/"HH:MM:SS",
        // valido perché entrambi i formati sono ordinabili come stringa.
        setPrenotazioni(
          [...prenotazioniData].sort((a, b) => {
            if (a.data !== b.data) return b.data.localeCompare(a.data);
            return b.ora.localeCompare(a.ora);
          })
        );
        const ordiniOrdinati = [...ordiniData].sort((a, b) => {
          if (a.data !== b.data) return b.data.localeCompare(a.data);
          return b.ora.localeCompare(a.ora);
        });
        setOrdiniAsporto(ordiniOrdinati);
        const entries = await Promise.all(
          ordiniOrdinati.map((o) => listVociOrdine({ prenotazione: o.id }).then((voci) => [o.id, voci] as const))
        );
        if (cancelled) return;
        setVociByOrdine(Object.fromEntries(entries));
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare la scheda cliente. Riprova.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const openEdit = (p: PrenotazionePiscina) => {
    // Backstop, non solo il `disabled` dei pulsanti in PrenotazioneRow.
    if (isPrenotazionePassata(p) || p.stato === 'CANCELLED') return;
    setEditingPrenotazione(p);
  };

  const handleSaved = (updated: PrenotazionePiscina) => {
    setPrenotazioni((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setEditingPrenotazione(null);
  };

  const handleCancel = (p: PrenotazionePiscina) => {
    if (isPrenotazionePassata(p) || p.stato === 'CANCELLED') return;
    const message = `La prenotazione del ${formatDateDDMMYYYY(p.data)} verrà annullata. Le eventuali postazioni già assegnate torneranno libere sulla mappa; la prenotazione resterà comunque visibile qui come cancellata.`;

    const doCancel = async () => {
      setCancellingId(p.id);
      try {
        // Il backend libera da sé le postazioni collegate; qui manteniamo la riga nello storico.
        const updated = await updatePrenotazionePiscina(p.id, { stato: 'CANCELLED' });
        setPrenotazioni((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch {
        const message2 = 'Impossibile annullare la prenotazione. Riprova.';
        if (Platform.OS === 'web') {
          window.alert(message2);
        } else {
          Alert.alert('Errore', message2);
        }
      } finally {
        setCancellingId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        doCancel();
      }
      return;
    }
    Alert.alert('Annullare prenotazione?', message, [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla prenotazione', style: 'destructive', onPress: doCancel },
    ]);
  };

  // Editabilità calcolata per singolo ordine (data propria), non per una data selezionata unica —
  // a differenza di "Storico Ordini" (un solo giorno alla volta), qui lo storico copre più giorni.
  const openEditOrdine = (o: PrenotazioneAsporto) => {
    if (isOrdineAsportoPassato(o) || o.stato === 'CANCELLED') return;
    setEditingOrdine(o);
  };

  const handleOrdineSaved = (updated: PrenotazioneAsporto) => {
    setOrdiniAsporto((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    setEditingOrdine(null);
  };

  const handleVociChange = (prenotazioneId: string, next: VoceOrdine[]) => {
    setVociByOrdine((prev) => ({ ...prev, [prenotazioneId]: next }));
  };

  const handleConfirmOrdine = async (o: PrenotazioneAsporto) => {
    if (isOrdineAsportoPassato(o)) return;
    setConfirmingOrdineId(o.id);
    try {
      const updated = await updatePrenotazioneAsporto(o.id, { stato: 'CONFIRMED' });
      setOrdiniAsporto((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      const message = extractErrorMessage(err, "Impossibile confermare l'ordine. Riprova.");
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Errore', message);
      }
    } finally {
      setConfirmingOrdineId(null);
    }
  };

  const handleCancelOrdine = (o: PrenotazioneAsporto) => {
    if (isOrdineAsportoPassato(o) || o.stato === 'CANCELLED') return;
    const message = `L'ordine del ${formatDateDDMMYYYY(o.data)} verrà annullato. Resterà comunque visibile qui come cancellato.`;

    const doCancel = async () => {
      setCancellingOrdineId(o.id);
      try {
        const updated = await updatePrenotazioneAsporto(o.id, { stato: 'CANCELLED' });
        setOrdiniAsporto((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } catch (err) {
        const message2 = extractErrorMessage(err, "Impossibile annullare l'ordine. Riprova.");
        if (Platform.OS === 'web') {
          window.alert(message2);
        } else {
          Alert.alert('Errore', message2);
        }
      } finally {
        setCancellingOrdineId(null);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        doCancel();
      }
      return;
    }
    Alert.alert('Annullare ordine?', message, [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla ordine', style: 'destructive', onPress: doCancel },
    ]);
  };

  // "In programma" = oggi/futuro e non cancellata: l'unico sottoinsieme davvero azionabile.
  // "Storico" = tutto il resto (passata, oppure cancellata a prescindere dalla data) — mai
  // azionabile, coerente con `PrenotazioneRow`/`OrdineRow` che nascondono comunque i pulsanti per
  // `CANCELLED` e li disabilitano per il passato: qui la distinzione guida solo il raggruppamento
  // visivo, la logica di editabilità resta interamente in `openEdit`/`openEditOrdine` (invariata).
  const oggiISO = toISODate(new Date());

  const prenotazioniProssime = useMemo(
    () =>
      prenotazioni
        .filter((p) => p.stato !== 'CANCELLED' && p.data >= oggiISO)
        .sort((a, b) => (a.data !== b.data ? a.data.localeCompare(b.data) : a.ora.localeCompare(b.ora))),
    [prenotazioni, oggiISO]
  );
  const prenotazioniStoriche = useMemo(
    // `prenotazioni` è già ordinata per data/ora decrescente (fetch iniziale) — un filtro basta,
    // nessun secondo sort necessario.
    () => prenotazioni.filter((p) => p.stato === 'CANCELLED' || p.data < oggiISO),
    [prenotazioni, oggiISO]
  );

  const ordiniProssimi = useMemo(
    () =>
      ordiniAsporto
        .filter((o) => o.stato !== 'CANCELLED' && o.data >= oggiISO)
        .sort((a, b) => (a.data !== b.data ? a.data.localeCompare(b.data) : a.ora.localeCompare(b.ora))),
    [ordiniAsporto, oggiISO]
  );
  const ordiniStorici = useMemo(
    () => ordiniAsporto.filter((o) => o.stato === 'CANCELLED' || o.data < oggiISO),
    [ordiniAsporto, oggiISO]
  );

  if (!clienteId || isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <ClienteDetailHeader nome={cliente?.nome} />

        {error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : null}

        {cliente ? (
          // Affordance di click esplicita (2026-08-21) — stesso identico linguaggio già collaudato
          // per le card piscina cliccabili (sezione 7, "Prenota ora" + freccia su sfondo
          // sky-500/20): prima l'unico indizio che l'intera riga aprisse il tastierino del
          // telefono era il colore del testo, facilmente scambiato per un dettaglio decorativo.
          // Ora l'intera card è il `Pressable` (bordo più marcato + ombra, `active:opacity-80` per
          // un feedback immediato al tocco) e una pillola "Chiama" con freccia, sullo stesso sfondo
          // azzurro delle altre CTA dell'app, rende esplicita l'azione invece di lasciarla implicita.
          <Pressable
            onPress={() => Linking.openURL(`tel:${cliente.telefono}`).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`Chiama ${cliente.telefono}`}
            className="active:opacity-80"
          >
            <Box className="w-full rounded-xl border-2 border-sky-200 bg-white p-4 shadow-sm">
              <HStack className="items-center justify-between">
                <HStack space="xs" className="items-center">
                  <Icon as={PhoneIcon} size="sm" className="text-sky-600" />
                  <Text size="md" className="font-medium text-sky-900">
                    {cliente.telefono}
                  </Text>
                </HStack>
                <HStack space="xs" className="items-center rounded-full bg-sky-500/15 px-3 py-1.5">
                  <Text size="xs" className="font-bold text-sky-700">
                    Chiama
                  </Text>
                  <Icon as={ChevronRightIcon} size="xs" className="text-sky-700" />
                </HStack>
              </HStack>
            </Box>
          </Pressable>
        ) : null}

        <HStack space="sm" className="w-full">
          <TabStatCard
            icona="🏊"
            etichetta="Piscina"
            totale={prenotazioni.length}
            sottotitolo={prenotazioniProssime.length > 0 ? `${prenotazioniProssime.length} in programma` : 'Nessuna in programma'}
            isActive={activeTab === 'PISCINA'}
            onPress={() => setActiveTab('PISCINA')}
          />
          <TabStatCard
            icona="🥡"
            etichetta="Asporto"
            totale={ordiniAsporto.length}
            sottotitolo={ordiniProssimi.length > 0 ? `${ordiniProssimi.length} in programma` : 'Nessuna in programma'}
            isActive={activeTab === 'ASPORTO'}
            onPress={() => setActiveTab('ASPORTO')}
          />
        </HStack>

        {activeTab === 'PISCINA' ? (
          <PiscinaTabContent
            prenotazioni={prenotazioni}
            prenotazioniProssime={prenotazioniProssime}
            prenotazioniStoriche={prenotazioniStoriche}
            storicoOpen={piscinaStoricoOpen}
            onToggleStorico={() => setPiscinaStoricoOpen((v) => !v)}
            onEdit={openEdit}
            onCancel={handleCancel}
            cancellingId={cancellingId}
          />
        ) : (
          <AsportoTabContent
            ordiniAsporto={ordiniAsporto}
            ordiniProssimi={ordiniProssimi}
            ordiniStorici={ordiniStorici}
            vociByOrdine={vociByOrdine}
            storicoOpen={asportoStoricoOpen}
            onToggleStorico={() => setAsportoStoricoOpen((v) => !v)}
            onEdit={openEditOrdine}
            onCancel={handleCancelOrdine}
            onConfirm={handleConfirmOrdine}
            cancellingOrdineId={cancellingOrdineId}
            confirmingOrdineId={confirmingOrdineId}
          />
        )}
      </VStack>

      <EditStoricoSheet
        prenotazione={editingPrenotazione}
        onClose={() => setEditingPrenotazione(null)}
        onSaved={handleSaved}
      />

      <EditOrdineSheet
        ordine={editingOrdine}
        voci={editingOrdine ? vociByOrdine[editingOrdine.id] ?? [] : []}
        onClose={() => setEditingOrdine(null)}
        onSaved={handleOrdineSaved}
        onVociChange={handleVociChange}
      />
    </ScrollView>
  );
}
