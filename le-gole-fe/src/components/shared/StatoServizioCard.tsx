import { useEffect, useState } from 'react';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { extractErrorMessage } from '../../utils/errors';

type StatoServizioCardProps = {
  icona: string;
  titolo: string;
  testoAttivo: string;
  testoDisattivo: string;
  statoIniziale: boolean;
  load: () => Promise<{ attivo: boolean }>;
  save: (attivo: boolean) => Promise<{ attivo: boolean }>;
};

// Interruttore del solo canale online di un servizio. Salva subito al tocco, senza pulsante
// "Salva": una sola scelta binaria ad alto impatto. Lo staff resta comunque libero di registrare
// prenotazioni/ordini da sé anche a servizio disattivato.
export function StatoServizioCard({
  icona,
  titolo,
  testoAttivo,
  testoDisattivo,
  statoIniziale,
  load,
  save,
}: Readonly<StatoServizioCardProps>) {
  const [attivo, setAttivo] = useState(statoIniziale);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load()
      .then((config) => setAttivo(config.attivo))
      .catch(() => setError('Impossibile caricare lo stato del servizio.'))
      .finally(() => setIsLoading(false));
  }, [load]);

  const handleToggle = async (next: boolean) => {
    const precedente = attivo;
    setAttivo(next);
    setError(null);
    setIsSaving(true);
    try {
      const updated = await save(next);
      setAttivo(updated.attivo);
    } catch (err) {
      setAttivo(precedente);
      setError(extractErrorMessage(err, 'Impossibile aggiornare lo stato del servizio.'));
    } finally {
      setIsSaving(false);
    }
  };

  const bordo = attivo ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50';

  return (
    <VStack space="xs" className={`w-full rounded-2xl border p-4 ${bordo}`}>
      <HStack space="md" className="items-center justify-between">
        <VStack className="flex-1">
          <HStack space="xs" className="items-center">
            <Text size="lg">{icona}</Text>
            <Heading size="sm">{titolo}</Heading>
          </HStack>
          <Text size="xs" className="text-muted-foreground">
            {attivo ? testoAttivo : testoDisattivo}
          </Text>
        </VStack>
        {isLoading ? (
          <Spinner size="small" />
        ) : (
          /* `disabled` blocca il tocco, `isDisabled` accende anche lo stile spento: nei
             componenti gluestack le due prop sono distinte. */
          <Switch value={attivo} onValueChange={handleToggle} disabled={isSaving} isDisabled={isSaving} />
        )}
      </HStack>

      {error ? (
        <Text size="xs" className="text-destructive">
          {error}
        </Text>
      ) : null}
    </VStack>
  );
}
