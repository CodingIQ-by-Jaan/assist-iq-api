import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto, PaginationMetaDto } from '../../common/dto/pagination.dto';
import { recortar } from '../../common/utils/transforms';

const normalizarEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CreateUsuarioAdminDto {
  @ApiProperty({ format: 'uuid', description: 'Empresa a la que pertenece este administrador' })
  @IsUUID()
  empresaId: string;

  @ApiProperty({ example: 'admin@pizzeria.com' })
  @Transform(normalizarEmail)
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Ana Martínez' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({ minLength: 8, description: 'Si se omite se genera una contraseña aleatoria.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class UpdateUsuarioAdminDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ResetPasswordUsuarioAdminDto {
  @ApiPropertyOptional({ minLength: 8, description: 'Si se omite se genera una contraseña aleatoria.' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

export class ListarUsuariosAdminDto extends PaginationDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Filtra por empresa' })
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional({ description: 'Busca por nombre o correo' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  search?: string;
}

export class UsuarioAdminDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ enum: Rol, enumName: 'Rol' }) rol: Rol;
  @ApiProperty({ nullable: true, type: String }) empresaId: string | null;
  @ApiProperty() activo: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class UsuariosAdminPaginadosDto {
  @ApiProperty({ type: [UsuarioAdminDto] }) data: UsuarioAdminDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}

export class UsuarioAdminCreadoDto {
  @ApiProperty({ type: UsuarioAdminDto }) usuario: UsuarioAdminDto;
  @ApiProperty({ description: 'Contraseña en texto plano. Solo se devuelve en esta respuesta.' })
  password: string;
}

export class PasswordRestablecidaDto {
  @ApiProperty({ description: 'Contraseña en texto plano. Solo se devuelve en esta respuesta.' })
  password: string;
}
