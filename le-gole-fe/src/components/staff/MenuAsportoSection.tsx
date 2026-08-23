import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Platform, Pressable, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import {
  AddIcon,
  CloseIcon,
  EditIcon,
  EyeIcon,
  EyeOffIcon,
  Icon,
  ImageIcon,
  SearchIcon,
  SettingsIcon,
  ThreeDotsIcon,
  TrashIcon,
} from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetIcon,
  ActionsheetItem,
  ActionsheetItemText,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import {
  createAllergene,
  createCategoria,
  createProdotto,
  deleteAllergene,
  deleteCategoria,
  deleteProdotto,
  listAllergeni,
  listCategorie,
  listProdotti,
  updateProdotto,
  uploadProdottoImmagine,
  type Allergene,
  type Categoria,
  type CreateProdottoPayload,
  type ImmagineProdottoFile,
  type Prodotto,
} from '../../services/menu';
import { CatalogListEditor } from './CatalogListEditor';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      if ('detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
        return (data as { detail: string }).detail;
      }
      const values = Object.values(data as Record<string, unknown>).flat();
      const messages = values.filter((value): value is string => typeof value === 'string');
      if (messages.length > 0) return messages.join(' ');
    }
  }
  return fallback;
}

function formatPrezzo(prezzo: string): string {
  const valore = Number.parseFloat(prezzo);
  return Number.isFinite(valore) ? `€ ${valore.toFixed(2)}` : `€ ${prezzo}`;
}

type FormState = {
  nome: string;
  descrizione: string;
  categoriaId: string;
  allergeneIds: string[];
  prezzo: string;
  disponibile: boolean;
};

const INITIAL_FORM_STATE: FormState = {
  nome: '',
  descrizione: '',
  categoriaId: '',
  allergeneIds: [],
  prezzo: '',
  disponibile: true,
};

function formStateFromItem(item: Prodotto): FormState {
  return {
    nome: item.nome,
    descrizione: item.descrizione,
    categoriaId: item.categoria,
    allergeneIds: item.allergeni,
    prezzo: item.prezzo,
    disponibile: item.disponibile,
  };
}

function payloadFromFormState(form: FormState): CreateProdottoPayload {
  return {
    nome: form.nome.trim(),
    descrizione: form.descrizione.trim(),
    categoria: form.categoriaId,
    allergeni: form.allergeneIds,
    prezzo: form.prezzo.trim(),
    disponibile: form.disponibile,
  };
}

// Prima parte: stessa tavolozza usata dal seed backend dei 14 allergeni ufficiali (Reg. UE
// 1169/2011, menu/migrations/0007_seed_allergeni_standard.py).
const ALLERGENE_ICONA_PRESET_UFFICIALI = [
  '🌾',
  '🦐',
  '🥚',
  '🐟',
  '🥜',
  '🌱',
  '🥛',
  '🌰',
  '🥬',
  '🌼',
  '🥯',
  '🍷',
  '🫛',
  '🐚',
];

// Seconda parte (2026-08-23, su richiesta esplicita dell'utente): icone aggiuntive per un
// allergene personalizzato non tra i 14 ufficiali sopra — non seminate lato backend (nessun
// obbligo di legge dietro), solo un aiuto visivo in più per un caso comune che lo staff vuole
// segnalare comunque (es. un cliente sensibile ai funghi, non un allergene "certificato").
const ALLERGENE_ICONA_PRESET_EXTRA = [
  '🍄',
  '🍈',
  '🥝',
  '🍅',
  '🍑',
  '🍓',
  '🌽',
  '🥑',
  '🍫',
  '🧄',
  '🧅',
  '🍌',
  // Carne e legumi, aggiunte lo stesso giorno su ulteriore richiesta esplicita dell'utente.
  '🥩',
  '🍗',
  '🫘',
];

// Tavolozza completa passata a `CatalogListEditor` (`iconOptions`, sotto) — un unico elenco
// scorrevole, nessuna distinzione visiva tra "ufficiale"/"extra" nel picker: lo staff sceglie
// semplicemente l'icona più adatta, l'ordine riflette solo quale set l'ha introdotta.
const ALLERGENE_ICONA_PRESET = [...ALLERGENE_ICONA_PRESET_UFFICIALI, ...ALLERGENE_ICONA_PRESET_EXTRA];

// Oltre questa soglia i badge allergene in riga si comprimono in un unico "+N" (sotto) — senza
// un tetto, un prodotto con molti allergeni (fino a 14, tutti quelli seminati) farebbe crescere
// la riga a dismisura con `flex-wrap`, rompendo l'altezza uniforme delle card del catalogo.
const MAX_ALLERGENI_INLINE = 3;

type CategoriaGruppo = { categoria: Categoria; items: Prodotto[] };

type FiltroDisponibilita = 'tutti' | 'visibili' | 'nascosti';

