"use client";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, getDate, set } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { createEvent, updateEvent, deleteEvent, createCategory, deleteCategory, updateRoom, deleteRoom } from '../../actions'; 
import { Trash2, Plus, AlertTriangle, ArrowLeft, ExternalLink, Check, Repeat, Layers, Clock, CalendarDays, Settings, ShieldAlert, Search, X } from 'lucide-react'; 

// --- CONFIGURAÇÕES ---
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

function generateRRule(start, options) {
    if (options.freq === 'NONE') return '';
    let parts = [`FREQ=${options.freq}`];
    if (options.interval > 1) parts.push(`INTERVAL=${options.interval}`);
    if (options.freq === 'WEEKLY' && options.byDay.length > 0) parts.push(`BYDAY=${options.byDay.join(',')}`);
    if (options.freq === 'MONTHLY') {
        if (options.monthlyType === 'day') parts.push(`BYMONTHDAY=${getDate(start)}`);
        else if (options.monthlyType === 'pos') {
             const weekDay = format(start, 'iiii').toUpperCase().substring(0, 2); 
             const day = getDate(start);
             const pos = Math.ceil(day / 7);
             parts.push(`BYDAY=${pos}${weekDay}`);
        }
    }
    if (options.endType === 'date' && options.until) {
        // Garante UTC na regra para não voltar um dia
        const untilStr = options.until + 'T23:59:59Z';
        parts.push(`UNTIL=${untilStr.replace(/[-:]/g, '')}`);
    } else if (options.endType === 'count' && options.count) parts.push(`COUNT=${options.count}`);
    return parts.join(';');
}

function parseRRule(rruleString = '') {
    if (!rruleString) return { freq: 'NONE', interval: 1, byDay: [], monthlyType: 'day', endType: 'never', until: '', count: 13 };
    const options = { freq: 'NONE', interval: 1, byDay: [], monthlyType: 'day', endType: 'never', until: '', count: 13 };
    const parts = rruleString.split(';');
    parts.forEach(part => {
        const [key, value] = part.split('=');
        switch (key) {
            case 'FREQ': options.freq = value; break;
            case 'INTERVAL': options.interval = parseInt(value, 10); break;
            case 'BYDAY': options.byDay = value.split(','); break;
            case 'BYMONTHDAY': options.monthlyType = 'day'; break;
            case 'UNTIL':
                options.endType = 'date';
                // Tenta extrair a data YYYYMMDD
                if(value.length >= 8) {
                    const y = value.substring(0,4);
                    const m = value.substring(4,6);
                    const d = value.substring(6,8);
                    options.until = `${y}-${m}-${d}`;
                }
                break;
            case 'COUNT': options.endType = 'count'; options.count = parseInt(value, 10); break;
        }
    });
    if(options.freq === 'MONTHLY' && options.byDay.length > 0 && !rruleString.includes('BYMONTHDAY')) {
        options.monthlyType = 'pos';
    }
    return options;
}

