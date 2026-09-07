import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView } from 'react-native';
import type { ViewStyle } from 'react-native';
import { router, type Href } from 'expo-router';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Text } from '@/components/ui/text';
import { Input, InputField } from '@/components/ui/input';
import { Button, ButtonSpinner, ButtonText } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AddIcon, Icon, RemoveIcon } from '@/components/ui/icon';
import { StaffPageHeader } from '../../../../src/components/staff/StaffPageHeader';
import { DateNavBar } from '../../../../src/components/shared/DateNavBar';
import { SlotPickerPadel } from '../../../../src/components/shared/SlotPickerPadel';
import { createCliente } from '../../../../src/services/clienti';
import {
  createPrenotazionePadel,
  getConfigurazionePadel,
  listGiorniChiusiPadel,
  listPrenotazioniPadel,
  type ConfigurazionePadel,
  type PrenotazionePadel,
} from '../../../../src/services/padel';
import { toISODate } from '../../../../src/utils/piscinaMappa';
import { calcolaSlotOccupazione, formatTotaleEuro } from '../../../../src/utils/padel';
import { formatPrezzo } from '../../../../src/utils/prezzi';
import { extractErrorMessage } from '../../../../src/utils/errors';

const SEZIONE_CARD = 'w-full rounded-2xl border border-sky-200 bg-white p-4';
const SEZIONE_TITOLO = 'font-bold uppercase tracking-wide text-sky-700';

// Solo web: riserva sempre lo spazio della scrollbar verticale, così il padding destro dello
// ScrollView non si assottiglia rispetto al sinistro quando il contenuto trabocca.
const scrollViewStyle =
  Platform.OS === 'web' ? ({ scrollbarGutter: 'stable' } as unknown as ViewStyle) : undefined;

