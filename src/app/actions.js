// --- START OF FILE actions.js ---

"use server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rrulestr } from "rrule";
import { chaveDiaSP, fimExclusivoSP, inicioDoDiaSP, parseDataSP } from "@/lib/datas";

const prisma = new PrismaClient();

// Normaliza um evento de "dia todo": começa à meia-noite do primeiro dia e
// termina à meia-noite do dia seguinte ao último (fim exclusivo). É o formato
// que o calendário e o .ics esperam, sem virar um evento de 00:00 a 00:00.
function datasDoEvento(formData) {
  const isAllDay = formData.get("allDay") === "on";
  if (!isAllDay) {
    return {
      isAllDay,
      start: parseDataSP(formData.get("start")),
      end: parseDataSP(formData.get("end")),
    };
  }
  const inicioTexto = String(formData.get("start") ?? "").slice(0, 10);
  const fimTexto = String(formData.get("end") ?? "").slice(0, 10) || inicioTexto;
  const inicioChave = /^\d{4}-\d{2}-\d{2}$/.test(inicioTexto)
    ? inicioTexto
    : chaveDiaSP(parseDataSP(inicioTexto) ?? new Date());
  const fimChave = /^\d{4}-\d{2}-\d{2}$/.test(fimTexto)
    ? fimTexto
    : chaveDiaSP(parseDataSP(fimTexto) ?? new Date(inicioChave));
  return {
    isAllDay,
    start: inicioDoDiaSP(inicioChave),
    end: fimExclusivoSP(fimChave < inicioChave ? inicioChave : fimChave),
  };
}

// Adicione esta nova função ao seu arquivo src/app/actions.js
export async function rebroadcastEvent(formData) {
  const { userId } = await auth();
  if (!userId) return { error: "Não autorizado" };

  const originalEventId = formData.get("originalEventId");
  const parentRoomId = formData.get("parentRoomId"); // A sala que está retransmitindo
  
  // Lógica de direcionamento (exatamente como em `createEvent`)
  const targetMode = formData.get("targetMode"); // 'all', 'group', 'select'
  const targetGroup = formData.get("targetGroup");
  const specificTargetIds = formData.get("specificTargetIds") ? JSON.parse(formData.get("specificTargetIds")) : [];
  
  let targetRoomsConnect = [];

  if (targetMode === 'all') {
      const children = await prisma.room.findMany({ where: { parentId: parentRoomId }, select: { id: true } });
      targetRoomsConnect = children.map(c => ({ id: c.id }));
  } else if (targetMode === 'group' && targetGroup) {
      const children = await prisma.room.findMany({ where: { parentId: parentRoomId, group: targetGroup }, select: { id: true } });
      targetRoomsConnect = children.map(c => ({ id: c.id }));
  } else if (targetMode === 'select') {
      targetRoomsConnect = specificTargetIds.map(id => ({ id }));
  }

  // Verificar permissão
  const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId: parentRoomId } } });
  if (!membership) return { error: "Sem permissão." };

  // Buscar o evento original
  const originalEvent = await prisma.event.findUnique({ where: { id: originalEventId } });
  if (!originalEvent) return { error: "Evento original não encontrado." };

  // Só é permitido repassar para salas filhas desta sala.
  const filhas = await prisma.room.findMany({
    where: { parentId: parentRoomId },
    select: { id: true },
  });
  const idsPermitidos = new Set(filhas.map((f) => f.id));
  targetRoomsConnect = targetRoomsConnect.filter((r) => idsPermitidos.has(r.id));

  try {
    // Um evento repassado continua sendo UM evento: em vez de criar uma cópia
    // na sala do setor, conectamos os mesmos destinatários ao evento original.
    await prisma.event.update({
      where: { id: originalEventId },
      data: {
        targetRooms: { connect: targetRoomsConnect },
      },
    });

    const parentRoom = await prisma.room.findUnique({ where: { id: parentRoomId } });
    revalidatePath(`/dashboard/${parentRoom.slug}`);
    for (const destino of targetRoomsConnect) {
      const sala = await prisma.room.findUnique({ where: { id: destino.id }, select: { slug: true } });
      if (sala?.slug) revalidatePath(`/dashboard/${sala.slug}`);
    }
    return { success: true };

  } catch (e) {
    console.error(e);
    return { error: "Erro ao retransmitir evento." };
  }
}

