import { useRef, useState } from 'react';
import { PanResponder, Platform } from 'react-native';
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

// Bordo/arrotondamento per singolo segmento di un rettangolo gazebo (sezione 5 CLAUDE.md,
// 2026-08-13): un gruppo di N gazebo attaccati si disegna come un unico rettangolo allungato — un
// solo bordo esterno spesso 2px sul perimetro della striscia, NESSUN bordo (larghezza 0, non solo
// più sottile) sui lati condivisi con il segmento adiacente, così il colore di sfondo continua
// senza soluzione di continuità da un segmento all'altro. Un divisore sottile separato (SegmentDivider
// sotto) marca comunque dove finisce un gazebo e inizia il successivo. Un gazebo isolato (groupInfo
// null, o isFirst===isLast===true) e il cerchio ombrellone (sempre groupInfo null) restano bordati
// su tutti e quattro i lati come prima — nessuna regressione per quei casi.
// Combinazioni scritte per esteso (non composte con interpolazione di frammenti): NativeWind/
// Tailwind scansiona il sorgente alla ricerca di stringhe di classe letterali complete, un
// `border-t-${x}` costruito a runtime non verrebbe rilevato dallo scanner.
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

// Colore bordo/sfondo in base allo stato — libero/occupato/selezionato/selezionabile, più il
// tratteggio quando il marker è trascinabile (modalità modifica). Estratto a parte per lo stesso
// motivo di edgeClassName sopra: tenere il componente principale più semplice da seguire.
function stateColorClassName(
  isOccupied: boolean,
  isSelected: boolean,
  isSelectable: boolean,
  draggable: boolean
): string {
  let colore = 'border-sky-300';
  if (isOccupied) {
    colore = 'border-emerald-500 bg-emerald-50';
  } else if (isSelected) {
    colore = 'border-sky-600 bg-sky-200';
  } else if (isSelectable) {
    colore = 'border-amber-400 bg-amber-50';
  }
  // In modalità modifica il marker diventa trascinabile: un bordo tratteggiato distingue a colpo
  // d'occhio le postazioni "in editing" da quelle normali, senza dover leggere alcun testo.
  return draggable ? `${colore} border-dashed` : colore;
}

// Troncamento manuale invece di `numberOfLines`: il componente Text di gluestack-ui ha due
// implementazioni parallele (index.tsx nativo, index.web.tsx un semplice <span>) — su web
// `numberOfLines` non viene riconosciuto e finisce spatasciato come attributo DOM grezzo
// (warning React "does not recognize the numberOfLines prop"). Troncare la stringa qui evita
// del tutto la dipendenza da un comportamento che diverge tra le due piattaforme. `maxChars`
// dipende dal tipo di postazione (MARKER_STYLE, sezione 5 CLAUDE.md) — un ombrellone ha un
// cartellino più largo di un gazebo, quindi ammette qualche carattere in più prima di troncare.
function truncateNome(nome: string, maxChars: number): string {
  return nome.length > maxChars ? `${nome.slice(0, maxChars - 1).trimEnd()}…` : nome;
}

// Contenuto testuale dentro al marker — estratto a parte per tenere la logica di rendering del
// marker principale più semplice da seguire (il componente principale gestisce già da solo tap/
// drag su due piattaforme, sezione 5 CLAUDE.md).
//
// Gotcha scoperto verificando i gazebo attaccati (2026-08-13) — MAI passare un `lineHeight`
// NUMERICO uguale/vicino al fontSize in questo file: su web, NativeWind/react-native-css (alpha,
// sezione 4 CLAUDE.md) emette `line-height: <numero>` SENZA unità nel CSS finale, e senza unità
// il browser lo interpreta secondo lo standard CSS come un MOLTIPLICATORE del font-size, non come
// pixel — `lineHeight: 9` con `fontSize: 8` diventa quindi `line-height: 72px` (9× l'atteso), non
// gestibile su React Native nativo (dove lineHeight è sempre in dp). Effetto osservato: il nome
// cliente dentro un gazebo occupato riempiva un riquadro di testo alto 72px invece di ~9px,
// sconfinando visivamente nei gazebo adiacenti della stessa colonna. Nessun altro Text di questo
// file imposta `lineHeight` esplicito (il default del browser/RN basta), fix applicato rimuovendo
// la prop invece di provare a "correggere" il numero (qualunque valore numerico diretto sarebbe
// comunque a rischio della stessa interpretazione errata).
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
    // Rettangolo occupato: numero + nome cliente scritti DENTRO al rettangolo (non in un
    // cartellino esterno sotto, a differenza del cerchio) — quando più gazebi sono "attaccati" in
    // colonna (passo esatto, nessun margine) un cartellino esterno sotto l'icona finirebbe
    // coperto dal gazebo immediatamente successivo nella striscia.
    return (
      <>
        <Text
          className="pointer-events-none select-none font-bold text-emerald-900"
          style={{ fontSize: style.labelFontSize * scale }}
        >
          #{numero}
        </Text>
        <Text
          className="pointer-events-none select-none px-0.5 text-center font-semibold text-emerald-800"
          style={{ fontSize: (style.labelFontSize - 1) * scale }}
        >
          {truncateNome(clienteNome, style.nameLabelMaxChars)}
        </Text>
      </>
    );
  }
  return (
    <>
      <Text className="pointer-events-none select-none" style={{ fontSize: style.iconFontSize * scale }}>
        {icon}
      </Text>
      <Text
        className="pointer-events-none select-none font-bold text-sky-900"
        style={{ fontSize: style.labelFontSize * scale }}
      >
        #{numero}
      </Text>
    </>
  );
}

