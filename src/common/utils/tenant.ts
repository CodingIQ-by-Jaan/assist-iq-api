import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { UsuarioAutenticado } from '../types/usuario-autenticado';

// Para listados: ADMIN_EMPRESA siempre queda limitado a su empresa;
// SUPER_ADMIN puede filtrar por una empresa o ver todas (undefined).
export const filtroEmpresa = (
  usuario: UsuarioAutenticado,
  empresaIdSolicitada?: string,
): string | undefined => {
  if (usuario.rol === Rol.ADMIN_EMPRESA) {
    if (empresaIdSolicitada && empresaIdSolicitada !== usuario.empresaId) {
      throw new ForbiddenException('No tiene acceso a esa empresa');
    }
    return usuario.empresaId as string;
  }
  return empresaIdSolicitada;
};

// Para creaciones: siempre debe resolverse a una empresa concreta.
export const empresaRequerida = (
  usuario: UsuarioAutenticado,
  empresaIdSolicitada?: string,
): string => {
  const empresaId = filtroEmpresa(usuario, empresaIdSolicitada);
  if (!empresaId) throw new BadRequestException('empresaId es requerido');
  return empresaId;
};
