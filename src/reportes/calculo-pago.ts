import { MS_POR_DIA, subrangosBanda } from '../common/utils/bandas-horarias';
import { inicioDiaLocalEnUtc, SegmentoTrabajado } from './calculo-horas';

// Convención estándar en Honduras: salario diario = salario mensual / 30, tarifa por hora =
// salario diario / 8. Equivale a 240 horas mensuales de referencia.
export const HORAS_MENSUALES_REFERENCIA = 240;

export const tarifaHoraBase = (salarioBase: number | null): number | null =>
  salarioBase === null ? null : salarioBase / HORAS_MENSUALES_REFERENCIA;

export interface ReglaRecargoCalculo {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  porcentaje: number;
}

export interface DesgloseRegla {
  reglaId: string;
  nombre: string;
  porcentaje: number;
  horas: number;
}

export interface DesgloseHoras {
  horasTotales: number;
  // Horas que no cayeron en ninguna regla activa (se pagan a la tarifa base, sin extra)
  horasBase: number;
  // Horas que sí cayeron en alguna regla, con las horas correspondientes a cada una
  porRegla: DesgloseRegla[];
}

const partesLocales = (instante: Date, zonaHoraria: string): { fechaISO: string; msDesdeMedianoche: number } => {
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
      .formatToParts(instante)
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    fechaISO: `${partes.year}-${partes.month}-${partes.day}`,
    msDesdeMedianoche: Number(partes.hour) * 3_600_000 + Number(partes.minute) * 60_000 + Number(partes.second) * 1000,
  };
};

const siguienteFechaISO = (fechaISO: string): string => {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1));
  return `${siguiente.getUTCFullYear()}-${String(siguiente.getUTCMonth() + 1).padStart(2, '0')}-${String(siguiente.getUTCDate()).padStart(2, '0')}`;
};

interface TramoLocal {
  msInicio: number; // ms desde la medianoche local del día al que pertenece este tramo
  msFin: number;
}

// Recorta un segmento [inicio, fin) en tramos que no cruzan la medianoche local de la empresa,
// necesario porque las bandas de recargo (ej. 20:00–04:00) se definen en horario local y se
// repiten cada día.
const dividirPorDiaLocal = (inicio: Date, fin: Date, zonaHoraria: string): TramoLocal[] => {
  if (fin <= inicio) return [];

  const tramos: TramoLocal[] = [];
  let cursor = inicio;
  let { fechaISO } = partesLocales(cursor, zonaHoraria);

  while (cursor < fin) {
    const inicioSiguienteDia = inicioDiaLocalEnUtc(siguienteFechaISO(fechaISO), zonaHoraria);
    const finTramo = fin < inicioSiguienteDia ? fin : inicioSiguienteDia;

    const msInicio = partesLocales(cursor, zonaHoraria).msDesdeMedianoche;
    const msFin = finTramo.getTime() >= inicioSiguienteDia.getTime() ? MS_POR_DIA : partesLocales(finTramo, zonaHoraria).msDesdeMedianoche;
    tramos.push({ msInicio, msFin });

    if (finTramo >= fin) break;
    cursor = finTramo;
    fechaISO = siguienteFechaISO(fechaISO);
  }

  return tramos;
};

// Reparte los segmentos realmente trabajados entre las reglas de recargo activas de la empresa,
// según en qué franja horaria local cayó cada minuto trabajado. Los minutos que no caen en
// ninguna regla se cuentan como horas base (sin recargo). Asume que las reglas no se solapan
// entre sí (se valida al crearlas/editarlas en ReglasRecargoService).
export const calcularDesgloseHoras = (
  segmentos: SegmentoTrabajado[],
  zonaHoraria: string,
  reglas: ReglaRecargoCalculo[],
): DesgloseHoras => {
  const bandasPorRegla = reglas.map((regla) => ({ regla, subrangos: subrangosBanda(regla) }));
  const msPorRegla = new Map<string, number>(reglas.map((r) => [r.id, 0]));
  let msBase = 0;
  let msTotales = 0;

  for (const segmento of segmentos) {
    if (segmento.fin <= segmento.inicio) continue;
    msTotales += segmento.fin.getTime() - segmento.inicio.getTime();

    for (const tramo of dividirPorDiaLocal(segmento.inicio, segmento.fin, zonaHoraria)) {
      let msCubiertosEnTramo = 0;

      for (const { regla, subrangos } of bandasPorRegla) {
        let msEnRegla = 0;
        for (const [bandaInicio, bandaFin] of subrangos) {
          msEnRegla += Math.max(0, Math.min(tramo.msFin, bandaFin) - Math.max(tramo.msInicio, bandaInicio));
        }
        if (msEnRegla > 0) {
          msPorRegla.set(regla.id, (msPorRegla.get(regla.id) ?? 0) + msEnRegla);
          msCubiertosEnTramo += msEnRegla;
        }
      }

      msBase += Math.max(0, tramo.msFin - tramo.msInicio - msCubiertosEnTramo);
    }
  }

  const aHoras = (ms: number) => Math.round((ms / 3_600_000) * 100) / 100;

  return {
    horasTotales: aHoras(msTotales),
    horasBase: aHoras(msBase),
    porRegla: reglas
      .map((regla) => ({
        reglaId: regla.id,
        nombre: regla.nombre,
        porcentaje: regla.porcentaje,
        horas: aHoras(msPorRegla.get(regla.id) ?? 0),
      }))
      .filter((fila) => fila.horas > 0),
  };
};
