import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { getEnv } from '../../config/env';
import { JwtPayload } from '../types/usuario-autenticado';

// Guard global: toda ruta requiere token salvo las marcadas con @Public()
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (esPublica) return true;

    const request = context.switchToHttp().getRequest();
    const [tipo, token] = (request.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Token requerido');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: getEnv().jwtAccessSecret,
      });
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Consulta mínima para respetar desactivaciones y revocación por tokenVersion
    const usuario = await this.prisma.usuarioAdmin.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nombre: true,
        rol: true,
        empresaId: true,
        activo: true,
        tokenVersion: true,
      },
    });
    if (!usuario || !usuario.activo || usuario.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Sesión no válida');
    }

    request.user = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      empresaId: usuario.empresaId,
    };
    return true;
  }
}
