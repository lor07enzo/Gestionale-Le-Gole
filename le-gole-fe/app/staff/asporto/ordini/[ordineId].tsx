import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { ArrowLeftIcon, ChevronRightIcon, Icon, PhoneIcon } from '@/components/ui/icon';
import { goBackOr } from '../../../../src/utils/navigation';
import {
  getPrenotazioneAsporto,
  updatePrenotazioneAsporto,
  type PrenotazioneAsporto,
} from '../../../../src/services/prenotazioni';
import { listVociOrdine, type VoceOrdine } from '../../../../src/services/menu';
import { toISODate } from '../../../../src/utils/piscinaMappa';
import {
  EditOrdineSheet,
  extractErrorMessage,
  OrdineRow,
} from '../../../../src/components/staff/asporto/OrdineAsportoUI';

function DettaglioOrdineHeader({ nome }: Readonly<{ nome: string | undefined }>) {
  return (
    <HStack space="sm" className="items-center">
      <Pressable
        onPress={() => goBackOr('/staff/asporto/ordini')}
        accessibilityLabel="Torna indietro"
        className="h-11 w-11 items-center justify-center rounded-full bg-sky-200 active:bg-sky-300"
      >
        <Icon as={ArrowLeftIcon} size="lg" className="text-sky-700" />
      </Pressable>
      <VStack className="flex-1">
        <Heading size="xl">Dettaglio ordine</Heading>
        <Text size="sm" className="text-muted-foreground">
          {nome ?? 'Anagrafica cliente e riepilogo ordine'}
        </Text>
      </VStack>
    </HStack>
  );
}

// Tutte le informazioni del cliente utili da qui: nome, telefono con la stessa CTA "Chiama"
// già introdotta nella scheda cliente (sezione 5), più un link diretto alla scheda completa (che
// include a sua volta l'intero storico piscina/asporto del cliente) per chi ne serve ancora di più.
function ClienteInfoCard({
  nome,
  telefono,
  clienteId,
}: Readonly<{ nome: string; telefono: string; clienteId: string }>) {
  return (
    <VStack space="sm" className="w-full">
      <Pressable
        onPress={() => Linking.openURL(`tel:${telefono}`).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={`Chiama ${telefono}`}
        className="active:opacity-80"
      >
        <Box className="w-full rounded-xl border-2 border-sky-200 bg-white p-4 shadow-sm">
          <HStack className="items-center justify-between">
            <VStack>
              <Text size="md" className="font-semibold text-sky-900">
                {nome}
              </Text>
              <HStack space="xs" className="items-center">
                <Icon as={PhoneIcon} size="xs" className="text-sky-600" />
                <Text size="sm" className="text-sky-700">
                  {telefono}
                </Text>
              </HStack>
            </VStack>
            <HStack space="xs" className="items-center rounded-full bg-sky-500/15 px-3 py-1.5">
              <Text size="xs" className="font-bold text-sky-700">
                Chiama
              </Text>
              <Icon as={ChevronRightIcon} size="xs" className="text-sky-700" />
            </HStack>
          </HStack>
        </Box>
      </Pressable>

      <Pressable
        onPress={() => router.push(`/staff/clienti/${clienteId}`)}
        accessibilityRole="button"
        accessibilityLabel="Vedi scheda cliente completa"
        className="w-full rounded-xl border border-sky-100 bg-white px-4 py-3 active:bg-sky-50"
      >
        <HStack className="items-center justify-between">
          <Text size="sm" className="font-medium text-sky-700">
            Vedi scheda cliente completa
          </Text>
          <Icon as={ChevronRightIcon} size="sm" className="text-sky-400" />
        </HStack>
      </Pressable>
    </VStack>
  );
}

export default function DettaglioOrdineAsportoScreen() {
  const { ordineId } = useLocalSearchParams<{ ordineId: string }>();
  const [ordine, setOrdine] = useState<PrenotazioneAsporto | null>(null);
  const [voci, setVoci] = useState<VoceOrdine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingOrdine, setEditingOrdine] = useState<PrenotazioneAsporto | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!ordineId) return;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([getPrenotazioneAsporto(ordineId), listVociOrdine({ prenotazione: ordineId })])
      .then(([ordineData, vociData]) => {
        if (cancelled) return;
        setOrdine(ordineData);
        setVoci(vociData);
      })
      .catch(() => {
        if (!cancelled) setError("Impossibile caricare il dettaglio dell'ordine. Riprova.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ordineId]);

  // Stesso principio (mai il futuro, solo il passato) già seguito su "Storico Ordini"/mappa
  // piscina — calcolato sulla data propria dell'ordine, non su una data selezionata condivisa.
  const editable = ordine ? ordine.data >= toISODate(new Date()) : false;

  const openEdit = () => {
    if (!ordine || !editable || ordine.stato === 'CANCELLED') return;
    setEditingOrdine(ordine);
  };

  const handleSaved = (updated: PrenotazioneAsporto) => {
    setOrdine(updated);
    setEditingOrdine(null);
  };

  const handleVociChange = (_prenotazioneId: string, next: VoceOrdine[]) => {
    setVoci(next);
  };

  const handleConfirm = async () => {
    if (!ordine || !editable) return;
    setIsConfirming(true);
    try {
      const updated = await updatePrenotazioneAsporto(ordine.id, { stato: 'CONFIRMED' });
      setOrdine(updated);
    } catch (err) {
      const message = extractErrorMessage(err, "Impossibile confermare l'ordine. Riprova.");
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Errore', message);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    if (!ordine || !editable || ordine.stato === 'CANCELLED') return;
    const message = `L'ordine di ${ordine.cliente_nome} verrà annullato. Resterà comunque visibile qui come cancellato.`;

    const doCancel = async () => {
      setIsCancelling(true);
      try {
        const updated = await updatePrenotazioneAsporto(ordine.id, { stato: 'CANCELLED' });
        setOrdine(updated);
      } catch (err) {
        const message2 = extractErrorMessage(err, "Impossibile annullare l'ordine. Riprova.");
        if (Platform.OS === 'web') {
          window.alert(message2);
        } else {
          Alert.alert('Errore', message2);
        }
      } finally {
        setIsCancelling(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        doCancel();
      }
      return;
    }
    Alert.alert('Annullare ordine?', message, [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla ordine', style: 'destructive', onPress: doCancel },
    ]);
  };

  if (!ordineId || isLoading) {
    return (
      <Box className="flex-1 items-center justify-center bg-background">
        <Spinner size="large" />
      </Box>
    );
  }

  if (error || !ordine) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
        <VStack space="lg" className="w-full">
          <DettaglioOrdineHeader nome={undefined} />
          <Text size="sm" className="text-center text-destructive">
            {error ?? 'Ordine non trovato.'}
          </Text>
        </VStack>
      </ScrollView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 py-6 md:px-8 md:py-10">
      <VStack space="lg" className="w-full">
        <DettaglioOrdineHeader nome={ordine.cliente_nome} />

        <ClienteInfoCard nome={ordine.cliente_nome} telefono={ordine.cliente_telefono} clienteId={ordine.cliente_id} />

        <OrdineRow
          ordine={ordine}
          voci={voci}
          editable={editable}
          isCancelling={isCancelling}
          isConfirming={isConfirming}
          onEdit={openEdit}
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          showTelefono={false}
        />
      </VStack>

      <EditOrdineSheet
        ordine={editingOrdine}
        voci={voci}
        onClose={() => setEditingOrdine(null)}
        onSaved={handleSaved}
        onVociChange={handleVociChange}
      />
    </ScrollView>
  );
}
