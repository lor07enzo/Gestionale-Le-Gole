import { useState } from 'react';
import { Image, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { goBackOr } from '../src/utils/navigation';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { HStack } from '@/components/ui/hstack';
import { Icon, InfoIcon } from '@/components/ui/icon';

const logo = require('../assets/logo-le-gole-nero.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInfoUsernameOpen, setIsInfoUsernameOpen] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await login(username, password);
      router.replace('/staff');
    } catch (err: any) {
      if (err?.response) {
        setError('Credenziali non valide.');
      } else {
        setError('Impossibile contattare il server. Controlla la connessione e riprova.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="flex-1 items-center justify-center bg-background px-6">
      <Box className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-sm">
        <VStack space="xs" className="items-center">
          <Image source={logo} style={{ width: 64, height: 64 }} resizeMode="contain" accessibilityLabel="Logo Le Gole" />
          <Heading size="2xl">Login Staff</Heading>
          <Text className="text-center text-muted-foreground">
            Inserisci le tue credenziali per accedere.
          </Text>
        </VStack>

        <VStack space="md" className="mt-8">
          <VStack space="xs">
            <HStack space="xs" className="items-center">
              <Text size="sm" className="font-medium">
                Username
              </Text>
              <Pressable
                onPress={() => setIsInfoUsernameOpen((open) => !open)}
                accessibilityRole="button"
                accessibilityLabel="Informazioni sullo username"
                accessibilityState={{ expanded: isInfoUsernameOpen }}
                hitSlop={8}
                className="h-6 w-6 items-center justify-center rounded-full active:bg-sky-100"
              >
                <Icon as={InfoIcon} size="sm" className="text-sky-700" />
              </Pressable>
            </HStack>
            {isInfoUsernameOpen ? (
              <Box className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2">
                <Text size="xs" className="text-sky-900">
                  Usa lo stesso username che trovi nell'email ricevuta per impostare la password
                  (all'inizio del messaggio, dopo «Ciao»).
                </Text>
              </Box>
            ) : null}
            <Input>
              <InputField
                placeholder="Il tuo username"
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
              />
            </Input>
          </VStack>

          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Password
            </Text>
            <Input>
              <InputField
                placeholder="La tua password"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </Input>
          </VStack>

          {error ? <Text className="text-center text-destructive">{error}</Text> : null}

          <Button className="mt-2" onPress={handleLogin} disabled={isSubmitting}>
            {isSubmitting ? <ButtonSpinner /> : <ButtonText>Accedi</ButtonText>}
          </Button>

          <Button variant="link" onPress={() => router.push('/forgot-password')}>
            <ButtonText>Password dimenticata?</ButtonText>
          </Button>

          <Button variant="link" onPress={() => goBackOr('/')}>
            <ButtonText>Torna indietro</ButtonText>
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
