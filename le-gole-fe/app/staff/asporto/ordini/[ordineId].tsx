import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Box } from '@/components/ui/box';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { StaffPageHeader } from '../../../../src/components/staff/StaffPageHeader';
import { ClienteInfoCard } from '../../../../src/components/staff/ClienteInfoCard';
import { chiediConferma, mostraErrore } from '../../../../src/utils/dialog';
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
    <StaffPageHeader
      title="Dettaglio ordine"
      subtitle={nome ?? 'Anagrafica cliente e riepilogo ordine'}
      fallbackHref="/staff/asporto/ordini"
    />
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
      mostraErrore(extractErrorMessage(err, "Impossibile confermare l'ordine. Riprova."));
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
        mostraErrore(extractErrorMessage(err, "Impossibile annullare l'ordine. Riprova."));
      } finally {
        setIsCancelling(false);
      }
    };

    chiediConferma('Annullare ordine?', message, 'Annulla ordine', doCancel);
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
