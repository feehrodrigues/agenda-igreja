import { STATUS } from "./conflitos.js";

const FUSO = "America/Sao_Paulo";

// Dia e hora sempre no fuso de Brasília, independentemente do servidor.
export function chaveDia(data) {
  return new Date(data).toLocaleDateString("sv-SE", { timeZone: FUSO });
}

export function horaDoDia(data) {
  return new Date(data).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

// Datas de programa são gravadas como meia-noite UTC; por isso a iteração é em UTC.
// diasLiberados: null (todos), lista de dias da semana (0=domingo) ou Set de chaves "YYYY-MM-DD".
export function diasDoPrograma(inicio, fim, diasLiberados = null) {
  const dias = [];
  const cursor = new Date(inicio);
  const limite = new Date(fim);
  const porData = diasLiberados instanceof Set;
  while (cursor <= limite) {
    const chave = cursor.toISOString().slice(0, 10);
    dias.push({
      chave,
      liberado: !diasLiberados || (porData ? diasLiberados.has(chave) : diasLiberados.includes(cursor.getUTCDay())),
      rotulo: cursor.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

// Todos os dias do período são liberados — não há restrição de formato fixo/semanal.
// O setor pode liberar datas específicas na aba "Datas", que então valem para todos.
export function diasLiberadosDoPrograma(programa) {
  return null; // null = todos os dias do período
}

// Datas escolhidas a dedo pelo setor. Quando existem, mandam mais que o formato.
export function datasLiberadasDoPrograma(programa) {
  const datas = programa.releasedDays ?? [];
  if (datas.length === 0) return null;
  return new Set(datas.map((d) => new Date(d.date).toISOString().slice(0, 10)));
}

const REJEITADOS = [STATUS.REJEITADA, STATUS.SUBSTITUIDA];
const ABERTOS = [STATUS.ENVIADA, STATUS.EM_ANALISE];
const CORES_REGIAO = ["#6366f1", "#0d9488", "#d97706", "#db2777", "#0284c7", "#7c3aed"];

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Mesma cor para o chip da região no filtro e no cartão da grade.
export function coresDasRegioes(regioes = []) {
  return Object.fromEntries(
    regioes.map((r, i) => [
      typeof r === "string" ? r : r.name,
      CORES_REGIAO[i % CORES_REGIAO.length],
    ]),
  );
}

// Agrupa só os dias liberados em seções por mês, com os contadores do cabeçalho.
function agruparPorMes(dias, itens, paresEsperados) {
  const map = new Map();
  for (const dia of dias) {
    const data = new Date(`${dia.chave}T12:00:00Z`);
    const chave = dia.chave.slice(0, 7);
    if (!map.has(chave)) {
      map.set(chave, {
        chave,
        nome: cap(data.toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" })),
        ano: data.getUTCFullYear(),
        dias: [],
      });
    }
    map.get(chave).dias.push({
      ...dia,
      diaSemana: cap(data.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "")),
      numero: dia.chave.slice(8, 10),
      mesCurto: cap(data.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "")),
      sabado: data.getUTCDay() === 6,
      hoje: dia.chave === chaveDia(new Date()),
    });
  }

  for (const mes of map.values()) {
    const ativos = itens.filter((i) => i.dia?.startsWith(mes.chave) && !REJEITADOS.includes(i.status));
    const enviados = new Set(ativos.filter((i) => i.departmentId).map((i) => `${i.roomId}::${i.departmentId}`));
    mes.festividades = ativos.length;
    mes.aguardando = ativos.filter((i) => ABERTOS.includes(i.status)).length;
    mes.congregacoes = new Set(ativos.map((i) => i.roomId)).size;
    mes.percentual = paresEsperados.size ? Math.round((enviados.size / paresEsperados.size) * 100) : 0;
  }
  return [...map.values()];
}

// Monta a grade (dias × departamentos) já com os campos prontos para exibição.
// Um cartão é "conflito" quando outra sala da mesma região tem solicitação no mesmo dia.
export function montarGrade({ programa, solicitacoes, idSalaAtual = null }) {
  const regioes = programa.regions ?? [];
  const coresRegiao = coresDasRegioes(regioes.length ? regioes : [...new Set(solicitacoes.map((s) => s.regiao).filter(Boolean))]);

  const itens = solicitacoes.map((s) => ({
    id: s.id,
    roomId: s.roomId,
    sala: s.sala,
    departmentId: s.departmentId,
    departamento: s.departamento,
    dia: chaveDia(s.start),
    hora: horaDoDia(s.start),
    horaFim: horaDoDia(s.end),
    regiao: s.regiao ?? null,
    corRegiao: coresRegiao[s.regiao] ?? null,
    status: s.status,
    motivo: s.motivo ?? null,
    minha: s.roomId === idSalaAtual,
    conflito: false,
  }));

  for (const item of itens) {
    if (REJEITADOS.includes(item.status) || !item.regiao) continue;
    item.conflito = itens.some(
      (o) =>
        o !== item &&
        !REJEITADOS.includes(o.status) &&
        o.regiao === item.regiao &&
        o.dia === item.dia &&
        o.roomId !== item.roomId,
    );
  }

  const departamentos = [...programa.departments.map((d) => ({ id: d.id, name: d.name }))];
  for (const s of solicitacoes) {
    if (!departamentos.some((d) => d.id === s.departmentId)) {
      departamentos.push({ id: s.departmentId, name: s.departamento });
    }
  }

  // Pares que cada congregação deveria enviar: usados no "% enviado" de cada mês.
  const paresEsperados = new Set();
  for (const child of programa.children ?? []) {
    if (idSalaAtual && child.roomId !== idSalaAtual) continue;
    for (const link of child.departments ?? []) {
      if (programa.departments.some((d) => d.id === link.departmentId && d.active !== false)) {
        paresEsperados.add(`${child.roomId}::${link.departmentId}`);
      }
    }
  }

  const dias = diasDoPrograma(
    programa.startsAt,
    programa.endsAt,
    datasLiberadasDoPrograma(programa) ?? diasLiberadosDoPrograma(programa),
  );
  const meses = agruparPorMes(
    dias.filter((d) => d.liberado),
    itens,
    paresEsperados,
  );

  return { dias, meses, coresRegiao, departamentos, solicitacoes: itens };
}

// Agrupa itens de agenda (já resumidos) por dia "YYYY-MM-DD" para a interface.
export function agendaPorDia(agenda = []) {
  const mapa = new Map();
  for (const item of agenda) {
    if (!mapa.has(item.dia)) mapa.set(item.dia, []);
    mapa.get(item.dia).push(item);
  }
  return mapa;
}

// Converte as solicitações do Prisma (com sala, departamento e região da congregação) no formato de montarGrade.
export function solicitacoesDoPrograma(programa) {
  const regiaoPorSala = Object.fromEntries(programa.children.map((c) => [c.roomId, c.region?.name ?? null]));
  return programa.requests
    .filter((r) => r.departmentId)
    .map((r) => ({
      id: r.id,
      roomId: r.roomId,
      sala: r.room.name,
      departmentId: r.departmentId,
      departamento: r.department?.name ?? "",
      start: r.start,
      end: r.end,
      status: r.status,
      motivo: r.reason,
      regiao: regiaoPorSala[r.roomId] ?? null,
    }));
}
