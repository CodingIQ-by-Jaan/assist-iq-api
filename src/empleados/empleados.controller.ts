import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { EmpleadosService } from './empleados.service';
import {
  CreateEmpleadoDto,
  EmpleadoCreadoDto,
  EmpleadoDto,
  EmpleadosPaginadosDto,
  ListarEmpleadosDto,
  PinRestablecidoDto,
  ResetPinDto,
  UpdateEmpleadoDto,
} from './dto/empleado.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

@ApiTags('Empleados')
@ApiBearerAuth()
@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleados: EmpleadosService) {}

  @Get()
  @ApiOkResponse({ type: EmpleadosPaginadosDto })
  listar(@CurrentUser() usuario: UsuarioAutenticado, @Query() query: ListarEmpleadosDto) {
    return this.empleados.listar(usuario, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: EmpleadoDto })
  obtener(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.empleados.obtener(usuario, id);
  }

  @Post()
  @ApiCreatedResponse({ type: EmpleadoCreadoDto })
  crear(@CurrentUser() usuario: UsuarioAutenticado, @Body() dto: CreateEmpleadoDto) {
    return this.empleados.crear(usuario, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: EmpleadoDto })
  actualizar(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmpleadoDto,
  ) {
    return this.empleados.actualizar(usuario, id, dto);
  }

  @Post(':id/reset-pin')
  @ApiCreatedResponse({ type: PinRestablecidoDto })
  restablecerPin(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPinDto,
  ) {
    return this.empleados.restablecerPin(usuario, id, dto.pin);
  }
}
