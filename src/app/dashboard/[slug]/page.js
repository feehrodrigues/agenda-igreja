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

export default async function RoomEditorPage({ params, searchParams }) {
  const { slug } = await params;
  const { aba } = await searchParams;
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

  // Acesso herdado: se o usuario e admin/owner de um ancestral, pode gerenciar
  // esta sala (mesmo que nao seja membro direto dela).
  let acessoHerdado = false;
  if (!membership) {
      let ancestralId = room.parentId;
      while (ancestralId) {
          const m = await prisma.member.findUnique({
              where: { userId_roomId: { userId, roomId: ancestralId } },
          });
          if (m && (m.role === 'OWNER' || m.role === 'ADMIN')) {
              acessoHerdado = true;
              break;
          }
          const anc = await prisma.room.findUnique({
              where: { id: ancestralId },
              select: { parentId: true },
          });
          ancestralId = anc ? anc.parentId : null;
      }
  }

  if (!membership && !acessoHerdado) redirect("/dashboard");

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

  // Qualquer sala pode promover programas: o que importa é ter filhos diretos.
  const ehPai = room.children.length > 0;
  const idsFilhos = room.children.map((c) => c.id);
  const [programasBrutos, participacoesBrutas, avulsasBrutas] = await Promise.all([
    prisma.program.findMany({
      where: { parentRoomId: room.id },
      include: {
        children: { select: { id: true } },
        requests: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    room.parentId
      ? prisma.programChild.findMany({
          where: { roomId: room.id },
          include: {
            program: {
              include: {
                requests: {
                  where: { roomId: room.id, status: { in: ["enviada", "em_analise"] } },
                  select: { id: true },
                },
              },
            },
          },
        })
      : [],
    idsFilhos.length > 0
      ? prisma.festivityRequest.findMany({
          where: {
            programId: null,
            status: { in: ["enviada", "em_analise"] },
            roomId: { in: idsFilhos },
          },
          include: { room: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);
  const festividades = JSON.parse(JSON.stringify({
    programas: programasBrutos.map((p) => ({
      id: p.id,
      name: p.name,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      participantes: p.children.length,
      pendentes: p.requests.filter((r) => ["enviada", "em_analise"].includes(r.status)).length,
    })),
    participacoes: participacoesBrutas.map((c) => ({
      id: c.id,
      name: c.program.name,
      inviteCode: c.program.inviteCode,
      pendentes: c.program.requests.length,
      prazo: c.program.deadline,
    })),
    avulsas: avulsasBrutas.map((r) => ({
      id: r.id,
      title: r.title,
      sala: r.room.name,
      start: r.start,
      end: r.end,
      createdAt: r.createdAt,
    })),
    ehPai,
    ehGestor: ["OWNER", "ADMIN"].includes(membership.role),
  }));

  return (
    <RoomDashboard 
        abaInicial={aba}
        festividades={festividades}
        room={JSON.parse(JSON.stringify(room))}
        initialEvents={safeEvents} 
        categories={JSON.parse(JSON.stringify(categories))} 
        allParents={JSON.parse(JSON.stringify(allParents))}
        childrenRooms={JSON.parse(JSON.stringify(room.children))}
        stats={JSON.parse(JSON.stringify(stats))}
    />
  );
}