import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  createPostazione,
  deletePostazione,
  getPiscinaInventario,
  listPostazioni,
  updatePostazione,
  type CreatePostazionePayload,
  type PiscinaInventario,
  type Postazione,
} from '../services/struttura';
import {
  createOccupazione,
  deleteOccupazione,
  deletePrenotazionePiscina,
  listOccupazioni,
  listPrenotazioniPiscina,
  updateOccupazione,
  updatePrenotazionePiscina,
  type CreateOccupazionePayload,
  type OccupazionePostazione,
  type PrenotazionePiscina,
  type UpdateOccupazionePayload,
  type UpdatePrenotazionePiscinaPayload,
} from '../services/prenotazioni';
import type { ClienteDelGiornoEntry } from '../types/piscinaMappa';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  clamp,
  DISPONIBILITA_ITEMS,
  toISODate,
  type ResiduiPrenotazione,
} from '../utils/piscinaMappa';

type DisponibilitaItem = (typeof DISPONIBILITA_ITEMS)[number] & { totale: number; residui: number };

type PiscinaMappaDataValue = {
  inventarioId: string;
  inventario: PiscinaInventario | null;
  postazioni: Postazione[];
  prenotazioni: PrenotazionePiscina[];
  occupazioni: OccupazionePostazione[];
  selectedDate: Date;
  setSelectedDate: Dispatch<SetStateAction<Date>>;
  isLoading: boolean;
  error: string | null;
  scale: number;
  setScale: Dispatch<SetStateAction<number>>;

  occupazioneByPostazione: Map<string, OccupazionePostazione>;
  remainingByPrenotazione: Map<string, ResiduiPrenotazione>;
  daAssegnare: PrenotazionePiscina[];
  soloIngresso: PrenotazionePiscina[];
  clientiDelGiorno: ClienteDelGiornoEntry[];
  disponibilita: DisponibilitaItem[] | null;

  dragPostazione: (postazione: Postazione, dxLogical: number, dyLogical: number) => void;
  addPostazione: (payload: Omit<CreatePostazionePayload, 'inventario'>) => Promise<Postazione>;
  removePostazione: (id: string) => Promise<void>;
  assignOccupazione: (payload: CreateOccupazionePayload) => Promise<OccupazionePostazione>;
  updateOccupazioneEntry: (
    id: string,
    payload: UpdateOccupazionePayload
  ) => Promise<OccupazionePostazione>;
  removeOccupazione: (id: string) => Promise<void>;
  editPrenotazione: (
    id: string,
    payload: UpdatePrenotazionePiscinaPayload
  ) => Promise<PrenotazionePiscina>;
  removePrenotazione: (id: string) => Promise<void>;
};

const PiscinaMappaDataContext = createContext<PiscinaMappaDataValue | undefined>(undefined);

function filterPrenotazioniAttive(
  prenotazioni: PrenotazionePiscina[],
  inventarioId: string
): PrenotazionePiscina[] {
  return prenotazioni.filter((p) => p.inventario === inventarioId && p.stato !== 'CANCELLED');
}