export default function NuovaPartitaPadelScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [configurazione, setConfigurazione] = useState<ConfigurazionePadel | null>(null);
  const [giorniChiusi, setGiorniChiusi] = useState<string[]>([]);
  const [partiteDelGiorno, setPartiteDelGiorno] = useState<PrenotazionePadel[]>([]);
  const [isLoadingBase, setIsLoadingBase] = useState(true);
  const [isLoadingGiorno, setIsLoadingGiorno] = useState(true);

  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [ora, setOra] = useState('');
  const [partecipanti, setPartecipanti] = useState(2);
  const [palline, setPalline] = useState(false);
  const [note, setNote] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getConfigurazionePadel(), listGiorniChiusiPadel()])
      .then(([config, chiusure]) => {
        setConfigurazione(config);
        setGiorniChiusi(chiusure.map((giorno) => giorno.data));
        setPartecipanti(Math.min(2, config.max_partecipanti));
      })
      .catch(() => setError('Impossibile caricare la configurazione del campo.'))
      .finally(() => setIsLoadingBase(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingGiorno(true);
    listPrenotazioniPadel({ data: toISODate(selectedDate) })
      .then((partite) => {
        if (!cancelled) setPartiteDelGiorno(partite);
      })
      .catch(() => {
        if (!cancelled) setPartiteDelGiorno([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingGiorno(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  // Cambiare giorno azzera l'orario: uno slot libero in una data può essere occupato in un'altra.
  useEffect(() => {
    setOra('');
  }, [selectedDate]);

  // La griglia si calcola qui invece di leggere l'azione pubblica `disponibilita`, che restituisce
  // zero slot a servizio spento o giorno chiuso: due condizioni che valgono solo per il canale
  // online, mentre lo staff deve poter registrare una partita comunque.
  const slots = useMemo(() => {
    if (!configurazione) return [];
    return calcolaSlotOccupazione(
      configurazione.slot_disponibili,
      partiteDelGiorno,
      configurazione.durata_partita_minuti
    );
  }, [configurazione, partiteDelGiorno]);

  const isGiornoChiuso = giorniChiusi.includes(toISODate(selectedDate));
  const maxPartecipanti = configurazione?.max_partecipanti ?? 4;

  const totale = useMemo(() => {
    if (!configurazione) return 0;
    const partita = Number.parseFloat(configurazione.prezzo_partita) || 0;
    const setPalline = palline ? Number.parseFloat(configurazione.prezzo_noleggio_palline) || 0 : 0;
    return partita + setPalline;
  }, [configurazione, palline]);

  const handleSubmit = async () => {
    if (!nome.trim() || !telefono.trim()) {
      setError('Nome e telefono del cliente sono obbligatori.');
      return;
    }
    if (!ora) {
      setError("Scegli l'orario di inizio della partita.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const cliente = await createCliente({ nome: nome.trim(), telefono: telefono.trim() });
      const partita = await createPrenotazionePadel({
        cliente_id: cliente.id,
        data: toISODate(selectedDate),
        ora,
        partecipanti,
        palline_noleggiate: palline,
        note: note.trim(),
        stato: 'CONFIRMED',
      });
      router.replace(`/staff/padel/prenotazioni/${partita.id}` as Href);
    } catch (err) {
      setError(extractErrorMessage(err, 'Impossibile registrare la partita.'));
      setIsSaving(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="px-4 py-6 md:px-8 md:py-10"
      style={scrollViewStyle}
    >
      <VStack space="lg" className="w-full">
        <StaffPageHeader
          title="Nuova partita"
          subtitle="Registra una prenotazione al banco o al telefono: nasce già confermata."
          fallbackHref="/staff/padel/prenotazioni"
        />

        <VStack space="sm" className={SEZIONE_CARD}>
          <Text size="xs" className={SEZIONE_TITOLO}>
            Quando
          </Text>
          {/* minDate a oggi: una partita non si prenota nel passato. */}
          <DateNavBar selectedDate={selectedDate} onChange={setSelectedDate} minDate={new Date()} />

          {isGiornoChiuso ? (
            <Box className="rounded-xl bg-amber-50 px-3 py-2">
              <Text size="xs" className="font-medium text-amber-800">
                Giorno segnato come chiuso: online non è prenotabile, ma puoi comunque registrare
                una partita da qui.
              </Text>
            </Box>
          ) : null}

          {configurazione && !configurazione.attivo ? (
            <Box className="rounded-xl bg-amber-50 px-3 py-2">
              <Text size="xs" className="font-medium text-amber-800">
                Prenotazioni online disattivate: la registrazione dallo staff resta possibile.
              </Text>
            </Box>
          ) : null}

          <Text size="sm" className="font-medium">
            Orario di inizio
          </Text>
          <SlotPickerPadel
            slots={slots}
            value={ora}
            onChange={setOra}
            isLoading={isLoadingBase || isLoadingGiorno}
            emptyMessage="Nessun orario configurato: controlla orario e durata nella pagina Padel."
          />
          {configurazione ? (
            <Text size="2xs" className="text-muted-foreground">
              Ogni partita dura {configurazione.durata_partita_minuti} minuti.
            </Text>
          ) : null}
        </VStack>

        <VStack space="sm" className={SEZIONE_CARD}>
          <Text size="xs" className={SEZIONE_TITOLO}>
            Cliente
          </Text>
          <Box className="-m-1.5 w-full flex-row flex-wrap">
            <Box className="w-full p-1.5 md:w-1/2">
              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Nome <Text className="text-destructive">*</Text>
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. Mario Rossi"
                    value={nome}
                    onChangeText={setNome}
                    autoCapitalize="words"
                  />
                </Input>
              </VStack>
            </Box>
            <Box className="w-full p-1.5 md:w-1/2">
              <VStack space="xs">
                <Text size="sm" className="font-medium">
                  Telefono <Text className="text-destructive">*</Text>
                </Text>
                <Input>
                  <InputField
                    placeholder="Es. 3401234567"
                    keyboardType="phone-pad"
                    value={telefono}
                    onChangeText={setTelefono}
                  />
                </Input>
              </VStack>
            </Box>
          </Box>
          <Text size="2xs" className="text-muted-foreground">
            Se il numero è già in anagrafica la scheda viene aggiornata, senza duplicare il cliente.
          </Text>
        </VStack>

        <VStack space="sm" className={SEZIONE_CARD}>
          <Text size="xs" className={SEZIONE_TITOLO}>
            Partita
          </Text>

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
                onPress={() => setPartecipanti((prev) => Math.min(maxPartecipanti, prev + 1))}
                disabled={partecipanti >= maxPartecipanti}
                accessibilityRole="button"
                accessibilityLabel="Aumenta partecipanti"
                className={`h-11 w-11 items-center justify-center rounded-full border-2 border-sky-300 bg-white ${
                  partecipanti >= maxPartecipanti ? 'opacity-40' : 'active:bg-sky-50'
                }`}
              >
                <Icon as={AddIcon} size="sm" className="text-sky-900" />
              </Pressable>
              <Text size="2xs" className="text-muted-foreground">
                max {maxPartecipanti}
              </Text>
            </HStack>
          </VStack>

          <HStack space="sm" className="items-center justify-between rounded-xl border border-sky-100 bg-sky-50 p-3">
            <VStack className="flex-1">
              <Text size="sm" className="font-medium">
                Palline a noleggio
              </Text>
              <Text size="2xs" className="text-muted-foreground">
                {configurazione ? `€ ${formatPrezzo(configurazione.prezzo_noleggio_palline)} a partita.` : ''}
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

          <Text size="2xs" className="text-muted-foreground">
            Le racchette a noleggio si aggiungono dal dettaglio della partita, subito dopo il
            salvataggio.
          </Text>
        </VStack>

        <VStack space="sm" className={SEZIONE_CARD}>
          <Text size="xs" className={SEZIONE_TITOLO}>
            Riepilogo
          </Text>
          <HStack className="items-center justify-between">
            <Text size="sm" className="text-muted-foreground">
              Partita{palline ? ' + palline' : ''}
            </Text>
            <Text size="lg" className="font-bold text-sky-900">
              € {formatTotaleEuro(totale)}
            </Text>
          </HStack>

          {error ? (
            <Box className="rounded-xl bg-rose-50 px-3 py-2">
              <Text size="xs" className="text-destructive">
                {error}
              </Text>
            </Box>
          ) : null}

          <Button
            size="default"
            className="min-h-12 w-full"
            onPress={handleSubmit}
            disabled={isSaving}
            isDisabled={isSaving}
          >
            {isSaving ? <ButtonSpinner /> : <ButtonText>Registra partita</ButtonText>}
          </Button>
        </VStack>
      </VStack>
    </ScrollView>
  );
}
