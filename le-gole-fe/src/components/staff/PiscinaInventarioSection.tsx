import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import {
  createPiscinaInventario,
  deletePiscinaInventario,
  listPiscinaInventari,
  updatePiscinaInventario,
  type CreatePiscinaInventarioPayload,
  type PiscinaInventario,
} from '../../services/struttura';
import { extractErrorMessage } from '../../utils/errors';
import { formatOrarioInput } from '../../utils/piscinaMappa';

type TipoInventario = 'PISCINA' | 'SALA' | 'PADEL';

const TIPO_INVENTARIO_OPTIONS: Array<{
  tipo: TipoInventario;
  icon: string;
  label: string;
  descrizione: string;
  disponibile: boolean;
}> = [
  { tipo: 'PISCINA', icon: '🏊', label: 'Piscina', descrizione: 'Listino, ombrelloni, gazebi, lettini e sdraie', disponibile: true },
  { tipo: 'SALA', icon: '🍽️', label: 'Sala', descrizione: 'In arrivo', disponibile: false },
  { tipo: 'PADEL', icon: '🎾', label: 'Padel', descrizione: 'In arrivo', disponibile: false },
];

const STOCK_ITEMS: Array<{ key: keyof PiscinaInventario; icon: string; label: string }> = [
  { key: 'totale_ombrelloni', icon: '⛱️', label: 'Ombrelloni' },
  { key: 'totale_gazebi', icon: '⛺', label: 'Gazebo' },
  { key: 'totale_lettini', icon: '🛏️', label: 'Lettini' },
  { key: 'totale_sdraie', icon: '🪑', label: 'Sdraie' },
];

type FormState = {
  nome: string;
  descrizione: string;
  orarioApertura: string;
  orarioChiusura: string;
  prezzoIngresso: string;
  prezzoIngressoRidotto: string;
  prezzoIngressoBambino: string;
  orarioInizioRidotto: string;
  etaMinimaBambino: string;
  etaMassimaBambino: string;
  prezzoOmbrellone: string;
  prezzoGazebo: string;
  prezzoLettino: string;
  prezzoSdraia: string;
  totaleOmbrelloni: string;
  totaleGazebi: string;
  totaleLettini: string;
  totaleSdraie: string;
  isActive: boolean;
};

const INITIAL_FORM_STATE: FormState = {
  nome: '',
  descrizione: '',
  orarioApertura: '10:00',
  orarioChiusura: '19:00',
  prezzoIngresso: '0',
  prezzoIngressoRidotto: '0',
  prezzoIngressoBambino: '0',
  orarioInizioRidotto: '14:00',
  etaMinimaBambino: '3',
  etaMassimaBambino: '12',
  prezzoOmbrellone: '0',
  prezzoGazebo: '0',
  prezzoLettino: '0',
  prezzoSdraia: '0',
  totaleOmbrelloni: '0',
  totaleGazebi: '0',
  totaleLettini: '0',
  totaleSdraie: '0',
  isActive: false,
};

function formStateFromItem(item: PiscinaInventario): FormState {
  return {
    nome: item.nome,
    descrizione: item.descrizione,
    orarioApertura: item.orario_apertura.slice(0, 5),
    orarioChiusura: item.orario_chiusura.slice(0, 5),
    prezzoIngresso: item.prezzo_ingresso,
    prezzoIngressoRidotto: item.prezzo_ingresso_ridotto,
    prezzoIngressoBambino: item.prezzo_ingresso_bambino,
    orarioInizioRidotto: item.orario_inizio_ridotto.slice(0, 5),
    etaMinimaBambino: String(item.eta_minima_bambino),
    etaMassimaBambino: String(item.eta_massima_bambino),
    prezzoOmbrellone: item.prezzo_ombrellone,
    prezzoGazebo: item.prezzo_gazebo,
    prezzoLettino: item.prezzo_lettino,
    prezzoSdraia: item.prezzo_sdraia,
    totaleOmbrelloni: String(item.totale_ombrelloni),
    totaleGazebi: String(item.totale_gazebi),
    totaleLettini: String(item.totale_lettini),
    totaleSdraie: String(item.totale_sdraie),
    isActive: item.isActive,
  };
}

