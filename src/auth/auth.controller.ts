import { Body, Controller, ForbiddenException, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiCookieAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, LoginResponseDto, RefreshResponseDto, UsuarioDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../common/types/usuario-autenticado';
import { getEnv } from '../config/env';
import { origenPermitido } from '../common/utils/cors';

export const REFRESH_COOKIE = 'assistiq_rt';
const RUTA_COOKIE = '/auth';

const opcionesCookie = () => {
  const env = getEnv();
  return {
    httpOnly: true,
    secure: env.isProduction || env.cookieSameSite === 'none',
    sameSite: env.cookieSameSite,
    domain: env.cookieDomain,
    path: RUTA_COOKIE,
  } as const;
};

const guardarRefresh = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, {
    ...opcionesCookie(),
    maxAge: getEnv().jwtRefreshTtlDays * 24 * 60 * 60 * 1000,
  });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOkResponse({ type: LoginResponseDto })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken, usuario } = await this.auth.login(dto.email, dto.password);
    guardarRefresh(res, refreshToken);
    return { accessToken, usuario };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOkResponse({ type: RefreshResponseDto })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Defensa CSRF extra (importa si la cookie va con SameSite=None en previews)
    if (!origenPermitido(req.headers.origin, getEnv().corsOrigins)) {
      throw new ForbiddenException('Origen no permitido');
    }
    const { accessToken, refreshToken } = await this.auth.refrescar(req.cookies?.[REFRESH_COOKIE]);
    guardarRefresh(res, refreshToken);
    return { accessToken };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(REFRESH_COOKIE, opcionesCookie());
  }

  @Post('logout-all')
  @HttpCode(204)
  @ApiBearerAuth()
  async logoutAll(
    @CurrentUser() usuario: UsuarioAutenticado,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.cerrarTodasLasSesiones(usuario.id);
    res.clearCookie(REFRESH_COOKIE, opcionesCookie());
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOkResponse({ type: UsuarioDto })
  me(@CurrentUser() usuario: UsuarioAutenticado): UsuarioAutenticado {
    return usuario;
  }
}
