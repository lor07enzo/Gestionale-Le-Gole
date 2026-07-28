import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { formatDisplayDate } from '../../../utils/piscinaMappa';
import { DisponibilitaCards } from '../../shared/DisponibilitaCards';

export function DisponibilitaRow() {
  const { disponibilita, selectedDate } = usePiscinaMappaData();

  if (!disponibilita) return null;

  return (
    <DisponibilitaCards
      items={disponibilita}
      title={`Disponibilità per ${formatDisplayDate(selectedDate)}`}
    />
  );
}
