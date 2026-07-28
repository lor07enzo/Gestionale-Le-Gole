import { useState } from 'react';
import { router } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { formatZodErrors, setPasswordSchema } from '../../schemas/auth';
import type { SetPasswordPayload } from '../../services/staff';

// { uid: "..." } via Django validate_password (ActivateAccountSerializer/PasswordResetConfirmSerializer),
// { detail: "..." } quando uid/token non sono validi o sono scaduti.
function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      const record = data as Record<string, unknown>;
      if (typeof record.detail === 'string') return record.detail;
      const passwordErrors = record.password;
      if (Array.isArray(passwordErrors) && typeof passwordErrors[0] === 'string') {
        return passwordErrors.join(' ');
      }
    }
  }
  return fallback;
}

type SetPasswordFormProps = {
  uid: string | undefined;
  token: string | undefined;
  title: string;
  description: string;
  successMessage: string;
  onSubmit: (payload: SetPasswordPayload) => Promise<{ detail: string }>;
};

export function SetPasswordForm({
  uid,
  token,
  title,
  description,
  successMessage,
  onSubmit,
}: Readonly<SetPasswordFormProps>) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async () => {
    const result = setPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      setFieldErrors(formatZodErrors(result.error));
      setFormError(null);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({ uid: uid!, token: token!, password: result.data.password });
      setIsDone(true);
    } catch (err) {
      setFormError(extractApiErrorMessage(err, 'Impossibile completare l\'operazione. Il link potrebbe essere scaduto.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="flex-1 items-center justify-center bg-background px-6">
      <Box className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 shadow-sm">
        {!uid || !token ? (
          <VStack space="md" className="items-center">
            <Heading size="lg" className="text-center">
              Link non valido
            </Heading>
            <Text className="text-center text-muted-foreground">
              Questo link non è valido o è incompleto. Richiedine uno nuovo dalla pagina di login.
            </Text>
            <Button className="mt-2" onPress={() => router.replace('/login')}>
              <ButtonText>Torna al login</ButtonText>
            </Button>
          </VStack>
        ) : isDone ? (
          <VStack space="md" className="items-center">
            <Text size="lg">✅</Text>
            <Heading size="lg" className="text-center">
              Fatto!
            </Heading>
            <Text className="text-center text-muted-foreground">{successMessage}</Text>
            <Button className="mt-2" onPress={() => router.replace('/login')}>
              <ButtonText>Vai al login</ButtonText>
            </Button>
          </VStack>
        ) : (
          <VStack space="xs" className="items-center">
            <Heading size="2xl" className="text-center">
              {title}
            </Heading>
            <Text className="text-center text-muted-foreground">{description}</Text>

            <VStack space="md" className="mt-6 w-full">
              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Nuova password
                </Text>
                <Input>
                  <InputField
                    placeholder="Almeno 8 caratteri"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </Input>
                {fieldErrors.password ? (
                  <Text size="xs" className="text-destructive">
                    {fieldErrors.password}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Conferma password
                </Text>
                <Input>
                  <InputField
                    placeholder="Ripeti la password"
                    secureTextEntry
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </Input>
                {fieldErrors.confirmPassword ? (
                  <Text size="xs" className="text-destructive">
                    {fieldErrors.confirmPassword}
                  </Text>
                ) : null}
              </VStack>

              {formError ? (
                <Text className="text-center text-destructive">{formError}</Text>
              ) : null}

              <Button onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <ButtonSpinner /> : <ButtonText>Conferma</ButtonText>}
              </Button>
            </VStack>
          </VStack>
        )}
      </Box>
    </Box>
  );
}
