"use client";
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createRoom } from '../actions';
import { Search, ChevronDown, Check, Loader2, Plus, ExternalLink } from 'lucide-react';

export default function CreateRoomForm({ allParentRooms }) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedParentId, setSelectedParentId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("congregacao");
  const [color, setColor] = useState("#6d28d9");
  const [isLoading, setIsLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [criada, setCriada] = useState(null);
  const [, iniciar] = useTransition();

  const filteredParents = useMemo(
    () => allParentRooms.filter((room) => room.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [allParentRooms, searchTerm],
  );

  const selectedParentName =
    allParentRooms.find((p) => p.id === selectedParentId)?.name || "-- Nenhuma (Raiz) --";

  function limpar() {
    setName("");
    setType("congregacao");
    setColor("#6d28d9");
    setErro("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (isLoading) return;
    setErro("");
    setCriada(null);
    setIsLoading(true);
    try {
      const dados = new FormData();
      dados.append("name", name);
      dados.append("type", type);
      dados.append("color", color);
      dados.append("parentId", selectedParentId);
      const resultado = await createRoom(dados);
      if (resultado?.error) {
        setErro(resultado.error);
        return;
      }
      limpar();
      setCriada(resultado.room);
      // Atualiza a lista/diretórios sem recarregar a página inteira.
      iniciar(() => router.refresh());
    } catch (err) {
      console.error(err);
      setErro("Não foi possível criar a sala. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl border border-slate-200">
      <h2 className="text-2xl font-black text-slate-900 mb-2">Nova Agenda</h2>
      <p className="text-sm text-slate-500 mb-6">Crie uma sala para um departamento ou congregação.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-800 mb-2">Nome da Sala</label>
          <input
            name="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Jovens Setor 1"
            className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-lg text-black font-semibold focus:border-blue-500 outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Tipo</label>
            <select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-lg text-black font-semibold outline-none appearance-none"
            >
              <option value="congregacao">Congregação</option>
              <option value="setor">Setor</option>
              <option value="ministerio">Ministério</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800 mb-2">Cor</label>
            <div className="p-1 border-2 border-slate-200 rounded-lg bg-slate-100">
              <input
                type="color"
                name="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-12 cursor-pointer border-none bg-transparent"
              />
            </div>
          </div>
        </div>

        {/* SELETOR DE PAI COM PESQUISA */}
        <div className="relative">
          <label className="block text-sm font-bold text-slate-800 mb-2">Associar a um Pai (Opcional)</label>
          <input type="hidden" name="parentId" value={selectedParentId} />

          <button
            type="button"
            className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-lg text-black font-semibold cursor-pointer flex justify-between items-center text-left"
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className={selectedParentId ? "text-slate-900" : "text-slate-500"}>{selectedParentName}</span>
            <ChevronDown size={16} className={`text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
          </button>

          {isOpen && (
            <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col">
              <div className="p-2 border-b border-slate-100 sticky top-0 bg-white">
                <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                  <Search size={14} className="text-slate-400" />
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
                <button
                  type="button"
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-500 border-b border-slate-50"
                  onClick={() => { setSelectedParentId(""); setIsOpen(false); }}
                >
                  -- Nenhuma (Raiz) --
                </button>
                {filteredParents.map((parent) => (
                  <button
                    type="button"
                    key={parent.id}
                    className="w-full px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors text-left"
                    onClick={() => { setSelectedParentId(parent.id); setIsOpen(false); }}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: parent.color }} />
                    <span className="text-sm font-bold text-slate-700">{parent.name}</span>
                    {selectedParentId === parent.id && <Check size={14} className="ml-auto text-blue-600" />}
                  </button>
                ))}
                {filteredParents.length === 0 && (
                  <p className="p-4 text-center text-xs text-slate-400">Nenhum encontrado.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {erro && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {erro}
          </p>
        )}

        {criada && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <p className="font-bold text-emerald-800">Sala “{criada.name}” criada!</p>
            <Link
              href={`/dashboard/${criada.slug}`}
              className="mt-1 inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
            >
              Abrir agenda <ExternalLink size={13} />
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-black hover:bg-slate-800 text-white py-4 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all active:scale-95 mt-2 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Criando…
            </>
          ) : (
            <>
              <Plus size={18} /> Criar Agenda
            </>
          )}
        </button>
        <p className="text-center text-[11px] text-slate-400">
          Pode criar várias salas seguidas: o formulário limpa sozinho.
        </p>
      </form>
    </div>
  );
}
