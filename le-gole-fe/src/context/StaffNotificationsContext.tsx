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
import { listPrenotazioniAsportoRecenti, listPrenotazioniRecenti } from '../services/prenotazioni';
import type { PrenotazioneAsporto, PrenotazionePiscina } from '../services/prenotazioni';
import { getNotificheLetteIds, saveNotificheLetteIds } from '../utils/storage';

// Polling, non websocket/push: il backend è WSGI, senza infrastruttura realtime.
const POLL_INTERVAL_MS = 20000;
const BANNER_DURATION_MS = 6000;
const RECENTI_LIMIT = 50;

// Union discriminata: piscina e asporto sono le sole due categorie con dati reali per ora
// (Sala/Padel restano "in arrivo" solo in UI, NotificationsBell) — ogni notifica porta con sé
// la propria prenotazione tipizzata, così il resto del codice può fare narrowing su `categoria`
// senza cast.
export type NotificaPiscina = { categoria: 'PISCINA'; prenotazione: PrenotazionePiscina };
export type NotificaAsporto = { categoria: 'ASPORTO'; prenotazione: PrenotazioneAsporto };
export type Notifica = NotificaPiscina | NotificaAsporto;

type StaffNotificationsContextValue = {
  // Prenotazioni piscina + ordini asporto più recenti (tranne CANCELLED e creata_da_staff),
  // unite e ordinate per data di creazione decrescente — il filtro per categoria vive nella UI
  // (NotificationsBell), qui la lista è già "tutto insieme".
  notifiche: Notifica[];
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
  const [notifiche, setNotifiche] = useState<Notifica[]>([]);
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
    // Promise.allSettled, non Promise.all: le due categorie sono indipendenti, un fallimento
    // dell'una (es. l'azione asporto non ancora raggiungibile) non deve azzerare anche l'altra —
    // stesso principio "best effort" già usato altrove nel progetto per richieste indipendenti.
    const [piscinaResult, asportoResult] = await Promise.allSettled([
      listPrenotazioniRecenti(RECENTI_LIMIT),
      listPrenotazioniAsportoRecenti(RECENTI_LIMIT),
    ]);

    const piscina: Notifica[] =
      piscinaResult.status === 'fulfilled'
        ? piscinaResult.value.map((prenotazione) => ({ categoria: 'PISCINA' as const, prenotazione }))
        : [];
    const asporto: Notifica[] =
      asportoResult.status === 'fulfilled'
        ? asportoResult.value.map((prenotazione) => ({ categoria: 'ASPORTO' as const, prenotazione }))
        : [];

    const ordinate = [...piscina, ...asporto].sort((a, b) =>
      a.prenotazione.created_at < b.prenotazione.created_at ? 1 : -1
    );

    if (knownIdsRef.current) {
      const nuove = ordinate.filter((n) => !knownIdsRef.current!.has(n.prenotazione.id));
      if (nuove.length > 0) {
        const prima = nuove[0];
        setBanner(
          nuove.length === 1
            ? prima.categoria === 'PISCINA'
              ? `Nuova prenotazione da ${prima.prenotazione.cliente_nome}`
              : `Nuovo ordine asporto da ${prima.prenotazione.cliente_nome}`
            : `${nuove.length} nuove notifiche ricevute`
        );
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = setTimeout(() => setBanner(null), BANNER_DURATION_MS);
      }
    }
    knownIdsRef.current = new Set(ordinate.map((n) => n.prenotazione.id));

    setNotifiche(ordinate);
    // Un errore visibile solo se ENTRAMBE le categorie falliscono: un solo fallimento resta
    // silenzioso (l'altra categoria continua a funzionare, coerente col resto "best effort").
    setError(
      piscinaResult.status === 'rejected' && asportoResult.status === 'rejected'
        ? 'Impossibile controllare le nuove notifiche.'
        : null
    );
    setIsLoading(false);
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
    () => notifiche.filter((n) => !readIds.has(n.prenotazione.id)).length,
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
