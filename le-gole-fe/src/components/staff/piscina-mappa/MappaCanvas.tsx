import { Box } from '@/components/ui/box';
import { usePiscinaMappaData } from '../../../context/PiscinaMappaDataContext';
import { usePiscinaSelection } from '../../../context/PiscinaSelectionContext';
import { usePiscinaSheets } from '../../../context/PiscinaSheetsContext';
import { ZoomPanCanvas } from '../../shared/ZoomPanCanvas';
import { CANVAS_HEIGHT, CANVAS_WIDTH, MAX_SCALE, MIN_SCALE, remainingForTipo } from '../../../utils/piscinaMappa';
import { EditModeToggle } from './EditModeToggle';
import { PostazioneMarker } from './PostazioneMarker';
import { ZoomControls } from './ZoomControls';

export function MappaCanvas() {
  const {
    postazioni,
    occupazioneByPostazione,
    remainingByPrenotazione,
    scale,
    setScale,
    dragPostazione,
    isPastDate,
    isEditMode,
  } = usePiscinaMappaData();
  const { selectedPrenotazioneId } = usePiscinaSelection();
  const { handleMarkerPress } = usePiscinaSheets();

  return (
    <Box className="relative h-105 w-full overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
      {/* Overlay assoluti, non righe separate sopra il canvas: il Box esterno è `relative` e questi
          controlli sono figli successivi al canvas pannabile, quindi restano sempre sopra il
          contenuto trascinabile senza bisogno di uno z-index esplicito. Zoom in alto a sinistra,
          modalità modifica in alto a destra — angoli opposti per non sovrapporsi. */}
      <Box className="absolute left-2 top-2 z-10">
        <ZoomControls />
      </Box>
      <Box className="absolute right-2 top-2 z-10">
        <EditModeToggle />
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
            isOccupied={occupazioneByPostazione.has(postazione.id)}
            clienteNome={occupazioneByPostazione.get(postazione.id)?.cliente_nome}
            isSelectable={
              !isEditMode &&
              !occupazioneByPostazione.has(postazione.id) &&
              Boolean(selectedPrenotazioneId) &&
              remainingForTipo(remainingByPrenotazione.get(selectedPrenotazioneId ?? ''), postazione.tipo) > 0
            }
            readOnly={isPastDate}
            editMode={isEditMode}
            onPress={() => handleMarkerPress(postazione)}
            onDragEnd={(dx, dy) => dragPostazione(postazione, dx, dy)}
          />
        ))}
      </ZoomPanCanvas>
    </Box>
  );
}
