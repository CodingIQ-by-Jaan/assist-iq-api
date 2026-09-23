import { calcularDesgloseHoras, HORAS_MENSUALES_REFERENCIA, tarifaHoraBase } from './calculo-pago';

const ZONA = 'America/Tegucigalpa'; // UTC-6, sin horario de verano
const NOCTURNIDAD = { id: 'r-noct', nombre: 'Nocturnidad', horaInicio: '20:00', horaFin: '04:00', porcentaje: 25 };

describe('tarifaHoraBase', () => {
  it('divide el salario mensual entre 240 (30 días × 8 horas)', () => {
    expect(tarifaHoraBase(12000)).toBeCloseTo(50);
    expect(HORAS_MENSUALES_REFERENCIA).toBe(240);
  });

  it('es null si no hay salario definido', () => {
    expect(tarifaHoraBase(null)).toBeNull();
  });
});

describe('calcularDesgloseHoras', () => {
  it('un turno totalmente diurno no genera horas de ninguna regla', () => {
    const segmentos = [{ inicio: new Date('2026-09-01T14:00:00Z'), fin: new Date('2026-09-01T22:00:00Z') }]; // 08:00–16:00 local
    const resultado = calcularDesgloseHoras(segmentos, ZONA, [NOCTURNIDAD]);

    expect(resultado.horasTotales).toBeCloseTo(8);
    expect(resultado.horasBase).toBeCloseTo(8);
    expect(resultado.porRegla).toEqual([]);
  });

  it('un turno totalmente nocturno (cruza medianoche) cae completo en la regla', () => {
    // 20:00 del día 1 a 04:00 del día 2, hora local
    const segmentos = [{ inicio: new Date('2026-09-02T02:00:00Z'), fin: new Date('2026-09-02T10:00:00Z') }];
    const resultado = calcularDesgloseHoras(segmentos, ZONA, [NOCTURNIDAD]);

    expect(resultado.horasTotales).toBeCloseTo(8);
    expect(resultado.horasBase).toBeCloseTo(0);
    expect(resultado.porRegla).toEqual([{ reglaId: 'r-noct', nombre: 'Nocturnidad', porcentaje: 25, horas: 8 }]);
  });

  it('reparte un turno que cae parte en horario diurno y parte en nocturno', () => {
    // 18:00–22:00 hora local: 2h diurnas (18–20) + 2h nocturnas (20–22)
    const segmentos = [{ inicio: new Date('2026-09-02T00:00:00Z'), fin: new Date('2026-09-02T04:00:00Z') }];
    const resultado = calcularDesgloseHoras(segmentos, ZONA, [NOCTURNIDAD]);

    expect(resultado.horasTotales).toBeCloseTo(4);
    expect(resultado.horasBase).toBeCloseTo(2);
    expect(resultado.porRegla).toEqual([{ reglaId: 'r-noct', nombre: 'Nocturnidad', porcentaje: 25, horas: 2 }]);
  });

  it('sin reglas activas, todas las horas son base', () => {
    const segmentos = [{ inicio: new Date('2026-09-01T14:00:00Z'), fin: new Date('2026-09-01T22:00:00Z') }];
    const resultado = calcularDesgloseHoras(segmentos, ZONA, []);

    expect(resultado.horasBase).toBeCloseTo(8);
    expect(resultado.porRegla).toEqual([]);
  });

  it('divide correctamente un turno largo que cruza varios días calendario locales', () => {
    // 22:00 del día 1 a 02:00 del día 3, hora local (28 horas):
    // 22:00–24:00 (2h noct) + 00:00–04:00 (4h noct) + 04:00–20:00 (16h diurno) + 20:00–02:00 (6h noct)
    const segmentos = [{ inicio: new Date('2026-09-02T04:00:00Z'), fin: new Date('2026-09-03T08:00:00Z') }];
    const resultado = calcularDesgloseHoras(segmentos, ZONA, [NOCTURNIDAD]);

    expect(resultado.horasTotales).toBeCloseTo(28);
    expect(resultado.horasBase).toBeCloseTo(16);
    expect(resultado.porRegla[0].horas).toBeCloseTo(12);
  });
});
