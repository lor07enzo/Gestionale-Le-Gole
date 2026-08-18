import { router, type Href } from 'expo-router';

// `router.back()` non fa nulla su un caricamento "a freddo" (refresh, link diretto): lo stack
// interno di Expo Router è vuoto anche se la cronologia del browser non lo è. `replace`, non
// `push`, per non aggiungere una tappa in più.
export function goBackOr(fallbackHref: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallbackHref);
  }
}
