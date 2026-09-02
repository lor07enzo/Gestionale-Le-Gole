import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { AddIcon, ClockIcon, CloseIcon, Icon, LockIcon, PhoneIcon, RemoveIcon, SlidersIcon } from '@/components/ui/icon';
import { createVoceOrdine, type Allergene, type Categoria, type Prodotto } from '../../../src/services/menu';
import { createPrenotazioneAsporto, getRicevutaUrl } from '../../../src/services/prenotazioni';
import { createCliente } from '../../../src/services/clienti';
import { ClienteFooter } from '../../../src/components/cliente/ClienteFooter';
import { BackButton } from '../../../src/components/cliente/BackButton';
import { ConfermaOrdineAsporto, type RigaRiepilogoOrdineAsporto } from '../../../src/components/cliente/ConfermaOrdineAsporto';
import { apriBigliettoPdf } from '../../../src/utils/biglietto';
import { useCarrelloAsporto } from '../../../src/context/CarrelloAsportoContext';
import {
  addDays,
  formatDateDDMMYYYY,
  generaSlotOrario,
  nowHHMM,
  parseHHMMToMinutes,
  parseISODate,
  raggruppaSlotPerOra,
  toISODate,
} from '../../../src/utils/piscinaMappa';
import { formatPrezzo } from '../../../src/utils/prezzi';
import { extractErrorMessage } from '../../../src/utils/errors';

// Nome esatto della categoria seminata lato backend (migrazione 0008, idempotente — sempre
// presente dopo il primo deploy, anche se lo staff non l'ha mai toccata). Un ordine con più di
// questa quantità di pizze richiede più margine di preparazione in cucina, quindi un anticipo
// minimo maggiore rispetto a un ordine normale.
const PIZZA_CATEGORIA_NOME = 'Pizze';
const SOGLIA_PIZZE_ANTICIPO_ESTESO = 10;
const ANTICIPO_MINUTI_STANDARD = 15;
const ANTICIPO_MINUTI_ESTESO = 30;
// Sotto questo numero di prenotazioni ancora accettabili per un orario (limite globale meno
// quante già presenti, sezione 1/15 di CLAUDE.md), mostriamo il conteggio residuo sotto lo slot —
// un preavviso prima che l'orario diventi "Esaurito" del tutto, non solo quel messaggio finale.
// Abbassata a 2 (2026-08-28, su richiesta esplicita dell'utente — "deve comparire quando c'è
// ancora posto per due prenotati"): da quando il limite conta prenotazioni e non più prodotti, i
// numeri in gioco sono molto più piccoli (tipicamente una manciata per orario), quindi la vecchia
// soglia di 5 avrebbe reso il conteggio quasi sempre visibile, vanificando l'idea di un preavviso
// solo quando la scarsità è reale.
const SOGLIA_AVVISO_RESIDUO_ORARIO = 2;
// Sotto questa ulteriore soglia (più stringente della precedente) il testo passa da ambra a rosa
// — stessa scala verde/ambra/rosa già usata altrove nel progetto per la disponibilità residua
// (es. DisponibilitaCards, piscina) applicata qui al residuo per singola prenotazione per orario.
const RESIDUO_CRITICO = 1;

// Colore del testo "N posti liberi" — sta FUORI dal bottone dello slot (didascalia sotto, non più
// un badge annidato dentro il bottone stesso): non deve più adattarsi allo sfondo pieno del
// bottone selezionato, quindi un solo colore per fascia, nessun ramo "selezionato".
function residuoTextClassName(residuo: number): string {
  return residuo <= RESIDUO_CRITICO ? 'text-rose-600' : 'text-amber-600';
}

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

type FinestraOraria = { apertura: string; chiusura: string };

// Configurazione con eventuale secondo turno (pranzo/cena) — stessa forma di `ConfigurazioneAsporto`
// (src/services/menu.ts), ridotta ai soli campi orario per non legare questo helper puro al tipo
// completo del servizio.
type ConfigurazioneConTurni = {
  orario_apertura: string;
  orario_chiusura: string;
  orario_apertura_2: string | null;
  orario_chiusura_2: string | null;
};

// "Mostra un turno alla volta": la finestra attiva è la prima non ancora chiusa (chiusura > ora
// attuale) — prima della chiusura del pranzo resta il pranzo, anche se non ancora aperto (stesso
// comportamento "fuori orario ma consultabile" di un servizio a turno singolo); una volta chiuso
// il pranzo lo switch avviene da solo verso la cena, anche prima che la cena apra (banner "fuori
// orario" invariato, solo riferito al turno giusto). Se anche l'ultimo turno è già chiuso per
// oggi, si mostra comunque quello — serve solo da riferimento per il messaggio "servizio chiuso".
function getFinestraAttiva(configurazione: ConfigurazioneConTurni, nowMinuti: number): FinestraOraria {
  const finestre: FinestraOraria[] = [
    { apertura: configurazione.orario_apertura.slice(0, 5), chiusura: configurazione.orario_chiusura.slice(0, 5) },
  ];
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    finestre.push({
      apertura: configurazione.orario_apertura_2.slice(0, 5),
      chiusura: configurazione.orario_chiusura_2.slice(0, 5),
    });
  }
  return finestre.find((f) => parseHHMMToMinutes(f.chiusura)! > nowMinuti) ?? finestre[finestre.length - 1];
}