const TimeGridEvent = ({ event }) => {
    const bgColor = event.resource.color;
    const textColor = getContrastColor(bgColor);
    return (
        <div style={{ backgroundColor: bgColor, color: textColor, height: '100%', padding: '2px 4px', borderRadius: '4px', overflow: 'hidden' }}>
            <p style={{ fontWeight: 'bold', fontSize: '12px', margin: 0, padding: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{event.title}</p>
            {!event.allDay && (<p style={{ fontSize: '10px', margin: 0, padding: 0, opacity: 0.8 }}>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</p>)}
        </div>
    );
};

export default function AdminCalendar({ room, initialEvents, categories, allParents }) {
  const router = useRouter();
  const [copySuccess, setCopySuccess] = useState('');
  
  // --- NORMALIZAÇÃO DE DADOS (CRÍTICO PARA O FUSO HORÁRIO) ---
  const processEvents = (eventsData) => {
      return eventsData.map(e => {
          const isAllDay = Boolean(e.allDay);
          let start, end;

          if (isAllDay) {
              // TRUQUE: Se é dia todo, o banco retorna UTC (ex: 2026-01-20T00:00:00Z)
              // Se dermos new Date(), o Brasil vira dia 19 às 21:00.
              // Então lemos a string, pegamos os números e criamos a data local forçada.
              const iso = new Date(e.start).toISOString(); // Garante formato ISO
              const [y, m, d] = iso.split('T')[0].split('-').map(Number);
              // Cria data local 00:00:00
              start = new Date(y, m - 1, d, 0, 0, 0);
              end = new Date(y, m - 1, d, 23, 59, 59);
          } else {
              start = new Date(e.start);
              end = new Date(e.end);
          }
          
          return { ...e, start, end, allDay: isAllDay };
      });
  };

  const [events, setEvents] = useState(processEvents(initialEvents));
  const [view, setView] = useState('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [showResultsList, setShowResultsList] = useState(false);
  const [parentSearchTerm, setParentSearchTerm] = useState("");
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false); 
  const [isRecurrenceUpdateModalOpen, setIsRecurrenceUpdateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedOriginalDate, setSelectedOriginalDate] = useState(null);
  const [formData, setFormData] = useState({ title: '', description: '', start: '', end: '', categoryId: '', cascade: false, allDay: false });
  const [settingsData, setSettingsData] = useState({ name: room.name, color: room.color, parentId: room.parentId || '' });
  const [rruleOptions, setRruleOptions] = useState({ freq: 'NONE', interval: 1, byDay: [], monthlyType: 'day', endType: 'never', until: '', count: 13 });

  useEffect(() => {
    setEvents(processEvents(initialEvents));
    setSettingsData({ name: room.name, color: room.color, parentId: room.parentId || '' });
  }, [initialEvents, room]);

  const handleCopy = (text, message) => {
    navigator.clipboard.writeText(text).then(() => {
        setCopySuccess(message);
        setTimeout(() => setCopySuccess(''), 2000);
    });
  };

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    const lower = searchTerm.toLowerCase();
    return events.filter(e => e.title.toLowerCase().includes(lower) || (e.description && e.description.toLowerCase().includes(lower)));
  }, [events, searchTerm]);

  const globalSearchResults = useMemo(() => {
     if (!searchTerm) return [];
     return filteredEvents.sort((a,b) => a.start - b.start);
  }, [filteredEvents, searchTerm]);

  const filteredParents = useMemo(() => {
      if(!parentSearchTerm) return allParents;
      return allParents.filter(p => p.name.toLowerCase().includes(parentSearchTerm.toLowerCase()));
  }, [allParents, parentSearchTerm]);

  // Conflito ignora eventos All Day
  const checkConflict = (eventStart, eventEnd, excludeId = null, isAllDay = false) => {
      if (isAllDay) return false;
      const s = new Date(eventStart);
      const e = new Date(eventEnd);
      return events.some(ev => ev.id !== excludeId && !ev.allDay && ((s >= ev.start && s < ev.end) || (e > ev.start && e <= ev.end) || (s <= ev.start && e >= ev.end)));
  };

  const EventComponent = ({ event }) => {
     const hasConflict = checkConflict(event.start, event.end, event.id, event.allDay);
     const bgColor = event.resource.color;
     const textColor = getContrastColor(bgColor);
     return (
        <div className={`text-xs p-1 h-full overflow-hidden leading-tight flex flex-col justify-between ${hasConflict ? 'border-2 border-red-500 animate-pulse' : ''}`} style={{backgroundColor: bgColor, color: textColor, borderRadius: '4px'}}>
            <div>{hasConflict && <AlertTriangle size={10} className="inline text-yellow-300 mr-1"/>}<span className="font-bold">{event.title}</span></div>
            {event.cascade && <span className="text-[9px] opacity-80 block text-right">Setorial</span>}
        </div>
     );
  };

  // --- PREPARAR FORMULÁRIO (CORREÇÃO DE DATA) ---
  const prepareForm = (evt = null, slot = null) => {
    if (evt) { 
        // EDIÇÃO
        setSelectedEvent(evt); setSelectedOriginalDate(evt.start);
        
        let startStr, endStr;
        if (evt.allDay) {
            // Se for AllDay, a data já foi "localizada" no processEvents (ex: 00:00 local).
            // O format 'yyyy-MM-dd' vai pegar o dia correto (ex: 20).
            startStr = format(evt.start, 'yyyy-MM-dd'); 
            endStr = format(evt.end, 'yyyy-MM-dd');
        } else {
            // datetime-local precisa do formato ISO sem Z
            startStr = format(evt.start, "yyyy-MM-dd'T'HH:mm");
            endStr = format(evt.end, "yyyy-MM-dd'T'HH:mm");
        }

        setFormData({ title: evt.title, description: evt.description || '', start: startStr, end: endStr, categoryId: evt.categoryId || '', cascade: evt.cascade, allDay: evt.allDay });
        setRruleOptions(parseRRule(evt.rrule));
    } else { 
        // NOVO
        setSelectedEvent(null); setSelectedOriginalDate(null);
        let startDate, endDate; let isAllDay = false;
        
        if (slot && slot.slots) { 
            // Se clicou na célula do mês
            if (slot.slots.length === 1 && slot.action === 'click') {
                // Definimos horários padrão, mas NÃO é dia todo por padrão
                startDate = set(slot.start, { hours: 19, minutes: 0, seconds: 0 }); 
                endDate = set(slot.start, { hours: 21, minutes: 0, seconds: 0 }); 
                isAllDay = false; 
            } else { 
                // Arrastou no dia/semana
                startDate = slot.start; endDate = slot.end; 
                isAllDay = (endDate.getTime() - startDate.getTime()) >= (24 * 60 * 60 * 1000 - 1);
            }
        } else { 
            // Botão Novo
            const now = new Date(); startDate = set(now, { hours: 19, minutes: 0, seconds: 0 }); endDate = set(now, { hours: 21, minutes: 0, seconds: 0 }); isAllDay = false; 
        }
        
        // Se for dia todo, formato yyyy-MM-dd, senão datetime-local
        const dateFormat = isAllDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm";
        
        setFormData({ title: '', description: '', start: format(startDate, dateFormat), end: format(endDate, dateFormat), categoryId: '', cascade: false, allDay: isAllDay });
        
        const weekDayCode = format(startDate, 'iiii').toUpperCase().substring(0, 2);
        setRruleOptions({ freq: 'NONE', interval: 1, byDay: [weekDayCode], monthlyType: 'day', endType: 'never', until: '', count: 13 });
    }
    setIsModalOpen(true);
  };

  const handlePreSubmit = async (e) => { e.preventDefault(); if (selectedEvent && selectedEvent.rrule) setIsRecurrenceUpdateModalOpen(true); else await handleFinalSubmit('all'); };
  
  // --- SALVAR NO BANCO (CORREÇÃO UTC ABSOLUTA) ---
  const handleFinalSubmit = async (updateMode) => {
    setIsRecurrenceUpdateModalOpen(false); 
    setIsLoading(true);
    
    const data = new FormData();
    data.append('roomId', room.id);
    if(selectedEvent) { 
        data.append('eventId', selectedEvent.id); 
        data.append('updateMode', updateMode); 
        if(selectedOriginalDate) data.append('originalDate', selectedOriginalDate.toISOString()); 
    }
    
    data.append('title', formData.title); 
    data.append('description', formData.description); 
    data.append('categoryId', formData.categoryId);
    if(formData.cascade) data.append('cascade', 'on');
    if(formData.allDay) data.append('allDay', 'on');

    let startISO, endISO;
    if (formData.allDay) {
        // CORREÇÃO: Não forçar Z (UTC). Criamos a data localmente para garantir o dia correto.
        // Se o input é "2026-01-20", criamos Jan 20 00:00 Local.
        // O .toISOString() ajustará automaticamente para T03:00:00Z (se estiver no Brasil), mantendo o timestamp correto.
        const [y, m, d] = formData.start.split('T')[0].split('-').map(Number);
        const startLocal = new Date(y, m - 1, d, 0, 0, 0);
        const endLocal = new Date(y, m - 1, d, 23, 59, 59);
        
        startISO = startLocal.toISOString();
        endISO = endLocal.toISOString();
    } else {
        // Horário Normal
        startISO = new Date(formData.start).toISOString();
        endISO = new Date(formData.end).toISOString();
    }

    data.set('start', startISO);
    data.set('end', endISO);

    // Gera RRule usando a data baseada no timestamp correto.
    // Como corrigimos o startISO para refletir a meia-noite local (ex: 03:00 UTC),
    // o 'new Date(startISO)' aqui vai retornar Jan 20 00:00 Local, e o rrule pegará o dia 20 corretamente.
    const rruleStart = new Date(startISO);
    const rruleStr = generateRRule(rruleStart, rruleOptions); 
    if(rruleStr) data.append('rruleString', rruleStr);

    const action = selectedEvent ? updateEvent : createEvent;
    const result = await action(data);
    
    if (result.success) { 
        router.refresh(); 
        setIsModalOpen(false); 
    } else { 
        alert("Erro: " + result.error); 
    }
    setIsLoading(false);
  };

  const handleDelete = async (mode) => { if(!confirm("Tem certeza que deseja excluir?")) return; setIsLoading(true); const data = new FormData(); data.append('eventId', selectedEvent.id); data.append('deleteMode', mode); data.append('originalDate', selectedOriginalDate.toISOString()); const result = await deleteEvent(data); if (result.success) { router.refresh(); setIsModalOpen(false); } else { alert(result.error); } setIsLoading(false); };
  const handleUpdateRoom = async () => { setIsLoading(true); const data = new FormData(); data.append('roomId', room.id); data.append('name', settingsData.name); data.append('color', settingsData.color); data.append('parentId', settingsData.parentId); const res = await updateRoom(data); if(res.success) { router.refresh(); setIsSettingsModalOpen(false); } else { alert(res.error); } setIsLoading(false); };

  return (
    // ESTRUTURA IDÊNTICA AO PUBLIC CALENDAR (Bonita e Espaçosa)
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden font-sans">
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm z-20">
         <div className="flex items-center gap-4">
             <button onClick={() => router.push('/dashboard')} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm"><ArrowLeft size={16}/> Voltar</button>
             <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
             <div className="flex items-center gap-2 truncate"><div className="w-4 h-4 rounded-full" style={{backgroundColor: room.color}}></div><h1 className="text-lg font-black text-slate-900 truncate max-w-[150px] md:max-w-none">{room.name}</h1></div>
         </div>
         <form onSubmit={(e) => {e.preventDefault(); if(searchTerm.trim()) setShowResultsList(true);}} className="hidden md:flex relative w-64">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
             <input type="text" placeholder="Pesquisar..." className="w-full pl-9 pr-3 py-2 bg-slate-100 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); if(e.target.value === "") setShowResultsList(false); }}/>
             {showResultsList && (<button type="button" onClick={() => { setShowResultsList(false); setSearchTerm(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-200 text-slate-600 px-1 rounded hover:bg-slate-300"><X size={14}/></button>)}
         </form>
         <div className="flex items-center gap-2">
             <button onClick={() => window.open(`/${room.slug}`, '_blank')} className="hidden lg:flex items-center gap-2 text-blue-600 font-bold text-sm bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100 transition"><ExternalLink size={16}/> Site</button>
             <button onClick={() => setIsSettingsModalOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm transition"><Settings size={16}/></button>
             <button onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-lg font-bold text-sm transition">Cats</button>
             <button onClick={() => prepareForm(null, { start: new Date() })} className="bg-black hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md flex items-center gap-2 transition"><Plus size={16}/> <span className="hidden lg:inline">Novo</span></button>
         </div>
      </div>

      <main className="flex-1 flex flex-col p-4 md:p-6 min-h-0 overflow-hidden">
            <div className="flex-1 h-full w-full bg-white rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden relative">
                {!showResultsList ? (
                    <Calendar
                        localizer={localizer}
                        events={filteredEvents}
                        view={view} 
                        onView={setView}
                        date={currentDate}
                        onNavigate={setCurrentDate}
                        views={['month', 'week', 'day', 'agenda']}
                        culture="pt-BR"
                        selectable
                        onSelectSlot={(slot) => prepareForm(null, slot)}
                        onSelectEvent={(evt) => prepareForm(evt)}
                        components={{ month: { event: EventComponent }, week: { event: TimeGridEvent }, day: { event: TimeGridEvent }}}
                        messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", noEventsInRange: "Sem eventos.", showMore: total => `+${total} ver mais` }}
                        popup={true}
                        style={{ height: '100%' }}
                    />
                ) : (
                    <div className="h-full overflow-y-auto custom-scrollbar bg-slate-900 p-4">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                             <h3 className="text-white font-bold text-lg">Resultados: "{searchTerm}"</h3>
                             <button onClick={() => setShowResultsList(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-1">
                        {globalSearchResults.map((ev, idx) => (
                            <div key={idx} onClick={() => prepareForm(ev)} className="flex items-center gap-4 p-4 hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border-b border-slate-800 group">
                                <div className="text-center w-16 shrink-0"><span className="block text-xs font-bold text-slate-500 uppercase">{format(ev.start, 'MMM', {locale: ptBR})}</span><span className="block text-xl font-black text-white">{format(ev.start, 'dd')}</span></div>
                                <div className="w-1 h-10 rounded-full" style={{backgroundColor: ev.resource.color}}></div>
                                <div><h4 className="text-white font-bold group-hover:text-blue-400 transition-colors">{ev.title}</h4><p className="text-slate-400 text-sm">{format(ev.start, 'HH:mm')} - {format(ev.end, 'HH:mm')}</p></div>
                            </div>
                        ))}
                        </div>
                    </div>
                )}
            </div>
      </main>

      {/* --- MODAIS MANTIDOS IGUAIS PARA POUPAR ESPAÇO --- */}
      {isSettingsModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto"><h2 className="text-xl font-black mb-6 text-slate-900 border-b pb-4 flex items-center gap-2"><Settings className="text-slate-400"/> Configurações</h2><div className="space-y-4"><div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome</label><input value={settingsData.name} onChange={e => setSettingsData({...settingsData, name: e.target.value})} className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-bold" /></div><div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cor</label><div className="flex gap-2"><input type="color" value={settingsData.color} onChange={e => setSettingsData({...settingsData, color: e.target.value})} className="h-12 w-20 p-1 border rounded cursor-pointer" /><div className="flex-1 bg-slate-50 border rounded-lg flex items-center px-3 text-sm text-slate-500">{settingsData.color}</div></div></div><div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Associar a Pai (Setor/Min)</label><div className="border rounded-lg bg-slate-50 p-2"><input placeholder="Buscar setor..." className="w-full p-2 mb-2 border rounded bg-white text-sm outline-none" value={parentSearchTerm} onChange={(e) => setParentSearchTerm(e.target.value)}/><div className="max-h-32 overflow-y-auto custom-scrollbar bg-white rounded border"><div className={`p-2 text-sm cursor-pointer hover:bg-blue-50 ${settingsData.parentId === '' ? 'bg-blue-100 font-bold' : ''}`} onClick={() => setSettingsData({...settingsData, parentId: ''})}>-- Nenhum (Raiz) --</div>{filteredParents.map(p => (<div key={p.id} className={`p-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2 ${settingsData.parentId === p.id ? 'bg-blue-100 font-bold' : ''}`} onClick={() => setSettingsData({...settingsData, parentId: p.id})}><div className="w-3 h-3 rounded-full" style={{backgroundColor: p.color}}></div>{p.name}</div>))}</div></div></div></div><div className="mt-6 space-y-2"><h3 className="text-xs font-bold text-slate-500 uppercase">Compartilhar</h3><div className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center"><span className="text-sm font-medium text-slate-700">Link da Agenda Pública</span><button type="button" onClick={() => handleCopy(`${window.location.origin}/${room.slug}`, 'Link copiado!')} className="text-sm font-bold bg-white border px-3 py-1 rounded-md hover:bg-slate-100">{copySuccess === 'Link copiado!' ? 'Copiado!' : 'Copiar'}</button></div>{room.inviteCode && (<div className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center"><span className="text-sm font-medium text-slate-700">Código de Convite</span><button type="button" onClick={() => handleCopy(room.inviteCode, 'Código copiado!')} className="text-sm font-bold bg-white border px-3 py-1 rounded-md hover:bg-slate-100">{copySuccess === 'Código copiado!' ? 'Copiado!' : 'Copiar'}</button></div>)}</div><div className="mt-8 pt-4 border-t flex justify-end gap-2"><button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={handleUpdateRoom} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition">{isLoading ? '...' : 'Salvar'}</button></div><div className="mt-8 bg-red-50 p-4 rounded-xl border border-red-100"><h3 className="text-red-800 font-bold text-sm flex items-center gap-2 mb-2"><ShieldAlert size={16}/> Zona de Perigo</h3><form action={deleteRoom}><input type="hidden" name="roomId" value={room.id} /><button type="submit" onClick={(e) => { if(!confirm("Apagar TUDO?")) e.preventDefault(); }} className="w-full bg-red-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-red-700 shadow-sm">Excluir Sala</button></form></div></div></div>)}
      {isModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"><div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl flex-shrink-0"><h2 className="text-xl font-black text-slate-800">{selectedEvent ? 'Editar Evento' : 'Novo Evento'}</h2><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl">&times;</button></div><form onSubmit={handlePreSubmit} className="flex flex-col overflow-hidden"><div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-grow"><div className="space-y-4"><input name="title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Adicionar título" className="w-full text-2xl font-medium border-b-2 border-slate-200 focus:border-blue-500 outline-none pb-2 placeholder:text-slate-300" autoFocus /><div className="flex items-center gap-4"><div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-slate-50 p-3 rounded-lg border"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Início</label><input type={formData.allDay ? "date" : "datetime-local"} value={formData.allDay ? formData.start.split('T')[0] : formData.start} onChange={e => setFormData({...formData, start: e.target.value})} className="w-full bg-transparent font-semibold outline-none text-sm"/></div>{!formData.allDay && (<div className="bg-slate-50 p-3 rounded-lg border"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fim</label><input type="datetime-local" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} className="w-full bg-transparent font-semibold outline-none text-sm"/></div>)}</div><div className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors select-none ${formData.allDay ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'}`} onClick={() => setFormData({...formData, allDay: !formData.allDay})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.allDay ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{formData.allDay && <Check size={14} className="text-white"/>}</div><span className="text-sm font-bold text-slate-700">Dia todo</span></div></div><div className="flex flex-col md:flex-row gap-4"><select name="categoryId" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="p-3 border rounded-lg bg-white flex-1 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"><option value="">Sem Categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors ${formData.cascade ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'}`} onClick={() => setFormData({...formData, cascade: !formData.cascade})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.cascade ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{formData.cascade && <Check size={14} className="text-white"/>}</div><span className="text-sm font-bold text-slate-700 select-none">Visível para filhos?</span></div></div><textarea name="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descrição..." className="w-full p-4 border rounded-lg bg-slate-50 outline-none min-h-[100px] resize-none text-sm"/></div><div className="border rounded-xl p-5 bg-slate-50 space-y-4"><div className="flex items-center gap-2 mb-2"><Repeat className="text-slate-400" size={18} /><span className="font-bold text-slate-700">Repetição Personalizada</span></div><div className="flex items-center gap-4 flex-wrap"><div className="flex items-center gap-2"><span className="text-sm text-slate-600">A cada:</span><input type="number" min="1" value={rruleOptions.interval} onChange={e => setRruleOptions({...rruleOptions, interval: parseInt(e.target.value)})} className="w-16 p-2 border rounded text-center font-bold"/></div><select value={rruleOptions.freq} onChange={e => setRruleOptions({...rruleOptions, freq: e.target.value})} className="p-2 border rounded font-bold text-slate-700"><option value="NONE">Não se repete</option><option value="DAILY">Dia(s)</option><option value="WEEKLY">Semana(s)</option><option value="MONTHLY">Mês(es)</option><option value="YEARLY">Ano(s)</option></select></div>{rruleOptions.freq === 'WEEKLY' && (<div className="flex gap-2 justify-center pt-2">{['D','S','T','Q','Q','S','S'].map((d, i) => { const code = ['SU','MO','TU','WE','TH','FR','SA'][i]; const isSelected = rruleOptions.byDay.includes(code); return (<button key={code} type="button" onClick={() => { const newDays = isSelected ? rruleOptions.byDay.filter(x => x !== code) : [...rruleOptions.byDay, code]; setRruleOptions({...rruleOptions, byDay: newDays}); }} className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${isSelected ? 'bg-blue-600 text-white scale-110' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>{d}</button>) })}</div>)}{rruleOptions.freq === 'MONTHLY' && formData.start && (<div className="space-y-2 text-sm text-slate-600 bg-white p-3 rounded border"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="monthlyType" checked={rruleOptions.monthlyType === 'day'} onChange={() => setRruleOptions({...rruleOptions, monthlyType: 'day'})} /><span>Mensal no dia {getDate(new Date(formData.start))}</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="monthlyType" checked={rruleOptions.monthlyType === 'pos'} onChange={() => setRruleOptions({...rruleOptions, monthlyType: 'pos'})} /><span>Mensal na {Math.ceil(getDate(new Date(formData.start))/7)}ª {format(new Date(formData.start), 'iiii', { locale: ptBR })}</span></label></div>)}{rruleOptions.freq !== 'NONE' && (<div className="pt-2 border-t mt-2"><span className="text-xs font-bold text-slate-400 uppercase block mb-2">Termina em</span><div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="radio" name="endType" checked={rruleOptions.endType === 'never'} onChange={() => setRruleOptions({...rruleOptions, endType: 'never'})} /> Nunca</label><label className="flex items-center gap-2"><input type="radio" name="endType" checked={rruleOptions.endType === 'date'} onChange={() => setRruleOptions({...rruleOptions, endType: 'date'})} /> Em: <input type="date" value={rruleOptions.until} disabled={rruleOptions.endType !== 'date'} onChange={e => setRruleOptions({...rruleOptions, until: e.target.value})} className="border rounded p-1 ml-2 disabled:opacity-50"/></label><label className="flex items-center gap-2"><input type="radio" name="endType" checked={rruleOptions.endType === 'count'} onChange={() => setRruleOptions({...rruleOptions, endType: 'count'})} /> Após: <input type="number" disabled={rruleOptions.endType !== 'count'} value={rruleOptions.count} onChange={e => setRruleOptions({...rruleOptions, count: parseInt(e.target.value)})} className="w-16 border rounded p-1 ml-2 disabled:opacity-50"/> ocorrências</label></div></div>)}</div>{selectedEvent && (<div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col gap-3"><div className="flex items-center gap-2 text-red-700 font-bold text-sm"><Trash2 size={16} /> Opções de Exclusão</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => handleDelete('all')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">Tudo</button>{selectedEvent.rrule && (<><button type="button" onClick={() => handleDelete('single')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">Só este</button><button type="button" onClick={() => handleDelete('future')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">Este e futuros</button></>)}</div></div>)}</div><div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition">Cancelar</button><button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2">{isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Check size={20}/>}{selectedEvent ? 'Atualizar Evento' : 'Salvar Evento'}</button></div></form></div></div>)}
      {isRecurrenceUpdateModalOpen && (<div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in border-2 border-blue-600"><h3 className="text-lg font-black text-slate-900 mb-4">Editar recorrente</h3><div className="space-y-2 mb-6"><button onClick={() => handleFinalSubmit('single')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left group"><Clock size={20} className="text-slate-400 group-hover:text-blue-600"/><div><span className="block font-bold text-slate-800">Este evento</span><span className="text-xs text-slate-500">Apenas esta data</span></div></button><button onClick={() => handleFinalSubmit('future')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left group"><Layers size={20} className="text-slate-400 group-hover:text-blue-600"/><div><span className="block font-bold text-slate-800">Este e seguintes</span><span className="text-xs text-slate-500">Divide a série</span></div></button><button onClick={() => handleFinalSubmit('all')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left group"><CalendarDays size={20} className="text-slate-400 group-hover:text-blue-600"/><div><span className="block font-bold text-slate-800">Todos</span><span className="text-xs text-slate-500">Altera regra original</span></div></button></div><button onClick={() => setIsRecurrenceUpdateModalOpen(false)} className="w-full py-2 text-slate-400 font-bold hover:text-slate-600">Cancelar</button></div></div>)}
      {isCategoryModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in"><h2 className="text-xl font-black mb-4 text-slate-800">Categorias</h2><div className="mb-6 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50"><div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full" style={{backgroundColor: cat.color}}></div><span className="font-bold text-slate-700">{cat.name}</span></div><form action={async (formData) => { await deleteCategory(formData); router.refresh(); }}><input type="hidden" name="categoryId" value={cat.id} /><input type="hidden" name="roomId" value={room.id} /><button type="submit" className="text-slate-400 hover:text-red-500 transition bg-white p-2 rounded-md shadow-sm border"><Trash2 size={16}/></button></form></div>))}</div><form action={async (formData) => { await createCategory(formData); router.refresh(); }} className="border-t pt-4"><p className="text-xs font-bold text-slate-500 mb-2 uppercase">Nova</p><input type="hidden" name="roomId" value={room.id} /><div className="flex gap-2 mb-3"><input name="name" required placeholder="Nome..." className="flex-1 p-3 border rounded-lg bg-slate-50 font-medium outline-none" /><input type="color" name="color" defaultValue="#3b82f6" className="w-12 h-full p-1 border rounded-lg cursor-pointer bg-white" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Fechar</button><button type="submit" className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold shadow-emerald-200 shadow-md hover:bg-emerald-700 transition">+ Criar</button></div></form></div></div>)}
    </div>
  );
}