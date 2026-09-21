import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { paginar, saltar } from '../common/dto/pagination.dto';
import { empresaRequerida, filtroEmpresa } from '../common/utils/tenant';
import {
  CreateEmpleadoDto,
  ListarEmpleadosDto,
  UpdateEmpleadoDto,
} from './dto/empleado.dto';
import { esPinDebil, generarPin } from './pin.util';

const COSTO_HASH_PIN = 10;

// Nunca se expone pinHash ni el contador de intentos
const SELECT_EMPLEADO = {
  id: true,
  empresaId: true,
  codigo: true,
  nombre: true,
  apellido: true,
  identidad: true,
  cargo: true,
  activo: true,
  bloqueadoHasta: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.EmpleadoSelect;

@Injectable()
export class EmpleadosService {
  constructor(private readonly prisma: PrismaService) {}

  private validarPin(pin: string) {
    if (esPinDebil(pin)) {
      throw new BadRequestException('PIN demasiado simple (evite 1234, 0000, 4321, etc.)');
    }
  }

  // Código correlativo por empresa (0001, 0002...) saltando los ya usados
  private async generarCodigo(empresaId: string): Promise<string> {
    for (let intento = 0; intento < 10; intento++) {
      const { siguienteCodigo } = await this.prisma.empresa.update({
        where: { id: empresaId },
        data: { siguienteCodigo: { increment: 1 } },
        select: { siguienteCodigo: true },
      });
      const codigo = String(siguienteCodigo - 1).padStart(4, '0');
      const existente = await this.prisma.empleado.findUnique({
        where: { empresaId_codigo: { empresaId, codigo } },
        select: { id: true },
      });
      if (!existente) return codigo;
    }
    throw new ConflictException('No se pudo generar un código de empleado, intente de nuevo');
  }

  async listar(usuario: UsuarioAutenticado, query: ListarEmpleadosDto) {
    const empresaId = filtroEmpresa(usuario, query.empresaId);
    const where: Prisma.EmpleadoWhereInput = {
      ...(empresaId && { empresaId }),
      ...(query.activo !== undefined && { activo: query.activo }),
      ...(query.search && {
        OR: [
          { nombre: { contains: query.search, mode: 'insensitive' } },
          { apellido: { contains: query.search, mode: 'insensitive' } },
          { codigo: { contains: query.search, mode: 'insensitive' } },
          { identidad: { contains: query.search } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.empleado.findMany({
        where,
        select: SELECT_EMPLEADO,
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
        skip: saltar(query),
        take: query.limit,
      }),
      this.prisma.empleado.count({ where }),
    ]);

    return paginar(data, total, query);
  }

  async obtener(usuario: UsuarioAutenticado, id: string) {
    const empleado = await this.prisma.empleado.findUnique({
      where: { id },
      select: SELECT_EMPLEADO,
    });
    if (!empleado) throw new NotFoundException('Empleado no encontrado');
    filtroEmpresa(usuario, empleado.empresaId); // lanza 403 si es de otra empresa
    return empleado;
  }

  async crear(usuario: UsuarioAutenticado, dto: CreateEmpleadoDto) {
    const empresaId = empresaRequerida(usuario, dto.empresaId);

    const empresa = await this.prisma.empresa.findUnique({
      where: { id: empresaId },
      select: { activa: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    if (!empresa.activa) throw new BadRequestException('La empresa está desactivada');

    if (dto.pin) this.validarPin(dto.pin);
    const pin = dto.pin ?? generarPin();
    const codigo = dto.codigo ?? (await this.generarCodigo(empresaId));

    const empleado = await this.prisma.empleado.create({
      data: {
        empresaId,
        codigo,
        pinHash: await bcrypt.hash(pin, COSTO_HASH_PIN),
        nombre: dto.nombre,
        apellido: dto.apellido,
        identidad: dto.identidad,
        cargo: dto.cargo,
      },
      select: SELECT_EMPLEADO,
    });

    return { empleado, pin };
  }

  async actualizar(usuario: UsuarioAutenticado, id: string, dto: UpdateEmpleadoDto) {
    await this.obtener(usuario, id);
    return this.prisma.empleado.update({
      where: { id },
      data: dto,
      select: SELECT_EMPLEADO,
    });
  }

  // También desbloquea al empleado si estaba bloqueado por intentos fallidos
  async restablecerPin(usuario: UsuarioAutenticado, id: string, pinSolicitado?: string) {
    await this.obtener(usuario, id);

    if (pinSolicitado) this.validarPin(pinSolicitado);
    const pin = pinSolicitado ?? generarPin();

    await this.prisma.empleado.update({
      where: { id },
      data: {
        pinHash: await bcrypt.hash(pin, COSTO_HASH_PIN),
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    });

    return { pin };
  }
}