function payloadFromFormState(form: FormState): CreatePiscinaInventarioPayload {
  return {
    nome: form.nome.trim(),
    descrizione: form.descrizione.trim(),
    orario_apertura: form.orarioApertura,
    orario_chiusura: form.orarioChiusura,
    prezzo_ingresso: form.prezzoIngresso,
    prezzo_ingresso_ridotto: form.prezzoIngressoRidotto,
    prezzo_ingresso_bambino: form.prezzoIngressoBambino,
    orario_inizio_ridotto: form.orarioInizioRidotto,
    eta_minima_bambino: Number.parseInt(form.etaMinimaBambino, 10) || 0,
    eta_massima_bambino: Number.parseInt(form.etaMassimaBambino, 10) || 0,
    prezzo_ombrellone: form.prezzoOmbrellone,
    prezzo_gazebo: form.prezzoGazebo,
    prezzo_lettino: form.prezzoLettino,
    prezzo_sdraia: form.prezzoSdraia,
    totale_ombrelloni: Number.parseInt(form.totaleOmbrelloni, 10) || 0,
    totale_gazebi: Number.parseInt(form.totaleGazebi, 10) || 0,
    totale_lettini: Number.parseInt(form.totaleLettini, 10) || 0,
    totale_sdraie: Number.parseInt(form.totaleSdraie, 10) || 0,
    isActive: form.isActive,
  };
}

type PiscinaInventarioCardProps = {
  inventario: PiscinaInventario;
  onEdit: () => void;
  onDelete: () => void;
};

function PiscinaInventarioCard({ inventario, onEdit, onDelete }: Readonly<PiscinaInventarioCardProps>) {
  const openMappa = () => router.push(`/staff/piscina/${inventario.id}` as Href);

  return (
    <Box className="w-full rounded-2xl border border-sky-200 bg-sky-100 md:flex-1">
      {/* Zona primaria: l'intera card apre la mappa. Modifica/Elimina vivono FUORI da questo
          Pressable (sotto, dopo il divisorio) per non mischiare "vai alla mappa" con "modifica il listino". */}
      <Pressable onPress={openMappa} accessibilityLabel={`Apri mappa postazioni per ${inventario.nome}`}>
        <VStack space="sm" className="p-5 pb-4">
          <HStack space="sm" className="items-center">
            <Box className="h-10 w-10 items-center justify-center rounded-full bg-white/70">
              <Text size="lg">🏊</Text>
            </Box>
            <VStack className="flex-1">
              <Heading size="md">{inventario.nome}</Heading>
              {inventario.descrizione ? (
                <Text size="xs" className="text-sky-900/70" isTruncated>
                  {inventario.descrizione}
                </Text>
              ) : null}
            </VStack>
            {inventario.isActive ? (
              <Box className="rounded-full bg-sky-500/15 px-2 py-0.5">
                <Text size="xs" className="font-medium text-sky-700">
                  Attivo
                </Text>
              </Box>
            ) : null}
          </HStack>

          <Box className="flex-row flex-wrap rounded-xl bg-white/60 p-1">
            {STOCK_ITEMS.map((item) => (
              <HStack key={item.key} space="xs" className="w-1/2 items-center px-2 py-1.5">
                <Text size="md">{item.icon}</Text>
                <Text size="sm" className="font-semibold text-sky-900">
                  {inventario[item.key] as number}
                </Text>
                <Text size="xs" className="text-sky-900/70">
                  {item.label}
                </Text>
              </HStack>
            ))}
          </Box>

          <HStack className="items-center justify-between rounded-xl bg-sky-500/15 px-3 py-2">
            <Text size="xs" className="text-sky-900/70">
              {inventario.orario_apertura.slice(0, 5)} - {inventario.orario_chiusura.slice(0, 5)}
            </Text>
            <HStack space="xs" className="items-center">
              <Text size="xs" className="font-semibold text-sky-700">
                Gestisci mappa postazioni
              </Text>
              <Text size="sm" className="font-semibold text-sky-700">
                →
              </Text>
            </HStack>
          </HStack>
        </VStack>
      </Pressable>

      <Box className="mx-5 h-px bg-sky-200" />

      <HStack space="sm" className="p-5 pt-3">
        <Button size="sm" variant="outline" className="flex-1 border-sky-300" onPress={onEdit}>
          <ButtonText>Modifica listino</ButtonText>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-destructive/40"
          onPress={onDelete}
        >
          <ButtonText className="text-destructive">Elimina</ButtonText>
        </Button>
      </HStack>
    </Box>
  );
}

