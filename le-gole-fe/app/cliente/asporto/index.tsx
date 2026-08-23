import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AddIcon, ClockIcon, Icon, LockIcon, PhoneIcon, RemoveIcon } from '@/components/ui/icon';
// Caricato dinamicamente per non farlo entrare nel bundle valutato su ogni pagina, stesso
// principio già usato dal flusso self-service piscina (sezione 14 di CLAUDE.md).
const TimePickerModal = lazy(() =>
  import('react-native-paper-dates').then((m) => ({ default: m.TimePickerModal }))
);
import { createVoceOrdine, type Prodotto } from '../../../src/services/menu';
import { createPrenotazioneAsporto, getRicevutaUrl } from '../../../src/services/prenotazioni';
import { createCliente } from '../../../src/services/clienti';
import { ClienteFooter } from '../../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../../src/components/cliente/BackButton';
import { ConfermaOrdineAsporto, type RigaRiepilogoOrdineAsporto } from '../../../src/components/cliente/ConfermaOrdineAsporto';
import { apriBigliettoPdf } from '../../../src/utils/biglietto';
import { useCarrelloAsporto } from '../../../src/context/CarrelloAsportoContext';
import {
  addDays,
  computeDefaultOrario,
  formatDateDDMMYYYY,
  minutesToHHMM,
  nowHHMM,
  parseHHMMToMinutes,
  parseISODate,
  toISODate,
} from '../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../src/utils/prezzi';

// Nome esatto della categoria seminata lato backend (migrazione 0008, idempotente — sempre
// presente dopo il primo deploy, anche se lo staff non l'ha mai toccata). Un ordine con più di
// questa quantità di pizze richiede più margine di preparazione in cucina, quindi un anticipo
// minimo maggiore rispetto a un ordine normale.
const PIZZA_CATEGORIA_NOME = 'Pizze';
const SOGLIA_PIZZE_ANTICIPO_ESTESO = 10;
const ANTICIPO_MINUTI_STANDARD = 15;
const ANTICIPO_MINUTI_ESTESO = 30;

type FormState = {
  nome: string;
  telefono: string;
  note: string;
  orario: string;
};

type RiepilogoOrdine = {
  righe: RigaRiepilogoOrdineAsporto[];
  totale: number;
  orario: string;
  nome: string;
  prenotazioneId: string;
};

// Tiene visibile il chip categoria dentro la sua barra orizzontale, senza toccare lo scroll
// verticale della pagina — bug corretto: `Element.scrollIntoView()` risale TUTTI gli antenati
// scrollabili necessari a portare il target in vista, non solo il più vicino. Chiamarlo sul chip
// (anche con `block: 'nearest'`) subito dopo l'analogo `scrollIntoView` verticale invocato da
// `scrollToCategoria` sulla card sezione annullava quest'ultimo — il browser interrompe uno scroll
// smooth già in corso su un contenitore quando arriva una nuova richiesta di scroll sullo stesso
// contenitore, e la seconda chiamata (chip) risaliva fino al contenitore verticale della pagina
// pur non avendo nulla da correggere lì, azzerandone comunque l'animazione in corso — risultato
// osservato: il tap sul chip non portava più alla sezione. Risolto calcolando ed eseguendo lo
// scroll a mano, solo sul contenitore orizzontale effettivo (risalito manualmente dal DOM), senza
// mai invocare `scrollIntoView` su un nodo condiviso con lo scroller verticale. Stessa identica
// funzione duplicata lato staff (MenuAsportoSection.tsx, sezione 15) — nessuna astrazione
// condivisa introdotta, stesso principio "copia diretta" già seguito per il resto dello
// scroll-spy tra le due pagine.
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

function extractErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: unknown } })?.response?.data;
  if (detail && typeof detail === 'object') {
    const message = Object.values(detail as Record<string, unknown>).flat().join(' ');
    if (message) return message;
  }
  return fallback;
}

// L'asporto non ha un concetto di "giorno di ritiro" scelto dal cliente (sempre oggi, stesso
// principio di un ordine da asporto reale) — solo l'orario va validato contro
// ConfigurazioneAsporto, stesso schema del `validateOrario` piscina ma senza il controllo data.
// `anticipoMinimoMinuti` sostituisce il precedente controllo "non nel passato": un semplice "non
// prima di adesso" non basta più, un ordine con molte pizze ha bisogno di più margine di
// preparazione (vedi ANTICIPO_MINUTI_ESTESO sopra) — validato solo lato client per ora, stesso
// gap già accettato per l'orario apertura/chiusura (CLAUDE.md, sezione 15).
function validateOrarioRitiro(
  value: string,
  configurazione: { orario_apertura: string; orario_chiusura: string },
  anticipoMinimoMinuti: number
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "L'orario di ritiro è obbligatorio.";
  const minuti = parseHHMMToMinutes(trimmed);
  if (minuti === null) return 'Inserisci un orario valido (HH:MM).';

  const apertura = configurazione.orario_apertura.slice(0, 5);
  const chiusura = configurazione.orario_chiusura.slice(0, 5);
  if (minuti < parseHHMMToMinutes(apertura)! || minuti > parseHHMMToMinutes(chiusura)!) {
    return `Il servizio asporto è attivo dalle ${apertura} alle ${chiusura}.`;
  }
  if (minuti < parseHHMMToMinutes(nowHHMM())! + anticipoMinimoMinuti) {
    return `Con questo ordine serve un anticipo di almeno ${anticipoMinimoMinuti} minuti rispetto all'ora attuale.`;
  }
  return null;
}

