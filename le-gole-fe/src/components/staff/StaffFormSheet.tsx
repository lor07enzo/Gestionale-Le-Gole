import { useEffect, useState } from 'react';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { VStack } from '@/components/ui/vstack';
import { Box } from '@/components/ui/box';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Icon, MailIcon } from '@/components/ui/icon';
import { formatZodErrors, staffSchema, type StaffFormValues } from '../../schemas/staff';
import { useStaffManagement } from '../../context/StaffManagementContext';
import type { StaffMember } from '../../services/staff';

const EMPTY_VALUES: StaffFormValues = { username: '', email: '' };

function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      const firstValue = Object.values(data as Record<string, unknown>)[0];
      const message = Array.isArray(firstValue) ? firstValue[0] : firstValue;
      if (typeof message === 'string') return message;
    }
  }
  return fallback;
}

function ActivationEmailSentPanel({ email, onClose }: Readonly<{ email: string; onClose: () => void }>) {
  return (
    <VStack space="md" className="w-full items-center pb-6 pt-2">
      <Box className="h-16 w-16 items-center justify-center rounded-full bg-sky-100">
        <Icon as={MailIcon} size="xl" className="text-sky-600" />
      </Box>
      <Heading size="md" className="text-center">
        Email di attivazione inviata
      </Heading>
      <Text size="sm" className="text-center text-muted-foreground">
        Abbiamo inviato un link a {email} per impostare la password e attivare l'account.
      </Text>
      <Button onPress={onClose}>
        <ButtonText>Chiudi</ButtonText>
      </Button>
    </VStack>
  );
}

type StaffFormSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  editingStaff: StaffMember | null;
};

export function StaffFormSheet({ isOpen, onClose, editingStaff }: Readonly<StaffFormSheetProps>) {
  const { addStaff, editStaff } = useStaffManagement();
  const [values, setValues] = useState<StaffFormValues>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Non-null dopo una creazione riuscita: mostra la conferma dell'email di attivazione
  // invece di richiudere subito il foglio (lo staff non ha ancora una password utilizzabile).
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  // Ricarica i valori del form ogni volta che il foglio si apre, sia in creazione
  // (campi vuoti) sia in modifica (precompilato con i dati esistenti).
  useEffect(() => {
    if (!isOpen) return;
    setValues(editingStaff ? { username: editingStaff.username, email: editingStaff.email } : EMPTY_VALUES);
    setFieldErrors({});
    setFormError(null);
    setCreatedEmail(null);
  }, [isOpen, editingStaff]);

  const updateField = (key: keyof StaffFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const result = staffSchema.safeParse(values);
    if (!result.success) {
      setFieldErrors(formatZodErrors(result.error));
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      if (editingStaff) {
        await editStaff(editingStaff.id, result.data);
        onClose();
      } else {
        const created = await addStaff(result.data);
        setCreatedEmail(created.email);
      }
    } catch (err) {
      setFormError(extractApiErrorMessage(err, 'Impossibile salvare lo staff. Controlla i dati inseriti.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent
        className="max-h-[85vh]"
        aria-label={editingStaff ? `Modifica staff ${editingStaff.username}` : 'Nuovo staff'}
      >
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          {createdEmail ? (
            <ActivationEmailSentPanel email={createdEmail} onClose={onClose} />
          ) : (
            <VStack space="md" className="w-full pb-6">
              <Heading size="md">{editingStaff ? 'Modifica staff' : 'Nuovo staff'}</Heading>
              {!editingStaff ? (
                <Text size="xs" className="text-muted-foreground">
                  Lo staff riceverà un'email con un link per impostare la propria password: non
                  serve inserirla qui.
                </Text>
              ) : null}

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Username
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. mario.rossi"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={values.username}
                    onChangeText={(text) => updateField('username', text)}
                  />
                </Input>
                {fieldErrors.username ? (
                  <Text size="xs" className="text-destructive">
                    {fieldErrors.username}
                  </Text>
                ) : null}
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Email
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. mario.rossi@legole.it"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    value={values.email}
                    onChangeText={(text) => updateField('email', text)}
                  />
                </Input>
                {fieldErrors.email ? (
                  <Text size="xs" className="text-destructive">
                    {fieldErrors.email}
                  </Text>
                ) : null}
              </VStack>

              {formError ? (
                <Text size="sm" className="text-center text-destructive">
                  {formError}
                </Text>
              ) : null}

              <Button onPress={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ButtonSpinner />
                ) : (
                  <ButtonText>{editingStaff ? 'Salva modifiche' : 'Crea staff'}</ButtonText>
                )}
              </Button>
              <Button variant="link" onPress={onClose}>
                <ButtonText>Annulla</ButtonText>
              </Button>
            </VStack>
          )}
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
