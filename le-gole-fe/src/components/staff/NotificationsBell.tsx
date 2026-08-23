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
import type { Notifica, NotificaAsporto, NotificaPiscina } from '../../context/StaffNotificationsContext';
import { formatDateDDMMYYYY, formatRelativeTime, formatTime } from '../../utils/piscinaMappa';
import { formatPrezzo } from '../../utils/prezzi';
import type { PrenotazionePiscina } from '../../services/prenotazioni';

// Piscina e Asporto hanno entrambe dati reali ora; Sala/Padel non hanno ancora un modello/API
// backend, ma i filtri esistono già in UI (badge "in arrivo" nel messaggio sotto).
type Categoria = 'TUTTI' | 'PISCINA' | 'ASPORTO' | 'RISTORANTE' | 'PADEL';

const CATEGORIE: Array<{ key: Categoria; label: string; icon: string; disponibile: boolean }> = [
  { key: 'TUTTI', label: 'Tutti', icon: '📋', disponibile: true },
  { key: 'PISCINA', label: 'Piscina', icon: '🏊', disponibile: true },
  { key: 'ASPORTO', label: 'Asporto', icon: '🥡', disponibile: true },
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

// Icona sopra, etichetta sotto (non affiancate): su 5 colonne strette il badge conteggio in linea
// finiva per sconfinare nel tab accanto — ora è un overlay assoluto sull'angolo.
//
// `unreadByCategoria` (non più un unico `unreadCount` condiviso): con due categorie reali ora,
// ogni tab deve mostrare il proprio conteggio non letto, non lo stesso numero ripetuto ovunque —
// bug della prima versione (un'unica categoria disponibile lo nascondeva).
function CategoriaTabs({
  categoria,
  onChange,
  unreadByCategoria,
}: Readonly<{
  categoria: Categoria;
  onChange: (c: Categoria) => void;
  unreadByCategoria: Record<Categoria, number>;
}>) {
  return (
    <HStack space="xs" className="w-full rounded-2xl bg-sky-50 p-1">
      {CATEGORIE.map((c) => {
        const isActive = categoria === c.key;
        const count = unreadByCategoria[c.key];
        const showBadge = c.disponibile && count > 0;
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
                  {count > 9 ? '9+' : count}
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

// Solo le risorse > 0, per non riempire la card di chip a zero.
function risorseFisichePrenotate(p: PrenotazionePiscina): Array<{ icon: string; count: number }> {
  return [
    { icon: '⛱️', count: p.ombrellone },
    { icon: '⛺', count: p.gazebo },
    { icon: '🛏️', count: p.lettino },
    { icon: '🪑', count: p.sdraia },
  ].filter((r) => r.count > 0);
}

// Solo se c'è almeno un ingresso intero, ridotto, bambino o gratuito da mostrare — a differenza
// di `formatIngressiSummary` (utils/piscinaMappa.ts, riusata altrove per lo storico/riepiloghi
// staff, dove il "🎟️ 0" è voluto per coerenza tabellare), qui nella card notifica un "🎟️ 0" senza
// ingressi interi è solo rumore: se l'ingresso è un ridotto/bambino puro, il chip lo mostra senza
// lo zero davanti. `null` se non c'è alcun ingresso di alcun tipo (nessun chip da renderizzare).
function formatIngressiChip(p: PrenotazionePiscina): string | null {
  const parti: string[] = [];
  if (p.ingressi > 0) parti.push(`🎟️ ${p.ingressi}`);
  if (p.ingressi_ridotti > 0) parti.push(`🌇 ${p.ingressi_ridotti}`);
  if (p.ingressi_bambini > 0) parti.push(`🧒 ${p.ingressi_bambini}`);
  if (p.ingressi_gratuiti > 0) parti.push(`🆓 ${p.ingressi_gratuiti}`);
  return parti.length > 0 ? parti.join(' ') : null;
}

// Una volta segnata come letta la notifica esce dalla lista: ogni card qui è sempre "non letta".
// `onOpen` porta alla mappa piscina (con la data della prenotazione) per la piscina, alla pagina
// di dettaglio ordine per l'asporto (sezione 15, `app/staff/asporto/ordini/[ordineId].tsx`) —
// entrambe le categorie sono ormai cliccabili, nessuna delle due promette più un'azione che il
// sistema non può mantenere.
function NotificaCard({
  notifica,
  onDismiss,
  onOpen,
}: Readonly<{
  notifica: Notifica;
  onDismiss: () => void;
  onOpen?: () => void;
}>) {
  const { prenotazione } = notifica;
  const isPiscina = notifica.categoria === 'PISCINA';

  // Ridotta a due sole righe di corpo (più la nota, se presente) — prima erano sette blocchi
  // impilati (nome/ora, chip data-categoria, riga telefono a parte, divisore, etichetta
  // "Prenotato"/"Ordinato", chip risorse/totale, nota): divisore ed etichetta rimossi (il tono
  // smeraldo del chip categoria comunica già il contesto), telefono e risorse/totale confluiti
  // nella stessa nuvola di chip a capo automatico invece di righe proprie.
  const corpo = (
    <>
      <Box className="h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600">
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
          {isPiscina ? (
            <InfoChip tone="emerald">🏊 {notifica.prenotazione.inventario_nome}</InfoChip>
          ) : (
            <InfoChip tone="emerald">🥡 Asporto</InfoChip>
          )}
          <HStack space="xs" className="items-center">
            <Icon as={PhoneIcon} size="2xs" className="text-sky-900/40" />
            <Text size="2xs" className="text-muted-foreground">
              {prenotazione.cliente_telefono}
            </Text>
          </HStack>
          {isPiscina ? (
            <>
              {formatIngressiChip(notifica.prenotazione) ? (
                <InfoChip tone="sky">{formatIngressiChip(notifica.prenotazione)}</InfoChip>
              ) : null}
              {risorseFisichePrenotate(notifica.prenotazione).map((r) => (
                <InfoChip key={r.icon} tone="sky">
                  {r.icon} {r.count}
                </InfoChip>
              ))}
            </>
          ) : (
            <InfoChip tone="sky">🧾 €{formatPrezzo(notifica.prenotazione.totale)}</InfoChip>
          )}
        </HStack>

        {prenotazione.note ? (
          <Text size="2xs" className="italic text-sky-900/70">
            📝 {prenotazione.note}
          </Text>
        ) : null}
      </VStack>
    </>
  );

  return (
    <Box className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/50 shadow-sm">
      <HStack className="items-stretch">
        <Box className="w-1 bg-sky-500" />

        <HStack space="xs" className="flex-1 items-start justify-between p-2">
          {/* Pressable sorella, non annidata in quella del pulsante segna-come-letta: evita un
              doppio trigger su web. */}
          {onOpen ? (
            <Pressable
              onPress={onOpen}
              accessibilityRole="button"
              accessibilityLabel={
                isPiscina
                  ? `Vai alla mappa piscina per la prenotazione di ${prenotazione.cliente_nome}`
                  : `Vai al dettaglio dell'ordine di ${prenotazione.cliente_nome}`
              }
              className="-m-1 flex-1 flex-row items-start gap-2 rounded-xl p-1 active:bg-sky-100/70"
            >
              {corpo}
              <Icon as={ChevronRightIcon} size="xs" className="mt-1 shrink-0 text-sky-300" />
            </Pressable>
          ) : (
            <Box className="-m-1 flex-1 flex-row items-start gap-2 p-1">{corpo}</Box>
          )}

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

// Banner "a comparsa" per una nuova prenotazione rilevata durante il polling.
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

  // Le notifiche già lette sono filtrate qui, non solo attenuate: l'elenco è "cosa manca da vedere".
  const categoriaAttiva = CATEGORIE.find((c) => c.key === categoria)!;
  const visibili = useMemo(() => {
    if (!categoriaAttiva.disponibile) return [];
    const perCategoria = categoria === 'TUTTI' ? notifiche : notifiche.filter((n) => n.categoria === categoria);
    return perCategoria.filter((n) => !isRead(n.prenotazione.id));
  }, [categoria, categoriaAttiva.disponibile, notifiche, isRead]);

  // Conteggio non letto per singolo tab (sopra "TUTTI" = somma di tutte le categorie reali):
  // ogni categoria disponibile deve mostrare il proprio numero, non quello totale ripetuto.
  const unreadByCategoria = useMemo(() => {
    const counts = { TUTTI: 0, PISCINA: 0, ASPORTO: 0, RISTORANTE: 0, PADEL: 0 } as Record<Categoria, number>;
    notifiche.forEach((n) => {
      if (isRead(n.prenotazione.id)) return;
      counts.TUTTI += 1;
      counts[n.categoria] += 1;
    });
    return counts;
  }, [notifiche, isRead]);

  const handleOpenPrenotazione = (n: NotificaPiscina) => {
    markAsRead(n.prenotazione.id);
    setIsOpen(false);
    router.push(`/staff/piscina/${n.prenotazione.inventario}?data=${n.prenotazione.data}` as Href);
  };

  // Ora che esiste una pagina di dettaglio ordine dedicata (sezione 15), anche le notifiche
  // asporto sono cliccabili — stesso identico principio della piscina: leggere la notifica e
  // portare direttamente al punto dove gestirla.
  const handleOpenOrdine = (n: NotificaAsporto) => {
    markAsRead(n.prenotazione.id);
    setIsOpen(false);
    router.push(`/staff/asporto/ordini/${n.prenotazione.id}` as Href);
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

              <CategoriaTabs categoria={categoria} onChange={setCategoria} unreadByCategoria={unreadByCategoria} />

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

                  {visibili.map((n) => (
                    <NotificaCard
                      key={n.prenotazione.id}
                      notifica={n}
                      onDismiss={() => markAsRead(n.prenotazione.id)}
                      onOpen={
                        n.categoria === 'PISCINA' ? () => handleOpenPrenotazione(n) : () => handleOpenOrdine(n)
                      }
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
