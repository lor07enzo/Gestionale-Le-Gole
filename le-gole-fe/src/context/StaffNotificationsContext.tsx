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
import { listPrenotazioniRecenti } from '../services/prenotazioni';
import type { PrenotazionePiscina } from '../services/prenotazioni';
import { getNotificheLetteIds, saveNotificheLetteIds } from '../utils/storage';

// Polling, non websocket/push: il backend è WSGI, senza infrastruttura realtime.
const POLL_INTERVAL_MS = 20000;
const BANNER_DURATION_MS = 6000;
const RECENTI_LIMIT = 50;

type StaffNotificationsContextValue = {
  // Prenotazioni piscina più recenti (tranne CANCELLED), più recenti prima. Unica categoria con
  // dati reali per ora: il filtro categoria vive nella UI (NotificationsBell).
  notifiche: PrenotazionePiscina[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  // null = nessun banner attivo. Si azzera da solo dopo BANNER_DURATION_MS.
  banner: string | null;
  dismissBanner: () => void;
  isRead: (id: string) => boolean;
  markAsRead: (id: string) => void;
};

const StaffNotificationsContext = createContext<StaffNotificationsContextValue | undefined>(undefined);

export function StaffNotificationsProvider({ children }: { children: ReactNode }) {
  const [notifiche, setNotifiche] = useState<PrenotazionePiscina[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [banner, setBanner] = useState<string | null>(null);

  // null finché non arriva il primo poll: evita un banner per l'arretrato già esistente al mount.
  const knownIdsRef = useRef<Set<string> | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getNotificheLetteIds();
      if (!cancelled) setReadIds(new Set(stored));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const poll = useCallback(async () => {
    try {
      const risultato = await listPrenotazioniRecenti(RECENTI_LIMIT);
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

      setNotifiche(ordinati);
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

  const markAsRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    // Rilegge lo storage al momento della scrittura invece di salvare la copia in memoria di
    // questa scheda: con due schede aperte, la seconda sovrascriveva per intero la lettura
    // dell'altra. Resta una race più stretta se due marcature avvengono nello stesso istante.
    (async () => {
      const current = await getNotificheLetteIds();
      if (current.includes(id)) return;
      await saveNotificheLetteIds([...current, id]);
    })();
  }, []);

  const isRead = useCallback((id: string) => readIds.has(id), [readIds]);

  const unreadCount = useMemo(
    () => notifiche.filter((p) => !readIds.has(p.id)).length,
    [notifiche, readIds]
  );

  const value = useMemo<StaffNotificationsContextValue>(
    () => ({
      notifiche,
      unreadCount,
      isLoading,
      error,
      banner,
      dismissBanner,
      isRead,
      markAsRead,
    }),
    [notifiche, unreadCount, isLoading, error, banner, dismissBanner, isRead, markAsRead]
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
