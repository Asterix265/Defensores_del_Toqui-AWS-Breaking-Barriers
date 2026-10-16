-- Dataset E1 por núcleos (migrar-dataset-nucleos, D1 y D2).
-- DESTRUCTIVA: vacía el dataset anterior (9 niveles, 5 dominios) y el registro en la app
-- (capturas, borradores, correcciones, eventos y observaciones de la app). Sus IDs de niños y
-- manifestaciones apuntan al dataset anterior y no equivalen a los del nuevo. Todo es sintético.
-- Después de aplicarla, cargar el dataset nuevo: `pnpm db:seed` o `pnpm aws:prod:seed`.
TRUNCATE TABLE
  "eventos_tiempo",
  "correcciones",
  "borradores",
  "observacion_manifestaciones",
  "observaciones",
  "capturas",
  "manifestaciones",
  "ruta_niveles",
  "ninos",
  "educadoras",
  "jardines"
CASCADE;

-- CreateEnum
CREATE TYPE "tipo_manifestacion" AS ENUM ('conducta_descriptor', 'ejemplo_ilustrativo');

-- CreateEnum
CREATE TYPE "alcance_evidencia" AS ENUM ('componente_observado', 'parcial_otro_descriptor');

-- CreateEnum
CREATE TYPE "estado_valoracion" AS ENUM ('confirmada', 'ajustada', 'pendiente_revision', 'propuesta_pendiente', 'evidencia_insuficiente', 'sin_registro');

-- CreateEnum
CREATE TYPE "uso_evidencia" AS ENUM ('sustento_propuesta', 'contraste_parcial');

-- AlterEnum
BEGIN;
CREATE TYPE "rol_educadora_new" AS ENUM ('educadora_parvulos', 'asistente_parvulos', 'directora');
ALTER TABLE "educadoras" ALTER COLUMN "rol" TYPE "rol_educadora_new" USING ("rol"::text::"rol_educadora_new");
ALTER TYPE "rol_educadora" RENAME TO "rol_educadora_old";
ALTER TYPE "rol_educadora_new" RENAME TO "rol_educadora";
DROP TYPE "public"."rol_educadora_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "manifestaciones" DROP CONSTRAINT "manifestaciones_nivel_fkey";

-- DropForeignKey
ALTER TABLE "observaciones" DROP CONSTRAINT "observaciones_nivel_estimado_fkey";

-- DropIndex
DROP INDEX "manifestaciones_nivel_dominio_idx";

-- AlterTable
ALTER TABLE "educadoras" DROP COLUMN "apellidos",
DROP COLUMN "nombres",
ADD COLUMN     "nombre_completo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "jardines" ADD COLUMN     "id_directora" TEXT,
ADD COLUMN     "numero_asistentes" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "manifestaciones" DROP COLUMN "dominio",
DROP COLUMN "nivel",
ADD COLUMN     "id_descriptor" TEXT NOT NULL,
ADD COLUMN     "origen" TEXT NOT NULL,
ADD COLUMN     "tipo" "tipo_manifestacion" NOT NULL;

-- AlterTable
ALTER TABLE "ninos" DROP COLUMN "apellidos",
DROP COLUMN "nombres",
ADD COLUMN     "id_nivel_educativo" TEXT NOT NULL,
ADD COLUMN     "id_sala" TEXT NOT NULL,
ADD COLUMN     "nombre_completo" TEXT NOT NULL,
ADD COLUMN     "nombre_registro" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "observacion_manifestaciones" DROP CONSTRAINT "observacion_manifestaciones_pkey",
DROP COLUMN "cita",
ADD COLUMN     "alcance" "alcance_evidencia" NOT NULL DEFAULT 'componente_observado',
ADD COLUMN     "fragmento_evidencia" TEXT,
ADD COLUMN     "id_evidencia" TEXT NOT NULL,
ADD CONSTRAINT "observacion_manifestaciones_pkey" PRIMARY KEY ("id_evidencia");

-- AlterTable
ALTER TABLE "observaciones" DROP COLUMN "nivel_estimado",
ADD COLUMN     "apoyos" TEXT,
ADD COLUMN     "contexto" TEXT,
ADD COLUMN     "edad_meses_observacion" INTEGER,
ADD COLUMN     "procedencia" TEXT,
ADD COLUMN     "texto_observacion" TEXT;

