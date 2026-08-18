import { z } from 'zod';

// Il backend rivalida con Django validate_password; qui solo lunghezza minima e conferma.
export const setPasswordSchema = z
  .object({
    password: z.string().min(8, 'La password deve avere almeno 8 caratteri.'),
    confirmPassword: z.string().min(1, 'Conferma la password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Le password non coincidono.',
    path: ['confirmPassword'],
  });

export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Inserisci un indirizzo email valido.'),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export { formatZodErrors } from '../utils/zodErrors';
