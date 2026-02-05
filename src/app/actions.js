// --- START OF FILE actions.js ---

"use server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

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

  try {
    // A lógica de criar o novo evento é quase idêntica à `createEvent`
    // mas com alguns campos importantes setados.
    await prisma.event.create({
      data: {
        roomId: parentRoomId, // O DONO É A SALA ATUAL!
        title: originalEvent.title,
        description: originalEvent.description,
        start: originalEvent.start,
        end: originalEvent.end,
        allDay: originalEvent.allDay,
        categoryId: originalEvent.categoryId,
        // NÃO COPIAMOS A RRULE, pois a retransmissão é de uma ocorrência específica.
        isRecurring: false, 
        rrule: null,
        // A MÁGICA: Linkamos ao evento original
        originalBroadcastEventId: originalEvent.id, 
        // Lógica de direcionamento para os filhos
        targetRooms: { connect: targetRoomsConnect } 
      }
    });

    const parentRoom = await prisma.room.findUnique({ where: { id: parentRoomId } });
    revalidatePath(`/dashboard/${parentRoom.slug}`);
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
  const group = formData.get("group");

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
    await prisma.room.update({
      where: { id: childRoomId },
      data: { group },
    });
    revalidatePath(`/dashboard/${childRoom.slug}`); // Revalida a filha
    return { success: true, message: `Grupo de "${childRoom.name}" atualizado!` };
  } catch (error) {
    return { error: "Erro ao atualizar o grupo." };
  }
}


// --- GESTÃO DE SALAS (NOVO: UPDATE E DELETE) ---
export async function createRoom(formData) {
  const { userId } = await auth();
  if (!userId) return { error: "Não autorizado" };
  const name = formData.get("name");
  const type = formData.get("type");
  const color = formData.get("color");
  const parentId = formData.get("parentId") || null;
  const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w\-]+/g, '') + '-' + Math.floor(Math.random() * 10000);
  try {
    const newRoom = await prisma.room.create({ data: { name, slug, type, color, parentId: parentId === "" ? null : parentId } });
    await prisma.member.create({ data: { userId, roomId: newRoom.id, role: 'OWNER' } });
    revalidatePath('/dashboard');
    redirect(`/dashboard/${slug}`);
  } catch (error) { return { error: "Erro ao criar sala." }; }
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
export async function getRoomEvents(roomId, monitorMode = false) {
  const room = await prisma.room.findUnique({ 
    where: { id: roomId }, 
    include: { parent: true, children: true } 
  });

  if (!room) return [];

  // 1. IDs dos Pais (Para cascata global)
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

  // 2. IDs dos Filhos diretos
  const childrenIds = room.children.map(c => c.id);

  // 3. CONSTRUÇÃO DO FILTRO (A parte mais importante)
  const orClauses = [
    // A. Meus próprios eventos
    { roomId: room.id }, 
    
    // C. Eventos DIRECIONADOS para mim (Push)
    { targetRooms: { some: { id: room.id } } }
  ];

  // B. Eventos dos Pais marcados com cascata (Global)
  // SÓ ADICIONA ESSA REGRA SE A SALA NÃO TIVER O BLOQUEIO ATIVADO
  if (!room.blockParentCascade && parentIds.length > 0) {
    orClauses.push({ roomId: { in: parentIds }, cascade: true });
  }

  // D. Lógica de VISIBILIDADE DOS FILHOS
  if (childrenIds.length > 0) {
      if (monitorMode) {
         // MODO MONITOR: Vejo TUDO dos filhos (congregacoes)
         orClauses.push({ roomId: { in: childrenIds } });
      } else {
         // MODO NORMAL: Só vejo o que o filho permitiu (visibleToParent = true)
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
  originalBroadcastEvent: { // Inclui o evento original se este for uma retransmissão
      select: {
          room: {
              select: { name: true }
          }
      }
  }
}


  });

  return events;
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

  // Datas
  const isAllDay = formData.get("allDay") === "on";
  let startDate = new Date(formData.get("start"));
  let endDate = new Date(formData.get("end"));
  if (isAllDay) {
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
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
    
    revalidatePath(`/dashboard/${room.slug}`);
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
        const isAllDay = formData.get("allDay") === "on";

        let newStart = new Date(formData.get("start"));
        let newEnd = new Date(formData.get("end"));

        if (isAllDay) {
          newStart.setHours(0, 0, 0, 0);
          newEnd = new Date(newStart);
          newEnd.setDate(newEnd.getDate() + 1);
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

// --- ADICIONE AO actions.js ---

// Local: src/app/actions.js
// Atualize apenas essa função dentro do seu arquivo

export async function getDashboardStats(roomId) {
  const { userId } = await auth();
  if (!userId) return { error: "Não autorizado" };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { children: true }
  });

  if (!room) return { totalEventsMonth: 0, categoryDistribution: [], childrenActivity: [] };
  
  const childrenIds = room.children.map(c => c.id);

  const totalEventsMonth = await prisma.event.count({
    where: {
      OR: [ { roomId: roomId }, { roomId: { in: childrenIds } } ],
      start: { gte: startOfMonth, lte: endOfMonth }
    }
  });

  const categories = await prisma.category.findMany({
    where: { roomId },
    include: { _count: { select: { events: true } } }
  });

  const childrenStats = await prisma.room.findMany({
    where: { parentId: roomId },
    select: {
      id: true,
      name: true,
      group: true,
      _count: {
        select: { events: { where: { start: { gte: startOfMonth } } } }
      }
    }
  });

  return {
    totalEventsMonth: totalEventsMonth || 0,
    categoryDistribution: categories.map(c => ({ 
        name: c.name, 
        count: c._count.events || 0, 
        color: c.color 
    })),
    childrenActivity: childrenStats.map(c => ({ 
        id: c.id, 
        name: c.name, 
        group: c.group || 'Sem Grupo', 
        count: c._count.events || 0 
    }))
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