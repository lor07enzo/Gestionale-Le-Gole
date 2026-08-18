import { act, renderHook, waitFor } from '@testing-library/react-native';
import { StaffNotificationsProvider, useStaffNotifications } from '../StaffNotificationsContext';
import { getNotificheLetteIds, saveNotificheLetteIds } from '../../utils/storage';
import type { PrenotazionePiscina } from '../../services/prenotazioni';

// Mock completo del servizio: evita di eseguire services/api.ts (axios reale).
jest.mock('../../services/prenotazioni', () => ({
  listPrenotazioniRecenti: jest.fn(),
}));

import { listPrenotazioniRecenti } from '../../services/prenotazioni';

const mockListRecenti = listPrenotazioniRecenti as jest.MockedFunction<typeof listPrenotazioniRecenti>;

function buildPrenotazione(overrides: Partial<PrenotazionePiscina> = {}): PrenotazionePiscina {
  return {
    id: 'id-default',
    cliente_id: 'cliente-1',
    cliente_nome: 'Mario Rossi',
    cliente_telefono: '3330000000',
    note: '',
    data: '2026-08-10',
    ora: '10:00:00',
    stato: 'CONFIRMED',
    inventario: 'inv-1',
    inventario_nome: 'Piscina Grande',
    ingressi: 2,
    ingressi_ridotti: 0,
    ingressi_bambini: 0,
    ingressi_gratuiti: 0,
    ombrellone: 1,
    gazebo: 0,
    lettino: 0,
    sdraia: 0,
    creata_da_staff: false,
    created_at: '2026-08-10T09:00:00.000Z',
    updated_at: '2026-08-10T09:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  mockListRecenti.mockReset();
});

describe('StaffNotificationsProvider', () => {
  it('carica le prenotazioni recenti al mount', async () => {
    mockListRecenti.mockResolvedValue([buildPrenotazione({ id: 'a' })]);

    const { result } = await renderHook(() => useStaffNotifications(), {
      wrapper: StaffNotificationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notifiche).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it('imposta un messaggio di errore se il polling fallisce, senza rompere il resto dello stato', async () => {
    mockListRecenti.mockRejectedValue(new Error('network error'));

    const { result } = await renderHook(() => useStaffNotifications(), {
      wrapper: StaffNotificationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toMatch(/Impossibile controllare/);
    expect(result.current.notifiche).toEqual([]);
  });

  it('markAsRead rimuove la notifica dal conteggio non letto e persiste la lettura', async () => {
    mockListRecenti.mockResolvedValue([buildPrenotazione({ id: 'a' })]);

    const { result } = await renderHook(() => useStaffNotifications(), {
      wrapper: StaffNotificationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isRead('a')).toBe(false);

    await act(() => {
      result.current.markAsRead('a');
    });

    await waitFor(() => expect(result.current.isRead('a')).toBe(true));
    expect(result.current.unreadCount).toBe(0);

    await waitFor(async () => {
      expect(await getNotificheLetteIds()).toEqual(['a']);
    });
  });

  it('ripristina al mount lo stato letto già presente in storage (da una sessione precedente)', async () => {
    await saveNotificheLetteIds(['a']);
    mockListRecenti.mockResolvedValue([buildPrenotazione({ id: 'a' }), buildPrenotazione({ id: 'b' })]);

    const { result } = await renderHook(() => useStaffNotifications(), {
      wrapper: StaffNotificationsProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isRead('a')).toBe(true);
    expect(result.current.isRead('b')).toBe(false);
    expect(result.current.unreadCount).toBe(1);
  });

  // Regressione: markAsRead scriveva la copia in memoria della propria scheda, cancellando la
  // lettura salvata dall'altra. Due provider indipendenti condividono lo stesso localStorage.
  it('due schede che marcano letture diverse in sequenza non si cancellano a vicenda', async () => {
    mockListRecenti.mockResolvedValue([buildPrenotazione({ id: 'a' }), buildPrenotazione({ id: 'b' })]);

    const tabA = await renderHook(() => useStaffNotifications(), { wrapper: StaffNotificationsProvider });
    const tabB = await renderHook(() => useStaffNotifications(), { wrapper: StaffNotificationsProvider });

    await waitFor(() => expect(tabA.result.current.isLoading).toBe(false));
    await waitFor(() => expect(tabB.result.current.isLoading).toBe(false));

    // La scheda A marca "a" come letta e la scrittura su storage si completa...
    await act(() => {
      tabA.result.current.markAsRead('a');
    });
    await waitFor(async () => {
      expect(await getNotificheLetteIds()).toContain('a');
    });

    // ...prima che la scheda B, ignara della lettura di A, marchi "b".
    await act(() => {
      tabB.result.current.markAsRead('b');
    });
    await waitFor(async () => {
      expect(await getNotificheLetteIds()).toContain('b');
    });

    // Con il bug originale la seconda scrittura avrebbe cancellato la prima (storage = ['b']).
    const stored = await getNotificheLetteIds();
    expect(stored.slice().sort()).toEqual(['a', 'b']);
  });

  it('markAsRead è idempotente su un id già letto (nessuna scrittura duplicata in storage)', async () => {
    mockListRecenti.mockResolvedValue([buildPrenotazione({ id: 'a' })]);

    const { result } = await renderHook(() => useStaffNotifications(), {
      wrapper: StaffNotificationsProvider,
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => {
      result.current.markAsRead('a');
    });
    await waitFor(() => expect(result.current.isRead('a')).toBe(true));

    await act(() => {
      result.current.markAsRead('a');
    });

    await waitFor(async () => {
      expect(await getNotificheLetteIds()).toEqual(['a']);
    });
  });
});
