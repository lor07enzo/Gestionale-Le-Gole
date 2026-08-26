// Estrae un messaggio leggibile da un errore Axios verso un endpoint DRF: preferisce
// `response.data.detail` (errore singolo, es. permessi/validate() a livello oggetto), altrimenti
// concatena i messaggi per-campo (`{campo: ["msg", ...]}`), filtrati alle sole stringhe — un
// valore non-stringa per un campo (raro, ma possibile su un payload malformato) non produce un
// frammento illeggibile tipo "[object Object]" nel messaggio finale. Estratta qui il 2026-08-26
// (SonarQube, duplicazione) dopo essere stata copiata identica — con lievi variazioni, unificate
// qui sulla versione più completa — in una decina di file diversi tra pagine cliente e staff.
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object') {
      if ('detail' in data && typeof (data as { detail?: unknown }).detail === 'string') {
        return (data as { detail: string }).detail;
      }
      const values = Object.values(data as Record<string, unknown>).flat();
      const messages = values.filter((value): value is string => typeof value === 'string');
      if (messages.length > 0) return messages.join(' ');
    }
  }
  return fallback;
}
