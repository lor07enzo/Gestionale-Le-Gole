import { z } from 'zod';

// Usato sia in creazione sia in modifica: la password non fa più parte di questo form,
// lo staff la imposta da solo tramite il link di attivazione (vedi src/schemas/auth.ts).
export const staffSchema = z.object({
  username: z.string().trim().min(3, 'Lo username deve avere almeno 3 caratteri.'),
  // .string().trim().email() invece del più recente z.email(): quest'ultimo valida il
  // formato PRIMA di un .trim() incatenato (spazi iniziali/finali fanno fallire il parse
  // anche con .trim() in coda), il vecchio chain invece trima prima di validare.
  email: z.string().trim().email('Inserisci un indirizzo email valido.'),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

export { formatZodErrors } from '../utils/zodErrors';
