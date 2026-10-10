import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Button, ButtonIcon, ButtonSpinner, ButtonText } from '@/components/ui/button';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  DownloadIcon,
  Icon,
  PhoneIcon,
  RepeatIcon,
} from '@/components/ui/icon';
import { CalendarioSheet } from '../../shared/CalendarioSheet';
import { goBackOr } from '../../../utils/navigation';
import { formatDisplayDate, STATO_PRENOTAZIONE_BADGE, STATO_PRENOTAZIONE_LABEL } from '../../../utils/piscinaMappa';
import type { StatoPrenotazione } from '../../../services/prenotazioni';

// Pezzi comuni delle pagine di dettaglio raggiunte da "Le mie prenotazioni"
// (app/cliente/storico/{piscina,padel,asporto}/[id].tsx): stessa intestazione, stessa card
// riepilogativa, stesso pannello "Riprenota". Ogni pagina fornisce solo i dati del proprio servizio.

const SCROLL_CONTENT = 'px-4 py-6 md:px-8 md:py-10';

export function DettaglioHeader({ titolo, sottotitolo }: Readonly<{ titolo: string; sottotitolo: string }>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/cliente')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">{titolo}</Heading>
        <Text size="sm" className="text-muted-foreground">
          {sottotitolo}
        </Text>
      </VStack>
    </HStack>
  );
}

export function DettaglioLoading() {
  return (
    <Box className="flex-1 items-center justify-center bg-background">
      <Spinner size="large" />
    </Box>
  );
}

export function DettaglioErrore({ header, messaggio }: Readonly<{ header: React.ReactNode; messaggio: string }>) {
  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName={SCROLL_CONTENT}>
      <VStack space="lg" className="w-full">
        {header}
        <Text size="sm" className="text-center text-destructive">
          {messaggio}
        </Text>
      </VStack>
    </ScrollView>
  );
}

// Nessuna riga con bordo condizionale tramite la variante Tailwind `last:` — mai verificata con
// NativeWind v5 (alpha): la separazione tra gruppi arriva dai titoli di sezione.
export function InfoRow({ icon, label, value }: Readonly<{ icon: string; label: string; value: string | number }>) {
  return (
    <HStack className="items-center justify-between py-1">
      <Text size="sm" className="text-sky-900/70">
        {icon} {label}
      </Text>
      <Text size="sm" className="font-semibold text-sky-900">
        {value}
      </Text>
    </HStack>
  );
}

export function SezioneDettaglio({ titolo, children }: Readonly<{ titolo: string; children: React.ReactNode }>) {
  return (
    <VStack space="xs">
      <Text size="xs" className="font-bold uppercase tracking-wide text-sky-700">
        {titolo}
      </Text>
      {children}
    </VStack>
  );
}

export function Divisore() {
  return <Box className="h-px w-full bg-sky-100" />;
}

type RiepilogoCardProps = {
  titolo: string;
  quando: string;
  stato: StatoPrenotazione;
  clienteNome: string;
  clienteTelefono: string;
  note: string;
  children?: React.ReactNode;
};

// Card riepilogativa: titolo + quando + badge di stato, cliente, contenuto specifico del servizio
// (children), note.
export function RiepilogoCard({
  titolo,
  quando,
  stato,
  clienteNome,
  clienteTelefono,
  note,
  children,
}: Readonly<RiepilogoCardProps>) {
  return (
    <Box className="w-full rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
      <VStack space="md">
        <HStack className="items-start justify-between">
          <VStack>
            <Text size="lg" className="font-bold text-sky-900">
              {titolo}
            </Text>
            <HStack space="xs" className="items-center">
              <Icon as={ClockIcon} size="xs" className="text-sky-600" />
              <Text size="sm" className="text-sky-900/70">
                {quando}
              </Text>
            </HStack>
          </VStack>
          <Box className={`rounded-full px-3 py-1.5 ${STATO_PRENOTAZIONE_BADGE[stato].bg}`}>
            <Text size="xs" className={`font-bold ${STATO_PRENOTAZIONE_BADGE[stato].text}`}>
              {STATO_PRENOTAZIONE_LABEL[stato]}
            </Text>
          </Box>
        </HStack>

        <Divisore />

        <SezioneDettaglio titolo="Cliente">
          <InfoRow icon="👤" label="Nome" value={clienteNome} />
          <HStack className="items-center justify-between py-1">
            <HStack space="xs" className="items-center">
              <Icon as={PhoneIcon} size="2xs" className="text-sky-600" />
              <Text size="sm" className="text-sky-900/70">
                Telefono
              </Text>
            </HStack>
            <Text size="sm" className="font-semibold text-sky-900">
              {clienteTelefono}
            </Text>
          </HStack>
        </SezioneDettaglio>

        {children}

        {note ? (
          <SezioneDettaglio titolo="Note">
            <Text size="sm" className="italic text-sky-900/80">
              📝 {note}
            </Text>
          </SezioneDettaglio>
        ) : null}
      </VStack>
    </Box>
  );
}

