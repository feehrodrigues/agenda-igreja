// Regras puras do programa de festividades. Não acessam banco nem UI.

export const STATUS = {
  ENVIADA: "enviada",
  EM_ANALISE: "em_analise",
  APROVADA: "aprovada",
  REJEITADA: "rejeitada",
  SUBSTITUIDA: "substituida",
};

const STATUS_ABERTOS = [STATUS.ENVIADA, STATUS.EM_ANALISE];

// Compara pelo dia do calendário local, ignorando horário.
function diaDoCalendario(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "forte": mesma região no mesmo dia (não deve acontecer).
// "aviso": regiões diferentes no mesmo dia (aceitável, apenas informar).
// "nenhum": sem choque de dia.
export function classificarConflito(solicitacao, existente) {
  if (!solicitacao || !existente) return "nenhum";
  if (diaDoCalendario(solicitacao.start) !== diaDoCalendario(existente.start)) return "nenhum";
  const mesmaRegiao =
    solicitacao.regionId != null && solicitacao.regionId === existente.regionId;
  return mesmaRegiao ? "forte" : "aviso";
}

export function encontrarConflitos(solicitacao, festividades) {
  return festividades
    .filter((f) => f.id !== solicitacao.id)
    .map((f) => ({ festividade: f, tipo: classificarConflito(solicitacao, f) }))
    .filter((c) => c.tipo !== "nenhum");
}

// Nova versão de uma solicitação. A anterior será marcada como substituída
// pela persistência; a aprovada só deixa de valer quando a nova for aprovada.
export function substituirSolicitacao(anterior, nova) {
  return { ...nova, supersedesId: anterior.id, status: STATUS.ENVIADA };
}

// esperados: [{ roomId, departmentId, regionId }] pares que cada sala deve preencher.
// solicitacoes: [{ roomId, departmentId, status }]
export function estatisticasProgresso({ esperados, solicitacoes, totalSalas, salasComResposta }) {
  const ativas = solicitacoes.filter((s) => s.status !== STATUS.SUBSTITUIDA);
  const chave = (s) => `${s.roomId}::${s.departmentId}`;
  const aprovadas = new Set(ativas.filter((s) => s.status === STATUS.APROVADA).map(chave));
  const abertas = new Set(ativas.filter((s) => STATUS_ABERTOS.includes(s.status)).map(chave));

  const paresConfirmados = esperados.filter((e) => aprovadas.has(chave(e))).length;
  const paresPendentes = esperados.filter(
    (e) => !aprovadas.has(chave(e)) && abertas.has(chave(e)),
  ).length;

  const porDepartamento = {};
  const porRegiao = {};
  for (const e of esperados) {
    const confirmado = aprovadas.has(chave(e)) ? 1 : 0;
    const d = (porDepartamento[e.departmentId] ??= { esperados: 0, confirmados: 0 });
    d.esperados += 1;
    d.confirmados += confirmado;
    const r = (porRegiao[e.regionId ?? "sem-regiao"] ??= { esperados: 0, confirmados: 0 });
    r.esperados += 1;
    r.confirmados += confirmado;
  }

  return {
    paresEsperados: esperados.length,
    paresConfirmados,
    paresPendentes,
    paresSemSolicitacao: esperados.length - paresConfirmados - paresPendentes,
    salasSemResposta: Math.max(totalSalas - salasComResposta, 0),
    porDepartamento,
    porRegiao,
  };
}