export async function setChildRoomGroup(formData) {
  const { userId } = await auth();
  if (!userId) return { error: "Não autorizado" };

  const childRoomId = formData.get("childRoomId");
  const parentRoomId = formData.get("parentRoomId"); // O ID do pai que está fazendo a ação
  const groupBruto = formData.get("group");
  const group = groupBruto === null ? null : String(groupBruto).trim();
  const groupColorBruto = formData.get("groupColor");
  const groupColor =
    groupColorBruto === null ? null : String(groupColorBruto).trim() || null;

  if (!childRoomId || !parentRoomId) return { error: "Dados inválidos." };

  // 1. Verificar se o usuário é membro do PAI com permissão
  const membership = await prisma.member.findUnique({
    where: { userId_roomId: { userId, roomId: parentRoomId } },
  });
  if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
    return { error: "Você não tem permissão para gerenciar esta agenda." };
  }

  // 2. Verificar se a sala filha realmente pertence a este pai
  const childRoom = await prisma.room.findFirst({
    where: { id: childRoomId, parentId: parentRoomId },
  });

  if (!childRoom) {
    return { error: "Esta agenda filha não pertence a você." };
  }

  // 3. Tudo certo, atualizar o grupo
  try {
    const nomeGrupo = group === "" ? null : group;
    const corGrupo = nomeGrupo ? groupColor : null;
    const atualizada = await prisma.room.update({
      where: { id: childRoomId },
      data: { group: nomeGrupo, groupColor: corGrupo },
    });
    // A cor é da região: aplica também às salas irmãs que estão na mesma região.
    if (nomeGrupo && corGrupo) {
      await prisma.room.updateMany({
        where: { parentId: parentRoomId, group: nomeGrupo, id: { not: childRoomId } },
        data: { groupColor: corGrupo },
      });
    }
    const pai = await prisma.room.findUnique({ where: { id: parentRoomId }, select: { slug: true } });
    if (pai?.slug) revalidatePath(`/dashboard/${pai.slug}`);
    revalidatePath(`/dashboard/${childRoom.slug}`); // Revalida a filha
    revalidatePath("/dashboard");
    return {
      success: true,
      message: `Região de "${childRoom.name}" atualizada!`,
      group: atualizada.group,
      groupColor: atualizada.groupColor,
    };
  } catch (error) {
    return { error: "Erro ao atualizar o grupo." };
  }
}


// --- GESTÃO DE SALAS (NOVO: UPDATE E DELETE) ---
export async function createRoom(formData) {
  const { userId } = await auth();
  if (!userId) return { error: "Não autorizado" };
  const name = String(formData.get("name") ?? "").trim();
  const type = formData.get("type");
  const color = formData.get("color");
  const parentId = formData.get("parentId") || null;
  if (!name) return { error: "Informe o nome da sala." };
  const slug =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "") +
    "-" +
    Math.floor(Math.random() * 10000);

  try {
    const newRoom = await prisma.room.create({
      data: { name, slug, type, color, parentId: parentId === "" ? null : parentId },
    });
    await prisma.member.create({ data: { userId, roomId: newRoom.id, role: "OWNER" } });
    revalidatePath("/dashboard");
    // Devolve a sala criada: o formulário limpa sozinho e permite criar várias
    // seguidas, sem recarregar a página e sem ficar preso em "Criando…".
    return {
      success: true,
      room: {
        id: newRoom.id,
        name: newRoom.name,
        slug: newRoom.slug,
        type: newRoom.type,
        color: newRoom.color,
      },
    };
  } catch (error) {
    console.error("createRoom:", error);
    return { error: "Erro ao criar sala." };
  }
}

// ATUALIZAR SALA (Para salvar o Grupo/Região)
export async function updateRoom(formData) {
    const { userId } = await auth();
    if (!userId) return { error: "Não logado" };
    const roomId = formData.get("roomId");
    const name = formData.get("name");
    const color = formData.get("color");
    const group = formData.get("group"); // NOVO
    const parentId = formData.get("parentId") || null;
    const blockParentCascade = formData.get("blockParentCascade") === "on"; // NOVO

  
    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if (!membership || membership.role !== 'OWNER') return { error: "Apenas o dono pode editar." };
  
    try {
      const updatedRoom = await prisma.room.update({ 
          where: { id: roomId }, 
          data: { name, color, group, parentId: parentId === "" ? null : parentId, blockParentCascade } // NOVO
      });
      revalidatePath('/dashboard');
      revalidatePath(`/dashboard/${updatedRoom.slug}`);
      return { success: true };
    } catch (error) { return { error: "Erro ao atualizar." }; }
}

