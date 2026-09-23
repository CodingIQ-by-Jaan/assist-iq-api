/*
  Warnings:

  - You are about to drop the column `tarifaHora` on the `empleados` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "empleados" DROP COLUMN "tarifaHora",
ADD COLUMN     "salarioBase" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "reglas_recargo" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reglas_recargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reglas_recargo_empresaId_idx" ON "reglas_recargo"("empresaId");

-- AddForeignKey
ALTER TABLE "reglas_recargo" ADD CONSTRAINT "reglas_recargo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
