import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PiscinaSheetsProvider, usePiscinaSheets } from '../PiscinaSheetsContext';
import type { PiscinaInventario, Postazione } from '../../services/struttura';
import type { OccupazionePostazione, PrenotazionePiscina } from '../../services/prenotazioni';
import type { ResiduiPrenotazione } from '../../utils/piscinaMappa';

// PiscinaSheetsContext dipende da usePiscinaMappaData()/usePiscinaSelection() — mockati
// direttamente (non montando i provider reali) per isolare la sola logica di questo context
// (guardie sui giorni passati, validazioni orario, calcolo dei limiti lettini/sdraie): stesso
// principio "un mock per modulo esterno" già usato per services/* in PiscinaMappaDataContext.test.tsx.
jest.mock('../PiscinaMappaDataContext', () => ({
  usePiscinaMappaData: jest.fn(),
}));
jest.mock('../PiscinaSelectionContext', () => ({
  usePiscinaSelection: jest.fn(),
}));
jest.mock('../../services/clienti', () => ({
  createCliente: jest.fn(),
}));

import { usePiscinaMappaData } from '../PiscinaMappaDataContext';
import { usePiscinaSelection } from '../PiscinaSelectionContext';
import { createCliente } from '../../services/clienti';

const mockUseMappaData = usePiscinaMappaData as jest.MockedFunction<typeof usePiscinaMappaData>;
const mockUseSelection = usePiscinaSelection as jest.MockedFunction<typeof usePiscinaSelection>;
const mockCreateCliente = createCliente as jest.MockedFunction<typeof createCliente>;

const INVENTARIO_ID = 'inv-1';
// Data fissa deliberatamente lontana nel futuro (non "oggi" vero): isPastDate è comunque
// impostato esplicitamente nei fixture sotto, non derivato da questa data — usarne una lontana da
// qualunque data reale di esecuzione dei test evita che isSameDay(selectedDate, new Date()) in
// validateOrarioArrivo() scatti per coincidenza, senza dover mockare l'orologio di sistema.
const SELECTED_DATE = new Date(2030, 0, 15);

