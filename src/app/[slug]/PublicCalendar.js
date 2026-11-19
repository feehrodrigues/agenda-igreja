"use client";
import { useMemo, useState, useEffect, useRef } from 'react';
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
import html2canvas from 'html2canvas';
import {
  chaveDiaSP, dataSP, fimExclusivoSP, horaSP, inicioDoDiaSP, rotuloDiaTodo, rotuloPeriodoDiaTodo, somarDiasChave, ultimoDiaInclusivo,
} from '@/lib/datas';

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
    const origem = event.resource?.origem;
    const nomeOrigem = event.resource?.roomName;
    return (
        <div
            data-origem={origem}
            style={{ backgroundColor: event.resource.color, color: textColor }}
            className={`px-1.5 py-0.5 rounded text-[11px] font-bold leading-tight h-full flex flex-col justify-center gap-0.5 ${
                origem === "pai"
                    ? "border border-dashed border-white/80 italic opacity-90"
                    : origem === "filho"
                      ? "opacity-80"
                      : ""
            }`}
            title={origem === "pai" ? `Compromisso de ${nomeOrigem || "outra agenda"}` : origem === "filho" ? `Compromisso de ${nomeOrigem || "uma agenda filha"}` : undefined}
        >
            {origem !== "proprio" && nomeOrigem && (
                <span className={`inline-flex self-start items-center rounded px-1 py-0 text-[8px] font-black uppercase tracking-wide leading-none ${origem === "pai" ? "bg-amber-200/40 text-amber-50" : "bg-sky-200/40 text-sky-50"}`}>
                    {nomeOrigem}
                </span>
            )}
            <span className="truncate">{event.title}</span>
        </div>
    );
};

