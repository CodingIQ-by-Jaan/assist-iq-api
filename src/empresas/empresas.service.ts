import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Rol } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { paginar, saltar } from '../common/dto/pagination.dto';
import { slugify } from '../common/utils/transforms';
import { CreateEmpresaDto, ListarEmpresasDto, UpdateEmpresaDto } from './dto/empresa.dto';

@Injectable()
export class EmpresasService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuario: UsuarioAutenticado, query: ListarEmpresasDto) {
    const where: Prisma.EmpresaWhereInput = {
      // ADMIN_EMPRESA solo ve su propia empresa
      ...(usuario.rol === Rol.ADMIN_EMPRESA && { id: usuario.empresaId as string }),
      ...(query.activa !== undefined && { activa: query.activa }),
      ...(query.search && {
        OR: [
          { nombre: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.empresa.findMany({
        where,
        orderBy: { nombre: 'asc' },
        skip: saltar(query),
        take: query.limit,
      }),
      this.prisma.empresa.count({ where }),
    ]);

    return paginar(data, total, query);
  }

  async obtener(usuario: UsuarioAutenticado, id: string) {
    if (usuario.rol === Rol.ADMIN_EMPRESA && usuario.empresaId !== id) {
      throw new ForbiddenException('No tiene acceso a esa empresa');
    }
    const empresa = await this.prisma.empresa.findUnique({ where: { id } });
    if (!empresa) throw new NotFoundException('Empresa no encontrada');
    return empresa;
  }

  crear(dto: CreateEmpresaDto) {
    return this.prisma.empresa.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug ?? slugify(dto.nombre),
        rtn: dto.rtn,
        zonaHoraria: dto.zonaHoraria,
        limiteEmpleados: dto.limiteEmpleados,
      },
    });
  }

  async actualizar(id: string, dto: UpdateEmpresaDto) {
    await this.prisma.empresa.findUniqueOrThrow({ where: { id } });
    return this.prisma.empresa.update({ where: { id }, data: dto });
  }
}
