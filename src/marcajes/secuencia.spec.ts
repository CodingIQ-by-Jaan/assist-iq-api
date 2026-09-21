import { TipoMarcaje } from '@prisma/client';
import {
  esMarcajeDuplicado,
  HORAS_MAX_JORNADA_ABIERTA,
  marcajesPermitidos,
  TIEMPO_MIN_ENTRE_MARCAJES_MS,
} from './secuencia';

const { ENTRADA, INICIO_ALMUERZO, FIN_ALMUERZO, SALIDA } = TipoMarcaje;
const ahora = new Date('2026-09-21T15:00:00Z');
const hace = (horas: number) => new Date(ahora.getTime() - horas * 3_600_000);

describe('marcajesPermitidos', () => {
  it('sin marcajes previos solo permite ENTRADA', () => {
    expect(marcajesPermitidos(null, ahora)).toEqual([ENTRADA]);
  });

  it('tras ENTRADA permite almuerzo o salida directa', () => {
    expect(marcajesPermitidos({ tipo: ENTRADA, marcadoEn: hace(2) }, ahora)).toEqual([
      INICIO_ALMUERZO,
      SALIDA,
    ]);
  });

  it('tras INICIO_ALMUERZO solo permite FIN_ALMUERZO', () => {
    expect(marcajesPermitidos({ tipo: INICIO_ALMUERZO, marcadoEn: hace(1) }, ahora)).toEqual([
      FIN_ALMUERZO,
    ]);
  });

  it('tras FIN_ALMUERZO solo permite SALIDA', () => {
    expect(marcajesPermitidos({ tipo: FIN_ALMUERZO, marcadoEn: hace(3) }, ahora)).toEqual([SALIDA]);
  });

  it('tras SALIDA permite una nueva ENTRADA, sea el mismo día o el siguiente', () => {
    expect(marcajesPermitidos({ tipo: SALIDA, marcadoEn: hace(1) }, ahora)).toEqual([ENTRADA]);
    expect(marcajesPermitidos({ tipo: SALIDA, marcadoEn: hace(30) }, ahora)).toEqual([ENTRADA]);
  });

  it('turno nocturno que cruza medianoche sigue abierto (dentro del límite)', () => {
    const entradaNoche = new Date('2026-09-20T23:00:00Z');
    const salidaMadrugada = new Date('2026-09-21T07:00:00Z');
    expect(marcajesPermitidos({ tipo: ENTRADA, marcadoEn: entradaNoche }, salidaMadrugada)).toContain(
      SALIDA,
    );
  });

  it('jornada abierta más allá del límite permite ENTRADA (faltó la salida)', () => {
    const vieja = { tipo: ENTRADA, marcadoEn: hace(HORAS_MAX_JORNADA_ABIERTA + 1) };
    expect(marcajesPermitidos(vieja, ahora)).toEqual([ENTRADA]);
  });

  it('justo en el límite todavía se considera abierta', () => {
    const enLimite = { tipo: ENTRADA, marcadoEn: hace(HORAS_MAX_JORNADA_ABIERTA) };
    expect(marcajesPermitidos(enLimite, ahora)).toEqual([INICIO_ALMUERZO, SALIDA]);
  });
});

describe('esMarcajeDuplicado', () => {
  it('sin marcajes previos no es duplicado', () => {
    expect(esMarcajeDuplicado(null, ahora)).toBe(false);
  });

  it('es duplicado dentro del tiempo mínimo', () => {
    const reciente = {
      tipo: ENTRADA,
      marcadoEn: new Date(ahora.getTime() - TIEMPO_MIN_ENTRE_MARCAJES_MS + 1000),
    };
    expect(esMarcajeDuplicado(reciente, ahora)).toBe(true);
  });

  it('no es duplicado pasado el tiempo mínimo', () => {
    const antiguo = {
      tipo: ENTRADA,
      marcadoEn: new Date(ahora.getTime() - TIEMPO_MIN_ENTRE_MARCAJES_MS),
    };
    expect(esMarcajeDuplicado(antiguo, ahora)).toBe(false);
  });
});
