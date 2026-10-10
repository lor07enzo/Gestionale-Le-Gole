import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StaffManagementProvider, useStaffManagement } from '../StaffManagementContext';
import { PiscinaSelectionProvider, usePiscinaSelection } from '../PiscinaSelectionContext';
import { CarrelloAsportoProvider, useCarrelloAsporto } from '../CarrelloAsportoContext';

jest.mock('../../services/staff', () => ({
  listStaff: jest.fn(),
  createStaff: jest.fn(),
  updateStaff: jest.fn(),
  deleteStaff: jest.fn(),
  setStaffActive: jest.fn(),
}));
jest.mock('../../services/menu', () => ({
  listCategorie: jest.fn(),
  listAllergeni: jest.fn(),
  listProdotti: jest.fn(),
  getConfigurazioneAsporto: jest.fn(),
  getProssimeChiusureAsporto: jest.fn(),
}));
jest.mock('../../services/prenotazioni', () => ({ getPrenotazioniPerOrario: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const staffService = require('../../services/staff');
const menu = require('../../services/menu');
const prenotazioni = require('../../services/prenotazioni');
/* eslint-enable @typescript-eslint/no-require-imports */

beforeEach(() => {
  jest.clearAllMocks();
});

function silenziaErrori() {
  jest.spyOn(console, 'error').mockImplementation(() => {});
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('StaffManagementContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <StaffManagementProvider>{children}</StaffManagementProvider>;
  const MARIO = { id: 's1', username: 'mario', email: 'm@x.it', is_superuser: false, is_active: true };

  it('carica lo staff e mantiene lo stato locale allineato dopo ogni azione', async () => {
    staffService.listStaff.mockResolvedValue([MARIO]);
    staffService.createStaff.mockResolvedValue({ ...MARIO, id: 's2', username: 'luigi' });
    staffService.updateStaff.mockResolvedValue({ ...MARIO, email: 'nuova@x.it' });
    staffService.setStaffActive.mockResolvedValue({ ...MARIO, email: 'nuova@x.it', is_active: false });
    staffService.deleteStaff.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useStaffManagement(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.staff).toEqual([MARIO]);

    await act(async () => {
      await result.current.addStaff({ username: 'luigi', email: 'l@x.it' });
    });
    expect(result.current.staff.map((s) => s.username)).toEqual(['mario', 'luigi']);

    await act(async () => {
      await result.current.editStaff('s1', { username: 'mario', email: 'nuova@x.it' });
      await result.current.toggleStaffActive('s1', false);
    });
    expect(result.current.staff[0]).toMatchObject({ email: 'nuova@x.it', is_active: false });

    await act(async () => {
      await result.current.removeStaff('s2');
    });
    expect(result.current.staff.map((s) => s.id)).toEqual(['s1']);
  });

  it('mostra un errore se il caricamento fallisce', async () => {
    staffService.listStaff.mockRejectedValue(new Error('403'));
    const { result } = await renderHook(() => useStaffManagement(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/Impossibile caricare/);
  });

  it('fuori dal provider lancia un errore esplicito', async () => {
    silenziaErrori();
    await expect(renderHook(() => useStaffManagement())).rejects.toThrow('StaffManagementProvider');
  });
});

describe('PiscinaSelectionContext', () => {
  it('seleziona e deseleziona una prenotazione candidata', async () => {
    const wrapper = ({ children }: { children: ReactNode }) => <PiscinaSelectionProvider>{children}</PiscinaSelectionProvider>;
    const { result } = await renderHook(() => usePiscinaSelection(), { wrapper });
    expect(result.current.selectedPrenotazioneId).toBeNull();

    await act(async () => {
      result.current.selectPrenotazioneCandidate('p1');
    });
    expect(result.current.selectedPrenotazioneId).toBe('p1');

    await act(async () => {
      result.current.selectPrenotazioneCandidate(null);
    });
    expect(result.current.selectedPrenotazioneId).toBeNull();
  });

  it('fuori dal provider lancia un errore esplicito', async () => {
    silenziaErrori();
    await expect(renderHook(() => usePiscinaSelection())).rejects.toThrow('PiscinaSelectionProvider');
  });
});

describe('CarrelloAsportoContext', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <CarrelloAsportoProvider>{children}</CarrelloAsportoProvider>;
  const prodotto = (id: string, prezzo: string, disponibile = true) => ({ id, nome: id, prezzo, disponibile });

  function catalogo() {
    menu.listCategorie.mockResolvedValue([{ id: 'c1', nome: 'Pizze' }]);
    menu.listAllergeni.mockResolvedValue([{ id: 'a1', nome: 'Glutine', icona: '🌾' }]);
    menu.listProdotti.mockResolvedValue([prodotto('margherita', '6.50'), prodotto('diavola', '7.00'), prodotto('nascosta', '5.00', false)]);
    menu.getConfigurazioneAsporto.mockResolvedValue({ attivo: true });
    menu.getProssimeChiusureAsporto.mockResolvedValue(['2026-12-25']);
    prenotazioni.getPrenotazioniPerOrario.mockResolvedValue({ '12:00': 1 });
  }

  it('carica il catalogo e calcola carrello, totali e prodotti disponibili', async () => {
    catalogo();
    const { result } = await renderHook(() => useCarrelloAsporto(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.prodottiDisponibili.map((p) => p.id)).toEqual(['margherita', 'diavola']);
    expect(result.current.allergeneById.get('a1')?.nome).toBe('Glutine');
    expect(result.current.chiusureFuture).toEqual(['2026-12-25']);
    expect(result.current.prenotazioniPerOrario).toEqual({ '12:00': 1 });

    await act(async () => {
      result.current.setQuantita('margherita', 2);
      result.current.setQuantita('diavola', 1);
      // Un prodotto nascosto dallo staff non entra mai nel carrello.
      result.current.setQuantita('nascosta', 3);
    });
    expect(result.current.cartLines).toHaveLength(2);
    expect(result.current.totaleArticoli).toBe(3);
    expect(result.current.totalePrezzo).toBe(20);

    await act(async () => {
      result.current.setQuantita('diavola', -1);
    });
    expect(result.current.quantities).toEqual({ margherita: 2, nascosta: 3 });

    await act(async () => {
      result.current.svuotaCarrello();
    });
    expect(result.current.cartLines).toEqual([]);
  });

  it('mostra un errore se il catalogo non si carica', async () => {
    catalogo();
    menu.listProdotti.mockRejectedValue(new Error('rete'));
    const { result } = await renderHook(() => useCarrelloAsporto(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.loadError).toMatch(/Impossibile caricare il menu/);
  });

  it('fuori dal provider lancia un errore esplicito', async () => {
    silenziaErrori();
    await expect(renderHook(() => useCarrelloAsporto())).rejects.toThrow('CarrelloAsportoProvider');
  });
});