// BUSCAR EVENTOS (VERSÃO FINAL E CORRETA COM CONTROLE DE HIERARQUIA)
// incluirFilhos=false é usado no link público: mostra só a agenda daquela sala
// (com os eventos do setor/pai que descem para ela), sem as agendas filhas.
export async function getRoomEvents(roomId, monitorMode = false, incluirFilhos = true) {
  const room = await prisma.room.findUnique({ 
    where: { id: roomId }, 
    include: { parent: true, children: true } 
  });

  if (!room) return [];

  // 1. IDs dos Pais (para a cascata global, em qualquer nível)
  const parentIds = [];
  if (room.parent) {
      let currentParent = room.parent;
      while (currentParent) {
        parentIds.push(currentParent.id);
        if (currentParent.parentId) {
           currentParent = await prisma.room.findUnique({ where: { id: currentParent.parentId }});
        } else { currentParent = null; }
      }
  }

  // 2. IDs de TODOS os descendentes (filhos, netos, bisnetos...). O evento de
  // um setor/pai vale para a árvore inteira, não só para os filhos diretos.
  const todasAsSalas = await prisma.room.findMany({ select: { id: true, parentId: true } });
  const porPai = new Map();
  for (const sala of todasAsSalas) {
    if (!sala.parentId) continue;
    if (!porPai.has(sala.parentId)) porPai.set(sala.parentId, []);
    porPai.get(sala.parentId).push(sala.id);
  }
  const childrenIds = [];
  const fila = [...(porPai.get(room.id) ?? [])];
  while (fila.length > 0) {
    const id = fila.shift();
    childrenIds.push(id);
    fila.push(...(porPai.get(id) ?? []));
  }

  // 3. CONSTRUÇÃO DO FILTRO (A parte mais importante)
  const orClauses = [
    // A. Meus próprios eventos
    { roomId: room.id }, 
    
    // C. Eventos DIRECIONADOS para mim ou para qualquer ancestral meu.
    // Assim um evento repassado ao setor chega também às congregações abaixo.
    { targetRooms: { some: { id: { in: [room.id, ...parentIds] } } } }
  ];

  // B. Eventos dos Pais marcados com cascata (Global)
  // SÓ ADICIONA ESSA REGRA SE A SALA NÃO TIVER O BLOQUEIO ATIVADO
  if (!room.blockParentCascade && parentIds.length > 0) {
    orClauses.push({ roomId: { in: parentIds }, cascade: true });
  }

  // D. Lógica de VISIBILIDADE DOS FILHOS (opcional no link público)
  if (incluirFilhos && childrenIds.length > 0) {
      if (monitorMode) {
         // MODO MONITOR: Vejo TUDO dos descendentes (congregações)
         orClauses.push({ roomId: { in: childrenIds } });
      } else {
         // MODO NORMAL: Só vejo o que o descendente permitiu (visibleToParent = true)
         orClauses.push({ roomId: { in: childrenIds }, visibleToParent: true });
      }
  }

  const events = await prisma.event.findMany({
    where: {
  OR: orClauses
},
include: { 
  room: { select: { name: true, color: true, type: true } },
  category: true,
  exceptions: true,
  targetRooms: { select: { id: true } }, // <-- ADICIONADO PARA EDIÇÃO DE ALVOS
  
}


  });

  // Versões antigas do repasse criavam cópias do mesmo evento em várias salas.
  // Aqui eliminamos repetições idênticas (título + período) para que o setor não
  // veja a mesma atividade várias vezes ao abrir todas as filhas. O repasse novo
  // é recursivo: um evento só, visível para a árvore inteira.
  const unicos = new Map();
  for (const evento of events) {
    const assinatura = [
      evento.title,
      new Date(evento.start).toISOString(),
      new Date(evento.end).toISOString(),
      evento.allDay ? "1" : "0",
      evento.rrule ?? "",
    ].join("|");
    const atual = unicos.get(assinatura);
    if (!atual) {
      unicos.set(assinatura, evento);
    } else if (evento.roomId === roomId && atual.roomId !== roomId) {
      // Prefere a versão "dona" da agenda aberta.
      unicos.set(assinatura, evento);
    }
  }

  return [...unicos.values()];
}

  
export async function deleteRoom(formData) {
    const { userId } = await auth();
    if (!userId) return { error: "Não logado" };
    const roomId = formData.get("roomId");
    
    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if (!membership || membership.role !== 'OWNER') return { error: "Apenas o dono pode excluir a sala." };
  
    try {
      // O Prisma geralmente lida com cascade delete se configurado no schema, 
      // mas aqui garantimos limpar dependencias manuais se necessário
      await prisma.event.deleteMany({ where: { roomId } });
      await prisma.category.deleteMany({ where: { roomId } });
      await prisma.member.deleteMany({ where: { roomId } });
      await prisma.follower.deleteMany({ where: { roomId } });
      await prisma.room.delete({ where: { id: roomId } });
      
      revalidatePath('/dashboard');
      redirect('/dashboard');
    } catch (error) { console.error(error); return { error: "Erro ao excluir sala." }; }
}