// Con molte categorie/prodotti (ispirato a Just Eat/Glovo/Deliveroo, sezione 15), ricerca e
// filtro disponibilità restringono cosa viene mostrato: una categoria senza risultati sparisce
// del tutto invece di comparire vuota — a differenza della vista "di base" (nessun filtro
// attivo), dove tutte le categorie restano visibili anche senza prodotti, per mostrare allo
// staff la struttura del catalogo così come l'ha impostata.
function buildGruppi(
  categorie: Categoria[],
  prodotti: Prodotto[],
  query: string,
  filtro: FiltroDisponibilita
): CategoriaGruppo[] {
  const queryNormalizzata = query.trim().toLowerCase();
  const filtroAttivo = queryNormalizzata.length > 0 || filtro !== 'tutti';

  return categorie
    .map((categoria) => ({
      categoria,
      items: prodotti.filter((p) => {
        if (p.categoria !== categoria.id) return false;
        if (filtro === 'visibili' && !p.disponibile) return false;
        if (filtro === 'nascosti' && p.disponibile) return false;
        if (queryNormalizzata && !p.nome.toLowerCase().includes(queryNormalizzata)) return false;
        return true;
      }),
    }))
    .filter((gruppo) => gruppo.items.length > 0 || !filtroAttivo);
}

// Tiene visibile il chip categoria dentro la sua barra orizzontale, senza toccare lo scroll
// verticale della pagina — bug corretto: `Element.scrollIntoView()` risale TUTTI gli antenati
// scrollabili necessari a portare il target in vista, non solo il più vicino. Chiamarlo sul chip
// (anche con `block: 'nearest'`) subito dopo l'analogo `scrollIntoView` verticale invocato da
// `scrollToCategoria` sulla card sezione annullava quest'ultimo — il browser interrompe uno scroll
// smooth già in corso su un contenitore quando arriva una nuova richiesta di scroll sullo stesso
// contenitore, e la seconda chiamata (chip) risaliva fino al contenitore verticale della pagina
// pur non avendo nulla da correggere lì, azzerandone comunque l'animazione in corso — risultato
// osservato: il tap sul chip non portava più alla sezione. Risolto calcolando ed eseguendo lo
// scroll a mano, solo sul contenitore orizzontale effettivo (risalito manualmente dal DOM),
// senza mai invocare `scrollIntoView` su un nodo condiviso con lo scroller verticale.
function scrollChipIntoView(node: unknown) {
  if (!(node instanceof HTMLElement)) return;
  let scroller: HTMLElement | null = node.parentElement;
  while (scroller && scroller !== document.body) {
    const style = window.getComputedStyle(scroller);
    const isScrollabile = scroller.scrollWidth > scroller.clientWidth + 1;
    if (isScrollabile && (style.overflowX === 'auto' || style.overflowX === 'scroll')) break;
    scroller = scroller.parentElement;
  }
  if (!scroller) return;

  const chipRect = node.getBoundingClientRect();
  const scrollerRect = scroller.getBoundingClientRect();
  const MARGINE = 16;
  if (chipRect.left < scrollerRect.left + MARGINE) {
    scroller.scrollBy({ left: chipRect.left - scrollerRect.left - MARGINE, behavior: 'smooth' });
  } else if (chipRect.right > scrollerRect.right - MARGINE) {
    scroller.scrollBy({ left: chipRect.right - scrollerRect.right + MARGINE, behavior: 'smooth' });
  }
}

type ProdottoRowProps = {
  prodotto: Prodotto;
  isLast: boolean;
  allergeneById: Map<string, Allergene>;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDisponibile: () => void;
};