export function PiscinaMappaDataProvider({
  inventarioId,
  children,
}: Readonly<{
  inventarioId: string;
  children: ReactNode;
}>) {
  const [inventario, setInventario] = useState<PiscinaInventario | null>(null);
  const [postazioni, setPostazioni] = useState<Postazione[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazionePiscina[]>([]);
  const [occupazioni, setOccupazioni] = useState<OccupazionePostazione[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function fetchMappaData() {
      try {
        const [inv, pos, pren, occ] = await Promise.all([
          getPiscinaInventario(inventarioId),
          listPostazioni(inventarioId),
          listPrenotazioniPiscina({ data: toISODate(selectedDate) }),
          listOccupazioni({ data: toISODate(selectedDate), postazione__inventario: inventarioId }),
        ]);
        if (cancelled) return;
        setInventario(inv);
        setPostazioni(pos);
        setPrenotazioni(filterPrenotazioniAttive(pren, inventarioId));
        setOccupazioni(occ);
      } catch {
        if (!cancelled) setError('Impossibile caricare la mappa della piscina.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchMappaData();

    return () => {
      cancelled = true;
    };
  }, [inventarioId, selectedDate]);

  const occupazioneByPostazione = useMemo(
    () => new Map(occupazioni.map((o) => [o.postazione, o])),
    [occupazioni]
  );

  // Un cliente che prenota più ombrelloni e/o gazebi va assegnato una volta per unità prenotata:
  // per ogni prenotazione contiamo quante occupazioni sono già collegate, distinte per tipo
  // (una prenotazione con 2 ombrelloni + 1 gazebo richiede 2 postazioni ombrellone + 1 gazebo).
  const remainingByPrenotazione = useMemo(() => {
    const postazioneById = new Map(postazioni.map((p) => [p.id, p]));
    const usedByPren = new Map<string, ResiduiPrenotazione>();

    for (const occ of occupazioni) {
      if (!occ.prenotazione) continue;
      const postazioneOccupata = postazioneById.get(occ.postazione);
      if (!postazioneOccupata) continue;
      const usati = usedByPren.get(occ.prenotazione) ?? { ombrellone: 0, gazebo: 0, lettino: 0, sdraia: 0 };
      if (postazioneOccupata.tipo === 'GAZEBO') {
        usati.gazebo += 1;
      } else {
        usati.ombrellone += 1;
      }
      usati.lettino += occ.numero_lettini;
      usati.sdraia += occ.numero_sdraie;
      usedByPren.set(occ.prenotazione, usati);
    }

    const result = new Map<string, ResiduiPrenotazione>();
    for (const p of prenotazioni) {
      const usati = usedByPren.get(p.id) ?? { ombrellone: 0, gazebo: 0, lettino: 0, sdraia: 0 };
      result.set(p.id, {
        ombrellone: Math.max(p.ombrellone - usati.ombrellone, 0),
        gazebo: Math.max(p.gazebo - usati.gazebo, 0),
        lettino: Math.max(p.lettino - usati.lettino, 0),
        sdraia: Math.max(p.sdraia - usati.sdraia, 0),
      });
    }
    return result;
  }, [prenotazioni, occupazioni, postazioni]);

  const daAssegnare = useMemo(
    () =>
      prenotazioni.filter((p) => {
        const residui = remainingByPrenotazione.get(p.id);
        return Boolean(residui) && (residui!.ombrellone > 0 || residui!.gazebo > 0);
      }),
    [prenotazioni, remainingByPrenotazione]
  );

  const soloIngresso = useMemo(
    () => prenotazioni.filter((p) => p.ombrellone === 0 && p.gazebo === 0),
    [prenotazioni]
  );

  // Lista completa dei clienti del giorno (per il pannello "Clienti del giorno"): un cliente è
  // "completo" quando non ha più unità residue di ombrellone/gazebo da assegnare (le prenotazioni
  // solo-ingresso sono sempre complete, dato che non prevedono postazioni).
  const clientiDelGiorno = useMemo<ClienteDelGiornoEntry[]>(
    () =>
      [...prenotazioni]
        .map((p) => {
          const residui = remainingByPrenotazione.get(p.id);
          const completo = !residui || (residui.ombrellone === 0 && residui.gazebo === 0);
          return { prenotazione: p, residui, completo };
        })
        .sort((a, b) => a.prenotazione.cliente_nome.localeCompare(b.prenotazione.cliente_nome)),
    [prenotazioni, remainingByPrenotazione]
  );

  // Rispecchia il conteggio anti-overbooking del backend (prenotazioni/serializers.py):
  // somma le risorse già prenotate per la data selezionata ed escludi dal totale dell'inventario.
  const disponibilita = useMemo<DisponibilitaItem[] | null>(() => {
    if (!inventario) return null;
    const occupati = prenotazioni.reduce(
      (acc, p) => ({
        ombrellone: acc.ombrellone + p.ombrellone,
        gazebo: acc.gazebo + p.gazebo,
        lettino: acc.lettino + p.lettino,
        sdraia: acc.sdraia + p.sdraia,
      }),
      { ombrellone: 0, gazebo: 0, lettino: 0, sdraia: 0 }
    );
    return DISPONIBILITA_ITEMS.map((item) => {
      const totale = inventario[item.totaleKey] as number;
      const residui = Math.max(totale - occupati[item.key], 0);
      return { ...item, totale, residui };
    });
  }, [inventario, prenotazioni]);

  const dragPostazione = (postazione: Postazione, dxLogical: number, dyLogical: number) => {
    const newX = clamp(postazione.pos_x + (dxLogical / CANVAS_WIDTH) * 100, 0, 100);
    const newY = clamp(postazione.pos_y + (dyLogical / CANVAS_HEIGHT) * 100, 0, 100);
    setPostazioni((prev) =>
      prev.map((p) => (p.id === postazione.id ? { ...p, pos_x: newX, pos_y: newY } : p))
    );
    updatePostazione(postazione.id, { pos_x: newX, pos_y: newY }).catch(() => {
      setPostazioni((prev) => prev.map((p) => (p.id === postazione.id ? postazione : p)));
    });
  };

  const addPostazione = async (
    payload: Omit<CreatePostazionePayload, 'inventario'>
  ): Promise<Postazione> => {
    const created = await createPostazione({ ...payload, inventario: inventarioId });
    setPostazioni((prev) => [...prev, created]);
    return created;
  };

  const removePostazione = async (id: string): Promise<void> => {
    await deletePostazione(id);
    setPostazioni((prev) => prev.filter((p) => p.id !== id));
  };

  const assignOccupazione = async (
    payload: CreateOccupazionePayload
  ): Promise<OccupazionePostazione> => {
    const created = await createOccupazione(payload);
    setOccupazioni((prev) => [...prev, created]);
    return created;
  };

  const updateOccupazioneEntry = async (
    id: string,
    payload: UpdateOccupazionePayload
  ): Promise<OccupazionePostazione> => {
    const updated = await updateOccupazione(id, payload);
    setOccupazioni((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    return updated;
  };

  const removeOccupazione = async (id: string): Promise<void> => {
    await deleteOccupazione(id);
    setOccupazioni((prev) => prev.filter((o) => o.id !== id));
  };

  const editPrenotazione = async (
    id: string,
    payload: UpdatePrenotazionePiscinaPayload
  ): Promise<PrenotazionePiscina> => {
    const updated = await updatePrenotazionePiscina(id, payload);
    setPrenotazioni((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    return updated;
  };

  const removePrenotazione = async (id: string): Promise<void> => {
    await deletePrenotazionePiscina(id);
    setPrenotazioni((prev) => prev.filter((p) => p.id !== id));
    // Il backend elimina anche le OccupazionePostazione collegate (vedi
    // PrenotazionePiscinaViewSet.destroy), liberando davvero le postazioni sulla mappa:
    // rispecchiamo subito la stessa pulizia in locale, senza aspettare un refetch.
    setOccupazioni((prev) => prev.filter((o) => o.prenotazione !== id));
  };

  const value = useMemo<PiscinaMappaDataValue>(
    () => ({
      inventarioId,
      inventario,
      postazioni,
      prenotazioni,
      occupazioni,
      selectedDate,
      setSelectedDate,
      isLoading,
      error,
      scale,
      setScale,
      occupazioneByPostazione,
      remainingByPrenotazione,
      daAssegnare,
      soloIngresso,
      clientiDelGiorno,
      disponibilita,
      dragPostazione,
      addPostazione,
      removePostazione,
      assignOccupazione,
      updateOccupazioneEntry,
      removeOccupazione,
      editPrenotazione,
      removePrenotazione,
    }),
    [
      inventarioId,
      inventario,
      postazioni,
      prenotazioni,
      occupazioni,
      selectedDate,
      isLoading,
      error,
      scale,
      occupazioneByPostazione,
      remainingByPrenotazione,
      daAssegnare,
      soloIngresso,
      clientiDelGiorno,
      disponibilita,
    ]
  );

  return <PiscinaMappaDataContext.Provider value={value}>{children}</PiscinaMappaDataContext.Provider>;
}

export function usePiscinaMappaData(): PiscinaMappaDataValue {
  const context = useContext(PiscinaMappaDataContext);
  if (!context) {
    throw new Error('usePiscinaMappaData deve essere usato all\'interno di un PiscinaMappaDataProvider.');
  }
  return context;
}
