import { ScrollView } from 'react-native';
import { Box } from '@/components/ui/box';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { usePiscinaSelection } from '../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';
import { CANVAS_HEIGHT, CANVAS_WIDTH, remainingForTipo } from '../../../utils/piscinaMappa';
import { EditModeToggle } from './EditModeToggle';
import { PostazioneMarker } from './PostazioneMarker';
import { ZoomControls } from './ZoomControls';

export function MappaCanvas() {
  const {
    postazioni,
    occupazioneByPostazione,
    remainingByPrenotazione,
    scale,
    dragPostazione,
    isPastDate,
    isEditMode,
  } = usePiscinaMappaData();
  const { selectedPrenotazioneId } = usePiscinaSelection();
  const { handleMarkerPress } = usePiscinaSheets();

  return (
    <Box className="relative h-105 w-full overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
      {/* Overlay assoluti, non righe separate sopra il canvas: il Box esterno è `relative` e questi
          controlli sono figli successivi alle ScrollView, quindi restano sempre sopra il contenuto
          scrollabile senza bisogno di uno z-index esplicito. Zoom in alto a sinistra, modalità
          modifica in alto a destra — angoli opposti per non sovrapporsi. */}
      <Box className="absolute left-2 top-2 z-10">
        <ZoomControls />
      </Box>
      <Box className="absolute right-2 top-2 z-10">
        <EditModeToggle />
      </Box>
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
                  !isEditMode &&
                  !occupazioneByPostazione.has(postazione.id) &&
                  Boolean(selectedPrenotazioneId) &&
                  remainingForTipo(
                    remainingByPrenotazione.get(selectedPrenotazioneId ?? ''),
                    postazione.tipo
                  ) > 0
                }
                readOnly={isPastDate}
                editMode={isEditMode}
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
