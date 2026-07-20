import { useRef, useState } from 'react';
import { PanResponder, Platform } from 'react-native';
import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';
import type { Postazione } from '../../../services/struttura';
import { CANVAS_HEIGHT, CANVAS_WIDTH, ICON_SIZE, TAP_MOVE_THRESHOLD_PX } from '../../../utils/piscinaMappa';

type PostazioneMarkerProps = {
  postazione: Postazione;
  isOccupied: boolean;
  isSelectable: boolean;
  scale: number;
  onPress: () => void;
  onDragEnd: (dxLogical: number, dyLogical: number) => void;
};

// react-native-web (versione in uso) non implementa più il sistema di responder legacy
// su cui si basa PanResponder: su web gli handler onStartShouldSetResponder/onMoveShouldSetResponder/ecc.
// vengono ignorati (nessun tap, nessun drag). Il marker usa quindi due percorsi distinti:
// Pointer Events (window) su web, PanResponder nativo su iOS/Android.
export function PostazioneMarker({
  postazione,
  isOccupied,
  isSelectable,
  scale,
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
        (Math.abs(gesture.dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(gesture.dy) > TAP_MOVE_THRESHOLD_PX),
      onPanResponderMove: (_, gesture) => {
        setDrag({ dx: gesture.dx / scale, dy: gesture.dy / scale });
      },
      onPanResponderRelease: (_, gesture) => {
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
      const dx = moveEvent.clientX - dragStateRef.current.startX;
      const dy = moveEvent.clientY - dragStateRef.current.startY;
      if (Math.abs(dx) > TAP_MOVE_THRESHOLD_PX || Math.abs(dy) > TAP_MOVE_THRESHOLD_PX) {
        dragStateRef.current.moved = true;
      }
      setDrag({ dx: dx / scale, dy: dy / scale });
    };
    const handleUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
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

  const left = (postazione.pos_x / 100) * CANVAS_WIDTH - ICON_SIZE / 2 + drag.dx;
  const top = (postazione.pos_y / 100) * CANVAS_HEIGHT - ICON_SIZE / 2 + drag.dy;
  const icon = postazione.tipo === 'GAZEBO' ? '⛺' : '⛱️';

  return (
    <Box
      {...(Platform.OS === 'web' ? {} : panResponder.panHandlers)}
      onPointerDown={handlePointerDown}
      style={{
        position: 'absolute',
        left,
        top,
        width: ICON_SIZE,
        height: ICON_SIZE,
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
      <Text size="md" className="pointer-events-none select-none">
        {icon}
      </Text>
      <Text size="2xs" className="pointer-events-none select-none font-bold text-sky-900">
        #{postazione.numero}
      </Text>
    </Box>
  );
}