function buildInventario(overrides: Partial<PiscinaInventario> = {}): PiscinaInventario {
  return {
    id: INVENTARIO_ID,
    nome: 'Piscina Le Gole',
    descrizione: '',
    prezzo_ingresso: '5.00',
    prezzo_ingresso_ridotto: '0.00',
    prezzo_ingresso_bambino: '0.00',
    prezzo_ombrellone: '4.00',
    prezzo_gazebo: '8.00',
    prezzo_lettino: '2.00',
    prezzo_sdraia: '2.00',
    totale_ombrelloni: 5,
    totale_gazebi: 3,
    totale_lettini: 10,
    totale_sdraie: 10,
    orario_apertura: '09:00',
    orario_chiusura: '19:00',
    orario_inizio_ridotto: '14:00',
    eta_minima_bambino: 3,
    eta_massima_bambino: 12,
    isActive: true,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildPostazione(overrides: Partial<Postazione> = {}): Postazione {
  return {
    id: 'post-1',
    inventario: INVENTARIO_ID,
    tipo: 'OMBRELLONE',
    numero: 1,
    pos_x: 50,
    pos_y: 50,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function buildPrenotazione(overrides: Partial<PrenotazionePiscina> = {}): PrenotazionePiscina {
  return {
    id: 'pren-1',
    cliente_id: 'cliente-1',
    cliente_nome: 'Mario Rossi',
    cliente_telefono: '3330000000',
    note: '',
    data: '2026-08-10',
    ora: '10:00:00',
    stato: 'CONFIRMED',
    inventario: INVENTARIO_ID,
    inventario_nome: 'Piscina Le Gole',
    ingressi: 1,
    ingressi_ridotti: 0,
    ingressi_bambini: 0,
    ingressi_gratuiti: 0,
    ombrellone: 2,
    gazebo: 0,
    lettino: 2,
    sdraia: 0,
    creata_da_staff: false,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T09:00:00.000Z',
    ...overrides,
  };
}

function buildOccupazione(overrides: Partial<OccupazionePostazione> = {}): OccupazionePostazione {
  return {
    id: 'occ-1',
    postazione: 'post-1',
    data: '2026-08-10',
    prenotazione: 'pren-1',
    cliente_nome: 'Mario Rossi',
    numero_lettini: 0,
    numero_sdraie: 0,
    orario_arrivo_previsto: '10:00',
    arrivato: false,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T09:00:00.000Z',
    ...overrides,
  };
}

type MappaDataOverrides = Partial<ReturnType<typeof usePiscinaMappaData>>;

// Fixture di base della mappa dati: nessuna postazione occupata, una prenotazione con 2 ombrelloni
// residui (nessuna occupazione collegata), sufficiente per la maggior parte dei test sui guardrail
// di PiscinaSheetsContext senza dover ricostruire ogni volta l'intero oggetto.
function buildMappaData(overrides: MappaDataOverrides = {}): ReturnType<typeof usePiscinaMappaData> {
  const residui: ResiduiPrenotazione = { ombrellone: 2, gazebo: 0, lettino: 2, sdraia: 0 };
  return {
    inventarioId: INVENTARIO_ID,
    inventario: buildInventario(),
    postazioni: [buildPostazione()],
    prenotazioni: [buildPrenotazione()],
    occupazioni: [],
    selectedDate: SELECTED_DATE,
    setSelectedDate: jest.fn(),
    isPastDate: false,
    isLoading: false,
    error: null,
    scale: 1,
    setScale: jest.fn(),
    isEditMode: false,
    setIsEditMode: jest.fn(),
    occupazioneByPostazione: new Map(),
    remainingByPrenotazione: new Map([['pren-1', residui]]),
    daAssegnare: [buildPrenotazione()],
    soloIngresso: [],
    clientiDelGiorno: [],
    disponibilita: null,
    giornoPieno: null,
    isTogglingGiornoPieno: false,
    toggleGiornoPieno: jest.fn(),
    dragPostazione: jest.fn(),
    addPostazione: jest.fn().mockResolvedValue(buildPostazione()),
    removePostazione: jest.fn().mockResolvedValue(undefined),
    assignOccupazione: jest.fn().mockResolvedValue(buildOccupazione()),
    updateOccupazioneEntry: jest.fn().mockResolvedValue(buildOccupazione()),
    removeOccupazione: jest.fn().mockResolvedValue(undefined),
    addPrenotazione: jest.fn().mockResolvedValue(buildPrenotazione()),
    editPrenotazione: jest.fn().mockResolvedValue(buildPrenotazione()),
    cancelPrenotazione: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function setupMocks(mappaOverrides: MappaDataOverrides = {}, selectedPrenotazioneId: string | null = 'pren-1') {
  const mappaData = buildMappaData(mappaOverrides);
  mockUseMappaData.mockReturnValue(mappaData);
  mockUseSelection.mockReturnValue({
    selectedPrenotazioneId,
    selectPrenotazioneCandidate: jest.fn(),
  });
  return mappaData;
}

function renderSheets() {
  return renderHook(() => usePiscinaSheets(), { wrapper: PiscinaSheetsProvider });
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('PiscinaSheetsContext — foglio "Aggiungi postazione"', () => {
  it('confirmAddPostazione rifiuta su un giorno passato senza chiamare addPostazione', async () => {
    const mappaData = setupMocks({ isPastDate: true });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(result.current.sheetError).toMatch(/giorno passato/);
    expect(mappaData.addPostazione).not.toHaveBeenCalled();
  });

  it('confirmAddPostazione rifiuta quando il tipo selezionato ha già raggiunto il limite del listino', async () => {
    const mappaData = setupMocks({
      inventario: buildInventario({ totale_ombrelloni: 1 }),
      postazioni: [buildPostazione({ id: 'unica-postazione', tipo: 'OMBRELLONE' })],
    });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    expect(result.current.newTipo).toBe('OMBRELLONE');
    expect(result.current.capacitaOmbrelloni).toEqual({ usati: 1, totale: 1 });

    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(result.current.sheetError).toMatch(/Limite raggiunto/);
    expect(mappaData.addPostazione).not.toHaveBeenCalled();
  });

  it('confirmAddPostazione crea la postazione con il primo numero libero e chiude il foglio', async () => {
    const mappaData = setupMocks({
      postazioni: [buildPostazione({ id: 'p1', numero: 1 }), buildPostazione({ id: 'p2', numero: 2 })],
    });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    expect(result.current.newNumero).toBe('3'); // primo numero libero (nextAvailableNumero)

    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(mappaData.addPostazione).toHaveBeenCalledWith({
      tipo: 'OMBRELLONE',
      numero: 3,
      pos_x: 50,
      pos_y: 50,
    });
    expect(result.current.sheetMode).toBeNull();
  });
});

describe('PiscinaSheetsContext — assegnazione postazione', () => {
  it('handleMarkerPress su una postazione libera con un cliente selezionato precompila i residui', async () => {
    setupMocks({}, 'pren-1');
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'libera', tipo: 'OMBRELLONE' }));
    });

    expect(result.current.sheetMode).toBe('assign');
    expect(result.current.sheetForm.clienteNome).toBe('Mario Rossi');
    expect(result.current.sheetForm.lettini).toBe('2'); // dal residuo, non dal totale prenotato
  });

  it('handleMarkerPress su una postazione già occupata apre il foglio "occupant"', async () => {
    const occ = buildOccupazione({ id: 'occ-1', postazione: 'post-occupata' });
    setupMocks({
      occupazioneByPostazione: new Map([['post-occupata', occ]]),
    });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'post-occupata' }));
    });

    expect(result.current.sheetMode).toBe('occupant');
    expect(result.current.sheetForm.clienteNome).toBe('Mario Rossi');
  });

  it('confirmAssign rifiuta se non è stato selezionato nessun cliente', async () => {
    const mappaData = setupMocks({}, null);
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'libera' }));
    });
    await act(async () => {
      await result.current.confirmAssign();
    });

    expect(result.current.sheetError).toMatch(/Seleziona un cliente/);
    expect(mappaData.assignOccupazione).not.toHaveBeenCalled();
  });

  it('confirmAssign rifiuta se i lettini richiesti superano il residuo del cliente', async () => {
    const mappaData = setupMocks({}, 'pren-1'); // residuo lettino = 2 (vedi buildMappaData)
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'libera' }));
    });
    await act(async () => {
      result.current.updateSheetForm({ lettini: '5' });
    });
    await act(async () => {
      await result.current.confirmAssign();
    });

    expect(result.current.sheetError).toMatch(/massimo 2/);
    expect(mappaData.assignOccupazione).not.toHaveBeenCalled();
  });

  it('confirmAssign assegna la postazione con il payload atteso e chiude il foglio', async () => {
    const mappaData = setupMocks({}, 'pren-1');
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'target-postazione' }));
    });
    await act(async () => {
      await result.current.confirmAssign();
    });

    expect(mappaData.assignOccupazione).toHaveBeenCalledWith(
      expect.objectContaining({
        postazione: 'target-postazione',
        prenotazione: 'pren-1',
        cliente_nome: 'Mario Rossi',
        numero_lettini: 2,
        arrivato: false,
      })
    );
    expect(result.current.sheetMode).toBeNull();
  });
});

