import { PrismaClient } from "@prisma/client";
import ical from 'ical-generator';
import { rrulestr } from 'rrule';

const prisma = new PrismaClient();

export async function GET(request, { params }) {
    const { slug } = params;
    
    const room = await prisma.room.findUnique({ 
        where: { slug },
        include: { parent: true, children: true }
    });

    if (!room) return new Response("Agenda não encontrada", { status: 404 });

    // Reutiliza logica simplificada de busca de eventos (copiada ou importada)
    // Para simplificar aqui, vou buscar direto os eventos da sala e pais cascatas
    const parentIds = [];
    if(room.parentId) parentIds.push(room.parentId);

    const rawEvents = await prisma.event.findMany({
        where: {
            OR: [
                { roomId: room.id },
                { roomId: { in: parentIds }, cascade: true }
            ]
        }
    });

    const calendar = ical({ name: `Agenda - ${room.name}` });

    rawEvents.forEach(event => {
        calendar.createEvent({
            start: event.start,
            end: event.end,
            summary: event.title,
            description: event.description,
            location: room.name,
            // Se for recorrente, o Google Agenda entende melhor se expandirmos ou enviarmos a RRULE
            // O ical-generator suporta repeating via repeating property, mas rrule string direta é melhor para compatibilidade
            repeating: event.rrule ? event.rrule : null 
        });
    });

    return new Response(calendar.toString(), {
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${slug}.ics"`
        }
    });
}