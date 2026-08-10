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

          <Button size="lg" variant="outline" onPress={() => router.push('/cliente')}>
            <ButtonText>Area Cliente</ButtonText>
          </Button>
        </VStack>

        <Text className="mt-6 text-center text-xs text-muted-foreground">v{appVersion}</Text>
      </Box>
    </Box>
  );
}
