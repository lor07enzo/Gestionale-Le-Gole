import { HStack } from '@/components/ui/hstack';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { AddIcon, RemoveIcon } from '@/components/ui/icon';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { clamp, MAX_SCALE, MIN_SCALE, SCALE_STEP } from '../../../utils/piscinaMappa';

// Stesso "look" di EditModeToggle (border-2 border-sky-300 bg-white shadow-sm rounded-full, un
// cerchio indipendente per pulsante) invece di un contenitore a pillola con pulsanti "ghost" al
// suo interno: normalizza i due overlay del canvas (zoom in alto a sinistra, modifica in alto a
// destra) sullo stesso linguaggio visivo già usato altrove nell'app (DateNavigator, ActionToolbar,
// GiornoPienoToggle) invece di introdurne uno nuovo solo per questo controllo.
export function ZoomControls() {
  const { scale, setScale } = usePiscinaMappaData();

  return (
    <HStack space="xs" className="items-center">
      <Button
        size="icon"
        variant="outline"
        className="rounded-full border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setScale((s) => clamp(s - SCALE_STEP, MIN_SCALE, MAX_SCALE))}
        accessibilityLabel="Riduci zoom"
      >
        <ButtonIcon as={RemoveIcon} className="text-sky-900" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-9 min-w-12 rounded-full border-2 border-sky-300 bg-white px-2 shadow-sm"
        onPress={() => setScale(1)}
        accessibilityLabel="Reimposta lo zoom al 100%"
      >
        <ButtonText className="font-bold text-sky-900">{Math.round(scale * 100)}%</ButtonText>
      </Button>
      <Button
        size="icon"
        variant="outline"
        className="rounded-full border-2 border-sky-300 bg-white shadow-sm"
        onPress={() => setScale((s) => clamp(s + SCALE_STEP, MIN_SCALE, MAX_SCALE))}
        accessibilityLabel="Aumenta zoom"
      >
        <ButtonIcon as={AddIcon} className="text-sky-900" />
      </Button>
    </HStack>
  );
}
