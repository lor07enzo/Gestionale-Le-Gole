import { Slot } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import type { IconProps } from 'react-native-paper/lib/typescript/components/MaterialCommunityIcon';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { it, registerTranslation } from 'react-native-paper-dates';

// Traduzione italiana per TimePickerModal (usato dal flusso di prenotazione piscina, sezione 7
// CLAUDE.md) — va registrata una sola volta, a livello di modulo.
registerTranslation('it', it);

// Accento sky-600 (stesso blu usato in tutta l'Area Cliente, es. i pulsanti/bordi di
// DateNav/RisorsaField) al posto del viola di default di Material Design 3 — il modale resta
// comunque visivamente "Paper", non gluestack-ui, ma almeno non stona con il resto della pagina.
const paperTheme = {
  ...MD3LightTheme,
  colors: { ...MD3LightTheme.colors, primary: '#0284c7' },
};

// Definita fuori dal componente (non inline nella prop `settings`): altrimenti verrebbe
// ricreata ad ogni render di ClienteLayout, invalidando inutilmente il context di PaperProvider.
function renderPaperIcon(props: IconProps) {
  return <MaterialCommunityIcons {...props} />;
}

// react-native-paper (usata solo per il TimePickerModal di react-native-paper-dates, non per il
// resto della UI, che resta gluestack-ui + NativeWind) richiede un PaperProvider come antenato
// per i suoi componenti "Portal" (il modale del time picker), e SafeAreaProvider per gli insets
// usati internamente dal modale. Limitati a questo gruppo di rotte (`/cliente/*`), non al layout
// radice, per non introdurre il secondo design system nel resto dell'app.
export default function ClienteLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme} settings={{ icon: renderPaperIcon }}>
        <Slot />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
