import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { listPrenotazioniPendenti, updatePrenotazionePiscina } from '../services/prenotazioni';
import type { PrenotazionePiscina } from '../services/prenotazioni';
import { getNotificheLastSeenAt, saveNotificheLastSeenAt } from '../utils/storage';

// Polling, non websocket/push: il backend qui è WSGI (runserver), senza infrastruttura realtime
// (sezione 10 di CLAUDE.md) — un intervallo di 20s è un compromesso ragionevole tra "quasi in
// tempo reale" e non sovraccaricare il server con richieste troppo frequenti.
const POLL_INTERVAL_MS = 20000;
// Il banner di una nuova prenotazione resta visibile un po' più a lungo di un semplice toast,
// dato che non c'è un pulsante di chiusura oltre al tap sul banner stesso.
const BANNER_DURATION_MS = 6000;

type StaffNotificationsContextValue = {
  // Tutte le prenotazioni self-service PENDING, su qualsiasi piscina/data, più recenti prima.
  pendenti: PrenotazionePiscina[];
  // Quante, tra queste, sono arrivate dopo l'ultima volta che lo staff ha aperto il pannello
  // (persistito tra sessioni, vedi utils/storage.ts) — non un semplice conteggio del poll.
  nuoveCount: number;
  isLoading: boolean;
  error: string | null;
  // Messaggio del banner "a comparsa" per una nuova prenotazione rilevata durante il polling
  // (null = nessun banner attivo). Si azzera da solo dopo BANNER_DURATION_MS.
  banner: string | null;
  dismissBanner: () => void;
  markAllAsSeen: () => void;
  confirmingId: string | null;
  confirmPrenotazione: (id: string) => Promise<void>;
};

const StaffNotificationsContext = createContext<StaffNotificationsContextValue | undefined>(undefined);

export function StaffNotificationsProvider({ children }: { children: ReactNode }) {
  const [pendenti, setPendenti] = useState<PrenotazionePiscina[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // null finché non arriva il primo poll riuscito: serve a non far comparire un banner per
  // l'intero "arretrato" di prenotazioni già pendenti al primo caricamento della pagina, solo
  // per quelle che compaiono tra un poll e il successivo durante la sessione.
  const knownIdsRef = useRef<Set<string> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getNotificheLastSeenAt();
      if (!cancelled) setLastSeenAt(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const risultato = await listPrenotazioniPendenti();
      const ordinati = [...risultato].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      if (knownIdsRef.current) {
        const nuove = ordinati.filter((p) => !knownIdsRef.current!.has(p.id));
        if (nuove.length > 0) {
          setBanner(
            nuove.length === 1
              ? `Nuova prenotazione da ${nuove[0].cliente_nome}`
              : `${nuove.length} nuove prenotazioni ricevute`
          );
          if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
          bannerTimeoutRef.current = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
        }
      }
      knownIdsRef.current = new Set(ordinati.map((p) => p.id));

      setPendenti(ordinati);
      setError(null);
    } catch {
      setError('Impossibile controllare le nuove prenotazioni.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(
    () => () => {
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    },
    []
  );

  const dismissBanner = useCallback(() => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    setBanner(null);
  }, []);

  const markAllAsSeen = useCallback(() => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    saveNotificheLastSeenAt(now);
  }, []);

  const confirmPrenotazione = useCallback(async (id: string) => {
    setConfirmingId(id);
    try {
      await updatePrenotazionePiscina(id, { stato: 'CONFIRMED' });
      setPendenti((prev) => prev.filter((p) => p.id !== id));
      knownIdsRef.current?.delete(id);
    } finally {
      setConfirmingId(null);
    }
  }, []);

  const nuoveCount = useMemo(
    () => (lastSeenAt ? pendenti.filter((p) => p.created_at > lastSeenAt).length : pendenti.length),
    [pendenti, lastSeenAt]
  );

  const value = useMemo<StaffNotificationsContextValue>(
    () => ({
      pendenti,
      nuoveCount,
      isLoading,
      error,
      banner,
      dismissBanner,
      markAllAsSeen,
      confirmingId,
      confirmPrenotazione,
    }),
    [pendenti, nuoveCount, isLoading, error, banner, dismissBanner, markAllAsSeen, confirmingId, confirmPrenotazione]
  );

  return <StaffNotificationsContext.Provider value={value}>{children}</StaffNotificationsContext.Provider>;
}

export function useStaffNotifications(): StaffNotificationsContextValue {
  const context = useContext(StaffNotificationsContext);
  if (!context) {
    throw new Error("useStaffNotifications deve essere usato all'interno di un StaffNotificationsProvider.");
  }
  return context;
}
