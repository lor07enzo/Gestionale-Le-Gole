import { ReactNode } from 'react';
import { PiscinaMappaDataProvider } from './PiscinaMappaDataContext';
import { PiscinaSelectionProvider } from './PiscinaSelectionContext';
import { PiscinaSheetsProvider } from './PiscinaSheetsContext';

// Composizione dei tre context della mappa piscina, nell'ordine di dipendenza richiesto:
// PiscinaSheetsProvider legge sia PiscinaMappaDataContext (dati/CRUD) sia
// PiscinaSelectionContext (candidato selezionato), quindi deve stare annidato dentro entrambi.
export function PiscinaMappaProviders({
  inventarioId,
  initialDate,
  children,
}: Readonly<{ inventarioId: string; initialDate?: string; children: ReactNode }>) {
  return (
    <PiscinaMappaDataProvider inventarioId={inventarioId} initialDate={initialDate}>
      <PiscinaSelectionProvider>
        <PiscinaSheetsProvider>{children}</PiscinaSheetsProvider>
      </PiscinaSelectionProvider>
    </PiscinaMappaDataProvider>
  );
}
