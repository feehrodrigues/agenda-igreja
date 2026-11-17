import { test } from "node:test";
import assert from "node:assert/strict";
import { coresDasRegioes, datasLiberadasDoPrograma, montarGrade } from "./grade.js";

const programa = {
  startsAt: new Date("2027-02-01T00:00:00Z"),
  endsAt: new Date("2027-03-15T00:00:00Z"),
  regions: [{ name: "A" }, { name: "B" }],
  departments: [{ id: "d1", name: "Varões", active: true }],
  children: [{ roomId: "r1", regionId: "A", departments: [{ departmentId: "d1" }] }],
};

test("todos os dias do período estão liberados (sem restrição de formato)", () => {
  const grade = montarGrade({ programa, solicitacoes: [] });
  assert.deepEqual(
    grade.meses.map((m) => [m.nome, m.ano]),
    [
      ["Fevereiro", 2027],
      ["Março", 2027],
    ],
  );
  for (const mes of grade.meses) {
    assert.ok(mes.dias.length > 0);
    for (const dia of mes.dias) {
      assert.equal(dia.liberado, true);
      // Não há mais restrição de "sexta/sábado só": todos os dias estão liberados
    }
  }
});

test("cabeçalho do mês conta festividades, aguardando e percentual enviado", () => {
  const grade = montarGrade({
    programa,
    solicitacoes: [
      {
        id: "s1",
        roomId: "r1",
        sala: "Cong. Jardim",
        departmentId: "d1",
        departamento: "Varões",
        start: new Date("2027-02-05T19:00:00Z"),
        end: new Date("2027-02-05T21:00:00Z"),
        status: "enviada",
        regiao: "A",
      },
    ],
  });
  const fevereiro = grade.meses[0];
  assert.equal(fevereiro.festividades, 1);
  assert.equal(fevereiro.aguardando, 1);
  assert.equal(fevereiro.congregacoes, 1);
  assert.equal(fevereiro.percentual, 100);
  assert.equal(grade.meses[1].festividades, 0);
  assert.equal(grade.solicitacoes[0].corRegiao, "#6366f1");
});

test("cores das regiões são estáveis entre filtro e cartão", () => {
  assert.deepEqual(coresDasRegioes([{ name: "A" }, { name: "B" }]), {
    A: "#6366f1",
    B: "#0d9488",
  });
});

test("datas liberadas pelo setor substituem a regra do formato", () => {
  // Só dois dias soltos, sendo uma terça e uma quarta: nada de sexta/sábado.
  const comDatas = {
    ...programa,
    releasedDays: [
      { date: new Date("2027-02-09T00:00:00Z") },
      { date: new Date("2027-02-10T00:00:00Z") },
    ],
  };
  const grade = montarGrade({ programa: comDatas, solicitacoes: [] });
  assert.deepEqual(
    grade.meses.map((m) => m.dias.map((d) => d.chave)).flat(),
    ["2027-02-09", "2027-02-10"],
  );
  assert.equal(grade.meses.length, 1);
});

test("sem datas do setor, o filtro volta para a regra do formato", () => {
  assert.equal(datasLiberadasDoPrograma({ format: "fixed" }), null);
  const dias = datasLiberadasDoPrograma({
    releasedDays: [{ date: new Date("2027-02-09T00:00:00Z") }],
  });
  assert.equal(dias.has("2027-02-09"), true);
  assert.equal(dias.size, 1);
});

test("congregação pode escolher segunda a sábado", () => {
  const comFormato = {
    ...programa,
    children: [
      { roomId: "r1", regionId: "A", format: "week", departments: [{ departmentId: "d1" }] },
    ],
  };
  const grade = montarGrade({ programa: comFormato, solicitacoes: [], idSalaAtual: "r1" });
  assert.equal(grade.dias.every((dia) => dia.liberado), true);
  const liberados = grade.meses.flatMap((mes) => mes.dias.map((dia) => dia.chave));
  assert.equal(liberados.length, grade.dias.length);
  assert.ok(liberados.includes("2027-02-03"), "quarta-feira deve entrar no formato da semana");
});

test("sem escolha da congregação, todos os dias são liberados", () => {
  const grade = montarGrade({ programa, solicitacoes: [], idSalaAtual: "r1" });
  for (const dia of grade.meses.flatMap((mes) => mes.dias)) {
    assert.equal(dia.liberado, true);
  }
});

test("datas do setor vencem o formato escolhido pela congregação", () => {
  const comFormato = {
    ...programa,
    releasedDays: [{ date: new Date("2027-02-09T00:00:00Z") }],
    children: [
      { roomId: "r1", regionId: "A", format: "week", departments: [{ departmentId: "d1" }] },
    ],
  };
  const grade = montarGrade({ programa: comFormato, solicitacoes: [], idSalaAtual: "r1" });
  assert.deepEqual(
    grade.meses.flatMap((mes) => mes.dias.map((dia) => dia.chave)),
    ["2027-02-09"],
  );
});
