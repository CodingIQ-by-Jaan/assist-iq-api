import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaginationDto, PaginationMetaDto } from '../../common/dto/pagination.dto';
import { aBooleano, recortar } from '../../common/utils/transforms';
import { FORMATO_PIN } from '../pin.util';

const normalizarCodigo = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

// Acepta 0801-1990-12345 o 0801199012345 y deja solo los 13 dígitos
const normalizarIdentidad = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\D/g, '') : value;

export class CreateEmpleadoDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Obligatorio para SUPER_ADMIN. Se ignora (y se valida) para ADMIN_EMPRESA.',
  })
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional({
    example: '0007',
    description: 'Código que el empleado escribe al marcar. Si se omite se genera uno correlativo.',
  })
  @IsOptional()
  @Transform(normalizarCodigo)
  @Matches(/^[A-Z0-9]{2,10}$/, { message: 'codigo debe tener 2 a 10 letras o números' })
  codigo?: string;

  @ApiPropertyOptional({
    example: '4827',
    description: 'PIN de 4 a 6 dígitos. Si se omite se genera uno aleatorio.',
  })
  @IsOptional()
  @Matches(FORMATO_PIN, { message: 'pin debe tener de 4 a 6 dígitos' })
  pin?: string;

  @ApiProperty({ example: 'María' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre: string;

  @ApiProperty({ example: 'López' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  apellido: string;

  @ApiPropertyOptional({ example: '0801199012345', description: 'Número de identidad (13 dígitos)' })
  @IsOptional()
  @Transform(normalizarIdentidad)
  @Matches(/^\d{13}$/, { message: 'identidad debe tener 13 dígitos' })
  identidad?: string;

  @ApiPropertyOptional({ example: 'Cajera' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(80)
  cargo?: string;
}

export class UpdateEmpleadoDto extends PartialType(OmitType(CreateEmpleadoDto, ['empresaId', 'pin'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ResetPinDto {
  @ApiPropertyOptional({ example: '4827', description: 'Si se omite se genera uno aleatorio.' })
  @IsOptional()
  @Matches(FORMATO_PIN, { message: 'pin debe tener de 4 a 6 dígitos' })
  pin?: string;
}

export class ListarEmpleadosDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'SUPER_ADMIN: filtra por empresa' })
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional({ description: 'Busca por nombre, apellido, código o identidad' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activo?: boolean;
}

export class EmpleadoDto {
  @ApiProperty() id: string;
  @ApiProperty() empresaId: string;
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() apellido: string;
  @ApiProperty({ nullable: true, type: String }) identidad: string | null;
  @ApiProperty({ nullable: true, type: String }) cargo: string | null;
  @ApiProperty() activo: boolean;
  @ApiProperty({ nullable: true, type: Date, description: 'Si tiene valor futuro, el empleado está bloqueado por intentos fallidos' })
  bloqueadoHasta: Date | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class EmpleadosPaginadosDto {
  @ApiProperty({ type: [EmpleadoDto] }) data: EmpleadoDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}

export class EmpleadoCreadoDto {
  @ApiProperty({ type: EmpleadoDto }) empleado: EmpleadoDto;
  @ApiProperty({ description: 'PIN en texto plano. Solo se devuelve en esta respuesta.' })
  pin: string;
}

export class PinRestablecidoDto {
  @ApiProperty({ description: 'PIN en texto plano. Solo se devuelve en esta respuesta.' })
  pin: string;
}
