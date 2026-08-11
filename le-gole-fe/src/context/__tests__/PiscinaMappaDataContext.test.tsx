import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { PiscinaMappaDataProvider, usePiscinaMappaData } from '../PiscinaMappaDataContext';
import type { PiscinaInventario, Postazione } from '../../services/struttura';
import type { GiornoPienoPiscina, OccupazionePostazione, PrenotazionePiscina } from '../../services/prenotazioni';

// Mock completo di entrambi i servizi consumati dal context: evita di eseguire services/api.ts
// (istanza axios reale) per test che riguardano solo la logica di derivazione dei dati, stesso
// principio già usato in StaffNotificationsContext.test.tsx.
jest.mock('../../services/struttura', () => ({
  getPiscinaInventario: jest.fn(),
  listPostazioni: jest.fn(),
  createPostazione: jest.fn(),
  updatePostazione: jest.fn(),
  deletePostazione: jest.fn(),
}));

jest.mock('../../services/prenotazioni', () => ({
  listPrenotazioniPiscina: jest.fn(),
  listOccupazioni: jest.fn(),
  listGiorniPieni: jest.fn(),
  createOccupazione: jest.fn(),
  updateOccupazione: jest.fn(),
  deleteOccupazione: jest.fn(),
  createPrenotazionePiscina: jest.fn(),
  updatePrenotazionePiscina: jest.fn(),
  marcaGiornoPieno: jest.fn(),
  rimuoviGiornoPieno: jest.fn(),
}));

import {
  createPostazione,
  deletePostazione,
  getPiscinaInventario,
  listPostazioni,
  updatePostazione,
} from '../../services/struttura';
import {
  createOccupazione,
  createPrenotazionePiscina,
  deleteOccupazione,
  listGiorniPieni,
  listOccupazioni,
  listPrenotazioniPiscina,
  marcaGiornoPieno,
  rimuoviGiornoPieno,
  updateOccupazione,
  updatePrenotazionePiscina,
} from '../../services/prenotazioni';

const mockGetInventario = getPiscinaInventario as jest.MockedFunction<typeof getPiscinaInventario>;
const mockListPostazioni = listPostazioni as jest.MockedFunction<typeof listPostazioni>;
const mockCreatePostazione = createPostazione as jest.MockedFunction<typeof createPostazione>;
const mockUpdatePostazione = updatePostazione as jest.MockedFunction<typeof updatePostazione>;
const mockDeletePostazione = deletePostazione as jest.MockedFunction<typeof deletePostazione>;

const mockListPrenotazioni = listPrenotazioniPiscina as jest.MockedFunction<typeof listPrenotazioniPiscina>;
const mockListOccupazioni = listOccupazioni as jest.MockedFunction<typeof listOccupazioni>;
const mockListGiorniPieni = listGiorniPieni as jest.MockedFunction<typeof listGiorniPieni>;
const mockCreateOccupazione = createOccupazione as jest.MockedFunction<typeof createOccupazione>;
const mockUpdateOccupazione = updateOccupazione as jest.MockedFunction<typeof updateOccupazione>;
const mockDeleteOccupazione = deleteOccupazione as jest.MockedFunction<typeof deleteOccupazione>;
const mockCreatePrenotazione = createPrenotazionePiscina as jest.MockedFunction<typeof createPrenotazionePiscina>;
const mockUpdatePrenotazione = updatePrenotazionePiscina as jest.MockedFunction<typeof updatePrenotazionePiscina>;
const mockMarcaGiornoPieno = marcaGiornoPieno as jest.MockedFunction<typeof marcaGiornoPieno>;
const mockRimuoviGiornoPieno = rimuoviGiornoPieno as jest.MockedFunction<typeof rimuoviGiornoPieno>;

const INVENTARIO_ID = 'inv-1';

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
    id: 'post-default',
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
    id: 'pren-default',
    cliente_id: 'cliente-default',
    cliente_nome: 'Cliente Default',
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
    ombrellone: 0,
    gazebo: 0,
    lettino: 0,
    sdraia: 0,
    creata_da_staff: true,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T09:00:00.000Z',
    ...overrides,
  };
}

