import 'reflect-metadata';
import { createApp } from './app.factory';
import { getEnv } from './config/env';

const bootstrap = async () => {
  const app = await createApp();
  const { port } = getEnv();
  await app.listen(port);
  console.log(`AssistIQ API escuchando en http://localhost:${port} (docs en /docs)`);
};

bootstrap();
