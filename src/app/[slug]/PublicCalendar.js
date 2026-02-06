"use client";
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { followRoom } from '@/app/actions';
import { 
    format, parse, startOfWeek, getDay, isSameMonth, 
    startOfMonth, endOfMonth, endOfWeek, isSameDay, startOfYear, endOfYear, addMonths, startOfDay, endOfDay, differenceInCalendarDays
} from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { 
    Search, Download, Calendar as CalIcon, Clock, AlignLeft, X, 
    FileSpreadsheet, Share2, MapPin, ChevronLeft, ChevronRight, 
    LayoutList, Grid3x3, CalendarDays, MoreHorizontal, FileText, ChevronDown
} from 'lucide-react'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// --- HELPERS ---
function getContrastColor(hexcolor) {
    if(!hexcolor) return 'black';
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16); var g = parseInt(hexcolor.substr(2,2),16); var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function hexToRgb(hex) {
    if (!hex) return [0,0,0];
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) { r = parseInt("0x" + hex[1] + hex[1]); g = parseInt("0x" + hex[2] + hex[2]); b = parseInt("0x" + hex[3] + hex[3]); }
    else if (hex.length === 7) { r = parseInt("0x" + hex[1] + hex[2]); g = parseInt("0x" + hex[3] + hex[4]); b = parseInt("0x" + hex[5] + hex[6]); }
    return [r, g, b];
};

const CustomEvent = ({ event }) => {
    const textColor = getContrastColor(event.resource.color);
    return (
        <div style={{ backgroundColor: event.resource.color, color: textColor }} className="px-1.5 py-0.5 rounded text-[11px] font-bold truncate leading-tight h-full flex items-center">
            {event.title}
        </div>
    );
};

