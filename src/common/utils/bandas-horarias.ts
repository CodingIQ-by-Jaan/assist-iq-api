// Bandas horarias reutilizables: las usan tanto la validación de reglas de recargo
// (que no se solapen) como el cálculo de horas por regla en los reportes.

export const MS_POR_DIA = 86_400_000;

export interface BandaHoraria {
  horaInicio: string; // "HH:mm"
  horaFin: string; // "HH:mm"
}

const aMs = (horaHHmm: string): number => {
  const [horas, minutos] = horaHHmm.split(':').map(Number);
  return horas * 3_600_000 + minutos * 60_000;
};

// Devuelve 1 o 2 sub-rangos [inicio, fin) en milisegundos dentro de un día de 24h.
// Son 2 cuando la banda cruza la medianoche (ej. 20:00–04:00 → [20:00,24:00) y [00:00,04:00)).
export const subrangosBanda = (banda: BandaHoraria): Array<[number, number]> => {
  const inicio = aMs(banda.horaInicio);
  const fin = aMs(banda.horaFin);
  if (fin > inicio) return [[inicio, fin]];
  return [
    [inicio, MS_POR_DIA],
    [0, fin],
  ];
};

export const bandasSeSolapan = (a: BandaHoraria, b: BandaHoraria): boolean => {
  for (const [aInicio, aFin] of subrangosBanda(a)) {
    for (const [bInicio, bFin] of subrangosBanda(b)) {
      if (Math.max(aInicio, bInicio) < Math.min(aFin, bFin)) return true;
    }
  }
  return false;
};
