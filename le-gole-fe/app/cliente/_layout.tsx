import { useEffect, useState } from 'react';
import { Slot } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { IconProps } from 'react-native-paper/lib/typescript/components/MaterialCommunityIcon';
import { Box } from '@/components/ui/box';
import { Spinner } from '@/components/ui/spinner';

type PaperModule = typeof import('react-native-paper');

// registerTranslation va chiamata una sola volta a livello di modulo (commento originale) — ma
// ora che il modulo si carica dinamicamente (sotto) potrebbe montare/smontare più volte durante
// una sessione (navigazione avanti/indietro da /cliente/* verso altre rotte e ritorno), quindi il
// guardrail è esplicito qui invece che implicito nell'ordine di esecuzione del modulo.
let translationRegistered = false;

// Definita fuori dal componente (non inline nella prop `settings`): altrimenti verrebbe
// ricreata ad ogni render di ClienteLayout, invalidando inutilmente il context di PaperProvider.
function renderPaperIcon(props: IconProps) {
  return <MaterialCommunityIcons {...props} />;
}

// react-native-paper/react-native-paper-dates (usate solo per il TimePickerModal della
// prenotazione piscina, sezione 7 di CLAUDE.md) caricate dinamicamente al montaggio di questo
// layout, non importate in cima al file come in precedenza — un bug noto della libreria fa sì
// che il suo riferimento a FlatList di React Native risulti a volte `undefined` a seconda
// dell'ordine con cui Metro impacchetta i moduli (diverso tra build, es. Windows locale vs Linux
// CI, riscontrato in produzione). Con un import statico qui, quel codice diventava parte del
// bundle valutato eagerly su OGNI pagina dell'app (anche fuori da /cliente/*, il bundle web è
// unico, sezione 8), mandando in crash l'intera applicazione quando il bug si manifestava.
// Caricandola solo quando si naviga davvero in /cliente/*, un'eventuale build sfortunata rompe al
// più il flusso di prenotazione (vedi anche il lazy() su TimePickerModal nella pagina di
// prenotazione), non più l'intera app.
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
            // Accento sky-600 (stesso blu usato in tutta l'Area Cliente, es. i pulsanti/bordi di
            // DateNav/RisorsaField) al posto del viola di default di Material Design 3 — il
            // modale resta comunque visivamente "Paper", non gluestack-ui, ma almeno non stona
            // con il resto della pagina.
            colors: { ...Paper.MD3LightTheme.colors, primary: '#0284c7' },
          }}
          settings={{ icon: renderPaperIcon }}
        >
          <Slot />
        </Paper.PaperProvider>
      ) : (
        <Box className="flex-1 items-center justify-center bg-background">
          <Spinner size="large" />
        </Box>
      )}
    </SafeAreaProvider>
  );
}
