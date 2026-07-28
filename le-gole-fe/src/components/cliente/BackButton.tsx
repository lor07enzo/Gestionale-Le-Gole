import { router } from 'expo-router';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { ArrowLeftIcon } from '@/components/ui/icon';

export function BackButton({
  label = 'Torna indietro',
  onPress,
  className = '',
}: Readonly<{ label?: string; onPress?: () => void; className?: string }>) {
  return (
    <Button
      variant="outline"
      className={`self-start border-2 border-sky-300 bg-white shadow-sm ${className}`}
      onPress={onPress ?? (() => router.back())}
    >
      <ButtonIcon as={ArrowLeftIcon} />
      <ButtonText>{label}</ButtonText>
    </Button>
  );
}
