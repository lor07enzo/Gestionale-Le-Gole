import { Slot } from 'expo-router';
import { CarrelloAsportoProvider } from '../../../src/context/CarrelloAsportoContext';

// Avvolge sia la pagina menu (index.tsx) sia quella di dettaglio prodotto ([prodottoId].tsx) nello
// stesso provider — nessun altro chrome condiviso, stesso principio minimale di app/cliente/_layout.tsx.
export default function AsportoLayout() {
  return (
    <CarrelloAsportoProvider>
      <Slot />
    </CarrelloAsportoProvider>
  );
}
