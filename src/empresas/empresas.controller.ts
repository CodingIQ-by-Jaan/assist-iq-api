import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Rol } from '@prisma/client';
import { EmpresasService } from './empresas.service';
import {
  CreateEmpresaDto,
  EmpresaDto,
  EmpresasPaginadasDto,
  ListarEmpresasDto,
  UpdateEmpresaDto,
} from './dto/empresa.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

@ApiTags('Empresas')
@ApiBearerAuth()
@Controller('empresas')
export class EmpresasController {
  constructor(private readonly empresas: EmpresasService) {}

  @Get()
  @ApiOkResponse({ type: EmpresasPaginadasDto })
  listar(@CurrentUser() usuario: UsuarioAutenticado, @Query() query: ListarEmpresasDto) {
    return this.empresas.listar(usuario, query);
  }

  @Get(':id')
  @ApiOkResponse({ type: EmpresaDto })
  obtener(@CurrentUser() usuario: UsuarioAutenticado, @Param('id', ParseUUIDPipe) id: string) {
    return this.empresas.obtener(usuario, id);
  }

  @Post()
  @Roles(Rol.SUPER_ADMIN)
  @ApiCreatedResponse({ type: EmpresaDto })
  crear(@Body() dto: CreateEmpresaDto) {
    return this.empresas.crear(dto);
  }

  @Patch(':id')
  @Roles(Rol.SUPER_ADMIN)
  @ApiOkResponse({ type: EmpresaDto })
  actualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEmpresaDto) {
    return this.empresas.actualizar(id, dto);
  }
}
