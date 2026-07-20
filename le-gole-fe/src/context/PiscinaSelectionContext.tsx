import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { createCliente, type CreateClientePayload } from '../services/clienti';
import type { WalkInCliente } from '../types/piscinaMappa';

type PiscinaSelectionValue = {
  selectedPrenotazioneId: string | null;
  selectedWalkInCliente: WalkInCliente | null;
  selectPrenotazioneCandidate: (id: string | null) => void;
  selectWalkInCliente: (cliente: WalkInCliente | null) => void;
  createWalkInCliente: (payload: CreateClientePayload) => Promise<WalkInCliente>;
};

const PiscinaSelectionContext = createContext<PiscinaSelectionValue | undefined>(undefined);

export function PiscinaSelectionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [selectedPrenotazioneId, setSelectedPrenotazioneId] = useState<string | null>(null);
  const [selectedWalkInCliente, setSelectedWalkInCliente] = useState<WalkInCliente | null>(null);

  // Selezione mutuamente esclusiva: scegliere una prenotazione deseleziona l'eventuale cliente
  // walk-in in attesa di assegnazione, e viceversa (un solo candidato "in mano" alla volta).
  const selectPrenotazioneCandidate = (id: string | null) => {
    setSelectedPrenotazioneId(id);
    if (id) setSelectedWalkInCliente(null);
  };

  const selectWalkInCliente = (cliente: WalkInCliente | null) => {
    setSelectedWalkInCliente(cliente);
    if (cliente) setSelectedPrenotazioneId(null);
  };

  // Crea davvero un record users.Cliente (non solo testo libero) e lo tiene "selezionato",
  // esattamente come un chip del pannello "Da assegnare": lo staff tocca poi una postazione
  // libera sulla mappa per assegnarlo, senza dover ripetere nome/telefono/note.
  const createWalkInCliente = async (payload: CreateClientePayload): Promise<WalkInCliente> => {
    const cliente = await createCliente(payload);
    const walkIn: WalkInCliente = { id: cliente.id, nome: cliente.nome, telefono: cliente.telefono };
    selectWalkInCliente(walkIn);
    return walkIn;
  };

  const value = useMemo<PiscinaSelectionValue>(
    () => ({
      selectedPrenotazioneId,
      selectedWalkInCliente,
      selectPrenotazioneCandidate,
      selectWalkInCliente,
      createWalkInCliente,
    }),
    [selectedPrenotazioneId, selectedWalkInCliente]
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
