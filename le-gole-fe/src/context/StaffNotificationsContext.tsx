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

// Polling, non websocket/push: il backend qui è WSGI (runserver), senza infrastruttura realtime
// (sezione 10 di CLAUDE.md) — un intervallo di 20s è un compromesso ragionevole tra "quasi in
// tempo reale" e non sovraccaricare il server con richieste troppo frequenti.
const POLL_INTERVAL_MS = 20000;
// Il banner di una nuova prenotazione resta visibile un po' più a lungo di un semplice toast,
// dato che non c'è un pulsante di chiusura oltre al tap sul banner stesso.
const BANNER_DURATION_MS = 6000;
// Quante prenotazioni recenti tenere in memoria per il pannello — oltre questo numero una
// prenotazione più vecchia non può comunque più "ricomparire" (l'ordine è per data di
// creazione, solo le nuove entrano in cima), quindi un id letto che ne esce non serve più.
const RECENTI_LIMIT = 50;

type StaffNotificationsContextValue = {
  // Le prenotazioni piscina più recenti (qualsiasi data/stato tranne CANCELLED), più recenti
  // prima. Unica categoria con dati reali per ora — Asporto/Ristorante non hanno ancora un
  // modello backend (sezione 1 CLAUDE.md), il filtro categoria vive nella UI (NotificationsBell).
  notifiche: PrenotazionePiscina[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  // Messaggio del banner "a comparsa" per una nuova prenotazione rilevata durante il polling
  // (null = nessun banner attivo). Si azzera da solo dopo BANNER_DURATION_MS.
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

  // null finché non arriva il primo poll riuscito: serve a non far comparire un banner per
  // l'intero "arretrato" già esistente al primo caricamento della pagina, solo per le
  // prenotazioni che compaiono tra un poll e il successivo durante la sessione.
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
    // Persistenza separata dall'update dello stato React sopra: rilegge lo storage al momento
    // della scrittura e ci unisce il nuovo id, invece di salvare lo Set in memoria di questa
    // scheda/sessione (che potrebbe essere rimasto indietro). Con due schede aperte sulla stessa
    // origine, la seconda a marcare una lettura sovrascriveva per intero staffNotificheLetteIds
    // con la propria copia locale, cancellando quanto la prima aveva appena salvato — bug
    // riprodotto con Playwright (due schede, letture diverse: la seconda scrittura faceva
    // sparire la prima). Una race identica-ma-più-stretta resta possibile se due marcature
    // avvengono nello stesso istante esatto in schede diverse, accettabile per un dato non
    // critico come lo stato letto/non letto di una notifica.
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
