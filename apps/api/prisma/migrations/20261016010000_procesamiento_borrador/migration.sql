-- Entrada procesada y estado de cada paso del pipeline (persistir-capturas).
ALTER TABLE "borradores" ADD COLUMN "procesamiento" JSONB;
