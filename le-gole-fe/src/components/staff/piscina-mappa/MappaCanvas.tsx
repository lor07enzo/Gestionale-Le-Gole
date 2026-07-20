import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { usePiscinaSelection } from '../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';
import { CANVAS_HEIGHT, CANVAS_WIDTH, remainingForTipo } from '../../../utils/piscinaMappa';
import { PostazioneMarker } from './PostazioneMarker';

export function MappaCanvas() {
  const { postazioni, occupazioneByPostazione, remainingByPrenotazione, scale, dragPostazione } =
    usePiscinaMappaData();
  const { selectedPrenotazioneId, selectedWalkInCliente } = usePiscinaSelection();
  const { handleMarkerPress } = usePiscinaSheets();

  return (
    <Box className="h-105 w-full overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
      <ScrollView horizontal contentContainerStyle={{ width: CANVAS_WIDTH * scale }}>
        <ScrollView contentContainerStyle={{ height: CANVAS_HEIGHT * scale }}>
          <Box
            style={{
              width: CANVAS_WIDTH,
              height: CANVAS_HEIGHT,
              transform: [{ scale }],
              transformOrigin: 'top left',
            }}
            className="bg-sky-50"
          >
            {postazioni.map((postazione) => (
              <PostazioneMarker
                key={postazione.id}
                postazione={postazione}
                scale={scale}
                isOccupied={occupazioneByPostazione.has(postazione.id)}
                isSelectable={
                  !occupazioneByPostazione.has(postazione.id) &&
                  (Boolean(selectedWalkInCliente) ||
                    (Boolean(selectedPrenotazioneId) &&
                      remainingForTipo(
                        remainingByPrenotazione.get(selectedPrenotazioneId ?? ''),
                        postazione.tipo
                      ) > 0))
                }
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
