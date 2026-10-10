import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import type { RacchettaPadel } from '../../services/padel';
import { maxRacchettaSelezionabile } from '../../utils/padel';
import { formatPrezzo } from '../../utils/prezzi';
import { StepperQuantita } from './StepperQuantita';

type RacchetteNoleggioPickerProps = {
  racchette: RacchettaPadel[];
  quantita: Record<string, number>;
  partecipanti: number;
  onChange: (racchettaId: string, next: number) => void;
  /** Lato staff: segnala le marche nascoste dal catalogo online (comunque noleggiabili a mano). */
  mostraNascoste?: boolean;
};

// Uno stepper per marca, con tetto per riga = min(pezzi posseduti, partecipanti ancora senza
// racchetta). Condiviso tra la prenotazione self-service e la creazione partita lato staff: la
// partita non esiste ancora, quindi le quantità restano locali fino all'invio del form.
export function RacchetteNoleggioPicker({
  racchette,
  quantita,
  partecipanti,
  onChange,
  mostraNascoste = false,
}: Readonly<RacchetteNoleggioPickerProps>) {
  return (
    <VStack space="sm">
      {racchette.map((racchetta) => {
        const nascosta = mostraNascoste && !racchetta.disponibile ? ' · nascosta online' : '';
        const pezzi = mostraNascoste ? ` · ${racchetta.quantita_disponibile} pezzi` : '';
        return (
          <HStack key={racchetta.id} space="sm" className="items-center">
            <Text size="md">🎾</Text>
            <VStack className="flex-1">
              <Text size="sm" className="font-medium">
                {racchetta.nome}
                {nascosta}
              </Text>
              <Text size="2xs" className="text-muted-foreground">
                €{formatPrezzo(racchetta.prezzo_noleggio)} a partita{pezzi}
              </Text>
            </VStack>
            <StepperQuantita
              value={quantita[racchetta.id] ?? 0}
              max={maxRacchettaSelezionabile(racchetta.quantita_disponibile, partecipanti, quantita, racchetta.id)}
              onChange={(next) => onChange(racchetta.id, next)}
              etichetta={racchetta.nome}
            />
          </HStack>
        );
      })}
    </VStack>
  );
}
