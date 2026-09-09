import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable } from 'react-native';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { VStack } from '@/components/ui/vstack';
import { Heading } from '@/components/ui/heading';
import { Text } from '@/components/ui/text';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Actionsheet,
  ActionsheetBackdrop,
  ActionsheetContent,
  ActionsheetDragIndicator,
  ActionsheetDragIndicatorWrapper,
  ActionsheetItem,
  ActionsheetItemText,
} from '@/components/ui/actionsheet';
import { AddIcon, Icon, ThreeDotsIcon } from '@/components/ui/icon';
import {
  deleteRacchettaPadel,
  listRacchettePadel,
  updateRacchettaPadel,
  type RacchettaPadel,
} from '../../../services/padel';
import { formatPrezzo } from '../../../utils/prezzi';
import { extractErrorMessage } from '../../../utils/errors';
import { RacchettaFormSheet } from './RacchettaFormSheet';

function avvisa(messaggio: string) {
  if (Platform.OS === 'web') {
    window.alert(messaggio);
  } else {
    Alert.alert('Errore', messaggio);
  }
}

function chiediConferma(messaggio: string, onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(messaggio)) onConfirm();
    return;
  }
  Alert.alert('Confermi?', messaggio, [
    { text: 'No', style: 'cancel' },
    { text: 'Elimina', style: 'destructive', onPress: onConfirm },
  ]);
}

function RacchettaRow({
  racchetta,
  onOpenMenu,
}: Readonly<{ racchetta: RacchettaPadel; onOpenMenu: () => void }>) {
  return (
    <Box className="w-full web:h-full rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
      <HStack space="sm" className="items-start justify-between">
        <VStack space="xs" className="flex-1">
          <HStack space="xs" className="flex-wrap items-center">
            <Text size="sm" className="font-semibold text-sky-900">
              {racchetta.nome}
            </Text>
            {!racchetta.disponibile ? (
              <Box className="rounded-full bg-rose-100 px-2 py-0.5">
                <Text size="2xs" className="font-bold text-rose-700">
                  Nascosta
                </Text>
              </Box>
            ) : null}
          </HStack>
          <HStack space="xs" className="flex-wrap items-center">
            <Box className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5">
              <Text size="2xs" className="font-bold text-sky-700">
                € {formatPrezzo(racchetta.prezzo_noleggio)} a partita
              </Text>
            </Box>
            <Box className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
              <Text size="2xs" className="font-bold text-emerald-700">
                {racchetta.quantita_disponibile} pezzi
              </Text>
            </Box>
          </HStack>
        </VStack>

        <Pressable
          onPress={onOpenMenu}
          accessibilityRole="button"
          accessibilityLabel={`Azioni per ${racchetta.nome}`}
          hitSlop={8}
          className="h-11 w-11 items-center justify-center rounded-full active:bg-sky-50"
        >
          <Icon as={ThreeDotsIcon} size="md" className="text-sky-700" />
        </Pressable>
      </HStack>
    </Box>
  );
}

