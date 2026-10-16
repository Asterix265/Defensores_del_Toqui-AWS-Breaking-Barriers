-- Borrar una captura borra su borrador, corrección y eventos (endurecer-seguridad-aws, D7).
-- observaciones.id_captura ya era ON DELETE SET NULL: la observación confirmada se conserva.

-- DropForeignKey
ALTER TABLE "borradores" DROP CONSTRAINT "borradores_id_captura_fkey";

-- DropForeignKey
ALTER TABLE "correcciones" DROP CONSTRAINT "correcciones_id_captura_fkey";

-- DropForeignKey
ALTER TABLE "eventos_tiempo" DROP CONSTRAINT "eventos_tiempo_id_captura_fkey";

-- AddForeignKey
ALTER TABLE "borradores" ADD CONSTRAINT "borradores_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correcciones" ADD CONSTRAINT "correcciones_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos_tiempo" ADD CONSTRAINT "eventos_tiempo_id_captura_fkey" FOREIGN KEY ("id_captura") REFERENCES "capturas"("id_captura") ON DELETE CASCADE ON UPDATE CASCADE;
