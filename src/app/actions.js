"use server";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

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

export async function updateRoom(formData) {
    const { userId } = await auth();
    if (!userId) return { error: "Não logado" };
    const roomId = formData.get("roomId");
    const name = formData.get("name");
    const color = formData.get("color");
    const parentId = formData.get("parentId") || null;
  
    // Verifica se é DONO para editar configurações sensíveis
    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId } } });
    if (!membership || membership.role !== 'OWNER') return { error: "Apenas o dono pode editar configurações da sala." };
  
    try {
      const updatedRoom = await prisma.room.update({ 
          where: { id: roomId }, 
          data: { name, color, parentId: parentId === "" ? null : parentId } 
      });
      revalidatePath('/dashboard');
      revalidatePath(`/dashboard/${updatedRoom.slug}`);
      revalidatePath(`/${updatedRoom.slug}`);
      return { success: true };
    } catch (error) { console.error(error); return { error: "Erro ao atualizar sala." }; }
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

// --- GESTÃO DE EVENTOS ---
export async function getRoomEvents(roomId) {
  // 1. Busca a sala atual e quem é o pai imediato dela
  const room = await prisma.room.findUnique({ 
    where: { id: roomId }, 
    include: { parent: true, children: true } 
  });

  if (!room) return [];

  // 2. Lógica de "Subir a Árvore Genealógica" (Filho -> Pai -> Avô -> Bisavô...)
  const parentIds = [];
  let currentParent = room.parent;
  
  // Enquanto houver um pai, subimos o nível
  // Limitamos a 5 níveis para segurança (evitar loop infinito se alguém configurar errado)
  let safetyCounter = 0;
  while (currentParent && safetyCounter < 5) {
    parentIds.push(currentParent.id);
    
    if (currentParent.parentId) {
       // Busca o próximo pai (Avô)
       currentParent = await prisma.room.findUnique({ 
           where: { id: currentParent.parentId }
       });
    } else {
       // Chegou na raiz (não tem mais pai)
       currentParent = null;
    }
    safetyCounter++;
  }

  // IDs das salas filhas diretas (para o Setor ver o que as Congregações marcaram)
  const childrenIds = room.children.map(c => c.id);

  // 3. Busca os eventos
  const rawEvents = await prisma.event.findMany({
    where: {
      OR: [
        { roomId: room.id }, // 1. Meus próprios eventos
        { roomId: { in: parentIds }, cascade: true }, // 2. Eventos dos Pais/Avôs (Se marcados como cascata)
        { roomId: { in: childrenIds } } // 3. Eventos dos Filhos (Para o líder fiscalizar)
      ]
    },
    include: { 
      room: { select: { name: true, color: true, type: true } },
      category: true,
      exceptions: true
    }
  });

  return rawEvents;
}

export async function createEvent(formData) {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Não logado" };
  const roomId = formData.get("roomId");
  const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId } } });
  if (!membership) return { success: false, error: "Sem permissão nesta sala" };

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    const categoryId = formData.get("categoryId");
    const isAllDay = formData.get("allDay") === "on";

    let startDate = new Date(formData.get("start"));
    let endDate = new Date(formData.get("end"));

    if (isAllDay) {
      startDate.setHours(0, 0, 0, 0);
      // O fim do dia é o início do próximo dia, como o Google Calendar faz
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }
    
    await prisma.event.create({
      data: {
        roomId,
        title: formData.get("title"),
        description: formData.get("description"),
        start: startDate, // Usando o objeto Date ajustado
        end: endDate,     // Usando o objeto Date ajustado
        allDay: isAllDay,
        cascade: formData.get("cascade") === "on", 
        categoryId: categoryId === "" ? null : categoryId,
        isRecurring: !!formData.get("rruleString"),
        rrule: formData.get("rruleString") || null,
      }
    });
    revalidatePath(`/${room.slug}`);
    revalidatePath(`/dashboard/${room.slug}`);
    return { success: true };
  } catch (e) { console.error(e); return { success: false, error: "Erro ao salvar o evento." }; }
}

export async function updateEvent(formData) {
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Não logado" };
    
    const eventId = formData.get("eventId");
    const updateMode = formData.get("updateMode"); 
    const originalDate = formData.get("originalDate") ? new Date(formData.get("originalDate")) : null;

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return { success: false, error: "Evento não encontrado" };

    const membership = await prisma.member.findUnique({ where: { userId_roomId: { userId, roomId: event.roomId } } });
    if (!membership) return { success: false, error: "Sem permissão" };

    try {
        const room = await prisma.room.findUnique({ where: { id: event.roomId } });
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

        const commonData = {
            title, description, cascade, allDay: isAllDay,
            categoryId: categoryId === "" ? null : categoryId,
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
                data: { roomId: event.roomId, ...commonData, start: newStart, end: newEnd, isRecurring: false, rrule: null }
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

        revalidatePath(`/${room.slug}`);
        revalidatePath(`/dashboard/${room.slug}`);
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