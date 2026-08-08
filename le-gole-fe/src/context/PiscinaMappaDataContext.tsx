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
  createPrenotazionePiscina,
  deleteOccupazione,
  listGiorniPieni,
  listOccupazioni,
  listPrenotazioniPiscina,
  marcaGiornoPieno,
  rimuoviGiornoPieno,
  updateOccupazione,
  updatePrenotazionePiscina,
  type CreateOccupazionePayload,
  type CreatePrenotazionePiscinaPayload,
  type GiornoPienoPiscina,
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
  parseISODate,
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
  isPastDate: boolean;
  isLoading: boolean;
  error: string | null;
  scale: number;
  setScale: Dispatch<SetStateAction<number>>;

  // Modalità modifica posizioni: attiva = postazioni trascinabili ma non assegnabili; disattiva
  // = l'opposto. Si disattiva ad ogni cambio data e non ha effetto sui giorni passati.
  isEditMode: boolean;
  setIsEditMode: Dispatch<SetStateAction<boolean>>;

  occupazioneByPostazione: Map<string, OccupazionePostazione>;
  remainingByPrenotazione: Map<string, ResiduiPrenotazione>;
  daAssegnare: PrenotazionePiscina[];
  soloIngresso: PrenotazionePiscina[];
  clientiDelGiorno: ClienteDelGiornoEntry[];
  disponibilita: DisponibilitaItem[] | null;

  // "Giorno pieno" (sezione 5 CLAUDE.md): marcatura manuale staff, blocca solo le nuove
  // prenotazioni self-service pubbliche per la data selezionata — null quando non segnato.
  giornoPieno: GiornoPienoPiscina | null;
  isTogglingGiornoPieno: boolean;
  toggleGiornoPieno: () => Promise<void>;

  dragPostazione: (postazione: Postazione, dxLogical: number, dyLogical: number) => void;
  addPostazione: (payload: Omit<CreatePostazionePayload, 'inventario'>) => Promise<Postazione>;
  removePostazione: (id: string) => Promise<void>;
  assignOccupazione: (payload: CreateOccupazionePayload) => Promise<OccupazionePostazione>;
  updateOccupazioneEntry: (
    id: string,
    payload: UpdateOccupazionePayload
  ) => Promise<OccupazionePostazione>;
  removeOccupazione: (id: string) => Promise<void>;
  addPrenotazione: (payload: CreatePrenotazionePiscinaPayload) => Promise<PrenotazionePiscina>;
  editPrenotazione: (
    id: string,
    payload: UpdatePrenotazionePiscinaPayload
  ) => Promise<PrenotazionePiscina>;
  // Annulla (PATCH stato='CANCELLED') — dal 2026-08-07 unica azione di rimozione disponibile per
  // lo staff, l'eliminazione definitiva (DELETE reale) non è più esposta lato UI: la prenotazione
  // resta nello storico cliente (sezione 5 CLAUDE.md), il backend libera da sé le postazioni
  // assegnate (PrenotazionePiscinaViewSet.perform_update), qui rispecchiamo subito la stessa
  // pulizia in locale rimuovendo la prenotazione dalle liste del giorno e le occupazioni collegate.
  cancelPrenotazione: (id: string) => Promise<void>;
};

const PiscinaMappaDataContext = createContext<PiscinaMappaDataValue | undefined>(undefined);

function filterPrenotazioniAttive(
  prenotazioni: PrenotazionePiscina[],
  inventarioId: string
): PrenotazionePiscina[] {
  return prenotazioni.filter((p) => p.inventario === inventarioId && p.stato !== 'CANCELLED');
}

// Il più presto tra gli orari di arrivo delle postazioni già assegnate a questa prenotazione, se
// ce n'è almeno una — altrimenti l'orario originale della prenotazione. Più postazioni potrebbero
// avere orari diversi (modificabili singolarmente, sezione 5): mostriamo il più presto perché è
// il dato più utile per lo staff (il primo momento in cui aspettarsi qualcuno di questo gruppo).
function calcolaOrarioEffettivo(prenotazione: PrenotazionePiscina, occupazioni: OccupazionePostazione[]): string {
  if (occupazioni.length === 0) return prenotazione.ora;
  return occupazioni.reduce(
    (min, o) => (o.orario_arrivo_previsto < min ? o.orario_arrivo_previsto : min),
    occupazioni[0].orario_arrivo_previsto
  );
}

