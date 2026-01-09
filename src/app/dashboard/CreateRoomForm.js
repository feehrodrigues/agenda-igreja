"use client";
import { useState, useMemo } from 'react';
import { createRoom } from '../actions';
import { Search, ChevronDown, Check } from 'lucide-react';

export default function CreateRoomForm({ allParentRooms }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filtra a lista de pais baseado no que o usuário digita
  const filteredParents = useMemo(() => {
    return allParentRooms.filter(room => 
      room.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allParentRooms, searchTerm]);

  const selectedParentName = allParentRooms.find(p => p.id === selectedParentId)?.name || "-- Nenhuma (Raiz) --";

  const handleSubmit = async (formData) => {
      setIsLoading(true);
      await createRoom(formData); // A action fará o redirect, não precisa desligar o loading
  };

  return (
    <div className="bg-white p-8 rounded-2xl shadow-2xl border border-slate-200">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Nova Agenda</h2>
      <p className="text-sm text-slate-500 mb-8">Crie uma sala para um departamento ou congregação.</p>
      
      <form action={handleSubmit} className="space-y-5">
        <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Nome da Sala</label>
            <input name="name" required placeholder="Ex: Jovens Setor 1" className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-lg text-black font-semibold focus:border-blue-500 outline-none transition-colors" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Tipo</label>
                <select name="type" className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-lg text-black font-semibold outline-none appearance-none">
                    <option value="congregacao">Congregação</option>
                    <option value="setor">Setor</option>
                    <option value="ministerio">Ministério</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-bold text-slate-800 mb-2">Cor</label>
                <div className="p-1 border-2 border-slate-200 rounded-lg bg-slate-100">
                    <input type="color" name="color" defaultValue="#6d28d9" className="w-full h-12 cursor-pointer border-none bg-transparent" />
                </div>
            </div>
        </div>

        {/* SELETOR DE PAI COM PESQUISA */}
        <div className="relative">
            <label className="block text-sm font-bold text-slate-800 mb-2">Associar a um Pai (Opcional)</label>
            <input type="hidden" name="parentId" value={selectedParentId} />
            
            <div 
                className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-lg text-black font-semibold cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={selectedParentId ? "text-slate-900" : "text-slate-500"}>{selectedParentName}</span>
                <ChevronDown size={16} className="text-slate-400"/>
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                        <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                            <Search size={14} className="text-slate-400"/>
                            <input 
                                className="bg-transparent outline-none text-sm w-full font-medium"
                                placeholder="Pesquisar setor..."
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="overflow-y-auto custom-scrollbar flex-1">
                        <div 
                            className="px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-500 border-b border-slate-50"
                            onClick={() => { setSelectedParentId(""); setIsOpen(false); }}
                        >
                            -- Nenhuma (Raiz) --
                        </div>
                        {filteredParents.map(parent => (
                            <div 
                                key={parent.id} 
                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors"
                                onClick={() => { setSelectedParentId(parent.id); setIsOpen(false); }}
                            >
                                <div className="w-3 h-3 rounded-full" style={{backgroundColor: parent.color}}></div>
                                <span className="text-sm font-bold text-slate-700">{parent.name}</span>
                                {selectedParentId === parent.id && <Check size={14} className="ml-auto text-blue-600"/>}
                            </div>
                        ))}
                        {filteredParents.length === 0 && <p className="p-4 text-center text-xs text-slate-400">Nenhum encontrado.</p>}
                    </div>
                </div>
            )}
        </div>

        <button type="submit" disabled={isLoading} className="w-full bg-black hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all active:scale-95 mt-4 disabled:opacity-70">
            {isLoading ? "Criando..." : "+ Criar Agenda"}
        </button>
      </form>
    </div>
  );
}