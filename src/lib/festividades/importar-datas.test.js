import { test } from "node:test";
import assert from "node:assert/strict";
import { extrairDatas } from "./importar-datas.js";

const inicio = "2027-02-01";
const fim = "2027-03-15";

test("reconhece datas com barra, traço e ISO", () => {
  const texto = "05/02 Culto\n12-02/2027 Palestra\n2027-02-19 Festividade";
  assert.deepEqual(extrairDatas(texto, inicio, fim).datas, ["2027-02-05", "2027-02-12", "2027-02-19"]);
});

test("sem ano, usa o ano do período e ignora o que está fora", () => {
  const texto = "01/02 começa\n28/02 termina\n20/03 fora\n31/02 inválida";
  const { datas, fora } = extrairDatas(texto, inicio, fim);
  assert.deepEqual(datas, ["2027-02-01", "2027-02-28"]);
  assert.equal(fora, 2);
});

test("período que cruza o ano encontra o ano certo", () => {
  const { datas } = extrairDatas("10/12 e 05/01", "2026-11-01", "2027-01-31");
  assert.deepEqual(datas, ["2026-12-10", "2027-01-05"]);
});

test("ano com dois dígitos é lido como 20xx", () => {
  assert.deepEqual(extrairDatas("05/02/27", inicio, fim).datas, ["2027-02-05"]);
});

test("texto sem datas não inventa nada", () => {
  assert.deepEqual(extrairDatas("Nenhuma data aqui", inicio, fim), { datas: [], fora: 0 });
});