export function PiscinaMappaDataProvider({
  inventarioId,
  initialDate,
  children,
}: Readonly<{
  inventarioId: string;
  // 'YYYY-MM-DD' opzionale (es. dal query param ?data= impostato dal pannello notifiche staff,
  // NotificationsBell): se presente, la mappa si apre già su quel giorno invece che su oggi.
  initialDate?: string;
  children: ReactNode;
}>) {
  const [inventario, setInventario] = useState<PiscinaInventario | null>(null);
  const [postazioni, setPostazioni] = useState<Postazione[]>([]);
  const [prenotazioni, setPrenotazioni] = useState<PrenotazionePiscina[]>([]);
  const [occupazioni, setOccupazioni] = useState<OccupazionePostazione[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => (initialDate ? parseISODate(initialDate) : new Date()));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [giornoPieno, setGiornoPieno] = useState<GiornoPienoPiscina | null>(null);
  const [isTogglingGiornoPieno, setIsTogglingGiornoPieno] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Cambiare data esce sempre dalla modalità modifica: evita di lasciarla accesa per errore
  // navigando su un altro giorno (le postazioni sono comunque una risorsa strutturale condivisa
  // da tutte le date, non ha senso restare "in modifica" attraversando giorni diversi).
  useEffect(() => {
    setIsEditMode(false);
  }, [selectedDate]);

  // Risincronizza selectedDate se initialDate cambia mentre il componente resta montato — es.
  // due notifiche diverse per la stessa piscina aperte in sequenza dal pannello notifiche
  // (NotificationsBell), dove solo il query param ?data= cambia senza uno smontaggio della
  // pagina. Il useState iniziale sopra copre solo il primissimo mount.
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(parseISODate(initialDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDate]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function fetchMappaData() {
      try {
        const dataSelezionata = toISODate(selectedDate);
        const [inv, pos, pren, occ, giorniPieni] = await Promise.all([
          getPiscinaInventario(inventarioId),
          listPostazioni(inventarioId, dataSelezionata),
          listPrenotazioniPiscina({ data: dataSelezionata }),
          listOccupazioni({ data: dataSelezionata, postazione__inventario: inventarioId }),
          listGiorniPieni({ inventario: inventarioId, data: dataSelezionata }),
        ]);
        if (cancelled) return;
        setInventario(inv);
        setPostazioni(pos);
        setPrenotazioni(filterPrenotazioniAttive(pren, inventarioId));
        setOccupazioni(occ);
        setGiornoPieno(giorniPieni[0] ?? null);
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

  // Confronto per data (non per istante): un giorno passato resta tale per tutta la sua durata,
  // indipendentemente dall'ora corrente.
  const isPastDate = toISODate(selectedDate) < toISODate(new Date());

  const occupazioneByPostazione = useMemo(
    () => new Map(occupazioni.map((o) => [o.postazione, o])),
    [occupazioni]
  );

  // Tutte le OccupazionePostazione collegate a ciascuna prenotazione (es. 3 gazebi -> 3 voci) —
  // usato per l'orario effettivo e il conteggio arrivi in clientiDelGiorno, sotto.
  const occupazioniByPrenotazione = useMemo(() => {
    const map = new Map<string, OccupazionePostazione[]>();
    for (const occ of occupazioni) {
      if (!occ.prenotazione) continue;
      const lista = map.get(occ.prenotazione) ?? [];
      lista.push(occ);
      map.set(occ.prenotazione, lista);
    }
    return map;
  }, [occupazioni]);

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

  // "Completo" = nessuna unità ombrellone/gazebo residua (solo-ingresso sempre completo).
  // Ordinati: da assegnare in cima, poi per orario effettivo crescente (vedi calcolaOrarioEffettivo).
  const clientiDelGiorno = useMemo<ClienteDelGiornoEntry[]>(
    () =>
      [...prenotazioni]
        .map((p) => {
          const residui = remainingByPrenotazione.get(p.id);
          const completo = !residui || (residui.ombrellone === 0 && residui.gazebo === 0);
          const occupazioniAssegnate = occupazioniByPrenotazione.get(p.id) ?? [];
          return {
            prenotazione: p,
            residui,
            completo,
            occupazioni: occupazioniAssegnate,
            orarioEffettivo: calcolaOrarioEffettivo(p, occupazioniAssegnate),
          };
        })
        .sort((a, b) => {
          if (a.completo !== b.completo) return a.completo ? 1 : -1;
          return a.orarioEffettivo.localeCompare(b.orarioEffettivo);
        }),
    [prenotazioni, remainingByPrenotazione, occupazioniByPrenotazione]
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
    // Backstop difensivo: l'interazione di drag è già disabilitata lato UI (PostazioneMarker)
    // per i giorni passati, ma qui evitiamo comunque qualunque scrittura se richiamata a monte.
    if (isPastDate) return;
    const newX = clamp(postazione.pos_x + (dxLogical / CANVAS_WIDTH) * 100, 0, 100);
    const newY = clamp(postazione.pos_y + (dyLogical / CANVAS_HEIGHT) * 100, 0, 100);
    setPostazioni((prev) =>
      prev.map((p) => (p.id === postazione.id ? { ...p, pos_x: newX, pos_y: newY } : p))
    );
    updatePostazione(postazione.id, { pos_x: newX, pos_y: newY }).catch(() => {
      setPostazioni((prev) => prev.map((p) => (p.id === postazione.id ? postazione : p)));
    });
    // Il backend registra da sé lo storico posizione per oggi (PostazioneViewSet.perform_update
    // → registra_posizione_storico), niente da sincronizzare qui lato frontend.
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

  const addPrenotazione = async (
    payload: CreatePrenotazionePiscinaPayload
  ): Promise<PrenotazionePiscina> => {
    const created = await createPrenotazionePiscina(payload);
    setPrenotazioni((prev) => [...prev, created]);
    return created;
  };

  const editPrenotazione = async (
    id: string,
    payload: UpdatePrenotazionePiscinaPayload
  ): Promise<PrenotazionePiscina> => {
    const updated = await updatePrenotazionePiscina(id, payload);
    setPrenotazioni((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    return updated;
  };

  const cancelPrenotazione = async (id: string): Promise<void> => {
    await updatePrenotazionePiscina(id, { stato: 'CANCELLED' });
    // Il record non viene eliminato lato backend (resta nello storico cliente) — ma sulla mappa
    // del giorno una prenotazione CANCELLED non ha più nulla da fare (stesso filtro già applicato
    // al caricamento, filterPrenotazioniAttive sopra): la togliamo dallo stato locale invece di
    // lasciarla come riga "fantasma" a 0 residui.
    setPrenotazioni((prev) => prev.filter((p) => p.id !== id));
    setOccupazioni((prev) => prev.filter((o) => o.prenotazione !== id));
  };

  const toggleGiornoPieno = async (): Promise<void> => {
    setIsTogglingGiornoPieno(true);
    try {
      if (giornoPieno) {
        await rimuoviGiornoPieno(giornoPieno.id);
        setGiornoPieno(null);
      } else {
        const created = await marcaGiornoPieno({ inventario: inventarioId, data: toISODate(selectedDate) });
        setGiornoPieno(created);
      }
    } finally {
      setIsTogglingGiornoPieno(false);
    }
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
      isPastDate,
      isLoading,
      error,
      scale,
      setScale,
      isEditMode,
      setIsEditMode,
      occupazioneByPostazione,
      remainingByPrenotazione,
      daAssegnare,
      soloIngresso,
      clientiDelGiorno,
      disponibilita,
      giornoPieno,
      isTogglingGiornoPieno,
      toggleGiornoPieno,
      dragPostazione,
      addPostazione,
      removePostazione,
      assignOccupazione,
      updateOccupazioneEntry,
      removeOccupazione,
      addPrenotazione,
      editPrenotazione,
      cancelPrenotazione,
    }),
    [
      inventarioId,
      inventario,
      postazioni,
      prenotazioni,
      occupazioni,
      selectedDate,
      isPastDate,
      giornoPieno,
      isTogglingGiornoPieno,
      isLoading,
      error,
      scale,
      isEditMode,
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
