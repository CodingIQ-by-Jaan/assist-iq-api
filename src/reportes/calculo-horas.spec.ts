import { TipoMarcaje } from '@prisma/client';
import { calcularTurnos, contarIncompletos, inicioDiaLocalEnUtc, segmentosDeTurnos, sumarHoras } from './calculo-horas';

const m = (tipo: TipoMarcaje, iso: string) => ({ tipo, marcadoEn: new Date(iso) });

describe('calcularTurnos', () => {
  it('calcula las horas de un día completo, descontando el almuerzo', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      m(TipoMarcaje.INICIO_ALMUERZO, '2026-09-01T12:00:00Z'),
      m(TipoMarcaje.FIN_ALMUERZO, '2026-09-01T13:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T17:00:00Z'),
    ]);

    expect(turnos).toHaveLength(1);
    expect(turnos[0].incompleto).toBe(false);
    expect(turnos[0].horas).toBeCloseTo(8);
  });

  it('cuenta las horas completas cuando no se marca almuerzo', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T16:00:00Z'),
    ]);

    expect(turnos[0].horas).toBeCloseTo(8);
    expect(turnos[0].incompleto).toBe(false);
  });

  it('marca como incompleto un turno sin salida (jornada abierta o salida olvidada)', () => {
    const turnos = calcularTurnos([m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z')]);

    expect(turnos).toHaveLength(1);
    expect(turnos[0].incompleto).toBe(true);
    expect(turnos[0].horas).toBe(0);
  });

  it('cierra el turno anterior como incompleto si llega una nueva ENTRADA sin SALIDA', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      // se olvidó marcar salida ese día
      m(TipoMarcaje.ENTRADA, '2026-09-02T08:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-02T16:00:00Z'),
    ]);

    expect(turnos).toHaveLength(2);
    expect(turnos[0].incompleto).toBe(true);
    expect(turnos[0].horas).toBe(0);
    expect(turnos[1].incompleto).toBe(false);
    expect(turnos[1].horas).toBeCloseTo(8);
  });

  it('ignora marcajes fuera de orden que llegan sin una ENTRADA previa', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.FIN_ALMUERZO, '2026-09-01T13:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T17:00:00Z'),
    ]);

    expect(turnos).toHaveLength(0);
  });

  it('suma varios turnos del rango y cuenta solo los incompletos', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T16:00:00Z'),
      m(TipoMarcaje.ENTRADA, '2026-09-02T08:00:00Z'),
    ]);

    expect(sumarHoras(turnos)).toBeCloseTo(8);
    expect(contarIncompletos(turnos)).toBe(1);
  });
});

describe('segmentos trabajados', () => {
  it('un turno sin almuerzo tiene un único segmento entrada→salida', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T16:00:00Z'),
    ]);

    expect(turnos[0].segmentos).toEqual([
      { inicio: new Date('2026-09-01T08:00:00Z'), fin: new Date('2026-09-01T16:00:00Z') },
    ]);
  });

  it('un turno con almuerzo tiene dos segmentos, sin el hueco del almuerzo', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      m(TipoMarcaje.INICIO_ALMUERZO, '2026-09-01T12:00:00Z'),
      m(TipoMarcaje.FIN_ALMUERZO, '2026-09-01T13:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T17:00:00Z'),
    ]);

    expect(turnos[0].segmentos).toEqual([
      { inicio: new Date('2026-09-01T08:00:00Z'), fin: new Date('2026-09-01T12:00:00Z') },
      { inicio: new Date('2026-09-01T13:00:00Z'), fin: new Date('2026-09-01T17:00:00Z') },
    ]);
  });

  it('un turno incompleto no aporta segmentos', () => {
    const turnos = calcularTurnos([m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z')]);
    expect(turnos[0].segmentos).toEqual([]);
  });

  it('segmentosDeTurnos junta los segmentos de varios turnos', () => {
    const turnos = calcularTurnos([
      m(TipoMarcaje.ENTRADA, '2026-09-01T08:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-01T16:00:00Z'),
      m(TipoMarcaje.ENTRADA, '2026-09-02T08:00:00Z'),
      m(TipoMarcaje.SALIDA, '2026-09-02T16:00:00Z'),
    ]);

    expect(segmentosDeTurnos(turnos)).toHaveLength(2);
  });
});

describe('inicioDiaLocalEnUtc', () => {
  it('convierte la medianoche local de Tegucigalpa (UTC-6, sin horario de verano) a UTC', () => {
    const resultado = inicioDiaLocalEnUtc('2026-09-01', 'America/Tegucigalpa');
    expect(resultado.toISOString()).toBe('2026-09-01T06:00:00.000Z');
  });

  it('convierte la medianoche local en UTC (sin desfase)', () => {
    const resultado = inicioDiaLocalEnUtc('2026-09-01', 'UTC');
    expect(resultado.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });
});
