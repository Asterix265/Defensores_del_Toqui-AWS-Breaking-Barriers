-- CreateEnum
CREATE TYPE "rol_educadora" AS ENUM ('educadora_parvulos', 'tecnico_parvulos');

-- CreateEnum
CREATE TYPE "sexo_registrado" AS ENUM ('f', 'm', 'x', 'no_informado');

-- CreateEnum
CREATE TYPE "dominio" AS ENUM ('motor_grueso', 'motor_fino', 'lenguaje_comunicacion', 'socioemocional', 'cognitivo');

-- CreateEnum
CREATE TYPE "formato_captura" AS ENUM ('video', 'audio', 'texto', 'foto');

-- CreateEnum
CREATE TYPE "origen_observacion" AS ENUM ('dataset', 'app');

-- CreateEnum
CREATE TYPE "estado_captura" AS ENUM ('procesando', 'borrador_listo', 'confirmada', 'descartada', 'error');

-- CreateEnum
CREATE TYPE "decision_correccion" AS ENUM ('confirmada', 'corregida', 'descartada');

-- CreateEnum
CREATE TYPE "tipo_evento_tiempo" AS ENUM ('inicio', 'borrador_listo', 'confirmacion', 'descarte');

-- DropTable
DROP TABLE "_salud";

-- CreateTable
CREATE TABLE "jardines" (
    "id_jardin" TEXT NOT NULL,
    "nombre_fantasia" TEXT NOT NULL,
    "comuna" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "numero_salas" INTEGER NOT NULL,
    "numero_educadoras" INTEGER NOT NULL,

    CONSTRAINT "jardines_pkey" PRIMARY KEY ("id_jardin")
);

-- CreateTable
CREATE TABLE "educadoras" (
    "id_educadora" TEXT NOT NULL,
    "id_jardin" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "rol" "rol_educadora" NOT NULL,
    "anios_experiencia" INTEGER NOT NULL,

    CONSTRAINT "educadoras_pkey" PRIMARY KEY ("id_educadora")
);

-- CreateTable
CREATE TABLE "ninos" (
    "id_nino" TEXT NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "sexo_registrado" "sexo_registrado" NOT NULL,
    "id_jardin" TEXT NOT NULL,
    "sala_grupo" TEXT NOT NULL,
    "fecha_ingreso" DATE NOT NULL,

    CONSTRAINT "ninos_pkey" PRIMARY KEY ("id_nino")
);

-- CreateTable
CREATE TABLE "ruta_niveles" (
    "nivel" INTEGER NOT NULL,
    "nombre_nivel" TEXT NOT NULL,
    "edad_min_meses" INTEGER NOT NULL,
    "edad_max_meses" INTEGER NOT NULL,
    "dominios" "dominio"[],
    "descripcion" TEXT NOT NULL,

    CONSTRAINT "ruta_niveles_pkey" PRIMARY KEY ("nivel")
);

-- CreateTable
CREATE TABLE "manifestaciones" (
    "id_manifestacion" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "dominio" "dominio" NOT NULL,
    "texto_observable" TEXT NOT NULL,

    CONSTRAINT "manifestaciones_pkey" PRIMARY KEY ("id_manifestacion")
);

-- CreateTable
CREATE TABLE "observaciones" (
    "id_observacion" TEXT NOT NULL,
    "id_nino" TEXT NOT NULL,
    "id_educadora" TEXT,
    "id_usuario" TEXT,
    "fecha_observacion" DATE NOT NULL,
    "formato_captura" "formato_captura" NOT NULL,
    "nivel_estimado" INTEGER NOT NULL,
    "nota_breve" TEXT,
    "origen" "origen_observacion" NOT NULL DEFAULT 'dataset',
    "id_captura" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observaciones_pkey" PRIMARY KEY ("id_observacion")
);

-- CreateTable
CREATE TABLE "observacion_manifestaciones" (
    "id_observacion" TEXT NOT NULL,
    "id_manifestacion" TEXT NOT NULL,
    "cita" TEXT,

    CONSTRAINT "observacion_manifestaciones_pkey" PRIMARY KEY ("id_observacion","id_manifestacion")
);

-- CreateTable
CREATE TABLE "capturas" (
    "id_captura" UUID NOT NULL,
    "id_nino" TEXT NOT NULL,
    "id_jardin" TEXT NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "formato" "formato_captura" NOT NULL,
    "texto" TEXT,
    "archivo_clave" TEXT,
    "archivo_tipo" TEXT,
    "estado" "estado_captura" NOT NULL DEFAULT 'procesando',
    "error_detalle" TEXT,
    "fecha" DATE NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capturas_pkey" PRIMARY KEY ("id_captura")
);

