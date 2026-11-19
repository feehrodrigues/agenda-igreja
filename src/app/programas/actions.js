"use server";

import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { STATUS, classificarConflito } from "@/lib/festividades/conflitos";
import { chaveDia } from "@/lib/festividades/grade";
import { inicioDoDiaSP, parseDataSP, somarDiasChave } from "@/lib/datas";
import { filhosDiretos } from "@/lib/festividades/salas";

const prisma = new PrismaClient();

const ATIVAS = [STATUS.ENVIADA, STATUS.EM_ANALISE, STATUS.APROVADA];
const ABERTAS = [STATUS.ENVIADA, STATUS.EM_ANALISE];

async function usuarioAtual() {
  const { userId } = await auth();
  return userId ?? null;
}

// Gestores da sala (OWNER/ADMIN), mesma regra usada em actions.js.
async function ehGestor(userId, roomId) {
  const m = await prisma.member.findUnique({
    where: { userId_roomId: { userId, roomId } },
  });
  return !!m && ["OWNER", "ADMIN"].includes(m.role);
}

function parseData(valor) {
  // Datas sem fuso (input datetime-local) são de Brasília; no servidor UTC isso
  // é essencial para o horário não sair 3h adiantado.
  return parseDataSP(valor);
}

// Prazo informado só com a data: vale até o fim daquele dia em Brasília.
function parsePrazo(valor) {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return new Date(`${texto}T23:59:59-03:00`);
  return parseData(texto);
}

// Filhos diretos de uma sala (setores ou congregações). O programa é sempre do
// pai para os filhos; os netos não entram.
async function filhosDiretosDoPai(parentRoomId) {
  const todos = await prisma.room.findMany({
    select: { id: true, name: true, group: true, type: true, parentId: true },
    orderBy: { name: "asc" },
  });
  return filhosDiretos(todos, parentRoomId);
}

// Normaliza um nome de região para comparar "Região A", "regiao a" e "A"
// como a mesma região. Remove acentos, artigos e o prefixo "região".
function normalizarRegiao(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/^regiao\s*(de\s*)?/, "")
    .replace(/^[oa]\s+/, "")
    .trim();
}

// Tenta descobrir a região da congregação: pelo grupo da sala (definido no
// dashboard) ou pelo prefixo do nome ("A - CAMPESTRE" → "A"). A comparação é
// flexível para aceitar "Região A", "A" e variações de caixa/acento.
function regiaoDaSala(sala, regioesPorNome) {
  const procurar = (valor) => {
    const chave = normalizarRegiao(valor);
    if (!chave) return null;
    if (regioesPorNome.has(chave)) return regioesPorNome.get(chave);
    // Como último recurso, uma região cujo nome aparece dentro do grupo.
    for (const [nome, id] of regioesPorNome) {
      if (nome && (chave.includes(nome) || nome.includes(chave))) return id;
    }
    return null;
  };
  if (sala.group) {
    const porGrupo = procurar(sala.group);
    if (porGrupo) return porGrupo;
  }
  return procurar(String(sala.name ?? "").split(" - ")[0]);
}

function mapaRegioes(regioes) {
  return new Map(
    regioes
      .map((r) => [normalizarRegiao(r.name), r.id])
      .filter(([chave]) => !!chave),
  );
}

// Regiões já configuradas nas congregações filhas (campo "group" do dashboard).
// Usadas para que um novo programa já venha com as mesmas regiões, sem digitar.
async function regioesDasCongregacoes(parentRoomId) {
  const salas = await filhosDiretosDoPai(parentRoomId);
  const vistas = new Set();
  const nomes = [];
  for (const sala of salas) {
    const nome = String(sala.group ?? "").trim();
    if (!nome) continue;
    const chave = normalizarRegiao(nome);
    if (!chave || vistas.has(chave)) continue;
    vistas.add(chave);
    nomes.push(nome);
  }
  // Fallback: quando nenhuma sala tem grupo, usa o prefixo do nome ("A - ...").
  if (nomes.length === 0) {
    for (const sala of salas) {
      const nome = String(sala.name ?? "").split(" - ")[0].trim();
      if (!nome || nome === sala.name) continue;
      const chave = normalizarRegiao(nome);
      if (!chave || vistas.has(chave)) continue;
      vistas.add(chave);
      nomes.push(nome);
    }
  }
  return { salas, nomes };
}

// Separa por vírgula, ponto e vírgula ou quebra de linha, tira vazios e
// repetidos (sem diferenciar maiúsculas). Com separarEspacos, aceita também
// listas curtas separadas por espaço (ex.: "1 2 3", "A B C").
function listaUnica(valor, { separarEspacos = false } = {}) {
  const texto = String(valor ?? "").replace(/;/g, ",").replace(/\r?\n/g, ",");
  let partes;
  if (separarEspacos && !texto.includes(",")) {
    const porEspaco = texto.trim().split(/\s+/).filter(Boolean);
    partes =
      porEspaco.length > 1 && porEspaco.every((p) => p.length <= 3) ? porEspaco : [texto];
  } else {
    partes = texto.split(",");
  }

  const vistos = new Set();
  const lista = [];
  for (const parte of partes) {
    const nome = parte.trim();
    if (!nome) continue;
    const chave = nome.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(nome);
  }
  return lista;
}