export async function joinRoom(formData) {
  const { userId } = await auth();
  if (!userId) return { error: "Não autorizado" };
  const inviteCode = formData.get("inviteCode");
  if (!inviteCode) return { error: "Código inválido" };
  try {
    const room = await prisma.room.findUnique({ where: { inviteCode } });
    if (!room) return { error: "Sala não encontrada com este código." };
    await prisma.member.create({ data: { userId, roomId: room.id, role: 'ADMIN' } });
    revalidatePath('/dashboard');
    return { success: true, message: `Você entrou na sala "${room.name}"!` };
  } catch (error) {
    if (error.code === 'P2002') return { error: "Você já é membro desta sala." };
    return { error: "Ocorreu um erro." };
  }
}

export async function followRoom(roomId) {
  const { userId } = await auth();
  if (!userId) return { error: "Você precisa estar logado para seguir." };
  try {
    const existingFollow = await prisma.follower.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if(existingFollow) {
      await prisma.follower.delete({ where: { userId_roomId: { userId, roomId } } });
      return { success: true, followed: false };
    } else {
      await prisma.follower.create({ data: { userId, roomId } });
      return { success: true, followed: true };
    }
  } catch (error) { return { error: "Ocorreu um erro." }; }
}

export async function createEvent(formData) {
  const { userId } = await auth();
  const roomId = formData.get("roomId");
  
  // 1. Categoria "Na Hora"
  let categoryId = formData.get("categoryId");
  const newCategoryName = formData.get("newCategoryName");
  
  if (newCategoryName) {
      // Cria a categoria e já pega o ID
      const newCat = await prisma.category.create({
          data: { name: newCategoryName, color: "#3b82f6", roomId }
      });
      categoryId = newCat.id;
  }

  // 2. Lógica de Alvos (Para quem vai esse evento?)
  const targetMode = formData.get("targetMode"); // 'none', 'all', 'group', 'select'
  const targetGroup = formData.get("targetGroup");
  const specificTargetIds = formData.get("specificTargetIds") ? JSON.parse(formData.get("specificTargetIds")) : [];

  let targetRoomsConnect = [];

  if (targetMode === 'all') {
      // Todos os filhos diretos
      const children = await prisma.room.findMany({ where: { parentId: roomId }, select: { id: true } });
      targetRoomsConnect = children.map(c => ({ id: c.id }));
  } else if (targetMode === 'group' && targetGroup) {
      // Filhos de um grupo específico (ex: Região A)
      const children = await prisma.room.findMany({ where: { parentId: roomId, group: targetGroup }, select: { id: true } });
      targetRoomsConnect = children.map(c => ({ id: c.id }));
  } else if (targetMode === 'select') {
      // Seleção manual
      targetRoomsConnect = specificTargetIds.map(id => ({ id }));
  }

  // Datas: dia todo usa datas inteiras (inclusive no fim mostrado), sem horário.
  const { isAllDay, start: startDate, end: endDate } = datasDoEvento(formData);
  if (!startDate || !endDate || endDate <= startDate) {
    return { success: false, error: "Período inválido." };
  }

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    
    await prisma.event.create({
      data: {
        roomId,
        title: formData.get("title"),
        description: formData.get("description"),
        start: startDate,
        end: endDate,
        allDay: isAllDay,
        cascade: formData.get("cascade") === "on", 
        
        // NOVO: Permite pai ver
        visibleToParent: formData.get("visibleToParent") === "on",
        
        categoryId: categoryId === "" ? null : categoryId,
        isRecurring: !!formData.get("rruleString"),
        rrule: formData.get("rruleString") || null,
        
        // NOVO: Conecta as salas alvo (Push)
        targetRooms: { connect: targetRoomsConnect } 
      }
    });
    
    // Revalida a agenda da sala, a agenda pública e as salas alvo (o evento
    // repassado também precisa aparecer de imediato nelas).
    revalidatePath(`/dashboard/${room.slug}`);
    if (room.slug) revalidatePath(`/${room.slug}`);
    revalidatePath('/dashboard');
    if (targetRoomsConnect.length > 0) {
      const alvos = await prisma.room.findMany({
        where: { id: { in: targetRoomsConnect.map((r) => r.id) } },
        select: { slug: true },
      });
      for (const alvo of alvos) {
        if (alvo.slug) {
          revalidatePath(`/dashboard/${alvo.slug}`);
          revalidatePath(`/${alvo.slug}`);
        }
      }
    }
    return { success: true };
  } catch (e) { console.error(e); return { success: false, error: "Erro ao criar." }; }
}

