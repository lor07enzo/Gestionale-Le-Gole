// Confronto tra versioni "1.2.0" segmento per segmento, come numeri (quindi 1.10.0 > 1.9.0).
// Segmenti mancanti valgono 0 ("1.2" == "1.2.0"); un segmento non numerico vale 0.
export function confrontaVersioni(a: string, b: string): number {
  const pa = a.trim().split('.');
  const pb = b.trim().split('.');
  const lunghezza = Math.max(pa.length, pb.length);
  for (let i = 0; i < lunghezza; i++) {
    const na = Number.parseInt(pa[i] ?? '0', 10) || 0;
    const nb = Number.parseInt(pb[i] ?? '0', 10) || 0;
    if (na !== nb) return na > nb ? 1 : -1;
  }
  return 0;
}

export function richiedeAggiornamento(installata: string, minima: string): boolean {
  return confrontaVersioni(installata, minima) < 0;
}
