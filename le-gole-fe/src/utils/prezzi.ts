import type { PiscinaInventario } from '../services/struttura';

// "8.00" -> "8", "4.50" -> "4,50" (virgola italiana solo quando servono i centesimi).
export function formatPrezzo(value: string): string {
  const numero = Number.parseFloat(value);
  if (Number.isNaN(numero)) return value;
  return numero % 1 === 0 ? `${numero}` : numero.toFixed(2).replace('.', ',');
}

export const PREZZO_ITEMS: Array<{
  prezzoKey: keyof PiscinaInventario;
  totaleKey?: keyof PiscinaInventario;
  // Per le tariffe ingresso alternative (opzionali, default 0.00): nascoste finché lo staff non
  // imposta un prezzo > 0, stesso principio di totaleKey per ombrellone/gazebo/lettino/sdraia ma
  // basato sul prezzo invece che su una quantità (l'ingresso non ha un "totale" da configurare).
  hideIfZero?: boolean;
  icon: string;
  label: string;
}> = [
  { prezzoKey: 'prezzo_ingresso', icon: '🎟️', label: 'Ingresso' },
  { prezzoKey: 'prezzo_ingresso_ridotto', hideIfZero: true, icon: '🌇', label: 'Ridotto pomeridiano' },
  { prezzoKey: 'prezzo_ingresso_bambino', hideIfZero: true, icon: '🧒', label: 'Bambini' },
  { prezzoKey: 'prezzo_ombrellone', totaleKey: 'totale_ombrelloni', icon: '⛱️', label: 'Ombrellone' },
  { prezzoKey: 'prezzo_gazebo', totaleKey: 'totale_gazebi', icon: '⛺', label: 'Gazebo' },
  { prezzoKey: 'prezzo_lettino', totaleKey: 'totale_lettini', icon: '🛏️', label: 'Lettino' },
  { prezzoKey: 'prezzo_sdraia', totaleKey: 'totale_sdraie', icon: '🪑', label: 'Sdraia' },
];