type BloccoChiusura = { inizio: string; fine: string; includeOggi: boolean };

// Trova il blocco di giorni di chiusura consecutivi rilevante per il cliente: se oggi stesso è
// chiuso, il blocco parte da oggi (scenario bloccante, sotto); altrimenti si guarda solo se il
// giorno dopo è chiuso (avviso non bloccante), come richiesto esplicitamente — non un'intera
// finestra di chiusure lontane nel tempo che oggi non riguardano ancora. `chiusureFuture` è già
// ordinato crescente e contiene solo date >= oggi (garantito dal backend, GET .../prossime/).
function trovaBloccoChiusura(chiusureFuture: string[], oggi: Date): BloccoChiusura | null {
  const chiusureSet = new Set(chiusureFuture);
  const oggiIso = toISODate(oggi);
  const domaniIso = toISODate(addDays(oggi, 1));
  const partenza = chiusureSet.has(oggiIso) ? oggiIso : domaniIso;
  if (!chiusureSet.has(partenza)) return null;

  let fine = partenza;
  // Limite di sicurezza: un anno di chiusure consecutive è già ben oltre qualunque scenario reale.
  for (let i = 0; i < 366; i++) {
    const successivo = toISODate(addDays(parseISODate(fine), 1));
    if (!chiusureSet.has(successivo)) break;
    fine = successivo;
  }
  return { inizio: partenza, fine, includeOggi: partenza === oggiIso };
}

