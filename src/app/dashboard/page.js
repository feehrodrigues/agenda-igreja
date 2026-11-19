import { UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import JoinRoomForm from "./JoinRoomForm";
import CreateRoomForm from "./CreateRoomForm";
import DashboardDirectory from "./DashboardDirectory";

const prisma = new PrismaClient();

function montarArvore(salas, raizIds) {
  const porPai = new Map();
  for (const sala of salas) {
    const chave = sala.parentId ?? "__raiz__";
    if (!porPai.has(chave)) porPai.set(chave, []);
    porPai.get(chave).push(sala);
  }
  const construir = (sala) => ({
    ...sala,
    children: (porPai.get(sala.id) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map(construir),
  });
  return raizIds
    .map((id) => salas.find((s) => s.id === id))
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map(construir);
}

export default async function Dashboard() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const [memberships, todasSalas, allParentRooms] = await Promise.all([
    prisma.member.findMany({ where: { userId }, select: { roomId: true } }),
    prisma.room.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        color: true,
        group: true,
        groupColor: true,
        parentId: true,
      },
    }),
    prisma.room.findMany({
      where: { type: { in: ["ministerio", "setor"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  const minhasIds = new Set(memberships.map((m) => m.roomId));
  const porId = new Map(todasSalas.map((s) => [s.id, s]));

  // Raízes: salas em que participo cujo pai (ou avô) não está também nas minhas
  // salas. Assim o diretório começa no nível mais alto que eu administro.
  const raizIds = [];
  for (const sala of todasSalas) {
    if (!minhasIds.has(sala.id)) continue;
    let pai = sala.parentId ? porId.get(sala.parentId) : null;
    let temAncestralMinha = false;
    while (pai) {
      if (minhasIds.has(pai.id)) {
        temAncestralMinha = true;
        break;
      }
      pai = pai.parentId ? porId.get(pai.parentId) : null;
    }
    if (!temAncestralMinha) raizIds.push(sala.id);
  }

  const roots = montarArvore(todasSalas, raizIds);

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
              Navegue por ministérios, setores, regiões e congregações.
            </p>
          </div>

          <DashboardDirectory roots={roots} />
        </div>

        <aside className="h-fit space-y-6 lg:sticky lg:top-24">
          <CreateRoomForm allParentRooms={allParentRooms} />
          <JoinRoomForm />
        </aside>
      </main>
    </div>
  );
}
