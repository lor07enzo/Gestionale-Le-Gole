import { router, type Href } from 'expo-router';

// `router.back()` non fa nulla se la pagina è stata caricata "a freddo" (refresh del browser,
// link diretto/bookmark, apertura di un'email di reset password, digitazione manuale dell'URL)
// invece che navigando dentro l'app: lo stack di navigazione INTERNO di Expo Router è vuoto in
// quel caso, anche se la cronologia reale del browser potrebbe avere pagine precedenti (esterne
// all'app) — il pulsante "Torna indietro" restava quindi silenziosamente inerte. `goBackOr`
// verifica prima con `router.canGoBack()` e, solo se non c'è nulla da cui tornare indietro,
// sostituisce la rotta corrente con una destinazione di fallback sensata (`replace`, non `push`:
// non deve aggiungere una tappa in più nello stack).
export function goBackOr(fallbackHref: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
