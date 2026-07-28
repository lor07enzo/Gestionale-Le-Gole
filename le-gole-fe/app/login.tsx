import { useState } from 'react';
import { Image } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';

const logo = require('../assets/logo-le-gole-nero.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            <Text size="sm" className="font-medium">
              Username
            </Text>
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

          <Button variant="link" onPress={() => router.back()}>
            <ButtonText>Torna indietro</ButtonText>
          </Button>
        </VStack>
      </Box>
    </Box>
  );
}