// Solicitações ativas de um programa, com a região de cada sala já resolvida.
async function solicitacoesAtivasDoPrograma(programId) {
  const [filhos, solicitacoes] = await Promise.all([
    prisma.programChild.findMany({ where: { programId } }),
    prisma.festivityRequest.findMany({
      where: { programId, status: { in: ATIVAS } },
    }),
  ]);
  const regiaoPorSala = new Map(filhos.map((f) => [f.roomId, f.regionId]));
  return solicitacoes.map((s) => ({
    ...s,
    regionId: regiaoPorSala.get(s.roomId) ?? null,
  }));
}

// Qualquer choque no mesmo dia é um aviso para o pai decidir; nada é bloqueado.
// A mesma sala+departamento no mesmo dia é substituição, não conflito.
function avaliarConflitos(candidata, existentes) {
  const avisos = [];
  const dia = chaveDia(candidata.start);
  for (const e of existentes) {
    if (e.id === candidata.id) continue;
    if (
      e.roomId === candidata.roomId &&
      e.departmentId === candidata.departmentId &&
      chaveDia(e.start) === dia
    ) {
      continue;
    }
    const tipo = classificarConflito(candidata, e);
    if (tipo !== "nenhum") avisos.push(e);
  }
  return { avisos };
}

// Sobe a hierarquia da sala (pai, avô...) para achar os eventos setoriais.
async function salasAcima(roomId) {
  const acima = [];
  let atual = await prisma.room.findUnique({
    where: { id: roomId },
    select: { parentId: true },
  });
  let guarda = 0;
  while (atual?.parentId && guarda < 10) {
    acima.push(atual.parentId);
    atual = await prisma.room.findUnique({
      where: { id: atual.parentId },
      select: { parentId: true },
    });
    guarda += 1;
  }
  return acima;
}

// Eventos do setor/pai que alcançam esta sala e ocupam o dia inteiro.
async function eventosSetoriaisNoDia(roomId, dia) {
  const acima = await salasAcima(roomId);
  if (acima.length === 0) return [];
  const inicio = inicioDoDiaSP(dia);
  const fim = inicioDoDiaSP(somarDiasChave(dia, 1));
  return prisma.event.findMany({
    where: {
      roomId: { in: acima },
      start: { lt: fim },
      end: { gt: inicio },
      OR: [{ cascade: true }, { targetRooms: { some: { id: roomId } } }],
    },
    select: { title: true, start: true },
    orderBy: { start: "asc" },
  });
}

// Regras de bloqueio de datas do programa:
// 1. mesmo departamento + mesma região já agendados no dia;
// 2. evento setorial (do pai) no dia, que vale automaticamente para os filhos.
// Conflitos de departamentos diferentes na mesma região continuam só como aviso.
async function motivoBloqueio({ programId, roomId, departmentId, regionId, start }) {
  const dia = chaveDia(start);

  if (departmentId && regionId) {
    const existentes = await solicitacoesAtivasDoPrograma(programId);
    const mesmoDepartamento = existentes.find(
      (s) =>
        s.roomId !== roomId &&
        s.departmentId === departmentId &&
        s.regionId === regionId &&
        chaveDia(s.start) === dia,
    );
    if (mesmoDepartamento) {
      return "Este departamento já está agendado nesta região nesse dia.";
    }
  }

  const setoriais = await eventosSetoriaisNoDia(roomId, dia);
  if (setoriais.length > 0) {
    const titulos = setoriais.map((e) => `“${e.title}”`).join(", ");
    return `Já existe evento do setor nesse dia (${titulos}).`;
  }

  return null;
}