// Badge check-in: overlay in alto a destra sul marker, non annidato al suo interno — sibling
// assoluto, pointer-events-none (il tap resta gestito solo dal marker). Anello bianco per
// "ritagliarlo" dal bordo sottostante, stesso effetto già usato per i badge conteggio di
// CalendarPicker (sezione 5).
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
      <Text className="select-none font-bold text-white" style={{ fontSize: 8 * scale }}>
        ✓
      </Text>
    </Box>
  );
}

// Cartellino col nome del cliente assegnato, sotto l'icona — solo per i marker circolari
// (ombrellone): il nome dei gazebo occupati sta invece dentro al rettangolo stesso (MarkerLabel
// sopra), per non rischiare di finire coperto dal marker successivo in una striscia attaccata.
// Sibling assoluto (non annidato nel cerchio, troppo piccolo per contenere un nome leggibile), non
// interattivo (pointer-events-none) e segue lo stesso drag temporaneo del marker così non si
// stacca mentre lo si trascina (il chiamante passa left/top già comprensivi del drag in corso).
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
        className="select-none rounded-full border border-emerald-300 bg-white px-1.5 py-0.5 text-center font-semibold text-emerald-800 shadow-sm"
        style={{ fontSize: style.labelFontSize * scale }}
      >
        {truncateNome(clienteNome, style.nameLabelMaxChars)}
      </Text>
    </Box>
  );
}

// Divisore sottile tra questo gazebo e il successivo della catena (sezione 5 CLAUDE.md,
// 2026-08-13) — un tratto leggero e neutro (non colorato in base allo stato, a differenza del
// bordo esterno del gruppo, sempre lo stesso indipendentemente da occupato/selezionabile/ecc.) che
// marca solo il confine tra due segmenti, mantenendo l'aspetto complessivo di un unico rettangolo
// allungato invece di N riquadri separati. pointer-events-none: il tap resta gestito solo dai
// marker sottostanti.
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
  // Selezionata dal cliente nel flusso self-service (Area Cliente): evidenziazione distinta da
  // isSelectable (che marca solo "disponibile a essere scelta", non "già scelta ora"). Mai usata
  // lato staff, che non ha un concetto di selezione persistente sul marker — default false, nessun
  // impatto sul suo aspetto/comportamento esistente.
  isSelected?: boolean;
  // Nome del cliente assegnato, mostrato in un cartellino sotto l'icona quando la postazione è
  // occupata — undefined quando libera.
  clienteNome?: string;
  // Check-in manuale del cliente assegnato (OccupazionePostazione.arrivato) — mostra un badge
  // verde sul marker, per vedere a colpo d'occhio chi è già arrivato senza aprire ogni foglio.
  arrivato?: boolean;
  // Solo per i gazebo (sezione 5 CLAUDE.md, 2026-08-13): posizione di questo segmento dentro una
  // catena di gazebo attaccati (calcolata da groupGazeboAttaccati, puramente geometrica) — null
  // per un ombrellone o un gazebo isolato, che si comportano come un riquadro singolo normale.
  groupInfo?: GazeboGroupInfo | null;
  scale: number;
  // Giorno passato: il tap resta attivo (per consultare l'occupante), ma il trascinamento è
  // sempre disattivato — la posizione è un dato strutturale condiviso da tutte le date, non ha
  // senso spostarla mentre si sta consultando lo storico (a prescindere da `editMode`).
  readOnly: boolean;
  // Modalità modifica posizioni (mappa staff, sezione 5 CLAUDE.md): quando true il marker è
  // trascinabile ma il tap non assegna/consulta più nulla (nessuna onPress) — l'assegnazione
  // cliente e la modifica posizione sono due interazioni mutuamente esclusive sullo stesso gesto
  // di tap, quindi non possono restare entrambe attive sullo stesso marker.
  editMode: boolean;
  onPress: () => void;
  onDragEnd: (dxLogical: number, dyLogical: number) => void;
};

