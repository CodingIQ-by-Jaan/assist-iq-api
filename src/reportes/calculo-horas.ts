import { TipoMarcaje } from '@prisma/client';

export interface MarcajeCalculo {
  tipo: TipoMarcaje;
  marcadoEn: Date;
}

export interface SegmentoTrabajado {
  inicio: Date;
  fin: Date;
}

export interface Turno {
  entrada: Date;
  salida: Date | null;
  minutosAlmuerzo: number;
  // Horas trabajadas del turno (ya descontado el almuerzo). 0 si sigue incompleto.
  horas: number;
  // Tramos de tiempo realmente trabajados (entrada→almuerzo, almuerzo→salida, o entrada→salida
  // si no hubo almuerzo). Vacío si el turno sigue incompleto. Se usan para repartir las horas
  // entre las reglas de recargo por franja horaria (ver calculo-pago.ts).
  segmentos: SegmentoTrabajado[];
  // true si el turno no tiene un marcaje de SALIDA dentro del rango analizado
  // (jornada que sigue abierta, o el empleado olvidó marcar salida)
  incompleto: boolean;
}

// Reconstruye los turnos (entrada → salida) de un empleado a partir de sus marcajes crudos,
// siguiendo la misma máquina de estados que usa el kiosco (ver marcajes/secuencia.ts): una
// ENTRADA abre turno, INICIO_ALMUERZO/FIN_ALMUERZO se descuentan de las horas, y SALIDA lo cierra.
// Si aparece una nueva ENTRADA sin que la anterior haya cerrado, el turno previo queda
// incompleto (se olvidó marcar salida) y se cuenta con 0 horas.
export const calcularTurnos = (marcajes: MarcajeCalculo[]): Turno[] => {
  const ordenados = [...marcajes].sort((a, b) => a.marcadoEn.getTime() - b.marcadoEn.getTime());

  const turnos: Turno[] = [];
  let actual: Turno | null = null;
  // La secuencia del kiosco solo permite un almuerzo por turno (después de FIN_ALMUERZO
  // solo se puede marcar SALIDA), así que basta con guardar un único par de instantes.
  let almuerzoInicio: Date | null = null;
  let almuerzoFin: Date | null = null;

  for (const marcaje of ordenados) {
    if (marcaje.tipo === TipoMarcaje.ENTRADA) {
      if (actual) turnos.push(actual);
      actual = { entrada: marcaje.marcadoEn, salida: null, minutosAlmuerzo: 0, horas: 0, segmentos: [], incompleto: true };
      almuerzoInicio = null;
      almuerzoFin = null;
      continue;
    }

    // Marcaje huérfano (sin ENTRADA previa en el rango consultado): se ignora, no debería
    // ocurrir en condiciones normales porque el kiosco controla la secuencia permitida.
    if (!actual) continue;

    if (marcaje.tipo === TipoMarcaje.INICIO_ALMUERZO) {
      almuerzoInicio = marcaje.marcadoEn;
    } else if (marcaje.tipo === TipoMarcaje.FIN_ALMUERZO) {
      if (almuerzoInicio) {
        almuerzoFin = marcaje.marcadoEn;
        actual.minutosAlmuerzo += (almuerzoFin.getTime() - almuerzoInicio.getTime()) / 60_000;
      }
    } else if (marcaje.tipo === TipoMarcaje.SALIDA) {
      const minutosTotales = (marcaje.marcadoEn.getTime() - actual.entrada.getTime()) / 60_000;
      actual.salida = marcaje.marcadoEn;
      actual.horas = Math.max(0, (minutosTotales - actual.minutosAlmuerzo) / 60);
      actual.segmentos =
        almuerzoInicio && almuerzoFin
          ? [
              { inicio: actual.entrada, fin: almuerzoInicio },
              { inicio: almuerzoFin, fin: actual.salida },
            ]
          : [{ inicio: actual.entrada, fin: actual.salida }];
      actual.incompleto = false;
      turnos.push(actual);
      actual = null;
    }
  }

  // El último turno del rango quedó abierto (sin salida todavía)
  if (actual) turnos.push(actual);

  return turnos;
};

export const sumarHoras = (turnos: Turno[]): number =>
  Math.round(turnos.reduce((acc, t) => acc + t.horas, 0) * 100) / 100;

export const contarIncompletos = (turnos: Turno[]): number =>
  turnos.filter((t) => t.incompleto).length;

export const segmentosDeTurnos = (turnos: Turno[]): SegmentoTrabajado[] =>
  turnos.flatMap((t) => t.segmentos);

// Convierte una fecha local (YYYY-MM-DD) de una zona horaria IANA a su instante UTC
// correspondiente a la medianoche de ese día en esa zona. Sin dependencias externas:
// se apoya en Intl.DateTimeFormat para calcular el offset real (incluye DST si aplica).
export const inicioDiaLocalEnUtc = (fechaISO: string, zonaHoraria: string): Date => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const pruebaUtc = new Date(Date.UTC(anio, mes - 1, dia, 0, 0, 0));

  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zonaHoraria,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(pruebaUtc)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const comoLocalDeLaPrueba = Date.UTC(
    Number(partes.year),
    Number(partes.month) - 1,
    Number(partes.day),
    Number(partes.hour),
    Number(partes.minute),
    Number(partes.second),
  );
  const offsetMs = comoLocalDeLaPrueba - pruebaUtc.getTime();
  return new Date(pruebaUtc.getTime() - offsetMs);
};