function buildOccupazione(overrides: Partial<OccupazionePostazione> = {}): OccupazionePostazione {
  return {
    id: 'occ-default',
    postazione: 'post-default',
    data: '2026-08-10',
    prenotazione: null,
    cliente_nome: 'Cliente Default',
    numero_lettini: 0,
    numero_sdraie: 0,
    orario_arrivo_previsto: '10:00',
    arrivato: false,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T09:00:00.000Z',
    ...overrides,
  };
}

function buildGiornoPieno(overrides: Partial<GiornoPienoPiscina> = {}): GiornoPienoPiscina {
  return {
    id: 'giorno-pieno-1',
    inventario: INVENTARIO_ID,
    data: '2026-08-10',
    note: '',
    created_at: '2026-08-10T09:00:00.000Z',
    ...overrides,
  };
}

// Niente jest.useFakeTimers() qui: la combinazione fake timers + waitFor() di
// @testing-library/react-native causa act() sovrapposti e il test resta appeso (il polling
// interno di waitFor si basa su timer reali). Per un giorno "passato" deterministico basta una
// data fissa nel passato remoto; per "oggi" si calcola la data odierna reale a runtime.
const IERI_LONTANO = '2020-01-01';
const oggiISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

function mockRispostaVuota() {
  mockGetInventario.mockResolvedValue(buildInventario());
  mockListPostazioni.mockResolvedValue([]);
  mockListPrenotazioni.mockResolvedValue([]);
  mockListOccupazioni.mockResolvedValue([]);
  mockListGiorniPieni.mockResolvedValue([]);
}

function renderMappaData(initialDate?: string) {
  return renderHook(() => usePiscinaMappaData(), {
    wrapper: ({ children }) => (
      <PiscinaMappaDataProvider inventarioId={INVENTARIO_ID} initialDate={initialDate}>
        {children}
      </PiscinaMappaDataProvider>
    ),
  });
}

beforeEach(() => {
  jest.resetAllMocks();
});

