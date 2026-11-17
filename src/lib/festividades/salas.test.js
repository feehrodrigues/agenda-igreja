import test from "node:test";
import assert from "node:assert/strict";
import { congregacoesAbaixo } from "./salas.js";

const salas = [
  { id: "min", name: "Ministério", type: "ministerio", parentId: null },
  { id: "setor1", name: "Setor 1", type: "setor", parentId: "min" },
  { id: "setor2", name: "Setor 2", type: "setor", parentId: "min" },
  { id: "cong1", name: "A - Uma", type: "congregacao", parentId: "setor1" },
  { id: "cong2", name: "B - Duas", type: "congregacao", parentId: "setor1" },
  { id: "cong3", name: "C - Três", type: "congregacao", parentId: "setor2" },
  { id: "fora", name: "Outra", type: "congregacao", parentId: "outro" },
];

test("setor pega só as congregações dele", () => {
  const r = congregacoesAbaixo(salas, "setor1").map((s) => s.id);
  assert.deepEqual(r.sort(), ["cong1", "cong2"]);
});

test("ministério pega as congregações de todos os setores abaixo", () => {
  const r = congregacoesAbaixo(salas, "min").map((s) => s.id);
  assert.deepEqual(r.sort(), ["cong1", "cong2", "cong3"]);
});

test("setor e ministério não entram na lista", () => {
  const r = congregacoesAbaixo(salas, "min");
  assert.ok(r.every((s) => !["setor", "ministerio"].includes(s.type)));
});

test("congregação de fora não entra", () => {
  const r = congregacoesAbaixo(salas, "min").map((s) => s.id);
  assert.ok(!r.includes("fora"));
});

test("sem filhos devolve lista vazia", () => {
  assert.deepEqual(congregacoesAbaixo(salas, "cong1"), []);
});
