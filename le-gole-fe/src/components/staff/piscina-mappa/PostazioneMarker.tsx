import { useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { TextStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { Postazione } from '../../../services/struttura';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  MARKER_STYLE,
  TAP_MOVE_THRESHOLD_PX,
  type GazeboGroupInfo,
  type MarkerStyle as MarkerStyleValue,
  type OrientamentoGriglia,
} from '../../../utils/piscinaMappa';

// Un gruppo di gazebo attaccati si disegna come un unico rettangolo: nessun bordo sui lati
// condivisi, solo sul perimetro esterno. Classi scritte per esteso, non interpolate: NativeWind
// scansiona il sorgente alla ricerca di stringhe letterali complete.
function edgeClassName(shape: 'circle' | 'rectangle', groupInfo: GazeboGroupInfo | null | undefined): string {
  const angoli = shape === 'circle' ? 'rounded-full' : 'rounded-md';
  if (!groupInfo || (groupInfo.isFirst && groupInfo.isLast)) {
    return `border-t-2 border-r-2 border-b-2 border-l-2 ${angoli}`;
  }
  if (groupInfo.orientamento === 'verticale') {
    if (groupInfo.isFirst) return 'border-t-2 border-r-2 border-b-0 border-l-2 rounded-t-md';
    if (groupInfo.isLast) return 'border-t-0 border-r-2 border-b-2 border-l-2 rounded-b-md';
    return 'border-t-0 border-r-2 border-b-0 border-l-2 rounded-none';
  }
  if (groupInfo.isFirst) return 'border-t-2 border-r-0 border-b-2 border-l-2 rounded-l-md';
  if (groupInfo.isLast) return 'border-t-2 border-r-2 border-b-2 border-l-0 rounded-r-md';
  return 'border-t-2 border-r-0 border-b-2 border-l-0 rounded-none';
}

// Colori rivisti (2026-09-05), su richiesta esplicita dell'utente — lo schema precedente aveva
// "occupata" in verde e "libera/selezionabile" in ambra: l'esatto contrario dell'aspettativa
// comune (verde = disponibile/positivo, non "già preso da qualcun altro"), e in contrasto con la
// stessa scala cromatica già in uso ovunque nel resto del progetto (verde = confermato/positivo,
// rosa = chiuso/pieno/cancellato — sezioni 2/7/15 di CLAUDE.md). Nuovo schema, coerente con
// quelle convenzioni: libera/selezionabile = verde (disponibile), occupata = rosa (non
// disponibile, stessa famiglia di "giorno pieno"/"cancellata"), selezionata = blu invariato
// (colore d'azione primario in tutto il resto dell'app), neutra (nessun contesto di selezione,
// solo lato staff senza un candidato scelto) = grigio ardesia invece di un blu chiaro facilmente
// confuso con "selezionata".
// Bug corretto (2026-09-12), segnalato dall'utente su Expo Go — attivare la modalità modifica non
// rendeva tratteggiato il bordo di nessuna postazione. Diagnosticato con un indicatore di debug
// temporaneo: `editMode`/`draggable` arrivavano correttamente al marker (confermato da un badge di
// debug e da uno sfondo neon condizionati direttamente su quelle prop) — non era quindi un problema
// di propagazione. Causa reale: Android ha una limitazione nota di React Native per cui
// `borderStyle: 'dashed'`/`'dotted'` non viene disegnato come tale quando l'elemento ha anche
// `borderRadius` (qui sempre presente, `rounded-full`/`rounded-md` in `edgeClassName`) — il
// renderer nativo Android disegna comunque un bordo pieno, ignorando silenziosamente lo stile
// tratteggiato (iOS/web non ne soffrono). Fix: l'indicatore di modalità modifica non è più uno
// stile del bordo (`borderStyle` resta sempre `'solid'`) ma un cambio di colore — `borderColor`
// ambra applicato via `style` inline (bypassa la risoluzione className, stesso principio già in
// uso per `backgroundColor`/altre proprietà critiche su nativo in questo progetto) solo quando
// `draggable` è vero, altrimenti `undefined` per lasciar passare il colore di `stateColorClassName`.
function stateColorClassName(isOccupied: boolean, isSelected: boolean, isSelectable: boolean): string {
  if (isOccupied) return 'border-rose-400 bg-rose-50';
  if (isSelected) return 'border-sky-600 bg-sky-200';
  if (isSelectable) return 'border-emerald-500 bg-emerald-50';
  return 'border-slate-300';
}

// Troncamento manuale invece di `numberOfLines`: su web il Text di gluestack-ui è un <span> e
// non riconosce quella prop RN-only.
function truncateNome(nome: string, maxChars: number): string {
  return nome.length > maxChars ? `${nome.slice(0, maxChars - 1).trimEnd()}…` : nome;
}

// MAI passare un `lineHeight` numerico qui: su web, NativeWind/react-native-css emette
// `line-height: <numero>` senza unità, che il browser interpreta come moltiplicatore del
// font-size (non pixel) — testo che sconfina visivamente nei marker adiacenti.
//
// Bug corretto (2026-09-14), segnalato dall'utente su Android: il "✓" del badge di check-in
// appariva spostato in basso rispetto al cerchio verde, e il nome del cliente dentro un gazebo
// andava a capo rompendo la formattazione del rettangolo. Stessa radice per entrambi, ed è la
// stessa identica già documentata per `NotificaCountBadge` (sezione 11) e per i badge di
// `CalendarPicker` (sezione 5): ogni `Text` di questo file imposta il `fontSize` inline (deve
// scalare con lo zoom) ma NON passava un `size`, quindi ereditava il default `'md'` del componente
// gluestack → `text-base` → in Tailwind v4 `line-height: calc(1.5 / 1)`, un **rapporto**, che su
// nativo react-native-css precalcola in un valore assoluto usando il font-size della classe
// (16px), non il nostro override: un `lineHeight` fisso da ~24px per un testo reso a 7-9px, dentro
// un marker alto 30px. Sul web il browser ricalcola invece il rapporto sul font-size effettivo,
// quindi lì non si è mai visto nulla.
// `size="2xs"` risolve in `text-2xs`, classe inesistente nel progetto: non contribuisce alcun
// font-size/line-height e lascia lo style inline unica fonte di verità su entrambe le piattaforme.
// `includeFontPadding: false`/`textAlignVertical` (Android-only, ignorati altrove) tolgono il
// padding di riga asimmetrico che spingeva il glifo verso il basso dentro un contenitore comunque
// centrato — il difetto del "✓".
// `allowFontScaling={false}`: questi testi vivono dentro una figura geometrica di dimensione fissa
// (30×30 o 48×30 unità logiche) che non può crescere con loro. Con la scala font di sistema
// alzata — impostazione di accessibilità comunissima sui telefoni, assente sul web — il nome
// troncato a `nameLabelMaxChars` smetteva di entrare nella larghezza del gazebo e andava a capo,
// esattamente il secondo difetto segnalato.
const MARKER_TEXT_SIZE = '2xs' as const;

function markerTextStyle(fontSize: number): TextStyle {
  return { fontSize, includeFontPadding: false, textAlignVertical: 'center' };
}

// `numberOfLines` solo su nativo: su web il Text di gluestack-ui è un <span> che non la riconosce
// e la sputa come attributo DOM grezzo (warning React) — stesso motivo per cui il troncamento del
// nome resta comunque manuale (`truncateNome`), qui è solo una garanzia in più che una riga resti
// una riga qualunque cosa accada alle metriche del font.
const SINGLE_LINE_PROPS = Platform.OS === 'web' ? {} : { numberOfLines: 1 as const };

function MarkerLabel({
  isRectangle,
  isOccupied,
  clienteNome,
  style,
  icon,
  numero,
  scale,
}: Readonly<{
  isRectangle: boolean;
  isOccupied: boolean;
  clienteNome: string | undefined;
  style: MarkerStyleValue;
  icon: string;
  numero: number;
  scale: number;
}>) {
  if (isRectangle && isOccupied && clienteNome) {
    return (
      <>
        <Text
          size={MARKER_TEXT_SIZE}
          allowFontScaling={false}
          {...SINGLE_LINE_PROPS}
          className="pointer-events-none select-none font-bold text-rose-900"
          style={markerTextStyle(style.labelFontSize * scale)}
        >
          #{numero}
        </Text>
        <Text
          size={MARKER_TEXT_SIZE}
          allowFontScaling={false}
          {...SINGLE_LINE_PROPS}
          className="pointer-events-none select-none px-0.5 text-center font-semibold text-rose-800"
          style={markerTextStyle((style.labelFontSize - 1) * scale)}
        >
          {truncateNome(clienteNome, style.nameLabelMaxChars)}
        </Text>
      </>
    );
  }
  return (
    <>
      <Text
        size={MARKER_TEXT_SIZE}
        allowFontScaling={false}
        {...SINGLE_LINE_PROPS}
        className="pointer-events-none select-none"
        style={markerTextStyle(style.iconFontSize * scale)}
      >
        {icon}
      </Text>
      <Text
        size={MARKER_TEXT_SIZE}
        allowFontScaling={false}
        {...SINGLE_LINE_PROPS}
        className="pointer-events-none select-none font-bold text-sky-900"
        style={markerTextStyle(style.labelFontSize * scale)}
      >
        #{numero}
      </Text>
    </>
  );
}

// Badge check-in: overlay sibling del marker, non annidato — pointer-events-none.
function ArrivatoBadge({
  left,
  top,
  width,
  scale,
}: Readonly<{ left: number; top: number; width: number; scale: number }>) {
  return (
    <Box
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left + width - 7 * scale,
        top: top - 3 * scale,
        width: 14 * scale,
        height: 14 * scale,
      }}
      className="items-center justify-center rounded-full border-2 border-white bg-emerald-500"
    >
      <Text
        size={MARKER_TEXT_SIZE}
        allowFontScaling={false}
        {...SINGLE_LINE_PROPS}
        className="select-none text-center font-bold text-white"
        style={markerTextStyle(8 * scale)}
      >
        ✓
      </Text>
    </Box>
  );
}

