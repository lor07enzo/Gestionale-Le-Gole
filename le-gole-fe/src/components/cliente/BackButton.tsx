import type { Href } from 'expo-router';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { ArrowLeftIcon } from '@/components/ui/icon';
import { goBackOr } from '../../utils/navigation';

export function BackButton({
  label = 'Torna indietro',
  onPress,
  // Obbligatorio (non un default indovinato): la destinazione corretta se non c'è nulla da cui
  // tornare indietro (pagina raggiunta con un caricamento "a freddo", vedi utils/navigation.ts)
  // dipende da dove vive il pulsante — sbagliarla silenziosamente sarebbe peggio di non gestire
  // affatto il caso.
  fallbackHref,
  className = '',
}: Readonly<{ label?: string; onPress?: () => void; fallbackHref: Href; className?: string }>) {
  return (
    <Button
      variant="outline"
      className={`self-start border-2 border-sky-300 bg-white shadow-sm ${className}`}
      onPress={onPress ?? (() => goBackOr(fallbackHref))}
    >
      <ButtonIcon as={ArrowLeftIcon} />
      <ButtonText>{label}</ButtonText>
    </Button>
  );
}