describe('PiscinaMappaDataProvider — caricamento e derivazione dati', () => {
  it('carica inventario/postazioni/prenotazioni/occupazioni/giorno pieno al mount', async () => {
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([buildPostazione({ id: 'p1' })]);
    mockListPrenotazioni.mockResolvedValue([buildPrenotazione({ id: 'pren-1' })]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([buildGiornoPieno()]);

    const { result } = await renderMappaData(oggiISO());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.inventario?.id).toBe(INVENTARIO_ID);
    expect(result.current.postazioni).toHaveLength(1);
    expect(result.current.prenotazioni).toHaveLength(1);
    expect(result.current.giornoPieno?.id).toBe('giorno-pieno-1');
    expect(result.current.error).toBeNull();
  });

  it('esclude dalla lista attiva le prenotazioni CANCELLED e di altri inventari', async () => {
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([]);
    mockListPrenotazioni.mockResolvedValue([
      buildPrenotazione({ id: 'attiva', stato: 'CONFIRMED', inventario: INVENTARIO_ID }),
      buildPrenotazione({ id: 'cancellata', stato: 'CANCELLED', inventario: INVENTARIO_ID }),
      buildPrenotazione({ id: 'altra-piscina', stato: 'CONFIRMED', inventario: 'inv-altro' }),
    ]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);

    const { result } = await renderMappaData(oggiISO());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.prenotazioni.map((p) => p.id)).toEqual(['attiva']);
  });

  it('imposta un messaggio di errore se il caricamento fallisce', async () => {
    mockGetInventario.mockRejectedValue(new Error('network error'));
    mockListPostazioni.mockResolvedValue([]);
    mockListPrenotazioni.mockResolvedValue([]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);

    const { result } = await renderMappaData(oggiISO());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Impossibile caricare la mappa della piscina.');
  });

  it('isPastDate è true solo per un giorno precedente a oggi', async () => {
    mockRispostaVuota();

    const passato = await renderMappaData(IERI_LONTANO);
    await waitFor(() => expect(passato.result.current.isLoading).toBe(false));
    expect(passato.result.current.isPastDate).toBe(true);

    const oggi = await renderMappaData(oggiISO());
    await waitFor(() => expect(oggi.result.current.isLoading).toBe(false));
    expect(oggi.result.current.isPastDate).toBe(false);
  });

  it('remainingByPrenotazione sottrae dai totali prenotati le unità già occupate, per tipo', async () => {
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([
      buildPostazione({ id: 'omb-1', tipo: 'OMBRELLONE', numero: 1 }),
      buildPostazione({ id: 'omb-2', tipo: 'OMBRELLONE', numero: 2 }),
    ]);
    mockListPrenotazioni.mockResolvedValue([
      buildPrenotazione({ id: 'pren-1', ombrellone: 2, lettino: 2 }),
    ]);
    mockListOccupazioni.mockResolvedValue([
      buildOccupazione({ id: 'occ-1', postazione: 'omb-1', prenotazione: 'pren-1', numero_lettini: 1 }),
    ]);
    mockListGiorniPieni.mockResolvedValue([]);

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const residui = result.current.remainingByPrenotazione.get('pren-1');
    expect(residui).toEqual({ ombrellone: 1, gazebo: 0, lettino: 1, sdraia: 0 });
  });

  it('daAssegnare/soloIngresso/clientiDelGiorno classificano correttamente prenotazioni miste', async () => {
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([
      buildPostazione({ id: 'omb-1', tipo: 'OMBRELLONE', numero: 1 }),
      buildPostazione({ id: 'omb-2', tipo: 'OMBRELLONE', numero: 2 }),
    ]);
    mockListPrenotazioni.mockResolvedValue([
      // Parzialmente assegnata: 2 ombrelloni prenotati, solo 1 occupazione collegata.
      buildPrenotazione({ id: 'pren-parziale', cliente_nome: 'Parziale', ombrellone: 2, ora: '12:00:00' }),
      // Solo ingresso: nessun ombrellone/gazebo, mai "da assegnare".
      buildPrenotazione({ id: 'pren-solo-ingresso', cliente_nome: 'SoloIngresso', ombrellone: 0, gazebo: 0, ora: '09:00:00' }),
      // Completamente assegnata: 1 ombrellone prenotato, 1 occupazione collegata.
      buildPrenotazione({ id: 'pren-completa', cliente_nome: 'Completa', ombrellone: 1, ora: '11:00:00' }),
    ]);
    mockListOccupazioni.mockResolvedValue([
      buildOccupazione({
        id: 'occ-parziale',
        postazione: 'omb-1',
        prenotazione: 'pren-parziale',
        orario_arrivo_previsto: '12:30',
      }),
      buildOccupazione({
        id: 'occ-completa',
        postazione: 'omb-2',
        prenotazione: 'pren-completa',
        orario_arrivo_previsto: '08:45',
      }),
    ]);
    mockListGiorniPieni.mockResolvedValue([]);

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.daAssegnare.map((p) => p.id)).toEqual(['pren-parziale']);
    expect(result.current.soloIngresso.map((p) => p.id)).toEqual(['pren-solo-ingresso']);

    // Ordine atteso: non-completo per primo (pren-parziale), poi i completi per orarioEffettivo
    // crescente — pren-completa eredita l'orario della sua occupazione (08:45, non 11:00 della
    // prenotazione originale), pren-solo-ingresso non ha occupazioni quindi usa Prenotazione.ora.
    expect(result.current.clientiDelGiorno.map((e) => e.prenotazione.id)).toEqual([
      'pren-parziale',
      'pren-completa',
      'pren-solo-ingresso',
    ]);
    const completa = result.current.clientiDelGiorno.find((e) => e.prenotazione.id === 'pren-completa');
    expect(completa?.orarioEffettivo).toBe('08:45');
    expect(completa?.completo).toBe(true);
    const parziale = result.current.clientiDelGiorno.find((e) => e.prenotazione.id === 'pren-parziale');
    expect(parziale?.completo).toBe(false);
  });

  it('disponibilita calcola i residui sottraendo dal totale inventario le risorse prenotate', async () => {
    mockGetInventario.mockResolvedValue(buildInventario({ totale_ombrelloni: 5, totale_gazebi: 3 }));
    mockListPostazioni.mockResolvedValue([]);
    mockListPrenotazioni.mockResolvedValue([
      buildPrenotazione({ id: 'p1', ombrellone: 2, gazebo: 1 }),
      buildPrenotazione({ id: 'p2', ombrellone: 1, gazebo: 0 }),
    ]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const ombrellone = result.current.disponibilita?.find((d) => d.key === 'ombrellone');
    const gazebo = result.current.disponibilita?.find((d) => d.key === 'gazebo');
    expect(ombrellone).toMatchObject({ totale: 5, residui: 2 });
    expect(gazebo).toMatchObject({ totale: 3, residui: 2 });
  });

  // renderHook() di @testing-library/react-native passa initialProps/rerender(props) solo alla
  // callback dell'hook, MAI al componente `wrapper` (che riceve sempre e solo `children`) — un
  // secondo argomento di rerender() non arriverebbe mai a PiscinaMappaDataProvider. Per simulare
  // "il query param ?data= cambia mentre la pagina resta montata" (due notifiche diverse aperte in
  // sequenza dal pannello, sezione 11 CLAUDE.md) il wrapper legge quindi initialDate da una
  // variabile esterna mutabile: forzare un rerender rilegge quella variabile alla chiamata
  // successiva, esattamente come farebbe un vero cambio di query param via Expo Router.
  it('risincronizza selectedDate quando initialDate cambia a provider già montato (due notifiche in sequenza)', async () => {
    mockRispostaVuota();
    let initialDateCorrente = IERI_LONTANO;

    const { result, rerender } = await renderHook(() => usePiscinaMappaData(), {
      wrapper: ({ children }: Readonly<{ children: ReactNode }>) => (
        <PiscinaMappaDataProvider inventarioId={INVENTARIO_ID} initialDate={initialDateCorrente}>
          {children}
        </PiscinaMappaDataProvider>
      ),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPastDate).toBe(true);

    initialDateCorrente = oggiISO();
    await act(async () => {
      rerender(undefined);
    });

    await waitFor(() => expect(result.current.isPastDate).toBe(false));
  });
});

