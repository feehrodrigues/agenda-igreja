// Local do arquivo: src/app/dashboard/[slug]/page.js

import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";
import { rrulestr } from 'rrule';
import { getRoomEvents, getDashboardStats } from "@/app/actions"; 
import RoomDashboard from "./RoomDashboard";

const prisma = new PrismaClient();

function expandEvents(events) {
  const startRange = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const endRange = new Date(new Date().setFullYear(new Date().getFullYear() + 2));
  let expanded = [];
  
  events.forEach(event => {
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
        roomId: event.roomId,
        room: event.room,
        targetRooms: event.targetRooms,
        visibleToParent: event.visibleToParent,
        allDay: event.allDay,
        resource: { 
            category: event.category,
            exceptions: event.exceptions,
            roomName: event.room?.name,
            color: event.category?.color || event.room?.color || '#3b82f6' 
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
      } catch (e) { console.error("Erro ao expandir RRULE:", e); expanded.push(baseEvent); }
    } else { 
        expanded.push(baseEvent); 
    }
  });
  return expanded;
}

export default async function RoomEditorPage({ params }) {
  const { slug } = await params;

  const { userId } = await auth();
  if (!userId) redirect("/");

  const room = await prisma.room.findUnique({ 
      where: { slug },
      include: { parent: true, children: true } 
  });
  
  if (!room) {
      return <div className="p-10 text-center font-bold">Agenda "{slug}" não encontrada.</div>;
  }

  const membership = await prisma.member.findUnique({ 
      where: { userId_roomId: { userId, roomId: room.id } } 
  });

  if (!membership) {
      return <div className="p-10 text-center font-bold">Acesso negado.</div>;
  }

  const [rawEvents, stats, categories, allParents] = await Promise.all([
      getRoomEvents(room.id),
      getDashboardStats(room.id),
      prisma.category.findMany({ where: { roomId: room.id }, orderBy: { name: 'asc' } }),
      prisma.room.findMany({ 
          where: { type: { in: ['ministerio', 'setor'] }, id: { not: room.id } }, 
          orderBy: { name: 'asc' } 
      })
  ]);

  const expandedEvents = expandEvents(rawEvents);
  
  const serializableEvents = expandedEvents.map(event => ({ 
    ...event, 
    start: event.start.toISOString(), 
    end: event.end.toISOString(),
    canEdit: event.roomId === room.id, 
    resource: {
        ...event.resource,
        category: event.resource.category ? { ...event.resource.category } : null
    }
  }));

  return (
    <RoomDashboard 
        room={JSON.parse(JSON.stringify(room))}
        initialEvents={serializableEvents} 
        categories={JSON.parse(JSON.stringify(categories))} 
        allParents={JSON.parse(JSON.stringify(allParents))}
        childrenRooms={JSON.parse(JSON.stringify(room.children))}
        stats={JSON.parse(JSON.stringify(stats))}
    />
  );
}