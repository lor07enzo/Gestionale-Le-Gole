import { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
} from '@/components/ui/actionsheet';
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, Icon } from '@/components/ui/icon';
import { WEEKDAY_LABELS, addMonths, buildMonthGrid, formatMonthLabel, startOfMonth } from '../../utils/calendar';
import { toISODate } from '../../utils/piscinaMappa';
import { extractErrorMessage } from '../../utils/errors';

export type GiornoChiusura = { id: string; data: string };

type GiorniChiusuraCalendarCardProps = {
  titolo: string;
  descrizione: string;
  istruzioni: string;
  ariaLabel: string;
  load: () => Promise<GiornoChiusura[]>;
  create: (isoDate: string) => Promise<GiornoChiusura>;
  remove: (id: string) => Promise<void>;
};

// Calendario a tocco: un giorno normale è aperto, toccarlo lo chiude, toccarlo di nuovo lo
// riapre — nessuna conferma, l'azione è reversibile con un secondo tocco. Proprio per questo il
// calendario vive dentro un Actionsheet e non inline nella pagina: sempre in vista rischierebbe
// un tocco accidentale durante lo scroll. La card resta un riepilogo più il pulsante che lo apre.
export function GiorniChiusuraCalendarCard({
  titolo,
  descrizione,
  istruzioni,
  ariaLabel,
  load,
  create,
  remove,
}: Readonly<GiorniChiusuraCalendarCardProps>) {
  const [chiusure, setChiusure] = useState<GiornoChiusura[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [busyIso, setBusyIso] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    load()
      .then(setChiusure)
      .catch(() => setError('Impossibile caricare i giorni di chiusura.'))
      .finally(() => setIsLoading(false));
    // `load` arriva dal chiamante: dipendere da lei rieseguirebbe il fetch ad ogni render se non
    // fosse memoizzata a monte. Il caricamento serve una volta sola, al mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chiusuraByIso = useMemo(() => {
    const map = new Map<string, GiornoChiusura>();
    chiusure.forEach((giorno) => map.set(giorno.data, giorno));
    return map;
  }, [chiusure]);

  const oggiIso = toISODate(new Date());
  const griglia = buildMonthGrid(visibleMonth);
  const settimane = Array.from({ length: griglia.length / 7 }, (_, i) => griglia.slice(i * 7, i * 7 + 7));

  const handleToggleGiorno = async (iso: string) => {
    setError(null);
    setBusyIso(iso);
    try {
      const esistente = chiusuraByIso.get(iso);
      if (esistente) {
        await remove(esistente.id);
        setChiusure((prev) => prev.filter((giorno) => giorno.id !== esistente.id));
      } else {
        const created = await create(iso);
        setChiusure((prev) => [...prev, created]);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile aggiornare il giorno.'));
    } finally {
      setBusyIso(null);
    }
  };

  const prossime = chiusure.filter((giorno) => giorno.data >= oggiIso).length;

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-white p-4">
      <HStack space="xs" className="items-center">
        <Icon as={CalendarDaysIcon} size="sm" className="text-sky-700" />
        <Heading size="sm">{titolo}</Heading>
      </HStack>
      <Text size="xs" className="text-muted-foreground">
        {descrizione}
      </Text>

      {isLoading ? (
        <HStack className="items-center py-2">
          <Spinner size="small" />
        </HStack>
      ) : (
        <>
          <Text size="xs" className="text-sky-900/70">
            {prossime > 0
              ? `${prossime} giorno/i di chiusura da oggi in poi.`
              : 'Nessun giorno di chiusura programmato.'}
          </Text>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            className="min-h-11 self-start border-2 border-sky-300 bg-white"
            onPress={() => setIsOpen(true)}
          >
            <ButtonIcon as={CalendarDaysIcon} className="text-sky-700" />
            <ButtonText className="text-sky-700">Apri calendario</ButtonText>
          </Button>
        </>
      )}

      <Actionsheet isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label={ariaLabel}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>

          <VStack space="md" className="w-full pb-6">
            <VStack>
              <Heading size="md">{titolo}</Heading>
              <Text size="xs" className="text-muted-foreground">
                {istruzioni}
              </Text>
            </VStack>

            <HStack className="items-center justify-between">
              <Pressable
                onPress={() => setVisibleMonth((prev) => addMonths(prev, -1))}
                accessibilityLabel="Mese precedente"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-sky-100"
              >
                <Icon as={ChevronLeftIcon} size="md" className="text-sky-700" />
              </Pressable>
              <Text size="md" className="font-semibold capitalize text-sky-900">
                {formatMonthLabel(visibleMonth)}
              </Text>
              <Pressable
                onPress={() => setVisibleMonth((prev) => addMonths(prev, 1))}
                accessibilityLabel="Mese successivo"
                accessibilityRole="button"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-sky-100"
              >
                <Icon as={ChevronRightIcon} size="md" className="text-sky-700" />
              </Pressable>
            </HStack>

            <HStack className="justify-between">
              {WEEKDAY_LABELS.map((label) => (
                <Box key={label} className="w-10 items-center md:w-12">
                  <Text size="2xs" className="font-medium text-muted-foreground">
                    {label}
                  </Text>
                </Box>
              ))}
            </HStack>

            <VStack space="xs">
              {settimane.map((settimana) => (
                <HStack key={toISODate(settimana[0].date)} className="justify-between">
                  {settimana.map((cell) => {
                    const iso = toISODate(cell.date);
                    const isChiuso = chiusuraByIso.has(iso);
                    const isPassato = iso < oggiIso;
                    const isBusy = busyIso === iso;
                    const disabled = !cell.inCurrentMonth || isPassato || isBusy;
                    return (
                      <Pressable
                        key={iso}
                        onPress={() => handleToggleGiorno(iso)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isChiuso
                            ? `${iso}, chiuso, tocca per riaprire`
                            : `${iso}, tocca per chiudere`
                        }
                        className={`h-10 w-10 items-center justify-center rounded-full md:h-12 md:w-12 ${
                          isChiuso ? 'bg-rose-100' : ''
                        } ${!cell.inCurrentMonth || isPassato ? 'opacity-30' : ''}`}
                      >
                        {isBusy ? (
                          <Spinner size="small" />
                        ) : (
                          <Text size="sm" className={isChiuso ? 'font-semibold text-rose-700' : 'text-sky-900'}>
                            {cell.date.getDate()}
                          </Text>
                        )}
                      </Pressable>
                    );
                  })}
                </HStack>
              ))}
            </VStack>

            {error ? (
              <Text size="xs" className="text-destructive">
                {error}
              </Text>
            ) : null}

            <Button
              size="sm"
              variant="outline"
              className="min-h-11 self-start border-2 border-sky-300 bg-white"
              onPress={() => setIsOpen(false)}
            >
              <ButtonText className="text-sky-700">Chiudi</ButtonText>
            </Button>
          </VStack>
        </ActionsheetContent>
      </Actionsheet>
    </VStack>
  );
}
