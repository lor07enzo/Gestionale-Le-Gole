import { Button, ButtonIcon } from '@/components/ui/button';
import { CheckIcon, EditIcon } from '@/components/ui/icon';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';

// Modalità modifica posizioni postazioni (sezione 5 CLAUDE.md): fuori da questa modalità le
// postazioni sono ferme ma assegnabili col tap (comportamento storico), dentro sono trascinabili
// ma il tap non assegna più nulla — le due interazioni condividono lo stesso gesto sul marker
// (PostazioneMarker) e quindi non possono restare attive entrambe insieme. Pulsante solo icona
// (nessuna descrizione testuale, solo `accessibilityLabel` per lo screen reader), montato da
// `MappaCanvas` come overlay assoluto in alto a destra sopra il canvas — non una riga separata
// sopra la mappa.
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
