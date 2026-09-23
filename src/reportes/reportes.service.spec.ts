import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TipoMarcaje, Rol } from '@prisma/client';
import { ReportesService } from './reportes.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

const usuarioAdminEmpresa: UsuarioAutenticado = {
  id: 'u-1',
  email: 'admin@empresa.com',
  nombre: 'Admin',
  rol: Rol.ADMIN_EMPRESA,
  empresaId: 'empresa-1',
};

const empresaBase = { id: 'empresa-1', nombre: 'Pizzería El Sol', zonaHoraria: 'America/Tegucigalpa' };

const empleadoConSalario = {
  id: 'emp-1',
  codigo: '0001',
  nombre: 'María',
  apellido: 'López',
  salarioBase: { toString: () => '12000' } as unknown as number,
};

const empleadoSinSalario = {
  id: 'emp-2',
  codigo: '0002',
  nombre: 'Juan',
  apellido: 'Pérez',
  salarioBase: null,
};

const reglaNocturnidad = {
  id: 'r-noct',
  nombre: 'Nocturnidad',
  horaInicio: '20:00',
  horaFin: '04:00',
  porcentaje: { toString: () => '25' } as unknown as number,
};

const crearPrismaMock = (opts: {
  empresa?: typeof empresaBase | null;
  empleados?: unknown[];
  marcajes?: unknown[];
  reglas?: unknown[];
}) => ({
  empresa: { findUnique: jest.fn().mockResolvedValue('empresa' in opts ? opts.empresa : empresaBase) },
  empleado: {
    findUnique: jest.fn().mockResolvedValue({ empresaId: 'empresa-1' }),
    findMany: jest.fn().mockResolvedValue(opts.empleados ?? []),
  },
  marcaje: { findMany: jest.fn().mockResolvedValue(opts.marcajes ?? []) },
  reglaRecargo: { findMany: jest.fn().mockResolvedValue(opts.reglas ?? []) },
});

const queryBase = { desde: '2026-09-01', hasta: '2026-09-15' };

describe('ReportesService.generarReporteHoras', () => {
  it('lanza 404 si la empresa no existe', async () => {
    const prisma = crearPrismaMock({ empresa: null });
    const servicio = new ReportesService(prisma as any);

    await expect(servicio.generarReporteHoras(usuarioAdminEmpresa, queryBase)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rechaza un rango donde "hasta" es anterior a "desde"', async () => {
    const prisma = crearPrismaMock({});
    const servicio = new ReportesService(prisma as any);

    await expect(
      servicio.generarReporteHoras(usuarioAdminEmpresa, { desde: '2026-09-15', hasta: '2026-09-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calcula horas y pago base por empleado, sin reglas de recargo', async () => {
    const prisma = crearPrismaMock({
      empleados: [empleadoConSalario, empleadoSinSalario],
      marcajes: [
        { empleadoId: 'emp-1', tipo: TipoMarcaje.ENTRADA, marcadoEn: new Date('2026-09-01T14:00:00Z') },
        { empleadoId: 'emp-1', tipo: TipoMarcaje.SALIDA, marcadoEn: new Date('2026-09-01T22:00:00Z') },
        { empleadoId: 'emp-2', tipo: TipoMarcaje.ENTRADA, marcadoEn: new Date('2026-09-01T14:00:00Z') },
        { empleadoId: 'emp-2', tipo: TipoMarcaje.SALIDA, marcadoEn: new Date('2026-09-01T20:00:00Z') },
      ],
    });
    const servicio = new ReportesService(prisma as any);

    const reporte = await servicio.generarReporteHoras(usuarioAdminEmpresa, queryBase);

    expect(reporte.empresa).toEqual({ id: 'empresa-1', nombre: 'Pizzería El Sol' });

    const filaConSalario = reporte.empleados.find((e) => e.empleadoId === 'emp-1')!;
    expect(filaConSalario.horas).toBeCloseTo(8);
    expect(filaConSalario.salarioBase).toBe(12000);
    expect(filaConSalario.tarifaHoraBase).toBeCloseTo(50); // 12000 / 240
    expect(filaConSalario.pagoBase).toBeCloseTo(400); // 8h × L50
    expect(filaConSalario.desglose).toEqual([]);
    expect(filaConSalario.pago).toBeCloseTo(400);

    const filaSinSalario = reporte.empleados.find((e) => e.empleadoId === 'emp-2')!;
    expect(filaSinSalario.horas).toBeCloseTo(6);
    expect(filaSinSalario.salarioBase).toBeNull();
    expect(filaSinSalario.pago).toBeNull();

    expect(reporte.totales.horas).toBeCloseTo(14);
    // Solo emp-1 tiene salario: el total de pago solo cuenta lo que sí se puede calcular
    expect(reporte.totales.pago).toBeCloseTo(400);
  });

  it('aplica el recargo de una regla activa a las horas dentro de su franja', async () => {
    const prisma = crearPrismaMock({
      empleados: [empleadoConSalario],
      // 18:00–22:00 hora local (America/Tegucigalpa, UTC-6): 2h diurnas + 2h nocturnas
      marcajes: [
        { empleadoId: 'emp-1', tipo: TipoMarcaje.ENTRADA, marcadoEn: new Date('2026-09-02T00:00:00Z') },
        { empleadoId: 'emp-1', tipo: TipoMarcaje.SALIDA, marcadoEn: new Date('2026-09-02T04:00:00Z') },
      ],
      reglas: [reglaNocturnidad],
    });
    const servicio = new ReportesService(prisma as any);

    const reporte = await servicio.generarReporteHoras(usuarioAdminEmpresa, queryBase);
    const fila = reporte.empleados[0];

    expect(fila.horas).toBeCloseTo(4);
    expect(fila.tarifaHoraBase).toBeCloseTo(50);
    expect(fila.pagoBase).toBeCloseTo(200); // 4h × L50, sin recargo todavía
    expect(fila.desglose).toEqual([
      { reglaId: 'r-noct', nombre: 'Nocturnidad', porcentaje: 25, horas: 2, monto: 25 }, // 2h × L50 × 25%
    ]);
    expect(fila.pago).toBeCloseTo(225); // 200 (base) + 25 (recargo)
  });

  it('el total de pago es null si ningún empleado del reporte tiene salario definido', async () => {
    const prisma = crearPrismaMock({ empleados: [empleadoSinSalario], marcajes: [] });
    const servicio = new ReportesService(prisma as any);

    const reporte = await servicio.generarReporteHoras(usuarioAdminEmpresa, queryBase);

    expect(reporte.totales.horas).toBe(0);
    expect(reporte.totales.pago).toBeNull();
  });

  it('lanza 404 si empleadoId pertenece a otra empresa', async () => {
    const prisma = crearPrismaMock({});
    prisma.empleado.findUnique.mockResolvedValue({ empresaId: 'otra-empresa' });
    const servicio = new ReportesService(prisma as any);

    await expect(
      servicio.generarReporteHoras(usuarioAdminEmpresa, { ...queryBase, empleadoId: 'emp-de-otra-empresa' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
