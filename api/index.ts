import 'reflect-metadata';
import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app.factory';

// Punto de entrada serverless para Vercel: la app se crea una vez por instancia caliente.
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let handler: Handler | undefined;

export default async (req: IncomingMessage, res: ServerResponse) => {
  if (!handler) {
    const app = await createApp();
    await app.init();
    handler = app.getHttpAdapter().getInstance() as Handler;
  }
  return handler(req, res);
};
