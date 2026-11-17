"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FormRapido } from "./formularios";

export const ROTULO_STATUS = {
  enviada: "Enviada",
  em_analise: "Em análise",
  aprovada: "Aprovada",
  rejeitada: "Recusada",
};

const COR_STATUS = {
  aprovada: "#10b981",
  enviada: "#f59e0b",
  em_analise: "#3b82f6",
  rejeitada: "#cbd5e1",
};

const DENSIDADES = [
  { id: "confortavel", rotulo: "Confortável" },
  { id: "compacto", rotulo: "Compacto" },
  { id: "lista", rotulo: "Lista" },
];

const VISOES = [
  { id: "grade", rotulo: "Grade" },
  { id: "calendario", rotulo: "Calendário" },
];

const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Células do mês (domingo primeiro), com buracos nas pontas.
function celulasDoMes(chaveMes) {
  const [ano, mes] = chaveMes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas = Array.from({ length: primeiro.getUTCDay() }, () => null);
  for (let dia = 1; dia <= total; dia += 1) celulas.push(Date.UTC(ano, mes - 1, dia));
  while (celulas.length % 7 !== 0) celulas.push(null);
  return celulas;
}

const STATUS_ABERTOS = ["enviada", "em_analise"];

function alternar(lista, setLista, id) {
  setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
}

// Atualiza a grade sem recarregar a página, enquanto a aba estiver visível.
export function AtualizacaoAutomatica({ intervaloMs = 10000 }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [router, intervaloMs]);
  return null;
}

function Legenda() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-500">
      {Object.entries(ROTULO_STATUS).map(([status, rotulo]) => (
        <span key={status} className="flex items-center gap-1.5 font-semibold">
          <span className="inline-block w-[3px] h-3.5 rounded-full" style={{ backgroundColor: COR_STATUS[status] }} />
          {rotulo}
        </span>
      ))}
      <span className="flex items-center gap-1.5 font-semibold">
        <span className="inline-block w-[3px] h-3.5 rounded-full bg-indigo-500" /> Minha congregação
      </span>
      <span className="flex items-center gap-1 font-semibold text-amber-600">⚠ Mesma região no dia</span>
    </div>
  );
}

function Modal({ titulo, onFechar, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onFechar}>
      <div className="bg-slate-50 rounded-2xl p-5 w-full max-w-md grid gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-black">{titulo}</h3>
          <button type="button" onClick={onFechar} className="text-slate-500 hover:text-slate-900 text-2xl leading-none">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetalheSolicitacao({ item, onFechar }) {
  return (
    <Modal titulo="Detalhes da solicitação" onFechar={onFechar}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-slate-500">Congregação</dt>
        <dd className="font-bold">{item.sala}</dd>
        <dt className="text-slate-500">Departamento</dt>
        <dd>{item.departamento}</dd>
        <dt className="text-slate-500">Horário</dt>
        <dd className="tabular-nums">
          {item.hora} às {item.horaFim}
        </dd>
        <dt className="text-slate-500">Situação</dt>
        <dd>{ROTULO_STATUS[item.status] ?? item.status}</dd>
        {item.regiao && (
          <>
            <dt className="text-slate-500">Região</dt>
            <dd>{item.regiao}</dd>
          </>
        )}
        {item.motivo && (
          <>
            <dt className="text-slate-500">Motivo</dt>
            <dd>{item.motivo}</dd>
          </>
        )}
      </dl>
      {item.conflito && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
          Outra congregação da mesma região tem festividade neste dia.
        </p>
      )}
    </Modal>
  );
}

