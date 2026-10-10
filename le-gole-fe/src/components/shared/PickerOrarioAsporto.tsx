import { useState } from 'react';
import { Pressable } from 'react-native';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import type { BloccoOrario } from '../../utils/piscinaMappa';
import {
  etichettaPostiLiberi,
  residuoTextClassName,
  SOGLIA_AVVISO_RESIDUO_ORARIO,
} from '../../utils/asporto';

export type TonoPicker = 'sky' | 'emerald';

/** Perché uno slot non è selezionabile: già passato/troppo vicino, oppure al limite di prenotazioni. */
export type StatoSlot = 'passato' | 'esaurito' | null;

// Classi scritte per esteso per ogni tono: Tailwind/NativeWind rileva solo stringhe letterali
// complete, mai frammenti costruiti a runtime.
const TONI = {
  sky: {
    fasciaSpenta: 'border-sky-100 bg-white opacity-40',
    fasciaEspansa: 'border-sky-600 bg-sky-600',
    fasciaSelezionata: 'border-sky-600 bg-white',
    fasciaNormale: 'border-sky-300 bg-white active:bg-sky-50',
    testo: 'text-sky-900',
    slotSelezionato: 'border-sky-600 bg-sky-600',
    slotSpento: 'border-sky-100 bg-white opacity-40',
    slotNormale: 'border-sky-300 bg-white active:bg-sky-100',
    slotTesto: 'font-medium text-sky-900',
    pannello: 'flex-wrap rounded-xl border border-sky-200 bg-sky-50 p-2',
    suggerimento: 'text-sky-900/50',
  },
  emerald: {
    fasciaSpenta: 'border-emerald-100 bg-white opacity-40',
    fasciaEspansa: 'border-emerald-600 bg-emerald-600',
    fasciaSelezionata: 'border-emerald-600 bg-white',
    fasciaNormale: 'border-emerald-300 bg-white active:bg-emerald-100',
    testo: 'text-emerald-900',
    slotSelezionato: 'border-emerald-600 bg-emerald-600',
    slotSpento: 'border-emerald-100 bg-white opacity-40',
    slotNormale: 'border-emerald-300 bg-white active:bg-emerald-100',
    slotTesto: 'font-medium text-emerald-900',
    pannello: 'flex-wrap rounded-xl border border-emerald-200 bg-emerald-100/50 p-2',
    suggerimento: 'text-emerald-900/60',
  },
} as const;

type Tono = (typeof TONI)[TonoPicker];

function fasciaClassName(t: Tono, spenta: boolean, espansa: boolean, contieneSelezionato: boolean): string {
  if (spenta) return t.fasciaSpenta;
  if (espansa) return t.fasciaEspansa;
  if (contieneSelezionato) return t.fasciaSelezionata;
  return t.fasciaNormale;
}

function fasciaTextClassName(t: Tono, spenta: boolean, espansa: boolean): string {
  if (spenta) return 'text-muted-foreground';
  if (espansa) return 'text-white';
  return t.testo;
}

function slotClassName(t: Tono, selezionato: boolean, disabilitato: boolean): string {
  if (selezionato) return t.slotSelezionato;
  if (disabilitato) return t.slotSpento;
  return t.slotNormale;
}

function slotTextClassName(t: Tono, selezionato: boolean, disabilitato: boolean): string {
  if (selezionato) return 'font-bold text-white';
  if (disabilitato) return 'text-muted-foreground';
  return t.slotTesto;
}

export function slotAccessibilityLabel(slot: string, stato: StatoSlot, residuoVisibile: number | null): string {
  if (stato === 'passato') return `Orario di ritiro ${slot}, non più disponibile`;
  if (stato === 'esaurito') {
    return `Orario di ritiro ${slot}, esaurito: numero massimo di prenotazioni raggiunto per questo orario`;
  }
  if (residuoVisibile !== null) return `Orario di ritiro ${slot}, solo ${etichettaPostiLiberi(residuoVisibile)} per questo orario`;
  return `Orario di ritiro ${slot}`;
}

