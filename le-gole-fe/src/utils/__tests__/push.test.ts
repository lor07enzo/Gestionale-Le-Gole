import { percorsoDaNotifica } from '../push';

/**
 * Solo `percorsoDaNotifica` è coperta: è l'unico pezzo di src/utils/push.ts con una logica che può
 * sbagliarsi in silenzio (una destinazione errata manda lo staff sulla schermata sbagliata senza
 * alcun errore). Il resto del modulo è I/O verso expo-notifications e il backend, che un test
 * unitario potrebbe solo rimpiazzare con un mock di se stesso.
 */
describe('percorsoDaNotifica', () => {
  it('porta alla mappa piscina del giorno prenotato', () => {
    expect(
      percorsoDaNotifica({
        categoria: 'PISCINA',
        prenotazioneId: 'p1',
        inventarioId: 'inv1',
        data: '2026-09-20',
      })
    ).toBe('/staff/piscina/inv1?data=2026-09-20');
  });

  it('porta al dettaglio ordine per l asporto', () => {
    expect(percorsoDaNotifica({ categoria: 'ASPORTO', prenotazioneId: 'o1' })).toBe(
      '/staff/asporto/ordini/o1'
    );
  });

  it('porta al dettaglio partita per il padel', () => {
    expect(percorsoDaNotifica({ categoria: 'PADEL', prenotazioneId: 'g1' })).toBe(
      '/staff/padel/prenotazioni/g1'
    );
  });

  it('non naviga se la piscina non porta inventario e data', () => {
    // La mappa staff è per (inventario, giorno): senza entrambi non saprebbe cosa mostrare.
    expect(percorsoDaNotifica({ categoria: 'PISCINA', prenotazioneId: 'p1' })).toBeNull();
    expect(
      percorsoDaNotifica({ categoria: 'PISCINA', prenotazioneId: 'p1', inventarioId: 'inv1' })
    ).toBeNull();
  });

  it('non naviga senza id prenotazione, categoria sconosciuta o dati assenti', () => {
    expect(percorsoDaNotifica({ categoria: 'ASPORTO' })).toBeNull();
    expect(percorsoDaNotifica({ categoria: 'SALA', prenotazioneId: 'x' })).toBeNull();
    expect(percorsoDaNotifica(undefined)).toBeNull();
    expect(percorsoDaNotifica(null)).toBeNull();
  });
});
