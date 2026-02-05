"use client";
import { useState, useMemo } from 'react';
import AdminCalendar from './AdminCalendar';
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
  Search
} from 'lucide-react';

export default function RoomDashboard({ room, initialEvents, categories, allParents, childrenRooms, stats }) {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'analytics', 'hierarchy'
  const [searchTerm, setSearchTerm] = useState("");

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
      {/* SIDEBAR MINI / NAV SUPERIOR */}
      <div className="flex-none bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                    {room.name.charAt(0)}
                </div>
                <span className="font-black text-slate-800 hidden md:block">{room.name}</span>
            </div>
            
            <nav className="flex gap-1">
                <button 
                    onClick={() => setActiveTab('calendar')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'calendar' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <CalIcon size={18} /> Agenda
                </button>
                <button 
                    onClick={() => setActiveTab('analytics')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'analytics' ? 'bg-purple-50 text-purple-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <LayoutDashboard size={18} /> Dashboard
                </button>
                <button 
                    onClick={() => setActiveTab('hierarchy')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition ${activeTab === 'hierarchy' ? 'bg-emerald-50 text-emerald-600' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Users size={18} /> Congregações
                </button>
            </nav>
        </div>
        
        <div className="flex items-center gap-3">
             <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">ID: {room.inviteCode}</span>
        </div>
      </div>

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

        {activeTab === 'analytics' && (
          <div className="p-8 h-full overflow-y-auto custom-scrollbar">
            <div className="max-w-7xl mx-auto space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card title="Eventos este Mês" value={stats.totalEventsMonth} icon={TrendingUp} color="bg-blue-500" />
                <Card title="Filiais Ativas" value={childrenRooms.length} icon={MapPin} color="bg-emerald-500" />
                <Card title="Categorias Utilizadas" value={categories.length} icon={PieChart} color="bg-purple-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Distribuição de Categorias */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 mb-6">Frequência por Categoria</h3>
                  <div className="space-y-4">
                    {stats.categoryDistribution.map(cat => (
                      <div key={cat.name}>
                        <div className="flex justify-between text-sm font-bold mb-1">
                          <span className="text-slate-700">{cat.name}</span>
                          <span className="text-slate-500">{cat.count}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                                width: `${(cat.count / stats.totalEventsMonth) * 100}%`,
                                backgroundColor: cat.color 
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Congregações */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-black text-slate-900 mb-6">Atividade das Congregações</h3>
                  <div className="divide-y divide-slate-100">
                    {stats.childrenActivity.sort((a,b) => b.count - a.count).slice(0, 5).map((child, i) => (
                      <div key={child.name} className="py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">{i+1}</span>
                          <div>
                            <p className="font-bold text-slate-900">{child.name}</p>
                            <p className="text-xs text-slate-400 font-medium">{child.group}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-black text-blue-600">{child.count}</span>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Eventos</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
function GroupManagerCard({ child, parentId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [group, setGroup] = useState(child.group || "");

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
          <MapPin size={24} />
        </div>
        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${group ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
          {group || "Sem Grupo"}
        </span>
      </div>
      
      <h4 className="font-black text-slate-900 text-lg mb-1">{child.name}</h4>
      <p className="text-xs text-slate-400 font-bold mb-6">Sincronizado via {child.type}</p>

      {isEditing ? (
        <form action={async (formData) => {
          await setChildRoomGroup(formData);
          setIsEditing(false);
        }} className="space-y-3">
          <input type="hidden" name="childRoomId" value={child.id} />
          <input type="hidden" name="parentRoomId" value={parentId} />
          <input 
            name="group"
            autoFocus
            className="w-full p-2 text-sm border-2 border-blue-500 rounded-lg outline-none"
            placeholder="Ex: Região Norte"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-blue-600 text-white text-xs font-bold py-2 rounded-lg">Salvar</button>
            <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-slate-100 text-slate-500 text-xs font-bold py-2 rounded-lg">Sair</button>
          </div>
        </form>
      ) : (
        <button 
          onClick={() => setIsEditing(true)}
          className="w-full py-2 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold border border-slate-100 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2"
        >
          <Target size={14} /> Definir Grupo / Região
        </button>
      )}
    </div>
  );
}