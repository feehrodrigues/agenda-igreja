-- Cor por região (agrupamento) definida pelo pai para os filhos.
ALTER TABLE "Room" ADD COLUMN IF NOT EXISTS "groupColor" TEXT;
