export interface Env {
  nodeEnv: string;
  port: number;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtlDays: number;
  corsOrigins: string[];
  cookieDomain?: string;
  cookieSameSite: 'lax' | 'none';
  swaggerEnabled: boolean;
  isProduction: boolean;
}

const REQUERIDAS = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;

let cache: Env | null = null;

export const getEnv = (): Env => {
  if (cache) return cache;

  const faltantes = REQUERIDAS.filter((nombre) => !process.env[nombre]);
  if (faltantes.length > 0) {
    throw new Error(`Faltan variables de entorno: ${faltantes.join(', ')}`);
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const sameSite = (process.env.COOKIE_SAMESITE ?? 'lax').toLowerCase();

  cache = {
    nodeEnv,
    isProduction,
    port: Number(process.env.PORT ?? 3000),
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET as string,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string,
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    jwtRefreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS ?? 7),
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origen) => origen.trim())
      .filter(Boolean),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    cookieSameSite: sameSite === 'none' ? 'none' : 'lax',
    swaggerEnabled: (process.env.SWAGGER_ENABLED ?? (isProduction ? 'false' : 'true')) === 'true',
  };

  return cache;
};

// Solo para pruebas
export const resetEnvCache = () => {
  cache = null;
};
