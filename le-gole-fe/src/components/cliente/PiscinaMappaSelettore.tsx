import { useEffect, useState } from 'react';
import { Box } from '@/components/ui/box';
import { HStack } from '@/components/ui/hstack';
import { Text } from '@/components/ui/text';
import { Spinner } from '@/components/ui/spinner';
import { Button, ButtonIcon, ButtonText } from '@/components/ui/button';
import { AddIcon, RemoveIcon } from '@/components/ui/icon';
import { listPostazioni, type Postazione } from '../../services/struttura';
import { getPostazioniOccupate } from '../../services/prenotazioni';
import { PostazioneMarker } from '../staff/piscina-mappa/PostazioneMarker';
import { ZoomPanCanvas } from '../shared/ZoomPanCanvas';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SCALE, MIN_SCALE, SCALE_STEP, clamp, toISODate } from '../../utils/piscinaMappa';

export type PiscinaSelezione = { ombrellone: number; gazebo: number; ids: string[] };

function contaSelezione(selectedIds: Set<string>, postazioni: Postazione[]): PiscinaSelezione {
  let ombrellone = 0;
  let gazebo = 0;
  const ids: string[] = [];
  for (const p of postazioni) {
    if (selectedIds.has(p.id)) {
      ids.push(p.id);
      if (p.tipo === 'GAZEBO') gazebo += 1;
      else ombrellone += 1;
    }
  }
  return { ombrellone, gazebo, ids };
}

// Mappa piscina di sola scelta per l'Area Cliente: stesso canvas/marker della mappa staff
// (sezione 5 CLAUDE.md), ma senza drag/editing/fogli — il tap su una postazione libera la
// seleziona/deseleziona, sostituendo gli input numerici di ombrellone/gazebo (sezione 7). La
// scelta di una postazione specifica non viene persistita lato backend (Prenotazione_Piscina non
// ha un legame diretto con una Postazione, solo un conteggio — l'assegnazione fisica resta
// un'azione dello staff): qui serve solo a determinare la quantità e a far scegliere al cliente
// dove preferirebbe sedersi, in modo più naturale di due campi numerici.
export function PiscinaMappaSelettore({
  inventarioId,
  selectedDate,
  selectedIds,
  onSelectionChange,
}: Readonly<{
  inventarioId: string;
  selectedDate: Date;
  selectedIds: Set<string>;
  onSelectionChange: (selezione: PiscinaSelezione) => void;
}>) {
  const [postazioni, setPostazioni] = useState<Postazione[]>([]);
  const [occupatiIds, setOccupatiIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const dataISO = toISODate(selectedDate);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);
    setLoadError(null);
    // Un giorno diverso ha occupazioni diverse: una postazione scelta per il giorno precedente
    // potrebbe non essere più libera (o non avere più senso) su quello nuovo — la selezione
    // riparte da zero ad ogni cambio di data/piscina.
    onSelectionChange({ ombrellone: 0, gazebo: 0, ids: [] });

    Promise.all([
      listPostazioni(inventarioId, dataISO),
      getPostazioniOccupate({ inventario: inventarioId, data: dataISO }),
    ])
      .then(([postazioniResult, occupateResult]) => {
        if (!isCurrent) return;
        setPostazioni(postazioniResult);
        setOccupatiIds(new Set(occupateResult));
      })
      .catch(() => {
        if (isCurrent) setLoadError('Impossibile caricare la mappa delle postazioni.');
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventarioId, dataISO]);

  const handleToggle = (postazione: Postazione) => {
    if (occupatiIds.has(postazione.id)) return;
    const next = new Set(selectedIds);
    if (next.has(postazione.id)) {
      next.delete(postazione.id);
    } else {
      next.add(postazione.id);
    }
    onSelectionChange(contaSelezione(next, postazioni));
  };

  if (isLoading) {
    return (
      <Box className="h-40 w-full items-center justify-center rounded-2xl border border-sky-200 bg-sky-50">
        <Spinner />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box className="w-full items-center rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <Text size="sm" className="text-destructive">
          {loadError}
        </Text>
      </Box>
    );
  }

  if (postazioni.length === 0) {
    return (
      <Box className="w-full items-center rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <Text size="sm" className="text-center text-sky-900/70">
          Nessuna postazione mappata per questa piscina: indica solo l'orario, ci penserà lo staff
          in biglietteria.
        </Text>
      </Box>
    );
  }

  return (
    <Box className="w-full gap-2">
      <Box className="relative h-72 w-full overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
        <Box className="absolute left-2 top-2 z-10">
          <HStack space="xs" className="items-center">
            <Button
              size="icon"
              variant="outline"
              className="rounded-full border-2 border-sky-300 bg-white shadow-sm"
              onPress={() => setScale((s) => clamp(s - SCALE_STEP, MIN_SCALE, MAX_SCALE))}
              accessibilityLabel="Riduci zoom"
            >
              <ButtonIcon as={RemoveIcon} className="text-sky-900" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 min-w-12 rounded-full border-2 border-sky-300 bg-white px-2 shadow-sm"
              onPress={() => setScale(1)}
              accessibilityLabel="Reimposta lo zoom al 100%"
            >
              <ButtonText className="font-bold text-sky-900">{Math.round(scale * 100)}%</ButtonText>
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="rounded-full border-2 border-sky-300 bg-white shadow-sm"
              onPress={() => setScale((s) => clamp(s + SCALE_STEP, MIN_SCALE, MAX_SCALE))}
              accessibilityLabel="Aumenta zoom"
            >
              <ButtonIcon as={AddIcon} className="text-sky-900" />
            </Button>
          </HStack>
        </Box>
        <ZoomPanCanvas
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          scale={scale}
          setScale={setScale}
          minScale={MIN_SCALE}
          maxScale={MAX_SCALE}
          className="h-full"
        >
          {postazioni.map((postazione) => (
            <PostazioneMarker
              key={postazione.id}
              postazione={postazione}
              scale={scale}
              isOccupied={occupatiIds.has(postazione.id)}
              isSelectable={!occupatiIds.has(postazione.id)}
              isSelected={selectedIds.has(postazione.id)}
              readOnly
              editMode={false}
              onPress={() => handleToggle(postazione)}
              onDragEnd={() => {}}
            />
          ))}
        </ZoomPanCanvas>
      </Box>
      <HStack space="md" className="flex-wrap items-center justify-center">
        <HStack space="xs" className="items-center">
          <Box className="h-3.5 w-3.5 rounded-full border-2 border-sky-600 bg-sky-200" />
          <Text size="2xs" className="text-sky-900/70">
            Selezionata
          </Text>
        </HStack>
        <HStack space="xs" className="items-center">
          <Box className="h-3.5 w-3.5 rounded-full border-2 border-sky-300 bg-white" />
          <Text size="2xs" className="text-sky-900/70">
            Libera
          </Text>
        </HStack>
        <HStack space="xs" className="items-center">
          <Box className="h-3.5 w-3.5 rounded-full border-2 border-emerald-500 bg-emerald-50" />
          <Text size="2xs" className="text-sky-900/70">
            Occupata
          </Text>
        </HStack>
      </HStack>
    </Box>
  );
}