function ProdottoRow({
  prodotto,
  isLast,
  allergeneById,
  onEdit,
  onDelete,
  onToggleDisponibile,
}: Readonly<ProdottoRowProps>) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const runAction = (action: () => void) => {
    setIsMenuOpen(false);
    action();
  };

  return (
    <HStack
      space="sm"
      className={`items-start px-4 py-3 ${isLast ? '' : 'border-b border-sky-100'}`}
    >
      {prodotto.immagine ? (
        <Image source={{ uri: prodotto.immagine }} className="h-12 w-12 rounded-lg" resizeMode="cover" />
      ) : (
        <Box className="h-12 w-12 items-center justify-center rounded-lg bg-sky-50">
          <Icon as={ImageIcon} size="sm" className="text-sky-300" />
        </Box>
      )}

      <VStack className="flex-1">
        {/* Nome, prezzo e "..." sulla stessa riga — non più ai lati opposti dell'intera card,
            dove finivano centrati sull'intera altezza (descrizione + allergeni inclusi) invece
            che allineati al nome. */}
        <HStack space="xs" className="items-center justify-between">
          <HStack space="xs" className="flex-1 flex-wrap items-center">
            <Text size="sm" className="font-medium text-sky-900">
              {prodotto.nome}
            </Text>
            {!prodotto.disponibile ? (
              <Box className="rounded-full bg-rose-100 px-2 py-0.5">
                <Text size="2xs" className="font-medium text-rose-700">
                  Nascosto
                </Text>
              </Box>
            ) : null}
          </HStack>

          <HStack space="xs" className="items-center">
            <Text size="sm" className="font-semibold text-sky-900">
              {formatPrezzo(prodotto.prezzo)}
            </Text>
            <Pressable
              onPress={() => setIsMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`Azioni per ${prodotto.nome}`}
              className="h-8 w-8 items-center justify-center rounded-full active:bg-sky-100"
            >
              <ActionsheetIcon as={ThreeDotsIcon} className="text-sky-700" />
            </Pressable>
          </HStack>
        </HStack>

        {prodotto.descrizione ? (
          <Text size="xs" className="text-sky-900/60" isTruncated>
            {prodotto.descrizione}
          </Text>
        ) : null}
        {prodotto.allergeni.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="pt-1"
            contentContainerClassName="items-center gap-1"
          >
            {prodotto.allergeni.slice(0, MAX_ALLERGENI_INLINE).map((id) => {
              const allergene = allergeneById.get(id);
              return (
                <Box
                  key={id}
                  className="flex-row items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5"
                >
                  {allergene?.icona ? <Text size="2xs">{allergene.icona}</Text> : null}
                  <Text size="2xs" className="font-medium text-amber-700">
                    {allergene?.nome ?? '—'}
                  </Text>
                </Box>
              );
            })}
            {prodotto.allergeni.length > MAX_ALLERGENI_INLINE ? (
              <Pressable
                onPress={() => {
                  const elenco = prodotto.allergeni
                    .map((id) => allergeneById.get(id)?.nome ?? '—')
                    .join(', ');
                  if (Platform.OS === 'web') {
                    window.alert(`Allergeni di "${prodotto.nome}":\n${elenco}`);
                  } else {
                    Alert.alert(`Allergeni di "${prodotto.nome}"`, elenco);
                  }
                }}
                accessibilityLabel={`Mostra tutti gli allergeni di ${prodotto.nome}`}
                className="rounded-full bg-amber-100 px-2 py-0.5 active:bg-amber-200"
              >
                <Text size="2xs" className="font-medium text-amber-800">
                  +{prodotto.allergeni.length - MAX_ALLERGENI_INLINE}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </VStack>

      <Actionsheet isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label={`Azioni per ${prodotto.nome}`}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack space="xs" className="w-full pb-4 pt-1">
            <Heading size="sm" className="px-1 pb-2">
              {prodotto.nome}
            </Heading>

            <ActionsheetItem onPress={() => runAction(onEdit)}>
              <ActionsheetIcon as={EditIcon} className="text-sky-700" />
              <ActionsheetItemText>Modifica</ActionsheetItemText>
            </ActionsheetItem>

            <ActionsheetItem onPress={() => runAction(onToggleDisponibile)}>
              <ActionsheetIcon as={prodotto.disponibile ? EyeOffIcon : EyeIcon} className="text-amber-700" />
              <ActionsheetItemText className="text-amber-700">
                {prodotto.disponibile ? 'Nascondi dal menu' : 'Mostra nel menu'}
              </ActionsheetItemText>
            </ActionsheetItem>

            <ActionsheetItem onPress={() => runAction(onDelete)}>
              <ActionsheetIcon as={TrashIcon} className="text-destructive" />
              <ActionsheetItemText className="text-destructive">Elimina</ActionsheetItemText>
            </ActionsheetItem>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </HStack>
  );
}

type CategoriaCardProps = {
  gruppo: CategoriaGruppo;
  cardRef: (node: unknown) => void;
  allergeneById: Map<string, Allergene>;
  onAddProdotto: () => void;
  onEditProdotto: (item: Prodotto) => void;
  onDeleteProdotto: (item: Prodotto) => void;
  onToggleDisponibile: (item: Prodotto) => void;
};

// Niente più espandi/comprimi: con molte categorie il vero bisogno è saltarci direttamente
// (barra di navigazione rapida, sotto), non nasconderle una a una — stesso principio "tutto
// sempre visibile, la navigazione è a un tap" delle app di food delivery prese a modello.
function CategoriaCard({
  gruppo,
  cardRef,
  allergeneById,
  onAddProdotto,
  onEditProdotto,
  onDeleteProdotto,
  onToggleDisponibile,
}: Readonly<CategoriaCardProps>) {
  // Box, non VStack: il suo ref arriva diretto al nodo DOM reale su web (index.web.tsx è un
  // semplice <div ref={ref}>), a differenza di VStack/View dove il wrapper NativeWind non
  // garantisce lo stesso — necessario perché scrollToCategoria (sopra) chiama .scrollIntoView
  // sul nodo catturato da questo ref.
  return (
    <Box ref={cardRef} className="flex-col overflow-hidden rounded-2xl border border-sky-200 bg-white">
      <HStack space="sm" className="items-center px-4 py-3">
        <Heading size="sm" className="text-sky-900">
          {gruppo.categoria.nome}
        </Heading>
        <Box className="rounded-full bg-sky-100 px-2 py-0.5">
          <Text size="2xs" className="font-medium text-sky-700">
            {gruppo.items.length}
          </Text>
        </Box>
      </HStack>

      <VStack className="border-t border-sky-100">
        {gruppo.items.length === 0 ? (
          <Text size="xs" className="px-4 py-3 text-muted-foreground">
            Nessun prodotto in questa categoria ancora.
          </Text>
        ) : (
          gruppo.items.map((item, index) => (
            <ProdottoRow
              key={item.id}
              prodotto={item}
              isLast={index === gruppo.items.length - 1}
              allergeneById={allergeneById}
              onEdit={() => onEditProdotto(item)}
              onDelete={() => onDeleteProdotto(item)}
              onToggleDisponibile={() => onToggleDisponibile(item)}
            />
          ))
        )}
        <Pressable
          onPress={onAddProdotto}
          className="flex-row items-center gap-1.5 border-t border-sky-100 px-4 py-2.5 active:bg-sky-50"
        >
          <Icon as={AddIcon} size="xs" className="text-sky-600" />
          <Text size="xs" className="font-medium text-sky-600">
            Aggiungi prodotto in "{gruppo.categoria.nome}"
          </Text>
        </Pressable>
      </VStack>
    </Box>
  );
}

export function MenuAsportoSection() {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [isLoadingCategorie, setIsLoadingCategorie] = useState(true);
  const [allergeni, setAllergeni] = useState<Allergene[]>([]);
  const [isLoadingAllergeni, setIsLoadingAllergeni] = useState(true);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [isLoadingProdotti, setIsLoadingProdotti] = useState(true);
  const [prodottiError, setProdottiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtroDisponibilita, setFiltroDisponibilita] = useState<FiltroDisponibilita>('tutti');

  const [isManageOpen, setIsManageOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
  const [editingItem, setEditingItem] = useState<Prodotto | null>(null);
  // Immagine scelta in questa sessione del form, non ancora caricata (l'upload richiede l'id del
  // prodotto: parte solo dopo che create/update del testo è andato a buon fine, sotto).
  const [pendingImage, setPendingImage] = useState<ImmagineProdottoFile | null>(null);
  const [pendingImagePreviewUri, setPendingImagePreviewUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    listCategorie()
      .then(setCategorie)
      .catch(() => {})
      .finally(() => setIsLoadingCategorie(false));
    listAllergeni()
      .then(setAllergeni)
      .catch(() => {})
      .finally(() => setIsLoadingAllergeni(false));
    listProdotti()
      .then(setProdotti)
      .catch(() => setProdottiError('Impossibile caricare il menu asporto.'))
      .finally(() => setIsLoadingProdotti(false));
  }, []);

  const handleCreateCategoria = async (nome: string) => {
    const created = await createCategoria({ nome });
    setCategorie((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const handleDeleteCategoria = async (item: Categoria) => {
    await deleteCategoria(item.id);
    setCategorie((prev) => prev.filter((c) => c.id !== item.id));
  };

  const handleCreateAllergene = async (nome: string, icona?: string) => {
    const created = await createAllergene({ nome, icona: icona ?? '' });
    setAllergeni((prev) => [...prev, created].sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const handleDeleteAllergene = async (item: Allergene) => {
    await deleteAllergene(item.id);
    setAllergeni((prev) => prev.filter((a) => a.id !== item.id));
    // Un prodotto che aveva questo allergene resta collegato lato client finché non viene
    // ricaricato: rimuoviamo l'id anche dagli elenchi già in memoria, per non mostrare un
    // badge "—" (allergene non più trovato) senza motivo apparente.
    setProdotti((prev) =>
      prev.map((p) => ({ ...p, allergeni: p.allergeni.filter((id) => id !== item.id) }))
    );
  };

  const allergeneById = new Map(allergeni.map((a) => [a.id, a]));

  const setField = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleAllergene = (id: string) => {
    setForm((prev) => ({
      ...prev,
      allergeneIds: prev.allergeneIds.includes(id)
        ? prev.allergeneIds.filter((current) => current !== id)
        : [...prev.allergeneIds, id],
    }));
  };

  // Nodo DOM reale di ciascuna card categoria, catturato via ref (non `nativeID`: su web,
  // attraverso il wrapper NativeWind di VStack, `nativeID` non arriva a diventare un attributo
  // `id` nel DOM — stesso genere di gotcha "prop RN che NativeWind non traduce su web" già
  // documentato altrove nel progetto, es. `numberOfLines`, sezione 5). Un ref diretto sul nodo è
  // affidabile a prescindere da questo.
  const categoriaNodeById = useRef<Map<string, unknown>>(new Map());

  const registerCategoriaRef = (categoriaId: string) => (node: unknown) => {
    if (node) {
      categoriaNodeById.current.set(categoriaId, node);
    } else {
      categoriaNodeById.current.delete(categoriaId);
    }
  };

  // Evidenziazione della barra di navigazione rapida in base allo scroll — stesso identico
  // pattern già introdotto lato cliente (app/cliente/asporto/index.tsx, sezione 15): un
  // IntersectionObserver osserva le card categoria e tiene evidenziata quella più in alto tra
  // quelle visibili nella fascia sotto la barra sticky. `suppressObserverUntilRef` fa vincere il
  // tap sul chip per la durata dello scroll animato, altrimenti l'observer "litiga" con la scelta
  // appena fatta mentre le sezioni intermedie attraversano la fascia osservata (stesso bug di
  // sfarfallio già scoperto e risolto lato cliente).
  const [activeCategoriaId, setActiveCategoriaId] = useState<string | null>(null);
  const suppressObserverUntilRef = useRef(0);

  // Solo web: sposta lo scroll della pagina fino alla card della categoria scelta dalla barra di
  // navigazione rapida sotto. Su nativo il nodo catturato dal ref non espone `scrollIntoView` —
  // il tap resta un no-op silenzioso lì, coerente con la fase attuale del progetto (solo web,
  // sezione 8).
  const scrollToCategoria = (categoriaId: string) => {
    setActiveCategoriaId(categoriaId);
    if (Platform.OS !== 'web') return;
    suppressObserverUntilRef.current = Date.now() + 700;
    const node = categoriaNodeById.current.get(categoriaId) as { scrollIntoView?: (opts: unknown) => void } | undefined;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const resetImagePickerState = () => {
    setPendingImage(null);
    setPendingImagePreviewUri(null);
    setImageError(null);
  };

  const openCreateForm = (prefilledCategoriaId?: string) => {
    setEditingItem(null);
    setForm({ ...INITIAL_FORM_STATE, categoriaId: prefilledCategoriaId ?? '' });
    setError(null);
    resetImagePickerState();
    setIsFormOpen(true);
  };

  const openEditForm = (item: Prodotto) => {
    setEditingItem(item);
    setForm(formStateFromItem(item));
    setError(null);
    resetImagePickerState();
    setIsFormOpen(true);
  };

  const handlePickImage = async (source: 'camera' | 'library') => {
    setImageError(null);
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setImageError(source === 'camera' ? 'Permesso fotocamera negato.' : 'Permesso galleria negato.');
        return;
      }
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (result.canceled || result.assets.length === 0) return;
      const asset = result.assets[0];
      setPendingImage({
        uri: asset.uri,
        name: asset.fileName ?? `foto-${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      setPendingImagePreviewUri(asset.uri);
    } catch {
      setImageError(
        source === 'camera' ? 'Fotocamera non disponibile su questo dispositivo.' : 'Impossibile aprire la galleria.'
      );
    }
  };

  const upsertProdotto = (saved: Prodotto) => {
    setProdotti((prev) => {
      const esiste = prev.some((item) => item.id === saved.id);
      return esiste ? prev.map((item) => (item.id === saved.id ? saved : item)) : [...prev, saved];
    });
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      setError('Il nome è obbligatorio.');
      return;
    }
    if (!form.categoriaId) {
      setError('Seleziona una categoria.');
      return;
    }
    const prezzoNumerico = Number.parseFloat(form.prezzo.replace(',', '.'));
    if (!Number.isFinite(prezzoNumerico) || prezzoNumerico < 0) {
      setError('Inserisci un prezzo valido.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const payload = payloadFromFormState(form);
      let saved = editingItem
        ? await updateProdotto(editingItem.id, payload)
        : await createProdotto(payload);

      if (pendingImage) {
        try {
          saved = await uploadProdottoImmagine(saved.id, pendingImage);
        } catch (imgErr) {
          // Il prodotto è comunque salvato: lo registriamo e passiamo in modalità modifica, così
          // un nuovo tentativo carica solo la foto invece di creare un secondo prodotto duplicato.
          upsertProdotto(saved);
          setEditingItem(saved);
          setError(extractErrorMessage(imgErr, 'Prodotto salvato, ma il caricamento della foto è fallito. Riprova.'));
          return;
        }
      }

      upsertProdotto(saved);
      setIsFormOpen(false);
      setEditingItem(null);
      setForm(INITIAL_FORM_STATE);
      resetImagePickerState();
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare il prodotto. Controlla i dati inseriti.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDisponibile = async (item: Prodotto) => {
    try {
      const payload: CreateProdottoPayload = {
        nome: item.nome,
        descrizione: item.descrizione,
        categoria: item.categoria,
        allergeni: item.allergeni,
        prezzo: item.prezzo,
        disponibile: !item.disponibile,
      };
      const updated = await updateProdotto(item.id, payload);
      setProdotti((prev) => prev.map((current) => (current.id === updated.id ? updated : current)));
    } catch (err) {
      const message = extractErrorMessage(err, 'Impossibile aggiornare la disponibilità del prodotto.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Impossibile aggiornare', message);
      }
    }
  };

  const confirmDelete = async (item: Prodotto) => {
    try {
      await deleteProdotto(item.id);
      setProdotti((prev) => prev.filter((current) => current.id !== item.id));
    } catch (err) {
      const message = extractErrorMessage(err, 'Impossibile eliminare il prodotto.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Impossibile eliminare', message);
      }
    }
  };

  const handleDelete = (item: Prodotto) => {
    const message = `"${item.nome}" verrà eliminato definitivamente.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDelete(item);
      }
      return;
    }
    Alert.alert('Eliminare prodotto?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => confirmDelete(item) },
    ]);
  };

  const isLoadingCatalogo = isLoadingCategorie || isLoadingProdotti;
  const gruppi = useMemo(
    () => buildGruppi(categorie, prodotti, searchQuery, filtroDisponibilita),
    [categorie, prodotti, searchQuery, filtroDisponibilita]
  );
  const filtroAttivo = searchQuery.trim().length > 0 || filtroDisponibilita !== 'tutti';
  const categoriaSelezionata = categorie.find((c) => c.id === form.categoriaId);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined' || gruppi.length === 0) return;

    const nodeToId = new Map<Element, string>();
    gruppi.forEach((gruppo) => {
      const node = categoriaNodeById.current.get(gruppo.categoria.id);
      if (node instanceof Element) nodeToId.set(node, gruppo.categoria.id);
    });
    if (nodeToId.size === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < suppressObserverUntilRef.current) return;
        const visibili = entries.filter((e) => e.isIntersecting);
        if (visibili.length === 0) return;
        const piuAlta = visibili.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b));
        const id = nodeToId.get(piuAlta.target);
        if (id) setActiveCategoriaId(id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: [0, 1] }
    );
    nodeToId.forEach((_id, node) => observer.observe(node));

    setActiveCategoriaId((prev) => prev ?? gruppi[0].categoria.id);

    return () => observer.disconnect();
  }, [gruppi]);

  // Il chip della categoria attiva deve restare sempre visibile dentro la barra di navigazione
  // orizzontale — stesso identico fix già introdotto lato cliente (app/cliente/asporto/index.tsx,
  // sezione 15): con molte categorie i chip traboccano lateralmente, e senza questo effetto lo
  // scroll-spy poteva evidenziare un chip fuori dalla porzione visibile della barra. Un effetto
  // separato da `scrollToCategoria` copre entrambe le sorgenti del cambiamento (tap e scroll-spy).
  const chipNodeById = useRef<Map<string, unknown>>(new Map());
  const registerChipRef = (categoriaId: string) => (node: unknown) => {
    if (node) chipNodeById.current.set(categoriaId, node);
    else chipNodeById.current.delete(categoriaId);
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || !activeCategoriaId) return;
    scrollChipIntoView(chipNodeById.current.get(activeCategoriaId));
  }, [activeCategoriaId]);

  return (
    <VStack space="md" className="w-full">
      <HStack className="items-center justify-between">
        {!isLoadingCatalogo && categorie.length > 0 ? (
          <Button size="sm" onPress={() => openCreateForm()}>
            <ButtonIcon as={AddIcon} className="text-white" />
            <ButtonText>Nuovo prodotto</ButtonText>
          </Button>
        ) : (
          <Box />
        )}
        <Pressable
          onPress={() => setIsManageOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Gestisci categorie e allergeni"
          className="h-9 w-9 items-center justify-center rounded-full border-2 border-sky-300 bg-white shadow-sm active:bg-sky-50"
        >
          <Icon as={SettingsIcon} size="sm" className="text-sky-700" />
        </Pressable>
      </HStack>

      {isLoadingCatalogo ? (
        <HStack space="sm" className="items-center py-4">
          <Spinner size="small" />
          <Text size="sm" className="text-muted-foreground">
            Caricamento menu...
          </Text>
        </HStack>
      ) : null}

      {prodottiError ? (
        <Text size="sm" className="text-destructive">
          {prodottiError}
        </Text>
      ) : null}

      {!isLoadingCatalogo && categorie.length === 0 ? (
        <VStack
          space="sm"
          className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
        >
          <Text size="lg">🥡</Text>
          <Text size="sm" className="text-center text-muted-foreground">
            Nessuna categoria creata ancora.{'\n'}Crea la prima categoria per iniziare a costruire il menu asporto.
          </Text>
          <Button size="sm" onPress={() => setIsManageOpen(true)}>
            <ButtonText>+ Crea la prima categoria</ButtonText>
          </Button>
        </VStack>
      ) : null}

      {!isLoadingCatalogo && categorie.length > 0 ? (
        <VStack space="sm">
          <VStack space="sm">
            <Input>
              <InputSlot className="pl-3">
                <InputIcon as={SearchIcon} className="text-sky-400" />
              </InputSlot>
              <InputField
                placeholder="Cerca prodotto per nome..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <InputSlot className="pr-3">
                  <Pressable onPress={() => setSearchQuery('')} accessibilityLabel="Cancella ricerca">
                    <InputIcon as={CloseIcon} className="text-sky-400" />
                  </Pressable>
                </InputSlot>
              ) : null}
            </Input>

            <HStack space="xs">
              {(
                [
                  { valore: 'tutti', label: 'Tutti' },
                  { valore: 'visibili', label: 'Visibili' },
                  { valore: 'nascosti', label: 'Nascosti' },
                ] as const
              ).map((opzione) => {
                const selezionato = filtroDisponibilita === opzione.valore;
                return (
                  <Pressable
                    key={opzione.valore}
                    onPress={() => setFiltroDisponibilita(opzione.valore)}
                    className={`rounded-full border px-3 py-1.5 ${
                      selezionato ? 'border-sky-500 bg-sky-100' : 'border-sky-200 bg-white'
                    }`}
                  >
                    <Text size="xs" className={selezionato ? 'font-semibold text-sky-800' : 'text-sky-900/70'}>
                      {opzione.label}
                    </Text>
                  </Pressable>
                );
              })}
            </HStack>
          </VStack>

          {/* Barra di navigazione rapida (ispirata a Just Eat/Glovo/Deliveroo, sezione 15):
              con molte categorie saltare direttamente a quella cercata batte scorrere tutta la
              pagina. Sticky solo su web (`web:sticky`, coerente con la fase attuale del progetto). */}
          {gruppi.length > 1 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="web:sticky web:top-0 z-10 -mx-4 bg-background px-4 py-1 md:-mx-8 md:px-8"
              contentContainerClassName="gap-2"
            >
              {gruppi.map((gruppo) => {
                const isActive = gruppo.categoria.id === activeCategoriaId;
                return (
                  <Box key={gruppo.categoria.id} ref={registerChipRef(gruppo.categoria.id)}>
                    <Pressable
                      onPress={() => scrollToCategoria(gruppo.categoria.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Vai alla categoria ${gruppo.categoria.nome}`}
                      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
                        isActive ? 'border-sky-600 bg-sky-600 shadow-sm' : 'border-sky-300 bg-white active:bg-sky-50'
                      }`}
                    >
                      <Text size="xs" className={`font-medium ${isActive ? 'text-white' : 'text-sky-900'}`}>
                        {gruppo.categoria.nome}
                      </Text>
                      <Box className={`rounded-full px-1.5 py-0.5 ${isActive ? 'bg-white/25' : 'bg-sky-100'}`}>
                        <Text size="2xs" className={`font-medium ${isActive ? 'text-white' : 'text-sky-700'}`}>
                          {gruppo.items.length}
                        </Text>
                      </Box>
                    </Pressable>
                  </Box>
                );
              })}
            </ScrollView>
          ) : null}

          {gruppi.length === 0 ? (
            <Text size="sm" className="px-1 py-6 text-center text-muted-foreground">
              {filtroAttivo
                ? `Nessun prodotto trovato${searchQuery.trim() ? ` per «${searchQuery.trim()}»` : ''}.`
                : 'Nessun prodotto nel menu ancora.'}
            </Text>
          ) : (
            <VStack space="sm">
              {gruppi.map((gruppo) => (
                <CategoriaCard
                  key={gruppo.categoria.id}
                  gruppo={gruppo}
                  cardRef={registerCategoriaRef(gruppo.categoria.id)}
                  allergeneById={allergeneById}
                  onAddProdotto={() => openCreateForm(gruppo.categoria.id)}
                  onEditProdotto={openEditForm}
                  onDeleteProdotto={handleDelete}
                  onToggleDisponibile={handleToggleDisponibile}
                />
              ))}
            </VStack>
          )}
        </VStack>
      ) : null}

      {/* Foglio "Gestisci categorie e allergeni": setup occasionale, tenuto fuori dal
          flusso principale (aggiungere/modificare prodotti) per non affollarlo. */}
      <Actionsheet isOpen={isManageOpen} onClose={() => setIsManageOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label="Gestisci categorie e allergeni" className="max-h-[85vh]">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetScrollView className="w-full">
            <VStack space="lg" className="w-full pb-6">
              <VStack>
                <Heading size="md">Categorie e Allergeni</Heading>
                <Text size="xs" className="text-muted-foreground">
                  Ogni prodotto va assegnato a una categoria; gli allergeni sono opzionali.
                </Text>
              </VStack>

              <CatalogListEditor
                label="Categorie"
                placeholder="Es. Pizze"
                emptyText="Nessuna categoria creata ancora."
                items={categorie}
                isLoading={isLoadingCategorie}
                onCreate={handleCreateCategoria}
                onDelete={handleDeleteCategoria}
                deleteConfirmMessage={(item) =>
                  `"${item.nome}" verrà eliminata. Non è possibile eliminare una categoria che ha ancora prodotti collegati.`
                }
              />

              <CatalogListEditor
                label="Allergeni"
                placeholder="Es. Coloranti"
                emptyText="Nessun allergene creato ancora."
                items={allergeni}
                isLoading={isLoadingAllergeni}
                iconOptions={ALLERGENE_ICONA_PRESET}
                onCreate={handleCreateAllergene}
                onDelete={handleDeleteAllergene}
                deleteConfirmMessage={(item) =>
                  `"${item.nome}" verrà eliminato e scollegato da tutti i prodotti che lo avevano assegnato.`
                }
              />

              <Button variant="outline" className="border-sky-300" onPress={() => setIsManageOpen(false)}>
                <ButtonText>Chiudi</ButtonText>
              </Button>
            </VStack>
          </ActionsheetScrollView>
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
              <Heading size="md">{editingItem ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</Heading>

              <VStack space="sm" className="items-center">
                <Box className="h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-sky-200 bg-sky-50">
                  {pendingImagePreviewUri || editingItem?.immagine ? (
                    <Image
                      source={{ uri: pendingImagePreviewUri ?? editingItem?.immagine ?? undefined }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Icon as={ImageIcon} size="xl" className="text-sky-300" />
                  )}
                </Box>
                <HStack space="sm">
                  <Button size="sm" variant="outline" className="border-sky-300" onPress={() => handlePickImage('camera')}>
                    <ButtonText>📷 Scatta foto</ButtonText>
                  </Button>
                  <Button size="sm" variant="outline" className="border-sky-300" onPress={() => handlePickImage('library')}>
                    <ButtonText>🖼️ Galleria</ButtonText>
                  </Button>
                </HStack>
                {imageError ? (
                  <Text size="xs" className="text-destructive">
                    {imageError}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Nome
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. Pizza Margherita"
                    value={form.nome}
                    onChangeText={setField('nome')}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Categoria
                </Text>
                <HStack space="xs" className="flex-wrap">
                  {categorie.map((cat) => {
                    const selezionata = cat.id === form.categoriaId;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => setField('categoriaId')(cat.id)}
                        className={`rounded-full border px-3 py-1.5 ${
                          selezionata ? 'border-sky-500 bg-sky-100' : 'border-sky-200 bg-white'
                        }`}
                      >
                        <Text
                          size="xs"
                          className={selezionata ? 'font-semibold text-sky-800' : 'text-sky-900/70'}
                        >
                          {cat.nome}
                        </Text>
                      </Pressable>
                    );
                  })}
                </HStack>
                {!categoriaSelezionata ? (
                  <Text size="xs" className="text-muted-foreground">
                    Seleziona una categoria tra quelle create.
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Descrizione (opzionale)
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. Pomodoro, mozzarella, basilico"
                    value={form.descrizione}
                    onChangeText={setField('descrizione')}
                  />
                </Input>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Allergeni (opzionale)
                </Text>
                {allergeni.length === 0 ? (
                  <Text size="xs" className="text-muted-foreground">
                    Nessun allergene creato ancora — puoi aggiungerne uno dal pulsante ⚙️ in alto.
                  </Text>
                ) : (
                  <HStack space="xs" className="flex-wrap">
                    {allergeni.map((allergene) => {
                      const selezionato = form.allergeneIds.includes(allergene.id);
                      return (
                        <Pressable
                          key={allergene.id}
                          onPress={() => toggleAllergene(allergene.id)}
                          className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
                            selezionato ? 'border-amber-400 bg-amber-100' : 'border-sky-200 bg-white'
                          }`}
                        >
                          {allergene.icona ? <Text size="xs">{allergene.icona}</Text> : null}
                          <Text
                            size="xs"
                            className={selezionato ? 'font-semibold text-amber-800' : 'text-sky-900/70'}
                          >
                            {allergene.nome}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </HStack>
                )}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Prezzo (€)
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. 6.50"
                    keyboardType="decimal-pad"
                    value={form.prezzo}
                    onChangeText={setField('prezzo')}
                  />
                </Input>
              </VStack>

              <HStack className="items-center justify-between">
                <Text size="sm" className="font-medium">
                  Visibile nel menu
                </Text>
                <Switch value={form.disponibile} onValueChange={setField('disponibile')} />
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
                  <ButtonText>{editingItem ? 'Salva modifiche' : 'Crea prodotto'}</ButtonText>
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
