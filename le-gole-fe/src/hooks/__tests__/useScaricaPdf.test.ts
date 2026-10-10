import { act, renderHook } from '@testing-library/react-native';
import { useScaricaPdf } from '../useScaricaPdf';

jest.mock('../../utils/biglietto', () => ({ apriBigliettoPdf: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { apriBigliettoPdf } = require('../../utils/biglietto') as { apriBigliettoPdf: jest.Mock };

beforeEach(() => {
  apriBigliettoPdf.mockReset();
});

describe('useScaricaPdf', () => {
  it('scarica il PDF e torna a riposo senza errori', async () => {
    apriBigliettoPdf.mockResolvedValue(undefined);
    const { result } = await renderHook(() => useScaricaPdf('Errore!'));

    await act(async () => {
      await result.current.scarica('https://api/x.pdf', 'p1', 'ricevuta');
    });

    expect(apriBigliettoPdf).toHaveBeenCalledWith('https://api/x.pdf', 'p1', 'ricevuta');
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('mostra il messaggio d’errore se il download fallisce, e lo azzera al tentativo successivo', async () => {
    apriBigliettoPdf.mockRejectedValueOnce(new Error('rete')).mockResolvedValueOnce(undefined);
    const { result } = await renderHook(() => useScaricaPdf('Impossibile scaricare.'));

    await act(async () => {
      await result.current.scarica('u', 'p1');
    });
    expect(result.current.error).toBe('Impossibile scaricare.');
    expect(result.current.isDownloading).toBe(false);

    await act(async () => {
      await result.current.scarica('u', 'p1');
    });
    expect(result.current.error).toBeNull();
  });

  it('usa un messaggio generico se non ne viene passato uno', async () => {
    apriBigliettoPdf.mockRejectedValue(new Error('rete'));
    const { result } = await renderHook(() => useScaricaPdf());

    await act(async () => {
      await result.current.scarica('u', 'p1');
    });
    expect(result.current.error).toBe('Impossibile scaricare il documento. Riprova.');
  });
});
