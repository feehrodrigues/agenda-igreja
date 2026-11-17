"use client";

import { useState } from "react";
import { GradeSolicitacoes } from "../painel";
import { EditorDatas } from "../editor-datas";
import { montarGrade } from "@/lib/festividades/grade";

// Dados fictícios só para enxergar a grade/calendário sem banco. Não é usado em produção.
const DEPARTAMENTOS = [
  { id: "d1", name: "Varões", active: true },
  { id: "d2", name: "UMADEB", active: true },
  { id: "d3", name: "CREIO", active: true },
  { id: "d4", name: "UFADEB", active: true },
  { id: "d5", name: "SEMAD", active: true },
];

const CONGREGACOES = [
  { id: "r1", nome: "Cong. Jardim das Flores", regiao: "A" },
  { id: "r2", nome: "Cong. Vila Nova", regiao: "A" },
  { id: "r3", nome: "Cong. São Judas", regiao: "B" },
  { id: "r4", nome: "Cong. Boa Vista", regiao: "B" },
  { id: "r5", nome: "Cong. Nova Aliança", regiao: "C" },
  { id: "r6", nome: "Cong. Novo Horizonte", regiao: "C" },
];

const STATUS_CICLO = ["aprovada", "aprovada", "enviada", "analise", "aprovada", "enviada", "aprovada"];

const programa = {
  name: "Programa de Festividade 2027",
  startsAt: new Date("2026-11-01T00:00:00Z"),
  endsAt: new Date("2027-01-31T00:00:00Z"),
  regions: ["A", "B", "C"].map((nome) => ({ name: nome })),
  departments: DEPARTAMENTOS,
  children: CONGREGACOES.map((c) => ({
    roomId: c.id,
    departments: DEPARTAMENTOS.map((d) => ({ departmentId: d.id })),
  })),
};

function diasLiberados() {
  const dias = [];
  const cursor = new Date(programa.startsAt);
  while (cursor <= programa.endsAt) {
    if (cursor.getUTCDay() === 5 || cursor.getUTCDay() === 6) {
      dias.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

function solicitacoesFicticias() {
  const lista = [];
  diasLiberados().forEach((chave, indiceDia) => {
    const quantidade = 2 + (indiceDia % 3);
    for (let n = 0; n < quantidade; n += 1) {
      const congregacao = CONGREGACOES[(indiceDia * 2 + n * 3) % CONGREGACOES.length];
      const departamento = DEPARTAMENTOS[(indiceDia + n * 2) % DEPARTAMENTOS.length];
      const status = STATUS_CICLO[(indiceDia + n) % STATUS_CICLO.length];
      const inicio = new Date(`${chave}T22:00:00Z`); // 19h em Brasília
      lista.push({
        id: `${chave}-${n}`,
        roomId: congregacao.id,
        sala: congregacao.nome,
        departmentId: departamento.id,
        departamento: departamento.name,
        start: inicio,
        end: new Date(inicio.getTime() + 2 * 60 * 60 * 1000),
        status,
        motivo: status === "rejeitada" ? "Mesma região já ocupava o dia." : null,
        regiao: congregacao.regiao,
      });
    }
  });
  return lista;
}

const grade = montarGrade({ programa, solicitacoes: solicitacoesFicticias() });

// Prévia da aba "Datas": algumas semanas liberadas e alguns dias soltos.
const DATAS_DEMO = grade.dias
  .filter((d) => d.liberado)
  .filter((d) => {
    const numero = Number(d.chave.slice(8, 10));
    return numero <= 14 || d.chave.endsWith("-25") || d.chave.endsWith("-26");
  })
  .map((d) => d.chave);

const DIAS_COM_PEDIDO = [...new Set(grade.solicitacoes.map((s) => s.dia))];

export default function PreviewCliente() {
  const [secao, setSecao] = useState("programa");

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-800">
              prévia local · dados fictícios
            </span>
            <span className="text-[11px] text-slate-500">
              Só existe em desenvolvimento (`/programas/preview`). Nada é salvo.
            </span>
          </div>
          <h1 className="text-2xl font-black">{programa.name}</h1>
          <p className="text-sm text-slate-500">
            {programa.startsAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a{" "}
            {programa.endsAt.toLocaleDateString("pt-BR", { timeZone: "UTC" })} · todos os dias liberados · 6 congregações
          </p>
        </header>

        <nav className="inline-flex w-fit rounded-xl border border-slate-200 bg-white p-1">
          {[
            { id: "programa", rotulo: "Programa" },
            { id: "datas", rotulo: "Datas liberadas (setor)" },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSecao(s.id)}
              aria-pressed={secao === s.id}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                secao === s.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {s.rotulo}
            </button>
          ))}
        </nav>

        {secao === "programa" ? (
          <GradeSolicitacoes grade={grade} programId="preview" regioes={programa.regions} />
        ) : (
          <EditorDatas
            programId="preview"
            inicio={programa.startsAt.toISOString()}
            fim={programa.endsAt.toISOString()}
            liberadas={DATAS_DEMO}
            usadas={DIAS_COM_PEDIDO}
            demo
          />
        )}
      </div>
    </div>
  );
}