export async function updateEvent(formData) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não logado" };
    
    const eventId = formData.get("eventId");
    const updateMode = formData.get("updateMode"); 
    const originalDate = formData.get("originalDate") ? new Date(formData.get("originalDate")) : null;

    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { room: true } });
    if (!event) return { success: false, error: "Evento não encontrado" };

    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId: event.roomId } } });
    if (!membership) return { success: false, error: "Sem permissão" };

    // --- INÍCIO: LÓGICA DE ATUALIZAÇÃO DE ALVOS ---
    const targetMode = formData.get("targetMode");
    const targetGroup = formData.get("targetGroup");
    const specificTargetIds = formData.get("specificTargetIds") ? JSON.parse(formData.get("specificTargetIds")) : [];

    let targetRoomsSet = []; // Usaremos `set` para substituir
    if (targetMode === 'none') {
        targetRoomsSet = [];
    } else if (targetMode === 'all') {
        const children = await prisma.room.findMany({ where: { parentId: event.roomId }, select: { id: true } });
        targetRoomsSet = children.map(c => ({ id: c.id }));
    } else if (targetMode === 'group' && targetGroup) {
        const children = await prisma.room.findMany({ where: { parentId: event.roomId, group: targetGroup }, select: { id: true } });
        targetRoomsSet = children.map(c => ({ id: c.id }));
    } else if (targetMode === 'select') {
        targetRoomsSet = specificTargetIds.map(id => ({ id }));
    }
    // --- FIM: LÓGICA DE ATUALIZAÇÃO DE ALVOS ---

    try {
        const categoryId = formData.get("categoryId");
        const { isAllDay, start: newStart, end: newEnd } = datasDoEvento(formData);
        if (!newStart || !newEnd || newEnd <= newStart) {
          return { success: false, error: "Período inválido." };
        }

        const title = formData.get("title");
        const description = formData.get("description");
        const cascade = formData.get("cascade") === "on";
        const rruleString = formData.get("rruleString") || null;
        const visibleToParent = formData.get("visibleToParent") === "on";

        const commonData = {
            title, description, cascade, allDay: isAllDay, visibleToParent,
            categoryId: categoryId === "" ? null : categoryId,
            targetRooms: { set: targetRoomsSet } // <--- APLICANDO A ATUALIZAÇÃO
        };

        if (updateMode === 'all' || !event.isRecurring) {
            await prisma.event.update({
                where: { id: eventId },
                data: { 
                    ...commonData, 
                    start: newStart, 
                    end: newEnd, 
                    isRecurring: !!rruleString,
                    rrule: rruleString,
                    exceptions: { deleteMany: {} },
                }
            });
        } 
        else if (updateMode === 'single') {
            await prisma.eventException.create({ data: { originalEventId: eventId, exceptionDate: originalDate } });
            await prisma.event.create({
                data: { roomId: event.roomId, ...commonData, start: newStart, end: newEnd, isRecurring: false, rrule: null, targetRooms: undefined } // Nova ocorrência não herda alvos
            });
        }
        else if (updateMode === 'future') {
            const newUntilDate = new Date(originalDate);
            newUntilDate.setDate(newUntilDate.getDate() - 1);
            const untilISO = newUntilDate.toISOString().replace(/[-:.]/g, '').split('T')[0] + 'T235959Z';
            
            const oldRRule = event.rrule ? event.rrule.split(';').filter(p => !p.startsWith('UNTIL') && !p.startsWith('COUNT')).join(';') : '';
            const updatedOldRRule = `${oldRRule};UNTIL=${untilISO}`;
            
            await prisma.event.update({ where: { id: eventId }, data: { rrule: updatedOldRRule } });
            
            await prisma.event.create({
                data: { roomId: event.roomId, ...commonData, start: newStart, end: newEnd, isRecurring: !!rruleString, rrule: rruleString }
            });
        }

        revalidatePath(`/${event.room.slug}`);
        revalidatePath(`/dashboard/${event.room.slug}`);
        return { success: true };
    } catch (e) { console.error(e); return { success: false, error: "Erro ao atualizar." }; }
}

