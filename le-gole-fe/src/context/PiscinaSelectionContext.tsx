import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type PiscinaSelectionValue = {
  selectedPrenotazioneId: string | null;
  selectPrenotazioneCandidate: (id: string | null) => void;
};

const PiscinaSelectionContext = createContext<PiscinaSelectionValue | undefined>(undefined);

export function PiscinaSelectionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [selectedPrenotazioneId, setSelectedPrenotazioneId] = useState<string | null>(null);

  const value = useMemo<PiscinaSelectionValue>(
    () => ({
      selectedPrenotazioneId,
      selectPrenotazioneCandidate: setSelectedPrenotazioneId,
    }),
    [selectedPrenotazioneId]
  );

  return <PiscinaSelectionContext.Provider value={value}>{children}</PiscinaSelectionContext.Provider>;
}

export function usePiscinaSelection(): PiscinaSelectionValue {
  const context = useContext(PiscinaSelectionContext);
  if (!context) {
    throw new Error(
      'usePiscinaSelection deve essere usato all\'interno di un PiscinaSelectionProvider.'
    );
  }
  return context;
}