type PickerOrarioAsportoProps = {
  blocchi: BloccoOrario[];
  value: string;
  onChange: (slot: string) => void;
  statoSlot: (slot: string) => StatoSlot;
  residuoSlot?: (slot: string) => number | null;
  tono?: TonoPicker;
  /** Fascia aperta al primo render (es. quella dell'orario già scelto, in modifica). */
  fasciaIniziale?: string | null;
};

// Picker a due livelli dell'orario di ritiro: fasce orarie ("12:00-13:00") sempre visibili, tap per
// espandere gli orari da 15 minuti al suo interno, un accordion alla volta. Uno slot non
// selezionabile resta visibile ma spento; una fascia con tutti gli slot spenti non si espande.
export function PickerOrarioAsporto({
  blocchi,
  value,
  onChange,
  statoSlot,
  residuoSlot,
  tono = 'sky',
  fasciaIniziale = null,
}: Readonly<PickerOrarioAsportoProps>) {
  const t = TONI[tono];
  const [oraEspansa, setOraEspansa] = useState<string | null>(fasciaIniziale);
  const slotsFasciaEspansa = blocchi.find((b) => b.ora === oraEspansa)?.slots ?? [];

  return (
    <>
      <HStack space="xs" className="flex-wrap">
        {blocchi.map((blocco) => {
          const espansa = blocco.ora === oraEspansa;
          const contieneSelezionato = blocco.slots.includes(value);
          const spenta = blocco.slots.every((slot) => statoSlot(slot) !== null);
          return (
            <Pressable
              key={blocco.ora}
              onPress={() => !spenta && setOraEspansa((prev) => (prev === blocco.ora ? null : blocco.ora))}
              disabled={spenta}
              accessibilityRole="button"
              accessibilityLabel={`Fascia oraria ${blocco.label}${spenta ? ', non più disponibile' : ''}`}
              accessibilityState={{ expanded: espansa, selected: contieneSelezionato, disabled: spenta }}
              className={`rounded-full border-2 px-3 py-1.5 ${fasciaClassName(t, spenta, espansa, contieneSelezionato)}`}
            >
              <Text size="xs" className={`font-medium ${fasciaTextClassName(t, spenta, espansa)}`}>
                {contieneSelezionato && !espansa ? '✓ ' : ''}
                {blocco.label}
              </Text>
            </Pressable>
          );
        })}
      </HStack>

      {oraEspansa ? (
        <HStack space="xs" className={t.pannello}>
          {slotsFasciaEspansa.map((slot) => {
            const stato = statoSlot(slot);
            const disabilitato = stato !== null;
            const selezionato = value === slot;
            const residuo = residuoSlot?.(slot) ?? null;
            const residuoVisibile =
              !disabilitato && residuo !== null && residuo <= SOGLIA_AVVISO_RESIDUO_ORARIO ? residuo : null;
            return (
              <VStack key={slot} className="items-center">
                <Pressable
                  onPress={() => !disabilitato && onChange(slot)}
                  disabled={disabilitato}
                  accessibilityRole="button"
                  accessibilityLabel={slotAccessibilityLabel(slot, stato, residuoVisibile)}
                  className={`rounded-full border-2 px-3 py-1.5 ${slotClassName(t, selezionato, disabilitato)}`}
                >
                  <Text size="xs" className={slotTextClassName(t, selezionato, disabilitato)}>
                    {slot}
                    {stato === 'esaurito' ? ' · Esaurito' : ''}
                  </Text>
                </Pressable>
                {/* Didascalia FUORI dal bottone. Font via `style`, non `text-[9px]`: le classi
                    arbitrarie non vengono applicate da NativeWind (alpha) su web. */}
                {residuoVisibile === null ? null : (
                  <Text style={{ fontSize: 9 }} className={`font-semibold ${residuoTextClassName(residuoVisibile)}`}>
                    {etichettaPostiLiberi(residuoVisibile)}
                  </Text>
                )}
              </VStack>
            );
          })}
        </HStack>
      ) : (
        <Text size="2xs" className={t.suggerimento}>
          Tocca una fascia oraria per scegliere l'orario esatto.
        </Text>
      )}
    </>
  );
}
