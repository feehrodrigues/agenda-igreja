"use client";
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { 
    format, parse, startOfWeek, getDay, getDate, set, endOfWeek, isWithinInterval, 
    startOfMonth, endOfMonth, startOfDay, endOfDay 
} from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
    createEvent, updateEvent, deleteEvent, createCategory, deleteCategory, updateRoom, deleteRoom, setChildRoomGroup, rebroadcastEvent, getChildRoomEvents 
} from '@/app/actions';
import { 
    Trash2, Plus, AlertTriangle, ArrowLeft, ExternalLink, Check, Repeat, Layers, Clock, CalendarDays, Settings, ShieldAlert, X, Eye, Lock, Target, Tag, BarChart3, Users, Send, Loader2, PanelLeftClose, PanelLeftOpen, Shield, MapPin, Share2, FileText
} from 'lucide-react';

// --- CONFIGURAÇÕES ---
const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

// --- HELPERS ---
function getContrastColor(hexcolor) { if (!hexcolor) return 'black'; hexcolor = hexcolor.replace("#", ""); var r = parseInt(hexcolor.substr(0, 2), 16); var g = parseInt(hexcolor.substr(2, 2), 16); var b = parseInt(hexcolor.substr(4, 2), 16); var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000; return (yiq >= 128) ? 'black' : 'white'; }
function generateRRule(start, options) { if (!options.freq || options.freq === 'NONE') return ''; let parts = [`FREQ=${options.freq}`]; if (options.interval > 1) parts.push(`INTERVAL=${options.interval}`); if (options.freq === 'WEEKLY' && options.byDay.length > 0) parts.push(`BYDAY=${options.byDay.join(',')}`); if (options.freq === 'MONTHLY') { if (options.monthlyType === 'day') parts.push(`BYMONTHDAY=${getDate(start)}`); else if (options.monthlyType === 'pos') { const weekDay = format(start, 'iiii').toUpperCase().substring(0, 2); const day = getDate(start); const pos = Math.ceil(day / 7); parts.push(`BYDAY=${pos}${weekDay}`); } } if (options.endType === 'date' && options.until) { const untilStr = options.until + 'T23:59:59Z'; parts.push(`UNTIL=${untilStr.replace(/[-:]/g, '')}`); } else if (options.endType === 'count' && options.count) parts.push(`COUNT=${options.count}`); return parts.join(';'); }
function parseRRule(rruleString = '') { if (!rruleString) return { freq: 'NONE', interval: 1, byDay: [], monthlyType: 'day', endType: 'never', until: '', count: 13 }; const options = { freq: 'NONE', interval: 1, byDay: [], monthlyType: 'day', endType: 'never', until: '', count: 13 }; const parts = rruleString.split(';'); parts.forEach(part => { const [key, value] = part.split('='); switch (key) { case 'FREQ': options.freq = value; break; case 'INTERVAL': options.interval = parseInt(value, 10); break; case 'BYDAY': options.byDay = value.split(','); break; case 'BYMONTHDAY': options.monthlyType = 'day'; break; case 'UNTIL': options.endType = 'date'; if (value && value.length >= 8) { const y = value.substring(0, 4); const m = value.substring(4, 6); const d = value.substring(6, 8); options.until = `${y}-${m}-${d}`; } break; case 'COUNT': options.endType = 'count'; options.count = parseInt(value, 10); break; } }); if (options.freq === 'MONTHLY' && options.byDay.length > 0 && !rruleString.includes('BYMONTHDAY')) { options.monthlyType = 'pos'; } return options; }
const processEvents = (eventsData) => { return eventsData.map(e => ({ ...e, start: new Date(e.start), end: new Date(e.end) })); };