// Cartellino nome cliente sotto l'icona, solo per i marker circolari (ombrellone) — il gazebo
// scrive il nome dentro al rettangolo stesso (MarkerLabel). Sibling assoluto, non interattivo.
function NameTag({
  left,
  top,
  width,
  height,
  style,
  clienteNome,
  scale,
}: Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
  style: MarkerStyleValue;
  clienteNome: string;
  scale: number;
}>) {
  return (
    <Box
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: left + width / 2 - (style.nameLabelWidth * scale) / 2,
        top: top + height + 2,
        width: style.nameLabelWidth * scale,
      }}
      className="items-center"
    >
      <Text
        size={MARKER_TEXT_SIZE}
        allowFontScaling={false}
        {...SINGLE_LINE_PROPS}
        className="select-none rounded-full border border-rose-300 bg-white px-1.5 py-0.5 text-center font-semibold text-rose-800 shadow-sm"
        style={markerTextStyle(style.labelFontSize * scale)}
      >
        {truncateNome(clienteNome, style.nameLabelMaxChars)}
      </Text>
    </Box>
  );
}

// Divisore neutro tra due gazebo della stessa catena, per non rompere l'effetto "rettangolo unico".
function SegmentDivider({
  left,
  top,
  width,
  height,
  orientamento,
  scale,
}: Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
  orientamento: OrientamentoGriglia;
  scale: number;
}>) {
  const style =
    orientamento === 'verticale'
      ? { position: 'absolute' as const, left, top: top + height - scale, width, height: scale }
      : { position: 'absolute' as const, left: left + width - scale, top, width: scale, height };
  return <Box pointerEvents="none" style={style} className="bg-slate-300" />;
}

