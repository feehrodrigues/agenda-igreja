"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  FolderTree,
  MapPin,
  Search,
  Users,
  Church,
  ExternalLink,
  Settings2,
} from "lucide-react";

const CORES = ["#6366f1", "#0d9488", "#d97706", "#db2777", "#0284c7", "#7c3aed", "#65a30d", "#dc2626"];

const TIPO = {
  ministerio: { nome: "Ministério", icone: Building2 },
  setor: { nome: "Setor", icone: FolderTree },
  congregacao: { nome: "Congregação", icone: Church },
  igreja: { nome: "Igreja", icone: Building2 },
};

function tipoInfo(tipo) {
  return TIPO[String(tipo ?? "").toLowerCase()] ?? { nome: tipo ?? "Sala", icone: MapPin };
}

function corDaRegiao(nome, cor, indice) {
  return cor || CORES[indice % CORES.length];
}

// Filtra a árvore mantendo os caminhos até os resultados.
function filtrar(no, termo) {
  const nome = no.name.toLocaleLowerCase("pt-BR");
  const combina = nome.includes(termo);
  const filhos = (no.children ?? [])
    .map((filho) => filtrar(filho, termo))
    .filter(Boolean);
  if (!combina && filhos.length === 0) return null;
  return { ...no, children: combina ? no.children : filhos };
}

function nodesRaiz(nodes, termo) {
  if (!termo) return nodes;
  const t = termo.toLocaleLowerCase("pt-BR").trim();
  return nodes.map((no) => filtrar(no, t)).filter(Boolean);
}

function SalaNo({ no, nivel, abertos, alternar, forcado }) {
  const info = tipoInfo(no.type);
  const Icone = info.icone;
  const filhos = no.children ?? [];
  const temFilhos = filhos.length > 0;
  const aberto = forcado || abertos.has(no.id);

  // Agrupa os filhos pela região definida pelo pai (no.group do filho).
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const filho of filhos) {
      const nome = (filho.group ?? "").trim();
      if (!mapa.has(nome)) mapa.set(nome, { nome, cor: filho.groupColor, salas: [] });
      mapa.get(nome).salas.push(filho);
    }
    return [...mapa.entries()]
      .map(([nome, dados], i) => ({ nome, ...dados, cor: corDaRegiao(nome, dados.cor, i) }))
      .sort((a, b) => {
        if (!a.nome) return 1;
        if (!b.nome) return -1;
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [filhos]);

  const temRegioes = grupos.some((g) => g.nome);

  return (
    <div className={nivel > 0 ? "border-l border-slate-200 pl-3 sm:pl-4" : ""}>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm transition hover:shadow-md">
        {temFilhos ? (
          <button
            type="button"
            onClick={() => alternar(no.id)}
            className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
            aria-label={aberto ? `Fechar ${no.name}` : `Abrir ${no.name}`}
            aria-expanded={aberto}
          >
            <ChevronRight size={16} className={`transition-transform ${aberto ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="h-8 w-8 flex-none" />
        )}

        <span
          className="grid h-9 w-9 flex-none place-items-center rounded-lg text-white"
          style={{ backgroundColor: no.color || "#3b82f6" }}
        >
          <Icone size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-black text-slate-800">{no.name}</span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-slate-500">
              {info.nome}
            </span>
          </div>
          <span className="block truncate text-[11px] font-medium text-slate-400">/{no.slug}</span>
        </div>

        <div className="flex flex-none gap-1">
          <Link
            href={`/${no.slug}`}
            target="_blank"
            title="Ver agenda pública"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-600"
          >
            <ExternalLink size={15} />
          </Link>
          <Link
            href={`/dashboard/${no.slug}`}
            title="Gerenciar esta sala"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-600"
          >
            <Settings2 size={13} /> Gerenciar
          </Link>
        </div>
      </div>

      {temFilhos && aberto && (
        <div className="mt-2 grid gap-2">
          {temRegioes
            ? grupos.map((grupo) => (
                <div key={grupo.nome || "sem-regiao"} className="grid gap-1.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: grupo.cor }} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {grupo.nome || "Sem região"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      · {grupo.salas.length} sala{grupo.salas.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {grupo.salas.map((filho) => (
                      <SalaNo
                        key={filho.id}
                        no={filho}
                        nivel={nivel + 1}
                        abertos={abertos}
                        alternar={alternar}
                        forcado={forcado}
                      />
                    ))}
                  </div>
                </div>
              ))
            : filhos.map((filho) => (
                <SalaNo
                  key={filho.id}
                  no={filho}
                  nivel={nivel + 1}
                  abertos={abertos}
                  alternar={alternar}
                  forcado={forcado}
                />
              ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardDirectory({ roots }) {
  const [termo, setTermo] = useState("");
  const [abertos, setAbertos] = useState(() => new Set(roots.map((r) => r.id)));
  const buscando = termo.trim().length > 0;
  const lista = useMemo(() => nodesRaiz(roots, termo), [roots, termo]);

  function alternar(id) {
    setAbertos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  const total = useMemo(() => {
    let n = 0;
    const contar = (no) => {
      n += 1;
      (no.children ?? []).forEach(contar);
    };
    roots.forEach(contar);
    return n;
  }, [roots]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-slate-900">
            <FolderTree size={20} className="text-blue-600" /> Diretórios
          </h2>
          <p className="text-sm text-slate-500">
            {total} sala(s) na sua organização · abra por ministério/setor, região e congregação.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Buscar sala, congregação…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      {lista.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
          <Users className="mx-auto mb-2 text-slate-300" size={32} />
          <p className="font-bold text-slate-600">
            {buscando ? "Nenhuma sala encontrada para essa busca." : "Nenhuma agenda por aqui ainda."}
          </p>
          {!buscando && <p className="mt-1 text-sm text-slate-500">Crie uma sala ou entre por código.</p>}
        </div>
      )}

      <div className="grid gap-3">
        {lista.map((no) => (
          <SalaNo
            key={no.id}
            no={no}
            nivel={0}
            abertos={abertos}
            alternar={alternar}
            forcado={buscando}
          />
        ))}
      </div>
    </section>
  );
}