export async function deleteEvent(formData) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não logado" };
    const eventId = formData.get("eventId");
    const originalDate = new Date(formData.get("originalDate"));
    const deleteMode = formData.get("deleteMode");
    
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return { success: false, error: "Evento não encontrado" };
    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId: event.roomId } } });
    if (!membership) return { success: false, error: "Sem permissão" };
    
    try {
        const room = await prisma.room.findUnique({ where: { id: event.roomId } });
        if (deleteMode === 'all' || !event.isRecurring) {
            await prisma.event.delete({ where: { id: eventId } });
        } 
        else if (deleteMode === 'single') {
            await prisma.eventException.create({ data: { originalEventId: eventId, exceptionDate: originalDate } });
        } 
        else if (deleteMode === 'future') {
            const newUntilDate = new Date(originalDate);
            newUntilDate.setDate(newUntilDate.getDate() - 1);
            const untilISO = newUntilDate.toISOString().replace(/[-:.]/g, '').split('T')[0] + 'T235959Z';
            const oldRRule = event.rrule ? event.rrule.split(';').filter(p => !p.startsWith('UNTIL')).join(';') : '';
            const newRRule = `${oldRRule};UNTIL=${untilISO}`;
            await prisma.event.update({ where: { id: eventId }, data: { rrule: newRRule } });
        }
        revalidatePath(`/${room.slug}`);
        revalidatePath(`/dashboard/${room.slug}`);
        return { success: true };
    } catch (e) { return { success: false, error: "Erro ao excluir." }; }
}

export async function createCategory(formData) {
    const { userId } = await auth();
    const roomId = formData.get("roomId");
    const name = formData.get("name");
    const color = formData.get("color");
    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if (!membership) return { error: "Sem permissão" };
    try {
        await prisma.category.create({ data: { name, color, roomId } });
        const room = await prisma.room.findUnique({where: {id: roomId}});
        revalidatePath(`/dashboard/${room.slug}`);
        return { success: true };
    } catch (e) { return { error: "Erro ao criar categoria." }; }
}

export async function deleteCategory(formData) {
    const { userId } = await auth();
    const categoryId = formData.get("categoryId");
    const roomId = formData.get("roomId");
    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if (!membership) return { error: "Sem permissão" };
    try {
        await prisma.event.updateMany({ where: { categoryId: categoryId }, data: { categoryId: null } });
        await prisma.category.delete({ where: { id: categoryId } });
        const room = await prisma.room.findUnique({where: {id: roomId}});
        revalidatePath(`/dashboard/${room.slug}`);
        return { success: true };
    } catch (e) { return { error: "Erro ao excluir categoria." }; }
}

// Gestor direto ou de algum ancestral (mesma regra das páginas de dashboard).
async function ehGestorOuAncestral(userId, sala) {
  const direto = await prisma.member.findUnique({
    where: { userId_roomId: { userId, roomId: sala.id } },
  });
  if (direto && ["OWNER", "ADMIN"].includes(direto.role)) return true;
  let ancestralId = sala.parentId;
  while (ancestralId) {
    const membro = await prisma.member.findUnique({
      where: { userId_roomId: { userId, roomId: ancestralId } },
    });
    if (membro && ["OWNER", "ADMIN"].includes(membro.role)) return true;
    const ancestral = await prisma.room.findUnique({
      where: { id: ancestralId },
      select: { parentId: true },
    });
    ancestralId = ancestral?.parentId ?? null;
  }
  return false;
}

