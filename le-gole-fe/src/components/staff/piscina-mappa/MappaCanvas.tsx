import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { usePiscinaSelection } from '../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';
import { CANVAS_HEIGHT, CANVAS_WIDTH, remainingForTipo } from '../../../utils/piscinaMappa';
import { PostazioneMarker } from './PostazioneMarker';

export function MappaCanvas() {
  const { postazioni, occupazioneByPostazione, remainingByPrenotazione, scale, dragPostazione, isPastDate } =
    usePiscinaMappaData();
  const { selectedPrenotazioneId } = usePiscinaSelection();
  const { handleMarkerPress } = usePiscinaSheets();

  return (
    <Box className="h-105 w-full overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
      <ScrollView horizontal contentContainerStyle={{ width: CANVAS_WIDTH * scale }}>
        <ScrollView contentContainerStyle={{ height: CANVAS_HEIGHT * scale }}>
          <Box
            style={{
              // Le dimensioni sono scalate direttamente (niente `transform: scale`): così la
              // dimensione LAYOUT del box coincide sempre con quella reale/dipinta, ed è la
              // stessa unità di misura usata dai marker per calcolare la propria posizione
              // durante il drag — nessuna conversione ambigua tra coordinate "logiche" e
              // coordinate CSS trasformate (che in precedenza faceva perdere l'aggancio tra
              // dito/puntatore e icona quando lo zoom non era al 100%).
              width: CANVAS_WIDTH * scale,
              height: CANVAS_HEIGHT * scale,
            }}
            className="bg-sky-50"
          >
            {postazioni.map((postazione) => (
              <PostazioneMarker
                key={postazione.id}
                postazione={postazione}
                scale={scale}
                isOccupied={occupazioneByPostazione.has(postazione.id)}
                clienteNome={occupazioneByPostazione.get(postazione.id)?.cliente_nome}
                isSelectable={
                  !occupazioneByPostazione.has(postazione.id) &&
                  Boolean(selectedPrenotazioneId) &&
                  remainingForTipo(
                    remainingByPrenotazione.get(selectedPrenotazioneId ?? ''),
                    postazione.tipo
                  ) > 0
                }
                readOnly={isPastDate}
                onPress={() => handleMarkerPress(postazione)}
                onDragEnd={(dx, dy) => dragPostazione(postazione, dx, dy)}
              />
            ))}
          </Box>
        </ScrollView>
      </ScrollView>
    </Box>
  );
}
