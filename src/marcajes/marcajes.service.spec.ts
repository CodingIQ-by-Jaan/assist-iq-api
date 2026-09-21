import { ConflictException, HttpException, UnauthorizedException } from '@nestjs/common';
import { TipoMarcaje } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { MarcajesService, MAX_INTENTOS_PIN } from './marcajes.service';

const { ENTRADA, INICIO_ALMUERZO, SALIDA } = TipoMarcaje;

const crearEmpleado = (extra: Record<string, unknown> = {}) => ({
  id: 'emp-1',
  empresaId: 'empresa-1',
  codigo: '0001',
  nombre: 'María',
  apellido: 'López',
  activo: true,
  pinHash: bcrypt.hashSync('4827', 4),
  intentosFallidos: 0,
  bloqueadoHasta: null as Date | null,
  ...extra,
});

const crearPrismaMock = (empleado: ReturnType<typeof crearEmpleado> | null) => {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    marcaje: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
    },
  };
  const prisma = {
    empresa: { findUnique: jest.fn().mockResolvedValue({ id: 'empresa-1', activa: true }) },
    empleado: {
      findUnique: jest.fn().mockResolvedValue(empleado),
      update: jest.fn().mockResolvedValue({ intentosFallidos: 1 }),
    },
    marcaje: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
  };
  return { prisma, tx };
};

// Devuelve el error lanzado; falla si la promesa se resuelve sin error
const capturar = async (promesa: Promise<unknown>): Promise<any> => {
  try {
    await promesa;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la operación lanzara un error');
};

const crearServicio = (empleado: ReturnType<typeof crearEmpleado> | null) => {
  const mocks = crearPrismaMock(empleado);
  return { servicio: new MarcajesService(mocks.prisma as any), ...mocks };
};

describe('MarcajesService - autenticación por PIN', () => {
  it('rechaza PIN incorrecto y cuenta el intento fallido', async () => {
    const { servicio, prisma } = crearServicio(crearEmpleado());
    await expect(servicio.estado('demo', { codigo: '0001', pin: '9999' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(prisma.empleado.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { intentosFallidos: { increment: 1 } } }),
    );
  });

  it('código inexistente responde igual que PIN incorrecto (no revela si existe)', async () => {
    const { servicio, prisma } = crearServicio(null);
    const error = await capturar(servicio.estado('demo', { codigo: '9999', pin: '4827' }));
    expect(error).toBeInstanceOf(UnauthorizedException);
    expect(error.message).toBe('Código o PIN incorrecto');
    expect(prisma.empleado.update).not.toHaveBeenCalled();
  });

  it('bloquea al alcanzar el máximo de intentos', async () => {
    const { servicio, prisma } = crearServicio(crearEmpleado());
    prisma.empleado.update.mockResolvedValueOnce({ intentosFallidos: MAX_INTENTOS_PIN });

    await expect(servicio.estado('demo', { codigo: '0001', pin: '9999' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const llamadaBloqueo = prisma.empleado.update.mock.calls[1][0];
    expect(llamadaBloqueo.data.intentosFallidos).toBe(0);
    expect(llamadaBloqueo.data.bloqueadoHasta.getTime()).toBeGreaterThan(Date.now());
  });

  it('un empleado bloqueado recibe 429 aun con el PIN correcto', async () => {
    const bloqueado = crearEmpleado({ bloqueadoHasta: new Date(Date.now() + 10 * 60_000) });
    const { servicio } = crearServicio(bloqueado);
    const error = await capturar(servicio.estado('demo', { codigo: '0001', pin: '4827' }));
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(429);
  });

  it('PIN correcto reinicia el contador de intentos', async () => {
    const { servicio, prisma } = crearServicio(crearEmpleado({ intentosFallidos: 3 }));
    await servicio.estado('demo', { codigo: '0001', pin: '4827' });
    expect(prisma.empleado.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { intentosFallidos: 0, bloqueadoHasta: null } }),
    );
  });

  it('empleado inactivo no puede marcar', async () => {
    const { servicio } = crearServicio(crearEmpleado({ activo: false }));
    await expect(servicio.estado('demo', { codigo: '0001', pin: '4827' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('MarcajesService - marcar', () => {
  const hace = (min: number) => new Date(Date.now() - min * 60_000);

  it('registra la primera ENTRADA con hora del servidor y toma el lock del empleado', async () => {
    const { servicio, tx } = crearServicio(crearEmpleado());
    const antes = Date.now();
    const resp = await servicio.marcar('demo', { codigo: '0001', pin: '4827', tipo: ENTRADA }, { ip: '1.2.3.4' });

    expect(tx.$executeRaw).toHaveBeenCalled();
    const { data } = tx.marcaje.create.mock.calls[0][0];
    expect(data.marcadoEn.getTime()).toBeGreaterThanOrEqual(antes);
    expect(data.ip).toBe('1.2.3.4');
    expect(resp.permitidos).toEqual([INICIO_ALMUERZO, SALIDA]);
  });

  it('rechaza un tipo fuera de secuencia con mensaje claro', async () => {
    const { servicio, tx } = crearServicio(crearEmpleado());
    tx.marcaje.findFirst.mockResolvedValue({ tipo: ENTRADA, marcadoEn: hace(120) });

    const error = await capturar(
      servicio.marcar('demo', { codigo: '0001', pin: '4827', tipo: TipoMarcaje.FIN_ALMUERZO }, {}),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.message).toContain('Inicio de almuerzo o Salida');
    expect(tx.marcaje.create).not.toHaveBeenCalled();
  });

  it('rechaza un segundo marcaje dentro del tiempo mínimo', async () => {
    const { servicio, tx } = crearServicio(crearEmpleado());
    tx.marcaje.findFirst.mockResolvedValue({ tipo: ENTRADA, marcadoEn: hace(0.2) });

    await expect(
      servicio.marcar('demo', { codigo: '0001', pin: '4827', tipo: SALIDA }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.marcaje.create).not.toHaveBeenCalled();
  });

  it('no escribe nada si el PIN es incorrecto', async () => {
    const { servicio, prisma } = crearServicio(crearEmpleado());
    await expect(
      servicio.marcar('demo', { codigo: '0001', pin: '0000', tipo: ENTRADA }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
