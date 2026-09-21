import { randomInt } from 'crypto';

export const FORMATO_PIN = /^\d{4,6}$/;

// Rechaza PIN triviales: 0000, 1111, 1234, 4321, 2345...
export const esPinDebil = (pin: string): boolean => {
  if (/^(\d)\1+$/.test(pin)) return true;

  const digitos = [...pin].map(Number);
  const diferencias = digitos.slice(1).map((d, i) => d - digitos[i]);
  const ascendente = diferencias.every((d) => d === 1);
  const descendente = diferencias.every((d) => d === -1);
  return ascendente || descendente;
};

// PIN aleatorio de 4 dígitos que no sea débil
export const generarPin = (): string => {
  let pin: string;
  do {
    pin = String(randomInt(0, 10000)).padStart(4, '0');
  } while (esPinDebil(pin));
  return pin;
};