-- AlterTable
ALTER TABLE "ruta_niveles" DROP CONSTRAINT "ruta_niveles_pkey",
DROP COLUMN "descripcion",
DROP COLUMN "dominios",
DROP COLUMN "edad_max_meses",
DROP COLUMN "edad_min_meses",
ADD COLUMN     "conducta_observable" TEXT NOT NULL,
ADD COLUMN     "desarrollo_esperado" TEXT NOT NULL,
ADD COLUMN     "ejemplo_1" TEXT NOT NULL,
ADD COLUMN     "ejemplo_2" TEXT NOT NULL,
ADD COLUMN     "id_descriptor" TEXT NOT NULL,
ADD COLUMN     "id_nivel_educativo" TEXT NOT NULL,
ADD COLUMN     "id_nucleo" TEXT NOT NULL,
ADD COLUMN     "id_version" TEXT NOT NULL,
ADD COLUMN     "origen" TEXT NOT NULL,
ADD COLUMN     "paso_siguiente_sugerido" TEXT,
ADD CONSTRAINT "ruta_niveles_pkey" PRIMARY KEY ("id_descriptor");

-- DropEnum
DROP TYPE "dominio";

-- CreateTable
CREATE TABLE "niveles_educativos" (
    "id_nivel_educativo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "edad_min_meses_contexto" INTEGER NOT NULL,
    "edad_max_meses_exclusiva_contexto" INTEGER NOT NULL,

    CONSTRAINT "niveles_educativos_pkey" PRIMARY KEY ("id_nivel_educativo")
);

-- CreateTable
CREATE TABLE "nucleos" (
    "id_nucleo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "ambito" TEXT NOT NULL,
    "archivo_rubrica" TEXT NOT NULL,
    "origen" TEXT NOT NULL,

    CONSTRAINT "nucleos_pkey" PRIMARY KEY ("id_nucleo")
);

-- CreateTable
CREATE TABLE "niveles_trayectoria" (
    "nivel" INTEGER NOT NULL,
    "nombre_nivel" TEXT NOT NULL,

    CONSTRAINT "niveles_trayectoria_pkey" PRIMARY KEY ("nivel")
);

-- CreateTable
CREATE TABLE "versiones_rubrica" (
    "id_version" TEXT NOT NULL,
    "fecha_version" DATE NOT NULL,
    "estado" TEXT NOT NULL,
    "archivo_referencia" TEXT NOT NULL,
    "nucleos_activos" INTEGER NOT NULL,
    "niveles_activos" INTEGER NOT NULL,

    CONSTRAINT "versiones_rubrica_pkey" PRIMARY KEY ("id_version")
);

-- CreateTable
CREATE TABLE "salas" (
    "id_sala" TEXT NOT NULL,
    "id_jardin" TEXT NOT NULL,
    "sala_grupo" TEXT NOT NULL,
    "id_nivel_educativo" TEXT NOT NULL,
    "id_educadora_responsable" TEXT NOT NULL,

    CONSTRAINT "salas_pkey" PRIMARY KEY ("id_sala")
);

-- CreateTable
CREATE TABLE "personal_salas" (
    "id_educadora" TEXT NOT NULL,
    "id_sala" TEXT NOT NULL,

    CONSTRAINT "personal_salas_pkey" PRIMARY KEY ("id_educadora","id_sala")
);

-- CreateTable
CREATE TABLE "valoraciones" (
    "id_valoracion" TEXT NOT NULL,
    "id_nino" TEXT NOT NULL,
    "id_sala" TEXT NOT NULL,
    "id_nivel_educativo" TEXT NOT NULL,
    "id_nucleo" TEXT NOT NULL,
    "id_version" TEXT NOT NULL,
    "fecha_corte" DATE NOT NULL,
    "nivel_sugerido" INTEGER,
    "nivel_validado" INTEGER,
    "estado" "estado_valoracion" NOT NULL,
    "id_educadora_decide" TEXT,
    "fecha_decision" DATE,
    "id_observacion_sin_clasificar" TEXT,
    "justificacion_sugerencia" TEXT,
    "justificacion_decision" TEXT,
    "paso_siguiente_sugerido" TEXT,
    "origen" "origen_observacion" NOT NULL DEFAULT 'dataset',
    "id_captura" UUID,
    "id_usuario_decide" TEXT,

    CONSTRAINT "valoraciones_pkey" PRIMARY KEY ("id_valoracion")
);

-- CreateTable
CREATE TABLE "valoracion_evidencias" (
    "id_valoracion" TEXT NOT NULL,
    "id_evidencia" TEXT NOT NULL,
    "uso" "uso_evidencia" NOT NULL,

    CONSTRAINT "valoracion_evidencias_pkey" PRIMARY KEY ("id_valoracion","id_evidencia")
);

-- CreateIndex
CREATE UNIQUE INDEX "salas_id_jardin_sala_grupo_key" ON "salas"("id_jardin", "sala_grupo");

-- CreateIndex
CREATE INDEX "valoraciones_id_nino_id_nucleo_fecha_corte_idx" ON "valoraciones"("id_nino", "id_nucleo", "fecha_corte");

