import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import AdminCalendar from "./AdminCalendar";
import { rrulestr } from 'rrule';
import { getRoomEvents } from "../../actions"; // Confirme se o caminho está certo: sobe 2 níveis

const prisma = new PrismaClient();

// Função auxiliar para expandir eventos recorrentes
function expandEvents(events) {
  const startRange = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const endRange = new Date(new Date().setFullYear(new Date().getFullYear() + 2));
  let expanded = [];
  
  events.forEach(event => {
    // Garante que exceptions seja um array
    const exceptionDates = event.exceptions ? event.exceptions.map(ex => ex.exceptionDate.toISOString().split('T')[0]) : [];
    
    const baseEvent = { 
        id: event.id, 
        title: event.title, 
        description: event.description, 
        cascade: event.cascade, 
        rrule: event.rrule, 
        categoryId: event.categoryId,
        start: event.start,
        end: event.end, 
        resource: { 
            category: event.category,
            exceptions: event.exceptions,
            roomName: event.room?.name,
            color: event.category?.color || event.room?.color || '#3b82f6' // Cor de segurança
        } 
    };

    if (event.isRecurring && event.rrule) {
      try {
        const rule = rrulestr(event.rrule, { dtstart: event.start });
        const dates = rule.between(startRange, endRange);
        dates.forEach(date => {
          if (!exceptionDates.includes(date.toISOString().split('T')[0])) {
            const duration = event.end.getTime() - event.start.getTime();
            expanded.push({ ...baseEvent, start: date, end: new Date(date.getTime() + duration) });
          }
        });
      } catch (e) { console.error("Erro ao expandir RRULE:", e); }
    } else { 
        expanded.push(baseEvent); 
    }
  });
  return expanded;
}

export default async function RoomEditor({ params }) {
  // --- CORREÇÃO NEXT.JS 15: AWAIT PARAMS ---
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  if (!slug) return <div className="p-10 text-center">Slug inválido.</div>;

  const { userId } = await auth();
  if (!userId) redirect("/");

  // 1. Busca a sala
  const room = await prisma.room.findUnique({ where: { slug } });
  
  if (!room) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <h1 className="text-2xl font-bold text-red-600">Sala não encontrada</h1>
            <p className="text-slate-500">A agenda "{slug}" não existe ou foi apagada.</p>
            <a href="/dashboard" className="text-blue-600 hover:underline">Voltar ao Painel</a>
        </div>
      );
  }

  // 2. Verifica Permissão
  const membership = await prisma.member.findUnique({ 
      where: { userId_roomId: { userId, roomId: room.id } } 
  });

  if (!membership) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4">
            <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
            <p className="text-slate-500">Você não é membro desta sala.</p>
            <a href="/dashboard" className="text-blue-600 hover:underline">Voltar ao Painel</a>
        </div>
      );
  }

  // 3. Busca Dados (Com tratamento de erro caso a função falhe)
  let rawEvents = [];
  try {
      rawEvents = await getRoomEvents(room.id);
  } catch (error) {
      console.error("Erro ao buscar eventos:", error);
      // Não trava a página, apenas mostra sem eventos
  }

  const events = expandEvents(rawEvents);
  
  // Serialização (Datas para String) para o Client Component
  const serializableEvents = events.map(event => ({ 
      ...event, 
      start: event.start.toISOString(), 
      end: event.end.toISOString(),
      resource: {
          ...event.resource,
          category: event.resource.category ? { ...event.resource.category } : null
      }
  }));

  const categories = await prisma.category.findMany({ where: { roomId: room.id }, orderBy: { name: 'asc' } });
  
  // Busca pais (Setores/Ministérios)
  const allParents = await prisma.room.findMany({ 
      where: { 
          type: { in: ['ministerio', 'setor'] }, 
          id: { not: room.id } 
      }, 
      orderBy: { name: 'asc' } 
  });
  
  return (
    <AdminCalendar 
        room={room} 
        initialEvents={serializableEvents} 
        categories={categories} 
        allParents={allParents} 
    />
  );
}