function ChipFiltro({ ativo, onClick, cor, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
        ativo
          ? "border-indigo-300 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
      }`}
    >
      {cor && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cor }} />}
      {children}
    </button>
  );
}

function CabecalhoMes({ mes, fechado, onAlternar }) {
  return (
    <button
      type="button"
      onClick={onAlternar}
      className="sticky top-[58px] z-20 w-full flex flex-wrap items-center gap-x-4 gap-y-2 rounded-t-2xl px-4 py-3 text-left border-b border-slate-200 bg-white hover:bg-slate-50/60"
    >
      <span className="text-lg font-black tracking-tight text-slate-900">
        {mes.nome} <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{mes.ano}</span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums">
          {mes.festividades} {mes.festividades === 1 ? "festividade" : "festividades"}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${
            mes.aguardando > 0
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {mes.aguardando} aguardando
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600 tabular-nums">
          {mes.congregacoes} {mes.congregacoes === 1 ? "congregação" : "congregações"}
        </span>
      </span>
      <span className="ml-auto flex items-center gap-2 w-36">
        <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <span className="block h-full rounded-full bg-emerald-500" style={{ width: `${mes.percentual}%` }} />
        </span>
        <span className="text-[11px] font-bold text-slate-500 tabular-nums whitespace-nowrap">{mes.percentual}%</span>
      </span>
      <span className="text-slate-400 text-sm">{fechado ? "▸" : "▾"}</span>
    </button>
  );
}

function CartaoFestividade({ item, compacto, onClick, minha }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden text-left rounded-lg border bg-white shadow-sm hover:shadow-md hover:-translate-y-px transition ${
        compacto ? "px-2 py-1" : "px-2.5 py-1.5"
      } ${
        item.status === "rejeitada" ? "border-dashed border-slate-200" : "border-slate-200"
      } ${minha ? "ring-1 ring-indigo-400" : ""}`}
    >
      <span
        className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full"
        style={{ backgroundColor: COR_STATUS[item.status] ?? "#cbd5e1" }}
      />
      <div
        className={`truncate font-bold text-slate-900 ${
          compacto ? "text-[11px]" : "text-xs"
        } ${item.status === "rejeitada" ? "line-through text-slate-400" : ""}`}
      >
        {item.sala}
      </div>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-1 mt-0.5">
        <span className="text-[10.5px] font-semibold text-slate-600 tabular-nums">{item.hora}–{item.horaFim}</span>
        {item.regiao && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-slate-600">
            <i className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.corRegiao ?? "#94a3b8" }} />
            {item.regiao}
          </span>
        )}
        {item.conflito && (
          <span title="Outra congregação da mesma região neste dia" className="text-[10px] font-bold text-amber-600">
            ⚠
          </span>
        )}
      </div>
    </button>
  );
}

function BotaoPedir({ chave, aberto, mesmaRegiao, outraRegiao, compacto, sempreVisivel, onPedir }) {
  if (aberto === chave) return null;
  return (
    <button
      type="button"
      onClick={onPedir}
      title={
        mesmaRegiao
          ? "Outra congregação da sua região já tem festividade neste dia"
          : outraRegiao
            ? "Há festividade de outra região neste dia (permitido)"
            : "Pedir esta data (19h–21h)"
      }
      className={`rounded-lg border border-dashed text-[11px] font-bold transition-opacity ${
        compacto ? "px-1 py-0.5" : "px-2 py-1.5"
      } ${
        mesmaRegiao
          ? "border-red-300 bg-red-50/70 text-red-600"
          : outraRegiao
            ? "border-amber-300 bg-amber-50/70 text-amber-700"
            : "border-slate-300 bg-indigo-50/40 text-indigo-600"
      } ${sempreVisivel ? "opacity-100" : "opacity-0 group-hover/cell:opacity-100 focus:opacity-100"}`}
    >
      {mesmaRegiao ? "⚠ + Pedir (mesma região)" : "+ Pedir esta data"}
    </button>
  );
}

