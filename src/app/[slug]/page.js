// Local: src/app/[slug]/page.js
import { PrismaClient } from "@prisma/client";
import { rrulestr } from 'rrule';
import PublicCalendar from "./PublicCalendar";
import { auth } from "@clerk/nextjs/server";
import { getRoomEvents } from "../actions";

const prisma = new PrismaClient();

function expandEvents(events) {
    const startRange = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    const endRange = new Date(new Date().setFullYear(new Date().getFullYear() + 2));
    let expanded = [];
    
    if(!events) return [];

    events.forEach(event => {
        const exceptionDates = event.exceptions ? event.exceptions.map(ex => ex.exceptionDate.toISOString().split('T')[0]) : [];
        let eventColor = event.category ? event.category.color : (event.room?.color || '#3b82f6');
        
        const baseEvent = { 
            id: event.id,
            title: event.title, 
            description: event.description,
            allDay: !!event.allDay,
            roomId: event.roomId,
            resource: { 
                color: eventColor,
                roomName: event.room?.name || "",
                isExternal: false
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
            } catch (e) { expanded.push({ ...baseEvent, start: event.start, end: event.end }); }
        } else {
            expanded.push({ ...baseEvent, start: event.start, end: event.end });
        }
    });
    return expanded;
}

export default async function PublicPage({ params }) {
    const { slug } = await params;
    const { userId } = await auth();

    const room = await prisma.room.findUnique({ 
        where: { slug }, 
        include: { parent: { select: { name: true, color: true } } } 
    });

    if (!room) return <div className="text-center p-10 font-bold">Agenda não encontrada.</div>;

    let isFollowing = false;
    if (userId) {
        const follow = await prisma.follower.findUnique({ where: { userId_roomId: { userId, roomId: room.id } } });
        isFollowing = !!follow;
    }

    const rawEvents = await getRoomEvents(room.id);
    const expanded = expandEvents(rawEvents); 
    
    // SERIALIZAÇÃO PARA O VERCEL
    const serializableEvents = JSON.parse(JSON.stringify(expanded.map(ev => ({
        ...ev,
        resource: { ...ev.resource, isExternal: ev.roomId !== room.id }
    }))));
    
    return (
        <PublicCalendar 
            room={JSON.parse(JSON.stringify(room))} 
            events={serializableEvents} 
            isFollowingInitially={isFollowing} 
            isLoggedIn={!!userId} 
        />
    );
}