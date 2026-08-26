import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getConfigurazioneAsporto,
  getProdottiPrenotatiPerOrario,
  getProssimeChiusureAsporto,
  listAllergeni,
  listCategorie,
  listProdotti,
  type Allergene,
  type Categoria,
  type ConfigurazioneAsporto,
  type ProdottiPrenotatiPerOrario,
  type Prodotto,
} from '../services/menu';
import { toISODate } from '../utils/piscinaMappa';

export type CartLine = { prodotto: Prodotto; quantita: number };

type CarrelloAsportoContextValue = {
  categorie: Categoria[];
  allergeni: Allergene[];
  allergeneById: Map<string, Allergene>;
  prodotti: Prodotto[];
  prodottiDisponibili: Prodotto[];
  configurazione: ConfigurazioneAsporto | null;
  chiusureFuture: string[];
  // Quantità totale di prodotti già prenotati per ciascun orario, oggi (sezione 15) — combinata
  // con `configurazione.limite_prodotti_orario` per calcolare il residuo per slot; un orario
  // assente equivale a 0 prenotati. Sempre relativo a oggi: un ordine asporto non ha mai una data
  // diversa (sezione 7).
  prenotatiPerOrario: ProdottiPrenotatiPerOrario;
  isLoading: boolean;
  loadError: string | null;
  quantities: Record<string, number>;
  setQuantita: (prodottoId: string, next: number) => void;
  cartLines: CartLine[];
  totaleArticoli: number;
  totalePrezzo: number;
  svuotaCarrello: () => void;
};

const CarrelloAsportoContext = createContext<CarrelloAsportoContextValue | undefined>(undefined);

// Catalogo (categorie/allergeni/prodotti/configurazione/chiusure) e carrello condivisi tra la
// pagina menu e la pagina di dettaglio prodotto (due rotte distinte, non più un solo schermo con
// uno sheet) — sollevati qui, nel _layout del gruppo `asporto/`, così entrambe le pagine vedono
// lo stesso stato senza rifetchare il catalogo ad ogni navigazione e senza perdere il carrello
// passando dal menu al dettaglio e ritorno.
export function CarrelloAsportoProvider({ children }: { children: ReactNode }) {
  const [categorie, setCategorie] = useState<Categoria[]>([]);
  const [allergeni, setAllergeni] = useState<Allergene[]>([]);
  const [prodotti, setProdotti] = useState<Prodotto[]>([]);
  const [configurazione, setConfigurazione] = useState<ConfigurazioneAsporto | null>(null);
  const [chiusureFuture, setChiusureFuture] = useState<string[]>([]);
  const [prenotatiPerOrario, setPrenotatiPerOrario] = useState<ProdottiPrenotatiPerOrario>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    Promise.all([
      listCategorie(),
      listAllergeni(),
      listProdotti(),
      getConfigurazioneAsporto(),
      getProssimeChiusureAsporto(),
      getProdottiPrenotatiPerOrario(toISODate(new Date())),
    ])
      .then(([cats, allergeniList, prods, config, chiusure, prenotati]) => {
        setCategorie(cats);
        setAllergeni(allergeniList);
        setProdotti(prods);
        setConfigurazione(config);
        setChiusureFuture(chiusure);
        setPrenotatiPerOrario(prenotati);
      })
      .catch(() => setLoadError('Impossibile caricare il menu asporto. Riprova più tardi.'))
      .finally(() => setIsLoading(false));
  }, []);

  const allergeneById = useMemo(() => new Map(allergeni.map((a) => [a.id, a])), [allergeni]);
  const prodottiDisponibili = useMemo(() => prodotti.filter((p) => p.disponibile), [prodotti]);

  const setQuantita = useCallback((prodottoId: string, next: number) => {
    setQuantities((prev) => {
      const clamped = Math.max(0, next);
      if (clamped === 0) {
        const { [prodottoId]: _rimosso, ...rest } = prev;
        return rest;
      }
      return { ...prev, [prodottoId]: clamped };
    });
  }, []);

  const svuotaCarrello = useCallback(() => setQuantities({}), []);

  const cartLines: CartLine[] = useMemo(
    () =>
      Object.entries(quantities)
        .map(([id, quantita]) => ({ prodotto: prodottiDisponibili.find((p) => p.id === id), quantita }))
        .filter((line): line is CartLine => Boolean(line.prodotto)),
    [quantities, prodottiDisponibili]
  );

  const totaleArticoli = cartLines.reduce((sum, line) => sum + line.quantita, 0);
  const totalePrezzo = cartLines.reduce(
    (sum, line) => sum + line.quantita * (Number.parseFloat(line.prodotto.prezzo) || 0),
    0
  );

  const value = useMemo<CarrelloAsportoContextValue>(
    () => ({
      categorie,
      allergeni,
      allergeneById,
      prodotti,
      prodottiDisponibili,
      configurazione,
      chiusureFuture,
      prenotatiPerOrario,
      isLoading,
      loadError,
      quantities,
      setQuantita,
      cartLines,
      totaleArticoli,
      totalePrezzo,
      svuotaCarrello,
    }),
    [
      categorie,
      allergeni,
      allergeneById,
      prodotti,
      prodottiDisponibili,
      configurazione,
      chiusureFuture,
      prenotatiPerOrario,
      isLoading,
      loadError,
      quantities,
      setQuantita,
      cartLines,
      totaleArticoli,
      totalePrezzo,
      svuotaCarrello,
    ]
  );

  return <CarrelloAsportoContext.Provider value={value}>{children}</CarrelloAsportoContext.Provider>;
}

export function useCarrelloAsporto(): CarrelloAsportoContextValue {
  const context = useContext(CarrelloAsportoContext);
  if (!context) {
    throw new Error("useCarrelloAsporto deve essere usato all'interno di un CarrelloAsportoProvider.");
  }
  return context;
}
