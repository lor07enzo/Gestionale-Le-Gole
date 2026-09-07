import { useEffect, useState } from 'react';
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
} from '@/components/ui/actionsheet';
import {
  createRacchettaPadel,
  updateRacchettaPadel,
  type RacchettaPadel,
} from '../../../services/padel';
import { extractErrorMessage } from '../../../utils/errors';

type RacchettaFormSheetProps = {
  isOpen: boolean;
  /** null = creazione, altrimenti modifica della racchetta passata. */
  racchetta: RacchettaPadel | null;
  onClose: () => void;
  onSaved: (racchetta: RacchettaPadel, isNuova: boolean) => void;
};

export function RacchettaFormSheet({ isOpen, racchetta, onClose, onSaved }: Readonly<RacchettaFormSheetProps>) {
  const [nome, setNome] = useState('');
  const [prezzo, setPrezzo] = useState('');
  const [pezzi, setPezzi] = useState('1');
  const [disponibile, setDisponibile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNome(racchetta?.nome ?? '');
    setPrezzo(racchetta ? racchetta.prezzo_noleggio.replace('.', ',') : '');
    setPezzi(racchetta ? String(racchetta.quantita_disponibile) : '1');
    setDisponibile(racchetta ? racchetta.disponibile : true);
    setError(null);
  }, [isOpen, racchetta]);

  const handleSave = async () => {
    const nomePulito = nome.trim();
    const prezzoNumero = Number.parseFloat(prezzo.replace(',', '.'));
    const pezziNumero = Number.parseInt(pezzi, 10);

    if (!nomePulito) {
      setError('Inserisci la marca (ed eventualmente il modello).');
      return;
    }
    if (!Number.isFinite(prezzoNumero) || prezzoNumero < 0) {
      setError('Inserisci un prezzo di noleggio valido.');
      return;
    }
    if (!Number.isFinite(pezziNumero) || pezziNumero < 1) {
      setError('Serve almeno un pezzo disponibile.');
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const payload = {
        nome: nomePulito,
        prezzo_noleggio: prezzo.replace(',', '.'),
        quantita_disponibile: pezziNumero,
        disponibile,
      };
      const salvata = racchetta
        ? await updateRacchettaPadel(racchetta.id, payload)
        : await createRacchettaPadel(payload);
      onSaved(salvata, racchetta === null);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile salvare la racchetta.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Actionsheet isOpen={isOpen} onClose={onClose}>
      <ActionsheetBackdrop />
      <ActionsheetContent aria-label={racchetta ? 'Modifica racchetta' : 'Nuova racchetta'}>
        <ActionsheetDragIndicatorWrapper>
          <ActionsheetDragIndicator />
        </ActionsheetDragIndicatorWrapper>

        <VStack space="md" className="w-full pb-6">
          <Heading size="md">{racchetta ? 'Modifica racchetta' : 'Nuova racchetta'}</Heading>

          <VStack space="xs">
            <Text size="sm" className="font-medium">
              Marca e modello
            </Text>
            <Input>
              <InputField
                placeholder="Es. Babolat Air Viper"
                value={nome}
                onChangeText={setNome}
                autoCapitalize="words"
              />
            </Input>
          </VStack>

          <HStack space="md" className="items-start">
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Noleggio (€)
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 6,00"
                  keyboardType="decimal-pad"
                  value={prezzo}
                  onChangeText={(next) => setPrezzo(next.replace(/[^0-9.,]/g, ''))}
                />
              </Input>
            </VStack>
            <VStack space="xs" className="flex-1">
              <Text size="sm" className="font-medium">
                Pezzi
              </Text>
              <Input>
                <InputField
                  placeholder="Es. 4"
                  keyboardType="numeric"
                  maxLength={3}
                  value={pezzi}
                  onChangeText={(next) => setPezzi(next.replace(/\D/g, ''))}
                />
              </Input>
            </VStack>
          </HStack>
          <Text size="2xs" className="text-muted-foreground">
            I pezzi limitano quante racchette di questa marca si possono noleggiare in una partita.
          </Text>

          <HStack space="sm" className="items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3">
            <VStack className="flex-1">
              <Text size="sm" className="font-medium">
                Disponibile al noleggio
              </Text>
              <Text size="2xs" className="text-muted-foreground">
                Se disattivata resta a catalogo ma i clienti non possono sceglierla.
              </Text>
            </VStack>
            <Switch value={disponibile} onValueChange={setDisponibile} />
          </HStack>

          {error ? (
            <Text size="xs" className="text-destructive">
              {error}
            </Text>
          ) : null}

          <HStack space="sm" className="items-center">
            <Button size="default" className="min-h-11 flex-1" onPress={handleSave} disabled={isSaving} isDisabled={isSaving}>
              {isSaving ? <ButtonSpinner /> : <ButtonText>{racchetta ? 'Salva' : 'Aggiungi'}</ButtonText>}
            </Button>
            <Button
              size="default"
              variant="outline"
              className="min-h-11 border-2 border-sky-300 bg-white"
              onPress={onClose}
              disabled={isSaving}
              isDisabled={isSaving}
            >
              <ButtonText className="text-sky-700">Annulla</ButtonText>
            </Button>
          </HStack>
        </VStack>
      </ActionsheetContent>
    </Actionsheet>
  );
}
