import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { UsuariosAdminService } from './usuarios-admin.service';
import {
  CreateUsuarioAdminDto,
  ListarUsuariosAdminDto,
  PasswordRestablecidaDto,
  ResetPasswordUsuarioAdminDto,
  UpdateUsuarioAdminDto,
  UsuarioAdminCreadoDto,
  UsuarioAdminDto,
  UsuariosAdminPaginadosDto,
} from './dto/usuario-admin.dto';
import { Roles } from '../common/decorators/roles.decorator';

// Todo este módulo es exclusivo del SUPER_ADMIN: gestiona las cuentas ADMIN_EMPRESA de cada empresa
@ApiTags('Usuarios administradores')
@ApiBearerAuth()
@Roles(Rol.SUPER_ADMIN)
@Controller('usuarios-admin')
export class UsuariosAdminController {
  constructor(private readonly usuariosAdmin: UsuariosAdminService) {}

  @Get()
  @ApiOkResponse({ type: UsuariosAdminPaginadosDto })
  listar(@Query() query: ListarUsuariosAdminDto) {
    return this.usuariosAdmin.listar(query);
  }

  @Post()
  @ApiCreatedResponse({ type: UsuarioAdminCreadoDto })
  crear(@Body() dto: CreateUsuarioAdminDto) {
    return this.usuariosAdmin.crear(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: UsuarioAdminDto })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioAdminDto) {
    return this.usuariosAdmin.actualizar(id, dto);
  }

  @Post(':id/reset-password')
  @ApiCreatedResponse({ type: PasswordRestablecidaDto })
  restablecerPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordUsuarioAdminDto,
  ) {
    return this.usuariosAdmin.restablecerPassword(id, dto.password);
  }
}