// Cria o evento da festividade na sala do filho e repassa para o pai e as demais
// congregações do programa. Usado tanto na aprovação de um pedido quanto quando
// o próprio pai adiciona a data para o filho.
async function criarEventoDaFestividade(tx, { solicitacao, programa, nomeDepartamento, destinos }) {
  const nomeCategoria = programa
    ? `Festividade · ${programa.name}`
    : "Confirmação avulsa";
  const categoria = await tx.category.upsert({
    where: { name_roomId: { name: nomeCategoria, roomId: solicitacao.roomId } },
    update: {},
    create: { name: nomeCategoria, color: "#7c3aed", roomId: solicitacao.roomId },
  });

  const evento = await tx.event.create({
    data: {
      title: solicitacao.title ?? nomeDepartamento ?? "Festividade",
      description: programa
        ? `Festividade aprovada · ${programa.name}`
        : "Confirmação avulsa aprovada pelo setor",
      start: solicitacao.start,
      end: solicitacao.end,
      roomId: solicitacao.roomId,
      categoryId: categoria.id,
      // getRoomEvents usa targetRooms para eventos de outras salas: sem isto,
      // a festividade aprovada não aparece no setor nem nas demais congregações.
      targetRooms: { connect: [...destinos].map((id) => ({ id })) },
    },
  });

  if (destinos.size > 0) {
    await tx.eventBroadcast.createMany({
      data: [...destinos].map((toRoomId) => ({
        eventId: evento.id,
        fromRoomId: solicitacao.roomId,
        toRoomId,
      })),
      skipDuplicates: true,
    });
  }

  return evento;
}

export async function criarPrograma(formData) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const parentRoomId = String(formData.get("parentRoomId") ?? "");
  if (!parentRoomId || !(await ehGestor(userId, parentRoomId))) {
    return { error: "Apenas gestores da sala podem criar programas." };
  }
  const salaPromotora = await prisma.room.findUnique({ where: { id: parentRoomId } });
  if (!salaPromotora) return { error: "Sala promotora não encontrada." };

  const name = String(formData.get("name") ?? "").trim();
  const startsAt = parseData(formData.get("startsAt"));
  const endsAt = parseData(formData.get("endsAt"));
  const deadlineRaw = String(formData.get("deadline") ?? "");
  const deadline = parsePrazo(deadlineRaw);

  const criteria = String(formData.get("criteria") ?? "").trim() || null;
  const regionNamesDigitadas = listaUnica(formData.get("regions"), { separarEspacos: true });
  const departmentNames = listaUnica(formData.get("departments"));

  // As regiões já configuradas nas congregações (menu Congregações) são
  // aproveitadas automaticamente — são as mesmas regiões do programa.
  const { salas: salasFilhas, nomes: regioesExistentes } = await regioesDasCongregacoes(parentRoomId);
  const regionNames = [];
  const vistasRegioes = new Set();
  for (const nome of [...regioesExistentes, ...regionNamesDigitadas]) {
    const chave = normalizarRegiao(nome);
    if (!chave || vistasRegioes.has(chave)) continue;
    vistasRegioes.add(chave);
    regionNames.push(nome);
  }

  if (!name) return { error: "Informe o nome do programa." };
  if (!startsAt || !endsAt || endsAt < startsAt) return { error: "Período inválido." };
  if (regionNames.length === 0) return { error: "Informe ao menos uma região." };
  if (departmentNames.length === 0) return { error: "Informe ao menos um departamento." };

  let programa;
  try {
    programa = await prisma.$transaction(async (tx) => {
      const criado = await tx.program.create({
        data: {
          name,
          startsAt,
          endsAt,
          deadline,
          criteria,
          parentRoomId,
          regions: { create: regionNames.map((n) => ({ name: n })) },
          departments: {
            create: departmentNames.map((n) => ({
              name: n,
              defaultDays: null,
            })),
          },
        },
        include: { regions: { select: { id: true, name: true } } },
      });

      if (salasFilhas.length > 0) {
        const regioesPorNome = new Map(
          criado.regions.map((r) => [r.name.trim().toLowerCase(), r.id]),
        );
        await tx.programChild.createMany({
          data: salasFilhas.map((s) => ({
            programId: criado.id,
            roomId: s.id,
            regionId: regiaoDaSala(s, regioesPorNome),
          })),
        });
      }

      return criado;
    });
  } catch (e) {
    console.error("criarPrograma:", e);
    if (e?.code === "P2002") {
      return { error: "Região ou departamento repetido. Use nomes diferentes." };
    }
    return { error: "Não foi possível criar o programa. Tente novamente." };
  }

  revalidatePath("/programas");
  return { success: true, id: programa.id };
}

// Sala filha entra no programa pelo código de convite.
export async function entrarNoPrograma(inviteCode, roomId, regionId) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };
  if (!(await ehGestor(userId, roomId))) {
    return { error: "Apenas o secretário ou administrador da sala filha pode aderir." };
  }

  const programa = await prisma.program.findUnique({ where: { inviteCode } });
  if (!programa) return { error: "Convite inválido." };

  const sala = await prisma.room.findUnique({ where: { id: roomId } });
  const salasFilhas = await filhosDiretosDoPai(programa.parentRoomId);
  if (!sala || !salasFilhas.some((c) => c.id === sala.id)) {
    return { error: "Esta sala não é filha do criador deste programa." };
  }

  const regiao = await prisma.programRegion.findFirst({
    where: { id: regionId, programId: programa.id },
  });
  if (!regiao) return { error: "Selecione uma região válida." };

  await prisma.programChild.upsert({
    where: { programId_roomId: { programId: programa.id, roomId } },
    update: { regionId: regiao.id },
    create: { programId: programa.id, roomId, regionId: regiao.id },
  });

  revalidatePath(`/programas/convite/${inviteCode}`);
  return { success: true, programId: programa.id };
}

