"use client";
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { followRoom } from '@/app/actions';
import { 
    format, parse, startOfWeek, getDay, isSameMonth, 
    startOfMonth, endOfMonth, endOfWeek, isSameDay, startOfYear, endOfYear
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

export default function PublicCalendar({ room, events: serializableEvents, isFollowingInitially, isLoggedIn }) {
  const router = useRouter();
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(isFollowingInitially);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); 
  const [googleUrl, setGoogleUrl] = useState("#");
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');

  // Responsividade
  useEffect(() => {
    if (window.innerWidth < 768) setView('agenda');
    else setView('month');
  }, []);

  // Sync Google URL
  useEffect(() => {
    if (room?.slug && typeof window !== 'undefined') {
        const origin = window.location.origin;
        const url = `${origin}/api/ics/${room.slug}`;
        setGoogleUrl(`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`);
    }
  }, [room]);
  
  const allEvents = useMemo(() => serializableEvents ? serializableEvents.map(event => ({ ...event, start: new Date(event.start), end: new Date(event.end) })) : [], [serializableEvents]);

  const filteredEvents = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return allEvents.filter(e => e.title.toLowerCase().includes(lower) || (e.resource.roomName && e.resource.roomName.toLowerCase().includes(lower)));
  }, [allEvents, searchTerm]);

  // Eventos do Mês Atual (Para o Resumo abaixo do calendário)
  const monthEvents = useMemo(() => {
      return filteredEvents.filter(ev => isSameMonth(ev.start, currentDate)).sort((a, b) => a.start - b.start);
  }, [filteredEvents, currentDate]);

  const handleFollow = async () => {
    const result = await followRoom(room.id);
    if(result.success) setIsFollowing(result.followed);
  };

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

  // --- LÓGICA DE EXPORTAÇÃO ---
  const generatePDF = (isVisual) => {
    setIsGenerating(true);
    try {
        const doc = new jsPDF({ orientation: isVisual ? 'landscape' : 'portrait' });
        doc.setFontSize(18);
        doc.text(`Agenda ${room.name}`, 14, 20);
        
        const tableData = monthEvents.map(ev => [
            format(ev.start, 'dd/MM (EEE)', { locale: ptBR }),
            ev.allDay ? 'Dia todo' : format(ev.start, 'HH:mm'),
            ev.title,
            ev.resource.roomName || room.name
        ]);

        autoTable(doc, {
            startY: 30,
            head: [['Data', 'Hora', 'Evento', 'Local']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235] }
        });

        doc.save(`Agenda_${room.name}_${format(currentDate, 'MMMM_yyyy', { locale: ptBR })}.pdf`);
    } finally {
        setIsGenerating(false);
        setIsExportMenuOpen(false);
    }
  };

  const generateExcel = () => {
    const data = monthEvents.map(ev => ({
        'Data': format(ev.start, 'dd/MM/yyyy'),
        'Hora': ev.allDay ? 'Dia todo' : format(ev.start, 'HH:mm'),
        'Evento': ev.title,
        'Descrição': ev.description || '',
        'Local': ev.resource.roomName || room.name
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Agenda");
    XLSX.writeFile(wb, `Agenda_${room.name}.xlsx`);
    setIsExportMenuOpen(false);
  };

  // --- TOOLBAR CUSTOMIZADA ---
  const CustomToolbar = (toolbar) => {
    return (
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
                        {v === 'month' && <Grid3x3 size={14}/>}
                        {v === 'week' && <CalendarDays size={14}/>}
                        {v === 'agenda' && <LayoutList size={14}/>}
                        <span className="capitalize">{v === 'month' ? 'Mês' : v === 'week' ? 'Semana' : 'Lista'}</span>
                    </button>
                ))}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-10">
      
      {/* NAVBAR */}
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 z-40">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{backgroundColor: room.color}}>{room.name.charAt(0)}</div>
                <div className="leading-tight"><h1 className="text-base md:text-lg font-black text-slate-900 truncate max-w-[150px] md:max-w-md">{room.name}</h1><p className="text-[10px] text-slate-500 font-bold uppercase">Agenda Igreja</p></div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative">
                    <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full font-bold text-xs hover:bg-slate-200 transition">
                        Opções <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in duration-200">
                            <button onClick={handleShare} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><Share2 size={16} className="text-blue-500"/> {copySuccess || 'Compartilhar'}</button>
                            <a href={googleUrl} target="_blank" className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><CalIcon size={16} className="text-red-500"/> Google Agenda</a>
                            <div className="h-px bg-slate-100 my-1" />
                            <button onClick={() => generatePDF(false)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><FileText size={16} className="text-orange-500"/> Baixar PDF</button>
                            <button onClick={generateExcel} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><FileSpreadsheet size={16} className="text-emerald-500"/> Baixar Excel</button>
                        </div>
                    )}
                </div>
                {isLoggedIn && <button onClick={handleFollow} className={`px-4 py-2 rounded-full font-bold text-xs transition ${isFollowing ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'}`}>{isFollowing ? 'Seguindo' : 'Seguir'}</button>}
            </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-5xl mx-auto w-full p-4 space-y-6">
        
        {/* BUSCA */}
        <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
            <input type="text" placeholder="Pesquisar um evento..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-sm md:text-base" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
        </div>

        {/* CALENDÁRIO */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden h-[500px] md:h-[650px]">
            <Calendar
                localizer={localizer}
                events={filteredEvents}
                view={view}
                onView={setView}
                date={currentDate}
                onNavigate={setCurrentDate}
                components={{ toolbar: CustomToolbar, event: (props) => <div style={{ backgroundColor: props.event.resource.color, color: getContrastColor(props.event.resource.color) }} className="px-1.5 py-0.5 rounded text-[10px] font-bold truncate h-full">{props.event.title}</div> }}
                onSelectEvent={setSelectedEvent}
                culture="pt-BR"
                messages={{ noEventsInRange: "Sem eventos nesta data." }}
            />
        </div>

        {/* VISÃO GERAL / RESUMO (O QUE VOCÊ PEDIU) */}
        <section className="animate-in slide-in-from-bottom duration-700">
            <div className="flex items-center justify-between mb-4 px-2">
                <h2 className="text-xl font-black text-slate-800">Resumo de {format(currentDate, 'MMMM', {locale: ptBR})}</h2>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{monthEvents.length} eventos</span>
            </div>

            {monthEvents.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2">
                    {monthEvents.map((ev, idx) => (
                        <div key={idx} onClick={() => setSelectedEvent(ev)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex items-center gap-4">
                            <div className="flex flex-col items-center justify-center min-w-[50px] h-[50px] rounded-xl bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                <span className="text-lg font-black leading-none">{format(ev.start, 'dd')}</span>
                                <span className="text-[10px] font-bold uppercase">{format(ev.start, 'EEE', {locale: ptBR})}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600">{ev.title}</h4>
                                <div className="flex items-center gap-3 mt-1 text-slate-500 text-xs font-medium">
                                    <span className="flex items-center gap-1"><Clock size={12}/> {ev.allDay ? 'Dia todo' : format(ev.start, 'HH:mm')}</span>
                                    {ev.resource.roomName && <span className="flex items-center gap-1"><MapPin size={12}/> {ev.resource.roomName}</span>}
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
                    <p className="text-slate-400 font-bold">Nenhum evento programado para este mês.</p>
                </div>
            )}
        </section>
      </main>

      {/* MODAL DETALHES */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="h-2 w-full" style={{backgroundColor: selectedEvent.resource.color}}></div>
                <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedEvent.title}</h2>
                        <button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full transition"><X size={20}/></button>
                    </div>
                    <div className="space-y-6">
                        <div className="flex items-start gap-4 text-slate-600 bg-slate-50 p-4 rounded-2xl">
                            <Clock className="text-blue-500 mt-1" size={24}/>
                            <div>
                                <p className="font-black text-slate-800 capitalize">{format(selectedEvent.start, "EEEE, d 'de' MMMM", {locale: ptBR})}</p>
                                <p className="text-sm font-bold text-slate-500">{selectedEvent.allDay ? 'O dia todo' : `${format(selectedEvent.start, 'HH:mm')} até ${format(selectedEvent.end, 'HH:mm')}`}</p>
                            </div>
                        </div>
                        {selectedEvent.description && (
                            <div className="flex items-start gap-4 text-slate-600 px-2">
                                <AlignLeft className="text-slate-400 mt-1" size={24}/>
                                <p className="text-sm leading-relaxed">{selectedEvent.description}</p>
                            </div>
                        )}
                        <div className="flex items-center gap-4 text-slate-600 px-2 pt-4 border-t border-slate-100">
                            <MapPin className="text-slate-400" size={24}/>
                            <span className="text-sm font-black text-slate-700">{selectedEvent.resource.roomName || room.name}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedEvent(null)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition shadow-lg">Fechar</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}