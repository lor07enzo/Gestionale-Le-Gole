import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { AddIcon } from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
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
    <Box className="w-full web:h-full rounded-2xl border border-sky-200 bg-sky-100">
      {/* Zona primaria: l'intera card apre la mappa. Modifica/Elimina vivono FUORI da questo
          Pressable (sotto, dopo il divisorio) per non mischiare "vai alla mappa" con "modifica il listino". */}
      <Pressable
        onPress={openMappa}
        className="flex-1"
        accessibilityLabel={`Apri mappa postazioni per ${inventario.nome}`}
      >
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
        {/*
          bg-white esplicito su entrambi, non il bg-background di default di variant="outline":
          quest'ultimo eredita il tema dell'app (crema/dark a seconda della variabile --background),
          che non ha senso dentro una card a tinta fissa bg-sky-100 — stesso principio già in uso
          per i pulsanti di navigazione/zoom della mappa piscina (sezione 5 di CLAUDE.md). bg-white
          è una classe Tailwind letterale (non legata a nessuna variabile CSS di progetto), quindi
          resta identica a prescindere dal tema e non soffre della stessa inaffidabilità di
          risoluzione già osservata per bg-background/bg-card su alcuni dispositivi.

          I bordi colorati NON sono più affidati alle classi border-sky-300/border-destructive/40:
          border-sky-300 risolve in Tailwind v4 con un colore oklch() (`oklch(82.8% 0.111 230.318)`,
          node_modules/tailwindcss/theme.css) — segnalato dall'utente come non applicato lato web,
          border-destructive/40 dipende invece dalla variabile CSS di progetto --destructive. Stesso
          principio già usato per il pulsante "Area Cliente" in app/index.tsx: un colore letterale via style
          inline bypassa del tutto la risoluzione (className, variabile CSS, oklch), quindi è
          garantito identico su ogni piattaforma.
        */}
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-white"
          style={{ borderWidth: 1, borderColor: '#7dd3fc' }}
          onPress={onEdit}
        >
          <ButtonText>Modifica listino</ButtonText>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 bg-white"
          style={{ borderWidth: 1, borderColor: 'rgba(231, 0, 11, 0.4)' }}
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
      {/* Titolo e sottotitolo vivono ora nell'header della pagina (app/staff/piscina.tsx): qui resta
          solo l'azione primaria, così la sezione non ripete l'intestazione appena sopra. */}
      <HStack className="items-center">
        <Button size="default" className="min-h-11" onPress={openCreateForm}>
          <ButtonIcon as={AddIcon} className="text-primary-foreground" />
          <ButtonText>Nuovo listino</ButtonText>
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
          <Button size="sm" onPress={openCreateForm}>
            <ButtonText>+ Crea il primo listino</ButtonText>
          </Button>
        </VStack>
      ) : null}

      {/* Griglia 1/2/3 colonne. Ogni cella ha il proprio padding e il contenitore lo compensa con un
          margine negativo: con `space` (gap) + `md:w-1/2` la somma supererebbe il 100% e ogni card
          finirebbe da sola su una riga. */}
      <Box className="-m-2 w-full flex-row flex-wrap">
        {items.map((item) => (
          <Box key={item.id} className="w-full p-2 md:w-1/2 lg:w-1/3">
            <PiscinaInventarioCard
              inventario={item}
              onEdit={() => openEditForm(item)}
              onDelete={() => handleDelete(item)}
            />
          </Box>
        ))}
      </Box>

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
