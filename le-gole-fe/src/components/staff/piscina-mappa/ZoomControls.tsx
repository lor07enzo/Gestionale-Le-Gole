import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Button, ButtonText } from '@/components/ui/button';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { clamp, MAX_SCALE, MIN_SCALE, SCALE_STEP } from '../../../utils/piscinaMappa';

export function ZoomControls() {
  const { scale, setScale } = usePiscinaMappaData();

  return (
    <HStack space="sm" className="items-center justify-end">
      <Text size="xs" className="text-muted-foreground">
        Zoom
      </Text>
      <Button
        size="sm"
        variant="outline"
        className="border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setScale((s) => clamp(s - SCALE_STEP, MIN_SCALE, MAX_SCALE))}
      >
        <ButtonText className="text-base font-bold text-sky-900">－</ButtonText>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setScale(1)}
      >
        <ButtonText className="font-bold text-sky-900">{Math.round(scale * 100)}%</ButtonText>
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setScale((s) => clamp(s + SCALE_STEP, MIN_SCALE, MAX_SCALE))}
      >
        <ButtonText className="text-base font-bold text-sky-900">＋</ButtonText>
      </Button>
    </HStack>
  );
}
