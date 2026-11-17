-- Datas liberadas pelo setor para as congregacoes pedirem.
-- Quando nao ha nenhuma linha, vale a regra do formato (fixo: sexta e sabado).

CREATE TABLE "ProgramReleasedDay" (
    "programId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgramReleasedDay_pkey" PRIMARY KEY ("programId","date")
);

ALTER TABLE "ProgramReleasedDay" ADD CONSTRAINT "ProgramReleasedDay_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;
