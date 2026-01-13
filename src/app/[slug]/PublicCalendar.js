"use client";
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { followRoom } from '@/app/actions';
import { 
    format, parse, startOfWeek, getDay, isSameMonth, 
    isSameYear, startOfMonth, endOfMonth, endOfWeek, 
    addDays, isSameDay 
} from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Search, Download, Calendar as CalIcon, Clock, AlignLeft, X, FileSpreadsheet } from 'lucide-react'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Função auxiliar para converter HEX para RGB
const hexToRgb = (hex) => {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt("0x" + hex[1] + hex[1]);
        g = parseInt("0x" + hex[2] + hex[2]);
        b = parseInt("0x" + hex[3] + hex[3]);
    } else if (hex.length === 7) {
        r = parseInt("0x" + hex[1] + hex[2]);
        g = parseInt("0x" + hex[3] + hex[4]);
        b = parseInt("0x" + hex[5] + hex[6]);
    }
    return [r, g, b];
};

function getContrastColor(hexcolor) {
    if(!hexcolor) return 'black';
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

const ScreenEvent = ({ event }) => {
    const textColor = getContrastColor(event.resource.color);
    return (
        <div style={{ 
            backgroundColor: event.resource.color, 
            color: textColor, 
            borderRadius: '3px',
            height: '100%',
            padding: '2px 4px',
            overflow: 'hidden',
            fontSize: '11px',
            lineHeight: '1.2',
            borderLeft: '3px solid rgba(0,0,0,0.2)'
        }}>
            <span style={{ fontWeight: 'bold', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {event.title}
            </span>
            {event.resource.roomName && (
                <span style={{ fontSize: '9px', opacity: 0.9, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {event.resource.roomName}
                </span>
            )}
        </div>
    );
};

export default function PublicCalendar({ room, events: serializableEvents, isFollowingInitially, isLoggedIn }) {
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(isFollowingInitially);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [googleUrl, setGoogleUrl] = useState("#");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => { router.refresh(); }, 30000); 
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        const url = `${origin}/api/ics/${room.slug}`;
        setGoogleUrl(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url.replace('https://', 'http://'))}`);
    }
  }, [room.slug]);
  
  const allEvents = useMemo(() => serializableEvents.map(event => ({ ...event, start: new Date(event.start), end: new Date(event.end) })), [serializableEvents]);

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return allEvents;
    const lower = searchTerm.toLowerCase();
    return allEvents.filter(e => 
      e.title.toLowerCase().includes(lower) || 
      (e.resource.roomName && e.resource.roomName.toLowerCase().includes(lower))
    );
  }, [allEvents, searchTerm]);

  const currentMonthEvents = useMemo(() => {
      return filteredEvents
        .filter(ev => isSameMonth(ev.start, currentDate) && isSameYear(ev.start, currentDate))
        .sort((a,b) => a.start - b.start);
  }, [filteredEvents, currentDate]);

  const handleFollow = async () => {
    const result = await followRoom(room.id);
    if(result.success) setIsFollowing(result.followed);
    else alert(result.error);
  };

  // ==========================================================
  // GERAÇÃO VETORIAL (CORRIGIDA E ALINHADA)
  // ==========================================================
  const generateVectorPDF = () => {
      setIsGeneratingPdf(true);
      try {
          const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
          const width = doc.internal.pageSize.getWidth();
          const height = doc.internal.pageSize.getHeight();
          const margin = 10;
          
          // --- PÁGINA 1: CALENDÁRIO VISUAL ---
          
          // Cabeçalho
          doc.setFontSize(26);
          doc.setFont("helvetica", "bold");
          doc.text(room.name, margin, 15);
          
          doc.setFontSize(14);
          doc.setFont("helvetica", "normal");
          doc.text("AGENDA OFICIAL", margin, 22);

          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          doc.text(format(currentDate, 'MMMM yyyy', {locale: ptBR}).toUpperCase(), width - margin, 15, { align: 'right' });

          // Configuração da Grade
          const startMonth = startOfMonth(currentDate);
          const endMonth = endOfMonth(currentDate);
          const startDate = startOfWeek(startMonth);
          const endDate = endOfWeek(endMonth);

          const daysHeader = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
          const colWidth = (width - (margin * 2)) / 7;
          const headerHeight = 10;
          const rowHeight = 30; 
          const headerY = 30;

          // 1. Desenha cabeçalho dos dias da semana (CORRIGIDO)
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0); // Texto preto
          doc.setLineWidth(0.1); // Linha fina

          daysHeader.forEach((day, i) => {
              const x = margin + (i * colWidth);
              
              // Fundo Cinza + Borda
              doc.setFillColor(240, 240, 240); 
              doc.setDrawColor(0, 0, 0); // Borda preta
              doc.rect(x, headerY, colWidth, headerHeight, 'FD'); // F = Fill, D = Draw Stroke
              
              // Texto Centralizado
              doc.text(day, x + (colWidth/2), headerY + 6.5, { align: 'center' });
          });

          // 2. Desenha os dias
          let day = startDate;
          let currentRow = 0;
          const gridStartY = headerY + headerHeight; // Começa exatamente onde o cabeçalho termina
          
          doc.setFontSize(10);
          
          while (day <= endDate) {
              for (let i = 0; i < 7; i++) {
                  const x = margin + (i * colWidth);
                  const y = gridStartY + (currentRow * rowHeight);
                  const isCurrent = isSameMonth(day, currentDate);
                  
                  // Borda do Dia
                  doc.setDrawColor(150, 150, 150); // Borda cinza suave para os dias
                  doc.rect(x, y, colWidth, rowHeight);
                  
                  // Número do dia
                  doc.setFont("helvetica", isCurrent ? "bold" : "normal");
                  doc.setTextColor(isCurrent ? 0 : 150);
                  doc.text(format(day, 'd'), x + colWidth - 2, y + 5, { align: 'right' });

                  // Bolinhas dos eventos
                  const dayEvents = filteredEvents.filter(e => isSameDay(e.start, day));
                  const maxEventsToShow = 4;
                  
                  dayEvents.slice(0, maxEventsToShow).forEach((ev, idx) => {
                      const eventY = y + 10 + (idx * 4.5);
                      const [r, g, b] = hexToRgb(ev.resource.color);
                      
                      // Bolinha
                      doc.setFillColor(r, g, b);
                      doc.circle(x + 3, eventY - 1, 1.5, 'F');
                      
                      // Texto
                      doc.setTextColor(0); // Texto preto
                      doc.setFontSize(7);
                      doc.setFont("helvetica", "normal");
                      
                      let title = ev.title;
                      if (title.length > 25) title = title.substring(0, 23) + '..';
                      doc.text(title, x + 6, eventY);
                  });
                  
                  if (dayEvents.length > maxEventsToShow) {
                      doc.setFontSize(6);
                      doc.setTextColor(100);
                      doc.text(`+ ${dayEvents.length - maxEventsToShow} mais`, x + 3, y + rowHeight - 2);
                  }

                  day = addDays(day, 1);
              }
              currentRow++;
              if(currentRow > 5) break; 
          }

          // --- PÁGINA 2: LISTA DETALHADA ---
          doc.addPage('a4', 'portrait');
          
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0);
          doc.text("Detalhamento dos Eventos", 14, 20);
          
          doc.setFontSize(12);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100);
          doc.text(`${room.name} - ${format(currentDate, 'MMMM yyyy', {locale: ptBR})}`, 14, 28);

          const tableData = currentMonthEvents.map(ev => [
              `${format(ev.start, 'dd/MM (EEE)', {locale: ptBR})}\n${format(ev.start, 'HH:mm')} - ${format(ev.end, 'HH:mm')}`,
              ev.title + (ev.description ? `\n\nObs: ${ev.description}` : ''),
              ev.resource.roomName || room.name
          ]);

          autoTable(doc, {
              startY: 35,
              head: [['DATA / HORA', 'EVENTO', 'LOCAL']],
              body: tableData,
              theme: 'grid',
              styles: { fontSize: 10, cellPadding: 3, valign: 'middle', lineColor: [200, 200, 200] },
              headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: 'bold' },
              columnStyles: {
                  0: { width: 40, fontStyle: 'bold' }, 
                  2: { width: 40 }
              },
          });
          
          const pageCount = doc.internal.getNumberOfPages();
          for(let i = 1; i <= pageCount; i++) {
              doc.setPage(i);
              doc.setFontSize(8);
              doc.setTextColor(150);
              doc.text(`Gerado por Agenda Igreja - Página ${i} de ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
          }

          doc.save(`Relatorio_${room.slug}_${format(currentDate, 'MM_yyyy')}.pdf`);

      } catch (error) {
          console.error("Erro PDF:", error);
          alert("Erro ao gerar PDF.");
      } finally {
          setIsGeneratingPdf(false);
      }
  };


  const exportExcel = () => {
      const dataToExport = filteredEvents.map(ev => ({
          'Evento': ev.title,
          'Início': format(ev.start, 'dd/MM/yyyy HH:mm'),
          'Fim': format(ev.end, 'dd/MM/yyyy HH:mm'),
          'Local': ev.resource.roomName || room.name,
          'Descrição': ev.description || '',
      }));
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Agenda");
      const dateString = format(currentDate, 'MMMM_yyyy', { locale: ptBR });
      XLSX.writeFile(wb, `Agenda_${room.slug}_${dateString}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      
      {/* HEADER TELA */}
      <header className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black text-3xl shadow-lg" style={{backgroundColor: room.color}}>{room.name.charAt(0)}</div>
            <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900">{room.name}</h1>
                <p className="text-slate-500 font-medium">Agenda Oficial</p>
            </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-center">
            {isLoggedIn && (
            <button onClick={handleFollow} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all ${isFollowing ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                {isFollowing ? '✓ Seguindo' : '+ Seguir'}
            </button>
            )}
            <a href={googleUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm">
                <CalIcon size={16} /> Add Google
            </a>
            <button onClick={exportExcel} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white font-bold hover:bg-green-700 transition-all text-sm shadow-md">
                <FileSpreadsheet size={16} /> Excel
            </button>
            <button onClick={generateVectorPDF} disabled={isGeneratingPdf} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all text-sm shadow-md">
                <Download size={16} /> {isGeneratingPdf ? 'Gerando...' : 'Baixar PDF'}
            </button>
        </div>
      </header>

      {/* BARRA DE PESQUISA */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="relative w-full md:w-1/3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input 
                type="text" 
                className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="Filtrar eventos..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      {/* CALENDÁRIO VISUAL (TELA) */}
      <main className="max-w-7xl mx-auto bg-white p-4 rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <Calendar
                localizer={localizer}
                events={filteredEvents}
                defaultView="month"
                views={['month', 'week', 'day', 'agenda']}
                culture="pt-BR"
                style={{ height: 700 }}
                date={currentDate}
                onNavigate={(date) => setCurrentDate(date)}
                components={{ event: ScreenEvent }}
                onSelectEvent={(event) => setSelectedEvent(event)}
                messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", noEventsInRange: "Sem eventos.", showMore: total => `+${total} ver mais` }}
                popup={true}
            />
      </main>

      {/* MODAL DETALHES (TELA) */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in border-t-8" style={{borderColor: selectedEvent.resource.color}}>
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedEvent.title}</h2>
                        <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-1 rounded-full"><X size={20}/></button>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-start gap-3 text-slate-600">
                            <Clock className="shrink-0 mt-0.5" size={20}/>
                            <div>
                                <p className="font-bold text-slate-800 capitalize">{format(selectedEvent.start, "EEEE, d 'de' MMMM", {locale: ptBR})}</p>
                                <p className="text-sm">{format(selectedEvent.start, 'HH:mm')} até {format(selectedEvent.end, 'HH:mm')}</p>
                            </div>
                        </div>
                        {selectedEvent.description && (
                            <div className="flex items-start gap-3 text-slate-600">
                                <AlignLeft className="shrink-0 mt-0.5" size={20}/>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedEvent.description}</p>
                            </div>
                        )}
                        <div className="flex items-center gap-3 text-slate-600">
                            <div className="w-5 h-5 rounded-full shrink-0" style={{backgroundColor: selectedEvent.resource.color}}></div>
                            <span className="text-sm font-bold">{selectedEvent.resource.roomName || room.name}</span>
                        </div>
                    </div>
                    <div className="mt-8 pt-4 border-t flex justify-end">
                        <button onClick={() => setSelectedEvent(null)} className="px-5 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800 transition">Fechar</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}