import { Rol } from '@prisma/client';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  empresaId: string | null;
}

export interface JwtPayload {
  sub: string;
  tv: number;
}
