-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'ADMIN_EMPRESA');

-- CreateEnum
CREATE TYPE "TipoMarcaje" AS ENUM ('ENTRADA', 'INICIO_ALMUERZO', 'FIN_ALMUERZO', 'SALIDA');

-- CreateTable
CREATE TABLE "empresas" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "rtn" TEXT,
    "zonaHoraria" TEXT NOT NULL DEFAULT 'America/Tegucigalpa',
    "siguienteCodigo" INTEGER NOT NULL DEFAULT 1,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "limiteEmpleados" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_admin" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "empresaId" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "usuarios_admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empleados" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "identidad" TEXT,
    "cargo" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "empleados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marcajes" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "empleadoId" UUID NOT NULL,
    "tipo" "TipoMarcaje" NOT NULL,
    "marcadoEn" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marcajes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_key" ON "empresas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_admin_email_key" ON "usuarios_admin"("email");

-- CreateIndex
CREATE INDEX "usuarios_admin_empresaId_idx" ON "usuarios_admin"("empresaId");

-- CreateIndex
CREATE INDEX "empleados_empresaId_activo_idx" ON "empleados"("empresaId", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_empresaId_codigo_key" ON "empleados"("empresaId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "empleados_empresaId_identidad_key" ON "empleados"("empresaId", "identidad");

-- CreateIndex
CREATE INDEX "marcajes_empleadoId_marcadoEn_idx" ON "marcajes"("empleadoId", "marcadoEn");

-- CreateIndex
CREATE INDEX "marcajes_empresaId_marcadoEn_idx" ON "marcajes"("empresaId", "marcadoEn");

-- AddForeignKey
ALTER TABLE "usuarios_admin" ADD CONSTRAINT "usuarios_admin_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empleados" ADD CONSTRAINT "empleados_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcajes" ADD CONSTRAINT "marcajes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcajes" ADD CONSTRAINT "marcajes_empleadoId_fkey" FOREIGN KEY ("empleadoId") REFERENCES "empleados"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
