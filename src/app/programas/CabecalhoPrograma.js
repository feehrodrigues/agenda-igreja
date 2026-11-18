import Link from "next/link";
import { Calendar, Home, PartyPopper } from "lucide-react";

// Cabeçalho das páginas de programa: mantém o mesmo menu da agenda para a página
// não parecer outro site e deixar o caminho de volta (agenda/início) à mão.
export function CabecalhoPrograma({ sala, titulo = "Programas", ativo = "programas" }) {
  const item =
    "flex flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-bold transition sm:flex-row sm:gap-2 sm:px-4 sm:py-2 sm:text-sm";
  const inativo = "text-slate-500 hover:bg-slate-50";
  const selecionado = "bg-amber-50 text-amber-600";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href={`/dashboard/${sala.slug}`} className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-blue-600 font-bold text-white">
              {sala.name.charAt(0)}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black leading-tight text-slate-800">
                {sala.name}
              </span>
              <span className="block truncate text-[10px] font-bold uppercase tracking-widest text-slate-400">
                {titulo}
              </span>
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="flex flex-none items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 sm:hidden"
          >
            <Home size={14} /> Início
          </Link>
        </div>

        <nav className="grid grid-cols-2 gap-1 sm:flex sm:items-center">
          <Link href="/dashboard" className={`${item} ${inativo} hidden sm:flex`}>
            <Home size={18} /> Início
          </Link>
          <Link
            href={`/dashboard/${sala.slug}`}
            className={`${item} ${ativo === "agenda" ? selecionado : inativo}`}
          >
            <Calendar size={18} /> Agenda
          </Link>
          <Link
            href={`/dashboard/${sala.slug}?aba=festividades`}
            className={`${item} ${ativo === "programas" ? selecionado : inativo}`}
          >
            <PartyPopper size={18} /> Programas
          </Link>
        </nav>
      </div>
    </header>
  );
}