// Expande recorrências dentro da janela — a mesma regra usada pelo calendário.
function expandirNoPeriodo(eventos, inicio, fim) {
  const saida = [];
  for (const ev of eventos) {
    const inicioEv = new Date(ev.start);
    const fimEv = new Date(ev.end);
    const duracao = Math.max(0, fimEv.getTime() - inicioEv.getTime());
    const base = {
      id: ev.id,
      title: ev.title || "Sem título",
      descricao: ev.description ?? "",
      roomId: ev.roomId,
      roomName: ev.room?.name ?? "",
      roomColor: ev.room?.color ?? "",
      categoryName: ev.category?.name ?? "",
      categoryColor: ev.category?.color ?? "",
      allDay: !!ev.allDay,
      cascade: !!ev.cascade,
      targetIds: (ev.targetRooms ?? []).map((t) => t.id),
      canEdit: false,
    };
    if (ev.isRecurring && ev.rrule) {
      try {
        const regra = rrulestr(ev.rrule, { dtstart: inicioEv });
        for (const data of regra.between(inicio, fim)) {
          const ignorada = (ev.exceptions ?? []).some(
            (ex) => chaveDiaSP(ex.exceptionDate) === chaveDiaSP(data),
          );
          if (!ignorada) saida.push({ ...base, start: data, end: new Date(data.getTime() + duracao) });
        }
        continue;
      } catch (e) { /* evento único, cai no caso abaixo */ }
    }
    if (fimEv >= inicio && inicioEv <= fim) saida.push({ ...base, start: inicioEv, end: fimEv });
  }
  return saida;
}

