import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import type { SlotPadel } from '../../services/padel';

type SlotPickerPadelProps = {
  slots: SlotPadel[];
  value: string | null;
  onChange: (ora: string) => void;
  isLoading?: boolean;
  /**
   * Orario già assegnato alla prenotazione che si sta modificando: risulta occupato perché lo
   * occupa lei stessa, ma deve restare selezionabile.
   */
  slotCorrente?: string | null;
  emptyMessage?: string;
};

function slotClassName(isSelected: boolean, selezionabile: boolean): string {
  if (isSelected) return 'border-sky-600 bg-sky-600';
  if (selezionabile) return 'border-sky-200 bg-white active:bg-sky-50';
  return 'border-slate-200 bg-slate-100 opacity-50';
}

function slotTextClassName(isSelected: boolean, selezionabile: boolean): string {
  if (isSelected) return 'text-white';
  if (selezionabile) return 'text-sky-900';
  return 'text-slate-500';
}

// La griglia di slot del padel è corta (una partita dura 60-90 minuti, quindi una manciata di
// orari al giorno): un'unica griglia di chip resta leggibile per intero, senza il picker a due
// livelli fascia -> orario che serve invece all'asporto con i suoi slot da 15 minuti.
export function SlotPickerPadel({
  slots,
  value,
  onChange,
  isLoading = false,
  slotCorrente = null,
  emptyMessage = 'Nessun orario prenotabile per questa data.',
}: Readonly<SlotPickerPadelProps>) {
  if (isLoading) {
    return (
      <HStack className="items-center justify-center py-6">
        <Spinner size="small" />
      </HStack>
    );
  }

  if (slots.length === 0) {
    return (
      <Box className="rounded-xl border border-dashed border-sky-200 bg-sky-50 px-4 py-5">
        <Text size="sm" className="text-center text-muted-foreground">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <VStack space="xs" className="w-full">
      {/* Celle con padding dentro un contenitore a margine negativo: 3 colonne su telefono, 4 da
          tablet, 6 su desktop, senza che `gap` faccia sforare la riga. */}
      <Box className="-m-1 w-full flex-row flex-wrap">
        {slots.map((slot) => {
          const isCorrente = slotCorrente === slot.ora;
          const selezionabile = slot.disponibile || isCorrente;
          const isSelected = value === slot.ora;

          return (
            <Box key={slot.ora} className="w-1/3 p-1 md:w-1/4 lg:w-1/6">
              <Pressable
                onPress={() => selezionabile && onChange(slot.ora)}
                disabled={!selezionabile}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled: !selezionabile }}
                accessibilityLabel={
                  selezionabile ? `Orario ${slot.ora}` : `Orario ${slot.ora}, già prenotato`
                }
                className={`min-h-11 items-center justify-center rounded-xl border-2 px-2 py-2 ${slotClassName(
                  isSelected,
                  selezionabile
                )}`}
              >
                <Text size="sm" className={`font-bold ${slotTextClassName(isSelected, selezionabile)}`}>
                  {slot.ora}
                </Text>
                {!slot.disponibile ? (
                  <Text
                    size="2xs"
                    className={isSelected ? 'text-white/80' : 'text-slate-500'}
                  >
                    {isCorrente ? 'attuale' : 'occupato'}
                  </Text>
                ) : null}
              </Pressable>
            </Box>
          );
        })}
      </Box>
    </VStack>
  );
}
