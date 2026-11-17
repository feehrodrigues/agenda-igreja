-- Formato escolhido pela congregacao: "fixed" (sexta e sabado) ou "week" (segunda a sabado).
-- Nulo = usa o formato definido pelo setor no programa.

ALTER TABLE "ProgramChild" ADD COLUMN "format" TEXT;
