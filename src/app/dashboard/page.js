import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import JoinRoomForm from "./JoinRoomForm";
import CreateRoomForm from "./CreateRoomForm";

const prisma = new PrismaClient();

const NOMES_TIPO = {
  setor: "Setor",
  ministerio: "Ministério",
  congregacao: "Congregação",
  igreja: "Igreja",
};

function nomeTipo(tipo) {
  return NOMES_TIPO[String(tipo ?? "").toLowerCase()] ?? tipo ?? "Sala";
}

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const memberships = await prisma.member.findMany({
    where: { userId },
    include: {
      room: {
        include: {
          children: {
            orderBy: { name: "asc" },
            select: { id: true, name: true, slug: true, type: true, group: true, color: true },
          },
        },
      },
    },
    orderBy: { room: { name: "asc" } },
  });
  const myRooms = memberships.map((m) => m.room);

  const allParentRooms = await prisma.room.findMany({
    where: { type: { in: ["ministerio", "setor"] } },
    orderBy: { name: "asc" },
  });

  // Diretórios: setores/ministérios primeiro (com suas regiões), depois as
  // congregações soltas em que a pessoa participa diretamente.
  const setores = myRooms.filter((r) => r.children.length > 0);
  const congregacoes = myRooms.filter((r) => r.children.length === 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-black">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white">📅</span>
            <span className="text-lg">Agenda<span className="text-blue-600">Igreja</span></span>
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-10">
        <div className="min-w-0 space-y-8">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Painel de Controle</h1>
            <p className="mt-1 text-sm text-slate-500">
              Navegue por setores, regiões e congregações.
            </p>
          </div>

          {myRooms.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-lg font-bold text-slate-700">Nenhuma agenda encontrada.</p>
              <p className="mt-2 text-sm text-slate-500">Use os formulários ao lado para começar.</p>
            </div>
          )}

          {setores.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                Setores e ministérios
              </h2>
              <div className="grid gap-4">
                {setores.map((setor) => {
                  const regioes = new Map();
                  for (const filho of setor.children) {
                    const chave = filho.group?.trim() || "Sem região";
                    if (!regioes.has(chave)) regioes.set(chave, []);
                    regioes.get(chave).push(filho);
                  }
                  const ordenadas = [...regioes.entries()].sort((a, b) =>
                    a[0].localeCompare(b[0], "pt-BR"),
                  );

                  return (
                    <details
                      key={setor.id}
                      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:shadow-md"
                    >
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-4 hover:bg-slate-50/70 sm:p-5">
                        <span
                          className="grid h-11 w-11 flex-none place-items-center rounded-xl text-sm font-black text-white"
                          style={{ backgroundColor: setor.color }}
                        >
                          {setor.name.charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-black">{setor.name}</h3>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                              {nomeTipo(setor.type)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-slate-500">
                            {setor.children.length} congregaç{setor.children.length === 1 ? "ão" : "ões"} ·{" "}
                            {ordenadas.length} regiã{ordenadas.length === 1 ? "o" : "es"}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400 group-open:hidden">Abrir ▾</span>
                        <span className="hidden text-xs font-bold text-slate-400 group-open:inline">Fechar ▴</span>
                      </summary>

                      <div className="grid gap-4 border-t border-slate-100 p-4 sm:p-5">
                        {ordenadas.map(([regiao, salas]) => (
                          <div key={regiao} className="grid gap-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-indigo-500" />
                              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                                {regiao}
                              </span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {salas.map((sala) => (
                                <div
                                  key={sala.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-slate-800">{sala.name}</p>
                                    <p className="truncate text-[11px] font-medium text-slate-400">/{sala.slug}</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <Link
                                      href={`/${sala.slug}`}
                                      target="_blank"
                                      className="rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-white hover:text-blue-600"
                                    >
                                      Ver
                                    </Link>
                                    <Link
                                      href={`/dashboard/${sala.slug}`}
                                      className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-600"
                                    >
                                      Gerenciar
                                    </Link>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
                        <Link
                          href={`/${setor.slug}`}
                          target="_blank"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-blue-600"
                        >
                          Ver agenda pública
                        </Link>
                        <Link
                          href={`/dashboard/${setor.slug}`}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-600"
                        >
                          Gerenciar {nomeTipo(setor.type).toLowerCase()}
                        </Link>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          )}

          {congregacoes.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">
                Minhas congregações e salas
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {congregacoes.map((room) => (
                  <div
                    key={room.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="h-1.5 w-full" style={{ backgroundColor: room.color }} />
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="min-w-0">
                        <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500">
                          {nomeTipo(room.type)}
                        </span>
                        <h3 className="mt-2 truncate text-lg font-black">{room.name}</h3>
                        <p className="truncate text-xs font-medium text-slate-400">/{room.slug}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2">
                        <Link
                          href={`/${room.slug}`}
                          target="_blank"
                          className="text-xs font-bold text-slate-500 hover:text-blue-600"
                        >
                          Ver site
                        </Link>
                        <Link
                          href={`/dashboard/${room.slug}`}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-blue-600"
                        >
                          Gerenciar ➔
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="h-fit space-y-6 lg:sticky lg:top-24">
          <CreateRoomForm allParentRooms={allParentRooms} />
          <JoinRoomForm />
        </aside>
      </main>
    </div>
  );
}
