import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class GenerarReporteDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Obligatorio para SUPER_ADMIN. Se ignora para ADMIN_EMPRESA.' })
  @IsOptional()
  @IsUUID()
  empresaId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Si se omite, incluye a todos los empleados activos de la empresa.' })
  @IsOptional()
  @IsUUID()
  empleadoId?: string;

  @ApiProperty({ example: '2026-09-01', description: 'Inicio del rango, fecha local de la empresa (inclusive).' })
  @IsDateString()
  desde: string;

  @ApiProperty({ example: '2026-09-15', description: 'Fin del rango, fecha local de la empresa (inclusive).' })
  @IsDateString()
  hasta: string;
}

class EmpresaResumenReporteDto {
  @ApiProperty() id: string;
  @ApiProperty() nombre: string;
}

class DesgloseReglaReporteDto {
  @ApiProperty() reglaId: string;
  @ApiProperty() nombre: string;
  @ApiProperty({ description: 'Porcentaje extra de esta regla, ej. 25 = 25%.' }) porcentaje: number;
  @ApiProperty({ description: 'Horas trabajadas dentro de la franja de esta regla.' }) horas: number;
  @ApiProperty({ description: 'Monto extra pagado por esta regla (horas × tarifa base × porcentaje/100).' })
  monto: number;
}

class EmpleadoReporteDto {
  @ApiProperty() empleadoId: string;
  @ApiProperty() codigo: string;
  @ApiProperty() nombre: string;
  @ApiProperty() apellido: string;
  @ApiProperty({ description: 'Horas trabajadas en el rango, ya descontado el almuerzo.' }) horas: number;
  @ApiProperty({ nullable: true, type: Number, description: 'Salario base mensual en Lempiras (null si no está definido).' })
  salarioBase: number | null;
  @ApiProperty({ nullable: true, type: Number, description: 'salarioBase / 240 (30 días × 8 horas). Null si no hay salario definido.' })
  tarifaHoraBase: number | null;
  @ApiProperty({ nullable: true, type: Number, description: 'horas × tarifaHoraBase, sin recargos. Null si no hay salario definido.' })
  pagoBase: number | null;
  @ApiProperty({ type: [DesgloseReglaReporteDto], description: 'Recargos aplicados (solo las reglas con horas > 0 en el periodo).' })
  desglose: DesgloseReglaReporteDto[];
  @ApiProperty({ nullable: true, type: Number, description: 'pagoBase + la suma de los montos del desglose. Null si no hay salario definido.' })
  pago: number | null;
  @ApiProperty({ description: 'Turnos del rango que quedaron sin marcar la salida (no se cuentan en las horas).' })
  turnosIncompletos: number;
}

class TotalesReporteDto {
  @ApiProperty() horas: number;
  @ApiProperty({ nullable: true, type: Number, description: 'Null si ningún empleado del reporte tiene salario definido.' })
  pago: number | null;
}

export class ReporteHorasDto {
  @ApiProperty({ type: EmpresaResumenReporteDto }) empresa: EmpresaResumenReporteDto;
  @ApiProperty() desde: string;
  @ApiProperty() hasta: string;
  @ApiProperty({ type: [EmpleadoReporteDto] }) empleados: EmpleadoReporteDto[];
  @ApiProperty({ type: TotalesReporteDto }) totales: TotalesReporteDto;
}
