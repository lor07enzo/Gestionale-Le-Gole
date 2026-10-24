# Trappole nativo ↔ web (tutte già incontrate)

Regola generale: per qualunque colore, dimensione o proprietà flex **critica** su un componente piccolo, usa un valore letterale in `style={{…}}`. NativeWind v5 / react-native-css (alpha) risolve in modo inaffidabile su nativo alcune classi e variabili CSS.

## Stile e testo
- `bg-background`, `border-border`, `border-destructive/40`, `border-sky-300` (oklch) possono non risolversi: usa `#eae0c8`, `#e5e5e5`, `#7dd3fc`, `rgba(231,0,11,0.4)` inline. `bg-white` funziona.
- `Text size="2xs"` → `text-2xs` **non esiste**: nessuna dimensione applicata. Per testo < 12px: `style={{ fontSize: N }}` **più** `size="2xs"` esplicito (così non arriva il `lineHeight` a rapporto di `text-base`, che su nativo diventa ~24px fissi), più `includeFontPadding: false` e `textAlignVertical: 'center'` per centrare un glifo in un badge (vedi `NotificaCountBadge`, `markerTextStyle` in `PostazioneMarker`).
- Mai `lineHeight` numerico inline: sul web viene emesso senza unità = moltiplicatore (9 → 72px).
- Classi arbitrarie `text-[9px]` possono rompere il parsing dell'intera className: usa `style`.
- Mai `className="text-…"` di colore su `Spinner`: crash nativo. Usa la prop `color`.
- `borderStyle: 'dashed'` + `borderRadius` su Android si disegna pieno: segnala lo stato col colore.
- RN ha `flexShrink: 0` di default: un `Text` in riga va a capo solo con `{ flex: 1, flexShrink: 1 }` inline (vedi `ClienteFooter`), altrimenti viene tagliato dal `borderRadius` del genitore.
- Testi dentro figure di dimensione fissa: `allowFontScaling={false}`.
- `numberOfLines`: il `Text` web di gluestack è uno `<span>` e la passa al DOM (warning). Tronca a mano o passala solo su nativo.
- Classi che usano variabili (es. `shadow-sm`) aggiunte/tolte dopo il primo render fanno rimontare il componente: tienile in entrambi gli stati o in nessuno.
- Ombra/stacking: un `Image` web dipinge su un div a `z-index:-1`; il contenitore `relative` deve avere anche `z-0`, altrimenti l'immagine sparisce.
- `Button disabled` blocca il tap ma non sbiadisce: passa anche `isDisabled`.
- Icone: `components/ui/icon/index.tsx` (nativo) **e** `index.web.tsx` (web). Una nuova icona va aggiunta in entrambi, altrimenti sul web è invisibile senza errori.
- `Box` web è un `<div>` letterale: `onLayout`, `nativeID`, `collapsable` non funzionano lì; il `ref` sì (usa `Box`, non `VStack`, quando ti serve il nodo DOM). Misura sul web con `ResizeObserver`.

## Gesti
- Mappa piscina e `ZoomPanCanvas` usano **react-native-gesture-handler** su nativo, Pointer Events su web. Mai mescolare con `PanResponder` sullo stesso ramo di tocco: il responder legacy dell'antenato cancella gli handler RNGH del discendente.
- Tap = `Gesture.Tap()` (`maxDistance(20)`, `maxDuration(1200)`), non l'`onEnd` di un `Pan` (su un tap pulito il Pan non si attiva). Un solo riconoscitore per volta + `key` sul `GestureDetector` al cambio modalità.
- Gesture create a ogni render (niente `useRef(PanResponder.create)` con closure stantie). `.runOnJS(true)`.
- `onPointerDown` solo dentro lo spread `Platform.OS === 'web'`; su nativo interferisce con Fabric.
- Su web i marker fanno `stopPropagation()` per non panare il canvas.
- `GestureHandlerRootView` è il wrapper più esterno di `app/_layout.tsx`, con `import 'react-native-gesture-handler'` come prima riga.

## Scroll e posizionamento
- `scrollIntoView`/`IntersectionObserver`/`web:sticky`/`web:fixed` esistono solo sul web. Ramo nativo: `node.measureLayout(scrollViewRef.current, ok, ko)` (passa il **ref**, non `findNodeHandle`: Fabric lo rifiuta) + `scrollTo`; scroll-spy con cache delle Y rimisurata in `onContentSizeChange` e confronto in `onScroll` (`scrollEventThrottle={100}`).
- Sticky nativo: `stickyHeaderIndices` (richiede un figlio diretto della ScrollView) oppure copia sovrapposta `position:'absolute'` mostrata quando la barra in linea esce. **Mai un `Modal`** per un overlay non bloccante (finestra separata su Android).
- Flottanti: `web:fixed native:absolute`.
- Scroll di una barra di chip orizzontale: `scrollBy` sul solo contenitore orizzontale (vedi `scrollChipIntoView`), mai `scrollIntoView` sul chip (interrompe lo scroll verticale).
- Durante uno scroll programmato sospendi lo scroll-spy (~700ms, `suppressObserverUntilRef`).
- Ref-callback con effetti sul `null`: memoizzala con `useCallback` (React la richiama a ogni render).
- Scrollbar web che mangia il padding destro: `scrollbarGutter: 'stable'` (cast `as unknown as ViewStyle`).
- `items-center` su un genitore rompe il full-bleed del footer: centra i figli con `self-center`.
- Sul web lo scroll avviene su un `div` interno, non su `window` (rilevante negli script di verifica).

## Moduli nativi
- `expo-notifications` lancia all'import in Expo Go Android: si carica con `require` lazy e no-op se `Constants.executionEnvironment === 'storeClient'`. Push testabili solo su dev build/APK.
- `react-native-paper(-dates)` caricati con `import()` dinamico in `app/cliente/_layout.tsx` (riduce l'impatto del bug Metro FlatList).
- Upload foto: su web l'URI va convertito in `Blob` con `fetch` prima del `FormData`.
- PDF: `apriBigliettoPdf(url, id, prefix)` — web `window.open`, nativo `File.downloadFileAsync` + `Sharing`.
- Safe area: `app/cliente/_layout.tsx` applica `insets.top`; le rotte di primo livello (`privacy`, `eliminazione-dati`) lo fanno da sé.
