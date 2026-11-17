"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salvarDatasLiberadas } from "./actions";

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const chaveDe = (data) => data.toISOString().slice(0, 10);
const deChave = (chave) => new Date(`${chave}T00:00:00Z`);

function mesesDoPeriodo(inicio, fim) {
  const meses = new Map();
  const cursor = deChave(inicio);
  const limite = deChave(fim);
  while (cursor <= limite) {
    const chave = chaveDe(cursor).slice(0, 7);
    if (!meses.has(chave)) {
      meses.set(chave, { chave, ano: cursor.getUTCFullYear(), mes: cursor.getUTCMonth(), dias: [] });
    }
    meses.get(chave).dias.push(chaveDe(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...meses.values()];
}

// Semanas do mês por número do dia: 1–7, 8–14, 15–21, 22–28, 29–31.
function diasDaSemana(dias, semana) {
  return dias.filter((chave) => {
    const numero = Number(chave.slice(8, 10));
    return Math.ceil(numero / 7) === semana;
  });
}

function Celula({ chave, selecionado, usado, hoje, onClick }) {
  const data = deChave(chave);
  const diaSemana = data.getUTCDay();
  const numero = data.getUTCDate();
  const titulo = `${DIAS_LONGOS[diaSemana]}, ${numero} de ${MESES[data.getUTCMonth()].toLowerCase()}${usado ? " · já tem pedido" : ""}`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-pressed={selecionado}
      className={`relative grid h-10 place-items-center rounded-lg border text-sm font-bold tabular-nums transition ${
        selecionado
          ? "border-emerald-500 bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
          : diaSemana === 0 || diaSemana === 6
            ? "border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:bg-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
      } ${hoje ? "ring-2 ring-indigo-400 ring-offset-1" : ""}`}
    >
      {numero}
      {usado && (
        <span
          className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
            selecionado ? "bg-white/80" : "bg-amber-500"
          }`}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

function Chip({ children, onClick, tom = "neutro" }) {
  const cores = {
    neutro: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
    verde: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    limpar: "border-slate-200 bg-white text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${cores[tom]}`}
    >
      {children}
    </button>
  );
}

// Editor de datas liberadas: o setor marca no calendário os dias que as congregações podem pedir.
export function EditorDatas({
  programId,
  inicio,
  fim,
  liberadas = [],
  usadas = [],
  demo = false,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sel, setSel] = useState(() => new Set(liberadas.map((d) => String(d).slice(0, 10))));
  const [salvas, setSalvas] = useState(() => new Set(liberadas.map((d) => String(d).slice(0, 10))));
  const [estado, setEstado] = useState(null);

  const chaveInicio = String(inicio).slice(0, 10);
  const chaveFim = String(fim).slice(0, 10);
  const meses = useMemo(() => mesesDoPeriodo(chaveInicio, chaveFim), [chaveInicio, chaveFim]);
  const hoje = useMemo(() => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), []);
  const diasUsados = useMemo(() => new Set(usadas.map((d) => String(d).slice(0, 10))), [usadas]);

  const alterado =
    sel.size !== salvas.size || [...sel].some((chave) => !salvas.has(chave));
  const removidasComPedido = [...salvas].filter((chave) => !sel.has(chave) && diasUsados.has(chave));

  function alternarData(chave) {
    setEstado(null);
    setSel((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function aplicar(dias, incluir = true) {
    setEstado(null);
    setSel((atual) => {
      const novo = new Set(atual);
      for (const chave of dias) {
        if (incluir) novo.add(chave);
        else novo.delete(chave);
      }
      return novo;
    });
  }

  function salvar() {
    setEstado(null);
    const lista = [...sel].sort();
    if (demo) {
      setSalvas(new Set(lista));
      setEstado({ success: true, demo: true });
      return;
    }
    startTransition(async () => {
      const r = await salvarDatasLiberadas(programId, lista);
      if (r?.error) {
        setEstado(r);
        return;
      }
      setSalvas(new Set(lista));
      setEstado(r);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-black text-slate-900">Datas liberadas para as congregações</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Marque no calendário os dias em que as congregações podem pedir. Pode liberar semanas
              inteiras, só os fins de semana ou dias soltos — o critério é do setor.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Nenhuma data marcada → todos os dias do período ficam liberados.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-2xl font-black tabular-nums text-slate-900">{sel.size}</span>
            <span className="text-xs font-bold leading-tight text-slate-500">
              {sel.size === 1 ? "dia liberado" : "dias liberados"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Atalhos</span>
          <Chip tom="limpar" onClick={() => aplicar(meses.flatMap((m) => m.dias), false)}>
            Limpar tudo
          </Chip>
          <span className="mx-1 h-4 w-px bg-slate-200" aria-hidden="true" />
          {meses.map((m) => (
            <Chip
              key={`atalho-${m.chave}`}
              onClick={() =>
                aplicar(
                  m.dias.filter((chave) => [5, 6].includes(deChave(chave).getUTCDay())),
                  true,
                )
              }
            >
              {MESES[m.mes].slice(0, 3)} · sex + sáb
            </Chip>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {meses.map((m) => {
          const liberadosNoMes = m.dias.filter((chave) => sel.has(chave)).length;
          const primeiro = deChave(m.dias[0]).getUTCDay();
          const ultimo = deChave(m.dias[m.dias.length - 1]).getUTCDay();
          const celulas = [
            ...Array.from({ length: primeiro }, () => null),
            ...m.dias,
            ...Array.from({ length: 6 - ultimo }, () => null),
          ];

          return (
            <section key={m.chave} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-slate-900">
                  {MESES[m.mes]} <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{m.ano}</span>
                </h3>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${
                    liberadosNoMes > 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {liberadosNoMes} {liberadosNoMes === 1 ? "dia" : "dias"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {[1, 2, 3, 4, 5].map((semana) => {
                  const dias = diasDaSemana(m.dias, semana);
                  if (dias.length === 0) return null;
                  const completa = dias.every((chave) => sel.has(chave));
                  return (
                    <Chip
                      key={`${m.chave}-semana-${semana}`}
                      tom={completa ? "verde" : "neutro"}
                      onClick={() => aplicar(dias, !completa)}
                    >
                      {semana}ª semana
                    </Chip>
                  );
                })}
                <Chip tom="limpar" onClick={() => aplicar(m.dias, false)}>
                  Limpar mês
                </Chip>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1">
                {DIAS_CURTOS.map((dia, indice) => (
                  <div
                    key={`${m.chave}-${dia}`}
                    className={`pb-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                      indice === 0 || indice === 6 ? "text-slate-300" : "text-slate-400"
                    }`}
                  >
                    {dia}
                  </div>
                ))}
                {celulas.map((chave, indice) =>
                  chave ? (
                    <Celula
                      key={chave}
                      chave={chave}
                      selecionado={sel.has(chave)}
                      usado={diasUsados.has(chave)}
                      hoje={chave === hoje}
                      onClick={() => alternarData(chave)}
                    />
                  ) : (
                    <div key={`${m.chave}-vazio-${indice}`} />
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>

      <section className="sticky bottom-3 z-30 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <button
          type="button"
          onClick={salvar}
          disabled={pending || !alterado}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-40"
        >
          {pending ? "Salvando…" : "Salvar datas"}
        </button>
        {alterado && (
          <span className="text-xs font-bold text-amber-700">Alterações não salvas</span>
        )}
        {!alterado && sel.size === 0 && (
          <span className="text-xs text-slate-500">
            Sem datas marcadas: todos os dias do período ficam liberados.
          </span>
        )}
        {removidasComPedido.length > 0 && (
          <span className="text-xs font-bold text-amber-700">
            ⚠ {removidasComPedido.length}{" "}
            {removidasComPedido.length === 1 ? "dia removido já tem" : "dias removidos já têm"} pedido
            — os pedidos existentes não são apagados.
          </span>
        )}
        {estado?.error && <span className="text-sm font-bold text-red-600">{estado.error}</span>}
        {estado?.success && (
          <span className="text-sm font-bold text-emerald-700">
            {estado.demo ? "Prévia: nada foi salvo de verdade." : "Datas salvas."}
          </span>
        )}
        {diasUsados.size > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            dia com pedido
          </span>
        )}
      </section>
    </div>
  );
}
