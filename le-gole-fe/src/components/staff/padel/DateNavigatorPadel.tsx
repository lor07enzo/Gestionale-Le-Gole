import { DateNavigatorConCalendario } from '../../shared/DateNavigatorConCalendario';
import { getConteggiPrenotazioniPadel } from '../../../services/padel';

type DateNavigatorPadelProps = {
  selectedDate: Date;
  onChange: (next: Date) => void;
  // Giorno più indietro raggiungibile: omesso = nessun limite (nessuna richiesta in tal senso qui,
  // ma il chiamante di "Nuova partita" lo passa sempre a oggi — una partita non si registra nel passato).
  minDate?: Date;
};

// Wrapper sottile su DateNavigatorConCalendario (sezione 5/16 di CLAUDE.md): stessa struttura del
// navigatore mappa piscina, qui con i conteggi partite del padel (nessun filtro per inventario,
// il padel ha un solo campo) e nessun limite "verso il futuro".
export function DateNavigatorPadel({ selectedDate, onChange, minDate }: Readonly<DateNavigatorPadelProps>) {
  return (
    <DateNavigatorConCalendario
      selectedDate={selectedDate}
      onChange={onChange}
      minDate={minDate}
      loadConteggi={(anno, mese) => getConteggiPrenotazioniPadel({ anno, mese })}
      calendarCaption="Il numero su ogni giorno indica quante partite sono già prenotate."
    />
  );
}
