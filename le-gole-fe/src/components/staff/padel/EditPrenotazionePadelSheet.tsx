import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetScrollView,
} from '@/components/ui/actionsheet';
import { AddIcon, Icon, RemoveIcon } from '@/components/ui/icon';
import {
  getDisponibilitaPadel,
  updatePrenotazionePadel,
  type PrenotazionePadel,
  type SlotPadel,
} from '../../../services/padel';
import { formatTime } from '../../../utils/piscinaMappa';
import { formatPrezzo } from '../../../utils/prezzi';
import { extractErrorMessage } from '../../../utils/errors';
import { SlotPickerPadel } from '../../shared/SlotPickerPadel';

type EditPrenotazionePadelSheetProps = {
  /** null = foglio chiuso. */
  prenotazione: PrenotazionePadel | null;
  onClose: () => void;
  onSaved: (aggiornata: PrenotazionePadel) => void;
};

// Modifica i soli campi della partita (orario, partecipanti, palline, note). Le racchette
// noleggiate hanno un editor proprio nella pagina di dettaglio, con salvataggio immediato.
export function EditPrenotazionePadelSheet({
  prenotazione,
  onClose,
  onSaved,
}: Readonly<EditPrenotazionePadelSheetProps>) {
  const [ora, setOra] = useState('');
  const [partecipanti, setPartecipanti] = useState(1);
  const [palline, setPalline] = useState(false);
  const [note, setNote] = useState('');
  const [slots, setSlots] = useState<SlotPadel[]>([]);
  const [maxPartecipanti, setMaxPartecipanti] = useState<number | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const oraCorrente = prenotazione ? formatTime(prenotazione.ora) : null;

  useEffect(() => {
    if (!prenotazione) return;
    setOra(formatTime(prenotazione.ora));
    setPartecipanti(prenotazione.partecipanti);
    setPalline(prenotazione.palline_noleggiate);
    setNote(prenotazione.note);
    setError(null);

    let cancelled = false;
    setIsLoadingSlots(true);
    getDisponibilitaPadel({ data: prenotazione.data })
      .then((disponibilita) => {
        if (cancelled) return;
        setSlots(disponibilita.slots);
        setMaxPartecipanti(disponibilita.max_partecipanti);
      })
      .catch(() => {
        if (!cancelled) setError('Impossibile caricare gli orari disponibili.');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [prenotazione]);

  const handleSave = async () => {
    if (!prenotazione) return;
    if (!ora) {
      setError('Scegli un orario di inizio.');
      return;
    }
    if (partecipanti < prenotazione.racchette_totali) {
      setError(
        `Ci sono ${prenotazione.racchette_totali} racchette noleggiate: rimuovile prima di scendere a ${partecipanti} partecipanti.`
      );
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const aggiornata = await updatePrenotazionePadel(prenotazione.id, {
        ora,
        partecipanti,
        palline_noleggiate: palline,
        note,
      });
      onSaved(aggiornata);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare la partita.'));
    } finally {
      setIsSaving(false);
    }
  };

  const limitePartecipanti = maxPartecipanti ?? prenotazione?.partecipanti ?? 1;

  return (
    <Actionsheet isOpen={prenotazione !== null} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent className="max-h-[90vh]" aria-label="Modifica partita padel">
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <ActionsheetScrollView className="w-full">
          {prenotazione ? (
            <VStack space="md" className="w-full pb-6">
              <VStack>
                <Heading size="md">Modifica partita</Heading>
                <Text size="xs" className="text-muted-foreground">
                  {prenotazione.cliente_nome} · partita da {prenotazione.durata_minuti} minuti
                </Text>
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Orario di inizio
                </Text>
                <SlotPickerPadel
                  slots={slots}
                  value={ora}
                  onChange={setOra}
                  isLoading={isLoadingSlots}
                  slotCorrente={oraCorrente}
                />
              </VStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Partecipanti
                </Text>
                <HStack space="sm" className="items-center">
                  <Pressable
                    onPress={() => setPartecipanti((prev) => Math.max(1, prev - 1))}
                    disabled={partecipanti <= 1}
                    accessibilityRole="button"
                    accessibilityLabel="Diminuisci partecipanti"
                    className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
                      partecipanti <= 1 ? 'opacity-40' : 'active:bg-sky-50'
                    }`}
                  >
                    <Icon as={RemoveIcon} size="sm" className="text-sky-900" />
                  </Pressable>
                  <Text size="lg" className="w-10 text-center font-bold text-sky-900">
                    {partecipanti}
                  </Text>
                  <Pressable
                    onPress={() => setPartecipanti((prev) => Math.min(limitePartecipanti, prev + 1))}
                    disabled={partecipanti >= limitePartecipanti}
                    accessibilityRole="button"
                    accessibilityLabel="Aumenta partecipanti"
                    className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
                      partecipanti >= limitePartecipanti ? 'opacity-40' : 'active:bg-sky-50'
                    }`}
                  >
                    <Icon as={AddIcon} size="sm" className="text-sky-900" />
                  </Pressable>
                  <Text size="2xs" className="text-muted-foreground">
                    max {limitePartecipanti}
                  </Text>
                </HStack>
              </VStack>

              <HStack space="sm" className="items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3">
                <VStack className="flex-1">
                  <Text size="sm" className="font-medium">
                    Palline a noleggio
                  </Text>
                  <Text size="2xs" className="text-muted-foreground">
                    € {formatPrezzo(prenotazione.prezzo_palline)} a partita.
                  </Text>
                </VStack>
                <Switch value={palline} onValueChange={setPalline} />
              </HStack>

              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Note
                </Text>
                <Input>
                  <InputField placeholder="Es. richieste particolari..." value={note} onChangeText={setNote} />
                </Input>
              </VStack>

              {error ? (
                <Box className="rounded-xl bg-rose-50 px-3 py-2">
                  <Text size="xs" className="text-destructive">
                    {error}
                  </Text>
                </Box>
              ) : null}

              <HStack space="sm" className="items-center">
                <Button
                  size="default"
                  className="min-h-11 flex-1"
                  onPress={handleSave}
                  disabled={isSaving}
                  isDisabled={isSaving}
                >
                  {isSaving ? <ButtonSpinner /> : <ButtonText>Salva modifiche</ButtonText>}
                </Button>
                <Button
                  size="default"
                  variant="outline"
                  className="min-h-11 border-2 border-sky-300 bg-white"
                  onPress={onClose}
                  disabled={isSaving}
                  isDisabled={isSaving}
                >
                  <ButtonText className="text-sky-700">Chiudi</ButtonText>
                </Button>
              </HStack>
            </VStack>
          ) : null}
        </ActionsheetScrollView>
      </ActionsheetContent>
    </Actionsheet>
  );
}