// Riga prodotto in stile Deliveroo: testo (nome, descrizione troncata a una riga, prezzo) a
// sinistra, thumbnail a destra con un badge quantità in overlay se già nel carrello. Nessun
// allergene qui — vive solo nella pagina di dettaglio, sotto. L'intera riga è cliccabile e apre
// il dettaglio: nessuno stepper +/- in linea, l'aggiunta al carrello avviene solo da lì.
function ProdottoRigaCliccabile({
  prodotto,
  quantita,
  setQuantita,
  isLast,
}: Readonly<{
  prodotto: Prodotto;
  quantita: number;
  setQuantita: (prodottoId: string, next: number) => void;
  isLast: boolean;
}>) {
  return (
    <Box className="relative z-0">
      <Pressable
        onPress={() => router.push(`/cliente/asporto/${prodotto.id}` as Href)}
        accessibilityRole="button"
        accessibilityLabel={`Vedi dettaglio ${prodotto.nome}`}
        className={`flex-row items-center gap-3 px-4 py-3 active:bg-sky-50 ${isLast ? '' : 'border-b border-sky-100'}`}
      >
        <VStack className="flex-1">
          <Text size="sm" className="font-semibold text-sky-900">
            {prodotto.nome}
          </Text>
          {prodotto.descrizione ? (
            <Text size="xs" className="mt-0.5 text-sky-900/60" isTruncated>
              {prodotto.descrizione}
            </Text>
          ) : null}
          <Text size="sm" className="mt-1.5 font-bold text-sky-900">
            €{formatPrezzo(prodotto.prezzo)}
          </Text>
        </VStack>

        {/* Nessun segnaposto se il prodotto non ha una foto — a differenza della pagina di
            dettaglio (che lo mostra sempre, sezione 15), qui in lista un riquadro grigio vuoto
            per ogni prodotto senza immagine sarebbe solo rumore ripetuto riga dopo riga; la riga
            si stringe semplicemente al solo blocco testo, il pulsante "+"/stepper resta comunque
            in overlay in basso a destra della riga (posizionato rispetto al `Box` esterno, non
            all'immagine — nessun ricalcolo necessario). */}
        {prodotto.immagine ? (
          <Image source={{ uri: prodotto.immagine }} className="h-20 w-20 rounded-xl" resizeMode="cover" />
        ) : null}
      </Pressable>

      {/* Quick-add: "+" isolato quando il prodotto non è nel carrello, sostituito da uno stepper
          "－ N ＋" appena aggiunto — SORELLA del Pressable che apre il dettaglio, non annidata al
          suo interno: su web `Pressable` con `accessibilityRole="button"` renderizza un vero
          `<button>` HTML, e un `<button>` dentro un altro `<button>` non è HTML valido (React
          segnala un warning di idratazione) — posizionata invece in overlay sull'angolo
          dell'immagine tramite `absolute` sullo stesso Box `relative` che contiene entrambe, con
          `bottom-1 right-2` calcolato per coincidere esattamente con l'angolo dell'immagine
          (padding riga `px-4 py-3` meno l'aggetto `-bottom-2 -right-2` del pulsante). Ogni
          pulsante ferma comunque la propagazione al click, per non far scattare la navigazione
          al dettaglio se in futuro tornasse annidato in qualche variante. */}
      <Box className="absolute bottom-1 right-2">
        {quantita === 0 ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              setQuantita(prodotto.id, 1);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Aggiungi ${prodotto.nome} al carrello`}
            className="h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-sky-600 shadow-sm active:bg-sky-700"
          >
            <Icon as={AddIcon} size="sm" className="text-white" />
          </Pressable>
        ) : (
          <HStack
            space="xs"
            className="items-center rounded-full border-2 border-white bg-sky-600 px-1 py-1 shadow-sm"
          >
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                setQuantita(prodotto.id, quantita - 1);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Diminuisci ${prodotto.nome}`}
              className="h-7 w-7 items-center justify-center rounded-full active:bg-sky-700"
            >
              <Icon as={RemoveIcon} size="xs" className="text-white" />
            </Pressable>
            <Text size="xs" className="min-w-3.5 text-center font-bold text-white">
              {quantita}
            </Text>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                setQuantita(prodotto.id, quantita + 1);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Aumenta ${prodotto.nome}`}
              className="h-7 w-7 items-center justify-center rounded-full active:bg-sky-700"
            >
              <Icon as={AddIcon} size="xs" className="text-white" />
            </Pressable>
          </HStack>
        )}
      </Box>
    </Box>
  );
}

export default function ClienteAsportoScreen() {
  const {
    categorie,
    prodottiDisponibili,
    configurazione,
    chiusureFuture,
    isLoading,
    loadError,
    quantities,
    setQuantita,
    cartLines,
    totaleArticoli,
    totalePrezzo,
    svuotaCarrello,
  } = useCarrelloAsporto();

  const [form, setForm] = useState<FormState>({ nome: '', telefono: '', note: '', orario: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [ordineInviato, setOrdineInviato] = useState(false);
  const [riepilogo, setRiepilogo] = useState<RiepilogoOrdine | null>(null);
  const [isDownloadingRicevuta, setIsDownloadingRicevuta] = useState(false);

  const setField = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // L'orario di default dipende da `configurazione`, disponibile solo dopo il caricamento del
  // context — precompilato non appena arriva, non al mount (che qui non ha più i dati).
  useEffect(() => {
    if (!configurazione || form.orario) return;
    setForm((prev) => ({
      ...prev,
      orario: computeDefaultOrario(null, new Date(), configurazione.orario_apertura.slice(0, 5)),
    }));
  }, [configurazione, form.orario]);

  const bloccoChiusura = useMemo(() => trovaBloccoChiusura(chiusureFuture, new Date()), [chiusureFuture]);

  const gruppi = useMemo(
    () =>
      categorie
        .map((categoria) => ({
          categoria,
          items: prodottiDisponibili.filter((p) => p.categoria === categoria.id),
        }))
        .filter((gruppo) => gruppo.items.length > 0),
    [categorie, prodottiDisponibili]
  );

  const quantitaPizze = cartLines
    .filter((line) => line.prodotto.categoria_nome === PIZZA_CATEGORIA_NOME)
    .reduce((sum, line) => sum + line.quantita, 0);
  const anticipoMinimoMinuti =
    quantitaPizze > SOGLIA_PIZZE_ANTICIPO_ESTESO ? ANTICIPO_MINUTI_ESTESO : ANTICIPO_MINUTI_STANDARD;

  const orarioMinutiCorrenti = parseHHMMToMinutes(form.orario);

  // `fuoriOrarioApertura`: il servizio è chiuso in senso stretto (prima dell'apertura o dopo la
  // chiusura). `servizioChiuso` è invece "nessun orario di ritiro sarebbe comunque accettabile
  // adesso" — vero anche quando siamo ancora nominalmente dentro l'orario di apertura ma troppo
  // vicini alla chiusura per rispettare l'anticipo minimo richiesto da `validateOrarioRitiro`
  // (es. chiusura 18:00, anticipo 15 minuti: dalle 17:46 in poi nessun orario tra "adesso+15" e
  // "chiusura" esiste più). Prima di questa modifica il banner scattava solo sulla condizione
  // stretta, lasciando una finestra "silenziosa" in cui il cliente vedeva il servizio come aperto
  // ma ogni invio falliva comunque al submit — ora il banner anticipa lo stesso esito.
  const { fuoriOrarioApertura, servizioChiuso } = useMemo(() => {
    if (!configurazione) return { fuoriOrarioApertura: false, servizioChiuso: false };
    const now = parseHHMMToMinutes(nowHHMM())!;
    const apertura = parseHHMMToMinutes(configurazione.orario_apertura.slice(0, 5))!;
    const chiusura = parseHHMMToMinutes(configurazione.orario_chiusura.slice(0, 5))!;
    const fuoriOrario = now < apertura || now >= chiusura;
    const senzaMargine = !fuoriOrario && now + anticipoMinimoMinuti > chiusura;
    return { fuoriOrarioApertura: fuoriOrario, servizioChiuso: fuoriOrario || senzaMargine };
  }, [configurazione, anticipoMinimoMinuti]);

  // Nodo DOM reale di ogni card categoria, catturato via ref — non `nativeID` (su web, attraverso
  // il wrapper NativeWind, non diventa un vero attributo `id` nel DOM: stesso gotcha già
  // documentato per la pagina catalogo staff, MenuAsportoSection.tsx).
  const categoriaNodeById = useRef<Map<string, unknown>>(new Map());
  const registerCategoriaRef = (categoriaId: string) => (node: unknown) => {
    if (node) categoriaNodeById.current.set(categoriaId, node);
    else categoriaNodeById.current.delete(categoriaId);
  };
  // Durante l'animazione di uno scroll innescato da un tap sul chip, l'`IntersectionObserver`
  // sotto continuerebbe comunque a scattare più volte (le sezioni intermedie attraversano
  // brevemente la fascia osservata) e riporterebbe l'evidenziazione su una categoria diversa da
  // quella appena scelta, prima che lo scroll raggiunga davvero la destinazione — un flicker reale
  // riscontrato in verifica, non solo teorico. Questo timestamp fa ignorare all'observer i propri
  // aggiornamenti finché lo scroll programmato non si è presumibilmente concluso.
  const suppressObserverUntilRef = useRef(0);
  const scrollToCategoria = (categoriaId: string) => {
    // Evidenziazione immediata al tap, senza aspettare l'`IntersectionObserver` sotto (che
    // aggiornerebbe comunque lo stesso stato, ma solo a scroll concluso) — stesso principio
    // "feedback subito al tocco" già seguito altrove nell'app.
    setActiveCategoriaId(categoriaId);
    if (Platform.OS !== 'web') return;
    suppressObserverUntilRef.current = Date.now() + 700;
    const node = categoriaNodeById.current.get(categoriaId) as { scrollIntoView?: (opts: unknown) => void } | undefined;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  // Filtro di navigazione categorie evidenziato in base a dove si trova lo scroll — non solo un
  // salto rapido come prima: un `IntersectionObserver` (solo web, stesso gate `Platform.OS` già
  // in uso per `scrollIntoView`) osserva ogni card categoria e tiene aggiornato `activeCategoriaId`
  // con quella più in alto tra le sezioni attualmente visibili, così il chip corrispondente resta
  // evidenziato mentre si scorre il menu, non solo subito dopo un tap.
  const [activeCategoriaId, setActiveCategoriaId] = useState<string | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof IntersectionObserver === 'undefined' || gruppi.length === 0) return;

    const nodeToId = new Map<Element, string>();
    gruppi.forEach((gruppo) => {
      const node = categoriaNodeById.current.get(gruppo.categoria.id);
      if (node instanceof Element) nodeToId.set(node, gruppo.categoria.id);
    });
    if (nodeToId.size === 0) return;

    // Considera "visibile" solo la fascia subito sotto la barra sticky (≈96px) fino a metà
    // schermo: una sezione che occupa ancora il fondo della pagina non deve rubare
    // l'evidenziazione a quella che sta effettivamente scorrendo sotto la barra.
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

    // Categoria iniziale: la prima, finché lo scroll/l'observer non ne segnalano un'altra.
    setActiveCategoriaId((prev) => prev ?? gruppi[0].categoria.id);

    return () => observer.disconnect();
  }, [gruppi]);

  // Il chip della categoria attiva deve restare sempre visibile dentro la barra di navigazione
  // orizzontale — con molte categorie i chip traboccano lateralmente, e senza questo effetto
  // scorrere la pagina verticalmente (scroll-spy) poteva lasciare il chip evidenziato fuori
  // vista, a sinistra o a destra della porzione visibile della barra. Usa `scrollChipIntoView`
  // (sopra), non `Element.scrollIntoView()` diretto: quest'ultimo annullava lo scroll verticale
  // di `scrollToCategoria` quando i due venivano invocati in rapida successione da un tap sul
  // chip (bug corretto, vedi commento sulla funzione).
  const chipNodeById = useRef<Map<string, unknown>>(new Map());
  const registerChipRef = (categoriaId: string) => (node: unknown) => {
    if (node) chipNodeById.current.set(categoriaId, node);
    else chipNodeById.current.delete(categoriaId);
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || !activeCategoriaId) return;
    scrollChipIntoView(chipNodeById.current.get(activeCategoriaId));
  }, [activeCategoriaId]);

  const cartSectionRef = useRef<unknown>(null);
  const registerCartRef = (node: unknown) => {
    cartSectionRef.current = node;
  };
  const scrollToCarrello = () => {
    if (Platform.OS !== 'web') return;
    const node = cartSectionRef.current as { scrollIntoView?: (opts: unknown) => void } | undefined;
    node?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async () => {
    // Backstop: con `bloccoChiusura?.includeOggi` la UI non mostra nemmeno il form (sotto), ma
    // la funzione ripete comunque il controllo, stesso principio "mai fidarsi solo del disabled
    // lato UI" già seguito altrove nel progetto (es. isPastDate sulla mappa piscina).
    if (bloccoChiusura?.includeOggi) {
      setError('Il servizio asporto è chiuso oggi.');
      return;
    }
    if (cartLines.length === 0) {
      setError('Aggiungi almeno un prodotto al carrello.');
      return;
    }
    if (!form.nome.trim() || !form.telefono.trim()) {
      setError('Inserisci nome e telefono.');
      return;
    }
    if (!configurazione) {
      setError('Impossibile verificare gli orari del servizio. Riprova più tardi.');
      return;
    }
    const orarioError = validateOrarioRitiro(form.orario, configurazione, anticipoMinimoMinuti);
    if (orarioError) {
      setError(orarioError);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const cliente = await createCliente({ nome: form.nome.trim(), telefono: form.telefono.trim() });
      const prenotazione = await createPrenotazioneAsporto({
        cliente_id: cliente.id,
        data: toISODate(new Date()),
        ora: form.orario.trim(),
        stato: 'CONFIRMED',
        note: form.note.trim(),
      });
      // A differenza dell'assegnazione postazioni piscina (best-effort, Promise.allSettled): qui
      // una singola riga fallita significa un ordine incompleto, un errore reale da far vedere
      // al cliente, non un dettaglio recuperabile a posteriori dallo staff.
      await Promise.all(
        cartLines.map((line) =>
          createVoceOrdine({ prenotazione: prenotazione.id, prodotto: line.prodotto.id, quantita: line.quantita })
        )
      );

      setRiepilogo({
        righe: cartLines.map((line) => ({
          id: line.prodotto.id,
          nome: line.prodotto.nome,
          quantita: line.quantita,
          subtotale: line.quantita * (Number.parseFloat(line.prodotto.prezzo) || 0),
        })),
        totale: totalePrezzo,
        orario: form.orario.trim(),
        nome: form.nome.trim(),
        prenotazioneId: prenotazione.id,
      });
      setOrdineInviato(true);
      svuotaCarrello();
    } catch (err) {
      setError(extractErrorMessage(err, "Impossibile inviare l'ordine. Controlla i dati inseriti."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScaricaRicevuta = async () => {
    if (!riepilogo) return;
    setIsDownloadingRicevuta(true);
    try {
      await apriBigliettoPdf(getRicevutaUrl(riepilogo.prenotazioneId), riepilogo.prenotazioneId, 'ricevuta');
    } catch {
      setError('Impossibile scaricare la ricevuta. Riprova.');
    } finally {
      setIsDownloadingRicevuta(false);
    }
  };

  if (isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError || !configurazione) {
    return (
      <Box className="flex-1 items-center justify-center gap-4 bg-background px-6">
        <Text size="sm" className="text-center text-destructive">
          {loadError ?? 'Impossibile caricare il menu asporto.'}
        </Text>
        <BackButton className="self-center" fallbackHref="/cliente" />
      </Box>
    );
  }

  if (ordineInviato && riepilogo) {
    return (
      <ConfermaOrdineAsporto
        nome={riepilogo.nome}
        orario={riepilogo.orario}
        righe={riepilogo.righe}
        totale={riepilogo.totale}
        isDownloading={isDownloadingRicevuta}
        onScaricaRicevuta={handleScaricaRicevuta}
        onTornaHome={() => router.replace('/cliente')}
        downloadError={error}
      />
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">Asporto</Heading>
          <Text size="sm" className="text-muted-foreground">
            Servizio attivo dalle {configurazione.orario_apertura.slice(0, 5)} alle{' '}
            {configurazione.orario_chiusura.slice(0, 5)}. Scegli i piatti, poi completa l'ordine con
            i tuoi dati.
          </Text>
        </VStack>

        {bloccoChiusura?.includeOggi ? (
          // Giorno di chiusura impostato dallo staff (GiornoChiusoAsporto): sostituisce
          // interamente menu/carrello/form, stesso principio del banner "Giorno al completo"
          // della piscina self-service — non ha senso far compilare un ordine che comunque il
          // backend rifiuterebbe (validateOrarioRitiro lo blocca già come backstop, sopra).
          <Box className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <HStack space="sm" className="items-start">
              <Icon as={LockIcon} size="md" className="mt-0.5 text-rose-700" />
              <VStack className="flex-1">
                <Heading size="sm" className="text-rose-900">
                  Servizio asporto chiuso
                </Heading>
                <Text size="sm" className="mt-1 text-rose-800">
                  {bloccoChiusura.inizio === bloccoChiusura.fine
                    ? `Non è possibile ritirare ordini asporto oggi (${formatDateDDMMYYYY(bloccoChiusura.inizio)}).`
                    : `Non è possibile ritirare ordini asporto dal ${formatDateDDMMYYYY(bloccoChiusura.inizio)} al ${formatDateDDMMYYYY(bloccoChiusura.fine)}.`}{' '}
                  Prova a tornare in un altro giorno, oppure contatta direttamente il ristorante.
                </Text>
              </VStack>
            </HStack>
          </Box>
        ) : (
          <>
            {bloccoChiusura ? (
              // Il giorno dopo (o un intervallo di giorni consecutivi a partire da domani) è
              // segnato come chiuso — avviso non bloccante, richiesto esplicitamente: oggi resta
              // pienamente ordinabile, è solo un preavviso per chi vorrebbe tornare domani.
              <Box className="w-full rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <HStack space="sm" className="items-start">
                  <Icon as={LockIcon} size="md" className="mt-0.5 text-rose-700" />
                  <VStack className="flex-1">
                    <Text size="sm" className="font-medium text-rose-900">
                      Chiusura in arrivo
                    </Text>
                    <Text size="xs" className="mt-1 text-rose-800">
                      {bloccoChiusura.inizio === bloccoChiusura.fine
                        ? `Il ${formatDateDDMMYYYY(bloccoChiusura.inizio)} il servizio asporto sarà chiuso.`
                        : `Dal ${formatDateDDMMYYYY(bloccoChiusura.inizio)} al ${formatDateDDMMYYYY(bloccoChiusura.fine)} il servizio asporto sarà chiuso.`}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ) : null}

            {/* Avviso permanente, non legato all'orario di apertura (a differenza del banner
                "servizioChiuso" sotto) — un ordine confermato non garantisce comunque il rispetto
                esatto dell'orario di ritiro scelto in cucina. */}
            <Box className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <HStack space="sm" className="items-start">
                <Text size="md">⏳</Text>
                <VStack className="flex-1">
                  <Text size="sm" className="font-medium text-amber-900">
                    Possibili ritardi nella preparazione
                  </Text>
                  <Text size="xs" className="mt-1 text-amber-800">
                    Nei giorni festivi o quando gli ordini sono numerosi i tempi di preparazione
                    potrebbero allungarsi rispetto all'orario di ritiro scelto. Grazie per la
                    pazienza!
                  </Text>
                </VStack>
              </HStack>
            </Box>

            {servizioChiuso ? (
              <Box className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <HStack space="sm" className="items-start">
                  <Text size="md">🕐</Text>
                  <VStack className="flex-1">
                    <Text size="sm" className="font-medium text-amber-900">
                      Servizio momentaneamente chiuso
                    </Text>
                    <Text size="xs" className="mt-1 text-amber-800">
                      {fuoriOrarioApertura
                        ? `Puoi comunque sfogliare il menu e aggiungere piatti al carrello, ma potrai completare l'ordine solo durante l'orario di apertura (${configurazione.orario_apertura.slice(0, 5)} - ${configurazione.orario_chiusura.slice(0, 5)}).`
                        : `Mancano meno di ${anticipoMinimoMinuti} minuti alla chiusura (${configurazione.orario_chiusura.slice(0, 5)}): non c'è più abbastanza tempo per preparare un nuovo ordine oggi. Puoi comunque sfogliare il menu, riprova domani.`}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ) : null}

            {gruppi.length === 0 ? (
              <VStack
                space="sm"
                className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
              >
                <Text size="lg">🥡</Text>
                <Text size="sm" className="text-center text-muted-foreground">
                  Il menu asporto non è ancora disponibile.{'\n'}Riprova più tardi.
                </Text>
              </VStack>
            ) : (
              <>
                {/* Barra sticky: navigazione rapida per categoria a sinistra, pillola carrello a
                    destra quando non vuoto — stesso pattern "food delivery" già introdotto lato staff
                    (MenuAsportoSection.tsx, sezione 15), qui adattato per la sfoglia pubblica. */}
                <Box className="web:sticky web:top-0 z-10 -mx-4 bg-background px-4 py-1 md:-mx-8 md:px-8">
                  <HStack space="sm" className="items-center">
                    {gruppi.length > 1 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="flex-1"
                        contentContainerClassName="items-center gap-2 py-1"
                      >
                        {gruppi.map((gruppo) => {
                          const isActive = gruppo.categoria.id === activeCategoriaId;
                          return (
                            <Box key={gruppo.categoria.id} ref={registerChipRef(gruppo.categoria.id)}>
                              <Pressable
                                onPress={() => scrollToCategoria(gruppo.categoria.id)}
                                accessibilityRole="button"
                                accessibilityLabel={`Vai alla categoria ${gruppo.categoria.nome}`}
                                accessibilityState={{ selected: isActive }}
                                className={`rounded-full border-2 px-3.5 py-1.5 ${
                                  isActive
                                    ? 'border-sky-600 bg-sky-600 shadow-sm'
                                    : 'border-sky-200 bg-white active:bg-sky-50'
                                }`}
                              >
                                <Text
                                  size="xs"
                                  className={`font-bold ${isActive ? 'text-white' : 'text-sky-700'}`}
                                >
                                  {gruppo.categoria.nome}
                                </Text>
                              </Pressable>
                            </Box>
                          );
                        })}
                      </ScrollView>
                    ) : (
                      <Box className="flex-1" />
                    )}
                    {cartLines.length > 0 ? (
                      <Pressable
                        onPress={scrollToCarrello}
                        accessibilityLabel="Vai al carrello"
                        className="flex-row items-center gap-1.5 rounded-full bg-sky-600 px-3 py-2 active:bg-sky-700"
                      >
                        <Text size="xs" className="font-semibold text-white">
                          🛒 {totaleArticoli} · €{totalePrezzo.toFixed(2).replace('.', ',')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </HStack>
                </Box>

                {/* Ogni categoria è UNA card (bordo+sfondo unico), non più una card per prodotto —
                    i prodotti sono righe interne separate da un divisore sottile, stesso principio
                    delle card categoria del catalogo staff (MenuAsportoSection.tsx). */}
                <VStack space="md">
                  {gruppi.map((gruppo) => (
                    <Box
                      key={gruppo.categoria.id}
                      ref={registerCategoriaRef(gruppo.categoria.id)}
                      className="w-full overflow-hidden rounded-2xl border border-sky-200 bg-white"
                    >
                      <Box className="border-b border-sky-100 px-4 py-3">
                        <Heading size="sm" className="text-sky-900">
                          {gruppo.categoria.nome}
                        </Heading>
                      </Box>
                      <VStack>
                        {gruppo.items.map((prodotto, index) => (
                          <ProdottoRigaCliccabile
                            key={prodotto.id}
                            prodotto={prodotto}
                            quantita={quantities[prodotto.id] ?? 0}
                            setQuantita={setQuantita}
                            isLast={index === gruppo.items.length - 1}
                          />
                        ))}
                      </VStack>
                    </Box>
                  ))}
                </VStack>

                <Box ref={registerCartRef} className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
                  <VStack space="md">
                    <Heading size="sm">Il tuo ordine</Heading>
                    {cartLines.length === 0 ? (
                      <Text size="sm" className="text-sky-900/60">
                        Il carrello è vuoto. Aggiungi qualche piatto dal menu qui sopra.
                      </Text>
                    ) : (
                      <>
                        <VStack space="sm">
                          {cartLines.map((line) => (
                            <HStack key={line.prodotto.id} space="sm" className="items-center justify-between">
                              <VStack className="flex-1">
                                <Text size="sm" className="font-medium text-sky-900">
                                  {line.prodotto.nome}
                                </Text>
                                <Text size="xs" className="text-sky-900/60">
                                  €{formatPrezzo(line.prodotto.prezzo)} x {line.quantita}
                                </Text>
                              </VStack>
                              <HStack space="xs" className="items-center">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-full border-2 border-sky-300 bg-white"
                                  onPress={() => setQuantita(line.prodotto.id, line.quantita - 1)}
                                  accessibilityLabel={`Diminuisci ${line.prodotto.nome}`}
                                >
                                  <ButtonIcon as={RemoveIcon} className="text-sky-900" />
                                </Button>
                                <Text size="sm" className="w-5 text-center font-bold text-sky-900">
                                  {line.quantita}
                                </Text>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  className="h-8 w-8 rounded-full border-2 border-sky-300 bg-white"
                                  onPress={() => setQuantita(line.prodotto.id, line.quantita + 1)}
                                  accessibilityLabel={`Aumenta ${line.prodotto.nome}`}
                                >
                                  <ButtonIcon as={AddIcon} className="text-sky-900" />
                                </Button>
                              </HStack>
                            </HStack>
                          ))}
                        </VStack>
                        <Box className="h-px bg-sky-200" />
                        <HStack className="items-center justify-between">
                          <Text size="sm" className="font-semibold text-sky-900">
                            Totale
                          </Text>
                          <Text size="md" className="font-bold text-sky-900">
                            €{totalePrezzo.toFixed(2).replace('.', ',')}
                          </Text>
                        </HStack>
                      </>
                    )}
                  </VStack>
                </Box>

                <VStack space="md" className="w-full rounded-2xl border border-sky-200 bg-sky-100 p-5">
                  <Heading size="sm">I tuoi dati</Heading>

                  <VStack space="xs">
                    <HStack space="xs" className="items-center">
                      <Text size="sm">👤</Text>
                      <Text size="sm" className="font-medium">
                        Nome e cognome
                      </Text>
                      <Text size="xs" className="text-destructive">
                        *
                      </Text>
                    </HStack>
                    <Input>
                      <InputField placeholder="Es. Mario Rossi" value={form.nome} onChangeText={setField('nome')} />
                    </Input>
                  </VStack>

                  <VStack space="xs">
                    <HStack space="xs" className="items-center">
                      <Icon as={PhoneIcon} size="sm" className="text-sky-700" />
                      <Text size="sm" className="font-medium">
                        Telefono
                      </Text>
                      <Text size="xs" className="text-destructive">
                        *
                      </Text>
                    </HStack>
                    <Input>
                      <InputField
                        keyboardType="phone-pad"
                        placeholder="Es. 333 1234567"
                        value={form.telefono}
                        onChangeText={setField('telefono')}
                      />
                    </Input>
                    <Text size="2xs" className="text-sky-900/60">
                      📌 Usa sempre lo stesso numero: ci aiuta a riconoscerti e a ritrovare le tue
                      preferenze, ed è anche quello con cui potrai ritrovare le tue prenotazioni in
                      "Le mie prenotazioni", dalla home.
                    </Text>
                  </VStack>

                  <VStack space="xs">
                    <HStack space="xs" className="items-center">
                      <Text size="sm">📝</Text>
                      <Text size="sm" className="font-medium">
                        Note
                      </Text>
                      <Text size="xs" className="text-muted-foreground">
                        (opzionale)
                      </Text>
                    </HStack>
                    <Input>
                      <InputField
                        placeholder="Es. senza cipolla, allergie..."
                        value={form.note}
                        onChangeText={setField('note')}
                      />
                    </Input>
                  </VStack>

                  <VStack space="xs">
                    <HStack space="xs" className="items-center">
                      <Icon as={ClockIcon} size="sm" className="text-sky-700" />
                      <Text size="sm" className="font-medium">
                        Orario di ritiro
                      </Text>
                      <Text size="xs" className="text-destructive">
                        *
                      </Text>
                    </HStack>
                    <Pressable
                      onPress={() => setIsTimePickerOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Scegli l'orario di ritiro dall'orologio"
                      className="min-h-9 w-full flex-row items-center justify-between rounded-md border border-border bg-transparent px-3 py-2"
                    >
                      <Text size="sm" className={form.orario ? 'font-semibold text-sky-900' : 'text-muted-foreground'}>
                        {form.orario || `Es. ${configurazione.orario_apertura.slice(0, 5)}`}
                      </Text>
                      <Icon as={ClockIcon} size="sm" className="text-sky-700" />
                    </Pressable>
                    <Text size="2xs" className="text-sky-900/60">
                      Orario del servizio: {configurazione.orario_apertura.slice(0, 5)} -{' '}
                      {configurazione.orario_chiusura.slice(0, 5)}
                    </Text>
                    {quantitaPizze > SOGLIA_PIZZE_ANTICIPO_ESTESO ? (
                      <Text size="2xs" className="text-amber-700">
                        🍕 Con più di {SOGLIA_PIZZE_ANTICIPO_ESTESO} pizze nello stesso ordine serve un
                        anticipo minimo di {ANTICIPO_MINUTI_ESTESO} minuti (invece di{' '}
                        {ANTICIPO_MINUTI_STANDARD}).
                      </Text>
                    ) : (
                      <Text size="2xs" className="text-sky-900/60">
                        Anticipo minimo richiesto: {ANTICIPO_MINUTI_STANDARD} minuti da adesso.
                      </Text>
                    )}
                  </VStack>
                </VStack>

                <Suspense fallback={null}>
                  <TimePickerModal
                    visible={isTimePickerOpen}
                    onDismiss={() => setIsTimePickerOpen(false)}
                    onConfirm={({ hours, minutes }) => {
                      setIsTimePickerOpen(false);
                      setField('orario')(minutesToHHMM(hours * 60 + minutes));
                    }}
                    hours={orarioMinutiCorrenti !== null ? Math.floor(orarioMinutiCorrenti / 60) : undefined}
                    minutes={orarioMinutiCorrenti !== null ? orarioMinutiCorrenti % 60 : undefined}
                    use24HourClock
                    locale="it"
                    label="Orario di ritiro"
                    cancelLabel="Annulla"
                    confirmLabel="OK"
                    animationType="fade"
                  />
                </Suspense>

                {error ? (
                  <Text size="sm" className="text-center text-destructive">
                    {error}
                  </Text>
                ) : null}

                <Button
                  onPress={handleSubmit}
                  disabled={isSubmitting || cartLines.length === 0}
                  isDisabled={isSubmitting || cartLines.length === 0}
                >
                  {isSubmitting ? <ButtonSpinner /> : <ButtonText>Invia ordine</ButtonText>}
                </Button>
                <Text size="2xs" className="text-center text-muted-foreground">
                  L'ordine viene confermato subito, senza attese.
                </Text>
              </>
            )}
          </>
        )}

        <BackButton fallbackHref="/cliente" />

        <ClienteFooter />
      </VStack>
    </ScrollView>
  );
}