describe('PiscinaSheetsContext — check-in e liberazione postazione', () => {
  function setupOccupata(occOverrides: Partial<OccupazionePostazione> = {}) {
    const occ = buildOccupazione({ id: 'occ-1', postazione: 'post-occupata', arrivato: false, ...occOverrides });
    const mappaData = setupMocks({ occupazioneByPostazione: new Map([['post-occupata', occ]]) });
    return { mappaData, occ };
  }

  it('toggleArrivato inverte lo stato di arrivo della postazione corrente', async () => {
    const { mappaData } = setupOccupata();
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'post-occupata' }));
    });
    expect(result.current.arrivato).toBe(false);

    await act(async () => {
      await result.current.toggleArrivato();
    });

    expect(mappaData.updateOccupazioneEntry).toHaveBeenCalledWith('occ-1', { arrivato: true });
  });

  it('toggleArrivato rifiuta su un giorno passato', async () => {
    const { mappaData } = setupOccupata();
    mockUseMappaData.mockReturnValue({ ...mockUseMappaData(), isPastDate: true });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'post-occupata' }));
    });
    await act(async () => {
      await result.current.toggleArrivato();
    });

    expect(result.current.sheetError).toMatch(/giorno passato/);
    expect(mappaData.updateOccupazioneEntry).not.toHaveBeenCalled();
  });

  it('liberaPostazione rimuove l\'occupazione e chiude il foglio', async () => {
    const { mappaData } = setupOccupata();
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'post-occupata' }));
    });
    await act(async () => {
      await result.current.liberaPostazione();
    });

    expect(mappaData.removeOccupazione).toHaveBeenCalledWith('occ-1');
    expect(result.current.sheetMode).toBeNull();
  });
});

