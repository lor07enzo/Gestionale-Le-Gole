import { useLocalSearchParams } from 'expo-router';
import { SetPasswordForm } from '../src/components/auth/SetPasswordForm';
import { activateAccount } from '../src/services/staff';

// Raggiunta tramite il link "legole://activate?uid=...&token=..." inviato da
// users/utils.send_activation_email quando un superuser crea un nuovo account staff.
export default function ActivateScreen() {
  const { uid, token } = useLocalSearchParams<{ uid?: string; token?: string }>();

  return (
    <SetPasswordForm
      uid={uid}
      token={token}
      title="Attiva il tuo account"
      description="Scegli una password per completare l'attivazione del tuo account staff."
      successMessage="Il tuo account è stato attivato. Ora puoi accedere con la tua password."
      onSubmit={activateAccount}
    />
  );
}
