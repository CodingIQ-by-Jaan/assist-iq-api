import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TipoMarcaje } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { PaginationDto, PaginationMetaDto } from '../../common/dto/pagination.dto';
import { FORMATO_PIN } from '../../empleados/pin.util';

const normalizarCodigo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// ---------- Kiosco (público) ----------

export class CredencialesKioscoDto {
  @ApiProperty({ example: '0007' })
  @Transform(normalizarCodigo)
  @Matches(/^[A-Z0-9]{2,10}$/, { message: 'Código inválido' })
  codigo: string;

  @ApiProperty({ example: '4827' })
  @Matches(FORMATO_PIN, { message: 'PIN inválido' })
  pin: string;
}

export class MarcarDto extends CredencialesKioscoDto {
  @ApiProperty({ enum: TipoMarcaje, enumName: 'TipoMarcaje' })
  @IsEnum(TipoMarcaje)
  tipo: TipoMarcaje;
}

class EmpleadoKioscoDto {
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() apellido: string;
}

class UltimoMarcajeDto {
  @ApiProperty({ enum: TipoMarcaje, enumName: 'TipoMarcaje' }) tipo: TipoMarcaje;
  @ApiProperty() marcadoEn: Date;
}

export class EstadoKioscoDto {
  @ApiProperty({ type: EmpleadoKioscoDto }) empleado: EmpleadoKioscoDto;

  @ApiProperty({ type: UltimoMarcajeDto, nullable: true })
  ultimoMarcaje: UltimoMarcajeDto | null;

  @ApiProperty({
    enum: TipoMarcaje,
    enumName: 'TipoMarcaje',
    isArray: true,
    description: 'Marcajes que el empleado puede registrar ahora (para mostrar solo esos botones)',
  })
  permitidos: TipoMarcaje[];
}

export class MarcarRespuestaDto {
  @ApiProperty({ enum: TipoMarcaje, enumName: 'TipoMarcaje' }) tipo: TipoMarcaje;
  @ApiProperty({ description: 'Hora del servidor (UTC, ISO 8601)' }) marcadoEn: Date;
  @ApiProperty({ type: EmpleadoKioscoDto }) empleado: EmpleadoKioscoDto;
  @ApiProperty({ enum: TipoMarcaje, enumName: 'TipoMarcaje', isArray: true })
  permitidos: TipoMarcaje[];
}

// ---------- Administración ----------

export class ListarMarcajesDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'SUPER_ADMIN: filtra por empresa' })
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiPropertyOptional({ enum: TipoMarcaje, enumName: 'TipoMarcaje' })
  @IsOptional()
  @IsEnum(TipoMarcaje)
  tipo?: TipoMarcaje;

  @ApiPropertyOptional({ description: 'Inicio del rango (ISO 8601, inclusivo)' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ description: 'Fin del rango (ISO 8601, exclusivo)' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}

class EmpleadoResumenDto {
  @ApiProperty() id: string;
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() apellido: string;
}

export class MarcajeDto {
  @ApiProperty() id: string;
  @ApiProperty() empresaId: string;
  @ApiProperty() empleadoId: string;
  @ApiProperty({ enum: TipoMarcaje, enumName: 'TipoMarcaje' }) tipo: TipoMarcaje;
  @ApiProperty({ description: 'Hora del servidor (UTC, ISO 8601)' }) marcadoEn: Date;
  @ApiProperty({ type: EmpleadoResumenDto }) empleado: EmpleadoResumenDto;
}

export class MarcajesPaginadosDto {
  @ApiProperty({ type: [MarcajeDto] }) data: MarcajeDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}