export async function getDashboardStats(roomId) {
  const vazio = {
    totalEventsMonth: 0, totalEventsOwnMonth: 0, upcoming7: 0, allDayMonth: 0,
    byOrigin: { proprio: 0, filha: 0, pai: 0, outro: 0 },
    categoryDistribution: [], childrenActivity: [], regions: [],
    proximosEventos: [], eventosDoMes: [], eventosPorDia: {},
    totalCongregacoes: 0, totalProgramas: 0,
  };
  const { userId } = await auth();
  if (!userId) return { ...vazio, error: "Não autorizado" };

  const sala = await prisma.room.findUnique({ where: { id: roomId } });
  if (!sala) return vazio;
  if (!(await ehGestorOuAncestral(userId, sala))) return { ...vazio, error: "Sem permissão" };

  const agora = new Date();
  const janelaInicio = new Date(agora); janelaInicio.setFullYear(agora.getFullYear() - 1);
  const janelaFim = new Date(agora); janelaFim.setFullYear(agora.getFullYear() + 2);
  const chaveHoje = chaveDiaSP(agora);
  const [ano, mes] = chaveHoje.slice(0, 7).split("-").map(Number);
  const inicioMes = inicioDoDiaSP(`${chaveHoje.slice(0, 7)}-01`);
  const fimMes = fimExclusivoSP(new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10));
  const emSeteDias = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [rawEvents, todasSalas, programas] = await Promise.all([
    getRoomEvents(roomId, false),
    prisma.room.findMany({
      select: { id: true, name: true, slug: true, group: true, groupColor: true, color: true, parentId: true },
    }),
    prisma.program.count({ where: { parentRoomId: roomId } }),
  ]);

  const porId = new Map(todasSalas.map((s) => [s.id, s]));
  const filhosPorPai = new Map();
  for (const s of todasSalas) {
    if (!s.parentId) continue;
    if (!filhosPorPai.has(s.parentId)) filhosPorPai.set(s.parentId, []);
    filhosPorPai.get(s.parentId).push(s.id);
  }
  const descendentes = [];
  const fila = [...(filhosPorPai.get(roomId) ?? [])];
  while (fila.length) {
    const id = fila.shift();
    descendentes.push(id);
    fila.push(...(filhosPorPai.get(id) ?? []));
  }
  const descendentesSet = new Set(descendentes);
  const ancestrais = new Set();
  let ancestralId = sala.parentId;
  while (ancestralId) {
    ancestrais.add(ancestralId);
    ancestralId = porId.get(ancestralId)?.parentId ?? null;
  }

  const expandidos = expandirNoPeriodo(rawEvents, janelaInicio, janelaFim);
  const origemDe = (ev) => {
    if (ev.roomId === roomId) return "proprio";
    if (descendentesSet.has(ev.roomId)) return "filha";
    if (ancestrais.has(ev.roomId)) return "pai";
    return "outro";
  };
  for (const ev of expandidos) ev.origem = origemDe(ev);

  const noMes = expandidos.filter((ev) => ev.start < fimMes && ev.end >= inicioMes);
  const nos7 = expandidos.filter((ev) => ev.start <= emSeteDias && ev.end >= agora);

  const serializar = (ev) => ({
    id: ev.id,
    title: ev.title,
    descricao: ev.descricao,
    inicio: ev.start.toISOString(),
    fim: ev.end.toISOString(),
    dia: chaveDiaSP(ev.start),
    origem: ev.origem,
    sala: ev.roomName,
    salaId: ev.roomId,
    corSala: ev.roomColor,
    categoria: ev.categoryName || "Sem categoria",
    corCategoria: ev.categoryColor || "#94a3b8",
    diaTodo: ev.allDay,
    podeEditar: ev.roomId === roomId,
  });

  const eventosPorDia = {};
  const porOrigem = { proprio: 0, filha: 0, pai: 0, outro: 0 };
  const categorias = new Map();
  for (const ev of noMes) {
    const chave = chaveDiaSP(ev.start);
    eventosPorDia[chave] = (eventosPorDia[chave] ?? 0) + 1;
    porOrigem[ev.origem] += 1;
    const nome = ev.categoryName || "Sem categoria";
    const cat = categorias.get(nome) ?? { name: nome, count: 0, color: ev.categoryColor || "#94a3b8" };
    cat.count += 1;
    categorias.set(nome, cat);
  }

  const childrenActivity = descendentes.map((id) => {
    const s = porId.get(id);
    const proprios = noMes.filter((ev) => ev.roomId === id).length;
    const acima = new Set();
    let pai = s?.parentId;
    while (pai) {
      acima.add(pai);
      pai = porId.get(pai)?.parentId ?? null;
    }
    // Eventos do setor repassados para a congregação não criam outra linha no
    // banco — por isso contamos targetRooms/cascata como atividade da sala.
    const recebidos = noMes.filter(
      (ev) => ev.roomId !== id && (ev.targetIds.includes(id) || (ev.cascade && acima.has(ev.roomId))),
    ).length;
    return {
      id,
      name: s?.name ?? "",
      slug: s?.slug ?? "",
      parentId: s?.parentId ?? null,
      group: s?.group || "",
      corRegiao: s?.groupColor || "",
      color: s?.color || "#3b82f6",
      proprios,
      recebidos,
      count: proprios + recebidos,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const porRegiao = new Map();
  for (const c of childrenActivity) {
    const nome = c.group?.trim() || "Sem região";
    const reg = porRegiao.get(nome) ?? { regiao: nome, cor: c.corRegiao || "#6366f1", salas: 0, eventos: 0 };
    reg.salas += 1;
    reg.eventos += c.count;
    porRegiao.set(nome, reg);
  }

  return {
    totalEventsMonth: noMes.length,
    totalEventsOwnMonth: porOrigem.proprio,
    upcoming7: nos7.length,
    allDayMonth: noMes.filter((ev) => ev.allDay).length,
    byOrigin: porOrigem,
    totalCongregacoes: descendentes.length,
    totalProgramas: programas,
    categoryDistribution: [...categorias.values()].sort((a, b) => b.count - a.count),
    childrenActivity,
    regions: [...porRegiao.values()].sort((a, b) => a.regiao.localeCompare(b.regiao, "pt-BR")),
    proximosEventos: [...nos7].sort((a, b) => a.start - b.start).map(serializar),
    eventosDoMes: [...noMes].sort((a, b) => a.start - b.start).map(serializar),
    eventosPorDia,
  };
}

export async function updateBulkGroups(parentId, assignments) {
  // assignments: Array de { roomId: string, group: string }
  try {
    const updates = assignments.map(a => 
      prisma.room.update({
        where: { id: a.roomId },
        data: { group: a.group }
      })
    );
    await prisma.$transaction(updates);
    revalidatePath(`/dashboard`);
    return { success: true };
  } catch (e) {
    return { error: "Erro ao atualizar grupos." };
  }
}

// Local: src/app/actions.js
// Adicione esta nova função ao final do arquivo

// Local: src/app/actions.js
// ADICIONE ESTA FUNÇÃO NO FINAL DO ARQUIVO

export async function getChildRoomEvents(childRoomId, parentRoomId) {
    const { userId } = await auth();
    if (!userId) return { error: "Não autorizado" };

    const membership = await prisma.member.findUnique({
        where: { userId_roomId: { userId, roomId: parentRoomId } },
    });
    if (!membership) {
        return { error: "Você não tem permissão para visualizar esta agenda." };
    }

    const childRoom = await prisma.room.findFirst({
        where: { id: childRoomId, parentId: parentRoomId },
    });
    if (!childRoom) {
        return { error: "Esta agenda filha não pertence a você." };
    }

    const events = await getRoomEvents(childRoomId, true);

    return {
        success: true,
        events: events.map(event => ({
            ...event,
            start: event.start.toISOString(),
            end: event.end.toISOString(),
            canEdit: false,
            room: { name: childRoom.name, color: childRoom.color },
            resource: {
                ...event.resource,
                roomName: childRoom.name,
                color: event.category?.color || childRoom.color || '#3b82f6'
            }
        }))
    };
}