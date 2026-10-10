import { StatoServizioCard } from '../../shared/StatoServizioCard';
import { getConfigurazioneAsporto, updateConfigurazioneAsporto } from '../../../services/menu';

const salvaAttivo = (attivo: boolean) => updateConfigurazioneAsporto({ attivo });

export function StatoServizioAsportoCard() {
  return (
    <StatoServizioCard
      icona="🥡"
      titolo="Ordini online"
      testoAttivo="I clienti possono ordinare dall’Area Cliente."
      testoDisattivo="Il servizio non è ordinabile online. Puoi comunque registrare ordini da qui."
      statoIniziale
      load={getConfigurazioneAsporto}
      save={salvaAttivo}
    />
  );
}
