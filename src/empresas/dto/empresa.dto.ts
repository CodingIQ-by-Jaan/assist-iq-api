import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto, PaginationMetaDto } from '../../common/dto/pagination.dto';
import { aBooleano, recortar } from '../../common/utils/transforms';

export class CreateEmpresaDto {
  @ApiProperty({ example: 'Pizzería El Sol' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombre: string;

  @ApiPropertyOptional({
    example: 'pizzeria-el-sol',
    description: 'Se usa en la URL del kiosco. Si se omite se genera desde el nombre.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug solo admite minúsculas, números y guiones',
  })
  @MaxLength(40)
  slug?: string;

  @ApiPropertyOptional({ example: '08019999123456' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(20)
  rtn?: string;

  @ApiPropertyOptional({ example: 'America/Tegucigalpa', default: 'America/Tegucigalpa' })
  @IsOptional()
  @IsTimeZone()
  zonaHoraria?: string;

  @ApiPropertyOptional({
    type: Number,
    example: 15,
    minimum: 0,
    nullable: true,
    description: 'Tope de empleados activos permitidos según el plan contratado. Se omite (o null) para sin límite.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  limiteEmpleados?: number | null;
}

export class UpdateEmpresaDto extends PartialType(CreateEmpresaDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class ListarEmpresasDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Busca por nombre o slug' })
  @IsOptional()
  @Transform(recortar)
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  activa?: boolean;
}

export class EmpresaDto {
  @ApiProperty() id: string;
  @ApiProperty() nombre: string;
  @ApiProperty() slug: string;
  @ApiProperty({ nullable: true, type: String }) rtn: string | null;
  @ApiProperty() zonaHoraria: string;
  @ApiProperty({ nullable: true, type: Number }) limiteEmpleados: number | null;
  @ApiProperty() activa: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class EmpresasPaginadasDto {
  @ApiProperty({ type: [EmpresaDto] }) data: EmpresaDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}

// Datos mínimos que necesita el kiosco de marcaje (endpoint público)
export class KioscoInfoDto {
  @ApiProperty() nombre: string;
  @ApiProperty() slug: string;
}
