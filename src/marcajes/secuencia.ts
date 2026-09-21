import { TipoMarcaje } from '@prisma/client';

export interface UltimoMarcaje {
  tipo: TipoMarcaje;
  marcadoEn: Date;
}

// Evita el doble toque accidental en el kiosco
export const TIEMPO_MIN_ENTRE_MARCAJES_MS = 60_000;

// Si pasa más tiempo con la jornada abierta se asume que faltó la salida y se permite una nueva entrada
// (el turno sin cerrar quedará para revisión/ajuste del administrador).
export const HORAS_MAX_JORNADA_ABIERTA = 16;

const SIGUIENTES: Record<TipoMarcaje, TipoMarcaje[]> = {
  [TipoMarcaje.ENTRADA]: [TipoMarcaje.INICIO_ALMUERZO, TipoMarcaje.SALIDA],
  [TipoMarcaje.INICIO_ALMUERZO]: [TipoMarcaje.FIN_ALMUERZO],
  [TipoMarcaje.FIN_ALMUERZO]: [TipoMarcaje.SALIDA],
  [TipoMarcaje.SALIDA]: [TipoMarcaje.ENTRADA],
};

export const ETIQUETAS: Record<TipoMarcaje, string> = {
  [TipoMarcaje.ENTRADA]: 'Entrada',
  [TipoMarcaje.INICIO_ALMUERZO]: 'Inicio de almuerzo',
  [TipoMarcaje.FIN_ALMUERZO]: 'Fin de almuerzo',
  [TipoMarcaje.SALIDA]: 'Salida',
};

// La secuencia se evalúa contra el último marcaje (no contra el día calendario),
// así los turnos nocturnos que cruzan la medianoche funcionan bien.
export const marcajesPermitidos = (ultimo: UltimoMarcaje | null, ahora: Date): TipoMarcaje[] => {
  if (!ultimo) return [TipoMarcaje.ENTRADA];

  if (ultimo.tipo !== TipoMarcaje.SALIDA) {
    const horasAbierta = (ahora.getTime() - ultimo.marcadoEn.getTime()) / 3_600_000;
    if (horasAbierta > HORAS_MAX_JORNADA_ABIERTA) return [TipoMarcaje.ENTRADA];
  }

  return SIGUIENTES[ultimo.tipo];
};

export const esMarcajeDuplicado = (ultimo: UltimoMarcaje | null, ahora: Date): boolean =>
  ultimo !== null &&
  ahora.getTime() - ultimo.marcadoEn.getTime() < TIEMPO_MIN_ENTRE_MARCAJES_MS;