-- CreateIndex
CREATE INDEX "valoracion_evidencias_id_evidencia_idx" ON "valoracion_evidencias"("id_evidencia");

-- CreateIndex
CREATE INDEX "manifestaciones_id_descriptor_idx" ON "manifestaciones"("id_descriptor");

-- CreateIndex
CREATE INDEX "observacion_manifestaciones_id_observacion_idx" ON "observacion_manifestaciones"("id_observacion");

-- CreateIndex
CREATE INDEX "observacion_manifestaciones_id_manifestacion_idx" ON "observacion_manifestaciones"("id_manifestacion");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_niveles_id_version_id_nivel_educativo_id_nucleo_nivel_key" ON "ruta_niveles"("id_version", "id_nivel_educativo", "id_nucleo", "nivel");

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_id_jardin_fkey" FOREIGN KEY ("id_jardin") REFERENCES "jardines"("id_jardin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_id_nivel_educativo_fkey" FOREIGN KEY ("id_nivel_educativo") REFERENCES "niveles_educativos"("id_nivel_educativo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salas" ADD CONSTRAINT "salas_id_educadora_responsable_fkey" FOREIGN KEY ("id_educadora_responsable") REFERENCES "educadoras"("id_educadora") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_salas" ADD CONSTRAINT "personal_salas_id_educadora_fkey" FOREIGN KEY ("id_educadora") REFERENCES "educadoras"("id_educadora") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_salas" ADD CONSTRAINT "personal_salas_id_sala_fkey" FOREIGN KEY ("id_sala") REFERENCES "salas"("id_sala") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ninos" ADD CONSTRAINT "ninos_id_sala_fkey" FOREIGN KEY ("id_sala") REFERENCES "salas"("id_sala") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ninos" ADD CONSTRAINT "ninos_id_nivel_educativo_fkey" FOREIGN KEY ("id_nivel_educativo") REFERENCES "niveles_educativos"("id_nivel_educativo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_niveles" ADD CONSTRAINT "ruta_niveles_id_version_fkey" FOREIGN KEY ("id_version") REFERENCES "versiones_rubrica"("id_version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_niveles" ADD CONSTRAINT "ruta_niveles_id_nivel_educativo_fkey" FOREIGN KEY ("id_nivel_educativo") REFERENCES "niveles_educativos"("id_nivel_educativo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_niveles" ADD CONSTRAINT "ruta_niveles_id_nucleo_fkey" FOREIGN KEY ("id_nucleo") REFERENCES "nucleos"("id_nucleo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_niveles" ADD CONSTRAINT "ruta_niveles_nivel_fkey" FOREIGN KEY ("nivel") REFERENCES "niveles_trayectoria"("nivel") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestaciones" ADD CONSTRAINT "manifestaciones_id_descriptor_fkey" FOREIGN KEY ("id_descriptor") REFERENCES "ruta_niveles"("id_descriptor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_nino_fkey" FOREIGN KEY ("id_nino") REFERENCES "ninos"("id_nino") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_sala_fkey" FOREIGN KEY ("id_sala") REFERENCES "salas"("id_sala") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_nivel_educativo_fkey" FOREIGN KEY ("id_nivel_educativo") REFERENCES "niveles_educativos"("id_nivel_educativo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_nucleo_fkey" FOREIGN KEY ("id_nucleo") REFERENCES "nucleos"("id_nucleo") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_version_fkey" FOREIGN KEY ("id_version") REFERENCES "versiones_rubrica"("id_version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_nivel_sugerido_fkey" FOREIGN KEY ("nivel_sugerido") REFERENCES "niveles_trayectoria"("nivel") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_nivel_validado_fkey" FOREIGN KEY ("nivel_validado") REFERENCES "niveles_trayectoria"("nivel") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_educadora_decide_fkey" FOREIGN KEY ("id_educadora_decide") REFERENCES "educadoras"("id_educadora") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_observacion_sin_clasificar_fkey" FOREIGN KEY ("id_observacion_sin_clasificar") REFERENCES "observaciones"("id_observacion") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoraciones" ADD CONSTRAINT "valoraciones_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoracion_evidencias" ADD CONSTRAINT "valoracion_evidencias_id_valoracion_fkey" FOREIGN KEY ("id_valoracion") REFERENCES "valoraciones"("id_valoracion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "valoracion_evidencias" ADD CONSTRAINT "valoracion_evidencias_id_evidencia_fkey" FOREIGN KEY ("id_evidencia") REFERENCES "observacion_manifestaciones"("id_evidencia") ON DELETE CASCADE ON UPDATE CASCADE;