export default function AdminCalendar({ room, initialEvents, categories, allParents, childrenRooms }) {
    const router = useRouter();
    
    // ESTADOS GERAIS
    const [view, setView] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); 

    // Ajuste responsivo inicial
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsSidebarOpen(false);
                setView('agenda'); 
            } else {
                setIsSidebarOpen(true);
                setView('month');
            }
        };
        handleResize(); 
    }, []);

    // --- LÓGICA DE DADOS ---
    const initialFetchedMap = useMemo(() => {
        const map = {};
        processEvents(initialEvents).forEach(ev => {
            const rId = ev.roomId;
            if (!map[rId]) map[rId] = [];
            map[rId].push(ev);
        });
        return map;
    }, [initialEvents]);

    const initialVisibleIds = useMemo(() => {
        const ids = [room.id];
        if (room.parentId) ids.push(room.parentId);
        return new Set(ids);
    }, [room]);

    const [allFetchedEvents, setAllFetchedEvents] = useState(initialFetchedMap);
    const [visibleRoomIds, setVisibleRoomIds] = useState(initialVisibleIds);
    const [isLoadingChildren, setIsLoadingChildren] = useState(new Set());

    // ESTADOS DE UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isRecurrenceUpdateModalOpen, setIsRecurrenceUpdateModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isCategorySaving, setIsCategorySaving] = useState(false);
    const [isViewOnlyModalOpen, setIsViewOnlyModalOpen] = useState(false);
    const [eventToView, setEventToView] = useState(null);
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedOriginalDate, setSelectedOriginalDate] = useState(null);
    const [formData, setFormData] = useState({ title: '', description: '', start: '', end: '', categoryId: '', newCategoryName: '', cascade: false, visibleToParent: false, allDay: false });
    const [settingsData, setSettingsData] = useState({ name: room.name, color: room.color, group: room.group || '', parentId: room.parentId || '', blockParentCascade: room.blockParentCascade || false });
    const [rruleOptions, setRruleOptions] = useState(parseRRule());
    const [targetConfig, setTargetConfig] = useState({ mode: 'none', group: '', specificIds: [] });
    const [parentSearchTerm, setParentSearchTerm] = useState("");
    const [copySuccess, setCopySuccess] = useState('');

    const availableGroups = useMemo(() => { if (!childrenRooms) return []; const groups = childrenRooms.map(c => c.group).filter(Boolean); return [...new Set(groups)]; }, [childrenRooms]);
    const filteredParents = useMemo(() => { if (!parentSearchTerm) return allParents; return allParents.filter(p => p.name.toLowerCase().includes(parentSearchTerm.toLowerCase())); }, [allParents, parentSearchTerm]);

    // --- LÓGICA DE EVENTOS E VISUALIZAÇÃO ---
    const displayedEvents = useMemo(() => {
        let eventsToShow = [];
        visibleRoomIds.forEach(roomId => {
            if (allFetchedEvents[roomId]) {
                eventsToShow.push(...allFetchedEvents[roomId]);
            }
        });
        return eventsToShow;
    }, [allFetchedEvents, visibleRoomIds]);

    const handleVisibilityChange = async (roomId) => {
        const newVisibleIds = new Set(visibleRoomIds);
        if (newVisibleIds.has(roomId)) {
            newVisibleIds.delete(roomId);
        } else {
            newVisibleIds.add(roomId);
            if (!allFetchedEvents[roomId]) {
                setIsLoadingChildren(prev => new Set(prev).add(roomId));
                if (roomId !== room.id) {
                    const result = await getChildRoomEvents(roomId, room.id);
                    if (result.success) {
                        setAllFetchedEvents(prev => ({ ...prev, [roomId]: processEvents(result.events) }));
                    } else {
                        alert(result.error);
                        newVisibleIds.delete(roomId);
                    }
                }
                setIsLoadingChildren(prev => { const newSet = new Set(prev); newSet.delete(roomId); return newSet; });
            }
        }
        setVisibleRoomIds(newVisibleIds);
    };

    const toggleAllChildren = () => {
        const allChildrenIds = childrenRooms.map(c => c.id);
        const allSelected = allChildrenIds.every(id => visibleRoomIds.has(id));
        const newSet = new Set(visibleRoomIds);
        if (allSelected) {
            allChildrenIds.forEach(id => newSet.delete(id));
        } else {
            allChildrenIds.forEach(id => {
                newSet.add(id);
                if (!allFetchedEvents[id]) handleVisibilityChange(id); 
            });
        }
        setVisibleRoomIds(newSet);
    };

    const checkConflict = (start, end, excludeId) => {
        const eventStart = new Date(start).getTime();
        const eventEnd = new Date(end).getTime();
        return displayedEvents.some(ev => {
            if (ev.id === excludeId || ev.allDay) return false;
            const existingStart = new Date(ev.start).getTime();
            const existingEnd = new Date(ev.end).getTime();
            return eventStart < existingEnd && eventEnd > existingStart;
        });
    };

    const EventComponent = ({ event }) => {
        const hasConflict = checkConflict(event.start, event.end, event.id);
        const isExternal = event.roomId !== room.id;
        const eventColor = isExternal ? (event.room?.color || '#999') : (event.resource?.color || event.category?.color || room.color);
        const textColor = getContrastColor(eventColor);
        
        return (
            <div className={`text-xs p-1 h-full overflow-hidden leading-tight flex flex-col justify-start relative transition-all 
                ${isExternal ? 'opacity-90' : ''} 
                ${hasConflict ? 'ring-2 ring-red-600 animate-pulse z-20 shadow-lg' : ''} 
                `} 
                style={{ backgroundColor: eventColor, color: textColor, borderRadius: '4px' }}
            >
                {hasConflict && <div className="absolute top-0 right-0 p-0.5 bg-red-600 text-white rounded-bl-md"><AlertTriangle size={8} /></div>}
                <div className="flex items-center gap-1 font-bold truncate">
                    {isExternal && <Lock size={10} className="shrink-0" />}
                    {event.title}
                </div>
                {isExternal && <span className="text-[9px] opacity-90 font-semibold truncate mt-1">{event.room?.name || event.resource?.roomName}</span>}
            </div>
        );
    };

    // --- NOVAS FUNCIONALIDADES: WHATSAPP E PDF (CORRIGIDAS) ---

    const generateWhatsAppText = () => {
        const weekStart = startOfWeek(currentDate, { locale: ptBR });
        const weekEnd = endOfWeek(currentDate, { locale: ptBR });
        
        const weeklyEvents = displayedEvents.filter(ev => 
            isWithinInterval(ev.start, { start: weekStart, end: weekEnd })
        ).sort((a, b) => a.start - b.start);

        if (weeklyEvents.length === 0) {
            alert("Nenhum evento visível nesta semana.");
            return;
        }

        let text = `*📅 AGENDA DA SEMANA - ${room.name.toUpperCase()}*\n`;
        text += `_Semana de ${format(weekStart, 'dd/MM')} a ${format(weekEnd, 'dd/MM')}_\n\n`;
        
        let currentDay = '';
        weeklyEvents.forEach(ev => {
            const dayName = format(ev.start, "EEEE (dd/MM)", { locale: ptBR }).toUpperCase();
            if (dayName !== currentDay) {
                text += `\n*${dayName}*\n`;
                currentDay = dayName;
            }
            const time = ev.allDay ? 'Dia todo' : format(ev.start, "HH:mm");
            const location = ev.roomId !== room.id ? ` _(${ev.room?.name || 'Externo'})_` : '';
            text += `• ${time} - ${ev.title}${location}\n`;
        });

        text += `\n_Gerado via AgendaIgreja_`;

        navigator.clipboard.writeText(text).then(() => {
            setCopySuccess('Copiado!');
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };

    const generatePDFReport = () => {
        const doc = new jsPDF();
        
        let startRange, endRange, titlePeriod;

        if (view === 'month') {
            startRange = startOfMonth(currentDate);
            endRange = endOfMonth(currentDate);
            titlePeriod = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
        } else if (view === 'week') {
            startRange = startOfWeek(currentDate, { locale: ptBR });
            endRange = endOfWeek(currentDate, { locale: ptBR });
            titlePeriod = `Semana de ${format(startRange, 'dd/MM')} a ${format(endRange, 'dd/MM')}`;
        } else {
            startRange = startOfDay(currentDate);
            endRange = endOfDay(currentDate);
            titlePeriod = format(currentDate, "dd 'de' MMMM", { locale: ptBR });
        }

        doc.setFontSize(18);
        doc.text(`Relatório de Agenda - ${room.name}`, 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Período: ${titlePeriod.toUpperCase()}`, 14, 26);

        const eventsToPrint = displayedEvents.filter(ev => {
            return (ev.start >= startRange && ev.start <= endRange) || 
                   (ev.end >= startRange && ev.end <= endRange) ||
                   (ev.start <= startRange && ev.end >= endRange);
        }).sort((a, b) => a.start - b.start);

        const tableData = eventsToPrint.map(ev => [
            format(ev.start, 'dd/MM (EEE)', { locale: ptBR }),
            ev.allDay ? 'Dia todo' : `${format(ev.start, 'HH:mm')} - ${format(ev.end, 'HH:mm')}`,
            ev.title,
            ev.roomId !== room.id ? (ev.room?.name || 'Externo') : room.name
        ]);

        autoTable(doc, {
            startY: 32,
            head: [['Data', 'Horário', 'Evento', 'Origem']],
            body: tableData,
            theme: 'striped',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 9 },
        });

        doc.save(`Agenda_${room.name}_${format(currentDate, 'yyyy-MM')}.pdf`);
    };

    // --- HANDLERS (CRUD) ---
    const prepareForm = (evt = null, slot = null) => { 
        setShowNewCategory(false); 
        if (evt) { 
            if (!evt.canEdit) { 
                setTargetConfig({ mode: 'none', group: '', specificIds: [] }); 
                setEventToView(evt); 
                setIsViewOnlyModalOpen(true); 
                return; 
            } 
            setSelectedEvent(evt); 
            setSelectedOriginalDate(evt.start); 
            const startStr = evt.allDay ? format(evt.start, 'yyyy-MM-dd') : format(evt.start, "yyyy-MM-dd'T'HH:mm"); 
            const endStr = evt.allDay ? format(evt.end, 'yyyy-MM-dd') : format(evt.end, "yyyy-MM-dd'T'HH:mm"); 
            setFormData({ title: evt.title, description: evt.description || '', start: startStr, end: endStr, categoryId: evt.categoryId || '', newCategoryName: '', cascade: evt.cascade, visibleToParent: evt.visibleToParent, allDay: !!evt.allDay }); 
            if (evt.targetRooms && evt.targetRooms.length > 0) { 
                setTargetConfig({ mode: 'select', group: '', specificIds: evt.targetRooms.map(r => r.id) }); 
            } else { 
                setTargetConfig({ mode: 'none', group: '', specificIds: [] }); 
            } 
            setRruleOptions(parseRRule(evt.rrule)); 
            setIsModalOpen(true); 
        } else { 
            setSelectedEvent(null); 
            setSelectedOriginalDate(null); 
            setTargetConfig({ mode: 'none', group: '', specificIds: [] }); 
            let startDate, endDate; 
            let isAllDay = false; 
            if (slot?.slots) { 
                if (slot.slots.length === 1 && slot.action === 'click') { 
                    startDate = set(slot.start, { hours: 19, minutes: 0, seconds: 0 }); 
                    endDate = set(slot.start, { hours: 21, minutes: 0, seconds: 0 }); 
                    isAllDay = false; 
                } else { 
                    startDate = slot.start; 
                    endDate = slot.end; 
                    isAllDay = (endDate.getTime() - startDate.getTime()) >= (24 * 60 * 60 * 1000 - 1); 
                } 
            } else { 
                const now = new Date(); 
                startDate = set(now, { hours: 19, minutes: 0, seconds: 0 }); 
                endDate = set(now, { hours: 21, minutes: 0, seconds: 0 }); 
                isAllDay = false; 
            } 
            const dateFormat = isAllDay ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm"; 
            setFormData({ title: '', description: '', start: format(startDate, dateFormat), end: format(endDate, dateFormat), categoryId: '', newCategoryName: '', cascade: false, visibleToParent: false, allDay: isAllDay }); 
            const weekDayCode = format(startDate, 'iiii').toUpperCase().substring(0, 2); 
            setRruleOptions({ freq: 'NONE', interval: 1, byDay: [weekDayCode], monthlyType: 'day', endType: 'never', until: '', count: 13 }); 
            setIsModalOpen(true); 
        } 
    };

    const handleCreateNewCategory = async () => { if (!formData.newCategoryName.trim()) { alert("Nome vazio."); return; } setIsCategorySaving(true); const data = new FormData(); data.append('roomId', room.id); data.append('name', formData.newCategoryName); data.append('color', '#3b82f6'); const result = await createCategory(data); if (result.success) { router.refresh(); setFormData({ ...formData, newCategoryName: '' }); setShowNewCategory(false); } else { alert("Erro: " + result.error); } setIsCategorySaving(false); };
    const handlePreSubmit = async (e) => { e.preventDefault(); if (selectedEvent?.rrule) setIsRecurrenceUpdateModalOpen(true); else await handleFinalSubmit('all'); };
    const handleFinalSubmit = async (updateMode) => { setIsRecurrenceUpdateModalOpen(false); setIsLoading(true); const data = new FormData(); data.append('roomId', room.id); if (selectedEvent) { data.append('eventId', selectedEvent.id); data.append('updateMode', updateMode); if (selectedOriginalDate) data.append('originalDate', selectedOriginalDate.toISOString()); } data.append('title', formData.title); data.append('description', formData.description); data.append('categoryId', formData.categoryId); if (formData.cascade) data.append('cascade', 'on'); if (formData.visibleToParent) data.append('visibleToParent', 'on'); if (formData.allDay) data.append('allDay', 'on'); data.append('targetMode', targetConfig.mode); if (targetConfig.mode === 'group') data.append('targetGroup', targetConfig.group); if (targetConfig.mode === 'select') data.append('specificTargetIds', JSON.stringify(targetConfig.specificIds)); let startISO, endISO; if (formData.allDay) { const [y, m, d] = formData.start.split('T')[0].split('-').map(Number); const startLocal = new Date(y, m - 1, d, 0, 0, 0); endISO = new Date(y, m - 1, d, 23, 59, 59).toISOString(); startISO = startLocal.toISOString(); } else { startISO = new Date(formData.start).toISOString(); endISO = new Date(formData.end).toISOString(); } data.set('start', startISO); data.set('end', endISO); const rruleStr = generateRRule(new Date(startISO), rruleOptions); if (rruleStr) data.append('rruleString', rruleStr); const action = selectedEvent ? updateEvent : createEvent; const result = await action(data); if (result.success) { router.refresh(); setIsModalOpen(false); } else { alert("Erro: " + result.error); } setIsLoading(false); };
    const handleDelete = async (mode) => { if (!confirm("Excluir evento?")) return; setIsLoading(true); const data = new FormData(); data.append('eventId', selectedEvent.id); data.append('deleteMode', mode); data.append('originalDate', selectedOriginalDate.toISOString()); const result = await deleteEvent(data); if (result.success) { router.refresh(); setIsModalOpen(false); } else { alert(result.error); } setIsLoading(false); };
    const handleRebroadcastSubmit = async (formData) => { setIsLoading(true); const result = await rebroadcastEvent(formData); if (result.success) { router.refresh(); setIsViewOnlyModalOpen(false); } else { alert("Erro: " + result.error); } setIsLoading(false); };
    const handleUpdateRoom = async () => { setIsLoading(true); const data = new FormData(); data.append('roomId', room.id); data.append('name', settingsData.name); data.append('color', settingsData.color); data.append('group', settingsData.group); data.append('parentId', settingsData.parentId); data.append('blockParentCascade', settingsData.blockParentCascade ? 'on' : 'off'); const res = await updateRoom(data); if (res.success) { router.refresh(); setIsSettingsModalOpen(false); } else { alert(res.error); } setIsLoading(false); };
    const handleCopy = (text, message) => { navigator.clipboard.writeText(text).then(() => { setCopySuccess(message); setTimeout(() => setCopySuccess(''), 2000); }); };

    return (
        <div className="h-full w-full bg-slate-100 flex overflow-hidden font-sans relative">
            
            {/* OVERLAY PARA CELULAR (Fundo Escuro) */}
            {isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                ></div>
            )}

            {/* BARRA LATERAL (RETRÁTIL) */}
            <aside 
                className={`bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out absolute md:relative z-30 h-full shadow-xl md:shadow-none
                ${isSidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full md:w-0 overflow-hidden'}`}
            >
                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar min-w-[18rem]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-900 text-xl tracking-tight">Visualização</h3>
                        <button onClick={() => toggleAllChildren()} className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors">
                            Alternar Tudo
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* HIERARQUIA SUPERIOR (Se houver pai) */}
                        {room.parent && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <Shield size={12}/> Hierarquia Superior
                                </h4>
                                <div className="bg-gradient-to-r from-purple-50 to-white p-3 rounded-xl border border-purple-100 shadow-sm">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={visibleRoomIds.has(room.parentId)} 
                                            onChange={() => handleVisibilityChange(room.parentId)}
                                            className="w-5 h-5 rounded-md border-purple-200 text-purple-600 focus:ring-purple-500 bg-white" 
                                        />
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor: room.parent.color || '#666'}}></div>
                                            <span className="font-bold text-sm text-slate-800 truncate">{room.parent.name}</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* MINHA AGENDA */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Minha Agenda</h4>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={visibleRoomIds.has(room.id)} 
                                        onChange={() => handleVisibilityChange(room.id)}
                                        className="w-5 h-5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500" 
                                    />
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{backgroundColor: room.color}}></div>
                                        <span className="font-black text-sm text-slate-900 truncate">{room.name}</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        {/* LISTA DE CONGREGAÇÕES */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                Congregações <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{childrenRooms.length}</span>
                            </h4>
                            <div className="space-y-1">
                                {childrenRooms.length > 0 ? childrenRooms.map(child => (
                                    <label key={child.id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100">
                                        <input 
                                            type="checkbox" 
                                            checked={visibleRoomIds.has(child.id)} 
                                            onChange={() => handleVisibilityChange(child.id)} 
                                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                                        />
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: child.color}}></div>
                                        <div className="flex-1 min-w-0">
                                            <span className="block font-semibold text-sm text-slate-700 truncate group-hover:text-slate-900">{child.name}</span>
                                            {child.group && <span className="text-[10px] text-slate-400 font-medium truncate block">{child.group}</span>}
                                        </div>
                                        {isLoadingChildren.has(child.id) && <Loader2 size={14} className="animate-spin text-slate-400" />}
                                    </label>
                                )) : (
                                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <MapPin size={24} className="mx-auto text-slate-300 mb-2"/>
                                        <p className="text-xs text-slate-400">Nenhuma congregação vinculada.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* ÁREA PRINCIPAL */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white">
                
                {/* CABEÇALHO */}
                <header className="flex-none bg-white border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between z-20 gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors" title="Menu">
                            {isSidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
                        </button>
                        
                        <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
                        
                        <button onClick={() => router.push('/dashboard')} className="hidden md:flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold text-sm whitespace-nowrap group">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/> <span>Voltar</span>
                        </button>

                        <div className="flex items-center gap-2 truncate">
                            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: room.color }}></div>
                            <h1 className="text-lg font-black text-slate-900 truncate">{room.name}</h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={generateWhatsAppText} className="flex items-center gap-2 bg-emerald-50 text-emerald-600 font-bold text-sm px-3 py-2 rounded-lg hover:bg-emerald-100 transition" title="Copiar Agenda Semanal">
                            <Share2 size={18} /> <span className="hidden lg:inline">{copySuccess || 'WhatsApp'}</span>
                        </button>
                        <button onClick={generatePDFReport} className="hidden md:flex items-center gap-2 bg-slate-100 text-slate-600 font-bold text-sm px-3 py-2 rounded-lg hover:bg-slate-200 transition" title="Baixar PDF">
                            <FileText size={18} /> PDF
                        </button>
                        
                        <div className="h-6 w-px bg-slate-200 hidden md:block mx-1"></div>

                        {/* Botão Ver Agenda (Pública) */}
                        <a 
                            href={`/${room.slug}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-blue-50 text-blue-600 font-bold text-sm px-3 py-2 rounded-lg hover:bg-blue-100 transition" 
                            title="Ver Agenda Pública"
                        >
                            <ExternalLink size={18} /> <span className="hidden sm:inline">Ver Agenda</span>
                        </a>

                        <button onClick={() => setIsSettingsModalOpen(true)} className="hidden sm:flex p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"><Settings size={20} /></button>
                        <button onClick={() => prepareForm(null)} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg flex items-center gap-2 transition active:scale-95"><Plus size={18} /> <span className="hidden sm:inline">Novo</span></button>
                    </div>
                </header>

                {/* CALENDÁRIO */}
                <main className="flex-1 flex flex-col p-2 md:p-4 overflow-hidden bg-slate-50/50">
                    <div className="flex-1 h-full w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                        <Calendar
                            localizer={localizer}
                            events={displayedEvents}
                            view={view}
                            onView={setView}
                            date={currentDate}
                            onNavigate={setCurrentDate}
                            views={['month', 'week', 'day', 'agenda']}
                            culture="pt-BR"
                            selectable
                            onSelectSlot={(slot) => prepareForm(null, slot)}
                            onSelectEvent={(evt) => prepareForm(evt)}
                            components={{ event: EventComponent }}
                            messages={{ next: "Próximo", previous: "Anterior", today: "Hoje", month: "Mês", week: "Semana", day: "Dia", agenda: "Lista", noEventsInRange: "Nenhum evento visível.", showMore: total => `+${total}` }}
                            popup={true}
                            style={{ height: '100%' }}
                        />
                    </div>
                </main>
            </div>
            
            {/* --- MODAIS (Config, Novo Evento, etc) --- */}
            {isSettingsModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in max-h-[90vh] overflow-y-auto custom-scrollbar">
                <h2 className="text-xl font-black mb-6 text-slate-900 border-b pb-4 flex items-center gap-2">
                <Settings className="text-slate-400"/> Configurações da Agenda
                </h2>
                <div className="space-y-4">
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Nome</label><input value={settingsData.name} onChange={e => setSettingsData({...settingsData, name: e.target.value})} className="w-full p-3 border rounded-lg bg-slate-50 outline-none font-bold" /></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Cor</label><div className="flex gap-2"><input type="color" value={settingsData.color} onChange={e => setSettingsData({...settingsData, color: e.target.value})} className="h-12 w-20 p-1 border rounded cursor-pointer" /><div className="flex-1 bg-slate-50 border rounded-lg flex items-center px-3 text-sm text-slate-500">{settingsData.color}</div></div></div>
                <div><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Associar a Pai (Setor/Min)</label><div className="border rounded-lg bg-slate-50 p-2"><input placeholder="Buscar setor..." className="w-full p-2 mb-2 border rounded bg-white text-sm outline-none" value={parentSearchTerm} onChange={(e) => setParentSearchTerm(e.target.value)}/><div className="max-h-32 overflow-y-auto custom-scrollbar bg-white rounded border"><div className={`p-2 text-sm cursor-pointer hover:bg-blue-50 ${settingsData.parentId === '' ? 'bg-blue-100 font-bold' : ''}`} onClick={() => setSettingsData({...settingsData, parentId: ''})}>-- Nenhum (Raiz) --</div>{filteredParents.map(p => (<div key={p.id} className={`p-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center gap-2 ${settingsData.parentId === p.id ? 'bg-blue-100 font-bold' : ''}`} onClick={() => setSettingsData({...settingsData, parentId: p.id})}><div className="w-3 h-3 rounded-full" style={{backgroundColor: p.color}}></div>{p.name}</div>))}</div></div></div>
                </div>
                <div className="mt-6 pt-4 border-t"><h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Controle de Hierarquia</h3><div className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer select-none ${settingsData.blockParentCascade ? 'bg-yellow-50 border-yellow-200' : 'bg-white hover:bg-slate-50'}`} onClick={() => setSettingsData({...settingsData, blockParentCascade: !settingsData.blockParentCascade})}><div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${settingsData.blockParentCascade ? 'bg-yellow-500 border-yellow-500' : 'border-slate-300'}`}>{settingsData.blockParentCascade && <Check size={14} className="text-white"/>}</div><div><span className="font-bold text-sm text-slate-800">Bloquear Cascata da Agenda Pai</span><p className="text-xs text-slate-500">Impede que eventos em cascata da agenda pai desçam para esta agenda e suas filhas.</p></div></div></div>
                {childrenRooms && childrenRooms.length > 0 && (<div className="mt-6 pt-4 border-t"><h3 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-2"><Users size={14}/> Gerenciar Grupos das Congregações</h3><div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-1 bg-slate-50 border rounded-lg">{childrenRooms.map(child => (<form key={child.id} action={setChildRoomGroup} className="flex items-center gap-2 bg-white p-2 rounded-lg border"><input type="hidden" name="childRoomId" value={child.id} /><input type="hidden" name="parentRoomId" value={room.id} /><span className="font-bold text-sm text-slate-700 flex-1 truncate">{child.name}</span><input name="group" defaultValue={child.group || ''} placeholder="Ex: Região A" className="p-2 border rounded-md text-xs w-32" /><button type="submit" className="bg-slate-800 text-white hover:bg-slate-900 text-xs font-bold px-3 py-2 rounded-md">Salvar</button></form>))}</div></div>)}
                <div className="mt-6 pt-4 border-t space-y-2"><h3 className="text-xs font-bold text-slate-500 uppercase">Compartilhar</h3><div className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center"><span className="text-sm font-medium text-slate-700">Link da Agenda Pública</span><button type="button" onClick={() => handleCopy(`${window.location.origin}/${room.slug}`, 'Link copiado!')} className="text-sm font-bold bg-white border px-3 py-1 rounded-md hover:bg-slate-100">{copySuccess === 'Link copiado!' ? 'Copiado!' : 'Copiar'}</button></div>{room.inviteCode && (<div className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center"><span className="text-sm font-medium text-slate-700">Código de Convite</span><button type="button" onClick={() => handleCopy(room.inviteCode, 'Código copiado!')} className="text-sm font-bold bg-white border px-3 py-1 rounded-md hover:bg-slate-100">{copySuccess === 'Código copiado!' ? 'Copiado!' : 'Copiar'}</button></div>)}</div>
                <div className="mt-8 pt-4 border-t flex justify-between items-center"><form action={deleteRoom}><input type="hidden" name="roomId" value={room.id} /><button type="submit" onClick={(e) => { if(!confirm("Atenção! Isso apagará permanentemente a sala, todos os seus eventos e configurações de hierarquia. Deseja continuar?")) e.preventDefault(); }} className="bg-red-50 text-red-600 py-2 px-4 rounded-lg font-bold text-sm hover:bg-red-100 border border-red-100 flex items-center gap-2"><ShieldAlert size={16}/> Excluir Sala</button></form><div className="flex gap-2"><button onClick={() => setIsSettingsModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Cancelar</button><button onClick={handleUpdateRoom} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-700 transition">{isLoading ? 'Salvando...' : 'Salvar Mudanças'}</button></div></div>
            </div>
            </div>
            )}
            
            {/* MODAL EVENTO */}
            {isModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"><div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl flex-shrink-0"><h2 className="text-xl font-black text-slate-800">{selectedEvent ? 'Editar Evento' : 'Novo Evento'}</h2><button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl"><X size={24}/></button></div><form onSubmit={handlePreSubmit} className="flex flex-col overflow-hidden"><div className="p-6 overflow-y-auto custom-scrollbar space-y-5 flex-grow"><div className="space-y-4"><input name="title" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Adicionar título" className="w-full text-2xl font-medium border-b-2 border-slate-200 focus:border-blue-500 outline-none pb-2 placeholder:text-slate-300" autoFocus /><div className="flex items-center gap-4"><div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4"><div className="bg-slate-50 p-3 rounded-lg border"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Início</label><input type={formData.allDay ? "date" : "datetime-local"} value={formData.allDay ? formData.start.split('T')[0] : formData.start} onChange={e => setFormData({...formData, start: e.target.value})} className="w-full bg-transparent font-semibold outline-none text-sm"/></div>{!formData.allDay && (<div className="bg-slate-50 p-3 rounded-lg border"><label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Fim</label><input type="datetime-local" value={formData.end} onChange={e => setFormData({...formData, end: e.target.value})} className="w-full bg-transparent font-semibold outline-none text-sm"/></div>)}</div><div className={`flex items-center gap-3 border p-3 rounded-lg cursor-pointer transition-colors select-none ${formData.allDay ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'}`} onClick={() => setFormData({...formData, allDay: !formData.allDay})}><div className={`w-5 h-5 rounded border flex items-center justify-center ${formData.allDay ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{formData.allDay && <Check size={14} className="text-white"/>}</div><span className="text-sm font-bold text-slate-700">Dia todo</span></div></div><div className="flex flex-col md:flex-row gap-4"><div className="flex-1"><label className="text-xs font-bold text-slate-500 uppercase block mb-1">Categoria</label>{!showNewCategory ? (<div className="flex gap-2"><select className="flex-1 p-3 border rounded-lg bg-white outline-none" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})}><option value="">Sem Categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" onClick={() => setShowNewCategory(true)} className="bg-slate-100 px-3 rounded-lg font-bold text-slate-600 hover:bg-slate-200 text-sm">+ Nova</button><button type="button" onClick={() => setIsCategoryModalOpen(true)} className="bg-slate-100 px-3 rounded-lg font-bold text-slate-600 hover:bg-slate-200 text-sm"><Settings size={16}/></button></div>) : (<div className="flex gap-2"><input autoFocus placeholder="Nome da nova categoria..." className="flex-1 p-3 border rounded-lg bg-blue-50 border-blue-200 outline-none font-bold" value={formData.newCategoryName} onChange={e => setFormData({...formData, newCategoryName: e.target.value})} /><button type="button" onClick={handleCreateNewCategory} disabled={isCategorySaving} className="bg-emerald-500 text-white px-3 rounded-lg font-bold hover:bg-emerald-600 disabled:opacity-50">{isCategorySaving ? '...' : <Check/>}</button><button type="button" onClick={() => { setShowNewCategory(false); setFormData({...formData, newCategoryName: ''})}} className="text-slate-400 hover:text-red-500 font-bold px-2"><X/></button></div>)}</div></div><textarea name="description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Descrição..." className="w-full p-4 border rounded-lg bg-slate-50 outline-none min-h-[100px] resize-none text-sm"/></div><div className="border-t border-slate-100 pt-4 mt-2 space-y-4"><div className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer select-none ${formData.visibleToParent ? 'bg-emerald-50 border-emerald-200' : 'bg-white hover:bg-slate-50'}`} onClick={() => setFormData({...formData, visibleToParent: !formData.visibleToParent})}><div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${formData.visibleToParent ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>{formData.visibleToParent && <Check size={14} className="text-white"/>}</div><div><span className="font-bold text-sm text-slate-800">Visível para Agenda Pai</span><p className="text-xs text-slate-500">Permite que a agenda acima (Setor/Ministério) veja este evento.</p></div></div><div className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer select-none ${formData.cascade ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'}`} onClick={() => setFormData({...formData, cascade: !formData.cascade})}><div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${formData.cascade ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{formData.cascade && <Check size={14} className="text-white"/>}</div><div><span className="font-bold text-sm text-slate-800">Cascata (Todos Abaixo)</span><p className="text-xs text-slate-500">Força este evento para todas as agendas filhas, netas, etc.</p></div></div>{childrenRooms && childrenRooms.length > 0 && (<div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2"><span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Target size={12}/> Enviar para Agendas Filhas</span><div className="flex gap-2"><button type="button" onClick={() => setTargetConfig({ mode: 'none', group: '', specificIds: [] })} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'none' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Só Aqui</button><button type="button" onClick={() => setTargetConfig({...targetConfig, mode: 'all'})} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'all' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Todos</button>{availableGroups.length > 0 && <button type="button" onClick={() => setTargetConfig({...targetConfig, mode: 'group'})} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'group' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Por Grupo</button>}<button type="button" onClick={() => setTargetConfig({...targetConfig, mode: 'select'})} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'select' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Selecionar</button></div>{targetConfig.mode === 'group' && (<select className="w-full p-2 text-sm border rounded" value={targetConfig.group} onChange={e => setTargetConfig({...targetConfig, group: e.target.value})}><option value="">Selecione um grupo...</option>{availableGroups.map(g => <option key={g} value={g}>{g}</option>)}</select>)}{targetConfig.mode === 'select' && (<div className="max-h-24 overflow-y-auto border rounded bg-white p-2 space-y-1">{childrenRooms.map(child => (<label key={child.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={targetConfig.specificIds.includes(child.id)} onChange={(e) => { const ids = e.target.checked ? [...targetConfig.specificIds, child.id] : targetConfig.specificIds.filter(id => id !== child.id); setTargetConfig({...targetConfig, specificIds: ids}); }} />{child.name}</label>))}</div>)}</div>)}</div><div className="border rounded-xl p-5 bg-slate-50 space-y-4 mt-4"><div className="flex items-center gap-2 mb-2"><Repeat className="text-slate-400" size={18} /><span className="font-bold text-slate-700">Repetição Personalizada</span></div><div className="flex items-center gap-4 flex-wrap"><div className="flex items-center gap-2"><span className="text-sm text-slate-600">A cada:</span><input type="number" min="1" value={rruleOptions.interval} onChange={e => setRruleOptions({...rruleOptions, interval: parseInt(e.target.value)})} className="w-16 p-2 border rounded text-center font-bold"/></div><select value={rruleOptions.freq} onChange={e => setRruleOptions({...rruleOptions, freq: e.target.value})} className="p-2 border rounded font-bold text-slate-700"><option value="NONE">Não se repete</option><option value="DAILY">Dia(s)</option><option value="WEEKLY">Semana(s)</option><option value="MONTHLY">Mês(es)</option><option value="YEARLY">Ano(s)</option></select></div>{rruleOptions.freq === 'WEEKLY' && (<div className="flex gap-2 justify-center pt-2">{['D','S','T','Q','Q','S','S'].map((d, i) => { const code = ['SU','MO','TU','WE','TH','FR','SA'][i]; const isSelected = rruleOptions.byDay.includes(code); return (<button key={code} type="button" onClick={() => { const newDays = isSelected ? rruleOptions.byDay.filter(x => x !== code) : [...rruleOptions.byDay, code]; setRruleOptions({...rruleOptions, byDay: newDays}); }} className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${isSelected ? 'bg-blue-600 text-white scale-110' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>{d}</button>) })}</div>)}{rruleOptions.freq === 'MONTHLY' && formData.start && (<div className="space-y-2 text-sm text-slate-600 bg-white p-3 rounded border"><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="monthlyType" checked={rruleOptions.monthlyType === 'day'} onChange={() => setRruleOptions({...rruleOptions, monthlyType: 'day'})} /><span>Mensal no dia {getDate(new Date(formData.start))}</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="monthlyType" checked={rruleOptions.monthlyType === 'pos'} onChange={() => setRruleOptions({...rruleOptions, monthlyType: 'pos'})} /><span>Mensal na {Math.ceil(getDate(new Date(formData.start))/7)}ª {format(new Date(formData.start), 'iiii', { locale: ptBR })}</span></label></div>)}{rruleOptions.freq !== 'NONE' && (<div className="pt-2 border-t mt-2"><span className="text-xs font-bold text-slate-400 uppercase block mb-2">Termina em</span><div className="space-y-2 text-sm"><label className="flex items-center gap-2"><input type="radio" name="endType" checked={rruleOptions.endType === 'never'} onChange={() => setRruleOptions({...rruleOptions, endType: 'never'})} /> Nunca</label><label className="flex items-center gap-2"><input type="radio" name="endType" checked={rruleOptions.endType === 'date'} onChange={() => setRruleOptions({...rruleOptions, endType: 'date'})} /> Em: <input type="date" value={rruleOptions.until} disabled={rruleOptions.endType !== 'date'} onChange={e => setRruleOptions({...rruleOptions, until: e.target.value})} className="border rounded p-1 ml-2 disabled:opacity-50"/></label><label className="flex items-center gap-2"><input type="radio" name="endType" checked={rruleOptions.endType === 'count'} onChange={() => setRruleOptions({...rruleOptions, endType: 'count'})} /> Após: <input type="number" disabled={rruleOptions.endType !== 'count'} value={rruleOptions.count} onChange={e => setRruleOptions({...rruleOptions, count: parseInt(e.target.value)})} className="w-16 border rounded p-1 ml-2 disabled:opacity-50"/> ocorrências</label></div></div>)}</div>{selectedEvent && (<div className="bg-red-50 p-4 rounded-xl border border-red-100 flex flex-col gap-3"><div className="flex items-center gap-2 text-red-700 font-bold text-sm"><Trash2 size={16} /> Opções de Exclusão</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => handleDelete('all')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">Toda a série</button>{selectedEvent.rrule && (<><button type="button" onClick={() => handleDelete('single')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">Apenas este</button><button type="button" onClick={() => handleDelete('future')} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-600 hover:text-white px-3 py-2 rounded-lg text-sm font-bold transition">Este e futuros</button></>)}</div></div>)}</div><div className="p-6 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3 flex-shrink-0"><button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-200 rounded-xl transition">Cancelar</button><button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all active:scale-95 disabled:opacity-70 flex items-center gap-2">{isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Check size={20}/>}{selectedEvent ? 'Atualizar Evento' : 'Salvar Evento'}</button></div></form></div></div>)}
            {isRecurrenceUpdateModalOpen && (<div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl animate-in fade-in zoom-in border-2 border-blue-600"><h3 className="text-lg font-black text-slate-900 mb-4">Editar Evento Recorrente</h3><p className="text-sm text-slate-600 mb-6">Como você gostaria de aplicar esta alteração?</p><div className="space-y-2 mb-6"><button onClick={() => handleFinalSubmit('single')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left group"><Clock size={20} className="text-slate-400 group-hover:text-blue-600"/><div><span className="block font-bold text-slate-800">Apenas este evento</span><span className="text-xs text-slate-500">Altera somente esta ocorrência.</span></div></button><button onClick={() => handleFinalSubmit('future')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left group"><Layers size={20} className="text-slate-400 group-hover:text-blue-600"/><div><span className="block font-bold text-slate-800">Este e os eventos futuros</span><span className="text-xs text-slate-500">Cria uma nova série a partir daqui.</span></div></button><button onClick={() => handleFinalSubmit('all')} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-left group"><CalendarDays size={20} className="text-slate-400 group-hover:text-blue-600"/><div><span className="block font-bold text-slate-800">Todos os eventos da série</span><span className="text-xs text-slate-500">Altera a regra de repetição original.</span></div></button></div><button onClick={() => setIsRecurrenceUpdateModalOpen(false)} className="w-full py-2 text-slate-400 font-bold hover:text-slate-600">Cancelar</button></div></div>)}
            {isCategoryModalOpen && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in"><h2 className="text-xl font-black mb-4 text-slate-800">Gerenciar Categorias</h2><div className="mb-6 space-y-2 max-h-60 overflow-y-auto custom-scrollbar">{categories.map(cat => (<div key={cat.id} className="flex justify-between items-center p-3 border rounded-lg bg-slate-50"><div className="flex items-center gap-3"><div className="w-5 h-5 rounded-full" style={{backgroundColor: cat.color}}></div><span className="font-bold text-slate-700">{cat.name}</span></div><form action={async (formData) => { if(confirm("Deseja excluir esta categoria? Os eventos associados não serão apagados.")) { await deleteCategory(formData); router.refresh(); } }}><input type="hidden" name="categoryId" value={cat.id} /><input type="hidden" name="roomId" value={room.id} /><button type="submit" className="text-slate-400 hover:text-red-500 transition bg-white p-2 rounded-md shadow-sm border"><Trash2 size={16}/></button></form></div>))}</div><form action={async (formData) => { await createCategory(formData); router.refresh(); }} className="border-t pt-4"><p className="text-xs font-bold text-slate-500 mb-2 uppercase">Nova Categoria</p><input type="hidden" name="roomId" value={room.id} /><div className="flex gap-2 mb-3"><input name="name" required placeholder="Nome..." className="flex-1 p-3 border rounded-lg bg-slate-50 font-medium outline-none" /><input type="color" name="color" defaultValue="#3b82f6" className="w-12 h-full p-1 border rounded-lg cursor-pointer bg-white" /></div><div className="flex justify-end gap-2"><button type="button" onClick={() => setIsCategoryModalOpen(false)} className="px-4 py-2 text-slate-500 font-bold">Fechar</button><button type="submit" className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-bold shadow-emerald-200 shadow-md hover:bg-emerald-700 transition">+ Criar</button></div></form></div></div>)}
            {isViewOnlyModalOpen && eventToView && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm"><form action={handleRebroadcastSubmit} className="bg-white rounded-2xl w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"><input type="hidden" name="originalEventId" value={eventToView.id} /><input type="hidden" name="parentRoomId" value={room.id} /><input type="hidden" name="targetMode" value={targetConfig.mode} />{targetConfig.mode === 'group' && <input type="hidden" name="targetGroup" value={targetConfig.group} />}{targetConfig.mode === 'select' && <input type="hidden" name="specificTargetIds" value={JSON.stringify(targetConfig.specificIds)} />}<div className="p-6 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl"><h2 className="text-xl font-black text-slate-800">Detalhes do Evento</h2><button type="button" onClick={() => setIsViewOnlyModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl"><X size={24}/></button></div><div className="p-6 overflow-y-auto custom-scrollbar space-y-4"><div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-3 rounded-lg text-sm font-semibold flex items-center gap-2"><Lock size={16} /> Este evento é somente leitura. Foi criado por: <strong className="ml-1">{eventToView.room.name}</strong></div><h3 className="text-3xl font-bold text-slate-900">{eventToView.title}</h3><div className="flex items-center gap-4 text-sm text-slate-600"><div className="flex items-center gap-2"><CalendarDays size={16} className="text-slate-400"/><span>{format(new Date(eventToView.start), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span></div>{!eventToView.allDay && (<div className="flex items-center gap-2"><Clock size={16} className="text-slate-400"/><span>{format(new Date(eventToView.start), "HH:mm")} - {format(new Date(eventToView.end), "HH:mm")}</span></div>)}</div>{eventToView.description && (<div className="prose prose-sm max-w-none bg-slate-50 p-4 rounded-lg border"><p>{eventToView.description}</p></div>)}{childrenRooms && childrenRooms.length > 0 && (<div className="bg-blue-50 p-4 rounded-lg border border-blue-200 space-y-3 mt-4"><span className="font-bold text-blue-800 flex items-center gap-2"><Send size={16}/> Repassar para Minhas Congregações</span><div className="flex gap-2"><button type="button" onClick={() => setTargetConfig({ mode: 'none', group: '', specificIds: [] })} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'none' ? 'bg-slate-800 text-white' : 'bg-white'}`}>Não Repassar</button><button type="button" onClick={() => setTargetConfig({...targetConfig, mode: 'all'})} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'all' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Todos</button>{availableGroups.length > 0 && <button type="button" onClick={() => setTargetConfig({...targetConfig, mode: 'group'})} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'group' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Por Grupo</button>}<button type="button" onClick={() => setTargetConfig({...targetConfig, mode: 'select'})} className={`flex-1 py-1 text-xs font-bold rounded border ${targetConfig.mode === 'select' ? 'bg-blue-600 text-white' : 'bg-white'}`}>Selecionar</button></div>{targetConfig.mode === 'group' && (<select className="w-full p-2 text-sm border rounded bg-white" value={targetConfig.group} onChange={e => setTargetConfig({...targetConfig, group: e.target.value})}><option value="">Selecione um grupo...</option>{availableGroups.map(g => <option key={g} value={g}>{g}</option>)}</select>)}{targetConfig.mode === 'select' && (<div className="max-h-24 overflow-y-auto border rounded bg-white p-2 space-y-1">{childrenRooms.map(child => (<label key={child.id} className="flex items-center gap-2 text-xs p-1 hover:bg-slate-50 cursor-pointer"><input type="checkbox" checked={targetConfig.specificIds.includes(child.id)} onChange={(e) => { const ids = e.target.checked ? [...targetConfig.specificIds, child.id] : targetConfig.specificIds.filter(id => id !== child.id); setTargetConfig({...targetConfig, specificIds: ids}); }} />{child.name}</label>))}</div>)}</div>)}</div><div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-3"><button type="button" onClick={() => setIsViewOnlyModalOpen(false)} className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition">Cancelar</button>{targetConfig.mode !== 'none' && (<button type="submit" disabled={isLoading} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-70">{isLoading ? 'Repassando...' : 'Confirmar Repasse'}</button>)}</div></form></div>)}
        </div>
    );
}