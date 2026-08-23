import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonIcon, ButtonSpinner } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AddIcon, Icon, TrashIcon } from '@/components/ui/icon';

function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      if ('detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
        return (data as { detail: string }).detail;
      }
      const values = Object.values(data as Record<string, unknown>).flat();
      const messages = values.filter((value): value is string => typeof value === 'string');
      if (messages.length > 0) return messages.join(' ');
    }
  }
  return fallback;
}

export type ListEditorItem = { id: string; nome: string; icona?: string };

type CatalogListEditorProps<T extends ListEditorItem> = {
  label: string;
  placeholder: string;
  emptyText: string;
  items: T[];
  isLoading: boolean;
  // Presente solo per gli Allergene (sezione 15): abilita l'avatar icona su ogni riga e la
  // tavolozza di emoji tra cui scegliere in creazione. Assente per Categoria — nessuna resa
  // diversa dal comportamento precedente in quel caso.
  iconOptions?: string[];
  onCreate: (nome: string, icona?: string) => Promise<void>;
  onDelete: (item: T) => Promise<void>;
  deleteConfirmMessage: (item: T) => string;
};

// Voci "nome" (+ icona opzionale) gestibili in stile lista impostazioni (riga + cestino), non più
// a chip: usato sia per Categoria sia per Allergene (sezione 15) dentro il foglio "Gestisci
// categorie e allergeni".
export function CatalogListEditor<T extends ListEditorItem>({
  label,
  placeholder,
  emptyText,
  items,
  isLoading,
  iconOptions,
  onCreate,
  onDelete,
  deleteConfirmMessage,
}: Readonly<CatalogListEditorProps<T>>) {
  const [nome, setNome] = useState('');
  const [icona, setIcona] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!nome.trim() || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onCreate(nome.trim(), icona);
      setNome('');
      setIcona('');
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile creare la voce.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async (item: T) => {
    try {
      await onDelete(item);
    } catch (err) {
      const message = extractErrorMessage(err, 'Impossibile eliminare la voce.');
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Impossibile eliminare', message);
      }
    }
  };

  const handleDelete = (item: T) => {
    const message = deleteConfirmMessage(item);
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        confirmDelete(item);
      }
      return;
    }
    Alert.alert('Eliminare?', message, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: () => confirmDelete(item) },
    ]);
  };

  return (
    <VStack space="xs" className="w-full">
      <Text size="sm" className="font-semibold text-sky-900">
        {label}
      </Text>

      <VStack className="overflow-hidden rounded-xl border border-sky-200 bg-white">
        {isLoading ? (
          <HStack space="sm" className="items-center px-3 py-3">
            <Spinner size="small" />
          </HStack>
        ) : null}

        {!isLoading && items.length === 0 ? (
          <Text size="xs" className="px-3 py-3 text-muted-foreground">
            {emptyText}
          </Text>
        ) : null}

        {!isLoading &&
          items.map((item, index) => (
            <HStack
              key={item.id}
              space="sm"
              className={`items-center justify-between px-3 py-2.5 ${
                index > 0 ? 'border-t border-sky-100' : ''
              }`}
            >
              {iconOptions ? (
                <Box className="h-7 w-7 items-center justify-center rounded-full bg-amber-50">
                  <Text size="sm">{item.icona || '❔'}</Text>
                </Box>
              ) : null}
              <Text size="sm" className="flex-1 text-sky-900">
                {item.nome}
              </Text>
              <Pressable
                onPress={() => handleDelete(item)}
                accessibilityRole="button"
                accessibilityLabel={`Elimina ${item.nome}`}
                className="h-7 w-7 items-center justify-center rounded-full active:bg-rose-50"
              >
                <Icon as={TrashIcon} size="xs" className="text-rose-400" />
              </Pressable>
            </HStack>
          ))}
      </VStack>

      {iconOptions ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="items-center gap-1.5 py-0.5"
        >
          {iconOptions.map((emoji) => {
            const selezionato = icona === emoji;
            return (
              <Pressable
                key={emoji}
                onPress={() => setIcona(selezionato ? '' : emoji)}
                accessibilityLabel={`Scegli icona ${emoji}`}
                className={`h-8 w-8 items-center justify-center rounded-full border ${
                  selezionato ? 'border-amber-400 bg-amber-100' : 'border-sky-200 bg-white'
                }`}
              >
                <Text size="sm">{emoji}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <HStack space="sm" className="items-center">
        {iconOptions ? (
          <Box className="h-10 w-10 items-center justify-center rounded-lg border border-sky-200 bg-sky-50">
            <Text size="md">{icona || '＋'}</Text>
          </Box>
        ) : null}
        <Input className="flex-1">
          <InputField
            placeholder={placeholder}
            value={nome}
            onChangeText={setNome}
            onSubmitEditing={handleCreate}
          />
        </Input>
        <Button
          size="sm"
          variant="outline"
          className="border-sky-300"
          onPress={handleCreate}
          disabled={isSubmitting || !nome.trim()}
        >
          {isSubmitting ? <ButtonSpinner /> : <ButtonIcon as={AddIcon} className="text-sky-700" />}
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
