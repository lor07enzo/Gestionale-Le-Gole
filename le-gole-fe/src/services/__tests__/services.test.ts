import * as clienti from '../clienti';
import * as menu from '../menu';
import * as padel from '../padel';
import * as prenotazioni from '../prenotazioni';
import * as servizi from '../servizi';
import * as staff from '../staff';
import * as struttura from '../struttura';

// I service sono un binding 1:1 con le rotte DRF: qui si verifica che ogni funzione colpisca il
// metodo e il path giusti e restituisca `response.data`. Un path sbagliato (es. trattino al posto
// dell'underscore in un'@action) è un bug reale già capitato, invisibile ai test backend.

jest.mock('../api', () => {
  const mockApi = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  };
  return { __esModule: true, default: mockApi, API_BASE_URL: 'https://api.test/api' };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const api = require('../api').default as Record<'get' | 'post' | 'patch' | 'put' | 'delete', jest.Mock>;

type Metodo = 'get' | 'post' | 'patch' | 'put' | 'delete';
type Caso = [nome: string, chiamata: () => Promise<unknown>, metodo: Metodo, path: string];

const P = {} as never;

const CASI: Caso[] = [
  ['createCliente', () => clienti.createCliente(P), 'post', '/v1/users/clienti/'],
  ['searchClienti', () => clienti.searchClienti('mar'), 'get', '/v1/users/clienti/'],
  ['getCliente', () => clienti.getCliente('c1'), 'get', '/v1/users/clienti/c1/'],

  ['getConfigurazioneAsporto', () => menu.getConfigurazioneAsporto(), 'get', '/v1/menu/configurazione-asporto/'],
  ['updateConfigurazioneAsporto', () => menu.updateConfigurazioneAsporto(P), 'patch', '/v1/menu/configurazione-asporto/'],
  ['listCategorie', () => menu.listCategorie(), 'get', '/v1/menu/categorie/'],
  ['createCategoria', () => menu.createCategoria(P), 'post', '/v1/menu/categorie/'],
  ['deleteCategoria', () => menu.deleteCategoria('k1'), 'delete', '/v1/menu/categorie/k1/'],
  ['listAllergeni', () => menu.listAllergeni(), 'get', '/v1/menu/allergeni/'],
  ['createAllergene', () => menu.createAllergene(P), 'post', '/v1/menu/allergeni/'],
  ['deleteAllergene', () => menu.deleteAllergene('a1'), 'delete', '/v1/menu/allergeni/a1/'],
  ['listProdotti', () => menu.listProdotti(), 'get', '/v1/menu/prodotti/'],
  ['createProdotto', () => menu.createProdotto(P), 'post', '/v1/menu/prodotti/'],
  ['updateProdotto', () => menu.updateProdotto('p1', P), 'put', '/v1/menu/prodotti/p1/'],
  ['deleteProdotto', () => menu.deleteProdotto('p1'), 'delete', '/v1/menu/prodotti/p1/'],
  ['listGiorniChiusiAsporto', () => menu.listGiorniChiusiAsporto(), 'get', '/v1/menu/giorni-chiusi-asporto/'],
  ['createGiornoChiusoAsporto', () => menu.createGiornoChiusoAsporto(P), 'post', '/v1/menu/giorni-chiusi-asporto/'],
  ['deleteGiornoChiusoAsporto', () => menu.deleteGiornoChiusoAsporto('g1'), 'delete', '/v1/menu/giorni-chiusi-asporto/g1/'],
  ['getProssimeChiusureAsporto', () => menu.getProssimeChiusureAsporto(), 'get', '/v1/menu/giorni-chiusi-asporto/prossime/'],
  ['createVoceOrdine', () => menu.createVoceOrdine(P), 'post', '/v1/menu/voci-ordine/'],
  ['listVociOrdine', () => menu.listVociOrdine({ prenotazione: 'o1' }), 'get', '/v1/menu/voci-ordine/'],
  ['updateVoceOrdine', () => menu.updateVoceOrdine('v1', P), 'patch', '/v1/menu/voci-ordine/v1/'],
  ['deleteVoceOrdine', () => menu.deleteVoceOrdine('v1'), 'delete', '/v1/menu/voci-ordine/v1/'],

  ['getServiziDisponibili', () => servizi.getServiziDisponibili(), 'get', '/v1/servizi-disponibili/'],
  ['getConfigurazionePadel', () => padel.getConfigurazionePadel(), 'get', '/v1/struttura/configurazione-padel/'],
  ['updateConfigurazionePadel', () => padel.updateConfigurazionePadel(P), 'patch', '/v1/struttura/configurazione-padel/'],
  ['listGiorniChiusiPadel', () => padel.listGiorniChiusiPadel(), 'get', '/v1/struttura/giorni-chiusi-padel/'],
  ['getProssimeChiusurePadel', () => padel.getProssimeChiusurePadel(), 'get', '/v1/struttura/giorni-chiusi-padel/prossime/'],
  ['createGiornoChiusoPadel', () => padel.createGiornoChiusoPadel('2026-09-01'), 'post', '/v1/struttura/giorni-chiusi-padel/'],
  ['deleteGiornoChiusoPadel', () => padel.deleteGiornoChiusoPadel('g1'), 'delete', '/v1/struttura/giorni-chiusi-padel/g1/'],
  ['listRacchettePadel', () => padel.listRacchettePadel({ disponibile: true }), 'get', '/v1/struttura/racchette-padel/'],
  ['createRacchettaPadel', () => padel.createRacchettaPadel(P), 'post', '/v1/struttura/racchette-padel/'],
  ['updateRacchettaPadel', () => padel.updateRacchettaPadel('r1', P), 'patch', '/v1/struttura/racchette-padel/r1/'],
  ['deleteRacchettaPadel', () => padel.deleteRacchettaPadel('r1'), 'delete', '/v1/struttura/racchette-padel/r1/'],
  ['listPrenotazioniPadel', () => padel.listPrenotazioniPadel({ data: '2026-09-01' }), 'get', '/v1/prenotazioni/padel/'],
  ['listPrenotazioniPadelByCliente', () => padel.listPrenotazioniPadelByCliente('c1'), 'get', '/v1/prenotazioni/padel/'],
  ['getPrenotazionePadel', () => padel.getPrenotazionePadel('x1'), 'get', '/v1/prenotazioni/padel/x1/'],
  ['createPrenotazionePadel', () => padel.createPrenotazionePadel(P), 'post', '/v1/prenotazioni/padel/'],
  ['updatePrenotazionePadel', () => padel.updatePrenotazionePadel('x1', P), 'patch', '/v1/prenotazioni/padel/x1/'],
  ['listPrenotazioniPadelRecenti', () => padel.listPrenotazioniPadelRecenti(), 'get', '/v1/prenotazioni/padel/recenti/'],
  ['getConteggiPrenotazioniPadel', () => padel.getConteggiPrenotazioniPadel({ anno: 2026, mese: 9 }), 'get', '/v1/prenotazioni/padel/conteggi/'],
  ['getDisponibilitaPadel', () => padel.getDisponibilitaPadel({ data: '2026-09-01' }), 'get', '/v1/prenotazioni/padel/disponibilita/'],
  ['getStoricoPadelPerTelefono', () => padel.getStoricoPadelPerTelefono('333'), 'post', '/v1/prenotazioni/padel/storico_telefono/'],
  ['getDettaglioPubblicoPadel', () => padel.getDettaglioPubblicoPadel('x1'), 'get', '/v1/prenotazioni/padel/x1/dettaglio_pubblico/'],
  ['createNoleggioRacchetta', () => padel.createNoleggioRacchetta(P), 'post', '/v1/prenotazioni/noleggi-racchetta/'],
  ['updateNoleggioRacchetta', () => padel.updateNoleggioRacchetta('n1', 2), 'patch', '/v1/prenotazioni/noleggi-racchetta/n1/'],
  ['deleteNoleggioRacchetta', () => padel.deleteNoleggioRacchetta('n1'), 'delete', '/v1/prenotazioni/noleggi-racchetta/n1/'],

  ['listPrenotazioniPiscina', () => prenotazioni.listPrenotazioniPiscina({ data: 'd' }), 'get', '/v1/prenotazioni/piscina/'],
  ['listPrenotazioniPiscinaByCliente', () => prenotazioni.listPrenotazioniPiscinaByCliente('c1'), 'get', '/v1/prenotazioni/piscina/'],
  ['listPrenotazioniRecenti', () => prenotazioni.listPrenotazioniRecenti(), 'get', '/v1/prenotazioni/piscina/recenti/'],
  ['getDisponibilitaPiscina', () => prenotazioni.getDisponibilitaPiscina({ inventario: 'i', data: 'd' }), 'get', '/v1/prenotazioni/piscina/disponibilita/'],
  ['getConteggiPrenotazioniPiscina', () => prenotazioni.getConteggiPrenotazioniPiscina({ inventario: 'i', anno: 2026, mese: 9 }), 'get', '/v1/prenotazioni/piscina/conteggi/'],
  ['createPrenotazionePiscina', () => prenotazioni.createPrenotazionePiscina(P), 'post', '/v1/prenotazioni/piscina/'],
  ['updatePrenotazionePiscina', () => prenotazioni.updatePrenotazionePiscina('p1', P), 'patch', '/v1/prenotazioni/piscina/p1/'],
  ['getStoricoPiscinaPerTelefono', () => prenotazioni.getStoricoPiscinaPerTelefono('333'), 'post', '/v1/prenotazioni/piscina/storico_telefono/'],
  ['getDettaglioPubblicoPiscina', () => prenotazioni.getDettaglioPubblicoPiscina('p1'), 'get', '/v1/prenotazioni/piscina/p1/dettaglio_pubblico/'],
  ['listOccupazioni', () => prenotazioni.listOccupazioni({ data: 'd', postazione__inventario: 'i' }), 'get', '/v1/prenotazioni/occupazioni-postazione/'],
  ['getPostazioniOccupate', () => prenotazioni.getPostazioniOccupate({ inventario: 'i', data: 'd' }), 'get', '/v1/prenotazioni/occupazioni-postazione/occupate/'],
  ['createOccupazione', () => prenotazioni.createOccupazione(P), 'post', '/v1/prenotazioni/occupazioni-postazione/'],
  ['updateOccupazione', () => prenotazioni.updateOccupazione('o1', P), 'patch', '/v1/prenotazioni/occupazioni-postazione/o1/'],
  ['deleteOccupazione', () => prenotazioni.deleteOccupazione('o1'), 'delete', '/v1/prenotazioni/occupazioni-postazione/o1/'],
  ['listGiorniPieni', () => prenotazioni.listGiorniPieni({ inventario: 'i', data: 'd' }), 'get', '/v1/prenotazioni/giorni-pieni/'],
  ['marcaGiornoPieno', () => prenotazioni.marcaGiornoPieno(P), 'post', '/v1/prenotazioni/giorni-pieni/'],
  ['rimuoviGiornoPieno', () => prenotazioni.rimuoviGiornoPieno('g1'), 'delete', '/v1/prenotazioni/giorni-pieni/g1/'],
  ['getGiorniPieniMese', () => prenotazioni.getGiorniPieniMese({ inventario: 'i', anno: 2026, mese: 9 }), 'get', '/v1/prenotazioni/giorni-pieni/calendario/'],
  ['listPrenotazioniAsportoRecenti', () => prenotazioni.listPrenotazioniAsportoRecenti(), 'get', '/v1/prenotazioni/asporto/recenti/'],
  ['getConteggiPrenotazioniAsporto', () => prenotazioni.getConteggiPrenotazioniAsporto({ anno: 2026, mese: 9 }), 'get', '/v1/prenotazioni/asporto/conteggi/'],
  ['getPrenotazioniPerOrario', () => prenotazioni.getPrenotazioniPerOrario('d'), 'get', '/v1/prenotazioni/asporto/prenotazioni_per_orario/'],
  ['createPrenotazioneAsporto', () => prenotazioni.createPrenotazioneAsporto(P), 'post', '/v1/prenotazioni/asporto/'],
  ['listPrenotazioniAsporto', () => prenotazioni.listPrenotazioniAsporto({ data: 'd' }), 'get', '/v1/prenotazioni/asporto/'],
  ['getPrenotazioneAsporto', () => prenotazioni.getPrenotazioneAsporto('a1'), 'get', '/v1/prenotazioni/asporto/a1/'],
  ['listPrenotazioniAsportoByCliente', () => prenotazioni.listPrenotazioniAsportoByCliente('c1'), 'get', '/v1/prenotazioni/asporto/'],
  ['updatePrenotazioneAsporto', () => prenotazioni.updatePrenotazioneAsporto('a1', P), 'patch', '/v1/prenotazioni/asporto/a1/'],
  ['getStoricoAsportoPerTelefono', () => prenotazioni.getStoricoAsportoPerTelefono('333'), 'post', '/v1/prenotazioni/asporto/storico_telefono/'],
  ['getDettaglioPubblicoAsporto', () => prenotazioni.getDettaglioPubblicoAsporto('a1'), 'get', '/v1/prenotazioni/asporto/a1/dettaglio_pubblico/'],

  ['listStaff', () => staff.listStaff(), 'get', '/v1/users/staff/'],
  ['createStaff', () => staff.createStaff(P), 'post', '/v1/users/staff/'],
  ['updateStaff', () => staff.updateStaff('s1', P), 'patch', '/v1/users/staff/s1/'],
  ['deleteStaff', () => staff.deleteStaff('s1'), 'delete', '/v1/users/staff/s1/'],
  ['setStaffActive', () => staff.setStaffActive('s1', false), 'patch', '/v1/users/staff/s1/set-active/'],
  ['activateAccount', () => staff.activateAccount(P), 'post', '/v1/users/staff/activate/'],
  ['requestPasswordReset', () => staff.requestPasswordReset('a@b.it'), 'post', '/v1/users/staff/reset-password/request/'],
  ['confirmPasswordReset', () => staff.confirmPasswordReset(P), 'post', '/v1/users/staff/reset-password/confirm/'],

  ['listPiscinaInventari', () => struttura.listPiscinaInventari(), 'get', '/v1/struttura/inventario-piscina/'],
  ['getPiscinaInventario', () => struttura.getPiscinaInventario('i1'), 'get', '/v1/struttura/inventario-piscina/i1/'],
  ['createPiscinaInventario', () => struttura.createPiscinaInventario(P), 'post', '/v1/struttura/inventario-piscina/'],
  ['updatePiscinaInventario', () => struttura.updatePiscinaInventario('i1', P), 'put', '/v1/struttura/inventario-piscina/i1/'],
  ['deletePiscinaInventario', () => struttura.deletePiscinaInventario('i1'), 'delete', '/v1/struttura/inventario-piscina/i1/'],
  ['listPostazioni', () => struttura.listPostazioni('i1', '2026-09-01'), 'get', '/v1/struttura/postazioni/'],
  ['createPostazione', () => struttura.createPostazione(P), 'post', '/v1/struttura/postazioni/'],
  ['updatePostazione', () => struttura.updatePostazione('p1', P), 'patch', '/v1/struttura/postazioni/p1/'],
  ['deletePostazione', () => struttura.deletePostazione('p1'), 'delete', '/v1/struttura/postazioni/p1/'],
];

beforeEach(() => {
  for (const metodo of ['get', 'post', 'patch', 'put', 'delete'] as const) {
    api[metodo].mockReset();
    api[metodo].mockResolvedValue({ data: 'DATI' });
  }
});

describe('service layer', () => {
  it.each(CASI)('%s colpisce il path corretto', async (_nome, chiamata, metodo, path) => {
    const risultato = await chiamata();

    expect(api[metodo]).toHaveBeenCalledTimes(1);
    expect(api[metodo].mock.calls[0][0]).toBe(path);
    // Le DELETE non restituiscono nulla, tutte le altre il corpo della risposta.
    expect(risultato).toBe(metodo === 'delete' ? undefined : 'DATI');
  });

  it('passa limit e parametri di query dove servono', async () => {
    await prenotazioni.listPrenotazioniRecenti(10);
    expect(api.get).toHaveBeenLastCalledWith('/v1/prenotazioni/piscina/recenti/', { params: { limit: 10 } });

    await clienti.searchClienti('mar');
    expect(api.get.mock.calls.at(-1)?.[1]).toEqual({ params: { search: 'mar' } });
  });

  it('manda il telefono di "Le mie prenotazioni" nel corpo, mai in query string', async () => {
    await prenotazioni.getStoricoPiscinaPerTelefono('3331234567');
    await prenotazioni.getStoricoAsportoPerTelefono('3331234567');
    await padel.getStoricoPadelPerTelefono('3331234567');

    for (const chiamata of api.post.mock.calls) {
      expect(chiamata).toHaveLength(2);
      expect(chiamata[1]).toEqual({ telefono: '3331234567' });
      expect(chiamata[0]).not.toContain('3331234567');
    }
    expect(api.get).not.toHaveBeenCalled();
  });

  it('costruisce gli URL pubblici dei PDF senza richieste', () => {
    expect(prenotazioni.getBigliettoUrl('p1')).toBe('https://api.test/api/v1/prenotazioni/piscina/p1/scarica_biglietto/');
    expect(prenotazioni.getRicevutaUrl('a1')).toBe('https://api.test/api/v1/prenotazioni/asporto/a1/scarica_ricevuta/');
    expect(padel.getBigliettoPadelUrl('x1')).toBe('https://api.test/api/v1/prenotazioni/padel/x1/scarica_biglietto/');
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('createPrenotazionePadelConNoleggi', () => {
  it('crea la partita e una riga di noleggio solo per le marche con quantità > 0', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'partita-1' } }).mockResolvedValue({ data: {} });

    const partita = await padel.createPrenotazionePadelConNoleggi(P, { r1: 2, r2: 0, r3: 1 });

    expect(partita).toEqual({ id: 'partita-1' });
    expect(api.post).toHaveBeenCalledTimes(3);
    expect(api.post).toHaveBeenNthCalledWith(2, '/v1/prenotazioni/noleggi-racchetta/', {
      prenotazione: 'partita-1',
      racchetta: 'r1',
      quantita: 2,
    });
    expect(api.post).toHaveBeenNthCalledWith(3, '/v1/prenotazioni/noleggi-racchetta/', {
      prenotazione: 'partita-1',
      racchetta: 'r3',
      quantita: 1,
    });
  });

  it('propaga il fallimento di un noleggio invece di nasconderlo', async () => {
    api.post.mockResolvedValueOnce({ data: { id: 'partita-1' } }).mockRejectedValueOnce(new Error('409'));
    await expect(padel.createPrenotazionePadelConNoleggi(P, { r1: 1 })).rejects.toThrow('409');
  });
});

describe('uploadProdottoImmagine', () => {
  it('su web converte l’uri in un Blob e invia una PATCH multipart', async () => {
    const blob = new Blob(['x'], { type: 'image/png' });
    globalThis.fetch = jest.fn().mockResolvedValue({ blob: () => Promise.resolve(blob) }) as never;

    const risultato = await menu.uploadProdottoImmagine('p1', {
      uri: 'blob:foto',
      name: 'foto.png',
      mimeType: 'image/png',
    } as never);

    expect(globalThis.fetch).toHaveBeenCalledWith('blob:foto');
    expect(api.patch.mock.calls[0][0]).toBe('/v1/menu/prodotti/p1/');
    const formData = api.patch.mock.calls[0][1] as FormData;
    expect(formData.get('immagine')).toBeInstanceOf(Blob);
    expect(risultato).toBe('DATI');
  });

  it('su nativo allega direttamente {uri, name, type}', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native');
    jest.replaceProperty(Platform, 'OS', 'android');
    const append = jest.spyOn(FormData.prototype, 'append');

    await menu.uploadProdottoImmagine('p1', { uri: 'file:///foto.jpg', name: 'foto.jpg', mimeType: 'image/jpeg' } as never);

    expect(append).toHaveBeenCalledWith('immagine', { uri: 'file:///foto.jpg', name: 'foto.jpg', type: 'image/jpeg' });
    jest.restoreAllMocks();
  });
});