export function DownloadPdfButton({
  etichetta,
  isDownloading,
  onPress,
  outline = false,
}: Readonly<{ etichetta: string; isDownloading: boolean; onPress: () => void; outline?: boolean }>) {
  return (
    <Button
      variant={outline ? 'outline' : 'default'}
      className={outline ? 'border-2 border-sky-300 bg-white' : undefined}
      onPress={onPress}
      disabled={isDownloading}
    >
      {isDownloading ? (
        <ButtonSpinner />
      ) : (
        <>
          <ButtonIcon as={DownloadIcon} className={outline ? 'text-sky-700' : undefined} />
          <ButtonText className={outline ? 'text-sky-700' : undefined}>{etichetta}</ButtonText>
        </>
      )}
    </Button>
  );
}

export function RiprenotaButton({ etichetta, onPress }: Readonly<{ etichetta: string; onPress: () => void }>) {
  return (
    <Button variant="outline" className="border-2 border-emerald-300 bg-emerald-50" onPress={onPress}>
      <ButtonIcon as={RepeatIcon} className="text-emerald-700" />
      <ButtonText className="text-emerald-700">{etichetta}</ButtonText>
    </Button>
  );
}

type RiprenotaPanelProps = {
  /** "partita" / "prenotazione": usato nelle etichette di accessibilità. */
  cosa: string;
  descrizione: React.ReactNode;
  data: Date | null;
  onSelectData: (data: Date) => void;
  fullDates: Record<string, boolean>;
  calendarCaption: string;
  onVisibleMonthChange?: (anno: number, mese: number) => void;
  /** Campo orario, specifico di ogni servizio. */
  children: React.ReactNode;
  error: string | null;
  isSubmitting: boolean;
  onSubmit: () => void;
  onAnnulla: () => void;
};

// Pannello "Riprenota": il cliente sceglie solo data (calendario, giorni non prenotabili in rosa)
// e orario; il resto viene copiato dalla prenotazione originale dalla pagina chiamante.
export function RiprenotaPanel({
  cosa,
  descrizione,
  data,
  onSelectData,
  fullDates,
  calendarCaption,
  onVisibleMonthChange,
  children,
  error,
  isSubmitting,
  onSubmit,
  onAnnulla,
}: Readonly<RiprenotaPanelProps>) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  return (
    <>
      <Box className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <VStack space="sm">
          <Heading size="sm">🔁 Riprenota</Heading>
          <Text size="xs" className="text-emerald-900/70">
            {descrizione}
          </Text>

          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Data
            </Text>
            <Pressable
              onPress={() => setIsCalendarOpen(true)}
              accessibilityLabel={`Scegli la data della nuova ${cosa}`}
              className="rounded-xl border-2 border-emerald-300 bg-white px-3 py-2.5"
            >
              <HStack space="xs" className="items-center">
                <Icon as={CalendarDaysIcon} size="sm" className="text-emerald-700" />
                <Text size="sm" className="font-medium text-emerald-900">
                  {data ? formatDisplayDate(data) : 'Scegli la data'}
                </Text>
              </HStack>
            </Pressable>
          </VStack>

          {children}

          {error ? (
            <Text size="sm" className="text-center text-destructive">
              {error}
            </Text>
          ) : null}

          <Button onPress={onSubmit} disabled={isSubmitting} isDisabled={isSubmitting}>
            {isSubmitting ? <ButtonSpinner /> : <ButtonText>Conferma riprenotazione</ButtonText>}
          </Button>
          <Button variant="link" onPress={onAnnulla} disabled={isSubmitting}>
            <ButtonText>Annulla</ButtonText>
          </Button>
        </VStack>
      </Box>

      <CalendarioSheet
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={data ?? new Date()}
        onSelect={onSelectData}
        caption={calendarCaption}
        ariaLabel={`Scegli il giorno per la nuova ${cosa}`}
        minDate={new Date()}
        fullDates={fullDates}
        onVisibleMonthChange={onVisibleMonthChange}
      />
    </>
  );
}

export const DETTAGLIO_SCROLL_CONTENT = SCROLL_CONTENT;