describe('PiscinaSheetsContext — "+ Nuovo cliente"', () => {
  it('confirmCreateCliente rifiuta senza nome/telefono', async () => {
    setupMocks();
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openNewClienteSheet();
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });

    expect(result.current.newClienteError).toMatch(/nome e telefono/);
    expect(mockCreateCliente).not.toHaveBeenCalled();
  });

  it('confirmCreateCliente rifiuta un ingresso ridotto prima della soglia pomeridiana', async () => {
    setupMocks({ inventario: buildInventario({ orario_inizio_ridotto: '14:00' }) });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openNewClienteSheet();
    });
    await act(async () => {
      result.current.updateNewClienteForm({
        nome: 'Nuovo Cliente',
        telefono: '3331112222',
        orarioArrivo: '10:00',
        ingressiRidotti: '1',
      });
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });

    expect(result.current.newClienteError).toMatch(/disponibile dalle/);
    expect(mockCreateCliente).not.toHaveBeenCalled();
  });

  it('confirmCreateCliente crea cliente e prenotazione con stato CONFIRMED, e seleziona la prenotazione se ha ombrellone/gazebo', async () => {
    const mappaData = setupMocks();
    const selection = { selectedPrenotazioneId: null as string | null, selectPrenotazioneCandidate: jest.fn() };
    mockUseSelection.mockReturnValue(selection);
    mockCreateCliente.mockResolvedValue({ id: 'cliente-nuovo', nome: 'Nuovo Cliente', telefono: '3331112222' });
    const prenotazioneCreata = buildPrenotazione({ id: 'pren-nuova', ombrellone: 1 });
    mappaData.addPrenotazione = jest.fn().mockResolvedValue(prenotazioneCreata);

    const { result } = await renderSheets();

    await act(async () => {
      result.current.openNewClienteSheet();
    });
    await act(async () => {
      result.current.updateNewClienteForm({
        nome: 'Nuovo Cliente',
        telefono: '3331112222',
        orarioArrivo: '10:00',
        ombrellone: '1',
      });
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });

    expect(mockCreateCliente).toHaveBeenCalledWith({ nome: 'Nuovo Cliente', telefono: '3331112222' });
    expect(mappaData.addPrenotazione).toHaveBeenCalledWith(
      expect.objectContaining({ cliente_id: 'cliente-nuovo', stato: 'CONFIRMED', ombrellone: 1 })
    );
    expect(selection.selectPrenotazioneCandidate).toHaveBeenCalledWith('pren-nuova');
    expect(result.current.isNewClienteSheetOpen).toBe(false);
  });
});

describe('PiscinaSheetsContext — modifica ed conferma prenotazione', () => {
  it('confirmEditPrenotazione rifiuta un ingresso intero dopo la soglia ridotta quando la tariffa ridotta è configurata', async () => {
    setupMocks({ inventario: buildInventario({ orario_inizio_ridotto: '14:00', prezzo_ingresso_ridotto: '3.00' }) });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openEditPrenotazione(buildPrenotazione({ ingressi: 2 }));
    });
    await act(async () => {
      result.current.updateEditForm({ ora: '15:00' });
    });
    await act(async () => {
      await result.current.confirmEditPrenotazione();
    });

    expect(result.current.editError).toMatch(/ridotto pomeridiano/);
  });

  it('confirmEditPrenotazione salva le modifiche e chiude il foglio', async () => {
    const mappaData = setupMocks();
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openEditPrenotazione(buildPrenotazione({ id: 'pren-1' }));
    });
    await act(async () => {
      result.current.updateEditForm({ ora: '11:30', note: 'Nota aggiornata' });
    });
    await act(async () => {
      await result.current.confirmEditPrenotazione();
    });

    expect(mappaData.editPrenotazione).toHaveBeenCalledWith(
      'pren-1',
      expect.objectContaining({ ora: '11:30', note: 'Nota aggiornata' })
    );
    expect(result.current.editingPrenotazione).toBeNull();
  });

  it('confirmPrenotazione non fa nulla se la prenotazione non è PENDING', async () => {
    const mappaData = setupMocks();
    const { result } = await renderSheets();

    await act(async () => {
      await result.current.confirmPrenotazione(buildPrenotazione({ stato: 'CONFIRMED' }));
    });

    expect(mappaData.editPrenotazione).not.toHaveBeenCalled();
  });

  it('confirmPrenotazione conferma una prenotazione PENDING', async () => {
    const mappaData = setupMocks();
    const { result } = await renderSheets();

    await act(async () => {
      await result.current.confirmPrenotazione(buildPrenotazione({ id: 'pren-pending', stato: 'PENDING' }));
    });

    expect(mappaData.editPrenotazione).toHaveBeenCalledWith('pren-pending', { stato: 'CONFIRMED' });
  });
});

describe('PiscinaSheetsContext — sheetAriaLabel', () => {
  it('riflette la modalità corrente del foglio', async () => {
    setupMocks({ postazioni: [buildPostazione({ id: 'p1', numero: 7 })] });
    const { result } = await renderSheets();

    expect(result.current.sheetAriaLabel).toBe('Gestione postazione');

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    expect(result.current.sheetAriaLabel).toBe('Nuova postazione');

    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'p1', numero: 7 }));
    });
    expect(result.current.sheetAriaLabel).toBe('Assegna postazione numero 7');
  });
});
