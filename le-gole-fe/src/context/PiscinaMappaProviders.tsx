import { ReactNode } from 'react';
import { PiscinaMappaDataProvider } from './PiscinaMappaDataContext';
import { PiscinaSelectionProvider } from './PiscinaSelectionContext';
import { PiscinaSheetsProvider } from './PiscinaSheetsContext';

// PiscinaSheetsProvider legge sia MappaData sia Selection, quindi va annidato dentro entrambi.
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