-- CreateTable
CREATE TABLE "borradores" (
    "id" UUID NOT NULL,
    "id_captura" UUID NOT NULL,
    "texto_fuente" TEXT NOT NULL,
    "nivel_sugerido" INTEGER,
    "manifestaciones" JSONB NOT NULL,
    "evidencia_insuficiente" BOOLEAN NOT NULL,
    "proveedor" TEXT NOT NULL,
    "modelo" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "correcciones" (
    "id" UUID NOT NULL,
    "id_captura" UUID NOT NULL,
    "id_usuario" TEXT NOT NULL,
    "decision" "decision_correccion" NOT NULL,
    "sugerencia" JSONB NOT NULL,
    "final" JSONB,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correcciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eventos_tiempo" (
    "id" UUID NOT NULL,
    "id_captura" UUID NOT NULL,
    "tipo" "tipo_evento_tiempo" NOT NULL,
    "ocurrio_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eventos_tiempo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jardines_nombre_fantasia_key" ON "jardines"("nombre_fantasia");

-- CreateIndex
CREATE INDEX "educadoras_id_jardin_idx" ON "educadoras"("id_jardin");

-- CreateIndex
CREATE INDEX "ninos_id_jardin_sala_grupo_idx" ON "ninos"("id_jardin", "sala_grupo");

-- CreateIndex
CREATE INDEX "manifestaciones_nivel_dominio_idx" ON "manifestaciones"("nivel", "dominio");

-- CreateIndex
CREATE UNIQUE INDEX "observaciones_id_captura_key" ON "observaciones"("id_captura");

-- CreateIndex
CREATE INDEX "observaciones_id_nino_fecha_observacion_idx" ON "observaciones"("id_nino", "fecha_observacion");

-- CreateIndex
CREATE INDEX "capturas_id_jardin_fecha_idx" ON "capturas"("id_jardin", "fecha");

-- CreateIndex
CREATE INDEX "capturas_id_usuario_fecha_idx" ON "capturas"("id_usuario", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "borradores_id_captura_key" ON "borradores"("id_captura");

-- CreateIndex
CREATE UNIQUE INDEX "correcciones_id_captura_key" ON "correcciones"("id_captura");

-- CreateIndex
CREATE UNIQUE INDEX "eventos_tiempo_id_captura_tipo_key" ON "eventos_tiempo"("id_captura", "tipo");

-- AddForeignKey
ALTER TABLE "educadoras" ADD CONSTRAINT "educadoras_id_jardin_fkey" FOREIGN KEY ("id_jardin") REFERENCES "jardines"("id_jardin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ninos" ADD CONSTRAINT "ninos_id_jardin_fkey" FOREIGN KEY ("id_jardin") REFERENCES "jardines"("id_jardin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manifestaciones" ADD CONSTRAINT "manifestaciones_nivel_fkey" FOREIGN KEY ("nivel") REFERENCES "ruta_niveles"("nivel") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_id_nino_fkey" FOREIGN KEY ("id_nino") REFERENCES "ninos"("id_nino") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_id_educadora_fkey" FOREIGN KEY ("id_educadora") REFERENCES "educadoras"("id_educadora") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_nivel_estimado_fkey" FOREIGN KEY ("nivel_estimado") REFERENCES "ruta_niveles"("nivel") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion_manifestaciones" ADD CONSTRAINT "observacion_manifestaciones_id_observacion_fkey" FOREIGN KEY ("id_observacion") REFERENCES "observaciones"("id_observacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observacion_manifestaciones" ADD CONSTRAINT "observacion_manifestaciones_id_manifestacion_fkey" FOREIGN KEY ("id_manifestacion") REFERENCES "manifestaciones"("id_manifestacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capturas" ADD CONSTRAINT "capturas_id_nino_fkey" FOREIGN KEY ("id_nino") REFERENCES "ninos"("id_nino") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capturas" ADD CONSTRAINT "capturas_id_jardin_fkey" FOREIGN KEY ("id_jardin") REFERENCES "jardines"("id_jardin") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borradores" ADD CONSTRAINT "borradores_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones" ADD CONSTRAINT "correcciones_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tiempo" ADD CONSTRAINT "eventos_tiempo_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE RESTRICT ON UPDATE CASCADE;