// Filhos criados depois do programa entram com um clique.
export async function sincronizarCongregacoesDoPrograma(programId) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const programa = await prisma.program.findUnique({
    where: { id: programId },
    include: {
      regions: { select: { id: true, name: true } },
      children: { select: { roomId: true } },
    },
  });
  if (!programa) return { error: "Programa não encontrado." };
  if (!(await ehGestor(userId, programa.parentRoomId))) {
    return { error: "Apenas gestores do pai podem sincronizar." };
  }

  const jaEntraram = programa.children.map((c) => c.roomId);
  const { salas: salasFilhas, nomes: novasRegioes } = await regioesDasCongregacoes(programa.parentRoomId);
  const idsValidos = new Set(salasFilhas.map((s) => s.id));

  // Limpa participantes que deixaram de ser filhos diretos deste programa.
  const fora = jaEntraram.filter((roomId) => !idsValidos.has(roomId));
  if (fora.length > 0) {
    await prisma.programChild.deleteMany({
      where: { programId, roomId: { in: fora } },
    });
  }

  // Congregações que receberam uma região depois da criação do programa.
  const regioesExistentes = new Set(programa.regions.map((r) => normalizarRegiao(r.name)));
  let regioes = programa.regions;
  const paraCriar = novasRegioes.filter((nome) => !regioesExistentes.has(normalizarRegiao(nome)));
  if (paraCriar.length > 0) {
    await prisma.programRegion.createMany({
      data: paraCriar.map((name) => ({ programId, name })),
      skipDuplicates: true,
    });
    regioes = await prisma.programRegion.findMany({
      where: { programId },
      select: { id: true, name: true },
    });
  }

  const regioesPorNome = mapaRegioes(regioes);
  const salas = salasFilhas.filter((s) => !jaEntraram.includes(s.id));
  if (salas.length > 0) {
    await prisma.programChild.createMany({
      data: salas.map((s) => ({
        programId,
        roomId: s.id,
        regionId: regiaoDaSala(s, regioesPorNome),
      })),
    });
  }

  // Recalcula a região de quem já estava no programa: se o pai mudou a região
  // da congregação no menu Congregações, o programa acompanha.
  for (const sala of salasFilhas) {
    const filho = await prisma.programChild.findUnique({
      where: { programId_roomId: { programId, roomId: sala.id } },
      select: { id: true, regionId: true },
    });
    if (!filho) continue;
    const regiaoId = regiaoDaSala(sala, regioesPorNome);
    if (filho.regionId !== regiaoId) {
      await prisma.programChild.update({
        where: { id: filho.id },
        data: { regionId },
      });
    }
  }

  revalidatePath(`/programas/${programId}`);
  revalidatePath(`/dashboard/${programa.parentRoomId}`);
  return { success: true, adicionadas: salas.length, removidas: fora.length };
}

// Sincroniza somente as regiões das congregações já participantes, a partir do
// campo "group" definido no dashboard das congregações.
export async function sincronizarRegioesDoPrograma(programId) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };
  const programa = await prisma.program.findUnique({
    where: { id: programId },
    include: { regions: { select: { id: true, name: true } } },
  });
  if (!programa) return { error: "Programa não encontrado." };
  if (!(await ehGestor(userId, programa.parentRoomId))) {
    return { error: "Apenas gestores do pai podem sincronizar regiões." };
  }

  let regioes = programa.regions;
  const { salas, nomes } = await regioesDasCongregacoes(programa.parentRoomId);
  const existentes = new Set(regioes.map((r) => normalizarRegiao(r.name)));
  const paraCriar = nomes.filter((nome) => !existentes.has(normalizarRegiao(nome)));
  if (paraCriar.length > 0) {
    await prisma.programRegion.createMany({
      data: paraCriar.map((name) => ({ programId, name })),
      skipDuplicates: true,
    });
    regioes = await prisma.programRegion.findMany({
      where: { programId },
      select: { id: true, name: true },
    });
  }

  const porNome = mapaRegioes(regioes);
  let atualizadas = 0;
  for (const sala of salas) {
    const filho = await prisma.programChild.findUnique({
      where: { programId_roomId: { programId, roomId: sala.id } },
      select: { id: true, regionId: true },
    });
    if (!filho) continue;
    const regiaoId = regiaoDaSala(sala, porNome);
    if (filho.regionId !== regiaoId) {
      await prisma.programChild.update({ where: { id: filho.id }, data: { regionId } });
      atualizadas += 1;
    }
  }

  revalidatePath(`/programas/${programId}`);
  return { success: true, atualizadas };
}

