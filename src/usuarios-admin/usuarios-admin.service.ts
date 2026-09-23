import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { paginar, saltar } from '../common/dto/pagination.dto';
import { generarPassword } from './password.util';
import {
  CreateUsuarioAdminDto,
  ListarUsuariosAdminDto,
  UpdateUsuarioAdminDto,
} from './dto/usuario-admin.dto';

const COSTO_HASH_PASSWORD = 12;

// Nunca se expone passwordHash ni tokenVersion
const SELECT_USUARIO_ADMIN = {
  id: true,
  email: true,
  nombre: true,
  rol: true,
  empresaId: true,
  activo: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UsuarioAdminSelect;

// Este módulo solo administra cuentas ADMIN_EMPRESA (una por cada empresa, o varias si se necesita);
// la gestión de cuentas SUPER_ADMIN queda fuera de alcance (se maneja por script/seed).
@Injectable()
export class UsuariosAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarUsuariosAdminDto) {
    const where: Prisma.UsuarioAdminWhereInput = {
      rol: Rol.ADMIN_EMPRESA,
      ...(query.empresaId && { empresaId: query.empresaId }),
      ...(query.search && {
        OR: [
          { nombre: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.usuarioAdmin.findMany({
        where,
        select: SELECT_USUARIO_ADMIN,
        orderBy: { nombre: 'asc' },
        skip: saltar(query),
        take: query.limit,
      }),
      this.prisma.usuarioAdmin.count({ where }),
    ]);

    return paginar(data, total, query);
  }

  async crear(dto: CreateUsuarioAdminDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: dto.empresaId },
      select: { activa: true },
    });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    if (!empresa.activa) throw new BadRequestException('La empresa está desactivada');

    const existente = await this.prisma.usuarioAdmin.findUnique({ where: { email: dto.email } });
    if (existente) throw new ConflictException('Ya existe un usuario con ese correo');

    const password = dto.password ?? generarPassword();

    const usuario = await this.prisma.usuarioAdmin.create({
      data: {
        email: dto.email,
        nombre: dto.nombre,
        passwordHash: await bcrypt.hash(password, COSTO_HASH_PASSWORD),
        rol: Rol.ADMIN_EMPRESA,
        empresaId: dto.empresaId,
      },
      select: SELECT_USUARIO_ADMIN,
    });

    return { usuario, password };
  }

  private async obtenerAdminEmpresa(id: string) {
    const usuario = await this.prisma.usuarioAdmin.findUnique({
      where: { id },
      select: SELECT_USUARIO_ADMIN,
    });
    if (!usuario || usuario.rol !== Rol.ADMIN_EMPRESA) {
      throw new NotFoundException('Usuario administrador no encontrado');
    }
    return usuario;
  }

  async actualizar(id: string, dto: UpdateUsuarioAdminDto) {
    await this.obtenerAdminEmpresa(id);
    return this.prisma.usuarioAdmin.update({
      where: { id },
      data: dto,
      select: SELECT_USUARIO_ADMIN,
    });
  }

  // También revoca las sesiones activas del usuario (tokenVersion++), igual que el reset-pin de empleados
  async restablecerPassword(id: string, passwordSolicitada?: string) {
    await this.obtenerAdminEmpresa(id);

    const password = passwordSolicitada ?? generarPassword();

    await this.prisma.usuarioAdmin.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(password, COSTO_HASH_PASSWORD),
        tokenVersion: { increment: 1 },
      },
    });

    return { password };
  }
}