export default function PublicCalendar({ room, events: serializableEvents, isFollowingInitially, isLoggedIn, incluirFilhos = false, temFilhos = false }) {
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

  // Agenda semanal (impressão em PDF, JPG e texto).
  const [isWeekOpen, setIsWeekOpen] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(new Date());
  const weekRef = useRef(null);
  const [weekGenerating, setWeekGenerating] = useState(false);

  // Mantém a agenda pública atualizada sem o visitante recarregar a página.
  useEffect(() => {
    const atualizar = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') router.refresh();
    };
    window.addEventListener('focus', atualizar);
    const intervalo = setInterval(atualizar, 30000);
    return () => {
      window.removeEventListener('focus', atualizar);
      clearInterval(intervalo);
    };
  }, [router]);

  // Atualização Automática (ao voltar o foco e a cada 30s).
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
  
  // Filtro de origem: por padrão mostra só os compromissos desta sala. Os
  // eventos do pai/setor e das filhas entram quando o visitante marcar.
  const [mostrarPai, setMostrarPai] = useState(false);
  const [mostrarFilhas, setMostrarFilhas] = useState(incluirFilhos);

  // Processamento de Eventos
  const allEvents = useMemo(() => {
      if (!serializableEvents) return [];
      return serializableEvents.map(e => {
          const start = new Date(e.start);
          let end = new Date(e.end);
          if (isNaN(end.getTime()) || end <= start) {
              end = new Date(start);
              if (e.allDay) end.setDate(end.getDate() + 1);
              else end.setHours(end.getHours() + 1);
          }
          const origem = e.resource?.origem ?? (e.roomId === room.id ? "proprio" : "pai");
          return { ...e, start, end, resource: { ...e.resource, origem } };
      });
  }, [serializableEvents, room.id]);

  const contagem = useMemo(() => {
      let proprios = 0, pais = 0, filhas = 0;
      for (const ev of allEvents) {
          if (ev.resource.origem === "proprio") proprios += 1;
          else if (ev.resource.origem === "pai") pais += 1;
          else filhas += 1;
      }
      return { proprios, pais, filhas };
  }, [allEvents]);

  const eventsBase = useMemo(() => {
      return allEvents.filter((ev) => {
          const origem = ev.resource?.origem;
          if (origem === "proprio") return true;
          if (origem === "pai") return mostrarPai;
          if (origem === "filho") return incluirFilhos && mostrarFilhas;
          return true;
      });
  }, [allEvents, mostrarPai, mostrarFilhas, incluirFilhos]);

  const filteredEvents = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return searchTerm ? eventsBase.filter(e => e.title.toLowerCase().includes(lower)) : eventsBase;
  }, [eventsBase, searchTerm]);

  // Base do aviso semanal: ignora o filtro de origem (mostra a semana completa,
  // com os eventos do pai devidamente identificados).
  const eventosDaSemana = useMemo(() => {
    const lower = searchTerm.toLowerCase();
    return searchTerm ? allEvents.filter(e => e.title.toLowerCase().includes(lower)) : allEvents;
  }, [allEvents, searchTerm]);

  const monthEvents = useMemo(() => {
      return filteredEvents.filter(ev => isSameMonth(ev.start, currentDate)).sort((a, b) => a.start - b.start);
  }, [filteredEvents, currentDate]);

  // --- AGENDA SEMANAL (segunda → domingo) ---
  const semana = useMemo(() => {
      const base = new Date(weekAnchor);
      base.setHours(12, 0, 0, 0);
      // 0 = domingo; recua até a segunda-feira da semana.
      const deslocamento = (base.getDay() + 6) % 7;
      base.setDate(base.getDate() - deslocamento);
      return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(base);
          d.setDate(base.getDate() + i);
          return d;
      });
  }, [weekAnchor]);

  const eventosDoDia = (dia) => {
      const chave = chaveDiaSP(dia);
      const inicio = inicioDoDiaSP(chave);
      const fim = inicioDoDiaSP(somarDiasChave(chave, 1));
      // O aviso semanal mostra tudo (inclusive o que vem do pai/setor), sempre
      // com a marcação de origem, para o secretário não confundir.
      return eventosDaSemana
          .filter((ev) => {
              if (ev.allDay) return new Date(ev.start) < fim && new Date(ev.end) > inicio;
              return ev.start >= inicio && ev.start < fim;
          })
          .sort((a, b) => {
              if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
              return a.start - b.start;
          });
  };

  const tituloDaSemana = () => {
      const ini = semana[0];
      const fim = semana[6];
      return `${dataSP(ini, { day: '2-digit', month: 'short' })} a ${dataSP(fim, { day: '2-digit', month: 'short', year: 'numeric' })}`;
  };

  const textoDaSemana = () => {
      const linhas = [
          `*AGENDA DA SEMANA · ${tituloDaSemana()}*`,
          `_${room.name}_`,
          "",
      ];
      semana.forEach((dia) => {
          const doDia = eventosDoDia(dia);
          if (doDia.length === 0) return;
          linhas.push(`*${dataSP(dia, { weekday: 'long', day: '2-digit', month: 'long' })}*`);
          doDia.forEach((ev) => {
              const hora = ev.allDay ? "Dia todo" : `${horaSP(ev.start)}–${horaSP(ev.end)}`;
              if (ev.resource?.origem === "pai" && ev.resource?.roomName) {
                  linhas.push(`> 🟨 ${ev.resource.roomName}  |  ${hora} — ${ev.title}`);
              } else if (ev.resource?.origem === "filho" && ev.resource?.roomName) {
                  linhas.push(`> 🔹 ${ev.resource.roomName}  |  ${hora} — ${ev.title}`);
              } else {
                  linhas.push(`• ${hora} — ${ev.title}`);
              }
          });
          linhas.push("");
      });
      linhas.push("_Enviado pela Agenda Igreja_");
      return linhas.join("\n");
  };

  const [textoCopiado, setTextoCopiado] = useState(false);

  const copiarTextoDaSemana = async () => {
      const texto = textoDaSemana();
      try {
          await navigator.clipboard.writeText(texto);
          setTextoCopiado(true);
          setTimeout(() => setTextoCopiado(false), 2500);
      } catch {
          // Fallback para navegadores sem permissão de clipboard.
          const area = document.createElement('textarea');
          area.value = texto;
          document.body.appendChild(area);
          area.select();
          document.execCommand('copy');
          document.body.removeChild(area);
          setTextoCopiado(true);
          setTimeout(() => setTextoCopiado(false), 2500);
      }
  };

  const abrirWhatsApp = () => {
      const url = `https://wa.me/?text=${encodeURIComponent(textoDaSemana())}`;
      window.open(url, '_blank', 'noopener,noreferrer');
  };

  const baixarTextoDaSemana = () => {
      const blob = new Blob([textoDaSemana().replace(/\*/g, '').replace(/_/g, '')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agenda-semana-${room.slug}.txt`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const baixarPDFDaSemana = () => {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const largura = doc.internal.pageSize.getWidth();
      const altura = doc.internal.pageSize.getHeight();
      const margem = 18;
      const DIAS_CURTOS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

      // Faixa de cabeçalho (padrão slate).
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, largura, 36, 'F');
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(room.name, margem, 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(203, 213, 225);
      doc.text('Agenda da Semana', margem, 24);
      doc.setFontSize(11);
      doc.text(tituloDaSemana(), margem, 32);
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text('AgendaIgreja', largura - margem, 16, { align: 'right' });

      let y = 46;

      const larguraConteudo = largura - margem * 2;

      const novaPaginaSePreciso = (necessario) => {
          if (y + necessario > altura - 18) {
              doc.addPage();
              y = 18;
          }
      };

      semana.forEach((dia, indice) => {
          const doDia = eventosDoDia(dia);
          // Estimativa de altura do bloco (dia + eventos).
          const alturaEventos = doDia.reduce((soma, ev) => {
              const linhas = doc.splitTextToSize(
                  `${ev.title}${ev.description ? ` — ${ev.description}` : ''}`,
                  larguraConteudo - 36,
              ).length;
              return soma + 6 + Math.max(0, linhas - 1) * 4.5;
          }, 0);
          novaPaginaSePreciso(12 + alturaEventos + 4);

          // Cabeçalho do dia.
          doc.setFillColor(241, 245, 249);
          doc.roundedRect(margem, y, larguraConteudo, 10, 2, 2, 'F');
          doc.setFillColor(30, 41, 59);
          doc.roundedRect(margem + 2, y + 2, 16, 6, 1.5, 1.5, 'F');
          doc.setTextColor(255);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.5);
          doc.text(DIAS_CURTOS[indice], margem + 10, y + 6.2, { align: 'center' });

          doc.setTextColor(30, 41, 59);
          doc.setFontSize(11);
          doc.text(dataSP(dia, { day: '2-digit', month: 'long' }), margem + 22, y + 7);

          y += 13;

          if (doDia.length === 0) {
              doc.setTextColor(150);
              doc.setFont('helvetica', 'italic');
              doc.setFontSize(9);
              doc.text('Sem eventos', margem + 6, y);
              y += 8;
          }

          doDia.forEach((ev) => {
              const marcaPai = ev.resource?.origem === 'pai';
              const tituloLinhas = doc.splitTextToSize(ev.title, larguraConteudo - 42);
              novaPaginaSePreciso(8 + (tituloLinhas.length - 1) * 4.5 + 4);

              const indentacao = marcaPai ? 8 : 0;

              if (marcaPai) {
                  doc.setFillColor(254, 243, 199);
                  doc.roundedRect(margem + indentacao, y - 4, larguraConteudo - indentacao, 7 + (tituloLinhas.length - 1) * 4.5 + (ev.resource?.roomName && ev.resource.isExternal ? 4 : 0), 4, 4, 'F');

              }

              const hora = ev.allDay ? 'Dia todo' : `${horaSP(ev.start)}–${horaSP(ev.end)}`;
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(8.5);
              doc.setTextColor(marcaPai ? 80 : 71);
              doc.text(hora, margem + 6 + indentacao, y);

              if (marcaPai && ev.resource?.roomName && ev.resource.isExternal) {
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(8);
                  doc.setTextColor(180, 130, 20);
                  doc.text(ev.resource.roomName, margem + 34 + indentacao, y);
                  y += 4;
              }

              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.setTextColor(30, 41, 59);
              doc.text(tituloLinhas, margem + 34 + indentacao, y);
              y += (tituloLinhas.length - 1) * 4.5 + 7;

              if (marcaPai) {
                  y += 2;
              }
          });
          y += 4;
      });

      // Rodapé com curva elegante.
      const paginas = doc.internal.getNumberOfPages();
      for (let i = 1; i <= paginas; i++) {
          doc.setPage(i);
          doc.setFillColor(30, 41, 59);
          doc.moveTo(0, altura);
          for (let x = 0; x <= largura; x += 0.5) {
              const t = x / largura;
              // Curva que começa em baixo, sobe com uma onda no meio, termina em cima.
              const base = altura - 4 - 18 * t;
              const onda = 10 * Math.sin(t * Math.PI);
              const yy = base + onda;
              doc.lineTo(x, yy);
          }
          doc.lineTo(largura, altura);
          doc.lineTo(0, altura);
          doc.close();
          doc.fill();
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(255, 255, 255);
          doc.text(`${room.name} · ${dataSP(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, margem, altura - 7);
          doc.text(`Página ${i} de ${paginas}`, largura - margem, altura - 7, { align: 'right' });
      }

      doc.save(`agenda-semana-${room.slug}-${tituloDaSemana().replace(/[^a-zA-Z0-9]/g, '-')}.pdf`);
  };

  const baixarJPGDaSemana = async () => {
      if (!weekRef.current) return;
      setWeekGenerating(true);
      try {
          const canvas = document.createElement('canvas');
          canvas.width = 1080;
          canvas.height = 1080;
          const ctx = canvas.getContext('2d');

          // Fundo branco.
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 1080, 1080);

          // Cabeçalho slate-800.
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 0, 1080, 165);

          // Marca AgendaIgreja (canto superior direito).
          ctx.font = '14px Arial, sans-serif';
          ctx.fillStyle = '#64748b';
          ctx.textAlign = 'right';
          ctx.fillText('AgendaIgreja', 1030, 28);
          ctx.textAlign = 'left';

          // Nome da sala.
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px Arial, sans-serif';
          ctx.fillText(room.name, 50, 85);

          // Subtítulo.
          ctx.font = '24px Arial, sans-serif';
          ctx.fillStyle = '#94a3b8';
          ctx.fillText('Agenda da Semana', 50, 120);

          // Data da semana (mais visível).
          ctx.font = 'bold 20px Arial, sans-serif';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(tituloDaSemana(), 50, 150);

          // Dias e eventos.
          let yPos = 185;
          const margem = 50;
          const larguraConteudo = 1080 - margem * 2;
          const DIAS_CURTOS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

          semana.forEach((dia, indice) => {
              const doDia = eventosDoDia(dia);

              // Cabeçalho do dia (arredondado).
              ctx.fillStyle = '#f1f5f9';
              ctx.beginPath();
              ctx.roundRect(margem, yPos, larguraConteudo, 46, 12);
              ctx.fill();

              // Badge do dia da semana.
              ctx.fillStyle = '#1e293b';
              ctx.beginPath();
              ctx.roundRect(margem + 6, yPos + 5, 50, 36, 8);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 16px Arial, sans-serif';
              ctx.textAlign = 'center';
              ctx.fillText(DIAS_CURTOS[indice], margem + 31, yPos + 29);
              ctx.textAlign = 'left';

              // Data.
              ctx.fillStyle = '#1e293b';
              ctx.font = 'bold 24px Arial, sans-serif';
              ctx.fillText(dataSP(dia, { day: '2-digit', month: 'long' }), margem + 66, yPos + 30);

              yPos += 52;

              if (doDia.length === 0) {
                  ctx.fillStyle = '#94a3b8';
                  ctx.font = 'italic 18px Arial, sans-serif';
                  ctx.fillText('Sem eventos', margem + 12, yPos + 20);
                  yPos += 32;
              } else {
                  doDia.forEach((ev) => {
                      const marcaPai = ev.resource?.origem === 'pai';
                      const hora = ev.allDay ? 'Dia todo' : `${horaSP(ev.start)}–${horaSP(ev.end)}`;

                      if (marcaPai) {
                          ctx.fillStyle = '#fefce8';
                          ctx.beginPath();
                          ctx.roundRect(margem + 8, yPos - 6, larguraConteudo - 8, 38, 8);
                          ctx.fill();
                          // Barra lateral âmbar.
                          ctx.fillStyle = '#fbbf24';
                          ctx.fillRect(margem + 8, yPos - 6, 5, 38);
                      }

                      ctx.fillStyle = marcaPai ? '#92400e' : '#475569';
                      ctx.font = 'bold 16px Arial, sans-serif';
                      ctx.fillText(hora, margem + 22, yPos + 16);

                      ctx.fillStyle = '#1e293b';
                      ctx.font = marcaPai ? 'italic bold 18px Arial, sans-serif' : 'bold 18px Arial, sans-serif';
                      ctx.fillText(ev.title, margem + 140, yPos + 16);

                      if (marcaPai && ev.resource?.roomName && ev.resource.isExternal) {
                          ctx.fillStyle = '#92400e';
                          ctx.font = 'bold 13px Arial, sans-serif';
                          ctx.fillText(ev.resource.roomName, margem + 140, yPos + 36);
                          yPos += 12;
                      }

                      yPos += 36;
                  });
              }
              yPos += 8;
          });

          // Rodapé simples (sem onda).
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(0, 1050, 1080, 30);
          ctx.fillStyle = '#ffffff';
          ctx.font = '16px Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`${room.name} · ${dataSP(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })}`, 50, 1072);
          ctx.textAlign = 'right';
          ctx.fillText('Página 1 de 1', 1030, 1072);

          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/jpeg', 0.95);
          a.download = `agenda-semana-${room.slug}.jpg`;
          a.click();
      } catch (e) {
          console.error("JPG erro:", e);
          alert('Não foi possível gerar o JPG.');
      } finally {
          setWeekGenerating(false);
      }
  };

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
            `${format(ev.start, 'dd/MM (EEE)', {locale: ptBR})}\n${ev.allDay ? `${rotuloDiaTodo(ev.start, ev.end)} (${rotuloPeriodoDiaTodo(ev.start, ev.end)})` : `${horaSP(ev.start)} - ${horaSP(ev.end)}`}`,
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
            'Hora Início': ev.allDay ? 'Dia todo' : horaSP(ev.start),
            'Data Fim': ev.allDay ? (() => { const f = ultimoDiaInclusivo(chaveDiaSP(ev.end)); return format(inicioDoDiaSP(f), 'dd/MM/yyyy'); })() : format(ev.end, 'dd/MM/yyyy'),
            'Hora Fim': ev.allDay ? 'Dia todo' : horaSP(ev.end),
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
      <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 z-40 overflow-visible">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg" style={{backgroundColor: room.color}}>{room.name.charAt(0)}</div><div className="leading-tight"><h1 className="text-base md:text-lg font-black text-slate-900 truncate max-w-[150px] md:max-w-md">{room.name}</h1><p className="text-[10px] text-slate-500 font-bold uppercase">Agenda Igreja</p></div></div>
            <div className="flex items-center gap-2">
                <button onClick={() => { setWeekAnchor(new Date()); setIsWeekOpen(true); }} className="flex items-center gap-2 px-3 py-2 bg-slate-900 text-white rounded-full font-bold text-xs hover:bg-slate-700 transition" title="Agenda da semana">
                    <CalendarDays size={14} /> <span className="hidden sm:inline">Agenda da Semana</span>
                </button>
                <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-full font-bold text-xs hover:bg-blue-700 transition" title="Baixar agenda (mensal, anual, Excel, PDF)">
                    <Download size={14} /> <span className="hidden sm:inline">Baixar Agenda</span>
                </button>
                <div className="relative">
                    <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-full font-bold text-xs hover:bg-slate-200 transition">Opções <ChevronDown size={14} className={`transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} /></button>
                    {isExportMenuOpen && (<div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50 animate-in fade-in zoom-in duration-200"><button onClick={handleShare} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><Share2 size={16} className="text-blue-500"/> {copySuccess || 'Compartilhar'}</button><a href={googleUrl} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><CalIcon size={16} className="text-red-500"/> Google Agenda</a><div className="h-px bg-slate-100 my-1" /><button onClick={() => setIsExportModalOpen(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl"><Download size={16} className="text-emerald-500"/> Baixar Agenda</button></div>)}
                </div>
                {isLoggedIn && <button onClick={handleFollow} className={`px-4 py-2 rounded-full font-bold text-xs transition ${isFollowing ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-600 text-white'}`}>{isFollowing ? 'Seguindo' : 'Seguir'}</button>}
            </div>
        </div>
      </header>

      {temFilhos && (
        <div className="border-b border-slate-200 bg-white/70">
          <div className="max-w-5xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 font-medium">
              {incluirFilhos
                ? "Incluindo também as agendas filhas desta sala."
                : `Mostrando apenas a agenda de ${room.name}.`}
            </span>
            <a
              href={incluirFilhos ? `/${room.slug}` : `/${room.slug}?filhos=1`}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold transition ${
                incluirFilhos
                  ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              }`}
            >
              {incluirFilhos ? "Ocultar agendas filhas" : "Ver também as agendas filhas"}
            </a>
          </div>
        </div>
      )}

      <div className="border-b border-slate-200 bg-white/70">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-bold text-slate-500">Mostrar:</span>
          <button
            type="button"
            onClick={() => setMostrarPai(false)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold transition ${
              !mostrarPai
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Somente esta sala
            <span className={`rounded-full px-1.5 text-[10px] ${!mostrarPai ? "bg-white/20" : "bg-slate-100"}`}>{contagem.proprios}</span>
          </button>

          <button
            type="button"
            onClick={() => setMostrarPai((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold transition ${
              mostrarPai
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Adicionar os compromissos da agenda superior"
          >
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            {mostrarPai ? "Com" : "Adicionar"} {room.parent?.name || "agenda superior"}
            <span className={`rounded-full px-1.5 text-[10px] ${mostrarPai ? "bg-amber-100" : "bg-slate-100"}`}>{contagem.pais}</span>
          </button>

          {incluirFilhos && (
            <button
              type="button"
              onClick={() => setMostrarFilhas((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-bold transition ${
                mostrarFilhas
                  ? "border-sky-300 bg-sky-50 text-sky-800"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              Das filhas
              <span className={`rounded-full px-1.5 text-[10px] ${mostrarFilhas ? "bg-sky-100" : "bg-slate-100"}`}>{contagem.filhas}</span>
            </button>
          )}

          {mostrarPai && contagem.pais > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 font-semibold text-amber-700">
              <span className="h-2.5 w-5 rounded-sm bg-amber-300 ring-1 ring-amber-400" />
              {room.parent?.name || "agenda superior"}
            </span>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto w-full p-4 space-y-8">
        <div className="relative group"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /><input type="text" placeholder="Pesquisar um evento..." className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[700px]">
            <Calendar localizer={localizer} events={filteredEvents} view={view} onView={setView} date={currentDate} onNavigate={setCurrentDate} components={{ toolbar: CustomToolbar, event: CustomEvent }} onSelectEvent={setSelectedEvent} culture="pt-BR" messages={{ noEventsInRange: "Sem eventos nesta data.", showMore: total => `+${total} mais` }} popup={true} style={{ height: 680 }} className="p-4" />
        </div>
        <section className="animate-in slide-in-from-bottom duration-500"><div className="flex items-center justify-between mb-4 px-2"><h2 className="text-xl font-black text-slate-800">Resumo de {format(currentDate, 'MMMM', {locale: ptBR})}</h2><span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{monthEvents.length} eventos</span></div>{monthEvents.length > 0 ? (<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{monthEvents.map((ev, idx) => (<div key={idx} onClick={() => setSelectedEvent(ev)} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group flex items-center gap-4"><div className="flex flex-col items-center justify-center min-w-[50px] h-[50px] rounded-xl bg-slate-50 text-slate-400 group-hover:bg-blue-50"><span className="text-lg font-black leading-none text-slate-600 group-hover:text-blue-600">{format(ev.start, 'dd')}</span><span className="text-[10px] font-bold uppercase">{format(ev.start, 'EEE', {locale: ptBR})}</span></div><div className="flex-1 min-w-0"><h4 className="font-bold text-slate-900 truncate group-hover:text-blue-600">{ev.title}</h4><div className="flex items-center gap-3 mt-1 text-slate-500 text-xs font-medium"><span className="flex items-center gap-1"><Clock size={12}/> {ev.allDay ? rotuloDiaTodo(ev.start, ev.end) : horaSP(ev.start)}</span>{ev.resource.origem === 'pai' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">{ev.resource.roomName}</span>}{ev.resource.origem === 'filho' && <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold text-sky-800">{ev.resource.roomName}</span>}</div></div><ChevronRight size={18} className="text-slate-300 group-hover:text-blue-400" /></div>))}</div>) : (<div className="bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center"><p className="text-slate-400 font-bold">Nenhum evento programado para este mês.</p></div>)}</section>
      </main>

      {selectedEvent && (<div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}><div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden" onClick={e => e.stopPropagation()}><div className="h-2 w-full" style={{backgroundColor: selectedEvent.resource.color}}></div><div className="p-8"><div className="flex justify-between items-start mb-6"><h2 className="text-2xl font-black text-slate-900 leading-tight">{selectedEvent.title}</h2>{selectedEvent.resource?.origem === 'pai' && (<span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800"><span className="h-2 w-2 rounded-full bg-amber-400" />{selectedEvent.resource.roomName}</span>)}{selectedEvent.resource?.origem === 'filho' && (<span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[10px] font-bold text-sky-800"><span className="h-2 w-2 rounded-full bg-sky-400" />{selectedEvent.resource.roomName}</span>)}<button onClick={() => setSelectedEvent(null)} className="text-slate-400 hover:text-slate-700 bg-slate-100 p-2 rounded-full"><X size={20}/></button></div><div className="space-y-6"><div className="flex items-start gap-4 text-slate-600 bg-slate-50 p-4 rounded-2xl"><Clock className="text-blue-500 mt-1" size={24}/><div><p className="font-black text-slate-800 capitalize">{format(selectedEvent.start, "EEEE, d 'de' MMMM", {locale: ptBR})}</p><p className="text-sm font-bold text-slate-500">{selectedEvent.allDay ? `${rotuloDiaTodo(selectedEvent.start, selectedEvent.end)} · ${rotuloPeriodoDiaTodo(selectedEvent.start, selectedEvent.end)}` : `${horaSP(selectedEvent.start)} até ${horaSP(selectedEvent.end)}`}</p></div></div>{selectedEvent.description && (<div className="flex items-start gap-4 text-slate-600 px-2"><AlignLeft className="text-slate-400 mt-1" size={24}/><p className="text-sm leading-relaxed">{selectedEvent.description}</p></div>)}<div className="flex items-center gap-4 text-slate-600 px-2 pt-4 border-t border-slate-100"><MapPin className="text-slate-400" size={24}/><span className="text-sm font-black text-slate-700">{selectedEvent.resource.roomName || room.name}</span></div></div><button onClick={() => setSelectedEvent(null)} className="w-full mt-8 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition shadow-lg">Fechar</button></div></div></div>)}

      {/* MODAL AGENDA SEMANAL */}
      {isWeekOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start md:items-center justify-center p-3 md:p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl p-4 md:p-6 my-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekAnchor((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; })} className="p-2 rounded-full hover:bg-slate-100" title="Semana anterior"><ChevronLeft size={18}/></button>
                <button onClick={() => setWeekAnchor(new Date())} className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-lg">Hoje</button>
                <button onClick={() => setWeekAnchor((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; })} className="p-2 rounded-full hover:bg-slate-100" title="Próxima semana"><ChevronRight size={18}/></button>
              </div>
              <h2 className="text-sm md:text-base font-black text-slate-800 order-first w-full md:order-none md:w-auto">Semana de {tituloDaSemana()}</h2>
              <button onClick={() => setIsWeekOpen(false)} className="text-slate-400 hover:text-slate-700 p-2 rounded-full bg-slate-100"><X size={18}/></button>
            </div>

            <div ref={weekRef} className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="px-4 py-3 border-b bg-slate-50 flex items-baseline justify-between gap-2">
                <span className="font-black text-slate-800">{room.name}</span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Agenda da semana</span>
              </div>
              {eventosDaSemana.some((ev) => ev.resource?.origem === 'pai') && (
                <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-1.5">
                  <span className="h-2.5 w-5 rounded-sm bg-amber-300 ring-1 ring-amber-400" />
                  <span className="text-[10px] font-bold text-amber-800">
                    {[...new Set(eventosDaSemana.filter((ev) => ev.resource?.origem === 'pai').map((ev) => ev.resource?.roomName).filter(Boolean))].join(' / ')}
                  </span>
                </div>
              )}
              <div className="divide-y divide-slate-100">
                {semana.map((dia) => {
                  const doDia = eventosDoDia(dia);
                  const hoje = chaveDiaSP(dia) === chaveDiaSP(new Date());
                  return (
                    <div key={chaveDiaSP(dia)} className={`grid grid-cols-[92px_1fr] gap-3 px-3 md:px-4 py-3 ${hoje ? 'bg-blue-50/50' : ''}`}>
                      <div className="leading-tight">
                        <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{dataSP(dia, { weekday: 'short' })}</div>
                        <div className={`text-lg font-black ${hoje ? 'text-blue-600' : 'text-slate-800'}`}>{format(dia, 'dd/MM')}</div>
                      </div>
                      <div className="grid gap-1.5 min-w-0">
                        {doDia.length === 0 && <span className="text-xs text-slate-400 italic py-1">Sem eventos</span>}
                        {doDia.map((ev) => (
                          <div key={`${ev.id}-${chaveDiaSP(dia)}`} className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${ev.resource?.origem === 'pai' ? 'border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/70' : 'border-slate-100'}`}>
                            <span className="mt-0.5 h-2.5 w-2.5 flex-none rounded-full" style={{ backgroundColor: ev.resource?.color || '#3b82f6' }} />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-800 truncate">{ev.title}</div>
                              <div className="text-[10px] text-slate-500 font-medium">
                                {ev.allDay ? rotuloDiaTodo(ev.start, ev.end) : `${horaSP(ev.start)}–${horaSP(ev.end)}`}
                                {ev.resource?.roomName && ev.resource.isExternal && (
                                  <span className={ev.resource?.origem === 'pai' ? 'font-bold text-amber-700' : 'font-semibold text-sky-700'}>
                                    {' · '}{ev.resource.roomName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <button onClick={baixarPDFDaSemana} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-3 py-2.5 text-xs font-bold hover:bg-blue-700 transition"><FileText size={16}/> PDF</button>
              <button onClick={baixarJPGDaSemana} disabled={weekGenerating} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white px-3 py-2.5 text-xs font-bold hover:bg-emerald-700 transition disabled:opacity-50"><Download size={16}/> {weekGenerating ? 'Gerando…' : 'JPG'}</button>
              <button onClick={copiarTextoDaSemana} className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2.5 text-xs font-bold hover:bg-slate-700 transition"><AlignLeft size={16}/> {textoCopiado ? 'Copiado!' : 'Copiar texto'}</button>
              <button onClick={abrirWhatsApp} className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] text-white px-3 py-2.5 text-xs font-bold hover:bg-[#1ebe5b] transition"><Share2 size={16}/> WhatsApp</button>
            </div>
            <button onClick={baixarTextoDaSemana} className="mt-2 w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-600">
              Baixar texto (.txt)
            </button>
          </div>
        </div>
      )}

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