// Catalogo delle racchette noleggiabili: marca, tariffa e pezzi posseduti sono per riga, non una
// tariffa unica di configurazione. Una racchetta con noleggi già registrati non è eliminabile
// (il backend risponde 400): va nascosta dal noleggio invece che rimossa.
export function RacchetteSection() {
  const [racchette, setRacchette] = useState<RacchettaPadel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<RacchettaPadel | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RacchettaPadel | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listRacchettePadel()
      .then(setRacchette)
      .catch(() => setError('Impossibile caricare il catalogo racchette.'))
      .finally(() => setIsLoading(false));
  }, []);

  const apriNuova = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const apriModifica = (racchetta: RacchettaPadel) => {
    setMenuFor(null);
    setEditing(racchetta);
    setFormOpen(true);
  };

  const handleSaved = (salvata: RacchettaPadel, isNuova: boolean) => {
    setRacchette((prev) =>
      isNuova
        ? [...prev, salvata].sort((a, b) => a.nome.localeCompare(b.nome))
        : prev.map((r) => (r.id === salvata.id ? salvata : r))
    );
    setFormOpen(false);
    setEditing(null);
  };

  const handleToggleDisponibile = async (racchetta: RacchettaPadel) => {
    setMenuFor(null);
    setBusyId(racchetta.id);
    try {
      const updated = await updateRacchettaPadel(racchetta.id, { disponibile: !racchetta.disponibile });
      setRacchette((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      avvisa(extractErrorMessage(err, 'Impossibile aggiornare la racchetta.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (racchetta: RacchettaPadel) => {
    setMenuFor(null);
    chiediConferma(`Eliminare «${racchetta.nome}» dal catalogo?`, async () => {
      setBusyId(racchetta.id);
      try {
        await deleteRacchettaPadel(racchetta.id);
        setRacchette((prev) => prev.filter((r) => r.id !== racchetta.id));
      } catch (err) {
        avvisa(extractErrorMessage(err, 'Impossibile eliminare la racchetta.'));
      } finally {
        setBusyId(null);
      }
    });
  };

  let contenutoCatalogo: React.ReactNode;
  if (isLoading) {
    contenutoCatalogo = (
      <HStack className="items-center justify-center py-8">
        <Spinner size="large" />
      </HStack>
    );
  } else if (racchette.length === 0) {
    contenutoCatalogo = (
      <VStack space="sm" className="items-center rounded-2xl border border-dashed border-sky-200 bg-sky-50 px-5 py-8">
        <Text size="2xl">🎾</Text>
        <Text size="sm" className="text-center text-muted-foreground">
          Nessuna racchetta a catalogo. Aggiungine una per poterla noleggiare a una partita.
        </Text>
      </VStack>
    );
  } else {
    contenutoCatalogo = (
      <Box className="-m-1.5 w-full flex-row flex-wrap">
        {racchette.map((racchetta) => (
          <Box key={racchetta.id} className="w-full p-1.5 md:w-1/2 lg:w-1/3">
            {busyId === racchetta.id ? (
              <Box className="w-full web:h-full items-center justify-center rounded-2xl border border-sky-100 bg-white p-6">
                <Spinner size="small" />
              </Box>
            ) : (
              <RacchettaRow racchetta={racchetta} onOpenMenu={() => setMenuFor(racchetta)} />
            )}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <VStack space="md" className="w-full">
      <VStack space="xs">
        <Heading size="md">Racchette a noleggio</Heading>
        <Text size="sm" className="text-muted-foreground">
          Ogni marca ha la propria tariffa e i propri pezzi disponibili.
        </Text>
      </VStack>

      <Button size="sm" onPress={apriNuova} className="min-h-11 self-start">
        <ButtonIcon as={AddIcon} />
        <ButtonText>Nuova racchetta</ButtonText>
      </Button>

      {error ? (
        <Text size="sm" className="text-destructive">
          {error}
        </Text>
      ) : null}

      {contenutoCatalogo}

      <Actionsheet isOpen={menuFor !== null} onClose={() => setMenuFor(null)}>
        <ActionsheetBackdrop />
        <ActionsheetContent aria-label={`Azioni racchetta ${menuFor?.nome ?? ''}`}>
          <ActionsheetDragIndicatorWrapper>
            <ActionsheetDragIndicator />
          </ActionsheetDragIndicatorWrapper>
          {menuFor ? (
            <VStack className="w-full pb-6">
              <ActionsheetItem onPress={() => apriModifica(menuFor)}>
                <ActionsheetItemText>Modifica</ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem onPress={() => handleToggleDisponibile(menuFor)}>
                <ActionsheetItemText>
                  {menuFor.disponibile ? 'Nascondi dal noleggio' : 'Rendi disponibile'}
                </ActionsheetItemText>
              </ActionsheetItem>
              <ActionsheetItem onPress={() => handleDelete(menuFor)}>
                <ActionsheetItemText className="text-destructive">Elimina</ActionsheetItemText>
              </ActionsheetItem>
            </VStack>
          ) : null}
        </ActionsheetContent>
      </Actionsheet>

      <RacchettaFormSheet
        isOpen={formOpen}
        racchetta={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={handleSaved}
      />
    </VStack>
  );
}
