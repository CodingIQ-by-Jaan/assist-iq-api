import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { MarcajesService } from './marcajes.service';
import {
  CredencialesKioscoDto,
  EstadoKioscoDto,
  ListarMarcajesDto,
  MarcajesPaginadosDto,
  MarcarDto,
  MarcarRespuestaDto,
} from './dto/marcaje.dto';
import { KioscoInfoDto } from '../empresas/dto/empresa.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';

// Endpoints públicos del kiosco: la identificación es empresa (slug) + código + PIN.
@ApiTags('Kiosco')
@Public()
@Controller('public/kiosco/:slug')
export class KioscoController {
  constructor(private readonly marcajes: MarcajesService) {}

  @Get()
  @ApiOperation({ summary: 'Datos de la empresa para mostrar en el kiosco' })
  @ApiOkResponse({ type: KioscoInfoDto })
  info(@Param('slug') slug: string) {
    return this.marcajes.infoKiosco(slug);
  }

  @Post('estado')
  @HttpCode(200)
  @ApiOperation({ summary: 'Valida código + PIN y devuelve qué marcajes puede hacer el empleado' })
  @ApiOkResponse({ type: EstadoKioscoDto })
  estado(@Param('slug') slug: string, @Body() dto: CredencialesKioscoDto) {
    return this.marcajes.estado(slug, dto);
  }

  @Post('marcajes')
  @ApiOperation({ summary: 'Registra un marcaje (la hora la define el servidor)' })
  @ApiCreatedResponse({ type: MarcarRespuestaDto })
  marcar(@Param('slug') slug: string, @Body() dto: MarcarDto, @Req() req: Request) {
    return this.marcajes.marcar(slug, dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }
}

@ApiTags('Marcajes')
@ApiBearerAuth()
@Controller('marcajes')
export class MarcajesController {
  constructor(private readonly marcajes: MarcajesService) {}

  @Get()
  @ApiOkResponse({ type: MarcajesPaginadosDto })
  listar(@CurrentUser() usuario: UsuarioAutenticado, @Query() query: ListarMarcajesDto) {
    return this.marcajes.listar(usuario, query);
  }
}
