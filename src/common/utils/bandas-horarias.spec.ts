import { bandasSeSolapan, subrangosBanda } from './bandas-horarias';

describe('subrangosBanda', () => {
  it('devuelve un solo rango para una banda que no cruza medianoche', () => {
    expect(subrangosBanda({ horaInicio: '08:00', horaFin: '17:00' })).toEqual([[8 * 3_600_000, 17 * 3_600_000]]);
  });

  it('devuelve dos rangos para una banda que cruza medianoche', () => {
    expect(subrangosBanda({ horaInicio: '20:00', horaFin: '04:00' })).toEqual([
      [20 * 3_600_000, 24 * 3_600_000],
      [0, 4 * 3_600_000],
    ]);
  });
});

describe('bandasSeSolapan', () => {
  it('detecta el solapamiento entre dos bandas del mismo día', () => {
    expect(bandasSeSolapan({ horaInicio: '08:00', horaFin: '17:00' }, { horaInicio: '16:00', horaFin: '20:00' })).toBe(
      true,
    );
  });

  it('no reporta solapamiento entre bandas que no se tocan', () => {
    expect(bandasSeSolapan({ horaInicio: '08:00', horaFin: '12:00' }, { horaInicio: '13:00', horaFin: '17:00' })).toBe(
      false,
    );
  });

  it('no reporta solapamiento entre bandas adyacentes (el fin de una es el inicio de la otra)', () => {
    expect(bandasSeSolapan({ horaInicio: '04:00', horaFin: '20:00' }, { horaInicio: '20:00', horaFin: '04:00' })).toBe(
      false,
    );
  });

  it('detecta el solapamiento cuando una banda que cruza medianoche choca con otra', () => {
    expect(bandasSeSolapan({ horaInicio: '20:00', horaFin: '04:00' }, { horaInicio: '02:00', horaFin: '10:00' })).toBe(
      true,
    );
  });
});
