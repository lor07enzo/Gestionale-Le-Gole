import { useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { BellIcon, CheckIcon, ChevronRightIcon, ClockIcon, Icon, PhoneIcon } from '@/components/ui/icon';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { useStaffNotifications } from '../../context/StaffNotificationsContext';
import { formatDateDDMMYYYY, formatIngressiSummary, formatRelativeTime, formatTime } from '../../utils/piscinaMappa';
import type { PrenotazionePiscina } from '../../services/prenotazioni';

// Piscina è l'unica categoria con dati reali per ora — Asporto/Ristorante/Padel non hanno ancora
// un modello/API backend (sezione 1 CLAUDE.md, stesso stato "Da sviluppare" del selettore tipo
// inventario in PiscinaInventarioSection.tsx e delle card servizio in ServiziClienteSection.tsx,
// da cui riprende anche l'emoji 🎾 per coerenza). I filtri esistono comunque già in UI, pronti per
// quando quei servizi arriveranno.
type Categoria = 'TUTTI' | 'PISCINA' | 'ASPORTO' | 'RISTORANTE' | 'PADEL';

const CATEGORIE: Array<{ key: Categoria; label: string; icon: string; disponibile: boolean }> = [
  { key: 'TUTTI', label: 'Tutti', icon: '📋', disponibile: true },
  { key: 'PISCINA', label: 'Piscina', icon: '🏊', disponibile: true },
  { key: 'ASPORTO', label: 'Asporto', icon: '🥡', disponibile: false },
  { key: 'RISTORANTE', label: 'Sala', icon: '🍽️', disponibile: false },
  { key: 'PADEL', label: 'Padel', icon: '🎾', disponibile: false },
];

// Iniziali per l'avatar della card notifica — "Mario Rossi" -> "MR", "Mario" -> "MA".
function getIniziali(nome: string): string {
  const parole = nome.trim().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return '?';
  if (parole.length === 1) return parole[0].slice(0, 2).toUpperCase();
  return (parole[0][0] + parole[1][0]).toUpperCase();
}

// Segmented control (tab attivo = pillola bianca sollevata su sfondo sky-50), non la pillola
// piena sky-600 già usata dal toggle Mese/Settimana di CalendarPicker (sezione 5) — qui i tab
// sono 5, non 2, e un'unica pillola piena su 5 colonne strette risultava meno leggibile della
// variante "sollevata". Le tre categorie non ancora disponibili restano testo attenuato,
// distinguibili a colpo d'occhio senza dover leggere il messaggio sotto per capire lo stato.
//
// Layout impilato (icona sopra, etichetta sotto), non più affiancato — corretto il 2026-08-14:
// con 5 colonne su schermi stretti (telefoni reali, non i viewport desktop usati per gli
// screenshot di verifica) icona+etichetta+badge affiancati su una riga non ci stavano, e il badge
// del conteggio finiva per sconfinare visivamente nella colonna accanto. Impilare icona/etichetta
// dimezza l'ingombro orizzontale per colonna; il badge non è più un elemento in linea nel flusso
// flex (che ne allargherebbe comunque la colonna) ma un cerchietto in overlay assoluto sull'angolo
// del tab stesso (stesso pattern già usato dal badge sulla campanella, sotto in questo file) —
// non potendo più "spingere" i tab vicini, non può più sovrapporsi al tab accanto.
function CategoriaTabs({
  categoria,
  onChange,
  unreadCount,
}: Readonly<{ categoria: Categoria; onChange: (c: Categoria) => void; unreadCount: number }>) {
  return (
    <HStack space="xs" className="w-full rounded-2xl bg-sky-50 p-1">
      {CATEGORIE.map((c) => {
        const isActive = categoria === c.key;
        const showBadge = c.disponibile && unreadCount > 0;
        return (
          <Pressable
            key={c.key}
            accessibilityRole="button"
            accessibilityLabel={`Filtra per ${c.label}${c.disponibile ? '' : ' (in arrivo)'}`}
            onPress={() => onChange(c.key)}
            className={`relative flex-1 items-center justify-center rounded-xl px-0.5 py-1.5 ${
              isActive ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Text size="xs">{c.icon}</Text>
            {/* Niente numberOfLines: su web il Text di gluestack-ui è un semplice <span> che non lo
                riconosce (warning React, sezione 5/7 CLAUDE.md) — le etichette sono comunque parole
                singole brevi, non serve troncarle. */}
            <Text
              size="2xs"
              className={`font-bold ${
                !c.disponibile ? 'text-muted-foreground/70' : isActive ? 'text-sky-700' : 'text-sky-600/80'
              }`}
            >
              {c.label}
            </Text>
            {showBadge ? (
              <Box className="absolute -right-0.5 -top-0.5 min-w-3.5 items-center justify-center rounded-full border-2 border-sky-50 bg-sky-600 px-0.5">
                <Text size="2xs" className="text-center font-bold leading-none text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </Box>
            ) : null}
          </Pressable>
        );
      })}
    </HStack>
  );
}

function InfoChip({
  icon,
  children,
  tone = 'sky',
}: Readonly<{ icon?: React.ReactNode; children: React.ReactNode; tone?: 'sky' | 'emerald' }>) {
  const toneClasses =
    tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700';
  return (
    <HStack space="xs" className={`items-center rounded-full border px-2 py-0.5 ${toneClasses}`}>
      {icon}
      <Text size="2xs" className={`font-bold ${tone === 'emerald' ? 'text-emerald-700' : 'text-sky-700'}`}>
        {children}
      </Text>
    </HStack>
  );
}

// Risorse fisiche prenotate (oltre ai soli ingressi, già riassunti da formatIngressiSummary) —
// solo quelle effettivamente > 0, per non riempire la card di chip a zero prive di informazione.
function risorseFisichePrenotate(p: PrenotazionePiscina): Array<{ icon: string; count: number }> {
  return [
    { icon: '⛱️', count: p.ombrellone },
    { icon: '⛺', count: p.gazebo },
    { icon: '🛏️', count: p.lettino },
    { icon: '🪑', count: p.sdraia },
  ].filter((r) => r.count > 0);
}

// Una volta segnata come letta la notifica esce dalla lista (NotificationsBell la filtra) — ogni
// card qui è quindi sempre "non letta" per definizione, niente più variante di stile per lo stato
// letto (semplificazione rispetto alla versione precedente, che teneva le lette visibili).
//
// Ridisegnata (2026-08-14) — segnalato dall'utente come poco leggibile: il rigo risorse era
// un'unica stringa concatenata a mano con spazi finali condizionali (niente struttura visiva per
// distinguere ingressi da ombrelloni/gazebi/lettini/sdraie), il telefono era testo grigio nudo
// senza icona, e un pallino accanto al nome non comunicava nulla (ogni card qui è già "non letta"
// per costruzione — vedi commento sopra — quindi un indicatore extra di "nuovo" era ridondante).
// Il rigo risorse ora riusa `InfoChip` (lo stesso già usato per data/ora e piscina, sezione 11)
// per ogni risorsa presente, sotto un'etichetta "Prenotato" — stesso linguaggio visivo di
// "Prenotato:" già usato in `ClientiDelGiornoSheet.tsx` (sezione 5), non una convenzione nuova.
function NotificaCard({
  prenotazione,
  onDismiss,
  onOpen,
}: Readonly<{
  prenotazione: PrenotazionePiscina;
  onDismiss: () => void;
  onOpen: () => void;
}>) {
  return (
    <Box className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/50 shadow-sm">
      {/* Barra di accento a sinistra: un Box colorato "sorella" del contenuto, non un
          border-l-* — nessun precedente nel progetto per utility di bordo per-lato, preferito
          restare su bg-* (pattern già ampiamente collaudato altrove) piuttosto che rischiare
          un'incompatibilità silenziosa di NativeWind v5/react-native-css (ancora alpha, sezione 4). */}
      <HStack className="items-stretch">
        <Box className="w-1 bg-sky-500" />

        <HStack space="xs" className="flex-1 items-start justify-between p-2.5">
          {/* Pressable "sorella", non annidata in quella del pulsante segna-come-letta: nidificare
              due Pressable rischierebbe un doppio trigger su web (react-native-web fa risalire il
              click al genitore, stesso principio già documentato per DateNavigator, sezione 5).
              active:bg-* dà un feedback di pressione visibile (oltre al chevron sotto) — lo stesso
              linguaggio "riga cliccabile" di una qualunque lista di navigazione. */}
          <Pressable
            onPress={onOpen}
            accessibilityRole="button"
            accessibilityLabel={`Vai alla mappa piscina per la prenotazione di ${prenotazione.cliente_nome}`}
            className="-m-1 flex-1 flex-row items-start gap-2 rounded-xl p-1 active:bg-sky-100/70"
          >
            <Box className="h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-600">
              <Text size="2xs" className="font-bold text-white">
                {getIniziali(prenotazione.cliente_nome)}
              </Text>
            </Box>

            <VStack space="xs" className="flex-1">
              <HStack space="xs" className="items-center justify-between">
                <Text size="xs" className="flex-1 font-semibold text-sky-900">
                  {prenotazione.cliente_nome}
                </Text>
                <Text size="2xs" className="shrink-0 text-muted-foreground">
                  {formatRelativeTime(prenotazione.created_at)}
                </Text>
              </HStack>

              <HStack space="xs" className="flex-wrap items-center">
                <InfoChip icon={<Icon as={ClockIcon} size="2xs" className="text-sky-700" />} tone="sky">
                  {formatDateDDMMYYYY(prenotazione.data)} · {formatTime(prenotazione.ora)}
                </InfoChip>
                <InfoChip tone="emerald">🏊 {prenotazione.inventario_nome}</InfoChip>
              </HStack>

              <HStack space="xs" className="items-center">
                <Icon as={PhoneIcon} size="2xs" className="text-sky-900/40" />
                <Text size="2xs" className="text-muted-foreground">
                  {prenotazione.cliente_telefono}
                </Text>
              </HStack>

              {prenotazione.note ? (
                <Text size="2xs" className="italic text-sky-900/70">
                  📝 {prenotazione.note}
                </Text>
              ) : null}

              <Box className="mt-0.5 h-px w-full bg-border" />

              <VStack space="xs">
                <Text size="2xs" className="font-bold uppercase tracking-wide text-sky-900/40">
                  Prenotato
                </Text>
                <HStack space="xs" className="flex-wrap items-center">
                  <InfoChip tone="sky">{formatIngressiSummary(prenotazione)}</InfoChip>
                  {risorseFisichePrenotate(prenotazione).map((r) => (
                    <InfoChip key={r.icon} tone="sky">
                      {r.icon} {r.count}
                    </InfoChip>
                  ))}
                </HStack>
              </VStack>
            </VStack>

            {/* Indicatore di navigazione (disclosure chevron, come una riga di lista standard):
                segnale visivo esplicito, in aggiunta al feedback active:bg-* sopra, che l'intera
                riga porta altrove al tocco. */}
            <Icon as={ChevronRightIcon} size="xs" className="mt-1 shrink-0 text-sky-300" />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Segna come letta la notifica di ${prenotazione.cliente_nome}`}
            onPress={onDismiss}
            hitSlop={8}
            className="h-7 w-7 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-white active:bg-emerald-50"
          >
            <Icon as={CheckIcon} size="xs" className="text-sky-400" />
          </Pressable>
        </HStack>
      </HStack>
    </Box>
  );
}

// Banner "a comparsa" per una nuova prenotazione rilevata durante il polling — montato subito
// sotto l'header staff (app/staff/_layout.tsx), sopra il contenuto della pagina corrente.
export function NotificationsBanner() {
  const { banner, dismissBanner } = useStaffNotifications();
  if (!banner) return null;

  return (
    <Pressable onPress={dismissBanner} accessibilityRole="button" accessibilityLabel="Chiudi avviso">
      <Box className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 md:px-8">
        <Text size="sm" className="text-center font-medium text-amber-800">
          🔔 {banner}
        </Text>
      </Box>
    </Pressable>
  );
}

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [categoria, setCategoria] = useState<Categoria>('TUTTI');
  const { notifiche, unreadCount, isLoading, error, isRead, markAsRead } = useStaffNotifications();

  // Solo Piscina ha dati reali oggi: Asporto/Ristorante mostrano sempre una lista vuota con un
  // messaggio dedicato, non un errore — coerente col resto dell'app per i servizi "Da sviluppare".
  // Le notifiche già lette sono filtrate qui, non solo attenuate: una volta gestita (o segnata
  // esplicitamente) una notifica non ha più motivo di restare nell'elenco — l'elenco è quindi
  // sempre "cosa manca da vedere", non un archivio di tutto l'arrivato di recente.
  const categoriaAttiva = CATEGORIE.find((c) => c.key === categoria)!;
  const visibili = useMemo(
    () => (categoriaAttiva.disponibile ? notifiche.filter((p) => !isRead(p.id)) : []),
    [categoriaAttiva.disponibile, notifiche, isRead]
  );

  const handleOpenPrenotazione = (p: PrenotazionePiscina) => {
    markAsRead(p.id);
    setIsOpen(false);
    router.push(`/staff/piscina/${p.inventario}?data=${p.data}` as Href);
  };

  return (
    <>
      <Pressable
        className="relative h-9 w-9 items-center justify-center md:h-10 md:w-10"
        onPress={() => setIsOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={
          unreadCount > 0 ? `Notifiche prenotazioni, ${unreadCount} da leggere` : 'Notifiche prenotazioni'
        }
      >
        <Icon as={BellIcon} size="md" className="text-sky-700" />
        {unreadCount > 0 ? (
          <Box className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-sky-600 px-1">
            <Text size="2xs" className="text-center font-bold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </Box>
        ) : null}
      </Pressable>

      <Actionsheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent className="max-h-[85vh]" aria-label="Notifiche prenotazioni">
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <ActionsheetScrollView className="w-full">
            <VStack space="md" className="w-full pb-6 pt-1">
              <HStack className="items-center justify-between px-1">
                <Heading size="sm">Notifiche prenotazioni</Heading>
                {visibili.length > 0 ? (
                  <Box className="rounded-full bg-sky-600 px-2.5 py-1">
                    <Text size="2xs" className="font-bold text-white">
                      {visibili.length} da leggere
                    </Text>
                  </Box>
                ) : null}
              </HStack>

              <CategoriaTabs categoria={categoria} onChange={setCategoria} unreadCount={unreadCount} />

              {!categoriaAttiva.disponibile ? (
                <VStack space="xs" className="items-center rounded-2xl border border-dashed border-border px-4 py-6">
                  <Text size="2xl">{categoriaAttiva.icon}</Text>
                  <Text size="sm" className="text-center text-muted-foreground">
                    Le notifiche per {categoriaAttiva.label} saranno disponibili quando questo servizio verrà
                    sviluppato.
                  </Text>
                </VStack>
              ) : (
                <>
                  {isLoading && visibili.length === 0 ? (
                    <Box className="items-center py-6">
                      <Spinner size="small" />
                    </Box>
                  ) : null}

                  {error ? (
                    <Text size="xs" className="px-1 text-destructive">
                      {error}
                    </Text>
                  ) : null}

                  {!isLoading && visibili.length === 0 && !error ? (
                    <VStack space="xs" className="items-center rounded-2xl border border-dashed border-border px-4 py-6">
                      <Text size="2xl">✅</Text>
                      <Text size="sm" className="text-center text-muted-foreground">
                        Nessuna notifica da leggere.
                      </Text>
                    </VStack>
                  ) : null}

                  {visibili.map((p) => (
                    <NotificaCard
                      key={p.id}
                      prenotazione={p}
                      onDismiss={() => markAsRead(p.id)}
                      onOpen={() => handleOpenPrenotazione(p)}
                    />
                  ))}
                </>
              )}
            </VStack>
          </ActionsheetScrollView>
        </ActionsheetContent>
      </Actionsheet>
    </>
  );
}