// react-native-web (versione in uso) non implementa più il sistema di responder legacy
// su cui si basa PanResponder: su web gli handler onStartShouldSetResponder/onMoveShouldSetResponder/ecc.
// vengono ignorati (nessun tap, nessun drag). Il marker usa quindi due percorsi distinti:
// Pointer Events (window) su web, PanResponder nativo su iOS/Android.
//
// Sia la posizione del marker sia lo spostamento durante il drag sono calcolati in pixel
// REALI (già scalati, la stessa unità di `MappaCanvas`, che dimensiona il canvas come
// `CANVAS_WIDTH * scale`) — il drag quindi segue il dito/puntatore 1:1 a qualunque zoom. La
// conversione in unità logiche (percentuali 0-100 di `pos_x`/`pos_y`) avviene una sola volta,
// al rilascio, tramite `onDragEnd`.
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

  // Trascinabile solo in modalità modifica e mai su un giorno passato. Quando NON è trascinabile
  // (mappa in modalità assegnazione normale, oppure consultazione di sola lettura) il tap apre
  // sempre onPress: non essendoci alcun drag possibile, non serve distinguere tap da spostamento.
  const draggable = editMode && !readOnly;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS !== 'web',
      onMoveShouldSetPanResponder: (_, gesture) =>
        Platform.OS !== 'web' &&
        draggable &&
        (Math.abs(gesture.dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(gesture.dy) > TAP_MOVE_THRESHOLD_PX),
      onPanResponderMove: (_, gesture) => {
        if (!draggable) return;
        setDrag({ dx: gesture.dx, dy: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (!draggable) {
          onPress();
          return;
        }
        const moved =
          Math.abs(gesture.dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(gesture.dy) > TAP_MOVE_THRESHOLD_PX;
        setDrag({ dx: 0, dy: 0 });
        // In modalità modifica un tap senza spostamento non fa nulla (niente assegnazione): il
        // marker non è "in consultazione", è "in editing", e qui non c'è nulla da consultare.
        if (moved) {
          onDragEnd(gesture.dx / scale, gesture.dy / scale);
        }
      },
    })
  ).current;

  const handlePointerDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    // Impedisce all'evento di risalire fino al canvas della mappa (ZoomPanCanvas, sezione 5): senza,
    // il tap/drag su un marker verrebbe interpretato anche come l'inizio di un pan della mappa.
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
      // Nessun else: in modalità modifica un tap senza spostamento non deve assegnare nulla.
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

  const borderClassName = stateColorClassName(isOccupied, isSelected, isSelectable, draggable);
  // I tipi di RN per `cursor` ammettono solo 'auto' | 'pointer' (react-native-web supporta in
  // realtà qualunque valore CSS, es. 'grab', ma non è tipizzato) — il bordo tratteggiato sopra
  // resta l'indicatore principale di "questo marker è trascinabile ora".
  const webCursor: 'pointer' | undefined = Platform.OS === 'web' ? 'pointer' : undefined;
  // groupInfo ha senso solo per un rettangolo (gazebo) — un cerchio (ombrellone) non partecipa mai
  // a un gruppo, a prescindere da cosa arrivi nella prop (mai passata per quel tipo comunque).
  const effectiveGroupInfo = isRectangle ? groupInfo : null;
  const shapeClassName = edgeClassName(style.shape, effectiveGroupInfo);
  const showDivider = Boolean(isRectangle && effectiveGroupInfo && !effectiveGroupInfo.isLast);

  return (
    <>
      <Box
        {...(Platform.OS === 'web' ? {} : panResponder.panHandlers)}
        onPointerDown={handlePointerDown}
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          cursor: webCursor,
          touchAction: Platform.OS === 'web' ? 'none' : undefined,
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
