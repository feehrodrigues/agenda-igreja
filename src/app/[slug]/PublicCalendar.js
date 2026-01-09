"use client";
import { useMemo, useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { followRoom } from '@/app/actions';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Search, Download, Calendar as CalIcon, Clock, AlignLeft, X, FileSpreadsheet } from 'lucide-react'; 
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// Função de Contraste
function getContrastColor(hexcolor) {
    if(!hexcolor) return 'black';
    hexcolor = hexcolor.replace("#", "");
    var r = parseInt(hexcolor.substr(0,2),16);
    var g = parseInt(hexcolor.substr(2,2),16);
    var b = parseInt(hexcolor.substr(4,2),16);
    var yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? 'black' : 'white';
}

const CustomEvent = ({ event }) => {
  const textColor = getContrastColor(event.resource.color);
  return (
    <div className="flex flex-col h-full w-full px-1 text-xs overflow-hidden leading-tight" style={{ backgroundColor: event.resource.color, color: textColor, borderRadius: '4px' }}>
      <span className="font-bold">{event.title}</span>
      {event.resource.roomName && <span className="text-[10px] opacity-80">{event.resource.roomName}</span>}
    </div>
  );
};

export default function PublicCalendar({ room, events: serializableEvents, isFollowingInitially, isLoggedIn }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isFollowing, setIsFollowing] = useState(isFollowingInitially);
  const [showResultsList, setShowResultsList] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  // ESTADO DA DATA ATUAL (Para navegação e nome do arquivo)
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const [googleUrl, setGoogleUrl] = useState("#");

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

  const globalSearchResults = useMemo(() => {
     if (!searchTerm) return [];
     return filteredEvents.sort((a,b) => a.start - b.start);
  }, [filteredEvents, searchTerm]);

  const handleSearchSubmit = (e) => {
      e.preventDefault();
      if(searchTerm.trim()) {
          setShowResultsList(true);
      }
  };

  const handleFollow = async () => {
    const result = await followRoom(room.id);
    if(result.success) setIsFollowing(result.followed);
    else alert(result.error);
  };

  // EXPORTAR PDF (Com Mês/Ano no nome)
  const exportPDF = async () => {
    const calendarElement = document.querySelector('.rbc-calendar'); 
    if(!calendarElement) return;
    
    // Formata o nome do arquivo: Ex: Agenda_slug_janeiro_2026.pdf
    const dateString = format(currentDate, 'MMMM_yyyy', { locale: ptBR });
    const fileName = `Agenda_${room.slug}_${dateString}.pdf`;

    try {
        const canvas = await html2canvas(calendarElement, { scale: 1.5 });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        // Título no PDF
        const titleDate = format(currentDate, 'MMMM yyyy', { locale: ptBR }).toUpperCase();
        pdf.setFontSize(14);
        pdf.text(`Agenda: ${room.name} - ${titleDate}`, 10, 10);
        
        pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, pdfHeight);
        pdf.save(fileName);
    } catch (err) { console.error(err); alert("Erro ao gerar PDF."); }
  };

  // EXPORTAR EXCEL (Com Mês/Ano no nome)
  const exportExcel = () => {
      const dataToExport = filteredEvents.map(ev => ({
          'Evento': ev.title,
          'Início': format(ev.start, 'dd/MM/yyyy HH:mm'),
          'Fim': format(ev.end, 'dd/MM/yyyy HH:mm'),
          'Origem': ev.resource.roomName || room.name,
          'Descrição': ev.description || '',
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Agenda");
      
      const wscols = [{wch: 30}, {wch: 20}, {wch: 20}, {wch: 20}, {wch: 40}];
      ws['!cols'] = wscols;

      // Nome do arquivo com Mês e Ano
      const dateString = format(currentDate, 'MMMM_yyyy', { locale: ptBR });
      XLSX.writeFile(wb, `Agenda_${room.slug}_${dateString}.xlsx`);
  };

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
            {isLoggedIn && (
            <button onClick={handleFollow} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all ${isFollowing ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                {isFollowing ? '✓ Seguindo' : '+ Seguir'}
            </button>
            )}
            <a href={googleUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-all text-sm">
                <CalIcon size={16} /> Add Google
            </a>
            
            <button onClick={exportExcel} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-600 text-white font-bold hover:bg-green-700 transition-all text-sm shadow-md hover:shadow-lg">
                <FileSpreadsheet size={16} /> Excel
            </button>
            
            <button onClick={exportPDF} className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all text-sm shadow-md hover:shadow-lg">
                <Download size={16} /> PDF
            </button>
        </div>
      </header>

      {/* BARRA DE PESQUISA */}
      <div className="max-w-7xl mx-auto mb-6">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-1/2 lg:w-1/3 flex gap-2">
            <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                    type="text" 
                    className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm transition-all" 
                    placeholder="Pesquisar (Enter para listar tudo)..." 
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if(e.target.value === "") setShowResultsList(false);
                    }}
                />
            </div>
            {showResultsList && (
                <button type="button" onClick={() => { setShowResultsList(false); setSearchTerm(""); }} className="bg-slate-200 text-slate-600 px-4 rounded-xl hover:bg-slate-300 transition">
                    <X size={20}/>
                </button>
            )}
        </form>
      </div>

      <main className="max-w-7xl mx-auto bg-white p-2 rounded-2xl shadow-xl border border-slate-200 overflow-hidden min-h-[75vh]">
        {!showResultsList ? (
            <Calendar
                localizer={localizer}
                events={filteredEvents}
                defaultView="month"
                views={['month', 'week', 'day', 'agenda']}
                culture="pt-BR"
                style={{ height: '75vh' }}
                // CONTROLE DE NAVEGAÇÃO
                date={currentDate}
                onNavigate={(date) => setCurrentDate(date)}
                // 
                components={{ event: CustomEvent }}
                onSelectEvent={(event) => setSelectedEvent(event)}
                messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", noEventsInRange: "Sem eventos." }}
                popup
            />
        ) : (
            <div className="p-4 h-[75vh] overflow-y-auto custom-scrollbar bg-slate-900 rounded-xl">
                <h3 className="text-white font-bold mb-4 text-lg border-b border-slate-700 pb-2">Resultados da pesquisa: "{searchTerm}"</h3>
                {globalSearchResults.length === 0 ? (
                    <p className="text-slate-400 text-center mt-10">Nenhum evento encontrado.</p>
                ) : (
                    <div className="space-y-1">
                        {globalSearchResults.map((ev, idx) => (
                            <div key={idx} onClick={() => setSelectedEvent(ev)} className="flex items-center gap-4 p-4 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border-b border-slate-800 group">
                                <div className="text-center w-16 shrink-0">
                                    <span className="block text-xs font-bold text-slate-500 uppercase">{format(ev.start, 'MMM', {locale: ptBR})}</span>
                                    <span className="block text-xl font-black text-white">{format(ev.start, 'dd')}</span>
                                    <span className="block text-xs font-bold text-slate-500 uppercase">{format(ev.start, 'EEE', {locale: ptBR})}</span>
                                </div>
                                <div className="w-1 h-10 rounded-full" style={{backgroundColor: ev.resource.color}}></div>
                                <div>
                                    <h4 className="text-white font-bold group-hover:text-blue-400 transition-colors">{ev.title}</h4>
                                    <p className="text-slate-400 text-sm">{format(ev.start, 'HH:mm')} - {format(ev.end, 'HH:mm')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}
      </main>

      {/* MODAL DETALHES */}
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
      <div className="text-center mt-8 text-slate-400 text-sm">Atualizado em tempo real</div>
    </div>
  );
}