import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { getConteggiPrenotazioniPiscina } from '../../../services/prenotazioni';
import { DateNavigatorConCalendario } from '../../shared/DateNavigatorConCalendario';

// Navigatore data della mappa piscina: wrapper sul componente condiviso con i conteggi per
// inventario, nessun limite in nessuna direzione (lo staff consulta anche lo storico).
export function DateNavigator() {
  const { inventarioId, selectedDate, setSelectedDate } = usePiscinaMappaData();

  return (
    <DateNavigatorConCalendario
      selectedDate={selectedDate}
      onChange={setSelectedDate}
      loadConteggi={(anno, mese) => getConteggiPrenotazioniPiscina({ inventario: inventarioId, anno, mese })}
      calendarCaption="Il numero su ogni giorno indica quante prenotazioni ci sono già, anche nel passato."
    />
  );
}