type PostazioneMarkerProps = {
  postazione: Postazione;
  isOccupied: boolean;
  isSelectable: boolean;
  // Selezionata dal cliente nel flusso self-service — distinta da isSelectable. Mai usata lato staff.
  isSelected?: boolean;
  clienteNome?: string;
  arrivato?: boolean;
  // Solo per i gazebo: posizione di questo segmento dentro una catena attaccata; null se isolato.
  groupInfo?: GazeboGroupInfo | null;
  scale: number;
  // Giorno passato: il tap resta attivo, il trascinamento è sempre disattivato.
  readOnly: boolean;
  // In modalità modifica il marker è trascinabile ma il tap non assegna/consulta più nulla.
  editMode: boolean;
  onPress: () => void;
  onDragEnd: (dxLogical: number, dyLogical: number) => void;
};

// Due percorsi distinti per il drag: Pointer Events su web (già funzionante, mai toccato da
// questa migrazione), `react-native-gesture-handler` su iOS/Android dal 2026-09-13 (sostituisce
// il `PanResponder` legacy, inaffidabile sotto la New Architecture — vedi il commento sul bug
// sotto). Posizione e drag sono in pixel reali (già scalati); la conversione in pos_x/pos_y
// (0-100) avviene solo al rilascio, in onDragEnd.
export function PostazioneMarker({
  postazione,
  isOccupied,
  isSelectable,
  isSelected = false,
  clienteNome,
  arrivato = false,
  groupInfo = null,
  scale,
  readOnly,
  editMode,
  onPress,
  onDragEnd,
}: Readonly<PostazioneMarkerProps>) {
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const dragStateRef = useRef({ startX: 0, startY: 0, moved: false });

  const draggable = editMode && !readOnly;

  // Bug corretto (2026-09-13), segnalato dall'utente su Expo Go dopo che tre fix mirati al
  // `PanResponder` legacy (staleness di chiusura, `borderStyle`, `onPointerDown` condizionale —
  // tutti sopra) e il tentativo con `collapsable={false}` non avevano risolto: il drag restava
  // comunque non funzionante su Android reale, solo su web. Il sistema di responder legacy su cui
  // si basa `PanResponder` ha limiti noti di negoziazione tra view annidate sotto la New
  // Architecture (Fabric) — è proprio il motivo per cui l'ecosistema React Native è passato a
  // `react-native-gesture-handler` per questo esatto scenario (un elemento trascinabile dentro un
  // canvas a sua volta pannabile/zoomabile): a differenza del responder system, i suoi
  // riconoscitori nativi arbitrano correttamente "il figlio vince sul genitore per lo stesso
  // tocco" senza bisogno di alcuna relazione esplicita, proprio la garanzia che serviva qui.
  // Un primo tentativo aveva migrato **solo** questo marker, lasciando `ZoomPanCanvas` sul
  // `PanResponder`, nell'assunzione che i riconoscitori nativi di questa libreria intercettassero il
  // tocco più in basso del responder JS e quindi vincessero comunque sull'antenato. **Assunzione
  // sbagliata, ed è esattamente ciò che teneva in piedi il bug**: nei sorgenti Android di RNGH,
  // `RNGestureHandlerRootHelper.handleSetJSResponder()` chiama `tryCancelAllHandlers()` — concedere il
  // responder legacy a un antenato **annulla tutti gli handler RNGH**, ed è quello che faceva il canvas
  // al touch-down (il suo `onStartShouldSetPanResponder` restituiva `true` su qualunque tocco).
  // `ZoomPanCanvas` è stato quindi migrato anch'esso (stessa data): ora entrambi usano lo stesso motore
  // e l'arbitraggio funziona — RNGH annulla gli handler antenati quando un discendente si attiva, e
  // questo marker si attiva per primo grazie a `.minDistance(0)` contro i ~10dp di soglia di default
  // del Pan del canvas, senza bisogno di relazioni esplicite tra i due componenti.
  // Creato di nuovo ad ogni render (nessun `useRef`/`useMemo`, pattern
  // esplicitamente raccomandato dalla libreria stessa): elimina alla radice la classe di bug di
  // staleness già vista sopra, perché legge sempre `draggable`/`scale`/`onPress`/`onDragEnd` del
  // render corrente, mai valori congelati alla creazione. `.runOnJS(true)` fa girare i callback
  // come normali funzioni JS (nessun worklet Reanimated, nessun `runOnJS()` da importare a parte),
  // stesso modello mentale del vecchio `PanResponder` — solo il motore di riconoscimento cambia.
  // `.minDistance(0)` attiva il riconoscimento fin dal primo evento, così il marker vince sempre la
  // negoziazione con il Pan del canvas. Stessa identica soglia `TAP_MOVE_THRESHOLD_PX`/stessa
  // identica logica di "fuori modifica: il rilascio è sempre un tap, dentro: tap non assegna nulla"
  // del vecchio `PanResponder` — solo l'API di riconoscimento gesto è cambiata, il comportamento
  // resta lo stesso.
  // NB: la parte "il rilascio produce comunque un onEnd anche a movimento zero", su cui questo Pan
  // faceva affidamento per il tap, si è poi rivelata **falsa** — vedi il bug del 2026-09-14 qui
  // sotto: il tap è ora un `Gesture.Tap()` a sé, questo Pan serve solo al trascinamento.
  // Bug corretto (2026-09-14), segnalato dall'utente sulla mappa cliente ("su mobile non riesco a
  // selezionare le postazioni") ma comune a entrambe le mappe: fuori dalla modalità modifica il tap
  // era ricavato dall'`onEnd` del `Gesture.Pan()` qui sopra — e `onEnd` di un Pan viene chiamato
  // **solo se quel Pan si è davvero attivato**. Su un tap pulito (ACTION_DOWN → ACTION_UP senza
  // alcun evento di movimento in mezzo) il riconoscitore Pan non arriva mai allo stato ACTIVE:
  // fallisce e `onEnd` non parte, quindi `onPress()` non viene mai chiamata. `.minDistance(0)`
  // rende l'attivazione possibile fin dal primo movimento, ma non crea un movimento che non c'è —
  // da cui un tap che "a volte" funziona (dito che trema quel tanto da generare un MOVE) e a volte
  // no, e che sul web non si è mai visto perché lì il percorso è un `pointerup` esplicito.
  // Fix: il tap è ora un vero `Gesture.Tap()`, il primitivo giusto per questo gesto. Le due
  // interazioni restano mutuamente esclusive esattamente come prima (fuori dalla modifica si tocca,
  // dentro si trascina e il tap non assegna nulla), quindi il marker monta un solo riconoscitore
  // alla volta — `key` sul GestureDetector per rimontarlo quando la modalità cambia, invece di
  // sostituire a caldo un handler con uno di tipo diverso.
  // `.maxDistance(20)`: un dito che si sposta più di così non è un tap — il riconoscitore fallisce
  // e lascia attivare il Pan del canvas antenato, così trascinare la mappa partendo da sopra un
  // marker ora funziona (prima il gesto restava catturato dal marker, limite noto e accettato).
  // `.maxDuration(1200)`: il default di 500ms scarta un tocco anche solo un po' lento.
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .maxDistance(20)
    .maxDuration(1200)
    .onEnd((_event, success) => {
      if (success) onPress();
    });

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onUpdate((event) => {
      setDrag({ dx: event.translationX, dy: event.translationY });
    })
    .onEnd((event) => {
      const moved =
        Math.abs(event.translationX) > TAP_MOVE_THRESHOLD_PX ||
        Math.abs(event.translationY) > TAP_MOVE_THRESHOLD_PX;
      setDrag({ dx: 0, dy: 0 });
      if (moved) {
        onDragEnd(event.translationX / scale, event.translationY / scale);
      }
    });

  const nativeGesture = draggable ? panGesture : tapGesture;

  const handlePointerDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    // Impedisce all'evento di risalire al canvas: senza, il tap sul marker farebbe partire anche il pan.
    event.stopPropagation?.();
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, moved: false };

    const handleMove = (moveEvent: PointerEvent) => {
      if (!draggable) return;
      const dx = moveEvent.clientX - dragStateRef.current.startX;
      const dy = moveEvent.clientY - dragStateRef.current.startY;
      if (Math.abs(dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(dy) > TAP_MOVE_THRESHOLD_PX) {
        dragStateRef.current.moved = true;
      }
      setDrag({ dx, dy });
    };
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      if (!draggable) {
        onPress();
        return;
      }
      const dx = upEvent.clientX - dragStateRef.current.startX;
      const dy = upEvent.clientY - dragStateRef.current.startY;
      setDrag({ dx: 0, dy: 0 });
      if (dragStateRef.current.moved) {
        onDragEnd(dx / scale, dy / scale);
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const style = MARKER_STYLE[postazione.tipo];
  const isRectangle = style.shape === 'rectangle';
  const width = style.width * scale;
  const height = style.height * scale;
  const left = (postazione.pos_x / 100) * CANVAS_WIDTH * scale - width / 2 + drag.dx;
  const top = (postazione.pos_y / 100) * CANVAS_HEIGHT * scale - height / 2 + drag.dy;
  const icon = postazione.tipo === 'GAZEBO' ? '⛺' : '⛱️';

  const borderClassName = stateColorClassName(isOccupied, isSelected, isSelectable);
  const webCursor: 'pointer' | undefined = Platform.OS === 'web' ? 'pointer' : undefined;
  const effectiveGroupInfo = isRectangle ? groupInfo : null;
  const shapeClassName = edgeClassName(style.shape, effectiveGroupInfo);
  const showDivider = Boolean(isRectangle && effectiveGroupInfo && !effectiveGroupInfo.isLast);

  // Solo nativo, mai su web (`Box` vi è un `<div>` letterale, sezione 4/5 di CLAUDE.md — passarla
  // produrrebbe un attributo DOM sconosciuto): impedisce a Fabric di collassare questo marker
  // (posizionato assoluto) fuori dall'albero nativo — utile sia per l'hit-testing sia perché
  // `GestureDetector` richiede comunque un vero nodo nativo a cui agganciare il riconoscitore.
  const markerBox = (
    <Box
      {...(Platform.OS === 'web' ? { onPointerDown: handlePointerDown } : { collapsable: false })}
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        cursor: webCursor,
        touchAction: Platform.OS === 'web' ? 'none' : undefined,
        // Vedi commento sopra: mai `borderStyle: 'dashed'` (invisibile su Android con
        // borderRadius) — l'indicatore di modalità modifica è un cambio di colore del bordo.
        borderStyle: 'solid',
        borderColor: draggable ? '#f59e0b' : undefined,
      }}
      className={`items-center justify-center bg-white ${shapeClassName} ${borderClassName}`}
    >
      <MarkerLabel
        isRectangle={isRectangle}
        isOccupied={isOccupied}
        clienteNome={clienteNome}
        style={style}
        icon={icon}
        numero={postazione.numero}
        scale={scale}
      />
    </Box>
  );

  return (
    <>
      {Platform.OS === 'web' ? (
        markerBox
      ) : (
        <GestureDetector key={draggable ? 'drag' : 'tap'} gesture={nativeGesture}>
          {markerBox}
        </GestureDetector>
      )}

      {isOccupied && arrivato ? <ArrivatoBadge left={left} top={top} width={width} scale={scale} /> : null}

      {!isRectangle && isOccupied && clienteNome ? (
        <NameTag left={left} top={top} width={width} height={height} style={style} clienteNome={clienteNome} scale={scale} />
      ) : null}

      {showDivider ? (
        <SegmentDivider
          left={left}
          top={top}
          width={width}
          height={height}
          orientamento={effectiveGroupInfo!.orientamento}
          scale={scale}
        />
      ) : null}
    </>
  );
}
