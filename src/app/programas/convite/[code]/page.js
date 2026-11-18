import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AtualizacaoAutomatica, GradeSolicitacoes, ROTULO_STATUS } from "../../painel";
import { FormDepartamentos, FormEntrarPrograma } from "../../formularios";
import { CabecalhoPrograma } from "../../CabecalhoPrograma";
import { montarGrade, solicitacoesDoPrograma } from "@/lib/festividades/grade";
import { carregarAgendaDaSala } from "@/lib/festividades/agenda";
import { filhosDiretos } from "@/lib/festividades/salas";

const prisma = new PrismaClient();
const ABAS = [
  { id: "grade", rotulo: "Grade" },
  { id: "minhas", rotulo: "Meus pedidos" },
  { id: "aprovadas", rotulo: "Festividades aprovadas" },
  { id: "configuracoes", rotulo: "Minha sala" },
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

  let roomId = roomIdParam;
  // Salas filhas do criador do programa (setores ou congregações).
  const todasSalas = await prisma.room.findMany({
    select: { id: true, name: true, type: true, parentId: true },
  });
  const idsFilhos = filhosDiretos(todasSalas, programa.parentRoomId).map((s) => s.id);

  if (!roomId) {
    const minhasSalas = await prisma.member.findMany({
      where: { userId, roomId: { in: idsFilhos } },
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
  const agendaPai = await carregarAgendaDaSala(
    prisma,
    programa.parentRoomId,
    programa.startsAt,
    programa.endsAt,
  );
  const minhas = programa.requests.filter((r) => r.roomId === roomId);
  const aprovadas = programa.requests.filter((r) => r.status === "aprovada");
  const abaAtiva = ABAS.some((a) => a.id === aba) ? aba : "grade";
  const pendentes = minhas.filter((r) => ["enviada", "em_analise"].includes(r.status));

  const prazoPassou = programa.deadline && new Date(programa.deadline) < new Date();

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans text-slate-900">
      <AtualizacaoAutomatica />
      <CabecalhoPrograma sala={sala} titulo="Programa" />
      <div className="mx-auto grid min-w-0 max-w-7xl gap-4 p-3 sm:p-4 md:gap-5 md:p-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black sm:text-2xl">{programa.name}</h1>
            <p className="text-sm text-slate-500">
              {sala?.name} · {fmtData(programa.startsAt)} a {fmtData(programa.endsAt)}
              {programa.deadline && ` · prazo: ${fmtPrazo(programa.deadline)}`}
            </p>
          </div>
          {!filho && (
            <span className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-bold text-amber-800">
              Sua sala ainda não entrou no programa
            </span>
          )}
          {prazoPassou && (
            <span className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
              Prazo encerrado
            </span>
          )}
        </header>

        <nav className="-mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={`/programas/convite/${code}?roomId=${roomId}&aba=${a.id}`}
              className={`px-3 py-2 text-sm font-bold whitespace-nowrap border-b-2 -mb-px sm:px-4 ${
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
                Escolha seus departamentos na aba “Minha sala” para poder pedir datas.
              </p>
            )}
            <GradeSolicitacoes
              grade={grade}
              programId={programa.id}
              roomId={filho ? roomId : null}
              podeSolicitar={podeSolicitar}
              regiaoAtual={filho?.region?.name ?? null}
              regioes={programa.regions}
              agendaPai={agendaPai}
            />
          </>
        )}

        {abaAtiva === "minhas" && (
          <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-5">
            <h2 className="font-black">Pedidos da minha sala</h2>
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
          <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-5">
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
          <section className="grid gap-6 rounded-2xl border bg-white p-4 sm:p-5 md:grid-cols-2">
            {(!filho || !filho.region) && (
              <div className="grid gap-2">
                <h2 className="font-black">{filho ? "Definir minha região" : "Entrar no programa"}</h2>
                <p className="text-sm text-slate-500">
                  {filho
                    ? "Sua sala já está no programa. Falta só informar a região."
                    : "Sua sala ainda não está no programa."}
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
    </div>
  );
}
