import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { recortar } from '../../common/utils/transforms';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateReglaRecargoDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio para SUPER_ADMIN. Se ignora para ADMIN_EMPRESA.' })
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiProperty({ example: 'Nocturnidad' })
  @Transform(recortar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nombre: string;

  @ApiProperty({ example: '20:00', description: 'Hora local de inicio de la banda, formato HH:mm' })
  @Matches(FORMATO_HORA, { message: 'horaInicio debe tener formato HH:mm' })
  horaInicio: string;

  @ApiProperty({
    example: '04:00',
    description: 'Hora local de fin de la banda, formato HH:mm. Si es menor que horaInicio, la banda cruza la medianoche.',
  })
  @Matches(FORMATO_HORA, { message: 'horaFin debe tener formato HH:mm' })
  horaFin: string;

  @ApiProperty({ example: 25, minimum: 0, maximum: 500, description: 'Porcentaje extra sobre la tarifa base para las horas dentro de esta banda' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(500)
  porcentaje: number;
}

export class UpdateReglaRecargoDto extends PartialType(OmitType(CreateReglaRecargoDto, ['empresaId'] as const)) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class ListarReglasRecargoDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'SUPER_ADMIN: filtra por empresa' })
  @IsOptional()
  @IsUUID()
  empresaId?: string;
}

export class ReglaRecargoDto {
  @ApiProperty() id: string;
  @ApiProperty() empresaId: string;
  @ApiProperty() nombre: string;
  @ApiProperty() horaInicio: string;
  @ApiProperty() horaFin: string;
  @ApiProperty() porcentaje: number;
  @ApiProperty() activa: boolean;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