// O pai define a região de cada sala filha. Antes isso vinha do nome/grupo da
// sala; agora quem conhece a divisão regional é o pai do programa.
export async function definirRegiaoDoFilho(programId, roomId, regionId) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const programa = await prisma.program.findUnique({
    where: { id: programId },
    select: { parentRoomId: true },
  });
  if (!programa) return { error: "Programa não encontrado." };
  if (!(await ehGestor(userId, programa.parentRoomId))) {
    return { error: "Apenas gestores do pai podem definir a região." };
  }

  const filho = await prisma.programChild.findUnique({
    where: { programId_roomId: { programId, roomId } },
  });
  if (!filho) return { error: "Sala filha não está no programa." };

  // Vazio/sem escolha = sala sem região definida.
  const regiaoId = String(regionId ?? "").trim();
  if (regiaoId) {
    const regiao = await prisma.programRegion.findFirst({
      where: { id: regiaoId, programId },
      select: { id: true },
    });
    if (!regiao) return { error: "Região inválida para este programa." };
  }

  await prisma.programChild.update({
    where: { id: filho.id },
    data: { regionId: regiaoId || null },
  });

  revalidatePath(`/programas/${programId}`);
  revalidatePath("/programas");
  return { success: true };
}

// Define quais departamentos a congregação terá no programa.
export async function definirDepartamentosDaCongregacao(programId, roomId, departmentIds) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };
  if (!(await ehGestor(userId, roomId))) return { error: "Sem permissão." };

  const filho = await prisma.programChild.findUnique({
    where: { programId_roomId: { programId, roomId } },
  });
  if (!filho) return { error: "Entre no programa antes de escolher departamentos." };

  const validos = await prisma.programDepartment.findMany({
    where: { programId, id: { in: departmentIds }, active: true },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.programChildDepartment.deleteMany({ where: { childId: filho.id } }),
    prisma.programChildDepartment.createMany({
      data: validos.map((d) => ({ childId: filho.id, departmentId: d.id })),
    }),
  ]);

  revalidatePath("/programas");
  return { success: true };
}

