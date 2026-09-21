// Deve restare il primissimo import del file (requisito di react-native-gesture-handler,
// necessario perché i suoi moduli nativi si inizializzino nell'ordine corretto): introdotto
// (2026-09-13) per sostituire il PanResponder legacy nel drag dei marker della mappa piscina
// staff, rotto su Expo Go/Fabric nonostante più fix mirati (sezione 5 di CLAUDE.md).

import '../global.css';
import { useEffect } from 'react';
import { Href, Stack, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../src/context/AuthContext';
import { ascoltaTapNotifica, configuraNotificheInPrimoPiano } from '../src/utils/push';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';

export default function RootLayout() {
  // Qui e non nel layout staff: una notifica toccata ad app chiusa deve poter aprire la schermata
  // giusta anche quando quel layout non è ancora montato (sezione 11 di CLAUDE.md).
  useEffect(() => {
    configuraNotificheInPrimoPiano();
    return ascoltaTapNotifica((percorso) => router.push(percorso as Href));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <GluestackUIProvider mode="light">
          <AuthProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthProvider>
        </GluestackUIProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
