---
name: le-gole-frontend
description: Convenzioni e trappole del frontend Expo/React Native di Le Gole (Expo SDK 56, Expo Router, NativeWind v5, gluestack-ui v5, react-native-web). Usala prima di toccare schermate in le-gole-fe/app, componenti, context, service layer, stili, icone, gesti, scroll o qualunque cosa che debba funzionare sia sul web sia su Android/iOS.
---

# Frontend Expo — Le Gole

Codice in `le-gole-fe/`. Prima di usare un'API Expo leggi i doc versionati: https://docs.expo.dev/versions/v56.0.0/ (vedi `le-gole-fe/AGENTS.md`). Trappole di resa/gesti: [trappole-nativo-web.md](trappole-nativo-web.md). Componenti riusabili: [componenti-condivisi.md](componenti-condivisi.md).

Rilascio: web su Netlify (`osterialegole.com`) **e** app Android su Play (test chiuso), iOS in preparazione. Ogni cosa va pensata per entrambi: molti bug sono emersi solo al primo build nativo perché il codice era "solo web".

## Struttura

- `app/` rotte Expo Router: `index.tsx` (scelta ruolo), `login`, `activate`, `reset-password`, `forgot-password`, `privacy`, `eliminazione-dati` (rotte di primo livello), `cliente/*` (pubblico, `_layout` con PaperProvider + safe area), `staff/*` (`_layout` con auth, header, notifiche).
- `src/services/*.ts` binding 1:1 con gli endpoint (`api.ts` = axios con Bearer + refresh su 401 condiviso). `padel.ts` copre due app Django: è voluto.
- `src/context/` (Auth, notifiche staff, mappa piscina in tre context, carrello asporto scoped a `app/cliente/asporto/_layout.tsx`, gestione staff).
- `src/utils/` funzioni pure (è qui che stanno le regole testabili), `src/components/{shared,staff,cliente,auth}`, `components/ui/` = gluestack copy-paste (non è codice nostro, escluso da Sonar, modificabile).

## Convenzioni

- **Rotte**: nuovo segmento di primo livello sotto `app/` → riavviare Metro. File dentro cartelle già servite no. File piatto `x.tsx` convive con cartella `x/[id].tsx`. Usa `/cliente`, mai `/cliente/index`. `router.push(\`…${id}\` as Href)` per rotte dinamiche o appena create (tipi generati in ritardo).
- **Indietro**: sempre `goBackOr(fallbackHref)` (`src/utils/navigation.ts`), `BackButton` con `fallbackHref` obbligatorio: su caricamento a freddo `router.back()` non fa nulla.
- **Dialoghi**: `mostraErrore`/`chiediConferma` (`src/utils/dialog.ts`) — `Alert.alert` è no-op sul web.
- **Errori API**: `extractErrorMessage` da `src/utils/errors.ts` (unica copia).
- **Funzioni async non attese**: prefisso `void` (regola Sonar S9383).
- **Niente ternari annidati né template annidati** (Sonar S3358/S4624): estrai funzioni pure per le classi o calcola una variabile `let contenuto: React.ReactNode` con if/else prima del `return`.
- Complessità cognitiva > 15: estrai sotto-componenti con props `Readonly<…>`.
- Duplicazione: Sonar soglia 3%. Con 3+ chiamanti estrai in `src/utils` o `src/components/shared`. Con 2 la copia diretta è accettata se motivata.
- Breakpoint: `md:` (≥768) tablet, `lg:` (≥1024) per due colonne affiancate (mappa, prenotazione, carrello) — non `md:`, a 768-834 la colonna mappa diventa inservibile. Contenitori: staff `max-w-6xl`, cliente `max-w-5xl`.
- Griglie: celle `w-full p-2 md:w-1/2` dentro un contenitore `-m-2 flex-row flex-wrap` (mai `gap` + frazioni, mai `md:flex-1` su tutte le card); `h-full` sulle card per allineare le CTA.
- Target tocco ≥ 44px (`min-h-11`, `h-11 w-11`). `Button` gluestack ha solo `default|sm|lg|icon` (niente `md`).
- Validazione form con Zod (`src/schemas`, `formatZodErrors`). Validazione client = cortesia, il backend resta l'autorità.
- Persistenza locale: `src/utils/storage.ts` (SecureStore/localStorage). Lo storico "Le mie prenotazioni" sta **solo in memoria** (`storicoSessione.ts`), mai in localStorage.
- Tema solo light, sfondo crema `#eae0c8` (`--background`). Palette: sky = azione/navigazione, emerald = creazione/conferma, rose = chiuso/pieno/annullato, amber = avviso.

## Prima di dichiarare finito

`npx tsc --noEmit`, `npx jest`, e se cambi dipendenze/layout radice/import condivisi: `npx expo export -p web --clear && node scripts/verify-web-build.js` (dettagli nella skill `le-gole-test-verifica`). Le pagine `app/**` e `src/components/**` non hanno test unitari: va detto esplicitamente quando una modifica non è stata vista a schermo.