// Congregação envia (ou altera) a solicitação de um departamento.
export async function enviarSolicitacao(formData) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const programId = String(formData.get("programId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || null;
  const start = parseData(formData.get("start"));
  const end = parseData(formData.get("end"));

  if (!(await ehGestor(userId, roomId))) return { error: "Sem permissão." };
  if (!start || !end || end <= start) return { error: "Horário inválido." };

  const programa = await prisma.program.findUnique({
    where: { id: programId },
    include: { releasedDays: true },
  });
  if (!programa) return { error: "Programa não encontrado." };
  if (programa.deadline && new Date() > programa.deadline) {
    return { error: "O prazo para solicitações já encerrou." };
  }
  if (start < programa.startsAt || end > programa.endsAt) {
    return { error: "A data está fora do período do programa." };
  }
  // Setor pode liberar datas específicas; fora delas, não dá para pedir.
  if (programa.releasedDays.length > 0) {
    const liberadas = new Set(
      programa.releasedDays.map((d) => new Date(d.date).toISOString().slice(0, 10)),
    );
    if (!liberadas.has(chaveDia(start))) {
      return { error: "Esta data não foi liberada pelo pai." };
    }
  }

  const filho = await prisma.programChild.findUnique({
    where: { programId_roomId: { programId, roomId } },
    include: { departments: true },
  });
  if (!filho) return { error: "Congregação não está no programa." };
  if (!filho.departments.some((d) => d.departmentId === departmentId)) {
    return { error: "Este departamento não foi selecionado pela congregação." };
  }
  const departamento = await prisma.programDepartment.findUnique({ where: { id: departmentId } });
  if (!departamento?.active) return { error: "Este departamento não está mais disponível." };

  // Datas bloqueadas: mesmo departamento na mesma região ou evento do setor.
  const bloqueio = await motivoBloqueio({
    programId,
    roomId,
    departmentId,
    regionId: filho.regionId,
    start,
  });
  if (bloqueio) return { error: bloqueio };

  const existentes = await solicitacoesAtivasDoPrograma(programId);
  const candidata = { roomId, departmentId, regionId: filho.regionId, start };
  const { avisos } = avaliarConflitos(candidata, existentes);

  // Só a versão do MESMO dia é substituída: o departamento pode ter vários dias abertos.
  const dia = chaveDia(start);
  const [anteriores, pendentesDoDepartamento] = await Promise.all([
    prisma.festivityRequest.findMany({
      where: { programId, roomId, departmentId, status: STATUS.APROVADA },
    }),
    prisma.festivityRequest.findMany({
      where: { programId, roomId, departmentId, status: { in: ABERTAS } },
    }),
  ]);
  const anterior = anteriores.find((r) => chaveDia(r.start) === dia) ?? null;
  const pendentes = pendentesDoDepartamento.filter((r) => chaveDia(r.start) === dia);

  await prisma.$transaction([
    // Pendências antigas deste departamento deixam de valer e liberam o vínculo de versão.
    prisma.festivityRequest.updateMany({
      where: { id: { in: pendentes.map((p) => p.id) } },
      data: { status: STATUS.SUBSTITUIDA, supersedesId: null },
    }),
    prisma.festivityRequest.create({
      data: {
        title,
        start,
        end,
        status: STATUS.ENVIADA,
        requestedById: userId,
        programId,
        departmentId,
        roomId,
        supersedesId: anterior?.id ?? null,
      },
    }),
  ]);

  revalidatePath("/programas");
  return {
    success: true,
    avisos: avisos.map((a) => ({ roomId: a.roomId, start: a.start })),
  };
}

// Solicitação avulsa (sem programa). Vai para o setor pai da sala, sem prazo.
export async function enviarConfirmacaoAvulsa(formData) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const roomId = String(formData.get("roomId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || null;
  const start = parseData(formData.get("start"));
  const end = parseData(formData.get("end"));

  if (!(await ehGestor(userId, roomId))) return { error: "Sem permissão." };
  if (!start || !end || end <= start) return { error: "Horário inválido." };

  const sala = await prisma.room.findUnique({ where: { id: roomId } });
  if (!sala?.parentId) return { error: "Esta sala não tem um pai (setor ou ministério)." };

  await prisma.festivityRequest.create({
    data: {
      title,
      start,
      end,
      status: STATUS.ENVIADA,
      requestedById: userId,
      roomId,
    },
  });

  revalidatePath("/programas");
  return { success: true };
}

// Setor aprova ou rejeita. Aprovação cria o evento na sala e o repassa ao setor e às congregações do programa.
export async function decidirSolicitacao(requestId, decisao, motivo) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const solicitacao = await prisma.festivityRequest.findUnique({
    where: { id: requestId },
    include: { program: true, room: true, department: true },
  });
  if (!solicitacao) return { error: "Solicitação não encontrada." };
  if (!ABERTAS.includes(solicitacao.status)) {
    return { error: "Esta solicitação já foi decidida." };
  }

  const setorId = solicitacao.program?.parentRoomId ?? solicitacao.room.parentId;
  if (!setorId || !(await ehGestor(userId, setorId))) {
    return { error: "Apenas gestores do pai podem decidir." };
  }

  if (decisao === "rejeitar") {
    await prisma.festivityRequest.update({
      where: { id: requestId },
      data: {
        status: STATUS.REJEITADA,
        reason: String(motivo ?? "").trim() || null,
        decidedById: userId,
        decidedAt: new Date(),
      },
    });
    revalidatePath("/programas");
    return { success: true };
  }

  if (solicitacao.programId) {
    // Bloqueios automáticos antes de aprovar: mesmo departamento na mesma
    // região no mesmo dia, ou evento do setor já marcado nesse dia.
    const filho = await prisma.programChild.findUnique({
      where: {
        programId_roomId: {
          programId: solicitacao.programId,
          roomId: solicitacao.roomId,
        },
      },
      select: { regionId: true },
    });
    const bloqueio = await motivoBloqueio({
      programId: solicitacao.programId,
      roomId: solicitacao.roomId,
      departmentId: solicitacao.departmentId,
      regionId: filho?.regionId ?? null,
      start: solicitacao.start,
    });
    if (bloqueio) return { error: bloqueio };
  }

  const destinos = new Set([setorId]);
  if (solicitacao.programId) {
    const filhos = await prisma.programChild.findMany({
      where: { programId: solicitacao.programId },
      select: { roomId: true },
    });
    filhos.forEach((f) => destinos.add(f.roomId));
  }
  destinos.delete(solicitacao.roomId);

  await prisma.$transaction(async (tx) => {
    if (solicitacao.supersedesId) {
      const antiga = await tx.festivityRequest.findUnique({
        where: { id: solicitacao.supersedesId },
      });
      if (antiga?.eventId) {
        await tx.event.delete({ where: { id: antiga.eventId } });
      }
      await tx.festivityRequest.update({
        where: { id: solicitacao.supersedesId },
        data: { status: STATUS.SUBSTITUIDA },
      });
    }

    const evento = await criarEventoDaFestividade(tx, {
      solicitacao,
      programa: solicitacao.program,
      nomeDepartamento: solicitacao.department?.name,
      destinos,
    });

    await tx.festivityRequest.update({
      where: { id: requestId },
      data: {
        status: STATUS.APROVADA,
        eventId: evento.id,
        decidedById: userId,
        decidedAt: new Date(),
      },
    });
  });

  revalidatePath("/programas");
  return { success: true };
}

// Verifica se o usuário pode alterar uma solicitação: gestor do pai (setor)
// ou gestor da própria congregação que pediu a data.
async function podeAlterarSolicitacao(userId, solicitacao) {
  const setorId = solicitacao.program?.parentRoomId ?? solicitacao.room?.parentId;
  if (setorId && (await ehGestor(userId, setorId))) return true;
  return ehGestor(userId, solicitacao.roomId);
}

// Edita a data/hora de uma festividade já marcada, mantendo o mesmo pedido e o
// mesmo evento da agenda (não cria uma nova solicitação "substituta").
export async function editarSolicitacao(requestId, startRaw, endRaw) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const solicitacao = await prisma.festivityRequest.findUnique({
    where: { id: requestId },
    include: { program: true, room: true, department: true },
  });
  if (!solicitacao) return { error: "Solicitação não encontrada." };
  if (!(await podeAlterarSolicitacao(userId, solicitacao))) {
    return { error: "Apenas gestores do setor ou da congregação podem editar a data." };
  }
  if (!ATIVAS.includes(solicitacao.status)) {
    return { error: "Esta data não pode mais ser editada." };
  }

  const start = parseData(startRaw);
  const end = parseData(endRaw);
  if (!start || !end || end <= start) return { error: "Horário inválido." };

  if (solicitacao.programId) {
    const filho = await prisma.programChild.findUnique({
      where: {
        programId_roomId: { programId: solicitacao.programId, roomId: solicitacao.roomId },
      },
      select: { regionId: true },
    });
    const bloqueio = await motivoBloqueio({
      programId: solicitacao.programId,
      roomId: solicitacao.roomId,
      departmentId: solicitacao.departmentId,
      regionId: filho?.regionId ?? null,
      start,
    });
    if (bloqueio) return { error: bloqueio };
  }

  await prisma.$transaction(async (tx) => {
    await tx.festivityRequest.update({
      where: { id: requestId },
      data: { start, end },
    });
    if (solicitacao.eventId) {
      await tx.event.update({
        where: { id: solicitacao.eventId },
        data: { start, end },
      });
    }
  });

  revalidatePath("/programas");
  revalidatePath(`/programas/${solicitacao.programId ?? ""}`);
  revalidatePath(`/dashboard/${solicitacao.room.slug}`);
  return { success: true };
}

