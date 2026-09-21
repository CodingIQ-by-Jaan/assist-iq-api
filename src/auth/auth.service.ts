import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { getEnv } from '../config/env';
import { JwtPayload, UsuarioAutenticado } from '../common/types/usuario-autenticado';

// Hash de relleno para igualar el tiempo de respuesta cuando el correo no existe
const HASH_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', 10);

const aUsuarioAutenticado = (u: {
  id: string;
  email: string;
  nombre: string;
  rol: UsuarioAutenticado['rol'];
  empresaId: string | null;
}): UsuarioAutenticado => ({
  id: u.id,
  email: u.email,
  nombre: u.nombre,
  rol: u.rol,
  empresaId: u.empresaId,
});

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private firmarAcceso = (usuarioId: string, tokenVersion: number) =>
    this.jwt.signAsync({ sub: usuarioId, tv: tokenVersion } satisfies JwtPayload, {
      secret: getEnv().jwtAccessSecret,
      expiresIn: getEnv().jwtAccessTtl as any,
    });

  private firmarRefresh = (usuarioId: string, tokenVersion: number) =>
    this.jwt.signAsync({ sub: usuarioId, tv: tokenVersion } satisfies JwtPayload, {
      secret: getEnv().jwtRefreshSecret,
      expiresIn: `${getEnv().jwtRefreshTtlDays}d` as any,
    });

  async login(email: string, password: string) {
    const usuario = await this.prisma.usuarioAdmin.findUnique({ where: { email } });

    const valido = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_RELLENO);
    if (!usuario || !valido || !usuario.activo) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.firmarAcceso(usuario.id, usuario.tokenVersion),
      this.firmarRefresh(usuario.id, usuario.tokenVersion),
    ]);

    return { accessToken, refreshToken, usuario: aUsuarioAutenticado(usuario) };
  }

  async refrescar(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('Sesión no válida');

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken, {
        secret: getEnv().jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Sesión expirada');
    }

    const usuario = await this.prisma.usuarioAdmin.findUnique({ where: { id: payload.sub } });
    if (!usuario || !usuario.activo || usuario.tokenVersion !== payload.tv) {
      throw new UnauthorizedException('Sesión no válida');
    }

    // Rotación: se emite un refresh nuevo en cada renovación
    const [accessToken, nuevoRefresh] = await Promise.all([
      this.firmarAcceso(usuario.id, usuario.tokenVersion),
      this.firmarRefresh(usuario.id, usuario.tokenVersion),
    ]);

    return { accessToken, refreshToken: nuevoRefresh };
  }

  // Invalida todos los tokens (acceso y refresh) emitidos para el usuario
  async cerrarTodasLasSesiones(usuarioId: string) {
    await this.prisma.usuarioAdmin.update({
      where: { id: usuarioId },
      data: { tokenVersion: { increment: 1 } },
    });
  }
}
