import { useRef, useState } from 'react';
import { PanResponder, Platform } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { Postazione } from '../../../services/struttura';
import { CANVAS_HEIGHT, CANVAS_WIDTH, ICON_SIZE, TAP_MOVE_THRESHOLD_PX } from '../../../utils/piscinaMappa';

// Font-size di base (a zoom 100%) dell'emoji e dell'etichetta numero, scalati con `scale`
// esattamente come le dimensioni dell'icona — altrimenti a zoom diversi da 100% l'icona
// cambierebbe dimensione ma il contenuto testuale al suo interno resterebbe fisso.
const ICON_FONT_SIZE = 20;
const LABEL_FONT_SIZE = 10;
// Larghezza (non scalata con lo zoom, a differenza dei font-size sopra) del cartellino con il
// nome cliente sotto l'icona: renderlo troppo stretto a zoom bassi lo renderebbe illeggibile.
const NAME_LABEL_WIDTH = 88;
const NAME_LABEL_MAX_CHARS = 14;

// Troncamento manuale invece di `numberOfLines`: il componente Text di gluestack-ui ha due
// implementazioni parallele (index.tsx nativo, index.web.tsx un semplice <span>) — su web
// `numberOfLines` non viene riconosciuto e finisce spatasciato come attributo DOM grezzo
// (warning React "does not recognize the numberOfLines prop"). Troncare la stringa qui evita
// del tutto la dipendenza da un comportamento che diverge tra le due piattaforme.
function truncateNome(nome: string): string {
  return nome.length > NAME_LABEL_MAX_CHARS
    ? `${nome.slice(0, NAME_LABEL_MAX_CHARS - 1).trimEnd()}…`
    : nome;
}

type PostazioneMarkerProps = {
  postazione: Postazione;
  isOccupied: boolean;
  isSelectable: boolean;
  // Nome del cliente assegnato, mostrato in un cartellino sotto l'icona quando la postazione è
  // occupata — undefined quando libera.
  clienteNome?: string;
  scale: number;
  // Giorno passato: il tap resta attivo (per consultare l'occupante), ma il trascinamento è
  // disattivato — la posizione è un dato strutturale condiviso da tutte le date, non ha senso
  // spostarla mentre si sta consultando lo storico.
  readOnly: boolean;
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
  clienteNome,
  scale,
  readOnly,
  onPress,
  onDragEnd,
}: Readonly<PostazioneMarkerProps>) {
  const [drag, setDrag] = useState({ dx: 0, dy: 0 });
  const dragStateRef = useRef({ startX: 0, startY: 0, moved: false });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS !== 'web',
      onMoveShouldSetPanResponder: (_, gesture) =>
        Platform.OS !== 'web' &&
        !readOnly &&
        (Math.abs(gesture.dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(gesture.dy) > TAP_MOVE_THRESHOLD_PX),
      onPanResponderMove: (_, gesture) => {
        if (readOnly) return;
        setDrag({ dx: gesture.dx, dy: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (readOnly) {
          onPress();
          return;
        }
        const moved =
          Math.abs(gesture.dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(gesture.dy) > TAP_MOVE_THRESHOLD_PX;
        setDrag({ dx: 0, dy: 0 });
        if (moved) {
          onDragEnd(gesture.dx / scale, gesture.dy / scale);
        } else {
          onPress();
        }
      },
    })
  ).current;

  const handlePointerDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    dragStateRef.current = { startX: event.clientX, startY: event.clientY, moved: false };

    const handleMove = (moveEvent: PointerEvent) => {
      if (readOnly) return;
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
      if (readOnly) {
        onPress();
        return;
      }
      const dx = upEvent.clientX - dragStateRef.current.startX;
      const dy = upEvent.clientY - dragStateRef.current.startY;
      setDrag({ dx: 0, dy: 0 });
      if (dragStateRef.current.moved) {
        onDragEnd(dx / scale, dy / scale);
      } else {
        onPress();
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  };

  const iconSize = ICON_SIZE * scale;
  const left = (postazione.pos_x / 100) * CANVAS_WIDTH * scale - iconSize / 2 + drag.dx;
  const top = (postazione.pos_y / 100) * CANVAS_HEIGHT * scale - iconSize / 2 + drag.dy;
  const icon = postazione.tipo === 'GAZEBO' ? '⛺' : '⛱️';

  return (
    <>
      <Box
        {...(Platform.OS === 'web' ? {} : panResponder.panHandlers)}
        onPointerDown={handlePointerDown}
        style={{
          position: 'absolute',
          left,
          top,
          width: iconSize,
          height: iconSize,
          cursor: Platform.OS === 'web' ? 'pointer' : undefined,
          touchAction: Platform.OS === 'web' ? 'none' : undefined,
        }}
        className={`items-center justify-center rounded-full border-2 bg-white ${
          isOccupied
            ? 'border-emerald-500 bg-emerald-50'
            : isSelectable
              ? 'border-amber-400 bg-amber-50'
              : 'border-sky-300'
        }`}
      >
        {/* pointer-events-none + select-none: senza, un mousedown che parte esattamente sopra
            l'emoji/testo può innescare la selezione/trascinamento nativo del browser invece del
            tap sul marker, rendendo il click sull'icona inaffidabile. */}
        <Text
          className="pointer-events-none select-none"
          style={{ fontSize: ICON_FONT_SIZE * scale }}
        >
          {icon}
        </Text>
        <Text
          className="pointer-events-none select-none font-bold text-sky-900"
          style={{ fontSize: LABEL_FONT_SIZE * scale }}
        >
          #{postazione.numero}
        </Text>
      </Box>

      {/* Cartellino col nome del cliente assegnato, sotto l'icona — sibling assoluto (non
          annidato nel cerchio, troppo piccolo per contenere un nome leggibile), non interattivo
          (pointer-events-none: il tap sulla postazione resta gestito solo dal cerchio sopra) e
          seguendo lo stesso drag temporaneo (`drag.dx/dy`) così non si stacca dal marker mentre
          lo si trascina. */}
      {isOccupied && clienteNome ? (
        <Box
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: left + iconSize / 2 - (NAME_LABEL_WIDTH * scale) / 2,
            top: top + iconSize + 2,
            width: NAME_LABEL_WIDTH * scale,
          }}
          className="items-center"
        >
          <Text
            className="select-none rounded-full border border-emerald-300 bg-white px-1.5 py-0.5 text-center font-semibold text-emerald-800 shadow-sm"
            style={{ fontSize: LABEL_FONT_SIZE * scale }}
          >
            {truncateNome(clienteNome)}
          </Text>
        </Box>
      ) : null}
    </>
  );
}