export default function PublicCalendar({ room, events: serializableEvents, isFollowingInitially, isLoggedIn }) {
  const router = useRouter();
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(isFollowingInitially);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); 
  const [googleUrl, setGoogleUrl] = useState("#");
  
  // Estados de Exportação
  const [isExportModalOpen, setIsExportModalOpen] = useState(false); 
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);   
  const [isGenerating, setIsGenerating] = useState(false);
  const [exportRange, setExportRange] = useState({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [includeVisualCalendars, setIncludeVisualCalendars] = useState(true);
  const [copySuccess, setCopySuccess] = useState('');

  // Atualização Automática
  useEffect(() => {
    const handleFocus = () => router.refresh();
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => router.refresh(), 30000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [router]);

  useEffect(() => {
    if (window.innerWidth < 768) setView('agenda');
    else setView('month');
  }, []);

  useEffect(() => {
    if (room?.slug && typeof window !== 'undefined') {
        const origin = window.location.origin;
        const icsUrl = `${origin}/api/ics/${room.slug}`;
        setGoogleUrl(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(icsUrl)}`);
    }
  }, [room]);
  
  // Processamento de Eventos
  const allEvents = useMemo(() => {
      if (!serializableEvents) return [];
      return serializableEvents.map(e => {
          const start = new Date(e.start);
          let end = new Date(e.end);
          if (isNaN(end.getTime()) || end <= start) {
              end = new Date(start);
              end.setHours(end.getHours() + 1);
          }
          return { ...e, start, end };
      });
  }, [serializableEvents]);

  const filteredEvents = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return searchTerm ? allEvents.filter(e => e.title.toLowerCase().includes(lower)) : allEvents;
  }, [allEvents, searchTerm]);

  const monthEvents = useMemo(() => {
      return filteredEvents.filter(ev => isSameMonth(ev.start, currentDate)).sort((a, b) => a.start - b.start);
  }, [filteredEvents, currentDate]);

  const getEventsInRange = (startStr, endStr) => {
      const startDate = new Date(startStr); startDate.setUTCHours(0,0,0,0);
      const endDate = new Date(endStr); endDate.setUTCHours(23,59,59,999);
      return filteredEvents.filter(ev => {
          return (ev.start >= startDate && ev.start <= endDate) || 
                 (ev.end >= startDate && ev.end <= endDate) ||
                 (ev.start <= startDate && ev.end >= endDate);
      }).sort((a, b) => a.start - b.start);
  };

  const handleFollow = async () => { const result = await followRoom(room.id); if(result.success) setIsFollowing(result.followed); };
  
  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: room.name, url }).catch(() => {});
    else {
        navigator.clipboard.writeText(url).then(() => {
            setCopySuccess('Copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    }
  };

  // --- GERAÇÃO DE PDF (COM CORREÇÃO DE GRADE INTELIGENTE) ---
  const fitTextToWidth = (doc, text, maxWidth) => {
    let textWidth = doc.getTextWidth(text);
    if (textWidth <= maxWidth) return text;
    let newText = text;
    while (textWidth > maxWidth && newText.length > 0) {
        newText = newText.slice(0, -1);
        textWidth = doc.getTextWidth(newText + "...");
    }
    return newText + "...";
  };

  const generatePDF = () => {
    setIsGenerating(true);
    try {
        const startDate = new Date(exportRange.start + 'T00:00:00');
        const endDate = new Date(exportRange.end + 'T00:00:00');
        
        const doc = new jsPDF({ orientation: includeVisualCalendars ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
        
        const drawMonth = (dateTarget) => {
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 10;
            
            // Cabeçalho
            doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0); 
            doc.text(room.name, margin, 15);
            doc.setFontSize(14); 
            doc.text(format(dateTarget, 'MMMM yyyy', {locale: ptBR}).toUpperCase(), pageWidth - margin, 15, { align: 'right' });

            // --- CÁLCULO INTELIGENTE DE SEMANAS (O SEGREDO PARA FICAR PRO) ---
            const startOfMonthCal = startOfMonth(dateTarget);
            const endOfMonthCal = endOfMonth(dateTarget);
            
            const startCal = startOfWeek(startOfMonthCal); // Domingo da primeira semana
            const endCal = endOfWeek(endOfMonthCal);       // Sábado da última semana
            
            // Calcula exatamente quantas semanas esse mês ocupa (4, 5 ou 6)
            const totalDays = differenceInCalendarDays(endCal, startCal) + 1;
            const weeksCount = Math.ceil(totalDays / 7);

            const daysHeader = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
            const headerY = 22;
            const headerHeight = 7;
            
            // Altura disponível dividida pelo número REAL de semanas
            const availableHeight = pageHeight - headerY - headerHeight - margin;
            const rowHeight = availableHeight / weeksCount; 
            const colWidth = (pageWidth - (margin * 2)) / 7; 

            // Cabeçalho da Tabela
            doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(50);
            daysHeader.forEach((day, i) => {
                doc.setFillColor(245, 245, 245); doc.setDrawColor(220);
                doc.rect(margin + (i * colWidth), headerY, colWidth, headerHeight, 'FD');
                doc.text(day, margin + (i * colWidth) + (colWidth/2), headerY + 5, { align: 'center' });
            });

            let dayIterator = new Date(startCal.getTime());
            
            // Loop Dinâmico: só roda o número de semanas necessárias
            for (let row = 0; row < weeksCount; row++) {
                for (let col = 0; col < 7; col++) {
                    const x = margin + (col * colWidth); 
                    const y = headerY + headerHeight + (row * rowHeight);
                    
                    doc.setDrawColor(200); 
                    doc.rect(x, y, colWidth, rowHeight);

                    const isCurrentMonth = isSameMonth(dayIterator, dateTarget);
                    
                    // Se não for do mês atual, pinta o fundo de cinza bem clarinho e texto mais claro
                    if (!isCurrentMonth) {
                        doc.setFillColor(252, 252, 252);
                        doc.rect(x, y, colWidth, rowHeight, 'F');
                        doc.setTextColor(200);
                        doc.setFont("helvetica", "normal");
                    } else {
                        doc.setTextColor(0);
                        doc.setFont("helvetica", "bold");
                    }
                    
                    doc.setFontSize(10); 
                    doc.text(format(dayIterator, 'd'), x + colWidth - 2, y + 5, { align: 'right' });
                    
                    // Eventos do dia
                    const dayStart = new Date(dayIterator); dayStart.setHours(0,0,0,0);
                    const dayEnd = new Date(dayIterator); dayEnd.setHours(23,59,59,999);
                    
                    const dayEvents = filteredEvents.filter(ev => 
                        (ev.start >= dayStart && ev.start <= dayEnd) || 
                        (ev.end >= dayStart && ev.end <= dayEnd) ||
                        (ev.start <= dayStart && ev.end >= dayEnd)
                    ).sort((a,b) => a.start - b.start);

                    const maxEventsPerCell = Math.floor((rowHeight - 7) / 4.5); 
                    
                    if (dayEvents.length > 0) {
                        let renderLimit = maxEventsPerCell;
                        let extraCount = 0;
                        if (dayEvents.length > maxEventsPerCell) {
                            renderLimit = maxEventsPerCell - 1;
                            extraCount = dayEvents.length - renderLimit;
                        }
                        dayEvents.slice(0, renderLimit).forEach((ev, idx) => {
                            const eventY = y + 8 + (idx * 4.5); 
                            const [r, g, b] = hexToRgb(ev.resource.color); 
                            doc.setFillColor(r, g, b); doc.circle(x + 3, eventY - 1, 1.2, 'F'); 
                            
                            // Diminui opacidade do texto se não for do mês (visual apenas)
                            if (isCurrentMonth) doc.setTextColor(0); else doc.setTextColor(180);
                            
                            doc.setFontSize(7); doc.setFont("helvetica", "normal");
                            const cleanTitle = fitTextToWidth(doc, ev.title, colWidth - 6);
                            doc.text(cleanTitle, x + 5, eventY);
                        });
                        if (extraCount > 0) {
                             const moreY = y + 8 + (renderLimit * 4.5);
                             doc.setFontSize(7); doc.setFont("helvetica", "bold"); 
                             if (isCurrentMonth) doc.setTextColor(100); else doc.setTextColor(200);
                             doc.text(`+ ${extraCount} mais`, x + 5, moreY);
                        }
                    }
                    dayIterator.setDate(dayIterator.getDate() + 1);
                }
            }
        };

        if (includeVisualCalendars) {
            let loopDate = new Date(startDate);
            loopDate.setDate(1); 
            
            while (loopDate <= endDate || isSameMonth(loopDate, endDate)) {
                drawMonth(new Date(loopDate));
                loopDate = addMonths(loopDate, 1);
                if (loopDate <= endDate || isSameMonth(loopDate, endDate)) {
                     doc.addPage('a4', 'landscape');
                }
            }
            doc.addPage('a4', 'portrait'); 
        }

        // PÁGINA DE LISTA
        const title = `Relatório de ${format(startDate, 'dd/MM/yy')} a ${format(endDate, 'dd/MM/yy')}`;
        const eventsToExport = getEventsInRange(exportRange.start, exportRange.end);
        
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0);
        doc.text(`Relatório Detalhado - ${room.name}`, 14, 20);
        doc.setFontSize(12); doc.setTextColor(80);
        doc.text(title, 14, 28);
        
        const tableData = eventsToExport.map(ev => [
            `${format(ev.start, 'dd/MM (EEE)', {locale: ptBR})}\n${ev.allDay ? 'Dia todo' : `${format(ev.start, 'HH:mm')} - ${format(ev.end, 'HH:mm')}`}`,
            ev.title + (ev.description ? `\nObs: ${ev.description}` : ''),
            ev.resource.roomName || room.name
        ]);
        
        autoTable(doc, {
            startY: 35, 
            head: [['DATA / HORA', 'EVENTO', 'LOCAL']], 
            body: tableData, 
            theme: 'grid',
            headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
            columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 40 } },
        });
        
        const fileName = `Relatorio_${room.name}_${format(startDate, 'yyyyMMdd')}.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error("Erro PDF:", error);
        alert("Erro ao gerar PDF.");
    } finally {
        setIsGenerating(false);
        setIsExportModalOpen(false);
        setIsExportMenuOpen(false);
    }
  };

  const generateExcel = () => {
    setIsGenerating(true);
    try {
        const eventsToExport = getEventsInRange(exportRange.start, exportRange.end);
        const data = eventsToExport.map(ev => ({
            'Data Início': format(ev.start, 'dd/MM/yyyy'),
            'Hora Início': ev.allDay ? 'Dia todo' : format(ev.start, 'HH:mm'),
            'Data Fim': format(ev.end, 'dd/MM/yyyy'),
            'Hora Fim': ev.allDay ? 'Dia todo' : format(ev.end, 'HH:mm'),
            'Evento': ev.title,
            'Descrição': ev.description || '',
            'Local': ev.resource.roomName || room.name
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Agenda");
        XLSX.writeFile(wb, `Relatorio_${room.name}.xlsx`);
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar Excel.");
    } finally {
        setIsGenerating(false);
        setIsExportModalOpen(false);
        setIsExportMenuOpen(false);
    }
  };

  const CustomToolbar = (toolbar) => (
    <div className="flex flex-col gap-3 mb-6 p-2 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-1 md:gap-2">
                <button onClick={() => toolbar.onNavigate('PREV')} className="p-2 hover:bg-slate-100 rounded-full transition"><ChevronLeft size={20}/></button>
                <button onClick={() => toolbar.onNavigate('NEXT')} className="p-2 hover:bg-slate-100 rounded-full transition"><ChevronRight size={20}/></button>
                <button onClick={() => toolbar.onNavigate('TODAY')} className="hidden sm:block text-xs font-bold bg-slate-100 px-3 py-2 rounded-lg">Hoje</button>
            </div>
            <span className="capitalize text-lg font-black text-slate-800">{format(toolbar.date, 'MMMM yyyy', { locale: ptBR })}</span>
        </div>
        <div className="flex p-1 bg-slate-100 rounded-xl w-full">
            {['month', 'week', 'agenda'].map((v) => (
                <button key={v} onClick={() => { toolbar.onView(v); setView(v); }} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${view === v ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>
                    {v === 'month' && <Grid3x3 size={14}/>} {v === 'week' && <CalendarDays size={14}/>} {v === 'agenda' && <LayoutList size={14}/>}
                    <span className="capitalize">{v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Lista'}</span>
                </button>
            ))}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-10">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{backgroundColor: room.color}}>{room.name.charAt(0)}</div><div className="leading-tight"><h1 className="text-base md:text-lg font-black text-slate-900 truncate max-w-[150px] md:max-w-md">{room.name}</h1><p className="text-[10px] text-slate-500 font-bold uppercase">Agenda Igreja</p></div></div>
            <div className="flex items-center gap-2">
                <div className="relative">
                    <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full font-bold text-xs hover:bg-slate-200 transition">Opções <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} /></button>
                    {isExportMenuOpen && (<div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in duration-200"><button onClick={handleShare} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><Share2 size={16} className="text-blue-500"/> {copySuccess || 'Compartilhar'}</button><a href={googleUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><CalIcon size={16} className="text-red-500"/> Google Agenda</a><div className="h-px bg-slate-100 my-1" /><button onClick={() => setIsExportModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><Download size={16} className="text-emerald-500"/> Baixar Agenda</button></div>)}
                </div>
                {isLoggedIn && <button onClick={handleFollow} className={`px-4 py-2 rounded-full font-bold text-xs transition ${isFollowing ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'}`}>{isFollowing ? 'Seguindo' : 'Seguir'}</button>}
            </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full p-4 space-y-8">
        <div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Pesquisar um evento..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[700px]">
            <Calendar localizer={localizer} events={filteredEvents} view={view} onView={setView} date={currentDate} onNavigate={setCurrentDate} components={{ toolbar: CustomToolbar, event: CustomEvent }} onSelectEvent={setSelectedEvent} culture="pt-BR" messages={{ noEventsInRange: "Sem eventos nesta data.", showMore: total => `+${total} mais` }} popup={true} className="p-4" />
        </div>
        <section className="animate-in slide-in-from-bottom duration-500"><div className="flex items-center justify-between mb-4 px-2"><h2 className="text-xl font-black text-slate-800">Resumo de {format(currentDate, 'MMMM', {locale: ptBR})}</h2><span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{monthEvents.length} eventos</span></div>{monthEvents.length > 0 ? (<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{monthEvents.map((ev, idx) => (<div key={idx} onClick={() => setSelectedEvent(ev)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group flex items-center gap-4"><div className="flex flex-col items-center justify-center min-w-[50px] h-[50px] rounded-xl bg-slate-50 text-slate-400 group-hover:bg-blue-50"><span className="text-lg font-black leading-none text-slate-600 group-hover:text-blue-600">{format(ev.start, 'dd')}</span><span className="text-[10px] font-bold uppercase">{format(ev.start, 'EEE', {locale: ptBR})}</span></div><div className="flex-1 min-w-0"><h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600">{ev.title}</h4><div className="flex items-center gap-3 mt-1 text-slate-500 text-xs font-medium"><span className="flex items-center gap-1"><Clock size={12}/> {ev.allDay ? 'Dia todo' : format(ev.start, 'HH:mm')}</span>{ev.resource.isExternal && <span className="flex items-center gap-1"><MapPin size={12}/> {ev.resource.roomName}</span>}</div></div><ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400" /></div>))}</div>) : (<div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center"><p className="text-slate-400 font-bold">Nenhum evento programado para este mês.</p></div>)}</section>
      </main>

      {selectedEvent && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}><div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden" onClick={e => e.stopPropagation()}><div className="h-2 w-full" style={{backgroundColor: selectedEvent.resource.color}}></div><div className="p-8"><div className="flex justify-between items-start mb-6"><h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedEvent.title}</h2><button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full"><X size={20}/></button></div><div className="space-y-6"><div className="flex items-start gap-4 text-slate-600 bg-slate-50 p-4 rounded-2xl"><Clock className="text-blue-500 mt-1" size={24}/><div><p className="font-black text-slate-800 capitalize">{format(selectedEvent.start, "EEEE, d 'de' MMMM", {locale: ptBR})}</p><p className="text-sm font-bold text-slate-500">{selectedEvent.allDay ? 'O dia todo' : `${format(selectedEvent.start, 'HH:mm')} até ${format(selectedEvent.end, 'HH:mm')}`}</p></div></div>{selectedEvent.description && (<div className="flex items-start gap-4 text-slate-600 px-2"><AlignLeft className="text-slate-400 mt-1" size={24}/><p className="text-sm leading-relaxed">{selectedEvent.description}</p></div>)}<div className="flex items-center gap-4 text-slate-600 px-2 pt-4 border-t border-slate-100"><MapPin className="text-slate-400" size={24}/><span className="text-sm font-black text-slate-700">{selectedEvent.resource.roomName || room.name}</span></div></div><button onClick={() => setSelectedEvent(null)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition shadow-lg">Fechar</button></div></div></div>)}

      {/* MODAL DE EXPORTAÇÃO */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in p-6">
                <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4"><h2 className="text-xl font-black text-slate-900">Configurar Download</h2><button onClick={() => setIsExportModalOpen(false)}><X className="text-slate-400 hover:text-slate-700"/></button></div>
                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4"><div><label className="text-xs font-bold text-slate-500 uppercase">Data Início</label><input type="date" value={exportRange.start} onChange={e => setExportRange({...exportRange, start: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl mt-1 text-sm font-bold text-slate-700"/></div><div><label className="text-xs font-bold text-slate-500 uppercase">Data Final</label><input type="date" value={exportRange.end} onChange={e => setExportRange({...exportRange, end: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl mt-1 text-sm font-bold text-slate-700"/></div></div>
                    <div className="flex gap-2"><button onClick={() => setExportRange({start: format(startOfMonth(new Date()), 'yyyy-MM-dd'), end: format(endOfMonth(new Date()), 'yyyy-MM-dd')})} className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100">Mês Atual</button><button onClick={() => setExportRange({start: format(startOfYear(new Date()), 'yyyy-MM-dd'), end: format(endOfYear(new Date()), 'yyyy-MM-dd')})} className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200">Ano Inteiro</button></div>
                    <div className="h-px bg-slate-100 my-2"></div>
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50"><input type="checkbox" checked={includeVisualCalendars} onChange={(e) => setIncludeVisualCalendars(e.target.checked)} className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"/><div><span className="block font-bold text-sm text-slate-800">Incluir Calendário Visual</span><span className="text-xs text-slate-500">Gera uma página com a grade do mês (estilo mural).</span></div></label>
                    <div className="grid grid-cols-2 gap-4 pt-2"><button onClick={generateExcel} disabled={isGenerating} className="flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-200 transition disabled:opacity-50"><FileSpreadsheet size={20}/> Excel</button><button onClick={generatePDF} disabled={isGenerating} className="flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 transition disabled:opacity-50"><FileText size={20}/> {isGenerating ? 'Gerando...' : 'Baixar PDF'}</button></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}