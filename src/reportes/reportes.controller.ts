import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { GenerarReporteDto, ReporteHorasDto } from './dto/reporte.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { generarPdfReporteHoras } from './reporte-pdf';

// Ambos roles pueden generar reportes: ADMIN_EMPRESA queda acotado a su propia empresa
// (empresaRequerida en el service), SUPER_ADMIN debe indicar empresaId.
@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('horas')
  @ApiOperation({ summary: 'Horas trabajadas y pago por empleado en un rango de fechas' })
  @ApiOkResponse({ type: ReporteHorasDto })
  horas(@CurrentUser() usuario: UsuarioAutenticado, @Query() query: GenerarReporteDto) {
    return this.reportes.generarReporteHoras(usuario, query);
  }

  @Get('horas/pdf')
  @ApiOperation({ summary: 'El mismo reporte de horas, en PDF' })
  @ApiProduces('application/pdf')
  async horasPdf(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Query() query: GenerarReporteDto,
    @Res() res: Response,
  ) {
    const reporte = await this.reportes.generarReporteHoras(usuario, query);
    const pdf = await generarPdfReporteHoras(reporte);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-horas-${query.desde}-a-${query.hasta}.pdf"`,
    });
    res.send(pdf);
  }
}
