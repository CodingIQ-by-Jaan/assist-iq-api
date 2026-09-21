import { ApiProperty } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@codingiq.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class UsuarioDto {
  @ApiProperty() id: string;
  @ApiProperty() email: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ enum: Rol, enumName: 'Rol' }) rol: Rol;
  @ApiProperty({ nullable: true, type: String }) empresaId: string | null;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT de acceso (15 min). Enviar como Bearer.' })
  accessToken: string;

  @ApiProperty({ type: UsuarioDto })
  usuario: UsuarioDto;
}

export class RefreshResponseDto {
  @ApiProperty() accessToken: string;
}
