import { Button, ButtonIcon } from '@/components/ui/button';
import { CheckIcon, EditIcon } from '@/components/ui/icon';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';

// Fuori da questa modalità le postazioni sono assegnabili col tap; dentro sono trascinabili ma
// il tap non assegna più nulla — le due interazioni condividono lo stesso gesto sul marker.
export function EditModeToggle() {
  const { isEditMode, setIsEditMode, isPastDate } = usePiscinaMappaData();

  if (isEditMode) {
    return (
      <Button
        size="icon"
        className="rounded-full border-2 border-sky-600 bg-sky-600 shadow-sm"
        onPress={() => setIsEditMode(false)}
        accessibilityLabel="Conferma posizioni"
      >
        <ButtonIcon as={CheckIcon} className="text-white" />
      </Button>
    );
  }

  return (
    <Button
      size="icon"
      variant="outline"
      className={`rounded-full border-2 border-sky-300 bg-white shadow-sm ${isPastDate ? 'opacity-40' : ''}`}
      onPress={() => setIsEditMode(true)}
      disabled={isPastDate}
      accessibilityLabel="Modifica posizione postazioni"
    >
      <ButtonIcon as={EditIcon} className="text-sky-700" />
    </Button>
  );
}