// Exclui/cancela uma festividade marcada: remove o evento da agenda e tira a
// data da grade. Funciona tanto para o setor quanto para a congregação dona.
export async function excluirSolicitacao(requestId) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const solicitacao = await prisma.festivityRequest.findUnique({
    where: { id: requestId },
    include: { program: true, room: true },
  });
  if (!solicitacao) return { error: "Solicitação não encontrada." };
  if (!(await podeAlterarSolicitacao(userId, solicitacao))) {
    return { error: "Apenas gestores do setor ou da congregação podem excluir a data." };
  }

  await prisma.$transaction(async (tx) => {
    if (solicitacao.eventId) {
      await tx.event.delete({ where: { id: solicitacao.eventId } }).catch(() => {});
    }
    await tx.festivityRequest.update({
      where: { id: requestId },
      data: {
        status: STATUS.CANCELADA,
        reason: "Data cancelada pelo gestor",
        decidedById: userId,
        decidedAt: new Date(),
      },
    });
  });

  revalidatePath("/programas");
  if (solicitacao.programId) revalidatePath(`/programas/${solicitacao.programId}`);
  revalidatePath(`/dashboard/${solicitacao.room.slug}`);
  return { success: true };
}

// O pai (criador do programa) adiciona a data diretamente para um filho.
// Nasce já aprovada: cria a festividade na agenda da congregação e repassa o
// evento para o setor e para as demais congregações do programa.
export async function adicionarDataParaFilho(formData) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const programId = String(formData.get("programId") ?? "");
  const roomId = String(formData.get("roomId") ?? "");
  const departmentId = String(formData.get("departmentId") ?? "");
  const title = String(formData.get("title") ?? "").trim() || null;
  const start = parseData(formData.get("start"));
  const end = parseData(formData.get("end"));

  if (!start || !end || end <= start) return { error: "Horário inválido." };

  const programa = await prisma.program.findUnique({
    where: { id: programId },
    include: { releasedDays: true, departments: true },
  });
  if (!programa) return { error: "Programa não encontrado." };
  if (!(await ehGestor(userId, programa.parentRoomId))) {
    return { error: "Apenas gestores do pai podem adicionar datas." };
  }

  // Comparação por dia: o fim do período é meia-noite, então o último dia
  // inteiro continua valendo (19h–21h, por exemplo).
  const inicioPeriodo = new Date(programa.startsAt).toISOString().slice(0, 10);
  const fimPeriodo = new Date(programa.endsAt).toISOString().slice(0, 10);
  const diaInicio = chaveDia(start);
  const diaFim = chaveDia(end);
  if (diaInicio < inicioPeriodo || diaFim > fimPeriodo) {
    return { error: "A data está fora do período do programa." };
  }

  if (programa.releasedDays.length > 0) {
    const liberadas = new Set(
      programa.releasedDays.map((d) => new Date(d.date).toISOString().slice(0, 10)),
    );
    if (!liberadas.has(diaInicio)) {
      return { error: "Esta data não foi liberada pelo pai." };
    }
  }

  const filho = await prisma.programChild.findUnique({
    where: { programId_roomId: { programId, roomId } },
  });
  if (!filho) return { error: "A sala escolhida não participa do programa." };

  const departamento = programa.departments.find((d) => d.id === departmentId);
  if (!departamento?.active) return { error: "Este departamento não está disponível." };

  const bloqueio = await motivoBloqueio({
    programId,
    roomId,
    departmentId,
    regionId: filho.regionId,
    start,
  });
  if (bloqueio) return { error: bloqueio };

  const existentes = await solicitacoesAtivasDoPrograma(programId);
  const { avisos } = avaliarConflitos(
    { roomId, departmentId, regionId: filho.regionId, start },
    existentes,
  );

  // Mesma congregação + departamento + dia: a data nova substitui a anterior.
  const anteriores = await prisma.festivityRequest.findMany({
    where: { programId, roomId, departmentId },
  });
  const doMesmoDia = anteriores.filter((r) => chaveDia(r.start) === diaInicio);
  const aprovadaAnterior = doMesmoDia.find((r) => r.status === STATUS.APROVADA) ?? null;
  const pendentes = doMesmoDia.filter((r) => ABERTAS.includes(r.status));

  const destinos = new Set([programa.parentRoomId]);
  const filhos = await prisma.programChild.findMany({
    where: { programId },
    select: { roomId: true },
  });
  filhos.forEach((f) => destinos.add(f.roomId));
  destinos.delete(roomId);

  try {
    await prisma.$transaction(async (tx) => {
      if (pendentes.length > 0) {
        await tx.festivityRequest.updateMany({
          where: { id: { in: pendentes.map((p) => p.id) } },
          data: { status: STATUS.SUBSTITUIDA, supersedesId: null },
        });
      }
      if (aprovadaAnterior) {
        if (aprovadaAnterior.eventId) {
          await tx.event.delete({ where: { id: aprovadaAnterior.eventId } });
        }
        await tx.festivityRequest.update({
          where: { id: aprovadaAnterior.id },
          data: { status: STATUS.SUBSTITUIDA, supersedesId: null },
        });
      }

      const solicitacao = await tx.festivityRequest.create({
        data: {
          title,
          start,
          end,
          status: STATUS.APROVADA,
          requestedById: userId,
          decidedById: userId,
          decidedAt: new Date(),
          programId,
          departmentId,
          roomId,
        },
      });

      const evento = await criarEventoDaFestividade(tx, {
        solicitacao,
        programa,
        nomeDepartamento: departamento.name,
        destinos,
      });

      await tx.festivityRequest.update({
        where: { id: solicitacao.id },
        data: { eventId: evento.id },
      });
    });
  } catch (e) {
    console.error("adicionarDataParaFilho:", e);
    return { error: "Não foi possível adicionar a data. Tente novamente." };
  }

  revalidatePath(`/programas/${programId}`);
  revalidatePath("/programas");
  return { success: true };
}

