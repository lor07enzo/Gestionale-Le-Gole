import { useLocalSearchParams } from 'expo-router';
import { SetPasswordForm } from '../src/components/auth/SetPasswordForm';
import { confirmPasswordReset } from '../src/services/staff';

// Raggiunta tramite il link "legole://reset-password?uid=...&token=..." inviato da
// users/utils.send_password_reset_email dopo una richiesta da app/forgot-password.tsx.
export default function ResetPasswordScreen() {
  const { uid, token } = useLocalSearchParams<{ uid?: string; token?: string }>();

  return (
    <SetPasswordForm
      uid={uid}
      token={token}
      title="Reimposta la password"
      description="Scegli una nuova password per il tuo account staff."
      successMessage="La tua password è stata aggiornata. Ora puoi accedere con la nuova password."
      onSubmit={confirmPasswordReset}
    />
  );
}
