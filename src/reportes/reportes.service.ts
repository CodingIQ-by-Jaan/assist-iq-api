import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { empresaRequerida } from '../common/utils/tenant';
import { GenerarReporteDto, ReporteHorasDto } from './dto/reporte.dto';
import { calcularTurnos, contarIncompletos, inicioDiaLocalEnUtc, segmentosDeTurnos } from './calculo-horas';
import { calcularDesgloseHoras, ReglaRecargoCalculo, tarifaHoraBase } from './calculo-pago';

const redondear = (valor: number) => Math.round(valor * 100) / 100;

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async generarReporteHoras(usuario: UsuarioAutenticado, query: GenerarReporteDto): Promise<ReporteHorasDto> {
    const empresaId = empresaRequerida(usuario, query.empresaId);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, nombre: true, zonaHoraria: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');

    const desdeUtc = inicioDiaLocalEnUtc(query.desde, empresa.zonaHoraria);
    // "hasta" es inclusive para quien genera el reporte: se calcula como el inicio del día
    // siguiente para usarlo como límite exclusivo en la consulta.
    const hastaUtc = new Date(inicioDiaLocalEnUtc(query.hasta, empresa.zonaHoraria).getTime() + 24 * 3_600_000);
    if (hastaUtc <= desdeUtc) {
      throw new BadRequestException('"hasta" debe ser igual o posterior a "desde"');
    }

    if (query.empleadoId) {
      const empleado = await this.prisma.empleado.findUnique({
        where: { id: query.empleadoId },
        select: { empresaId: true },
      });
      if (!empleado || empleado.empresaId !== empresaId) {
        throw new NotFoundException('Empleado no encontrado');
      }
    }

    const [empleados, marcajes, reglas] = await Promise.all([
      this.prisma.empleado.findMany({
        where: {
          empresaId,
          activo: true,
          ...(query.empleadoId && { id: query.empleadoId }),
        },
        select: { id: true, codigo: true, nombre: true, apellido: true, salarioBase: true },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      }),
      this.prisma.marcaje.findMany({
        where: {
          empresaId,
          marcadoEn: { gte: desdeUtc, lt: hastaUtc },
          ...(query.empleadoId && { empleadoId: query.empleadoId }),
        },
        select: { empleadoId: true, tipo: true, marcadoEn: true },
        orderBy: { marcadoEn: 'asc' },
      }),
      this.prisma.reglaRecargo.findMany({
        where: { empresaId, activa: true },
        select: { id: true, nombre: true, horaInicio: true, horaFin: true, porcentaje: true },
      }),
    ]);

    const reglasCalculo: ReglaRecargoCalculo[] = reglas.map((regla) => ({
      id: regla.id,
      nombre: regla.nombre,
      horaInicio: regla.horaInicio,
      horaFin: regla.horaFin,
      porcentaje: Number(regla.porcentaje),
    }));

    const marcajesPorEmpleado = new Map<string, { tipo: (typeof marcajes)[number]['tipo']; marcadoEn: Date }[]>();
    for (const marcaje of marcajes) {
      const lista = marcajesPorEmpleado.get(marcaje.empleadoId) ?? [];
      lista.push({ tipo: marcaje.tipo, marcadoEn: marcaje.marcadoEn });
      marcajesPorEmpleado.set(marcaje.empleadoId, lista);
    }

    const filas = empleados.map((empleado) => {
      const turnos = calcularTurnos(marcajesPorEmpleado.get(empleado.id) ?? []);
      const desgloseHoras = calcularDesgloseHoras(segmentosDeTurnos(turnos), empresa.zonaHoraria, reglasCalculo);

      const salarioBase = empleado.salarioBase === null ? null : Number(empleado.salarioBase);
      const tarifaBase = tarifaHoraBase(salarioBase);

      const pagoBase = tarifaBase !== null ? redondear(desgloseHoras.horasTotales * tarifaBase) : null;
      const desglose =
        tarifaBase !== null
          ? desgloseHoras.porRegla.map((regla) => ({
              reglaId: regla.reglaId,
              nombre: regla.nombre,
              porcentaje: regla.porcentaje,
              horas: regla.horas,
              monto: redondear(regla.horas * tarifaBase * (regla.porcentaje / 100)),
            }))
          : [];
      const pago =
        pagoBase !== null ? redondear(pagoBase + desglose.reduce((acc, regla) => acc + regla.monto, 0)) : null;

      return {
        empleadoId: empleado.id,
        codigo: empleado.codigo,
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        horas: desgloseHoras.horasTotales,
        salarioBase,
        tarifaHoraBase: tarifaBase,
        pagoBase,
        desglose,
        pago,
        turnosIncompletos: contarIncompletos(turnos),
      };
    });

    const totalHoras = redondear(filas.reduce((acc, fila) => acc + fila.horas, 0));
    const algunoConPago = filas.some((fila) => fila.pago !== null);
    const totalPago = algunoConPago
      ? redondear(filas.reduce((acc, fila) => acc + (fila.pago ?? 0), 0))
      : null;

    return {
      empresa: { id: empresa.id, nombre: empresa.nombre },
      desde: query.desde,
      hasta: query.hasta,
      empleados: filas,
      totales: { horas: totalHoras, pago: totalPago },
    };
  }
}
