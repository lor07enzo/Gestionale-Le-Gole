import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PiscinaSheetsProvider, usePiscinaSheets } from '../PiscinaSheetsContext';
import type { PiscinaInventario, Postazione } from '../../services/struttura';
import type { OccupazionePostazione, PrenotazionePiscina } from '../../services/prenotazioni';
import type { ResiduiPrenotazione } from '../../utils/piscinaMappa';

// Mockati direttamente (non i provider reali) per isolare solo la logica di questo context.
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
// Data fissa lontana nel futuro: evita che isSameDay(selectedDate, new Date()) scatti per
// coincidenza, senza dover mockare l'orologio di sistema.
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
    gruppo: null,
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

// Fixture di base: nessuna postazione occupata, una prenotazione con 2 ombrelloni residui.
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
      gruppo: null,
    });
    expect(result.current.sheetMode).toBeNull();
  });
});

describe('PiscinaSheetsContext — creazione in blocco di più gazebo attaccati', () => {
  it('confirmAddPostazione crea N gazebo in sequenza con numeri liberi e una striscia verticale equispaziata', async () => {
    const mappaData = setupMocks({
      postazioni: [buildPostazione({ id: 'p1', numero: 1, tipo: 'OMBRELLONE' })],
    });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    await act(async () => {
      result.current.setNewTipo('GAZEBO');
    });
    await act(async () => {
      result.current.setNewQuantita('3');
    });
    // Il numero 1 è già usato dall'ombrellone: i tre gazebo prendono i successivi liberi.
    expect(result.current.newNumeriPreview).toEqual([2, 3, 4]);
    expect(result.current.newOrientamento).toBe('verticale'); // default all'apertura del foglio

    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(mappaData.addPostazione).toHaveBeenCalledTimes(3);
    expect(mappaData.addPostazione).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ tipo: 'GAZEBO', numero: 2 })
    );
    expect(mappaData.addPostazione).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ tipo: 'GAZEBO', numero: 3 })
    );
    expect(mappaData.addPostazione).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ tipo: 'GAZEBO', numero: 4 })
    );
    // Colonna verticale: stessa pos_x per tutti, pos_y crescente e equispaziata.
    const posizioni = (mappaData.addPostazione as jest.Mock).mock.calls.map(
      ([payload]: [{ pos_x: number; pos_y: number }]) => payload
    );
    expect(posizioni[0].pos_x).toBe(posizioni[1].pos_x);
    expect(posizioni[1].pos_x).toBe(posizioni[2].pos_x);
    expect(posizioni[0].pos_y).toBeLessThan(posizioni[1].pos_y);
    expect(posizioni[1].pos_y).toBeLessThan(posizioni[2].pos_y);
    // I tre gazebo condividono lo stesso `gruppo` (non nullo): si spostano sempre insieme.
    const gruppi = (mappaData.addPostazione as jest.Mock).mock.calls.map(([payload]: [{ gruppo: string | null }]) => payload.gruppo);
    expect(gruppi[0]).toEqual(expect.any(String));
    expect(gruppi[1]).toBe(gruppi[0]);
    expect(gruppi[2]).toBe(gruppi[0]);
    expect(result.current.sheetMode).toBeNull();
  });

  it('un gazebo creato singolarmente (quantità 1) non genera un gruppo', async () => {
    const mappaData = setupMocks({ postazioni: [] });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    await act(async () => {
      result.current.setNewTipo('GAZEBO');
    });
    // Quantità resta '1' (default all'apertura del foglio).

    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(mappaData.addPostazione).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'GAZEBO', gruppo: null })
    );
  });

  it("con ordine 'decrescente' il numero più alto riservato va al primo elemento della striscia", async () => {
    const mappaData = setupMocks({ postazioni: [] });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    await act(async () => {
      result.current.setNewTipo('GAZEBO');
    });
    await act(async () => {
      result.current.setNewQuantita('3');
    });
    await act(async () => {
      result.current.setNewOrdineNumeri('decrescente');
    });
    // L'insieme riservato resta {1,2,3} (i più bassi liberi), solo l'ordine di assegnazione si inverte.
    expect(result.current.newNumeriPreview).toEqual([3, 2, 1]);

    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(mappaData.addPostazione).toHaveBeenNthCalledWith(1, expect.objectContaining({ numero: 3 }));
    expect(mappaData.addPostazione).toHaveBeenNthCalledWith(2, expect.objectContaining({ numero: 2 }));
    expect(mappaData.addPostazione).toHaveBeenNthCalledWith(3, expect.objectContaining({ numero: 1 }));
  });

  it('confirmAddPostazione rifiuta se la quantità richiesta supera i posti gazebo ancora residui', async () => {
    const mappaData = setupMocks({
      inventario: buildInventario({ totale_gazebi: 2 }),
      postazioni: [],
    });
    const { result } = await renderSheets();

    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    await act(async () => {
      result.current.setNewTipo('GAZEBO');
    });
    await act(async () => {
      result.current.setNewQuantita('5'); // il backend/UI ne permetterebbe al massimo 2
    });

    await act(async () => {
      await result.current.confirmAddPostazione();
    });

    expect(result.current.sheetError).toMatch(/al massimo 2 gazebi/);
    expect(mappaData.addPostazione).not.toHaveBeenCalled();
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

describe('PiscinaSheetsContext — rami di errore e guardie', () => {
  const errDrf = (data: object) => ({ response: { data } });

  function setupOccupata(mappaOverrides: MappaDataOverrides = {}) {
    const occ = buildOccupazione({ id: 'occ-1', postazione: 'post-occupata' });
    return setupMocks({ occupazioneByPostazione: new Map([['post-occupata', occ]]), ...mappaOverrides });
  }

  async function apriOccupata() {
    const rendered = await renderSheets();
    await act(async () => {
      rendered.result.current.handleMarkerPress(buildPostazione({ id: 'post-occupata' }));
    });
    return rendered;
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('handlePickCliente precompila il foglio con i residui e chiude il picker', async () => {
    setupMocks();
    const { result } = await renderSheets();
    await act(async () => {
      result.current.setIsClientPickerOpen(true);
      result.current.handlePickCliente(buildPrenotazione());
    });
    expect(result.current.sheetForm).toMatchObject({ clienteNome: 'Mario Rossi', lettini: '2', orarioArrivo: '10:00' });
    expect(result.current.isClientPickerOpen).toBe(false);
  });

  it('handleMarkerPress senza cliente selezionato apre un foglio vuoto', async () => {
    setupMocks({}, null);
    const { result } = await renderSheets();
    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'libera' }));
    });
    expect(result.current.sheetMode).toBe('assign');
    expect(result.current.sheetForm.clienteNome).toBe('');
  });

  it('confirmAssign: giorno passato, orario non valido ed errore del backend', async () => {
    const mappaData = setupMocks({ isPastDate: true });
    const { result, rerender } = await renderSheets();
    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'libera' }));
    });
    await act(async () => {
      await result.current.confirmAssign();
    });
    expect(result.current.sheetError).toMatch(/giorno passato/);

    mockUseMappaData.mockReturnValue({ ...mappaData, isPastDate: false });
    await rerender({});
    await act(async () => {
      result.current.updateSheetForm({ orarioArrivo: 'boh' });
    });
    await act(async () => {
      await result.current.confirmAssign();
    });
    expect(result.current.sheetError).toBe('Orario di arrivo non valido.');

    (mappaData.assignOccupazione as jest.Mock).mockRejectedValue(new Error('409'));
    await act(async () => {
      result.current.updateSheetForm({ orarioArrivo: '10:00', lettini: '0', sdraie: '5' });
    });
    await act(async () => {
      await result.current.confirmAssign();
    });
    expect(result.current.sheetError).toMatch(/Sdraie superiori/);

    await act(async () => {
      result.current.updateSheetForm({ sdraie: '0' });
    });
    await act(async () => {
      await result.current.confirmAssign();
    });
    expect(result.current.sheetError).toBe('Impossibile assegnare la postazione.');
  });

  it('confirmAssign lascia selezionato il cliente se ha ancora unità dello stesso tipo', async () => {
    setupMocks({}, 'pren-1');
    const selection = mockUseSelection();
    const { result } = await renderSheets();
    await act(async () => {
      result.current.handleMarkerPress(buildPostazione({ id: 'libera' }));
    });
    await act(async () => {
      await result.current.confirmAssign();
    });
    // Residuo ombrelloni 2 prima di questa assegnazione: il cliente resta candidato.
    expect(selection.selectPrenotazioneCandidate).not.toHaveBeenCalledWith(null);
  });

  it('confirmOccupantEdit salva le modifiche o segnala errori di validazione e backend', async () => {
    const mappaData = setupOccupata();
    const { result } = await apriOccupata();

    await act(async () => {
      result.current.updateSheetForm({ lettini: '9' });
    });
    await act(async () => {
      await result.current.confirmOccupantEdit();
    });
    expect(result.current.sheetError).toMatch(/Lettini superiori/);

    await act(async () => {
      result.current.updateSheetForm({ lettini: '1', orarioArrivo: '' });
    });
    await act(async () => {
      await result.current.confirmOccupantEdit();
    });
    expect(result.current.sheetError).toMatch(/obbligatorio/);

    (mappaData.updateOccupazioneEntry as jest.Mock).mockRejectedValueOnce(new Error('500'));
    await act(async () => {
      result.current.updateSheetForm({ orarioArrivo: '11:00' });
    });
    await act(async () => {
      await result.current.confirmOccupantEdit();
    });
    expect(result.current.sheetError).toBe('Impossibile salvare le modifiche.');

    await act(async () => {
      await result.current.confirmOccupantEdit();
    });
    expect(mappaData.updateOccupazioneEntry).toHaveBeenLastCalledWith('occ-1', {
      cliente_nome: 'Mario Rossi',
      numero_lettini: 1,
      numero_sdraie: 0,
      orario_arrivo_previsto: '11:00',
    });
    expect(result.current.sheetMode).toBeNull();
  });

  it('su un giorno passato non si modifica né si libera un’occupazione', async () => {
    const mappaData = setupOccupata({ isPastDate: true });
    const { result } = await apriOccupata();

    await act(async () => {
      await result.current.confirmOccupantEdit();
    });
    expect(result.current.sheetError).toMatch(/giorno passato/);
    await act(async () => {
      await result.current.liberaPostazione();
    });
    expect(result.current.sheetError).toMatch(/liberare una postazione di un giorno passato/);
    expect(mappaData.removeOccupazione).not.toHaveBeenCalled();
  });

  it('toggleArrivato e liberaPostazione mostrano l’errore del backend', async () => {
    const mappaData = setupOccupata();
    (mappaData.updateOccupazioneEntry as jest.Mock).mockRejectedValue(new Error('500'));
    (mappaData.removeOccupazione as jest.Mock).mockRejectedValue(new Error('500'));
    const { result } = await apriOccupata();

    await act(async () => {
      await result.current.toggleArrivato();
    });
    expect(result.current.sheetError).toMatch(/stato di arrivo/);
    await act(async () => {
      await result.current.liberaPostazione();
    });
    expect(result.current.sheetError).toBe('Impossibile liberare la postazione.');
  });

  it('handleDeletePostazione chiede conferma, elimina e gestisce il rifiuto del backend', async () => {
    const mappaData = setupMocks();
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleDeletePostazione(buildPostazione({ id: 'p9', numero: 9 }));
    });
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('#9'));
    expect(mappaData.removePostazione).toHaveBeenCalledWith('p9');

    (mappaData.removePostazione as jest.Mock).mockRejectedValue(new Error('occupata'));
    await act(async () => {
      result.current.handleDeletePostazione(buildPostazione({ id: 'p9', numero: 9 }));
    });
    await waitFor(() => expect(result.current.sheetError).toMatch(/Impossibile eliminare/));
  });

  it('handleDeletePostazione è bloccata su un giorno passato', async () => {
    const mappaData = setupMocks({ isPastDate: true });
    const { result } = await renderSheets();
    await act(async () => {
      result.current.handleDeletePostazione(buildPostazione());
    });
    expect(result.current.sheetError).toMatch(/giorno passato/);
    expect(mappaData.removePostazione).not.toHaveBeenCalled();
  });

  it('confirmAddPostazione riporta il messaggio del backend', async () => {
    const mappaData = setupMocks({ postazioni: [] });
    (mappaData.addPostazione as jest.Mock).mockRejectedValue(errDrf({ numero: ['Numero già usato.'] }));
    const { result } = await renderSheets();
    await act(async () => {
      result.current.openAddPostazioneSheet();
    });
    await act(async () => {
      await result.current.confirmAddPostazione();
    });
    expect(result.current.sheetError).toBe('Numero già usato.');
  });

  it('confirmCreateCliente: giorno passato, orario mancante ed errore del backend', async () => {
    const mappaData = setupMocks({ isPastDate: true });
    const { result, rerender } = await renderSheets();
    await act(async () => {
      result.current.openNewClienteSheet();
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });
    expect(result.current.newClienteError).toMatch(/giorno passato/);

    mockUseMappaData.mockReturnValue({ ...mappaData, isPastDate: false });
    await rerender({});
    await act(async () => {
      result.current.updateNewClienteForm({ nome: 'Anna', telefono: '333', orarioArrivo: '' });
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });
    expect(result.current.newClienteError).toMatch(/obbligatorio/);

    mockCreateCliente.mockRejectedValue(errDrf({ telefono: ['Telefono non valido.'] }));
    await act(async () => {
      result.current.updateNewClienteForm({ orarioArrivo: '10:00' });
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });
    expect(result.current.newClienteError).toBe('Telefono non valido.');

    await act(async () => {
      result.current.closeNewClienteSheet();
    });
    expect(result.current.isNewClienteSheetOpen).toBe(false);
    expect(result.current.newClienteError).toBeNull();
  });

  it('confirmCreateCliente rifiuta un ingresso intero dopo la soglia se il ridotto è configurato', async () => {
    setupMocks({ inventario: buildInventario({ orario_inizio_ridotto: '14:00', prezzo_ingresso_ridotto: '3.00' }) });
    const { result } = await renderSheets();
    await act(async () => {
      result.current.openNewClienteSheet();
    });
    await act(async () => {
      result.current.updateNewClienteForm({ nome: 'Anna', telefono: '333', orarioArrivo: '15:00', ingressi: '2' });
    });
    await act(async () => {
      await result.current.confirmCreateCliente();
    });
    expect(result.current.newClienteError).toMatch(/solo l'ingresso ridotto/);
  });

  it('confirmEditPrenotazione: giorno passato, orario vuoto ed errore del backend', async () => {
    const mappaData = setupMocks({ isPastDate: true });
    const { result, rerender } = await renderSheets();
    await act(async () => {
      result.current.openEditPrenotazione(buildPrenotazione());
    });
    await act(async () => {
      await result.current.confirmEditPrenotazione();
    });
    expect(result.current.editError).toMatch(/giorno passato/);

    mockUseMappaData.mockReturnValue({ ...mappaData, isPastDate: false });
    await rerender({});
    await act(async () => {
      result.current.updateEditForm({ ora: ' ' });
    });
    await act(async () => {
      await result.current.confirmEditPrenotazione();
    });
    expect(result.current.editError).toBe('Inserisci un orario valido.');

    (mappaData.editPrenotazione as jest.Mock).mockRejectedValue(errDrf({ ombrellone: ['Esauriti.'] }));
    await act(async () => {
      result.current.updateEditForm({ ora: '10:00', ingressiRidotti: '1' });
    });
    await act(async () => {
      await result.current.confirmEditPrenotazione();
    });
    expect(result.current.editError).toMatch(/disponibile dalle/);

    await act(async () => {
      result.current.updateEditForm({ ingressiRidotti: '0' });
    });
    await act(async () => {
      await result.current.confirmEditPrenotazione();
    });
    expect(result.current.editError).toBe('Esauriti.');

    await act(async () => {
      result.current.closeEditPrenotazione();
    });
    expect(result.current.editingPrenotazione).toBeNull();
  });

  it('confirmPrenotazione avvisa se la conferma fallisce', async () => {
    const mappaData = setupMocks();
    (mappaData.editPrenotazione as jest.Mock).mockRejectedValue(new Error('500'));
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const { result } = await renderSheets();
    await act(async () => {
      await result.current.confirmPrenotazione(buildPrenotazione({ stato: 'PENDING' }));
    });
    expect(alert).toHaveBeenCalledWith('Impossibile confermare la prenotazione.');
    expect(result.current.confirmingPrenotazioneId).toBeNull();
  });

  it('handleCancelPrenotazione annulla dopo conferma e deseleziona il candidato', async () => {
    const mappaData = setupMocks({}, 'pren-1');
    const selection = mockUseSelection();
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = await renderSheets();

    await act(async () => {
      result.current.handleCancelPrenotazione(buildPrenotazione({ id: 'pren-1' }));
    });
    await waitFor(() => expect(mappaData.cancelPrenotazione).toHaveBeenCalledWith('pren-1'));
    await waitFor(() => expect(selection.selectPrenotazioneCandidate).toHaveBeenCalledWith(null));
  });

  it('handleCancelPrenotazione avvisa se il backend fallisce, e non fa nulla nel passato', async () => {
    const mappaData = setupMocks();
    (mappaData.cancelPrenotazione as jest.Mock).mockRejectedValue(new Error('500'));
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const alert = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const { result, rerender } = await renderSheets();

    await act(async () => {
      result.current.handleCancelPrenotazione(buildPrenotazione({ id: 'altra' }));
    });
    await waitFor(() => expect(alert).toHaveBeenCalledWith('Impossibile annullare la prenotazione.'));

    mockUseMappaData.mockReturnValue({ ...mappaData, isPastDate: true });
    await rerender({});
    await act(async () => {
      result.current.handleCancelPrenotazione(buildPrenotazione({ id: 'altra' }));
    });
    expect(mappaData.cancelPrenotazione).toHaveBeenCalledTimes(1);
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
