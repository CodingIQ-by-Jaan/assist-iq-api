import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { paginar, saltar } from '../common/dto/pagination.dto';
import { filtroEmpresa } from '../common/utils/tenant';
import { CredencialesKioscoDto, ListarMarcajesDto, MarcarDto } from './dto/marcaje.dto';
import {
  ETIQUETAS,
  esMarcajeDuplicado,
  marcajesPermitidos,
} from './secuencia';

export const MAX_INTENTOS_PIN = 5;
export const MINUTOS_BLOQUEO = 15;

// Hash de relleno para igualar tiempos cuando el código no existe (evita enumerar empleados)
const HASH_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

export interface MetaPeticion {
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class MarcajesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Kiosco ----------

  async infoKiosco(slug: string) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { slug },
      select: { nombre: true, slug: true, activa: true },
    });
    if (!empresa || !empresa.activa) throw new NotFoundException('Kiosco no encontrado');
    return { nombre: empresa.nombre, slug: empresa.slug };
  }

  private async registrarFallo(empleadoId: string) {
    const { intentosFallidos } = await this.prisma.empleado.update({
      where: { id: empleadoId },
      data: { intentosFallidos: { increment: 1 } },
      select: { intentosFallidos: true },
    });

    if (intentosFallidos >= MAX_INTENTOS_PIN) {
      await this.prisma.empleado.update({
        where: { id: empleadoId },
        data: {
          intentosFallidos: 0,
          bloqueadoHasta: new Date(Date.now() + MINUTOS_BLOQUEO * 60_000),
        },
      });
    }
  }

  // Valida empresa + código + PIN. Mismo error para "no existe" y "PIN incorrecto".
  private async autenticar(slug: string, { codigo, pin }: CredencialesKioscoDto) {
    const empresa = await this.prisma.empresa.findUnique({
      where: { slug },
      select: { id: true, activa: true },
    });
    const empleado =
      empresa && empresa.activa
        ? await this.prisma.empleado.findUnique({
            where: { empresaId_codigo: { empresaId: empresa.id, codigo } },
          })
        : null;

    const ahora = new Date();
    if (empleado?.bloqueadoHasta && empleado.bloqueadoHasta > ahora) {
      const minutos = Math.ceil((empleado.bloqueadoHasta.getTime() - ahora.getTime()) / 60_000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: `Demasiados intentos fallidos. Intente de nuevo en ${minutos} minuto(s) o pida a su administrador restablecer el PIN.`,
          error: 'Too Many Requests',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const pinValido = await bcrypt.compare(pin, empleado?.pinHash ?? HASH_RELLENO);
    if (!empresa || !empleado || !empleado.activo || !pinValido) {
      if (empleado?.activo) await this.registrarFallo(empleado.id);
      throw new UnauthorizedException('Código o PIN incorrecto');
    }

    if (empleado.intentosFallidos > 0 || empleado.bloqueadoHasta) {
      await this.prisma.empleado.update({
        where: { id: empleado.id },
        data: { intentosFallidos: 0, bloqueadoHasta: null },
      });
    }

    return { empresaId: empresa.id, empleado };
  }

  async estado(slug: string, credenciales: CredencialesKioscoDto) {
    const { empleado } = await this.autenticar(slug, credenciales);

    const ultimoMarcaje = await this.prisma.marcaje.findFirst({
      where: { empleadoId: empleado.id },
      orderBy: { marcadoEn: 'desc' },
      select: { tipo: true, marcadoEn: true },
    });

    return {
      empleado: { codigo: empleado.codigo, nombre: empleado.nombre, apellido: empleado.apellido },
      ultimoMarcaje,
      permitidos: marcajesPermitidos(ultimoMarcaje, new Date()),
    };
  }

  async marcar(slug: string, dto: MarcarDto, meta: MetaPeticion) {
    const { empresaId, empleado } = await this.autenticar(slug, dto);

    return this.prisma.$transaction(async (tx) => {
      // Serializa marcajes simultáneos del mismo empleado (doble clic, dos kioscos)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${empleado.id}::text))`;

      const ultimo = await tx.marcaje.findFirst({
        where: { empleadoId: empleado.id },
        orderBy: { marcadoEn: 'desc' },
        select: { tipo: true, marcadoEn: true },
      });

      // La hora la fija siempre el servidor
      const ahora = new Date();

      if (esMarcajeDuplicado(ultimo, ahora)) {
        throw new ConflictException('Ya registró un marcaje hace un momento. Espere un minuto.');
      }

      const permitidos = marcajesPermitidos(ultimo, ahora);
      if (!permitidos.includes(dto.tipo)) {
        throw new ConflictException(
          `No puede registrar "${ETIQUETAS[dto.tipo]}" ahora. Marcajes permitidos: ${permitidos
            .map((tipo) => ETIQUETAS[tipo])
            .join(' o ')}.`,
        );
      }

      const marcaje = await tx.marcaje.create({
        data: {
          empresaId,
          empleadoId: empleado.id,
          tipo: dto.tipo,
          marcadoEn: ahora,
          ip: meta.ip,
          userAgent: meta.userAgent?.slice(0, 300),
        },
        select: { tipo: true, marcadoEn: true },
      });

      return {
        tipo: marcaje.tipo,
        marcadoEn: marcaje.marcadoEn,
        empleado: { codigo: empleado.codigo, nombre: empleado.nombre, apellido: empleado.apellido },
        permitidos: marcajesPermitidos(marcaje, ahora),
      };
    });
  }

  // ---------- Administración ----------

  async listar(usuario: UsuarioAutenticado, query: ListarMarcajesDto) {
    const empresaId = filtroEmpresa(usuario, query.empresaId);

    const where: Prisma.MarcajeWhereInput = {
      ...(empresaId && { empresaId }),
      ...(query.empleadoId && { empleadoId: query.empleadoId }),
      ...(query.tipo && { tipo: query.tipo }),
      ...((query.desde || query.hasta) && {
        marcadoEn: {
          ...(query.desde && { gte: new Date(query.desde) }),
          ...(query.hasta && { lt: new Date(query.hasta) }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.marcaje.findMany({
        where,
        select: {
          id: true,
          empresaId: true,
          empleadoId: true,
          tipo: true,
          marcadoEn: true,
          empleado: { select: { id: true, codigo: true, nombre: true, apellido: true } },
        },
        orderBy: { marcadoEn: 'desc' },
        skip: saltar(query),
        take: query.limit,
      }),
      this.prisma.marcaje.count({ where }),
    ]);

    return paginar(data, total, query);
  }
}