// Visão de calendário: o mês inteiro em 7 colunas, para bater o olho e decidir.
function CalendarioMes({ mes, liberados, itensDoDia, coresRegiao, onDetalhe }) {
  const celulas = useMemo(() => celulasDoMes(mes.chave), [mes.chave]);
  const porChave = useMemo(() => new Map(liberados.map((dia) => [dia.chave, dia])), [liberados]);
  const hoje = useMemo(() => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }), []);

  return (
    <div className="overflow-x-auto rounded-b-2xl border-t border-slate-200">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DIAS_CURTOS.map((dia, indice) => (
            <div
              key={dia}
              className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest ${
                indice === 0 || indice === 6 ? "text-slate-400" : "text-slate-500"
              }`}
            >
              {dia}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {celulas.map((ms, indice) => {
            if (ms == null) return <div key={`vazio-${indice}`} className="min-h-28 bg-slate-50/70" />;
            const data = new Date(ms);
            const chave = data.toISOString().slice(0, 10);
            const dia = porChave.get(chave) ?? null;
            const ehHoje = chave === hoje;
            const itensDia = itensDoDia(chave);
            return (
              <div key={chave} className={`min-h-28 p-1.5 ${dia ? "bg-white" : "bg-slate-50/80"}`}>
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[12px] font-black tabular-nums ${
                      ehHoje ? "text-indigo-700" : dia ? "text-slate-800" : "text-slate-300"
                    }`}
                  >
                    {data.getUTCDate()}
                  </span>
                  {ehHoje && (
                    <span className="rounded-full bg-indigo-600 px-1 py-px text-[8px] font-bold uppercase text-white">
                      hoje
                    </span>
                  )}
                </div>
                <div className="mt-1 grid gap-1">
                  {itensDia.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onDetalhe(item)}
                      className={`w-full rounded-md border border-l-[3px] border-slate-200 bg-white px-1.5 py-1 text-left text-[10px] leading-tight shadow-sm transition hover:border-slate-300 hover:shadow ${
                        item.minha ? "ring-1 ring-indigo-300" : ""
                      }`}
                      style={{ borderLeftColor: COR_STATUS[item.status] }}
                    >
                      <span className="font-bold tabular-nums text-slate-700">{item.hora}</span>{" "}
                      <span className="font-semibold text-slate-700">{item.sala}</span>
                      <span className="mt-0.5 flex items-center gap-1">
                        {item.regiao && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                            <span
                              className="inline-block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: coresRegiao[item.regiao] ?? "#94a3b8" }}
                            />
                            {item.regiao}
                          </span>
                        )}
                        {item.conflito && <span className="text-[9px] font-bold text-amber-600">⚠</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Grade principal: meses → dias liberados × departamentos.
// podeSolicitar: ids de departamentos onde a sala pode pedir data (vazio para o setor).
export function GradeSolicitacoes({ grade, programId, roomId = null, podeSolicitar = [], regiaoAtual = null, regioes = [] }) {
  const router = useRouter();
  const [densidade, setDensidade] = useState("confortavel");
  const [visao, setVisao] = useState("grade");
  const [regioesSel, setRegioesSel] = useState([]);
  const [depsSel, setDepsSel] = useState([]);
  const [statusSel, setStatusSel] = useState([]);
  const [busca, setBusca] = useState("");
  const [detalhe, setDetalhe] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [fechadas, setFechadas] = useState([]);

  const coresRegiao = grade.coresRegiao ?? {};
  const listaRegioes = useMemo(() => {
    const nomes = regioes.length
      ? regioes.map((r) => (typeof r === "string" ? r : r.name))
      : [...new Set(grade.solicitacoes.map((s) => s.regiao).filter(Boolean))];
    return nomes.filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [grade.solicitacoes, regioes]);

  const itens = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR");
    return grade.solicitacoes.filter((s) => {
      if (s.status === "substituida") return false;
      if (regioesSel.length && !regioesSel.includes(s.regiao ?? "Sem região")) return false;
      if (depsSel.length && !depsSel.includes(s.departmentId)) return false;
      if (statusSel.length && !statusSel.includes(s.status)) return false;
      if (q && !`${s.sala} ${s.departamento} ${s.regiao ?? ""}`.toLocaleLowerCase("pt-BR").includes(q)) return false;
      return true;
    });
  }, [grade.solicitacoes, regioesSel, depsSel, statusSel, busca]);

  const departamentos = depsSel.length
    ? grade.departamentos.filter((d) => depsSel.includes(d.id))
    : grade.departamentos;
  const temFiltro = regioesSel.length + depsSel.length + statusSel.length + (busca.trim() ? 1 : 0) > 0;

  function limpar() {
    setRegioesSel([]);
    setDepsSel([]);
    setStatusSel([]);
    setBusca("");
  }

  function itensDoDia(chave, departamentoId = null) {
    return itens.filter(
      (i) => i.dia === chave && (departamentoId == null || i.departmentId === departamentoId),
    );
  }

  function avisosDoDia(chave) {
    const outros = itens.filter((s) => s.dia === chave && s.roomId !== roomId && s.status !== "rejeitada");
    const mesmaRegiao = !!regiaoAtual && outros.some((s) => s.regiao === regiaoAtual);
    return { mesmaRegiao, outraRegiao: !mesmaRegiao && outros.length > 0 };
  }

  // Nenhum slot tem limite: todas as festividades aparecem empilhadas na célula.
  function renderCartoes(itensDaCelula, compacto) {
    return itensDaCelula.map((item) => (
      <CartaoFestividade
        key={item.id}
        item={item}
        compacto={compacto}
        minha={item.minha}
        onClick={() => setDetalhe(item)}
      />
    ));
  }

  function renderPedido(chave, departamento, dia, compacto, sempreVisivel = false) {
    if (!roomId || !podeSolicitar.includes(departamento.id)) return null;
    if (aberto === chave) {
      return (
        <FormRapido
          programId={programId}
          roomId={roomId}
          departamento={departamento}
          dia={dia.chave}
          onCancelar={() => setAberto(null)}
          onConcluido={() => {
            setAberto(null);
            router.refresh();
          }}
        />
      );
    }
    const { mesmaRegiao, outraRegiao } = avisosDoDia(dia.chave);
    return (
      <BotaoPedir
        chave={chave}
        aberto={aberto}
        mesmaRegiao={mesmaRegiao}
        outraRegiao={outraRegiao}
        compacto={compacto || densidade === "compacto"}
        sempreVisivel={sempreVisivel}
        onPedir={() => setAberto(chave)}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div className="sticky top-0 z-40 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/95 px-3 py-2 shadow-sm backdrop-blur">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {VISOES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVisao(v.id)}
              aria-pressed={visao === v.id}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                visao === v.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {v.rotulo}
            </button>
          ))}
        </div>
        {visao === "grade" && (
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            {DENSIDADES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDensidade(d.id)}
                aria-pressed={densidade === d.id}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                  densidade === d.id ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {d.rotulo}
              </button>
            ))}
          </div>
        )}
        {listaRegioes.length > 0 && (
          <div className="flex flex-wrap gap-1 border-l border-slate-200 pl-2">
            {listaRegioes.map((r) => (
              <ChipFiltro
                key={r}
                cor={coresRegiao[r]}
                ativo={regioesSel.includes(r)}
                onClick={() => alternar(regioesSel, setRegioesSel, r)}
              >
                {r}
              </ChipFiltro>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1 border-l border-slate-200 pl-2">
          {grade.departamentos.map((d) => (
            <ChipFiltro key={d.id} ativo={depsSel.includes(d.id)} onClick={() => alternar(depsSel, setDepsSel, d.id)}>
              {d.name}
            </ChipFiltro>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 border-l border-slate-200 pl-2">
          {Object.entries(ROTULO_STATUS).map(([status, rotulo]) => (
            <ChipFiltro
              key={status}
              cor={COR_STATUS[status]}
              ativo={statusSel.includes(status)}
              onClick={() => alternar(statusSel, setStatusSel, status)}
            >
              {rotulo}
            </ChipFiltro>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar congregação…"
          className="ml-auto w-44 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:ring-2 focus:ring-indigo-300"
        />
        {temFiltro && (
          <button type="button" onClick={limpar} className="text-[11px] font-bold text-slate-500 hover:text-slate-900">
            Limpar
          </button>
        )}
      </div>

      <Legenda />

      <div className="grid gap-4">
        {grade.meses.map((mes) => {
          const fechado = fechadas.includes(mes.chave);
          const dias = temFiltro
            ? mes.dias.filter((dia) => itensDoDia(dia.chave).length > 0 || (roomId && podeSolicitar.length > 0))
            : mes.dias;
          if (dias.length === 0) return null;
          return (
            <section key={mes.chave} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <CabecalhoMes
                mes={mes}
                fechado={fechado}
                onAlternar={() => alternar(fechadas, setFechadas, mes.chave)}
              />
              {!fechado && (
                <>
                  {visao === "calendario" ? (
                    <CalendarioMes
                      mes={mes}
                      liberados={mes.dias}
                      itensDoDia={itensDoDia}
                      coresRegiao={coresRegiao}
                      onDetalhe={setDetalhe}
                    />
                  ) : densidade === "lista" ? (
                    <div className="grid gap-2 rounded-b-2xl p-3">
                      {dias.map((dia) => {
                        const itensDia = itensDoDia(dia.chave);
                        return (
                          <div
                            key={dia.chave}
                            className={`rounded-xl border p-3 ${dia.sabado ? "bg-amber-50/40 border-amber-100" : "bg-white border-slate-200"} ${
                              dia.hoje ? "ring-2 ring-indigo-300" : ""
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-black text-slate-800">
                                {dia.diaSemana}, {dia.numero} {dia.mesCurto}
                                {dia.hoje && (
                                  <span className="ml-2 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                    hoje
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-slate-500 tabular-nums">{itensDia.length}</span>
                            </div>
                            <div className="mt-2 grid gap-1.5">
                              {itensDia.map((item) => (
                                <div key={item.id}>
                                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                                    {item.departamento}
                                  </span>
                                  <CartaoFestividade item={item} onClick={() => setDetalhe(item)} minha={item.minha} />
                                </div>
                              ))}
                            </div>
                            {roomId && podeSolicitar.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {departamentos
                                  .filter((d) => podeSolicitar.includes(d.id))
                                  .map((dep) =>
                                    renderPedido(`${dia.chave}|${dep.id}`, dep, dia, false, true),
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-b-2xl">
                      <table className="w-full border-collapse text-sm" style={{ minWidth: `${180 + departamentos.length * 168}px` }}>
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="sticky left-0 top-0 z-20 w-24 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500">
                              Dia
                            </th>
                            {departamentos.map((d) => (
                              <th
                                key={d.id}
                                className="sticky top-0 z-10 min-w-40 border-b border-slate-200 bg-slate-50 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500"
                              >
                                {d.name}
                                <span className="ml-1.5 text-slate-400 tabular-nums">
                                  {itens.filter((i) => i.departmentId === d.id).length}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {dias.map((dia) => (
                            <tr
                              key={dia.chave}
                              className={dia.sabado ? "bg-amber-50/30" : ""}
                            >
                              <th
                                className={`sticky left-0 z-10 w-24 border-b border-r px-3 py-2 text-left align-top ${
                                  dia.hoje
                                    ? "border-indigo-200 bg-indigo-50 shadow-[inset_3px_0_0_#4f46e5]"
                                    : dia.sabado
                                      ? "border-amber-100 bg-amber-50/50"
                                      : "border-slate-200 bg-white"
                                }`}
                              >
                                <span className="block text-[9px] font-bold uppercase tracking-widest text-slate-400">
                                  {dia.diaSemana}
                                </span>
                                <span className="flex items-baseline gap-1.5 text-slate-800">
                                  <b className="text-lg font-black tabular-nums">{dia.numero}</b>
                                  <em className="text-[10px] not-italic text-slate-400">{dia.mesCurto}</em>
                                </span>
                                {dia.hoje && (
                                  <span className="mt-1 inline-block rounded-full bg-indigo-600 px-1.5 py-px text-[9px] font-bold uppercase text-white">
                                    hoje
                                  </span>
                                )}
                              </th>
                              {departamentos.map((dep) => {
                                const chave = `${dia.chave}|${dep.id}`;
                                const itensCelula = itensDoDia(dia.chave, dep.id);
                                const podePedir = roomId && podeSolicitar.includes(dep.id);
                                return (
                                  <td
                                    key={dep.id}
                                    className={`group/cell border-b border-slate-100 p-1.5 align-top ${dia.hoje ? "bg-indigo-50/40" : ""}`}
                                  >
                                    <div className="grid gap-1">
                                      {renderCartoes(itensCelula, densidade === "compacto")}
                                      {podePedir &&
                                        renderPedido(chave, dep, dia, densidade === "compacto", false)}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>

      {detalhe && <DetalheSolicitacao item={detalhe} onFechar={() => setDetalhe(null)} />}
    </div>
  );
}
