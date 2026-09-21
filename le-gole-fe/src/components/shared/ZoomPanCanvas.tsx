import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

// Pan libero (dito/mouse) + pinch a due dita, oltre ai pulsanti +/- esistenti (stesso `scale`
// condiviso). Stesso dual-path di PostazioneMarker: `react-native-gesture-handler` su nativo
// (dal 2026-09-13, prima `PanResponder` — vedi il commento sul gesto sotto), Pointer Events su
// web. Pan/pinch calcolati come delta incrementale rispetto all'ultimo frame, non ancorati al
// punto esatto del gesto.
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

  // Tiene il contenuto sempre almeno parzialmente visibile: centrato se più piccolo del viewport,
  // altrimenti scorrevole fino al bordo ma mai oltre.
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

  // Ri-vincola il pan quando lo zoom cambia, altrimenti il canvas potrebbe restare fuori viewport.
  useEffect(() => {
    setPan((prev) => clampPan(prev, width * scale, height * scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, width, height]);

  // ---- Nativo (iOS/Android): react-native-gesture-handler ----
  // Migrato dal `PanResponder` legacy il 2026-09-13, sesto tentativo sul bug "i marker della mappa
  // piscina non si trascinano su Expo Go". Il tentativo precedente aveva portato a RNGH **solo** il
  // marker, lasciando qui il `PanResponder` — scelta sbagliata, ed è proprio ciò che teneva in piedi
  // il bug: `onStartShouldSetPanResponder` restituiva `true` su qualunque tocco, quindi al touch-down
  // il canvas si prendeva il *JS responder* legacy anche per un tocco iniziato su un marker (che,
  // passato a RNGH, non partecipava più alla negoziazione del responder e non poteva più batterlo
  // come faceva prima). E i due sistemi non convivono: `RNGestureHandlerRootHelper.handleSetJSResponder()`
  // (sorgenti Android della libreria) chiama `tryCancelAllHandlers()` — concedere il responder legacy
  // **annulla tutti gli handler RNGH**, quindi il gesto del marker moriva sul nascere.
  // Ora entrambi usano lo stesso motore e l'arbitraggio torna a funzionare: RNGH annulla gli handler
  // antenati quando un discendente si attiva, e il marker si attiva per primo avendo `.minDistance(0)`
  // contro i ~10dp di soglia di default del Pan di questo canvas — nessuna relazione esplicita
  // (`blocksExternalGesture`/ref condivisi tra i due componenti) necessaria.
  // `.averageTouches(true)`: su Android il Pan userebbe di default il primo dito appoggiato, qui serve
  // invece il centroide, per riprodurre il pan a due dita durante il pinch che il vecchio codice
  // calcolava a mano dal punto medio dei touch.
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .averageTouches(true)
    .onChange((event) => {
      applyPanDelta(event.changeX, event.changeY);
    });

  const pinchGesture = Gesture.Pinch()
    .runOnJS(true)
    .onChange((event) => {
      setScale((s) => clamp(s * event.scaleChange, minScale, maxScale));
    });

  // Simultanei: durante un pinch il contenuto deve poter anche traslare, esattamente come prima.
  const canvasGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  // Web: Pointer Events, uno o più pointer attivi tracciati per id.
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

  // Handler creati una sola volta: addEventListener/removeEventListener devono spaiarsi sulla
  // stessa identità di funzione.
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

  // Il Box di gluestack-ui su web è un <div>: `onLayout` viene ignorato, serve un ResizeObserver.
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

  const canvasBox = (
    <Box
      ref={containerRef}
      className={`relative w-full overflow-hidden ${className ?? ''}`}
      // Bug corretto (2026-09-13), segnalato dall'utente su Expo Go — anche dopo i tre fix già
      // documentati sopra (borderStyle, latestRef, onPointerDown condizionale), il drag restava
      // non funzionante su Android reale. Causa: sotto Fabric (New Architecture) una View puramente
      // di layout/visuale (nessun handler proprio, qui il caso di questo stesso contenitore prima
      // di ricevere i panHandlers, e ancora oggi il caso del Box interno sotto) può venire
      // "collassata" dall'ottimizzazione automatica di Fabric — rimossa dall'albero nativo perché
      // ritenuta superflua — rompendo silenziosamente la catena di negoziazione del responder verso
      // i marker figli posizionati assolutamente al suo interno. `collapsable={false}` (solo
      // nativo: su web `Box` è un `<div>` letterale, sezione 4/5 di CLAUDE.md — passarla lì
      // produrrebbe un attributo DOM sconosciuto e un warning React) forza Fabric a mantenere un
      // vero nodo nativo per questa View, garantendo che l'hit-testing/i responder dei suoi
      // discendenti restino corretti.
      {...(Platform.OS === 'web' ? {} : { collapsable: false })}
      {...(Platform.OS === 'web'
        ? { onPointerDown: handlePointerDown }
        : { onLayout: (e: any) => measure(e.nativeEvent.layout.width, e.nativeEvent.layout.height) })}
      style={{ touchAction: Platform.OS === 'web' ? 'none' : undefined }}
    >
      <Box
        {...(Platform.OS === 'web' ? {} : { collapsable: false })}
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

  // Su web il percorso Pointer Events resta invariato: nessun GestureDetector, che qui non
  // servirebbe e introdurrebbe solo un secondo sistema di gesture su un ramo già funzionante.
  return Platform.OS === 'web' ? canvasBox : <GestureDetector gesture={canvasGesture}>{canvasBox}</GestureDetector>;
}
