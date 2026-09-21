import { DateNavigatorConCalendario } from '../../shared/DateNavigatorConCalendario';
import { getConteggiPrenotazioniAsporto } from '../../../services/prenotazioni';

type DateNavigatorAsportoProps = {
  selectedDate: Date;
  onChange: (next: Date) => void;
};

// Wrapper sottile su DateNavigatorConCalendario (sezione 5/16 di CLAUDE.md), stesso schema di
// DateNavigatorPadel — qui con i conteggi ordini dell'asporto (nessun filtro per inventario) e,
// a differenza di entrambi gli altri due, un `maxDate` fisso a oggi: "Storico Ordini" è una pagina
// di sola consultazione, un ordine non esiste ancora per un giorno futuro (sezione 15).
export function DateNavigatorAsporto({ selectedDate, onChange }: Readonly<DateNavigatorAsportoProps>) {
  return (
    <DateNavigatorConCalendario
      selectedDate={selectedDate}
      onChange={onChange}
      maxDate={new Date()}
      loadConteggi={(anno, mese) => getConteggiPrenotazioniAsporto({ anno, mese })}
      calendarCaption="Il numero su ogni giorno indica quanti ordini ci sono già, anche nel passato."
    />
  );
}
