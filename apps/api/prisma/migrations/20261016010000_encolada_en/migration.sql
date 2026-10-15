-- Envío único de cada captura a procesar (cola-ia-y-amplify, D2).
ALTER TABLE "capturas" ADD COLUMN "encolada_en" TIMESTAMP(3);
