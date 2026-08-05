import { useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeftIcon, ChevronRightIcon, Icon, PhoneIcon, SearchIcon } from '@/components/ui/icon';
import { searchClienti, type Cliente } from '../../src/services/clienti';
import { goBackOr } from '../../src/utils/navigation';

// Sotto questa lunghezza non cerchiamo: un solo carattere restituirebbe potenzialmente
// l'intera anagrafica clienti, poco utile e che sovraccarica il backend a ogni tasto premuto.
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

function ClientiHeader() {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Cerca clienti</Heading>
        <Text size="sm" className="text-muted-foreground">
          Cerca nell&apos;anagrafica per nome o numero di telefono.
        </Text>
      </VStack>
    </HStack>
  );
}

function ClienteRow({ cliente }: Readonly<{ cliente: Cliente }>) {
  return (
    <Pressable
      onPress={() => router.push(`/staff/clienti/${cliente.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Apri scheda di ${cliente.nome}`}
      className="w-full rounded-xl border border-sky-100 bg-white p-4 shadow-sm active:bg-sky-50"
    >
      <HStack space="sm" className="items-center justify-between">
        <VStack space="xs" className="flex-1">
          <Text size="md" className="font-semibold text-sky-900">
            {cliente.nome}
          </Text>
          <HStack space="xs" className="items-center">
            <Icon as={PhoneIcon} size="xs" className="text-sky-600" />
            <Text size="sm" className="text-sky-700">
              {cliente.telefono}
            </Text>
          </HStack>
        </VStack>
        <Icon as={ChevronRightIcon} size="sm" className="text-sky-400" />
      </HStack>
    </Pressable>
  );
}

export default function StaffClientiScreen() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    searchClienti(debouncedQuery)
      .then((clienti) => {
        if (!cancelled) setResults(clienti);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile completare la ricerca. Riprova.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const showPrompt = debouncedQuery.length < MIN_QUERY_LENGTH;
  const showEmptyResults = !showPrompt && !isLoading && !error && results.length === 0;

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <ClientiHeader />

        <VStack space="xs">
          <HStack space="xs" className="items-center">
            <Icon as={SearchIcon} size="sm" className="text-sky-700" />
            <Text size="sm" className="font-medium">
              Nome o telefono
            </Text>
          </HStack>
          <Input>
            <InputField
              placeholder="Es. Mario Rossi o 333 1234567"
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
          </Input>
        </VStack>

        {isLoading ? (
          <HStack space="sm" className="items-center py-4">
            <Spinner size="small" />
            <Text size="sm" className="text-muted-foreground">
              Ricerca in corso...
            </Text>
          </HStack>
        ) : null}

        {error ? (
          <Text size="sm" className="text-center text-destructive">
            {error}
          </Text>
        ) : null}

        {showPrompt && !isLoading ? (
          <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
            <Text size="lg">🔍</Text>
            <Text size="sm" className="text-center text-muted-foreground">
              Digita almeno {MIN_QUERY_LENGTH} caratteri per cercare un cliente per nome o
              telefono.
            </Text>
          </VStack>
        ) : null}

        {showEmptyResults ? (
          <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
            <Text size="lg">🤷</Text>
            <Text size="sm" className="text-center text-muted-foreground">
              Nessun cliente trovato per &quot;{debouncedQuery}&quot;.
            </Text>
          </VStack>
        ) : null}

        {!isLoading && results.length > 0 ? (
          <VStack space="sm" className="w-full">
            <Text size="xs" className="text-muted-foreground">
              {results.length} {results.length === 1 ? 'risultato' : 'risultati'}
            </Text>
            {results.map((cliente) => (
              <ClienteRow key={cliente.id} cliente={cliente} />
            ))}
          </VStack>
        ) : null}
      </VStack>
    </ScrollView>
  );
}
