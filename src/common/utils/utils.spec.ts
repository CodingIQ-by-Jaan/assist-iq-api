import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Rol } from '@prisma/client';
import { origenPermitido } from './cors';
import { empresaRequerida, filtroEmpresa } from './tenant';
import { slugify } from './transforms';
import { UsuarioAutenticado } from '../types/usuario-autenticado';

const superAdmin: UsuarioAutenticado = {
  id: 'u1',
  email: 'a@a.com',
  nombre: 'Root',
  rol: Rol.SUPER_ADMIN,
  empresaId: null,
};
const adminEmpresa: UsuarioAutenticado = {
  id: 'u2',
  email: 'b@b.com',
  nombre: 'Gerente',
  rol: Rol.ADMIN_EMPRESA,
  empresaId: 'empresa-A',
};

describe('filtroEmpresa / empresaRequerida', () => {
  it('SUPER_ADMIN puede ver todas (sin filtro) o filtrar por una', () => {
    expect(filtroEmpresa(superAdmin)).toBeUndefined();
    expect(filtroEmpresa(superAdmin, 'empresa-B')).toBe('empresa-B');
  });

  it('ADMIN_EMPRESA queda limitado a su empresa aunque no envíe filtro', () => {
    expect(filtroEmpresa(adminEmpresa)).toBe('empresa-A');
    expect(filtroEmpresa(adminEmpresa, 'empresa-A')).toBe('empresa-A');
  });

  it('ADMIN_EMPRESA no puede pedir datos de otra empresa', () => {
    expect(() => filtroEmpresa(adminEmpresa, 'empresa-B')).toThrow(ForbiddenException);
  });

  it('crear exige empresa para SUPER_ADMIN', () => {
    expect(() => empresaRequerida(superAdmin)).toThrow(BadRequestException);
    expect(empresaRequerida(superAdmin, 'empresa-B')).toBe('empresa-B');
    expect(empresaRequerida(adminEmpresa)).toBe('empresa-A');
  });
});

describe('origenPermitido', () => {
  const permitidos = ['http://localhost:5173', 'https://app.tudominio.com', 'https://*-assistiq-web.vercel.app'];

  it('acepta orígenes exactos y sin Origin', () => {
    expect(origenPermitido('http://localhost:5173', permitidos)).toBe(true);
    expect(origenPermitido('https://app.tudominio.com', permitidos)).toBe(true);
    expect(origenPermitido(undefined, permitidos)).toBe(true);
  });

  it('acepta previews de Vercel del proyecto web', () => {
    expect(origenPermitido('https://git-feat-x-assistiq-web.vercel.app', permitidos)).toBe(true);
  });

  it('rechaza dominios ajenos y intentos de suplantar el patrón', () => {
    expect(origenPermitido('https://evil.com', permitidos)).toBe(false);
    expect(origenPermitido('https://app.tudominio.com.evil.com', permitidos)).toBe(false);
    expect(origenPermitido('https://x-assistiq-web.vercel.app.evil.com', permitidos)).toBe(false);
    expect(origenPermitido('https://x-otro-proyecto.vercel.app', permitidos)).toBe(false);
  });
});

describe('slugify', () => {
  it('normaliza acentos, espacios y símbolos', () => {
    expect(slugify('Pizzería El Sol, S. de R.L.')).toBe('pizzeria-el-sol-s-de-r-l');
  });
});
