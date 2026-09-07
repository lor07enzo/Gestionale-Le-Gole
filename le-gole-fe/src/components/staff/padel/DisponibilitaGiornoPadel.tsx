import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import type { DisponibilitaPadel } from '../../../services/padel';

type DisponibilitaGiornoPadelProps = {
  disponibilita: DisponibilitaPadel | null;
  isLoading: boolean;
};

// Colpo d'occhio su quali orari sono ancora liberi in una data: risponde a "il campo è libero
// alle 18?" senza dover scorrere l'elenco delle partite.
export function DisponibilitaGiornoPadel({ disponibilita, isLoading }: Readonly<DisponibilitaGiornoPadelProps>) {
  if (isLoading) {
    return (
      <HStack className="items-center justify-center rounded-2xl border border-sky-100 bg-white py-6">
        <Spinner size="small" />
      </HStack>
    );
  }

  if (!disponibilita) return null;

  const liberi = disponibilita.slots.filter((slot) => slot.disponibile).length;

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <HStack space="sm" className="flex-wrap items-center justify-between">
        <Heading size="sm">Orari del campo</Heading>
        {disponibilita.slots.length > 0 ? (
          <Text size="xs" className="text-muted-foreground">
            {liberi} liber{liberi === 1 ? 'o' : 'i'} su {disponibilita.slots.length}
          </Text>
        ) : null}
      </HStack>

      {disponibilita.chiuso ? (
        <Box className="rounded-xl bg-rose-50 px-3 py-2">
          <Text size="xs" className="font-medium text-rose-700">
            🔒 Campo chiuso in questa data: nessuna prenotazione online possibile.
          </Text>
        </Box>
      ) : null}

      {!disponibilita.attivo ? (
        <Box className="rounded-xl bg-amber-50 px-3 py-2">
          <Text size="xs" className="font-medium text-amber-800">
            Prenotazioni online disattivate. Puoi comunque registrare partite da qui.
          </Text>
        </Box>
      ) : null}

      {disponibilita.slots.length === 0 ? (
        <Text size="xs" className="text-muted-foreground">
          Nessun orario prenotabile online per questa data.
        </Text>
      ) : (
        <Box className="-m-1 w-full flex-row flex-wrap">
          {disponibilita.slots.map((slot) => (
            <Box key={slot.ora} className="w-1/3 p-1 md:w-1/4 lg:w-1/6">
              <Box
                className={`items-center rounded-xl border px-2 py-2 ${
                  slot.disponibile ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'
                }`}
              >
                <Text
                  size="sm"
                  className={`font-bold ${slot.disponibile ? 'text-emerald-700' : 'text-rose-700'}`}
                >
                  {slot.ora}
                </Text>
                <Text size="2xs" className={slot.disponibile ? 'text-emerald-700/80' : 'text-rose-700/80'}>
                  {slot.disponibile ? 'libero' : 'occupato'}
                </Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </VStack>
  );
}
