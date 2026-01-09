import { PrismaClient } from "@prisma/client";
import { rrulestr } from 'rrule';
import PublicCalendar from "./PublicCalendar";
import { auth } from "@clerk/nextjs/server";
import { getRoomEvents } from "../actions"; // Importa a nova função

const prisma = new PrismaClient();

function expandEvents(events) {
    const startRange = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const endRange = new Date(new Date().setFullYear(new Date().getFullYear() + 2));
    let expanded = [];
    
    events.forEach(event => {
        const exceptionDates = event.exceptions ? event.exceptions.map(ex => ex.exceptionDate.toISOString().split('T')[0]) : [];
        
        // Define a cor: se o evento tem categoria, usa a cor da categoria, senão a da sala de origem
        let eventColor = event.category ? event.category.color : (event.room?.color || '#3b82f6');
        
        const baseEvent = { 
            id: event.id,
            title: event.title, 
            description: event.description,
            start: event.start,
            end: event.end,
            resource: { 
                color: eventColor,
                roomName: event.room?.name,
                isExternal: event.roomId !== event.originalRoomId // Flag para saber se veio de outra sala
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
            } catch (e) { console.error("Invalid RRULE:", e); }
        } else {
            expanded.push(baseEvent);
        }
    });
    return expanded;
}

export default async function PublicPage({ params }) {
    const { slug } = await params;
    if (!slug) return <div>Nome da agenda não fornecido.</div>;
    
    const { userId } = await auth();

    const room = await prisma.room.findUnique({ where: { slug }, include: { parent: true } });
    if (!room) return <div className="text-center p-10 font-bold">Agenda "{slug}" não encontrada.</div>;

    // Verifica se segue
    let isFollowing = false;
    if (userId) {
        const follow = await prisma.follower.findUnique({ where: { userId_roomId: { userId, roomId: room.id } } });
        isFollowing = !!follow;
    }

    // Busca inteligente de eventos (Pais -> Filhos e Filhos -> Pais)
    const rawEvents = await getRoomEvents(room.id);
    
    // Adiciona propriedade para identificar origem no frontend
    const eventsWithOrigin = rawEvents.map(e => ({...e, originalRoomId: room.id }));

    const events = expandEvents(eventsWithOrigin);
    
    // Serialização para passar do Server Component para o Client Component
    const serializableEvents = events.map(event => ({ 
        ...event, 
        start: event.start.toISOString(), 
        end: event.end.toISOString() 
    }));
    
    return <PublicCalendar room={room} events={serializableEvents} isFollowingInitially={isFollowing} isLoggedIn={!!userId} />;
}