// Setor escolhe a dedo quais dias ficam liberados para as congregações pedirem.
// Lista vazia = todos os dias do período ficam liberados.
export async function salvarDatasLiberadas(programId, datas) {
  const userId = await usuarioAtual();
  if (!userId) return { error: "Não autenticado." };

  const programa = await prisma.program.findUnique({
    where: { id: programId },
    select: { id: true, parentRoomId: true, startsAt: true, endsAt: true },
  });
  if (!programa) return { error: "Programa não encontrado." };
  if (!(await ehGestor(userId, programa.parentRoomId))) {
    return { error: "Apenas gestores do pai podem liberar datas." };
  }

  const inicio = new Date(programa.startsAt).toISOString().slice(0, 10);
  const fim = new Date(programa.endsAt).toISOString().slice(0, 10);
  const chaves = [...new Set((Array.isArray(datas) ? datas : []).map((d) => String(d).slice(0, 10)))];

  for (const chave of chaves) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(chave) || chave < inicio || chave > fim) {
      return { error: "Há uma data fora do período do programa." };
    }
  }
  chaves.sort();

  await prisma.$transaction([
    prisma.programReleasedDay.deleteMany({ where: { programId } }),
    prisma.programReleasedDay.createMany({
      data: chaves.map((chave) => ({ programId, date: new Date(`${chave}T00:00:00Z`) })),
      skipDuplicates: true,
    }),
  ]);

  revalidatePath(`/programas/${programId}`);
  revalidatePath("/programas");
  return { success: true, total: chaves.length };
}