// Descrizione leggibile di entrambi i turni insieme (non solo quello attivo) — usata per il testo
// introduttivo della pagina, dove il cliente deve vedere l'intero orario del servizio, non solo il
// turno che sta per scegliere. Stesso principio/stessa forma di `descrizione_orari()` lato backend
// (menu/models.py, ConfigurazioneAsporto).
function descrizioneOrari(configurazione: ConfigurazioneConTurni): string {
  const turni = [`dalle ${configurazione.orario_apertura.slice(0, 5)} alle ${configurazione.orario_chiusura.slice(0, 5)}`];
  if (configurazione.orario_apertura_2 && configurazione.orario_chiusura_2) {
    turni.push(
      `dalle ${configurazione.orario_apertura_2.slice(0, 5)} alle ${configurazione.orario_chiusura_2.slice(0, 5)}`
    );
  }
  return turni.join(' e ');
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

// Filtri lato cliente (2026-08-28), su richiesta esplicita dell'utente ("prendi spunto dalla
// pagina dei filtri di amazon"): categoria, allergeni, fascia di prezzo — un foglio a fondo
// pagina (`FiltriSheet`, sotto) con una sezione a chip per ciascun gruppo, un conteggio prodotti
// per opzione (calcolato una volta sola su tutto il catalogo disponibile, non ricalcolato in base
// agli altri filtri già attivi — un compromesso deliberato: la versione "dinamica" di Amazon
// sarebbe più corretta ma anche più costosa da calcolare per un beneficio marginale su un menu di
// queste dimensioni) e un pulsante finale "Mostra N prodotti", stesso linguaggio del "See results"
// di Amazon. Le chip attive restano visibili anche a foglio chiuso, in una riga rimovibile sopra
// il menu (sotto).
type PrezzoBucketId = 'fino5' | 'da5a10' | 'oltre10';
type PrezzoBucket = { id: PrezzoBucketId; label: string; test: (prezzo: number) => boolean };
const PREZZO_BUCKETS: PrezzoBucket[] = [
  { id: 'fino5', label: 'Fino a €5', test: (prezzo) => prezzo <= 5 },
  { id: 'da5a10', label: 'Da €5 a €10', test: (prezzo) => prezzo > 5 && prezzo <= 10 },
  { id: 'oltre10', label: 'Oltre €10', test: (prezzo) => prezzo > 10 },
];

// Chip di selezione dentro il foglio filtri — stesso linguaggio visivo dei chip categoria già
// presenti sulla barra di navigazione della pagina, con in più un conteggio prodotti ed una tinta
// alternativa (amber) per gli allergeni, coerente col colore già usato per i badge allergene nella
// pagina di dettaglio prodotto.
function FiltroChip({
  label,
  selected,
  count,
  onPress,
  tone = 'sky',
}: Readonly<{
  label: string;
  selected: boolean;
  count: number;
  onPress: () => void;
  tone?: 'sky' | 'amber';
}>) {
  const unselectedClass =
    tone === 'amber' ? 'border-amber-200 bg-amber-50 active:bg-amber-100' : 'border-sky-200 bg-white active:bg-sky-50';
  const unselectedTextClass = tone === 'amber' ? 'text-amber-800' : 'text-sky-800';
  const selectedClass = tone === 'amber' ? 'border-amber-600 bg-amber-600' : 'border-sky-600 bg-sky-600';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'prodotto' : 'prodotti'}${selected ? ', filtro attivo' : ''}`}
      className={`rounded-full border-2 px-3.5 py-1.5 ${selected ? selectedClass : unselectedClass}`}
    >
      <Text size="xs" className={`font-medium ${selected ? 'text-white' : unselectedTextClass}`}>
        {selected ? '✓ ' : ''}
        {label} ({count})
      </Text>
    </Pressable>
  );
}

// Chip "rimuovibile" della riga riepilogo filtri attivi (sotto il pulsante Filtri, sempre
// visibile a foglio chiuso quando almeno un filtro è selezionato) — tap equivale a deselezionare
// lo stesso filtro dal foglio, senza doverlo riaprire.
function FiltroAttivoChip({ label, onRemove }: Readonly<{ label: string; onRemove: () => void }>) {
  return (
    <Pressable
      onPress={onRemove}
      accessibilityRole="button"
      accessibilityLabel={`Rimuovi filtro ${label}`}
      className="flex-row items-center gap-1 rounded-full border-2 border-sky-600 bg-sky-600 px-3 py-1.5 active:bg-sky-700"
    >
      <Text size="xs" className="font-medium text-white">
        {label}
      </Text>
      <Icon as={CloseIcon} size="xs" className="text-white" />
    </Pressable>
  );
}

function FiltriSheet({
  isOpen,
  onClose,
  categorie,
  allergeni,
  categoriaCounts,
  allergeneCounts,
  prezzoCounts,
  filtriCategorie,
  filtriAllergeni,
  filtriPrezzo,
  onToggleCategoria,
  onToggleAllergene,
  onTogglePrezzo,
  onClear,
  risultati,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  categorie: Categoria[];
  allergeni: Allergene[];
  categoriaCounts: Map<string, number>;
  allergeneCounts: Map<string, number>;
  prezzoCounts: Map<PrezzoBucketId, number>;
  filtriCategorie: Set<string>;
  filtriAllergeni: Set<string>;
  filtriPrezzo: Set<PrezzoBucketId>;
  onToggleCategoria: (id: string) => void;
  onToggleAllergene: (id: string) => void;
  onTogglePrezzo: (id: PrezzoBucketId) => void;
  onClear: () => void;
  risultati: number;
}>) {
  const haFiltriAttivi = filtriCategorie.size > 0 || filtriAllergeni.size > 0 || filtriPrezzo.size > 0;
  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[85vh]" aria-label="Filtri">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>
        <ActionsheetScrollView className="w-full">
          <VStack space="lg" className="w-full pb-6">
            <HStack className="items-center justify-between">
              <Heading size="md">Filtri</Heading>
              {haFiltriAttivi ? (
                <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Cancella tutti i filtri">
                  <Text size="xs" className="font-semibold text-sky-700">
                    Cancella tutti
                  </Text>
                </Pressable>
              ) : null}
            </HStack>

            {categorie.length > 0 ? (
              <VStack space="xs">
                <Text size="sm" className="font-semibold text-sky-900">
                  Categoria
                </Text>
                <HStack space="xs" className="flex-wrap">
                  {categorie.map((categoria) => (
                    <FiltroChip
                      key={categoria.id}
                      label={categoria.nome}
                      count={categoriaCounts.get(categoria.id) ?? 0}
                      selected={filtriCategorie.has(categoria.id)}
                      onPress={() => onToggleCategoria(categoria.id)}
                    />
                  ))}
                </HStack>
              </VStack>
            ) : null}

            {allergeni.length > 0 ? (
              <VStack space="xs">
                <Text size="sm" className="font-semibold text-sky-900">
                  Allergeni da evitare
                </Text>
                <Text size="2xs" className="text-sky-900/60">
                  Nascondiamo i piatti che contengono uno o più degli allergeni selezionati.
                </Text>
                <HStack space="xs" className="flex-wrap">
                  {allergeni.map((allergene) => (
                    <FiltroChip
                      key={allergene.id}
                      label={allergene.icona ? `${allergene.icona} ${allergene.nome}` : allergene.nome}
                      count={allergeneCounts.get(allergene.id) ?? 0}
                      selected={filtriAllergeni.has(allergene.id)}
                      onPress={() => onToggleAllergene(allergene.id)}
                      tone="amber"
                    />
                  ))}
                </HStack>
              </VStack>
            ) : null}

            <VStack space="xs">
              <Text size="sm" className="font-semibold text-sky-900">
                Fascia di prezzo
              </Text>
              <HStack space="xs" className="flex-wrap">
                {PREZZO_BUCKETS.map((bucket) => (
                  <FiltroChip
                    key={bucket.id}
                    label={bucket.label}
                    count={prezzoCounts.get(bucket.id) ?? 0}
                    selected={filtriPrezzo.has(bucket.id)}
                    onPress={() => onTogglePrezzo(bucket.id)}
                  />
                ))}
              </HStack>
            </VStack>

            <Button onPress={onClose}>
              <ButtonText>
                Mostra {risultati} {risultati === 1 ? 'prodotto' : 'prodotti'}
              </ButtonText>
            </Button>
          </VStack>
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}

export default function ClienteAsportoScreen() {
  const {
    categorie,
    allergeni,
    allergeneById,
    prodottiDisponibili,
    configurazione,
    chiusureFuture,
    prenotazioniPerOrario,
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
  const [ordineInviato, setOrdineInviato] = useState(false);
  const [riepilogo, setRiepilogo] = useState<RiepilogoOrdine | null>(null);
  const [isDownloadingRicevuta, setIsDownloadingRicevuta] = useState(false);
  // Fascia oraria attualmente espansa nel picker orario (es. "12" per "12:00-13:00") — un solo
  // accordion aperto alla volta, nessuna preselezione (stesso principio "nessuna precompilazione"
  // già seguito sotto per l'orario stesso).
  const [oraEspansa, setOraEspansa] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K) => (value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // "Mostra un turno alla volta" (sezione 15): finché il turno attivo non è ancora chiuso, i
  // picker/il banner sotto restano ancorati a lui — appena chiude, `getFinestraAttiva` passa da
  // sé al successivo (se configurato un secondo turno), senza alcuna azione del cliente.
  const finestraAttiva = useMemo(
    () => (configurazione ? getFinestraAttiva(configurazione, parseHHMMToMinutes(nowHHMM())!) : null),
    [configurazione]
  );

  // Nessuna precompilazione: il cliente sceglie sempre esplicitamente uno slot tra quelli
  // proposti (sotto) — a differenza del vecchio TimePickerModal, un default "adesso" non
  // sarebbe comunque mai stato uno slot valido (l'anticipo minimo lo esclude sempre).
  const slotsOrario = useMemo(
    () => (finestraAttiva ? generaSlotOrario(finestraAttiva.apertura, finestraAttiva.chiusura) : []),
    [finestraAttiva]
  );
  const blocchiOrario = useMemo(() => raggruppaSlotPerOra(slotsOrario), [slotsOrario]);

  // Limite globale di PRENOTAZIONI per orario (ConfigurazioneAsporto.limite_prenotazioni_orario,
  // sezione 15) — si applica automaticamente a *qualunque* orario, non scelto per singola fascia.
  // Se non impostato (null), nessuno slot risulta mai esaurito. A differenza del precedente
  // limite sui prodotti (2026-08-28, rinominato su richiesta esplicita dell'utente), qui non
  // serve più sapere "quanti prodotti" comporterebbe l'ordine: inviare il checkout crea sempre
  // esattamente UNA prenotazione, a prescindere da quanti piatti/quante unità contiene il
  // carrello — basta confrontare il numero di prenotazioni già presenti con il limite.
  const limitePrenotazioniOrario = configurazione?.limite_prenotazioni_orario ?? null;
  const isSlotEsaurito = (slot: string) => {
    if (limitePrenotazioniOrario === null) return false;
    const prenotate = prenotazioniPerOrario[slot] ?? 0;
    return prenotate >= limitePrenotazioniOrario;
  };
  // Residuo dello slot (limite meno quante prenotazioni già presenti) — quante prenotazioni in
  // più quell'orario può ancora accettare, non legato al carrello di questo cliente.
  const residuoSlot = (slot: string): number | null => {
    if (limitePrenotazioniOrario === null) return null;
    const prenotate = prenotazioniPerOrario[slot] ?? 0;
    return limitePrenotazioniOrario - prenotate;
  };

  const bloccoChiusura = useMemo(() => trovaBloccoChiusura(chiusureFuture, new Date()), [chiusureFuture]);

  // Filtri (categoria/allergeni-da-evitare/fascia di prezzo) — stato locale a questa pagina, mai
  // sollevato nel context condiviso: hanno senso solo mentre si sfoglia il menu, non nella pagina
  // di dettaglio prodotto.
  const [isFiltriOpen, setIsFiltriOpen] = useState(false);
  const [filtriCategorie, setFiltriCategorie] = useState<Set<string>>(new Set());
  const [filtriAllergeni, setFiltriAllergeni] = useState<Set<string>>(new Set());
  const [filtriPrezzo, setFiltriPrezzo] = useState<Set<PrezzoBucketId>>(new Set());

  const toggleCategoria = (id: string) => {
    setFiltriCategorie((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAllergeneFiltro = (id: string) => {
    setFiltriAllergeni((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const togglePrezzo = (id: PrezzoBucketId) => {
    setFiltriPrezzo((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearFiltri = () => {
    setFiltriCategorie(new Set());
    setFiltriAllergeni(new Set());
    setFiltriPrezzo(new Set());
  };

  // Conteggi per opzione — calcolati una sola volta sull'intero catalogo disponibile (non
  // ricalcolati in base agli altri filtri già scelti, stesso compromesso motivato sopra al
  // componente `FiltriSheet`).
  const categoriaCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const prodotto of prodottiDisponibili) {
      counts.set(prodotto.categoria, (counts.get(prodotto.categoria) ?? 0) + 1);
    }
    return counts;
  }, [prodottiDisponibili]);
  const allergeneCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const prodotto of prodottiDisponibili) {
      for (const allergeneId of prodotto.allergeni) {
        counts.set(allergeneId, (counts.get(allergeneId) ?? 0) + 1);
      }
    }
    return counts;
  }, [prodottiDisponibili]);
  const prezzoCounts = useMemo(() => {
    const counts = new Map<PrezzoBucketId, number>();
    for (const bucket of PREZZO_BUCKETS) {
      const n = prodottiDisponibili.filter((p) => bucket.test(Number.parseFloat(p.prezzo) || 0)).length;
      counts.set(bucket.id, n);
    }
    return counts;
  }, [prodottiDisponibili]);

  // Un prodotto resta in lista solo se rientra in TUTTI i gruppi di filtro attivi (AND tra
  // categoria/allergeni/prezzo) — dentro ciascun gruppo, invece, basta una corrispondenza
  // qualsiasi (OR), stesso comportamento dei filtri Amazon. Per gli allergeni la logica è
  // volutamente invertita rispetto a categoria/prezzo: qui si SELEZIONA cosa evitare, quindi un
  // prodotto viene escluso se contiene ANCHE UNO SOLO degli allergeni scelti (mai il contrario —
  // "mostra solo i prodotti con questo allergene" non avrebbe senso per un cliente allergico).
  const prodottiFiltrati = useMemo(
    () =>
      prodottiDisponibili.filter((prodotto) => {
        if (filtriCategorie.size > 0 && !filtriCategorie.has(prodotto.categoria)) return false;
        if (filtriAllergeni.size > 0 && prodotto.allergeni.some((id) => filtriAllergeni.has(id))) return false;
        if (filtriPrezzo.size > 0) {
          const prezzo = Number.parseFloat(prodotto.prezzo) || 0;
          const dentroFasciaScelta = PREZZO_BUCKETS.some((bucket) => filtriPrezzo.has(bucket.id) && bucket.test(prezzo));
          if (!dentroFasciaScelta) return false;
        }
        return true;
      }),
    [prodottiDisponibili, filtriCategorie, filtriAllergeni, filtriPrezzo]
  );
  const numeroFiltriAttivi = filtriCategorie.size + filtriAllergeni.size + filtriPrezzo.size;

  const categoriaById = useMemo(() => new Map(categorie.map((c) => [c.id, c])), [categorie]);
  // Riga di chip rimovibili mostrata sopra il menu quando almeno un filtro è attivo — un tap
  // rimuove quel singolo filtro senza dover riaprire il foglio, stesso pattern "chip riepilogo"
  // già visto nei filtri Amazon.
  const chipsFiltriAttivi = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    filtriCategorie.forEach((id) => {
      chips.push({ key: `cat-${id}`, label: categoriaById.get(id)?.nome ?? id, onRemove: () => toggleCategoria(id) });
    });
    filtriAllergeni.forEach((id) => {
      const nome = allergeneById.get(id)?.nome ?? id;
      chips.push({ key: `all-${id}`, label: `Senza ${nome}`, onRemove: () => toggleAllergeneFiltro(id) });
    });
    filtriPrezzo.forEach((id) => {
      const bucket = PREZZO_BUCKETS.find((b) => b.id === id);
      chips.push({ key: `prezzo-${id}`, label: bucket?.label ?? id, onRemove: () => togglePrezzo(id) });
    });
    return chips;
  }, [filtriCategorie, filtriAllergeni, filtriPrezzo, categoriaById, allergeneById]);

  const gruppi = useMemo(
    () =>
      categorie
        .map((categoria) => ({
          categoria,
          items: prodottiFiltrati.filter((p) => p.categoria === categoria.id),
        }))
        .filter((gruppo) => gruppo.items.length > 0),
    [categorie, prodottiFiltrati]
  );

  const quantitaPizze = cartLines
    .filter((line) => line.prodotto.categoria_nome === PIZZA_CATEGORIA_NOME)
    .reduce((sum, line) => sum + line.quantita, 0);
  const anticipoMinimoMinuti =
    quantitaPizze > SOGLIA_PIZZE_ANTICIPO_ESTESO ? ANTICIPO_MINUTI_ESTESO : ANTICIPO_MINUTI_STANDARD;

  // `fuoriOrarioApertura`: il servizio è chiuso in senso stretto (prima dell'apertura o dopo la
  // chiusura). `servizioChiuso` è invece "nessun orario di ritiro sarebbe comunque accettabile
  // adesso" — vero anche quando siamo ancora nominalmente dentro l'orario di apertura ma troppo
  // vicini alla chiusura per rispettare l'anticipo minimo richiesto da `validateOrarioRitiro`
  // (es. chiusura 18:00, anticipo 15 minuti: dalle 17:46 in poi nessun orario tra "adesso+15" e
  // "chiusura" esiste più). Prima di questa modifica il banner scattava solo sulla condizione
  // stretta, lasciando una finestra "silenziosa" in cui il cliente vedeva il servizio come aperto
  // ma ogni invio falliva comunque al submit — ora il banner anticipa lo stesso esito.
  const { fuoriOrarioApertura, servizioChiuso } = useMemo(() => {
    if (!finestraAttiva) return { fuoriOrarioApertura: false, servizioChiuso: false };
    const now = parseHHMMToMinutes(nowHHMM())!;
    const apertura = parseHHMMToMinutes(finestraAttiva.apertura)!;
    const chiusura = parseHHMMToMinutes(finestraAttiva.chiusura)!;
    const fuoriOrario = now < apertura || now >= chiusura;
    const senzaMargine = !fuoriOrario && now + anticipoMinimoMinuti > chiusura;
    return { fuoriOrarioApertura: fuoriOrario, servizioChiuso: fuoriOrario || senzaMargine };
  }, [finestraAttiva, anticipoMinimoMinuti]);

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
        const piuAlta = visibili.reduce((a, b) => (a.boundingClientRect.top <= b.boundingClientRect.top ? a : b), visibili[0]);
        const id = nodeToId.get(piuAlta.target);
        if (id) setActiveCategoriaId(id);
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: [0, 1] }
    );
    nodeToId.forEach((_id, node) => observer.observe(node));

    // Categoria iniziale: la prima, finché lo scroll/l'observer non ne segnalano un'altra — e
    // ricalcolata se quella attiva sparisce da `gruppi` (es. filtrata via dal foglio filtri, sopra),
    // altrimenti resterebbe evidenziato un chip non più presente nella barra.
    setActiveCategoriaId((prev) => {
      if (prev && gruppi.some((gruppo) => gruppo.categoria.id === prev)) return prev;
      return gruppi[0]?.categoria.id ?? null;
    });

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
    if (!configurazione || !finestraAttiva) {
      setError('Impossibile verificare gli orari del servizio. Riprova più tardi.');
      return;
    }
    const orarioError = validateOrarioRitiro(
      form.orario,
      { orario_apertura: finestraAttiva.apertura, orario_chiusura: finestraAttiva.chiusura },
      anticipoMinimoMinuti
    );
    if (orarioError) {
      setError(orarioError);
      return;
    }
    // Backstop: il residuo per orario è quello letto al caricamento della pagina, potrebbe
    // essere nel frattempo cambiato (un altro cliente ha esaurito lo stesso slot) — la UI (sopra)
    // già disabilita lo slot appena il residuo letto localmente non basta più, ma se lo slot era
    // già stato scelto prima che il carrello raggiungesse questa quantità va comunque ribadito
    // qui. Il backend resta comunque l'ultima parola (VoceOrdineSerializer.validate()).
    if (isSlotEsaurito(form.orario.trim())) {
      setError('Numero massimo di prodotti raggiunto per questo orario: scegli un altro orario.');
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
    <>
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <VStack space="xs">
          <Heading size="xl">Asporto</Heading>
          <Text size="sm" className="text-muted-foreground">
            Servizio attivo {descrizioneOrari(configurazione)}. Scegli i piatti, poi completa
            l'ordine con i tuoi dati.
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
                        ? `Puoi comunque sfogliare il menu e aggiungere piatti al carrello, ma potrai completare l'ordine solo durante l'orario di apertura (${finestraAttiva!.apertura} - ${finestraAttiva!.chiusura}).`
                        : `Mancano meno di ${anticipoMinimoMinuti} minuti alla chiusura (${finestraAttiva!.chiusura}): non c'è più abbastanza tempo per preparare un nuovo ordine oggi. Puoi comunque sfogliare il menu, riprova domani.`}
                    </Text>
                  </VStack>
                </HStack>
              </Box>
            ) : null}

            {prodottiDisponibili.length === 0 ? (
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
                {/* Barra sticky: pulsante Filtri, navigazione rapida per categoria, pillola
                    carrello a destra quando non vuoto — stesso pattern "food delivery" già
                    introdotto lato staff (MenuAsportoSection.tsx, sezione 15), qui adattato per la
                    sfoglia pubblica. Il pulsante Filtri resta sempre qui (mai dentro il ramo
                    `gruppi.length === 0` sotto): deve restare raggiungibile anche quando i filtri
                    attivi azzerano i risultati, altrimenti l'utente resterebbe bloccato senza un
                    modo per rilassarli. */}
                <Box className="web:sticky web:top-0 z-10 -mx-4 bg-background px-4 py-1 md:-mx-8 md:px-8">
                  <HStack space="sm" className="items-center">
                    <Pressable
                      onPress={() => setIsFiltriOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Filtri${numeroFiltriAttivi > 0 ? `, ${numeroFiltriAttivi} attivi` : ''}`}
                      className="relative h-9 w-9 items-center justify-center rounded-full border-2 border-sky-200 bg-white active:bg-sky-50"
                    >
                      <Icon as={SlidersIcon} size="sm" className="text-sky-700" />
                      {numeroFiltriAttivi > 0 ? (
                        <Box className="absolute -right-1 -top-1 h-4 w-4 items-center justify-center rounded-full border border-white bg-sky-600">
                          <Text size="2xs" className="font-bold text-white">
                            {numeroFiltriAttivi}
                          </Text>
                        </Box>
                      ) : null}
                    </Pressable>
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

                {/* Riepilogo filtri attivi — riga scorrevole di chip rimovibili, visibile solo se
                    almeno un filtro è selezionato; un tap rimuove quel singolo filtro senza dover
                    riaprire il foglio (sotto). */}
                {numeroFiltriAttivi > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerClassName="items-center gap-2 py-1"
                  >
                    {chipsFiltriAttivi.map((chip) => (
                      <FiltroAttivoChip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
                    ))}
                  </ScrollView>
                ) : null}

                {/* Ogni categoria è UNA card (bordo+sfondo unico), non più una card per prodotto —
                    i prodotti sono righe interne separate da un divisore sottile, stesso principio
                    delle card categoria del catalogo staff (MenuAsportoSection.tsx). Se i filtri
                    azzerano i risultati, questo blocco mostra un invito a rilassarli invece della
                    griglia vuota — il resto della pagina (carrello, dati, invio) resta comunque
                    visibile: un ordine già in carrello non deve sparire solo perché la vista
                    filtrata in questo momento non mostra più quel prodotto. */}
                {gruppi.length === 0 ? (
                  <VStack
                    space="sm"
                    className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8"
                  >
                    <Text size="lg">🔎</Text>
                    <Text size="sm" className="text-center text-muted-foreground">
                      Nessun prodotto corrisponde ai filtri selezionati.
                    </Text>
                    <Pressable onPress={clearFiltri} accessibilityRole="button" accessibilityLabel="Cancella filtri">
                      <Text size="sm" className="font-semibold text-sky-700">
                        Cancella filtri
                      </Text>
                    </Pressable>
                  </VStack>
                ) : (
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
                )}

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
                      📌 Usa sempre lo stesso numero: ti aiuta a ritrovare prenotazioni e preferenze.
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
                    {configurazione.orario_apertura_2 && configurazione.orario_chiusura_2 ? (
                      // Con un secondo turno configurato, il cliente vede sempre e solo il turno
                      // "attivo" (getFinestraAttiva sopra) — questa riga chiarisce quale dei due
                      // sta guardando adesso, dato che il testo introduttivo in cima alla pagina
                      // elenca invece entrambi i turni insieme.
                      <Text size="2xs" className="font-medium text-sky-700">
                        Turno attuale: dalle {finestraAttiva!.apertura} alle {finestraAttiva!.chiusura}.
                      </Text>
                    ) : null}
                    {/* Livello 1 — fasce orarie (es. "12:00-13:00"): tap per espandere/comprimere
                        i singoli orari ogni 15 minuti al suo interno, un accordion alla volta,
                        invece di un'unica griglia lunga con ogni slot tra apertura e chiusura. */}
                    <HStack space="xs" className="flex-wrap">
                      {blocchiOrario.map((blocco) => {
                        const isEspansa = blocco.ora === oraEspansa;
                        const contieneSelezionato = blocco.slots.includes(form.orario);
                        // Se ogni orario da 15 minuti di questa fascia viola l'anticipo minimo
                        // (fascia interamente nel passato/troppo vicina), non ha senso poterla
                        // espandere: non ci sarebbe comunque nulla di selezionabile al suo
                        // interno — stessa "disabled visibile" già usata per i singoli slot, non
                        // nascosta del tutto.
                        const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
                        const tuttiDisabilitati = blocco.slots.every(
                          (slot) =>
                            parseHHMMToMinutes(slot)! < nowMinuti + anticipoMinimoMinuti || isSlotEsaurito(slot)
                        );
                        return (
                          <Pressable
                            key={blocco.ora}
                            onPress={() =>
                              !tuttiDisabilitati &&
                              setOraEspansa((prev) => (prev === blocco.ora ? null : blocco.ora))
                            }
                            disabled={tuttiDisabilitati}
                            accessibilityRole="button"
                            accessibilityLabel={`Fascia oraria ${blocco.label}${tuttiDisabilitati ? ', non più disponibile' : ''}`}
                            accessibilityState={{ expanded: isEspansa, selected: contieneSelezionato, disabled: tuttiDisabilitati }}
                            className={`rounded-full border-2 px-3 py-1.5 ${
                              tuttiDisabilitati
                                ? 'border-sky-100 bg-white opacity-40'
                                : isEspansa
                                  ? 'border-sky-600 bg-sky-600'
                                  : contieneSelezionato
                                    ? 'border-sky-600 bg-white'
                                    : 'border-sky-300 bg-white active:bg-sky-50'
                            }`}
                          >
                            <Text
                              size="xs"
                              className={`font-medium ${
                                tuttiDisabilitati ? 'text-muted-foreground' : isEspansa ? 'text-white' : 'text-sky-900'
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
                    {oraEspansa ? (
                      <HStack space="xs" className="flex-wrap rounded-xl border border-sky-200 bg-sky-50 p-2">
                        {(blocchiOrario.find((b) => b.ora === oraEspansa)?.slots ?? []).map((slot) => {
                          const minutiSlot = parseHHMMToMinutes(slot)!;
                          const nowMinuti = parseHHMMToMinutes(nowHHMM())!;
                          const troppoVicino = minutiSlot < nowMinuti + anticipoMinimoMinuti;
                          const esaurito = !troppoVicino && isSlotEsaurito(slot);
                          const disabilitato = troppoVicino || esaurito;
                          const selezionato = form.orario === slot;
                          const residuo = residuoSlot(slot);
                          const mostraResiduo =
                            !disabilitato && residuo !== null && residuo <= SOGLIA_AVVISO_RESIDUO_ORARIO;
                          return (
                            <VStack key={slot} className="items-center">
                              <Pressable
                                onPress={() => !disabilitato && setField('orario')(slot)}
                                disabled={disabilitato}
                                accessibilityRole="button"
                                accessibilityLabel={`Orario di ritiro ${slot}${esaurito ? ', esaurito: numero massimo di prenotazioni raggiunto per questo orario' : mostraResiduo ? `, solo ${residuo} ${residuo === 1 ? 'posto libero' : 'posti liberi'} per questo orario` : ''}`}
                                className={`rounded-full border-2 px-3 py-1.5 ${
                                  selezionato
                                    ? 'border-sky-600 bg-sky-600'
                                    : disabilitato
                                      ? 'border-sky-100 bg-white opacity-40'
                                      : 'border-sky-300 bg-white active:bg-sky-100'
                                }`}
                              >
                                <Text
                                  size="xs"
                                  className={
                                    selezionato
                                      ? 'font-bold text-white'
                                      : disabilitato
                                        ? 'text-muted-foreground'
                                        : 'font-medium text-sky-900'
                                  }
                                >
                                  {slot}
                                  {esaurito ? ' · Esaurito' : ''}
                                </Text>
                              </Pressable>
                              {/* Didascalia FUORI dal bottone, esattamente sotto — non più un badge
                                  annidato dentro il Pressable (versione precedente, scartata su
                                  richiesta esplicita dell'utente). Font più piccolo del testo dello
                                  slot: "2xs" (`text-2xs`, 12px) era già la taglia minima della scala
                                  `Text`/Tailwind — per scendere sotto quella soglia serve la prop
                                  nativa `style` (qui `fontSize: 9`), non una classe arbitraria
                                  `text-[9px]`: quest'ultima, verificato con Playwright, non viene
                                  applicata da NativeWind/react-native-css (alpha) su questo target
                                  web e in più fa fallire silenziosamente anche le altre classi sullo
                                  stesso elemento (stesso genere di gotcha già noto per altre
                                  proprietà di questa libreria, sezione 4/5 di CLAUDE.md) — `style`
                                  nativo bypassa del tutto quel livello e arriva sempre a
                                  destinazione. */}
                              {mostraResiduo ? (
                                <Text
                                  style={{ fontSize: 9 }}
                                  className={`font-semibold ${residuoTextClassName(residuo!)}`}
                                >
                                  {residuo === 1 ? '1 posto libero' : `${residuo} posti liberi`}
                                </Text>
                              ) : null}
                            </VStack>
                          );
                        })}
                      </HStack>
                    ) : (
                      <Text size="2xs" className="text-sky-900/50">
                        Tocca una fascia oraria per scegliere l'orario esatto.
                      </Text>
                    )}
                    <Text size="2xs" className="text-sky-900/60">
                      Servizio: {descrizioneOrari(configurazione)}.
                    </Text>
                    {limitePrenotazioniOrario !== null ? (
                      <Text size="2xs" className="text-sky-900/60">
                        Alcuni orari accettano solo un numero limitato di prenotazioni.
                      </Text>
                    ) : null}
                    {quantitaPizze > SOGLIA_PIZZE_ANTICIPO_ESTESO ? (
                      <Text size="2xs" className="text-amber-700">
                        🍕 Oltre {SOGLIA_PIZZE_ANTICIPO_ESTESO} pizze: anticipo minimo {ANTICIPO_MINUTI_ESTESO}{' '}
                        minuti (invece di {ANTICIPO_MINUTI_STANDARD}).
                      </Text>
                    ) : (
                      <Text size="2xs" className="text-sky-900/60">
                        Anticipo minimo: {ANTICIPO_MINUTI_STANDARD} minuti.
                      </Text>
                    )}
                  </VStack>
                </VStack>

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
    <FiltriSheet
      isOpen={isFiltriOpen}
      onClose={() => setIsFiltriOpen(false)}
      categorie={categorie}
      allergeni={allergeni}
      categoriaCounts={categoriaCounts}
      allergeneCounts={allergeneCounts}
      prezzoCounts={prezzoCounts}
      filtriCategorie={filtriCategorie}
      filtriAllergeni={filtriAllergeni}
      filtriPrezzo={filtriPrezzo}
      onToggleCategoria={toggleCategoria}
      onToggleAllergene={toggleAllergeneFiltro}
      onTogglePrezzo={togglePrezzo}
      onClear={clearFiltri}
      risultati={prodottiFiltrati.length}
    />
    </>
  );
}
