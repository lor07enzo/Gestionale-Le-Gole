import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-paper/lib/typescript/components/MaterialCommunityIcon';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';

type PaperModule = typeof import('react-native-paper');

// Guardrail esplicito: col caricamento dinamico sotto, il modulo può montare/smontare più volte
// per sessione (navigazione avanti/indietro), quindi registerTranslation va protetta qui.
let translationRegistered = false;

// Definita fuori dal componente (non inline nella prop `settings`): altrimenti verrebbe
// ricreata ad ogni render di ClienteLayout, invalidando inutilmente il context di PaperProvider.
function renderPaperIcon(props: IconProps) {
  return <MaterialCommunityIcons {...props} />;
}

// Caricate dinamicamente: un bug noto di Metro può rendere `undefined` FlatList con un import
// statico, facendo crashare l'intera app invece che solo /cliente/*.
export default function ClienteLayout() {
  const [Paper, setPaper] = useState<PaperModule | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import('react-native-paper'), import('react-native-paper-dates')]).then(
      ([paperModule, paperDatesModule]) => {
        if (!translationRegistered) {
          paperDatesModule.registerTranslation('it', paperDatesModule.it);
          translationRegistered = true;
        }
        if (!cancelled) setPaper(paperModule);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      {Paper ? (
        <Paper.PaperProvider
          theme={{
            ...Paper.MD3LightTheme,
            // Accento sky-600 (coerente con l'Area Cliente) al posto del viola di default MD3.
            colors: { ...Paper.MD3LightTheme.colors, primary: '#0284c7' },
          }}
          settings={{ icon: renderPaperIcon }}
        >
          {/* Contenitore centrato (2026-09-04): l'Area Cliente non ne aveva alcuno, quindi su
              tablet e desktop ogni pagina si stirava per l'intera larghezza dello schermo — righe
              di testo lunghissime e card enormi. `max-w-5xl` (1024px) invece del `max-w-6xl` dello
              staff: qui il contenuto è più editoriale (hero, avvisi, form) e regge peggio righe
              molto lunghe, ma resta comunque abbastanza largo per le due colonne del flusso di
              prenotazione piscina (app/cliente/piscina/[inventarioId].tsx). */}
          <Box className="flex-1 bg-background">
            <Box className="mx-auto w-full max-w-5xl flex-1">
              <Slot />
            </Box>
          </Box>
        </Paper.PaperProvider>
      ) : (
        <Box className="flex-1 items-center justify-center bg-background">
          <Spinner size="large" />
        </Box>
      )}
    </SafeAreaProvider>
  );
}
