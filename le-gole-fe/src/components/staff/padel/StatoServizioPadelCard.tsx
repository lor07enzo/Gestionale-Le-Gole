import { StatoServizioCard } from '../../shared/StatoServizioCard';
import { getConfigurazionePadel, updateConfigurazionePadel } from '../../../services/padel';

const salvaAttivo = (attivo: boolean) => updateConfigurazionePadel({ attivo });

export function StatoServizioPadelCard() {
  return (
    <StatoServizioCard
      icona="🎾"
      titolo="Prenotazioni online"
      testoAttivo="I clienti possono prenotare il campo dall’Area Cliente."
      testoDisattivo="Il campo non è prenotabile online. Puoi comunque registrare partite da qui."
      statoIniziale={false}
      load={getConfigurazionePadel}
      save={salvaAttivo}
    />
  );
}
