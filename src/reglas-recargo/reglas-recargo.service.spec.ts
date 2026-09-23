import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { ReglasRecargoService } from './reglas-recargo.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

const usuarioAdminEmpresa: UsuarioAutenticado = {
  id: 'u-1',
  email: 'admin@empresa.com',
  nombre: 'Admin',
  rol: Rol.ADMIN_EMPRESA,
  empresaId: 'empresa-1',
};

const reglaExistente = {
  id: 'r-1',
  empresaId: 'empresa-1',
  nombre: 'Nocturnidad',
  horaInicio: '20:00',
  horaFin: '04:00',
  porcentaje: { toString: () => '25' } as unknown as number,
  activa: true,
};

const crearPrismaMock = (opts: { activas?: unknown[]; existente?: unknown } = {}) => ({
  reglaRecargo: {
    // Simula el filtro `id: { not: ignorarId } }` que aplicaría Postgres, para que las pruebas
    // de "actualizar" verifiquen de verdad que la regla se excluye a sí misma al validar solapamiento.
    findMany: jest.fn().mockImplementation((args: { where?: { id?: { not?: string } } } = {}) => {
      const activas = (opts.activas ?? []) as { id: string }[];
      const excluirId = args.where?.id?.not;
      return Promise.resolve(excluirId ? activas.filter((r) => r.id !== excluirId) : activas);
    }),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'nueva', activa: true, ...data })),
    // 'existente' in opts distingue "no se pasó" (usar reglaExistente por defecto) de "se pasó null"
    // (regla inexistente) — con ?? ambos casos colapsarían al mismo resultado.
    findUnique: jest.fn().mockResolvedValue('existente' in opts ? opts.existente : reglaExistente),
    update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...reglaExistente, ...data })),
  },
});

const dtoBase = { nombre: 'Fin de semana', horaInicio: '00:00', horaFin: '06:00', porcentaje: 10 };

describe('ReglasRecargoService.crear', () => {
  it('rechaza cuando horaInicio y horaFin son iguales', async () => {
    const prisma = crearPrismaMock();
    const servicio = new ReglasRecargoService(prisma as any);

    await expect(
      servicio.crear(usuarioAdminEmpresa, { ...dtoBase, horaInicio: '08:00', horaFin: '08:00' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.reglaRecargo.create).not.toHaveBeenCalled();
  });

  it('rechaza cuando la banda se solapa con una regla activa existente', async () => {
    const prisma = crearPrismaMock({ activas: [reglaExistente] }); // 20:00–04:00
    const servicio = new ReglasRecargoService(prisma as any);

    await expect(
      servicio.crear(usuarioAdminEmpresa, { ...dtoBase, horaInicio: '02:00', horaFin: '10:00' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.reglaRecargo.create).not.toHaveBeenCalled();
  });

  it('crea la regla cuando no hay solapamiento, forzando la empresa del usuario', async () => {
    const prisma = crearPrismaMock({ activas: [reglaExistente] }); // 20:00–04:00
    const servicio = new ReglasRecargoService(prisma as any);

    // 10:00–14:00 es puramente diurno: no se solapa con la nocturnidad existente (20:00–04:00)
    const resultado = await servicio.crear(usuarioAdminEmpresa, { ...dtoBase, horaInicio: '10:00', horaFin: '14:00' });

    expect(prisma.reglaRecargo.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ empresaId: 'empresa-1' }) }),
    );
    expect(resultado.porcentaje).toBe(10);
  });
});

describe('ReglasRecargoService.actualizar', () => {
  it('lanza 404 si la regla no existe', async () => {
    const prisma = crearPrismaMock({ existente: null });
    const servicio = new ReglasRecargoService(prisma as any);

    await expect(servicio.actualizar(usuarioAdminEmpresa, 'r-1', { nombre: 'X' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lanza 403 si la regla pertenece a otra empresa', async () => {
    const prisma = crearPrismaMock({ existente: { ...reglaExistente, empresaId: 'otra-empresa' } });
    const servicio = new ReglasRecargoService(prisma as any);

    await expect(servicio.actualizar(usuarioAdminEmpresa, 'r-1', { nombre: 'X' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('no valida solapamiento si la regla se está desactivando', async () => {
    const prisma = crearPrismaMock({ activas: [reglaExistente] });
    const servicio = new ReglasRecargoService(prisma as any);

    await expect(servicio.actualizar(usuarioAdminEmpresa, 'r-1', { activa: false })).resolves.toBeDefined();
  });

  it('ignora la propia regla al validar solapamiento (editar sus horas no choca consigo misma)', async () => {
    const prisma = crearPrismaMock({ activas: [reglaExistente] });
    const servicio = new ReglasRecargoService(prisma as any);

    await expect(
      servicio.actualizar(usuarioAdminEmpresa, 'r-1', { horaInicio: '21:00', horaFin: '05:00' }),
    ).resolves.toBeDefined();
    expect(prisma.reglaRecargo.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: 'r-1' } }) }),
    );
  });
});
