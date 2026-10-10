import { Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { AddIcon, Icon, RemoveIcon } from '@/components/ui/icon';

type StepperQuantitaProps = {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max: number;
  /** Nome di ciò che si conta, per le etichette di accessibilità ("Aumenta {etichetta}"). */
  etichetta: string;
};

function StepperButton({
  onPress,
  disabled,
  label,
  icon,
}: Readonly<{ onPress: () => void; disabled: boolean; label: string; icon: typeof AddIcon }>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white md:h-12 md:w-12 ${
        disabled ? 'opacity-40' : 'active:bg-sky-50'
      }`}
    >
      <Icon as={icon} size="sm" className="text-sky-900" />
    </Pressable>
  );
}

// Stepper "－ N ＋" a cerchi da 44px (target di tocco comodo su telefono e tablet).
export function StepperQuantita({ value, onChange, min = 0, max, etichetta }: Readonly<StepperQuantitaProps>) {
  return (
    <HStack space="xs" className="items-center">
      <StepperButton
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        label={`Diminuisci ${etichetta}`}
        icon={RemoveIcon}
      />
      <Text size="md" className="w-8 text-center font-bold text-sky-900">
        {value}
      </Text>
      <StepperButton
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        label={`Aumenta ${etichetta}`}
        icon={AddIcon}
      />
    </HStack>
  );
}
