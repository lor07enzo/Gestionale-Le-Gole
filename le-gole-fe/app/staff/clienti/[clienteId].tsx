import { useEffect, useState } from 'react';
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
import { ArrowLeftIcon, EditIcon, Icon, PhoneIcon, SlashIcon } from '@/components/ui/icon';
import { getCliente, type Cliente } from '../../../src/services/clienti';
import {
  listPrenotazioniPiscinaByCliente,
  updatePrenotazionePiscina,
  type PrenotazionePiscina,
} from '../../../src/services/prenotazioni';
import { getPiscinaInventario, type PiscinaInventario } from '../../../src/services/struttura';
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
          Anagrafica e storico prenotazioni
        </Text>
      </VStack>
    </HStack>
  );
}

// "Nei giorni seguenti alla data scelta" una prenotazione non è più modificabile/annullabile —
// stesso principio isPastDate già usato sulla mappa staff (sezione 5 CLAUDE.md), qui calcolato
// per singola prenotazione (non per una data selezionata sulla mappa) dato che questa pagina
// elenca lo storico su date diverse, non un solo giorno.
function isPrenotazionePassata(p: PrenotazionePiscina): boolean {
  return p.data < toISODate(new Date());
}

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: unknown } })?.response?.data;
  if (detail && typeof detail === 'object') {
    const message = Object.values(detail as Record<string, unknown>).flat().join(' ');
    if (message) return message;
  }
  return fallback;
}

function PrenotazioneRow({
  prenotazione: p,
  onEdit,
  onCancel,
  isCancelling,
}: Readonly<{
  prenotazione: PrenotazionePiscina;
  onEdit: (p: PrenotazionePiscina) => void;
  onCancel: (p: PrenotazionePiscina) => void;
  isCancelling: boolean;
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

        {p.stato !== 'CANCELLED' ? (
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

// Foglio di modifica standalone: a differenza di EditPrenotazioneSheet.tsx (mappa staff), questa
// pagina non vive dentro PiscinaMappaDataProvider/PiscinaSheetsProvider (che richiedono un
// inventarioId+data singoli) — lo storico di un cliente può includere prenotazioni su date/piscine
// diverse, quindi l'inventario (per i vincoli di orario/tariffa ridotta) viene caricato al volo
// per la prenotazione aperta, non ereditato da un context.
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

  useEffect(() => {
    if (!clienteId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([getCliente(clienteId), listPrenotazioniPiscinaByCliente(clienteId)])
      .then(([clienteData, prenotazioniData]) => {
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
    // Backstop difensivo, non solo il `disabled` dei pulsanti in PrenotazioneRow (stesso principio
    // già seguito altrove nel progetto per le restrizioni di sola-UI): una prenotazione passata o
    // già cancellata non deve aprire il foglio di modifica in nessun caso.
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
        // PATCH stato='CANCELLED', non un'eliminazione: il backend libera da sé le postazioni
        // collegate (PrenotazionePiscinaViewSet.perform_update) — qui manteniamo la riga nello
        // storico (aggiornata, non filtrata via) a differenza dell'equivalente sulla mappa staff
        // (PiscinaMappaDataContext.cancelPrenotazione), che invece la toglie dalla vista del
        // giorno perché lì non c'è più nulla da fare su una prenotazione cancellata.
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
          <Box className="w-full rounded-xl border border-sky-100 bg-white p-4 shadow-sm">
            <Pressable
              onPress={() => Linking.openURL(`tel:${cliente.telefono}`).catch(() => {})}
              accessibilityRole="link"
              accessibilityLabel={`Chiama ${cliente.telefono}`}
            >
              <HStack space="xs" className="items-center">
                <Icon as={PhoneIcon} size="sm" className="text-sky-600" />
                <Text size="md" className="font-medium text-sky-700">
                  {cliente.telefono}
                </Text>
              </HStack>
            </Pressable>
          </Box>
        ) : null}

        <VStack space="sm" className="w-full">
          <HStack className="items-center justify-between">
            <Heading size="md">Storico prenotazioni</Heading>
            <Text size="xs" className="text-muted-foreground">
              {prenotazioni.length} {prenotazioni.length === 1 ? 'prenotazione' : 'prenotazioni'}
            </Text>
          </HStack>

          {prenotazioni.length === 0 ? (
            <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
              <Text size="lg">📭</Text>
              <Text size="sm" className="text-center text-muted-foreground">
                Nessuna prenotazione registrata per questo cliente.
              </Text>
            </VStack>
          ) : (
            prenotazioni.map((p) => (
              <PrenotazioneRow
                key={p.id}
                prenotazione={p}
                onEdit={openEdit}
                onCancel={handleCancel}
                isCancelling={cancellingId === p.id}
              />
            ))
          )}
        </VStack>
      </VStack>

      <EditStoricoSheet
        prenotazione={editingPrenotazione}
        onClose={() => setEditingPrenotazione(null)}
        onSaved={handleSaved}
      />
    </ScrollView>
  );
}
