// Genera openapi.json para que asistiq-web produzca sus tipos (openapi-typescript).
// No requiere base de datos: solo arranca el contenedor de Nest y lee los metadatos.
import 'reflect-metadata';
import { writeFileSync } from 'fs';
import { join } from 'path';

process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';
process.env.JWT_ACCESS_SECRET ??= 'export';
process.env.JWT_REFRESH_SECRET ??= 'export';

const exportar = async () => {
  const { createApp, buildOpenApi } = await import('../src/app.factory');
  const app = await createApp();
  await app.init();
  const salida = join(process.cwd(), 'openapi.json');
  writeFileSync(salida, JSON.stringify(buildOpenApi(app), null, 2));
  await app.close();
  console.log(`OpenAPI exportado en ${salida}`);
};

exportar();
