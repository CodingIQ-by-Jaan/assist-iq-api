import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ReglaRecargo } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { empresaRequerida, filtroEmpresa } from '../common/utils/tenant';
import { BandaHoraria, bandasSeSolapan } from '../common/utils/bandas-horarias';
import { CreateReglaRecargoDto, ListarReglasRecargoDto, ReglaRecargoDto, UpdateReglaRecargoDto } from './dto/regla-recargo.dto';

const serializarRegla = (regla: ReglaRecargo): ReglaRecargoDto => ({
  ...regla,
  porcentaje: Number(regla.porcentaje),
});

@Injectable()
export class ReglasRecargoService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(usuario: UsuarioAutenticado, query: ListarReglasRecargoDto): Promise<ReglaRecargoDto[]> {
    const empresaId = empresaRequerida(usuario, query.empresaId);
    const reglas = await this.prisma.reglaRecargo.findMany({
      where: { empresaId },
      orderBy: [{ horaInicio: 'asc' }],
    });
    return reglas.map(serializarRegla);
  }

  private validarHoras(horaInicio: string, horaFin: string) {
    if (horaInicio === horaFin) {
      throw new BadRequestException('horaInicio y horaFin no pueden ser iguales');
    }
  }

  // Solo las reglas activas pueden entrar en conflicto: una regla desactivada no aplica a ningún cálculo
  private async validarSolapamiento(empresaId: string, banda: BandaHoraria, ignorarId?: string) {
    const activas = await this.prisma.reglaRecargo.findMany({
      where: { empresaId, activa: true, ...(ignorarId && { id: { not: ignorarId } }) },
      select: { id: true, nombre: true, horaInicio: true, horaFin: true },
    });
    const conflicto = activas.find((regla) => bandasSeSolapan(regla, banda));
    if (conflicto) {
      throw new ConflictException(
        `Se solapa con la regla "${conflicto.nombre}" (${conflicto.horaInicio}–${conflicto.horaFin})`,
      );
    }
  }

  async crear(usuario: UsuarioAutenticado, dto: CreateReglaRecargoDto): Promise<ReglaRecargoDto> {
    const empresaId = empresaRequerida(usuario, dto.empresaId);
    this.validarHoras(dto.horaInicio, dto.horaFin);
    await this.validarSolapamiento(empresaId, dto);

    const regla = await this.prisma.reglaRecargo.create({
      data: {
        empresaId,
        nombre: dto.nombre,
        horaInicio: dto.horaInicio,
        horaFin: dto.horaFin,
        porcentaje: dto.porcentaje,
      },
    });
    return serializarRegla(regla);
  }

  private async obtener(usuario: UsuarioAutenticado, id: string): Promise<ReglaRecargo> {
    const regla = await this.prisma.reglaRecargo.findUnique({ where: { id } });
    if (!regla) throw new NotFoundException('Regla no encontrada');
    filtroEmpresa(usuario, regla.empresaId); // lanza 403 si es de otra empresa
    return regla;
  }

  async actualizar(usuario: UsuarioAutenticado, id: string, dto: UpdateReglaRecargoDto): Promise<ReglaRecargoDto> {
    const actual = await this.obtener(usuario, id);

    const horaInicio = dto.horaInicio ?? actual.horaInicio;
    const horaFin = dto.horaFin ?? actual.horaFin;
    const activa = dto.activa ?? actual.activa;
    this.validarHoras(horaInicio, horaFin);
    if (activa) {
      await this.validarSolapamiento(actual.empresaId, { horaInicio, horaFin }, id);
    }

    const regla = await this.prisma.reglaRecargo.update({ where: { id }, data: dto });
    return serializarRegla(regla);
  }
}
