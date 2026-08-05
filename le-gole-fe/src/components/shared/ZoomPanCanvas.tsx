import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { PanResponder, Platform } from 'react-native';
import { Box } from '@/components/ui/box';
import { clamp } from '../../utils/piscinaMappa';

type ZoomPanCanvasProps = {
  width: number;
  height: number;
  scale: number;
  setScale: Dispatch<SetStateAction<number>>;
  minScale: number;
  maxScale: number;
  // Classi aggiuntive per il viewport esterno (es. l'altezza fissa) — il componente aggiunge
  // sempre `relative w-full overflow-hidden` di suo.
  className?: string;
  children: ReactNode;
};

type PointerPoint = { x: number; y: number };

// Sostituisce le due ScrollView annidate (orizzontale + verticale) usate in precedenza per il pan
// della mappa piscina (staff e cliente): su schermi piccoli le scrollbar/i "rimbalzi" di scroll
// rendevano la navigazione scomoda, soprattutto insieme allo zoom. Qui il pan è un vero
// trascinamento libero (un dito/il mouse ovunque sull'area vuota del canvas) e lo zoom supporta
// anche il pinch a due dita, oltre ai pulsanti +/- già esistenti (ZoomControls) — entrambi
// aggiornano lo stesso `scale` passato dal chiamante, quindi restano sempre in sincronia.
//
// Stesso principio dual-path già usato in PostazioneMarker (sezione 5 CLAUDE.md): PanResponder
// per nativo, Pointer Events per web (react-native-web non implementa più il responder system
// legacy su cui si basa PanResponder). Il pan/pinch sono calcolati in modo incrementale
// (delta rispetto all'ultimo frame, non rispetto all'inizio del gesto): evita di dover conoscere
// la posizione assoluta del viewport sullo schermo, al costo di non ancorare perfettamente lo
// zoom al punto esatto del pinch — stesso comportamento "non ancorato" già dei pulsanti +/-
// esistenti, quindi nessuna regressione percepibile.
export function ZoomPanCanvas({
  width,
  height,
  scale,
  setScale,
  minScale,
  maxScale,
  className,
  children,
}: Readonly<ZoomPanCanvasProps>) {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerSizeRef = useRef({ width: 0, height: 0 });
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Tiene il contenuto sempre almeno parzialmente visibile: se è più piccolo del viewport su un
  // asse lo centra (min === max, nessun margine di pan su quell'asse), altrimenti consente di
  // scorrere fino al bordo del canvas ma mai oltre.
  function clampPan(next: PointerPoint, contentWidth: number, contentHeight: number): PointerPoint {
    const { width: vw, height: vh } = containerSizeRef.current;
    if (!vw || !vh) return next;
    const minX = Math.min(0, vw - contentWidth);
    const maxX = contentWidth < vw ? (vw - contentWidth) / 2 : 0;
    const minY = Math.min(0, vh - contentHeight);
    const maxY = contentHeight < vh ? (vh - contentHeight) / 2 : 0;
    return { x: clamp(next.x, minX, maxX), y: clamp(next.y, minY, maxY) };
  }

  function applyPanDelta(dx: number, dy: number) {
    setPan((prev) =>
      clampPan({ x: prev.x + dx, y: prev.y + dy }, width * scaleRef.current, height * scaleRef.current)
    );
  }

  // Ri-vincola il pan quando lo zoom cambia (pulsanti o pinch): senza, uscendo in zoom-out da un
  // pan vicino al bordo il canvas potrebbe restare parzialmente fuori dal viewport.
  useEffect(() => {
    setPan((prev) => clampPan(prev, width * scale, height * scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, width, height]);

  // ---- Nativo (iOS/Android): PanResponder, un dito pan / due dita pinch-zoom ----
  const nativeGesture = useRef({ touchCount: 0, x: 0, y: 0, dist: 0, midX: 0, midY: 0 });

  function baselineFromTouches(touches: any[]) {
    nativeGesture.current.touchCount = touches.length;
    if (touches.length >= 2) {
      const [a, b] = touches;
      nativeGesture.current.dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
      nativeGesture.current.midX = (a.pageX + b.pageX) / 2;
      nativeGesture.current.midY = (a.pageY + b.pageY) / 2;
    } else if (touches.length === 1) {
      nativeGesture.current.x = touches[0].pageX;
      nativeGesture.current.y = touches[0].pageY;
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Platform.OS !== 'web',
      onMoveShouldSetPanResponder: (evt) => Platform.OS !== 'web' && evt.nativeEvent.touches.length >= 1,
      onPanResponderGrant: (evt) => baselineFromTouches(evt.nativeEvent.touches),
      onPanResponderMove: (evt) => {
        const touches = evt.nativeEvent.touches;
        // Numero di dita cambiato a metà gesto (dito aggiunto/tolto): ri-azzera il riferimento
        // invece di calcolare un delta rispetto a un frame con un numero di tocchi diverso.
        if (touches.length !== nativeGesture.current.touchCount) {
          baselineFromTouches(touches);
          return;
        }
        if (touches.length >= 2) {
          const [a, b] = touches;
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          const midX = (a.pageX + b.pageX) / 2;
          const midY = (a.pageY + b.pageY) / 2;
          if (nativeGesture.current.dist > 0) {
            const factor = dist / nativeGesture.current.dist;
            setScale((s) => clamp(s * factor, minScale, maxScale));
          }
          applyPanDelta(midX - nativeGesture.current.midX, midY - nativeGesture.current.midY);
          nativeGesture.current.dist = dist;
          nativeGesture.current.midX = midX;
          nativeGesture.current.midY = midY;
        } else if (touches.length === 1) {
          applyPanDelta(touches[0].pageX - nativeGesture.current.x, touches[0].pageY - nativeGesture.current.y);
          nativeGesture.current.x = touches[0].pageX;
          nativeGesture.current.y = touches[0].pageY;
        }
      },
      onPanResponderRelease: () => {
        nativeGesture.current.touchCount = 0;
      },
      onPanResponderTerminate: () => {
        nativeGesture.current.touchCount = 0;
      },
    })
  ).current;

  // ---- Web: Pointer Events, uno o più pointer attivi tracciati per id ----
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const webGestureRef = useRef<{ dist?: number; midX?: number; midY?: number; x?: number; y?: number }>({});
  const listenersAttachedRef = useRef(false);

  function updateFromPointers() {
    const pts = Array.from(pointersRef.current.values());
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (webGestureRef.current.dist) {
        const factor = dist / webGestureRef.current.dist;
        setScale((s) => clamp(s * factor, minScale, maxScale));
        applyPanDelta(midX - (webGestureRef.current.midX ?? midX), midY - (webGestureRef.current.midY ?? midY));
      }
      webGestureRef.current = { dist, midX, midY };
    } else if (pts.length === 1) {
      const [p] = pts;
      if (webGestureRef.current.x !== undefined && webGestureRef.current.y !== undefined) {
        applyPanDelta(p.x - webGestureRef.current.x, p.y - webGestureRef.current.y);
      }
      webGestureRef.current = { x: p.x, y: p.y };
    } else {
      webGestureRef.current = {};
    }
  }

  // Handler creati una sola volta (lazy ref, non ad ogni render): addEventListener/removeEventListener
  // devono spaiarsi sulla STESSA identità di funzione, altrimenti il listener non viene mai rimosso.
  const handlersRef = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void } | null>(null);
  if (!handlersRef.current) {
    handlersRef.current = {
      move: (event: PointerEvent) => {
        if (!pointersRef.current.has(event.pointerId)) return;
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        updateFromPointers();
      },
      up: (event: PointerEvent) => {
        pointersRef.current.delete(event.pointerId);
        updateFromPointers();
        if (pointersRef.current.size === 0 && listenersAttachedRef.current) {
          listenersAttachedRef.current = false;
          window.removeEventListener('pointermove', handlersRef.current!.move);
          window.removeEventListener('pointerup', handlersRef.current!.up);
          window.removeEventListener('pointercancel', handlersRef.current!.up);
        }
      },
    };
  }

  const handlePointerDown = (event: any) => {
    if (Platform.OS !== 'web') return;
    event.preventDefault?.();
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    updateFromPointers();
    if (!listenersAttachedRef.current) {
      listenersAttachedRef.current = true;
      window.addEventListener('pointermove', handlersRef.current!.move);
      window.addEventListener('pointerup', handlersRef.current!.up);
      window.addEventListener('pointercancel', handlersRef.current!.up);
    }
  };

  function measure(measuredWidth: number, measuredHeight: number) {
    containerSizeRef.current = { width: measuredWidth, height: measuredHeight };
    setPan((prev) => clampPan(prev, width * scaleRef.current, height * scaleRef.current));
  }

  // Il Box di gluestack-ui su web è un <div> semplice (component/ui/box/index.web.tsx), non il
  // View di react-native-web: `onLayout` viene ignorato lì (solo un warning React in console),
  // quindi su web la dimensione del viewport va misurata a parte con un ResizeObserver sul ref
  // del nodo DOM reale — `onLayout` resta il percorso corretto ed effettivo solo su nativo.
  const containerRef = useRef<any>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as HTMLElement | null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      measure(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Box
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className ?? ''}`}
      {...(Platform.OS === 'web'
        ? {}
        : {
            onLayout: (e: any) => measure(e.nativeEvent.layout.width, e.nativeEvent.layout.height),
            ...panResponder.panHandlers,
          })}
      onPointerDown={handlePointerDown}
      style={{ touchAction: Platform.OS === 'web' ? 'none' : undefined }}
    >
      <Box
        style={{
          position: 'absolute',
          left: pan.x,
          top: pan.y,
          width: width * scale,
          height: height * scale,
        }}
        className="bg-sky-50"
      >
        {children}
      </Box>
    </Box>
  );
}
