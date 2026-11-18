import { rrulestr } from "rrule";
import { chaveDia, horaDoDia } from "./grade.js";

const UM_DIA = 24 * 60 * 60 * 1000;

// Expande as ocorrências de um evento (inclusive os recorrentes) dentro do período.
function ocorrenciasDoEvento(evento, de, ate) {
  const inicio = new Date(evento.start);
  if (!evento.isRecurring || !evento.rrule) {
    return inicio >= de && inicio <= ate ? [inicio] : [];
  }
  try {
    const regra = rrulestr(evento.rrule, { dtstart: inicio });
    const excecoes = new Set(
      (evento.exceptions ?? []).map((e) => new Date(e.exceptionDate).toISOString().slice(0, 10)),
    );
    return regra
      .between(de, ate, true)
      .filter((data) => !excecoes.has(data.toISOString().slice(0, 10)));
  } catch {
    return inicio >= de && inicio <= ate ? [inicio] : [];
  }
}

// Deixa a agenda de uma sala (do próprio pai, recebida ou em cascata) pronta para
// a interface: um item por ocorrência, já com o dia no fuso de Brasília.
export function resumirAgenda(eventos, inicio, fim) {
  const de = new Date(inicio);
  const ate = new Date(new Date(fim).getTime() + UM_DIA);
  const lista = [];

  for (const evento of eventos ?? []) {
    for (const ocorrencia of ocorrenciasDoEvento(evento, de, ate)) {
      const duracao = new Date(evento.end).getTime() - new Date(evento.start).getTime();
      const termino = new Date(ocorrencia.getTime() + (Number.isFinite(duracao) && duracao > 0 ? duracao : 0));
      lista.push({
        id: `${evento.id}-${ocorrencia.toISOString()}`,
        eventoId: evento.id,
        titulo: evento.title || "Sem título",
        dia: chaveDia(ocorrencia),
        hora: evento.allDay ? null : horaDoDia(ocorrencia),
        horaFim: evento.allDay ? null : horaDoDia(termino),
        allDay: !!evento.allDay,
        sala: evento.room?.name ?? null,
        cor: evento.category?.color || evento.room?.color || "#4f46e5",
      });
    }
  }

  return lista.sort((a, b) => {
    if (a.dia !== b.dia) return a.dia.localeCompare(b.dia);
    return (a.hora ?? "").localeCompare(b.hora ?? "");
  });
}

// Agenda de uma sala para o período do programa: eventos dela mesma, os que foram
// repassados para ela e os que descem em cascata dos pais. É o que o setor usa
// para saber, com precisão, quais dias liberar.
export async function carregarAgendaDaSala(prisma, roomId, inicio, fim) {
  if (!roomId) return [];

  const salas = await prisma.room.findMany({
    select: { id: true, parentId: true },
  });
  const porId = new Map(salas.map((s) => [s.id, s]));

  const acima = [];
  const vistos = new Set([roomId]);
  let atual = porId.get(roomId);
  while (atual?.parentId && !vistos.has(atual.parentId)) {
    const pai = porId.get(atual.parentId);
    if (!pai) break;
    vistos.add(pai.id);
    acima.push(pai.id);
    atual = pai;
  }

  const eventos = await prisma.event.findMany({
    where: {
      OR: [
        { roomId },
        { targetRooms: { some: { id: roomId } } },
        ...(acima.length ? [{ roomId: { in: acima }, cascade: true }] : []),
      ],
      start: { lte: new Date(new Date(fim).getTime() + UM_DIA) },
    },
    include: {
      room: { select: { name: true, color: true } },
      category: { select: { color: true } },
      exceptions: { select: { exceptionDate: true } },
    },
    orderBy: { start: "asc" },
  });

  return resumirAgenda(eventos, inicio, fim);
}
