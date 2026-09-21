-- Ejecutar UNA VEZ en el SQL Editor de Supabase, después de la primera migración.
-- Activa RLS sin políticas: la API REST automática de Supabase (clave anon) no puede
-- leer ni escribir estas tablas. NestJS accede con el rol postgres, que omite RLS.
-- Repetir para cada tabla nueva que agreguen las migraciones futuras.

ALTER TABLE public.empresas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empleados      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marcajes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;
