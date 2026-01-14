// Local do arquivo: src/app/api/ics/[slug]/route.js

import { PrismaClient } from "@prisma/client";
import ICalGenerator from 'ical-generator';
import { getRoomEvents } from "@/app/actions"; // Ajuste o caminho se for diferente
import { rrulestr } from 'rrule';

const prisma = new PrismaClient();

// Função para expandir eventos recorrentes (essencial para o .ics)
function expandEvents(events) {
  const startRange = new Date(new Date().setFullYear(new Date().getFullYear() - 1));
  const endRange = new Date(new Date().setFullYear(new Date().getFullYear() + 2));
  let expanded = [];
  
  events.forEach(event => {
    const exceptionDates = event.exceptions ? event.exceptions.map(ex => ex.exceptionDate) : [];
    
    const baseEvent = { 
        id: event.id, 
        title: event.title, 
        description: event.description,
        allDay: event.allDay,
        start: event.start,
        end: event.end, 
    };

    if (event.isRecurring && event.rrule) {
      try {
        const rule = rrulestr(event.rrule, { dtstart: event.start });
        const dates = rule.between(startRange, endRange);
        
        dates.forEach(date => {
          // Verifica se a ocorrência está na lista de exceções
          const isException = exceptionDates.some(exDate => exDate.getTime() === date.getTime());
          
          if (!isException) {
            const duration = event.end.getTime() - event.start.getTime();
            expanded.push({ ...baseEvent, start: date, end: new Date(date.getTime() + duration) });
          }
        });
      } catch (e) { 
        console.error("Erro ao expandir RRULE para ICS:", e); 
        // Adiciona o evento original se a regra falhar
        expanded.push(baseEvent);
      }
    } else { 
        expanded.push(baseEvent); 
    }
  });
  return expanded;
}


export async function GET(request, { params }) {
    const { slug } = params;
    if (!slug) {
        return new Response("Agenda não encontrada", { status: 404 });
    }

    const room = await prisma.room.findUnique({ where: { slug } });
    if (!room) {
        return new Response("Agenda não encontrada", { status: 404 });
    }
    
    const cal = new ICalGenerator({ name: `${room.name} | AgendaIgreja` });

    const rawEvents = await getRoomEvents(room.id);
    const events = expandEvents(rawEvents);

    events.forEach(event => {
        cal.createEvent({
            start: event.start,
            end: event.end,
            summary: event.title,
            description: event.description || '',
            allDay: event.allDay,
        });
    });

    return new Response(cal.toString(), {
        headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': `attachment; filename="${slug}.ics"`,
        },
    });
}