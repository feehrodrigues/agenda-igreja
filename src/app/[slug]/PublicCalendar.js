"use client";
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { followRoom } from '@/app/actions';
import { 
    format, parse, startOfWeek, getDay, isSameMonth, 
    isSameYear, startOfMonth, endOfMonth, endOfWeek, 
    isSameDay, startOfYear, endOfYear
} from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Search, Download, Calendar as CalIcon, Clock, AlignLeft, X, FileSpreadsheet, Share2 } from 'lucide-react'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

function getContrastColor(hexcolor) {
    if(!hexcolor) return 'black';
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
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

function formatTimeRange(start, end, isAllDay) {
    if (isAllDay) return '';
    const startHour = format(start, 'H');
    const startMinutes = format(start, 'mm');
    const endHour = format(end, 'H');
    const endMinutes = format(end, 'mm');
    const startTime = startMinutes === '00' ? `${startHour}h` : format(start, 'H:mm');
    if ((end.getTime() - start.getTime()) <= 60 * 60 * 1000) return startTime;
    const endTime = endMinutes === '00' ? `${endHour}h` : format(end, 'H:mm');
    return `${startTime}-${endTime}`;
}

const CustomEvent = ({ event }) => {
    const textColor = getContrastColor(event.resource.color);
    const timeLabel = formatTimeRange(event.start, event.end, event.allDay);
    const showRoomName = event.resource.isExternal && event.resource.roomName;

    return (
        <div style={{ backgroundColor: event.resource.color, color: textColor, borderRadius: '4px', height: '100%', padding: '2px 5px', overflow: 'hidden', fontSize: '12px', lineHeight: 1.3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</span>
                {timeLabel && (<span style={{ opacity: 0.9, whiteSpace: 'nowrap', fontSize: '11px' }}>{timeLabel}</span>)}
            </div>
            {showRoomName && (<span style={{ fontSize: '10px', opacity: 0.9, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: '500' }}>{event.resource.roomName}</span>)}
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportRange, setExportRange] = useState({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [includeVisualCalendars, setIncludeVisualCalendars] = useState(false);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        setCopySuccess('Link copiado!');
        setTimeout(() => setCopySuccess(''), 2000);
    }, () => {
        setCopySuccess('Falha ao copiar.');
        setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  useEffect(() => {
    const interval = setInterval(() => { router.refresh(); }, 30000); 
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (room && room.slug && typeof window !== 'undefined') {
        const origin = window.location.origin;
        const url = `${origin}/api/ics/${room.slug}`;
        setGoogleUrl(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`);
    }
  }, [room]);
  
  const allEvents = useMemo(() => serializableEvents ? serializableEvents.map(event => ({ ...event, start: new Date(event.start), end: new Date(event.end) })) : [], [serializableEvents]);

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return allEvents;
    const lower = searchTerm.toLowerCase();
    return allEvents.filter(e => e.title.toLowerCase().includes(lower) || (e.resource.roomName && e.resource.roomName.toLowerCase().includes(lower)));
  }, [allEvents, searchTerm]);

  const handleFollow = async () => {
    const result = await followRoom(room.id);
    if(result.success) setIsFollowing(result.followed);
    else alert(result.error);
  };

  const getEventsInRange = (start, end) => {
      const startDate = new Date(start);
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setUTCHours(23, 59, 59, 999); 
      return filteredEvents.filter(ev => ev.start >= startDate && ev.start <= endDate).sort((a, b) => a.start - b.start);
  };
  
  const generatePDF = (isVisual, startDateStr, endDateStr) => {
    setIsGenerating(true);
    try {
        const startDate = new Date(startDateStr + 'T00:00:00');
        const endDate = new Date(endDateStr + 'T00:00:00');

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const drawMonth = (date) => {
            const width = doc.internal.pageSize.getWidth();
            const margin = 10;
            doc.setFontSize(26); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0); doc.text(room.name, margin, 15);
            doc.setFontSize(16); doc.text(format(date, 'MMMM yyyy', {locale: ptBR}).toUpperCase(), width - margin, 15, { align: 'right' });

            const startOfMonthCal = startOfMonth(date);
            const startCal = startOfWeek(startOfMonthCal);
            let endCal = endOfWeek(endOfMonth(date));
            const dayDiff = Math.round((endCal - startCal) / (1000 * 60 * 60 * 24));
            if (dayDiff < 41) { endCal = new Date(startCal.getTime() + 41 * 24 * 60 * 60 * 1000); }

            const daysHeader = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
            const colWidth = (width - (margin * 2)) / 7; const headerHeight = 8;
            const rowHeight = (doc.internal.pageSize.getHeight() - 40 - headerHeight) / 6;
            const headerY = 25;
            doc.setFontSize(8); doc.setFont("helvetica", "bold");
            daysHeader.forEach((day, i) => {
                doc.setFillColor(240, 240, 240); doc.rect(margin + (i * colWidth), headerY, colWidth, headerHeight, 'F');
                doc.text(day, margin + (i * colWidth) + (colWidth/2), headerY + 5.5, { align: 'center' });
            });

            let day = new Date(startCal.getTime());
            for (let row = 0; row < 6; row++) {
                for (let col = 0; col < 7; col++) {
                    const x = margin + (col * colWidth); const y = headerY + headerHeight + (row * rowHeight);
                    doc.setDrawColor(200); doc.rect(x, y, colWidth, rowHeight);
                    doc.setFontSize(10); doc.setFont("helvetica", isSameMonth(day, date) ? "bold" : "normal");
                    doc.setTextColor(isSameMonth(day, date) ? 0 : 150);
                    doc.text(format(day, 'd'), x + colWidth - 2, y + 5, { align: 'right' });
                    const dayEvents = getEventsInRange(day, day);
                    dayEvents.slice(0, 5).forEach((ev, idx) => {
                        const eventY = y + 9 + (idx * 4); if (eventY > y + rowHeight - 3) return;
                        const [r, g, b] = hexToRgb(ev.resource.color); doc.setFillColor(r, g, b);
                        doc.circle(x + 2.5, eventY - 1, 1, 'F'); doc.setTextColor(0);
                        doc.setFontSize(6); doc.setFont("helvetica", "normal");
                        let title = ev.title.length > 20 ? ev.title.substring(0, 18) + '..' : ev.title;
                        doc.text(title, x + 4.5, eventY);
                    });
                    day.setDate(day.getDate() + 1);
                }
            }
        };
        
        if (isVisual) {
            let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
            let isFirstPage = true;
            while (currentMonth <= endDate) {
                if (!isFirstPage) doc.addPage('a4', 'landscape');
                drawMonth(new Date(currentMonth));
                isFirstPage = false;
                currentMonth.setMonth(currentMonth.getMonth() + 1);
            }
        }
        
        doc.addPage('a4', 'portrait');
        const title = `Relatório de ${format(startDate, 'dd/MM/yy')} a ${format(endDate, 'dd/MM/yy')}`;
        const eventsToExport = getEventsInRange(startDate, endDate);
        doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(0,0,0);
        doc.text(`Relatório de Eventos - ${room.name}`, 14, 20);
        doc.setFontSize(12); doc.setTextColor(0,0,0);
        doc.text(title, 14, 28);
        const tableData = eventsToExport.map(ev => [
            `${format(ev.start, 'dd/MM (EEE)', {locale: ptBR})}\n${ev.allDay ? 'Dia todo' : `${format(ev.start, 'HH:mm')} - ${format(ev.end, 'HH:mm')}`}`,
            ev.title + (ev.description ? `\n\nObs: ${ev.description}` : ''),
            ev.resource.roomName || room.name
        ]);
        autoTable(doc, {
            startY: 35, head: [['DATA / HORA', 'EVENTO', 'LOCAL']], body: tableData, theme: 'grid',
            styles: { fontSize: 9, cellPadding: 2, valign: 'middle', lineColor: [200, 200, 200], textColor: [0,0,0] },
            headStyles: { fillColor: [20, 20, 20], textColor: 255, fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 35 }, 2: { cellWidth: 35 } },
        });
        
        const fileName = `Relatorio_${room.name}_${format(startDate, 'dd-MM-yy')}_a_${format(endDate, 'dd-MM-yy')}.pdf`;
        doc.save(fileName.replace(/\s/g, '_'));

    } catch (error) {
        console.error("Erro PDF:", error);
        alert("Erro ao gerar PDF.");
    } finally {
        setIsGenerating(false);
        setIsExportModalOpen(false);
    }
  };

  const generateExcel = () => {
    setIsGenerating(true);
    const startDate = new Date(exportRange.start + 'T00:00:00');
    const endDate = new Date(exportRange.end + 'T00:00:00');
    const eventsToExport = getEventsInRange(startDate, endDate);
    const data = eventsToExport.map(ev => ({
        'Evento': ev.title, 'Data Início': format(ev.start, 'dd/MM/yyyy'),
        'Hora Início': ev.allDay ? 'Dia todo' : format(ev.start, 'HH:mm'),
        'Descrição': ev.description || '', 'Local': ev.resource.roomName || room.name,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenda");
    const fileName = `Relatorio_${room.name}_${format(startDate, 'dd-MM-yy')}_a_${format(endDate, 'dd-MM-yy')}.xlsx`;
    XLSX.writeFile(wb, fileName.replace(/\s/g, '_'));
    setIsGenerating(false);
    setIsExportModalOpen(false);
  };

  if (!room || !serializableEvents) {
    return <div className="text-center p-10 font-bold">Carregando agenda...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <header className="max-w-7xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-black text-3xl shadow-lg" style={{backgroundColor: room.color}}>{room.name.charAt(0)}</div>
            <div>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900">{room.name}</h1>
                <p className="text-slate-500 font-medium">Agenda Oficial</p>
            </div>
        </div>
        <div className="flex flex-wrap gap-3 items-center justify-center">
            {isLoggedIn && (<button onClick={handleFollow} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all ${isFollowing ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>{isFollowing ? '✓ Seguindo' : '+ Seguir'}</button>)}
            <button onClick={handleShare} className="relative flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm"><Share2 size={16} /> {copySuccess ? copySuccess : 'Compartilhar'}</button>
            <a href={googleUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm"><CalIcon size={16} /> Add Google</a>
            <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all text-sm shadow-md"><Download size={16} /> Exportar</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto mb-6">
        <div className="relative w-full md:w-1/3">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Search className="h-5 w-5 text-slate-400" /></div>
            <input type="text" className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Filtrar eventos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        </div>
      </div>

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
                components={{ event: CustomEvent }}
                onSelectEvent={(event) => setSelectedEvent(event)}
                messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", noEventsInRange: "Sem eventos.", showMore: total => `+${total} ver mais` }}
                popup={true}
                allDayAccessor="allDay"
            />
      </main>

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
                                {selectedEvent.allDay ? (<p className="text-sm font-medium">O dia todo</p>) : (<p className="text-sm">{format(selectedEvent.start, 'HH:mm')} até {format(selectedEvent.end, 'HH:mm')}</p>)}
                            </div>
                        </div>
                        {selectedEvent.description && (<div className="flex items-start gap-3 text-slate-600"><AlignLeft className="shrink-0 mt-0.5" size={20}/><p className="text-sm whitespace-pre-wrap leading-relaxed">{selectedEvent.description}</p></div>)}
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

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-black text-slate-900">Exportar Relatório</h2>
                    <p className="text-sm text-slate-500">Exporte o calendário em diferentes formatos.</p>
                </div>
                <div className="p-6 space-y-6">
                    <div className="border-b pb-6">
                        <h3 className="text-md font-bold text-slate-800 mb-2">Exportar Calendário do Mês</h3>
                        <p className="text-xs text-slate-500 mb-4">Gera um PDF com o layout visual do mês atual e uma lista de eventos ao final.</p>
                        <button 
                            onClick={() => {
                                const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
                                const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
                                generatePDF(true, start, end);
                            }} 
                            disabled={isGenerating} 
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            <CalIcon size={16} /> Gerar PDF de {format(currentDate, 'MMMM', {locale: ptBR})}
                        </button>
                    </div>
                    <div>
                        <h3 className="text-md font-bold text-slate-800 mb-2">Exportar Período Personalizado</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500">Data de Início</label>
                                <input type="date" value={exportRange.start} onChange={e => setExportRange({...exportRange, start: e.target.value})} className="w-full p-2 border rounded-lg mt-1"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500">Data Final</label>
                                <input type="date" value={exportRange.end} onChange={e => setExportRange({...exportRange, end: e.target.value})} className="w-full p-2 border rounded-lg mt-1"/>
                            </div>
                        </div>
                        <div className="flex items-center justify-between pt-4">
                            <button onClick={() => setExportRange({start: format(startOfYear(currentDate), 'yyyy-MM-dd'), end: format(endOfYear(currentDate), 'yyyy-MM-dd')})} className="text-xs font-bold text-blue-600 bg-blue-100 px-3 py-1 rounded-full">Ano Inteiro</button>
                            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                                <input type="checkbox" checked={includeVisualCalendars} onChange={(e) => setIncludeVisualCalendars(e.target.checked)} />
                                Incluir calendários visuais
                            </label>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end mt-4">
                            <button onClick={() => generateExcel()} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-bold hover:bg-green-700 transition disabled:opacity-50 text-sm"><FileSpreadsheet size={16} /> Excel</button>
                            <button onClick={() => generatePDF(includeVisualCalendars, exportRange.start, exportRange.end)} disabled={isGenerating} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 transition disabled:opacity-50 text-sm"><Download size={16} /> Gerar PDF</button>
                        </div>
                    </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-b-2xl flex justify-end">
                    <button onClick={() => setIsExportModalOpen(false)} className="font-bold text-slate-500">Fechar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}