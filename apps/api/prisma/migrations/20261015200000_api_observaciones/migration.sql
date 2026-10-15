-- CreateEnum
CREATE TYPE "rol" AS ENUM ('registrador', 'supervisor');

-- CreateEnum
CREATE TYPE "tipo_captura" AS ENUM ('texto', 'audio', 'foto');

-- CreateEnum
CREATE TYPE "estado_observacion" AS ENUM ('pendiente', 'procesando', 'propuesta', 'confirmada', 'corregida', 'validada', 'error');

-- CreateEnum
CREATE TYPE "origen_revision" AS ENUM ('registrador', 'supervisor');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "rol" "rol" NOT NULL,
    "nombre" TEXT,
    "telefono" TEXT,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "criterios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observaciones" (
    "id" UUID NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "tipo" "tipo_captura" NOT NULL,
    "texto" TEXT,
    "archivo_clave" TEXT,
    "archivo_tipo" TEXT,
    "texto_extraido" TEXT,
    "estado" "estado_observacion" NOT NULL DEFAULT 'pendiente',
    "criterio_propuesto_id" TEXT,
    "confianza" DOUBLE PRECISION,
    "opciones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audio_propuesta_clave" TEXT,
    "criterio_id" TEXT,
    "error_detalle" TEXT,
    "fecha" DATE NOT NULL,
    "validado_por_id" TEXT,
    "validado_en" TIMESTAMP(3),
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "observaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisiones" (
    "id" UUID NOT NULL,
    "observacion_id" UUID NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "origen" "origen_revision" NOT NULL,
    "criterio_id" TEXT NOT NULL,
    "coincide_con_propuesta" BOOLEAN NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisiones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejemplos" (
    "id" UUID NOT NULL,
    "observacion_id" UUID NOT NULL,
    "origen" "origen_revision" NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "criterio_id" TEXT NOT NULL,
    "peso" DOUBLE PRECISION NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ejemplos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "observaciones_usuario_id_fecha_idx" ON "observaciones"("usuario_id", "fecha");

-- CreateIndex
CREATE INDEX "observaciones_fecha_estado_idx" ON "observaciones"("fecha", "estado");

-- CreateIndex
CREATE INDEX "observaciones_criterio_id_idx" ON "observaciones"("criterio_id");

-- CreateIndex
CREATE INDEX "revisiones_observacion_id_idx" ON "revisiones"("observacion_id");

-- CreateIndex
CREATE UNIQUE INDEX "ejemplos_observacion_id_origen_key" ON "ejemplos"("observacion_id", "origen");

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_validado_por_id_fkey" FOREIGN KEY ("validado_por_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_criterio_propuesto_id_fkey" FOREIGN KEY ("criterio_propuesto_id") REFERENCES "criterios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observaciones" ADD CONSTRAINT "observaciones_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "criterios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones" ADD CONSTRAINT "revisiones_observacion_id_fkey" FOREIGN KEY ("observacion_id") REFERENCES "observaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones" ADD CONSTRAINT "revisiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisiones" ADD CONSTRAINT "revisiones_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "criterios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejemplos" ADD CONSTRAINT "ejemplos_observacion_id_fkey" FOREIGN KEY ("observacion_id") REFERENCES "observaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejemplos" ADD CONSTRAINT "ejemplos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejemplos" ADD CONSTRAINT "ejemplos_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "criterios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

