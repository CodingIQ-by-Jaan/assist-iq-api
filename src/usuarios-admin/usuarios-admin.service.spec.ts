import { ConflictException, NotFoundException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { UsuariosAdminService } from './usuarios-admin.service';

const usuarioAdminExistente = {
  id: 'ua-1',
  email: 'admin@pizzeria.com',
  nombre: 'Ana Martínez',
  rol: Rol.ADMIN_EMPRESA,
  empresaId: 'empresa-1',
  activo: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const crearPrismaMock = (opciones: {
  empresa?: { activa: boolean } | null;
  usuarioExistente?: unknown;
} = {}) => ({
  empresa: {
    findUnique: jest.fn().mockResolvedValue(opciones.empresa ?? { activa: true }),
  },
  usuarioAdmin: {
    findUnique: jest.fn().mockResolvedValue(opciones.usuarioExistente ?? null),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'nuevo', ...data })),
    update: jest.fn().mockResolvedValue(usuarioAdminExistente),
  },
});

const dtoBase = {
  empresaId: 'empresa-1',
  email: 'nuevo-admin@pizzeria.com',
  nombre: 'Carlos Ruiz',
};

describe('UsuariosAdminService', () => {
  it('crea el administrador con una contraseña generada cuando no se indica una', async () => {
    const prisma = crearPrismaMock();
    const servicio = new UsuariosAdminService(prisma as any);

    const resultado = await servicio.crear(dtoBase);

    expect(resultado.password).toBeTruthy();
    expect(resultado.usuario.rol).toBe(Rol.ADMIN_EMPRESA);
    expect(prisma.usuarioAdmin.create).toHaveBeenCalled();
  });

  it('rechaza crear un administrador con un correo ya usado', async () => {
    const prisma = crearPrismaMock({ usuarioExistente: usuarioAdminExistente });
    const servicio = new UsuariosAdminService(prisma as any);

    await expect(servicio.crear(dtoBase)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.usuarioAdmin.create).not.toHaveBeenCalled();
  });

  it('rechaza crear un administrador para una empresa desactivada', async () => {
    const prisma = crearPrismaMock({ empresa: { activa: false } });
    const servicio = new UsuariosAdminService(prisma as any);

    await expect(servicio.crear(dtoBase)).rejects.toThrow('La empresa está desactivada');
  });

  it('restablecerPassword revoca las sesiones activas (tokenVersion++)', async () => {
    const prisma = crearPrismaMock();
    prisma.usuarioAdmin.findUnique.mockResolvedValue(usuarioAdminExistente);
    const servicio = new UsuariosAdminService(prisma as any);

    const resultado = await servicio.restablecerPassword('ua-1');

    expect(resultado.password).toBeTruthy();
    expect(prisma.usuarioAdmin.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ua-1' },
        data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
      }),
    );
  });

  it('restablecerPassword falla si el usuario no existe o no es ADMIN_EMPRESA', async () => {
    const prisma = crearPrismaMock();
    prisma.usuarioAdmin.findUnique.mockResolvedValue(null);
    const servicio = new UsuariosAdminService(prisma as any);

    await expect(servicio.restablecerPassword('inexistente')).rejects.toBeInstanceOf(NotFoundException);
  });
});
