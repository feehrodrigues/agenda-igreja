"use client";
import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import AdminCalendar from './AdminCalendar';
import Festividades from './Festividades';
import { setChildRoomGroup } from '@/app/actions';
import { PartyPopper } from 'lucide-react';
import { 
  LayoutDashboard, 
  Calendar as CalIcon, 
  Users, 
  TrendingUp, 
  PieChart, 
  MapPin, 
  ChevronRight,
  Plus,
  Target,
  Search,
  ArrowLeft
} from 'lucide-react';

// Aviso discreto: mostra só o que a congregação precisa saber agora.
function textoAviso(p) {
  if (p.pendentes > 0) return `${p.pendentes} pedido(s) aguardando decisão do setor.`;
  if (p.prazo && new Date(p.prazo) < new Date()) return "Prazo encerrado — use a confirmação avulsa se precisar.";
  if (p.prazo) return `Você pode pedir datas até ${new Date(p.prazo).toLocaleDateString('pt-BR')}.`;
  return "Abra a grade para pedir suas datas.";
}

export default function RoomDashboard({ room, initialEvents, categories, allParents, childrenRooms, stats, festividades, abaInicial }) {
  const [activeTab, setActiveTab] = useState(abaInicial === 'festividades' ? 'festividades' : 'calendar'); // 'calendar', 'analytics', 'hierarchy', 'festividades'
  const [searchTerm, setSearchTerm] = useState("");
  const [avisoDispensado, setAvisoDispensado] = useState(false);
  const avisos = festividades?.participacoes ?? [];

  // Estilização de Cards
  const Card = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 mt-1">{value}</h3>
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={24} className="text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-slate-50 flex flex-col overflow-hidden">
      {/* BARRA SUPERIOR / NAVEGAÇÃO */}
      <div className="flex-none border-b border-slate-200 bg-white px-3 py-2 sm:px-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
                onClick={() => window.location.href = '/dashboard'}
                className="flex items-center justify-center text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition active:scale-95"
                title="Voltar"
                aria-label="Voltar"
            >
                <ArrowLeft size={18} />
            </button>
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-blue-600 font-bold text-white">
              {room.name.charAt(0)}
            </div>
            <span className="min-w-0 truncate font-black text-slate-800">{room.name}</span>
          </div>

          <nav className="grid grid-cols-4 gap-1 md:flex md:items-center md:gap-1">
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${activeTab === 'calendar' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <CalIcon size={18} /> Agenda
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${activeTab === 'analytics' ? 'bg-purple-50 text-purple-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard size={18} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${activeTab === 'hierarchy' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Users size={18} /> Congregações
            </button>
            <button
              onClick={() => setActiveTab('festividades')}
              className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-bold transition md:flex-row md:gap-2 md:px-4 md:py-2 md:text-sm ${activeTab === 'festividades' ? 'bg-amber-50 text-amber-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <PartyPopper size={18} /> Programas
            </button>
          </nav>

          <span className="hidden flex-none rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-400 lg:block">
            ID: {room.inviteCode}
          </span>
        </div>
      </div>

      {!avisoDispensado && avisos.length > 0 && activeTab !== 'festividades' && (
        <div className="flex-none px-4 pt-3">
          <div className="max-w-7xl mx-auto rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-amber-50 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-2 text-violet-700">
              <PartyPopper size={18} />
              <span className="text-sm font-black">Programas</span>
            </div>
            <div className="flex-1 min-w-0 grid gap-1">
              {avisos.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-x-2 text-xs md:text-sm">
                  <span className="font-black text-slate-800">{p.name}</span>
                  <span className="text-slate-600">{textoAviso(p)}</span>
                  <Link
                    href={`/programas/convite/${p.inviteCode}?roomId=${room.id}`}
                    className="font-bold text-blue-600 hover:underline whitespace-nowrap"
                  >
                    Abrir grade →
                  </Link>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAvisoDispensado(true)}
              aria-label="Dispensar aviso"
              className="text-slate-400 hover:text-slate-700 text-xl leading-none px-1"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* CONTEÚDO DINÂMICO */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'calendar' && (
          <AdminCalendar 
            room={room} 
            initialEvents={initialEvents} 
            categories={categories} 
            allParents={allParents} 
            childrenRooms={childrenRooms} 
          />
        )}

        {activeTab === 'festividades' && (
          <Festividades
            room={room}
            programas={festividades.programas}
            participacoes={festividades.participacoes}
            avulsas={festividades.avulsas}
            ehGestor={festividades.ehGestor}
            ehPai={festividades.ehPai}
          />
        )}

        {activeTab === 'analytics' && (
          <div className="p-4 sm:p-6 md:p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900">Dashboard do setor</h2>
                  <p className="text-sm text-slate-500 font-medium">
                    Visão geral de {room.name} e das congregações vinculadas.
                  </p>
                </div>
                <Link
                  href={`/${room.slug}`}
                  target="_blank"
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:text-blue-600"
                >
                  Ver agenda pública
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <Card title="Eventos no mês" value={stats.totalEventsMonth ?? 0} icon={TrendingUp} color="bg-blue-500" />
                <Card title="Próximos 7 dias" value={stats.upcoming7 ?? 0} icon={CalIcon} color="bg-indigo-500" />
                <Card title="Dia todo no mês" value={stats.allDayMonth ?? 0} icon={PartyPopper} color="bg-amber-500" />
                <Card title="Congregações" value={childrenRooms.length} icon={MapPin} color="bg-emerald-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Regiões */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900">Por região</h3>
                    <Link href="/dashboard" className="text-xs font-bold text-blue-600 hover:underline">
                      Diretórios →
                    </Link>
                  </div>
                  {(!stats.regions || stats.regions.length === 0) && (
                    <p className="text-sm text-slate-500">Nenhuma congregação com região definida ainda.</p>
                  )}
                  <div className="space-y-3">
                    {(stats.regions ?? []).map((r) => {
                      const maior = Math.max(1, ...(stats.regions ?? []).map((x) => x.eventos));
                      return (
                        <div key={r.regiao}>
                          <div className="flex justify-between text-sm font-bold mb-1">
                            <span className="text-slate-700">{r.regiao}</span>
                            <span className="text-slate-500">
                              {r.salas} sala{r.salas === 1 ? "" : "s"} · {r.eventos} evento{r.eventos === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${(r.eventos / maior) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Categorias */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-4">Frequência por categoria</h3>
                  {(!stats.categoryDistribution || stats.categoryDistribution.length === 0) && (
                    <p className="text-sm text-slate-500">Nenhuma categoria criada ainda.</p>
                  )}
                  <div className="space-y-3">
                    {(stats.categoryDistribution ?? []).map((cat) => {
                      const maior = Math.max(1, ...(stats.categoryDistribution ?? []).map((c) => c.count));
                      return (
                        <div key={cat.name}>
                          <div className="flex justify-between text-sm font-bold mb-1">
                            <span className="text-slate-700">{cat.name}</span>
                            <span className="text-slate-500">{cat.count}</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${(cat.count / maior) * 100}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Atividade das congregações */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-4">Atividade das congregações</h3>
                  {stats.childrenActivity.length === 0 && (
                    <p className="text-sm text-slate-500">Nenhuma congregação vinculada.</p>
                  )}
                  <div className="divide-y divide-slate-100">
                    {[...stats.childrenActivity].sort((a, b) => b.count - a.count).slice(0, 8).map((child, i) => (
                      <div key={child.id ?? child.name} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-7 h-7 flex-none rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-500">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{child.name}</p>
                            <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                              <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: child.color ?? "#94a3b8" }} />
                              {child.group}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-none">
                          <span className="text-lg font-black text-blue-600">{child.count}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">eventos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Programas do setor */}
                <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900">Programas</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('festividades')}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Abrir →
                    </button>
                  </div>
                  {festividades?.programas?.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {festividades.programas.slice(0, 5).map((p) => (
                        <Link
                          key={p.id}
                          href={`/programas/${p.id}`}
                          className="flex items-center justify-between gap-3 py-3 hover:bg-slate-50/60 -mx-2 px-2 rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{p.name}</p>
                            <p className="text-xs text-slate-500">{p.participantes} sala(s) participando</p>
                          </div>
                          <span
                            className={`flex-none rounded-full px-2 py-1 text-[10px] font-black ${
                              p.pendentes > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {p.pendentes > 0 ? `${p.pendentes} pendente(s)` : "em dia"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">
                      Nenhum programa promovido por este setor. Crie um na aba Programas.
                    </p>
                  )}
                  {festividades?.avulsas?.length > 0 && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      {festividades.avulsas.length} confirmação(ões) avulsa(s) aguardando.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'hierarchy' && (
          <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Gestão de Congregações</h2>
                  <p className="text-slate-500 font-medium">Organize suas filiais em grupos para facilitar o repasse de eventos.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                   <div className="relative flex-1 md:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Buscar filial..." 
                        className="w-full pl-10 pr-4 py-2 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                   </div>
                </div>
              </div>

              {/* Grid de Grupos */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {/* Aqui o usuário gerencia os grupos */}
                 {childrenRooms.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())).map(child => (
                   <GroupManagerCard key={child.id} child={child} parentId={room.id} />
                 ))}

                 {childrenRooms.length === 0 && (
                   <div className="col-span-full py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <MapPin size={40} />
                      </div>
                      <h3 className="text-xl font-bold text-slate-800">Nenhuma congregação vinculada</h3>
                      <p className="text-slate-500 max-w-xs mx-auto mt-2">As congregações que selecionarem "{room.name}" como Agenda Pai aparecerão aqui.</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Componente Auxiliar para o Card de Gestão de Grupo
const CORES_REGIAO = ["#6366f1", "#0d9488", "#d97706", "#db2777", "#0284c7", "#7c3aed", "#65a30d", "#dc2626"];

function GroupManagerCard({ child, parentId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [group, setGroup] = useState(child.group || "");
  const [cor, setCor] = useState(child.groupColor || CORES_REGIAO[0]);
  const [erro, setErro] = useState("");
  const [salvo, setSalvo] = useState(false);
  const [pendente, iniciarTransicao] = useTransition();

  function salvar(e) {
    e.preventDefault();
    setErro("");
    iniciarTransicao(async () => {
      const dados = new FormData();
      dados.append("childRoomId", child.id);
      dados.append("parentRoomId", parentId);
      dados.append("group", group);
      dados.append("groupColor", cor);
      const resultado = await setChildRoomGroup(dados);
      if (resultado?.error) {
        setErro(resultado.error);
        return;
      }
      setGroup(resultado?.group ?? group);
      setCor(resultado?.groupColor ?? cor);
      setIsEditing(false);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: group ? cor : "#e2e8f0" }}
        >
          <MapPin size={24} />
        </div>
        <span
          className="px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1.5"
          style={group ? { backgroundColor: `${cor}1a`, color: cor } : { backgroundColor: "#f1f5f9", color: "#94a3b8" }}
        >
          {group && <i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cor }} />}
          {group || "Sem região"}
        </span>
      </div>

      <h4 className="font-black text-slate-900 text-lg mb-1">{child.name}</h4>
      <p className="text-xs text-slate-400 font-bold mb-4">Sincronizado via {child.type}</p>

      {(erro || salvo) && (
        <p className={`mb-3 text-xs font-bold ${erro ? "text-rose-600" : "text-emerald-600"}`}>
          {erro || "Região salva!"}
        </p>
      )}

      {isEditing ? (
        <form onSubmit={salvar} className="space-y-3">
          <input
            name="group"
            autoFocus
            className="w-full p-2 text-sm border-2 border-blue-500 rounded-lg outline-none"
            placeholder="Ex: Região Norte"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <div>
            <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Cor da região
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CORES_REGIAO.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCor(c)}
                  title={c}
                  aria-label={`Cor ${c}`}
                  className={`h-7 w-7 rounded-full border-2 transition ${cor === c ? "border-slate-900 scale-110" : "border-white"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={pendente} className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-60">
              {pendente ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 text-slate-500 text-xs font-bold py-2 rounded-lg">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsEditing(true)}
          className="w-full py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
        >
          <Target size={14} /> {group ? "Alterar região e cor" : "Definir região"}
        </button>
      )}
    </div>
  );
}