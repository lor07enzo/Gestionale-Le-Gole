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
  return draggable ? `${colore} border-dashed` : colore;
}

// Troncamento manuale invece di `numberOfLines`: su web il Text di gluestack-ui è un <span> e
// non riconosce quella prop RN-only.
function truncateNome(nome: string, maxChars: number): string {
  return nome.length > maxChars ? `${nome.slice(0, maxChars - 1).trimEnd()}…` : nome;
}

// MAI passare un `lineHeight` numerico qui: su web, NativeWind/react-native-css emette
// `line-height: <numero>` senza unità, che il browser interpreta come moltiplicatore del
// font-size (non pixel) — testo che sconfina visivamente nei marker adiacenti.
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
      <Text className="select-none font-bold text-white" style={{ fontSize: 8 * scale }}>
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
        className="select-none rounded-full border border-emerald-300 bg-white px-1.5 py-0.5 text-center font-semibold text-emerald-800 shadow-sm"
        style={{ fontSize: style.labelFontSize * scale }}
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

// react-native-web non implementa il responder system legacy su cui si basa PanResponder: due
// percorsi distinti, Pointer Events su web, PanResponder nativo su iOS/Android. Posizione e
// drag sono in pixel reali (già scalati); la conversione in pos_x/pos_y (0-100) avviene solo
// al rilascio, in onDragEnd.
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
        if (moved) {
          onDragEnd(gesture.dx / scale, gesture.dy / scale);
        }
      },
    })
  ).current;

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

  const borderClassName = stateColorClassName(isOccupied, isSelected, isSelectable, draggable);
  const webCursor: 'pointer' | undefined = Platform.OS === 'web' ? 'pointer' : undefined;
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
