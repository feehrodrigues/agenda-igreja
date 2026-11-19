"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ArrowRight, Church, FolderTree, Building2, MapPin } from "lucide-react";

const ICONES = {
  ministerio: Building2,
  setor: FolderTree,
  congregacao: Church,
  igreja: Building2,
};

function icone(tipo) {
  return ICONES[String(tipo ?? "").toLowerCase()] ?? MapPin;
}

export default function PublicRoomSearch({ rooms }) {
  const [termo, setTermo] = useState("");

  const resultados = useMemo(() => {
    const t = termo.trim().toLocaleLowerCase("pt-BR");
    const lista = t
      ? rooms.filter((r) => r.name.toLocaleLowerCase("pt-BR").includes(t))
      : rooms;
    return lista.slice(0, t ? 40 : 12);
  }, [rooms, termo]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#B9A98F]" />
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Pesquisar sala, setor ou congregação…"
          className="w-full rounded-2xl border border-[#EADCC4] bg-white py-4 pl-12 pr-4 text-base font-medium text-[#3D3630] shadow-lg shadow-[#3d3630]/5 outline-none transition focus:border-[#D2B48C] focus:ring-4 focus:ring-[#D2B48C]/20"
        />
      </div>

      {resultados.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[#F2E8D5] bg-white text-left shadow-xl shadow-[#3d3630]/5">
          {resultados.map((room) => {
            const Icone = icone(room.type);
            return (
              <Link
                key={room.id}
                href={`/${room.slug}`}
                className="flex items-center gap-3 border-b border-[#F7F0E3] px-4 py-3 transition last:border-0 hover:bg-[#FDFBF7]"
              >
                <span
                  className="grid h-9 w-9 flex-none place-items-center rounded-xl text-white"
                  style={{ backgroundColor: room.color || "#3D3630" }}
                >
                  <Icone size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[#3D3630]">{room.name}</span>
                  {room.group && (
                    <span className="block truncate text-[11px] font-semibold text-[#B9A98F]">
                      {room.group}
                    </span>
                  )}
                </span>
                <ArrowRight size={16} className="flex-none text-[#B9A98F]" />
              </Link>
            );
          })}
        </div>
      )}

      {termo.trim() && resultados.length === 0 && (
        <p className="mt-3 text-sm font-medium text-[#7A7167]">
          Nenhuma agenda pública encontrada para “{termo.trim()}”.
        </p>
      )}
    </div>
  );
}