function NumberField({
  label,
  value,
  onChangeText,
}: Readonly<{ label: string; value: string; onChangeText: (text: string) => void }>) {
  return (
    <VStack space="xs" className="flex-1">
      <Text size="sm" className="font-medium">
        {label}
      </Text>
      <Input>
        <InputField keyboardType="numeric" value={value} onChangeText={onChangeText} />
      </Input>
    </VStack>
  );
}

export function PiscinaInventarioSection() {
  const [items, setItems] = useState<PiscinaInventario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [editingItem, setEditingItem] = useState<PiscinaInventario | null>(null);
  const [isTypeChooserOpen, setIsTypeChooserOpen] = useState(false);

  useEffect(() => {
    listPiscinaInventari()
      .then(setItems)
      .catch(() => setError('Impossibile caricare gli inventari piscina.'))
      .finally(() => setIsLoading(false));
  }, []);

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setField = <K extends keyof FormState>(key: K) => (value: FormState[K]) => updateForm(key, value);

  const openCreateForm = () => {
    setEditingItem(null);
    setForm(INITIAL_FORM_STATE);
    setError(null);
    setIsFormOpen(true);
  };

  const handleChooseTipoInventario = (tipo: TipoInventario) => {
    setIsTypeChooserOpen(false);
    if (tipo === 'PISCINA') {
      openCreateForm();
      return;
    }
    const label = TIPO_INVENTARIO_OPTIONS.find((option) => option.tipo === tipo)?.label ?? tipo;
    const message = `La gestione dell'inventario ${label} è in arrivo: non è ancora disponibile.`;
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert('Prossimamente', message);
    }
  };

  const openEditForm = (item: PiscinaInventario) => {
    setEditingItem(item);
    setForm(formStateFromItem(item));
    setError(null);
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      setError('Il nome è obbligatorio.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = payloadFromFormState(form);
      if (editingItem) {
        const updated = await updatePiscinaInventario(editingItem.id, payload);
        setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const created = await createPiscinaInventario(payload);
        setItems((prev) => [created, ...prev]);
      }
      setIsFormOpen(false);
      setEditingItem(null);
      setForm(INITIAL_FORM_STATE);
    } catch {
      setError("Impossibile salvare l'inventario. Controlla i dati inseriti.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeItemLocally = (id: string) => {
    setItems((prev) => prev.filter((current) => current.id !== id));
  };

  const confirmDelete = async (item: PiscinaInventario) => {
    try {
      await deletePiscinaInventario(item.id);
      removeItemLocally(item.id);
    } catch (err) {
      // Il form (dove vive `error`) non è aperto durante un'eliminazione dalla card,
      // quindi un messaggio va mostrato subito con un alert, non solo salvato in state.
      const message = extractErrorMessage(err, "Impossibile eliminare l'inventario.");
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Impossibile eliminare', message);
      }
    }
  };

  const handleDelete = (item: PiscinaInventario) => {
    const message = `"${item.nome}" verrà eliminato definitivamente.`;

    // Alert.alert is a no-op on react-native-web: it never renders and never
    // invokes the button callbacks, so web needs its own confirm path.
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDelete(item);
      }
      return;
    }

    Alert.alert('Eliminare inventario?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => confirmDelete(item) },
    ]);
  };

  return (
    <VStack space="md" className="w-full">
      <HStack className="items-center justify-between">
        <VStack>
          <Heading size="md">Inventario Piscina</Heading>
          <Text size="xs" className="text-muted-foreground">
            Tocca un listino per gestire la mappa delle postazioni del giorno.
          </Text>
        </VStack>
        <Button size="sm" onPress={() => setIsTypeChooserOpen(true)}>
          <ButtonText>+ Aggiungi</ButtonText>
        </Button>
      </HStack>

      {isLoading ? (
        <HStack space="sm" className="items-center py-4">
          <Spinner size="small" />
          <Text size="sm" className="text-muted-foreground">
            Caricamento listini...
          </Text>
        </HStack>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
          <Text size="lg">🏊</Text>
          <Text size="sm" className="text-center text-muted-foreground">
            Nessun listino piscina creato ancora.{'\n'}Crea il primo per iniziare a gestire prenotazioni e postazioni.
          </Text>
          <Button size="sm" onPress={() => setIsTypeChooserOpen(true)}>
            <ButtonText>+ Crea il primo listino</ButtonText>
          </Button>
        </VStack>
      ) : null}

      <VStack space="md" className="w-full md:flex-row md:flex-wrap">
        {items.map((item) => (
          <PiscinaInventarioCard
            key={item.id}
            inventario={item}
            onEdit={() => openEditForm(item)}
            onDelete={() => handleDelete(item)}
          />
        ))}
      </VStack>

      <Actionsheet isOpen={isTypeChooserOpen} onClose={() => setIsTypeChooserOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack space="xs" className="w-full pb-4 pt-1">
            <Heading size="sm" className="px-1 pb-2">
              Che tipo di inventario vuoi creare?
            </Heading>

            {TIPO_INVENTARIO_OPTIONS.map((option) => (
              <ActionsheetItem
                key={option.tipo}
                onPress={() => handleChooseTipoInventario(option.tipo)}
                className="rounded-lg data-[hover=true]:bg-sky-100 data-[active=true]:bg-sky-100"
              >
                <Text size="lg">{option.icon}</Text>
                <VStack className="flex-1">
                  <ActionsheetItemText className={option.disponibile ? 'font-semibold' : 'font-semibold text-muted-foreground'}>
                    {option.label}
                  </ActionsheetItemText>
                  <Text size="xs" className="text-muted-foreground">
                    {option.descrizione}
                  </Text>
                </VStack>
                {!option.disponibile ? (
                  <Box className="rounded-full bg-amber-100 px-2 py-0.5">
                    <Text size="2xs" className="font-medium text-amber-700">
                      In arrivo
                    </Text>
                  </Box>
                ) : null}
              </ActionsheetItem>
            ))}
          </VStack>
        </ActionsheetContent>
      </Actionsheet>

      <Actionsheet isOpen={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[85vh]">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetScrollView className="w-full">
            <VStack space="md" className="w-full pb-6">
              <Heading size="md">
                {editingItem ? 'Modifica Inventario Piscina' : 'Nuovo Inventario Piscina'}
              </Heading>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Nome
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. Listino Estate 2026"
                    value={form.nome}
                    onChangeText={setField('nome')}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Descrizione (opzionale)
                </Text>
                <Input>
                  <InputField
                    placeholder="Breve descrizione"
                    value={form.descrizione}
                    onChangeText={setField('descrizione')}
                  />
                </Input>
              </VStack>

              <HStack space="sm">
                <NumberField
                  label="Apertura"
                  value={form.orarioApertura}
                  onChangeText={setField('orarioApertura')}
                />
                <NumberField
                  label="Chiusura"
                  value={form.orarioChiusura}
                  onChangeText={setField('orarioChiusura')}
                />
              </HStack>

              <Text size="sm" className="font-semibold text-muted-foreground">
                Prezzi (€)
              </Text>
              <HStack space="sm">
                <NumberField
                  label="Ingresso"
                  value={form.prezzoIngresso}
                  onChangeText={setField('prezzoIngresso')}
                />
                <NumberField
                  label="Ombrellone"
                  value={form.prezzoOmbrellone}
                  onChangeText={setField('prezzoOmbrellone')}
                />
              </HStack>
              <HStack space="sm">
                <NumberField
                  label="Gazebo"
                  value={form.prezzoGazebo}
                  onChangeText={setField('prezzoGazebo')}
                />
                <NumberField
                  label="Lettino"
                  value={form.prezzoLettino}
                  onChangeText={setField('prezzoLettino')}
                />
              </HStack>
              <HStack space="sm">
                <NumberField
                  label="Sdraia"
                  value={form.prezzoSdraia}
                  onChangeText={setField('prezzoSdraia')}
                />
                <Box className="flex-1" />
              </HStack>

              <Text size="sm" className="font-semibold text-muted-foreground">
                Ingressi ridotti (opzionali)
              </Text>
              <Text size="xs" className="text-muted-foreground">
                Lascia il prezzo a 0 per non proporre la tariffa (non appare nei form). Le soglie
                sotto sono solo un testo guida: nessuna verifica automatica di orario o età.
              </Text>
              <HStack space="sm">
                <NumberField
                  label="Prezzo ridotto"
                  value={form.prezzoIngressoRidotto}
                  onChangeText={setField('prezzoIngressoRidotto')}
                />
                <VStack space="xs" className="flex-1">
                  <Text size="sm" className="font-medium">
                    Valido dalle
                  </Text>
                  <Input>
                    <InputField
                      placeholder="Es. 14:00"
                      keyboardType="numeric"
                      maxLength={5}
                      value={form.orarioInizioRidotto}
                      onChangeText={(text) =>
                        updateForm('orarioInizioRidotto', formatOrarioInput(form.orarioInizioRidotto, text))
                      }
                    />
                  </Input>
                </VStack>
              </HStack>
              <HStack space="sm">
                <NumberField
                  label="Prezzo bambini"
                  value={form.prezzoIngressoBambino}
                  onChangeText={setField('prezzoIngressoBambino')}
                />
                <Box className="flex-1" />
              </HStack>
              <HStack space="sm">
                <NumberField
                  label="Età minima"
                  value={form.etaMinimaBambino}
                  onChangeText={setField('etaMinimaBambino')}
                />
                <NumberField
                  label="Età massima"
                  value={form.etaMassimaBambino}
                  onChangeText={setField('etaMassimaBambino')}
                />
              </HStack>
              <Text size="xs" className="text-muted-foreground">
                Fascia {form.etaMinimaBambino || '0'}-{form.etaMassimaBambino || '0'} anni: paga il
                prezzo bambini. Sotto {form.etaMinimaBambino || '0'} anni: ingresso gratuito.
              </Text>

              <Text size="sm" className="font-semibold text-muted-foreground">
                Quantità disponibili
              </Text>
              <HStack space="sm">
                <NumberField
                  label="Ombrelloni"
                  value={form.totaleOmbrelloni}
                  onChangeText={setField('totaleOmbrelloni')}
                />
                <NumberField
                  label="Gazebo"
                  value={form.totaleGazebi}
                  onChangeText={setField('totaleGazebi')}
                />
              </HStack>
              <HStack space="sm">
                <NumberField
                  label="Lettini"
                  value={form.totaleLettini}
                  onChangeText={setField('totaleLettini')}
                />
                <NumberField
                  label="Sdraie"
                  value={form.totaleSdraie}
                  onChangeText={setField('totaleSdraie')}
                />
              </HStack>

              <HStack className="items-center justify-between">
                <Text size="sm" className="font-medium">
                  Imposta come listino attivo
                </Text>
                <Switch value={form.isActive} onValueChange={setField('isActive')} />
              </HStack>

              {error ? (
                <Text size="sm" className="text-center text-destructive">
                  {error}
                </Text>
              ) : null}

              <Button onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{editingItem ? 'Salva modifiche' : 'Crea inventario'}</ButtonText>
                )}
              </Button>
              <Button variant="link" onPress={() => setIsFormOpen(false)}>
                <ButtonText>Annulla</ButtonText>
              </Button>
            </VStack>
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
}
