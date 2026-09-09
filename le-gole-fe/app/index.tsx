import { useEffect } from 'react';
import { Image } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '../src/context/AuthContext';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

const logo = require('../assets/logo-le-gole-nero.png');
const appVersion = Constants.expoConfig?.version ?? '1.0.0';

// Stesso valore di --background/--border in global.css (234 224 200 / #eae0c8 e 229 229 229 /
// #e5e5e5) — passati come style inline, non come classi bg-background/border-border, apposta: il
// pulsante "Area Cliente" (variant="outline", che risolverebbe di suo entrambi da quelle classi)
// su alcuni dispositivi mostrava bianco invece del crema atteso, segno che le variabili CSS non
// venivano sempre risolte in modo affidabile da NativeWind v5 (ancora alpha). Un colore letterale
// nello style bypassa del tutto quella risoluzione, quindi non può mai più dipendere da essa. Se
// --background/--border cambiano in global.css, vanno aggiornati a mano anche qui.
const AREA_CLIENTE_BUTTON_BG = '#eae0c8';
const AREA_CLIENTE_BUTTON_BORDER = '#e5e5e5';

export default function RoleSelectionScreen() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/staff');
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || isAuthenticated) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  return (
    <Box className="flex-1 items-center justify-center bg-background px-6">
      <Box className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-sm">
        <VStack space="xs" className="items-center">
          <Image source={logo} style={{ width: 96, height: 96 }} resizeMode="contain" accessibilityLabel="Logo Le Gole" />
          <Heading size="4xl">Le Gole</Heading>
          <Text className="text-center text-muted-foreground">
            Benvenuto! Scegli come vuoi accedere.
          </Text>
        </VStack>

        <VStack space="md" className="mt-8">
          <Button size="lg" onPress={() => router.push('/login')}>
            <ButtonText>Accedi come Staff</ButtonText>
          </Button>

          <Button
            size="lg"
            variant="outline"
            style={{
              backgroundColor: AREA_CLIENTE_BUTTON_BG,
              borderWidth: 1,
              borderColor: AREA_CLIENTE_BUTTON_BORDER,
            }}
            onPress={() => router.push('/cliente')}
          >
            <ButtonText>Area Cliente</ButtonText>
          </Button>
        </VStack>

        <Text className="mt-6 text-center text-xs text-muted-foreground">v{appVersion}</Text>
      </Box>
    </Box>
  );
}
