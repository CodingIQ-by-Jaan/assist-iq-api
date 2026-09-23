import { randomBytes } from 'crypto';

// Contraseña temporal legible: evita caracteres ambiguos (0/O, 1/l/I)
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export const generarPassword = (longitud = 12): string => {
  const bytes = randomBytes(longitud);
  let password = '';
  for (let i = 0; i < longitud; i++) {
    password += ALFABETO[bytes[i] % ALFABETO.length];
  }
  return password;
};
