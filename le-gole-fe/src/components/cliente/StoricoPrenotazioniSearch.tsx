import { useState } from 'react';
import { router, type Href } from 'expo-router';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField, InputIcon, InputSlot } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { PhoneIcon } from '@/components/ui/icon';
import { getStoricoAsportoPerTelefono, getStoricoPiscinaPerTelefono } from '../../services/prenotazioni';

// Piccola sezione di ricerca sulla landing "Area Cliente" (app/cliente/index.tsx) — nessun login
// cliente esiste in questo progetto (sezione 3/7 di CLAUDE.md), quindi il numero di telefono è
// l'unico "segreto" richiesto per consultare il proprio storico, stesso principio di fiducia già
// usato per il biglietto/la ricevuta PDF via UUID (sezione 2/15).
//
// Il controllo di esistenza avviene QUI, prima di navigare: se nessuna delle due categorie
// (piscina/asporto) ha risultati per il numero inserito, il messaggio d'errore resta su questa
// stessa pagina — la pagina dedicata (app/cliente/storico.tsx) presuppone che esista già qualcosa
// da mostrare, coerente con la richiesta esplicita dell'utente ("se è presente uno storico... si
// aprirà una pagina dedicata, altrimenti uscirà un messaggio di errore").
export function StoricoPrenotazioniSearch() {
  const [telefono, setTelefono] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChangeTelefono = (text: string) => {
    setTelefono(text);
    if (error) setError(null);
  };

  const handleSearch = async () => {
    const valore = telefono.trim();
    if (!valore) {
      setError('Inserisci il tuo numero di telefono.');
      return;
    }
    setError(null);
    setIsSearching(true);
    try {
      const [piscina, asporto] = await Promise.all([
        getStoricoPiscinaPerTelefono(valore),
        getStoricoAsportoPerTelefono(valore),
      ]);
      if (piscina.length === 0 && asporto.length === 0) {
        setError(
          'Nessuna prenotazione trovata per questo numero di telefono. Verifica di aver digitato lo stesso numero usato al momento della prenotazione.'
        );
        return;
      }
      router.push(`/cliente/storico?telefono=${encodeURIComponent(valore)}` as Href);
    } catch {
      setError('Impossibile completare la ricerca. Riprova.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <VStack space="sm" className="w-full rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <HStack space="xs" className="items-center">
        <Text size="md">📖</Text>
        <Heading size="sm">Le mie prenotazioni</Heading>
      </HStack>
      <Text size="xs" className="text-sky-900/70">
        Inserisci il numero di telefono usato al momento della prenotazione per consultare il tuo
        storico (piscina e asporto).
      </Text>

      <HStack space="sm" className="items-start">
        <Input className="flex-1">
          <InputSlot className="pl-3">
            <InputIcon as={PhoneIcon} className="text-sky-400" />
          </InputSlot>
          <InputField
            keyboardType="phone-pad"
            placeholder="Numero di telefono"
            value={telefono}
            onChangeText={handleChangeTelefono}
            onSubmitEditing={handleSearch}
          />
        </Input>
        <Button onPress={handleSearch} disabled={isSearching} isDisabled={isSearching}>
          {isSearching ? <ButtonSpinner /> : <ButtonText>Cerca</ButtonText>}
        </Button>
      </HStack>

      {error ? (
        <Text size="xs" className="text-destructive">
          {error}
        </Text>
      ) : null}
    </VStack>
  );
}
