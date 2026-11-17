import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AtualizacaoAutomatica, GradeSolicitacoes, ROTULO_STATUS } from "../../painel";
import { FormDepartamentos, FormEntrarPrograma } from "../../formularios";
import { montarGrade, solicitacoesDoPrograma } from "@/lib/festividades/grade";
import { congregacoesAbaixo } from "@/lib/festividades/salas";

const prisma = new PrismaClient();
const ABAS = [
  { id: "grade", rotulo: "Grade" },
  { id: "minhas", rotulo: "Minhas solicitações" },
  { id: "aprovadas", rotulo: "Festividades aprovadas" },
  { id: "configuracoes", rotulo: "Minha congregação" },
];

const fmtData = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const fmtPrazo = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtHora = (d) =>
  new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function ConvitePrograma({ params, searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { code } = await params;
  const { roomId: roomIdParam, aba = "grade" } = await searchParams;

  const programa = await prisma.program.findUnique({
    where: { inviteCode: code },
    include: {
      regions: { orderBy: { name: "asc" } },
      departments: { where: { active: true }, orderBy: { name: "asc" } },
      children: {
        include: { region: true, room: true, departments: { include: { department: true } } },
      },
      requests: { include: { room: true, department: true }, orderBy: { start: "asc" } },
    },
  });
  if (!programa) redirect("/dashboard");

  // Só congregações participam do programa.
  programa.children = programa.children.filter((c) => c.room.type === "congregacao");

  let roomId = roomIdParam;
  // Congregações abaixo do setor/ministerio (o convite é para elas).
  const todasSalas = await prisma.room.findMany({
    select: { id: true, name: true, type: true, parentId: true },
  });
  const idsCongregacoes = congregacoesAbaixo(todasSalas, programa.parentRoomId).map((s) => s.id);

  if (!roomId) {
    const minhasSalas = await prisma.member.findMany({
      where: { userId, roomId: { in: idsCongregacoes } },
      select: { roomId: true },
    });
    const dentroDoPrograma = minhasSalas.filter((s) =>
      programa.children.some((c) => c.roomId === s.roomId),
    );
    const candidatas = dentroDoPrograma.length > 0 ? dentroDoPrograma : minhasSalas;
    if (candidatas.length !== 1) redirect("/dashboard");
    redirect(`/programas/convite/${code}?roomId=${candidatas[0].roomId}`);
  }

  const salaUsuario = roomId
    ? await prisma.member.findFirst({ where: { userId, roomId } })
    : null;
  if (!salaUsuario) redirect("/dashboard");

  const sala = await prisma.room.findUnique({ where: { id: roomId } });
  const filho = programa.children.find((c) => c.roomId === roomId) ?? null;
  const departamentosEscolhidos = filho ? filho.departments.map((d) => d.departmentId) : [];
  const podeSolicitar = filho ? departamentosEscolhidos : [];

  const solicitacoes = solicitacoesDoPrograma(programa);
  const grade = montarGrade({ programa, solicitacoes, idSalaAtual: roomId });
  const minhas = programa.requests.filter((r) => r.roomId === roomId);
  const aprovadas = programa.requests.filter((r) => r.status === "aprovada");
  const abaAtiva = ABAS.some((a) => a.id === aba) ? aba : "grade";
  const pendentes = minhas.filter((r) => ["enviada", "em_analise"].includes(r.status));

  const prazoPassou = programa.deadline && new Date(programa.deadline) < new Date();

  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 md:p-8 md:pb-24 font-sans text-slate-900">
      <AtualizacaoAutomatica />
      <div className="max-w-7xl mx-auto grid gap-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link href={`/dashboard/${sala.slug}?aba=festividades`} className="text-sm font-bold text-blue-600 hover:underline">
              ← {sala.name}
            </Link>
            <h1 className="text-2xl font-black mt-1">{programa.name}</h1>
            <p className="text-sm text-slate-500">
              {sala?.name} · {fmtData(programa.startsAt)} a {fmtData(programa.endsAt)}
              {programa.deadline && ` · prazo: ${fmtPrazo(programa.deadline)}`}
            </p>
          </div>
          {!filho && (
            <span className="rounded-lg bg-amber-100 text-amber-800 px-3 py-2 text-sm font-bold">
              Sua congregação ainda não entrou no programa
            </span>
          )}
          {prazoPassou && (
            <span className="rounded-lg bg-slate-200 text-slate-700 px-3 py-2 text-sm font-bold">
              Prazo encerrado
            </span>
          )}
        </header>

        <nav className="flex gap-1 border-b overflow-x-auto">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={`/programas/convite/${code}?roomId=${roomId}&aba=${a.id}`}
              className={`px-4 py-2 text-sm font-bold whitespace-nowrap border-b-2 -mb-px ${
                abaAtiva === a.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {a.rotulo}
              {a.id === "minhas" && pendentes.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-xs px-1.5">{pendentes.length}</span>
              )}
            </Link>
          ))}
        </nav>

        {abaAtiva === "grade" && (
          <>
            {filho && podeSolicitar.length === 0 && (
              <p className="text-sm text-amber-700">
                Escolha seus departamentos na aba “Minha congregação” para poder pedir datas.
              </p>
            )}
            <GradeSolicitacoes
              grade={grade}
              programId={programa.id}
              roomId={filho ? roomId : null}
              podeSolicitar={podeSolicitar}
              regiaoAtual={filho?.region?.name ?? null}
              regioes={programa.regions}
            />
          </>
        )}

        {abaAtiva === "minhas" && (
          <section className="bg-white rounded-2xl border p-5 grid gap-3">
            <h2 className="font-black">Pedidos da minha congregação</h2>
            {minhas.length === 0 && <p className="text-sm text-slate-500">Nenhum pedido ainda. Use a grade para pedir uma data.</p>}
            {minhas.map((r) => (
              <div key={r.id} className="border rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2">
                <span className="font-bold">{r.department?.name ?? "—"}</span>
                <span className="text-sm text-slate-600">
                  {fmtHora(r.start)} · {ROTULO_STATUS[r.status] ?? r.status}
                  {r.reason && <span className="block text-rose-600">Motivo: {r.reason}</span>}
                </span>
              </div>
            ))}
          </section>
        )}

        {abaAtiva === "aprovadas" && (
          <section className="bg-white rounded-2xl border p-5 grid gap-3">
            <h2 className="font-black">Festividades aprovadas</h2>
            {aprovadas.length === 0 && <p className="text-sm text-slate-500">Nenhuma festividade aprovada ainda.</p>}
            {aprovadas.map((r) => (
              <div key={r.id} className="border rounded-xl px-4 py-3 flex flex-wrap justify-between gap-2">
                <span className="font-bold">
                  {r.room.name} · {r.department?.name ?? "—"}
                </span>
                <span className="text-sm text-slate-600">{fmtHora(r.start)}</span>
              </div>
            ))}
          </section>
        )}

        {abaAtiva === "configuracoes" && (
          <section className="bg-white rounded-2xl border p-5 grid gap-6 md:grid-cols-2">
            {(!filho || !filho.region) && (
              <div className="grid gap-2">
                <h2 className="font-black">{filho ? "Definir minha região" : "Entrar no programa"}</h2>
                <p className="text-sm text-slate-500">
                  {filho
                    ? "Sua congregação já está no programa. Falta só informar a região."
                    : "Sua congregação ainda não está no programa."}
                </p>
                <FormEntrarPrograma
                  inviteCode={code}
                  roomId={roomId}
                  regioes={programa.regions}
                  rotulo={filho ? "Salvar região" : "Aderir ao programa"}
                />
              </div>
            )}
            {filho && (
              <>
                {filho.region && (
                  <div className="grid gap-2">
                    <h2 className="font-black">Região</h2>
                    <p className="text-sm">{filho.region.name}</p>
                  </div>
                )}
                <div className="grid gap-2">
                  <h2 className="font-black">Departamentos que vão festejar</h2>
                  <FormDepartamentos
                    programId={programa.id}
                    roomId={roomId}
                    departamentos={programa.departments}
                    selecionados={departamentosEscolhidos}
                  />
                </div>
              </>
            )}
          </section>
        )}
      </div>
      <Link
        href={`/dashboard/${sala.slug}?aba=festividades`}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-slate-700"
      >
        ← Voltar
      </Link>
    </div>
  );
}
