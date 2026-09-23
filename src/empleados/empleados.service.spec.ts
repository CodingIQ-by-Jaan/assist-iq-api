import { ConflictException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { EmpleadosService } from './empleados.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

const usuarioSuperAdmin: UsuarioAutenticado = {
  id: 'u-1',
  email: 'admin@codingiq.com',
  nombre: 'Admin',
  rol: Rol.SUPER_ADMIN,
  empresaId: null,
};

const dtoBase = {
  empresaId: 'empresa-1',
  codigo: '0007',
  pin: '4827',
  nombre: 'María',
  apellido: 'López',
};

const crearPrismaMock = (empresa: { activa: boolean; limiteEmpleados: number | null }, activos: number) => ({
  empresa: { findUnique: jest.fn().mockResolvedValue(empresa) },
  empleado: {
    count: jest.fn().mockResolvedValue(activos),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'nuevo', ...data })),
  },
});

describe('EmpleadosService - límite de empleados por empresa', () => {
  it('bloquea la creación cuando ya se alcanzó el límite', async () => {
    const prisma = crearPrismaMock({ activa: true, limiteEmpleados: 2 }, 2);
    const servicio = new EmpleadosService(prisma as any);

    await expect(servicio.crear(usuarioSuperAdmin, dtoBase)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.empleado.create).not.toHaveBeenCalled();
  });

  it('permite crear cuando todavía hay cupo disponible', async () => {
    const prisma = crearPrismaMock({ activa: true, limiteEmpleados: 5 }, 2);
    const servicio = new EmpleadosService(prisma as any);

    await expect(servicio.crear(usuarioSuperAdmin, dtoBase)).resolves.toMatchObject({ pin: '4827' });
    expect(prisma.empleado.create).toHaveBeenCalled();
  });

  it('no aplica ningún límite cuando la empresa no tiene uno configurado', async () => {
    const prisma = crearPrismaMock({ activa: true, limiteEmpleados: null }, 999);
    const servicio = new EmpleadosService(prisma as any);

    await expect(servicio.crear(usuarioSuperAdmin, dtoBase)).resolves.toMatchObject({ pin: '4827' });
    expect(prisma.empleado.count).not.toHaveBeenCalled();
    expect(prisma.empleado.create).toHaveBeenCalled();
  });
});
