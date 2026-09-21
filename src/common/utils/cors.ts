const escaparRegex = (texto: string) => texto.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

// Convierte "https://*-assistiq-web.vercel.app" en una expresión regular anclada
const patronARegex = (patron: string) =>
  new RegExp(`^${patron.split('*').map(escaparRegex).join('[a-z0-9-]+')}$`, 'i');

export const origenPermitido = (origen: string | undefined, permitidos: string[]): boolean => {
  // Peticiones sin Origin (curl, server-to-server) no son cross-site del navegador
  if (!origen) return true;
  return permitidos.some((patron) =>
    patron.includes('*') ? patronARegex(patron).test(origen) : patron === origen,
  );
};
