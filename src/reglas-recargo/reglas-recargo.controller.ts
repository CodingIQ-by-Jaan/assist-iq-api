import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ReglasRecargoService } from './reglas-recargo.service';
import {
  CreateReglaRecargoDto,
  ListarReglasRecargoDto,
  ReglaRecargoDto,
  UpdateReglaRecargoDto,
} from './dto/regla-recargo.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

// Ambos roles administran las reglas de recargo: ADMIN_EMPRESA queda acotado a su propia
// empresa (empresaRequerida/filtroEmpresa en el service), SUPER_ADMIN debe indicar empresaId.
@ApiTags('Reglas de recargo')
@ApiBearerAuth()
@Controller('reglas-recargo')
export class ReglasRecargoController {
  constructor(private readonly reglas: ReglasRecargoService) {}

  @Get()
  @ApiOkResponse({ type: [ReglaRecargoDto] })
  listar(@CurrentUser() usuario: UsuarioAutenticado, @Query() query: ListarReglasRecargoDto) {
    return this.reglas.listar(usuario, query);
  }

  @Post()
  @ApiCreatedResponse({ type: ReglaRecargoDto })
  crear(@CurrentUser() usuario: UsuarioAutenticado, @Body() dto: CreateReglaRecargoDto) {
    return this.reglas.crear(usuario, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ReglaRecargoDto })
  actualizar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReglaRecargoDto,
  ) {
    return this.reglas.actualizar(usuario, id, dto);
  }
}
