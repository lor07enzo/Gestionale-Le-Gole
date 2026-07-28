import { useState } from 'react';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { forgotPasswordSchema, formatZodErrors } from '../src/schemas/auth';
import { requestPasswordReset } from '../src/services/staff';
import { Icon, MailIcon } from '@/components/ui/icon';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async () => {
    const result = forgotPasswordSchema.safeParse({ email });
    if (!result.success) {
      setEmailError(formatZodErrors(result.error).email ?? null);
      return;
    }
    setEmailError(null);
    setIsSubmitting(true);
    try {
      // Il backend risponde sempre con lo stesso messaggio generico, email registrata o meno
      // (reset_password_request non deve rivelare quali indirizzi esistono in anagrafica).
      await requestPasswordReset(result.data.email);
    } finally {
      setIsSubmitting(false);
      setIsSent(true);
    }
  };

  return (
    <Box className="flex-1 items-center justify-center bg-background px-6">
      <Box className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-sm">
        {isSent ? (
          <VStack space="md" className="items-center">
            <Box className="h-16 w-16 items-center justify-center rounded-full bg-sky-100">
              <Icon as={MailIcon} size="xl" className="text-sky-600" />
            </Box>
            <Heading size="lg" className="text-center">
              Controlla la tua email
            </Heading>
            <Text className="text-center text-muted-foreground">
              Se l'indirizzo inserito è registrato, riceverai a breve un'email con le istruzioni
              per reimpostare la password.
            </Text>
            <Button className="mt-2" onPress={() => router.replace('/login')}>
              <ButtonText>Torna al login</ButtonText>
            </Button>
          </VStack>
        ) : (
          <VStack space="xs" className="items-center">
            <Heading size="2xl" className="text-center">
              Password dimenticata?
            </Heading>
            <Text className="text-center text-muted-foreground">
              Inserisci l'email del tuo account staff: ti invieremo un link per reimpostare la
              password.
            </Text>

            <VStack space="md" className="mt-6 w-full">
              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Email
                </Text>
                <Input>
                  <InputField
                    placeholder="La tua email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </Input>
                {emailError ? (
                  <Text size="xs" className="text-destructive">
                    {emailError}
                  </Text>
                ) : null}
              </VStack>

              <Button onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <ButtonSpinner /> : <ButtonText>Invia link</ButtonText>}
              </Button>
              <Button variant="link" onPress={() => router.back()}>
                <ButtonText>Torna indietro</ButtonText>
              </Button>
            </VStack>
          </VStack>
        )}
      </Box>
    </Box>
  );
}
