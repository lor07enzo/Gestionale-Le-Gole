import { z } from 'zod';

export const staffSchema = z.object({
  username: z.string().trim().min(3, 'Lo username deve avere almeno 3 caratteri.'),
  // .string().trim().email(), non z.email(): quest'ultimo valida prima di trimmare.
  email: z.string().trim().email('Inserisci un indirizzo email valido.'),
});

export type StaffFormValues = z.infer<typeof staffSchema>;

export { formatZodErrors } from '../utils/zodErrors';