describe('PiscinaMappaDataProvider — mutazioni', () => {
  it('addPostazione invia l\'inventarioId corrente e aggiunge la postazione creata allo stato', async () => {
    mockRispostaVuota();
    const nuova = buildPostazione({ id: 'nuova', numero: 4 });
    mockCreatePostazione.mockResolvedValue(nuova);

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addPostazione({ tipo: 'OMBRELLONE', numero: 4, pos_x: 10, pos_y: 10 });
    });

    expect(mockCreatePostazione).toHaveBeenCalledWith({
      tipo: 'OMBRELLONE',
      numero: 4,
      pos_x: 10,
      pos_y: 10,
      inventario: INVENTARIO_ID,
    });
    expect(result.current.postazioni.map((p) => p.id)).toEqual(['nuova']);
  });

  it('removePostazione toglie la postazione dallo stato dopo la DELETE', async () => {
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([buildPostazione({ id: 'da-rimuovere' })]);
    mockListPrenotazioni.mockResolvedValue([]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);
    mockDeletePostazione.mockResolvedValue(undefined);

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.postazioni).toHaveLength(1);

    await act(async () => {
      await result.current.removePostazione('da-rimuovere');
    });

    expect(result.current.postazioni).toHaveLength(0);
  });

  it('cancelPrenotazione rimuove sia la prenotazione sia le occupazioni collegate dallo stato locale', async () => {
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([buildPostazione({ id: 'omb-1' })]);
    mockListPrenotazioni.mockResolvedValue([buildPrenotazione({ id: 'pren-1', ombrellone: 1 })]);
    mockListOccupazioni.mockResolvedValue([
      buildOccupazione({ id: 'occ-1', postazione: 'omb-1', prenotazione: 'pren-1' }),
    ]);
    mockListGiorniPieni.mockResolvedValue([]);
    mockUpdatePrenotazione.mockResolvedValue(buildPrenotazione({ id: 'pren-1', stato: 'CANCELLED' }));

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.prenotazioni).toHaveLength(1);
    expect(result.current.occupazioni).toHaveLength(1);

    await act(async () => {
      await result.current.cancelPrenotazione('pren-1');
    });

    expect(mockUpdatePrenotazione).toHaveBeenCalledWith('pren-1', { stato: 'CANCELLED' });
    expect(result.current.prenotazioni).toHaveLength(0);
    expect(result.current.occupazioni).toHaveLength(0);
  });

  it('toggleGiornoPieno marca il giorno quando non è ancora segnato, e lo rimuove quando lo è', async () => {
    mockRispostaVuota();
    const creato = buildGiornoPieno({ id: 'nuovo-giorno-pieno' });
    mockMarcaGiornoPieno.mockResolvedValue(creato);
    mockRimuoviGiornoPieno.mockResolvedValue(undefined);

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.giornoPieno).toBeNull();

    await act(async () => {
      await result.current.toggleGiornoPieno();
    });
    expect(mockMarcaGiornoPieno).toHaveBeenCalledWith({ inventario: INVENTARIO_ID, data: oggiISO() });
    expect(result.current.giornoPieno?.id).toBe('nuovo-giorno-pieno');

    await act(async () => {
      await result.current.toggleGiornoPieno();
    });
    expect(mockRimuoviGiornoPieno).toHaveBeenCalledWith('nuovo-giorno-pieno');
    expect(result.current.giornoPieno).toBeNull();
  });

  it('dragPostazione sposta la postazione (pos_x cresce di (dx / CANVAS_WIDTH) * 100) quando il salvataggio riesce', async () => {
    const originale = buildPostazione({ id: 'p1', pos_x: 50, pos_y: 50 });
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([originale]);
    mockListPrenotazioni.mockResolvedValue([]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);
    mockUpdatePostazione.mockResolvedValue({ ...originale, pos_x: 60 });

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.dragPostazione(originale, 100, 0);
    });

    await waitFor(() => expect(result.current.postazioni[0].pos_x).toBeCloseTo(60));
    expect(mockUpdatePostazione).toHaveBeenCalledWith('p1', { pos_x: 60, pos_y: 50 });
  });

  // Non verifichiamo lo stato ottimistico intermedio (pos_x=60 subito dopo la chiamata, prima del
  // rollback): con updatePostazione mockato per rifiutare immediatamente, il flush di act()
  // può già includere anche il .catch() di rollback, rendendo quello stato intermedio non
  // osservabile in modo affidabile — verifichiamo solo l'esito finale atteso.
  it('dragPostazione ripristina la posizione originale se il salvataggio fallisce', async () => {
    const originale = buildPostazione({ id: 'p1', pos_x: 50, pos_y: 50 });
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([originale]);
    mockListPrenotazioni.mockResolvedValue([]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);
    mockUpdatePostazione.mockRejectedValue(new Error('conflitto'));

    const { result } = await renderMappaData(oggiISO());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.dragPostazione(originale, 100, 0);
    });

    await waitFor(() => expect(result.current.postazioni[0].pos_x).toBe(50));
  });

  it('dragPostazione non fa nulla su un giorno passato (backstop difensivo)', async () => {
    const originale = buildPostazione({ id: 'p1', pos_x: 50, pos_y: 50 });
    mockGetInventario.mockResolvedValue(buildInventario());
    mockListPostazioni.mockResolvedValue([originale]);
    mockListPrenotazioni.mockResolvedValue([]);
    mockListOccupazioni.mockResolvedValue([]);
    mockListGiorniPieni.mockResolvedValue([]);

    const { result } = await renderMappaData(IERI_LONTANO); // giorno passato rispetto a OGGI
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPastDate).toBe(true);

    await act(() => {
      result.current.dragPostazione(originale, 100, 0);
    });

    expect(result.current.postazioni[0].pos_x).toBe(50);
    expect(mockUpdatePostazione).not.toHaveBeenCalled();
  });
});
