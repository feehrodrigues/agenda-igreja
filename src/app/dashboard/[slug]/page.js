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
  
  if (!events) return [];

  events.forEach(event => {
    const exceptionDates = event.exceptions ? event.exceptions.map(ex => {
        try { return ex.exceptionDate.toISOString().split('T')[0]; } catch(e) { return null; }
    }).filter(Boolean) : [];
    
    const baseEvent = { 
        id: event.id, 
        title: event.title || "Sem título", 
        description: event.description || "", 
        cascade: !!event.cascade, 
        rrule: event.rrule || null, 
        categoryId: event.categoryId || null,
        start: event.start,
        end: event.end,
        roomId: event.roomId,
        room: event.room ? { name: event.room.name, color: event.room.color } : null,
        visibleToParent: !!event.visibleToParent,
        allDay: !!event.allDay,
        resource: { 
            roomName: event.room?.name || "",
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
      } catch (e) { expanded.push(baseEvent); }
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

  // BUSCA COM PROTEÇÃO
  const room = await prisma.room.findUnique({ 
      where: { slug },
      include: { 
          children: true,
          parent: { select: { id: true, name: true, color: true } } 
      } 
  });
  
  if (!room) redirect("/dashboard");

  const membership = await prisma.member.findUnique({ 
      where: { userId_roomId: { userId, roomId: room.id } } 
  });

  if (!membership) redirect("/dashboard");

  const [rawEvents, stats, categories, allParents] = await Promise.all([
      getRoomEvents(room.id),
      getDashboardStats(room.id),
      prisma.category.findMany({ where: { roomId: room.id }, orderBy: { name: 'asc' } }),
      prisma.room.findMany({ 
          where: { type: { in: ['ministerio', 'setor'] }, id: { not: room.id } }, 
          select: { id: true, name: true, color: true }
      })
  ]);

  const expandedEvents = expandEvents(rawEvents);
  
  // SERIALIZAÇÃO ULTRA SEGURA (Evita o erro de Digest)
  const safeEvents = JSON.parse(JSON.stringify(expandedEvents.map(ev => ({
      ...ev,
      canEdit: ev.roomId === room.id
  }))));

  return (
    <RoomDashboard 
        room={JSON.parse(JSON.stringify(room))}
        initialEvents={safeEvents} 
        categories={JSON.parse(JSON.stringify(categories))} 
        allParents={JSON.parse(JSON.stringify(allParents))}
        childrenRooms={JSON.parse(JSON.stringify(room.children))}
        stats={JSON.parse(JSON.stringify(stats))}
    />
  );
}