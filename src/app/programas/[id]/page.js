import { auth } from "@clerk/nextjs/server";
import { PrismaClient } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AtualizacaoAutomatica, GradeSolicitacoes, ROTULO_STATUS } from "../painel";
import { BotaoCopiar, BotaoDecisao, BotaoSincronizarCongregacoes, BotaoSincronizarRegioes, SeletorRegiaoDoFilho } from "../formularios";
import { CabecalhoPrograma } from "../CabecalhoPrograma";
import { EditorDatas } from "../editor-datas";
import { chaveDia, montarGrade, solicitacoesDoPrograma } from "@/lib/festividades/grade";
import { carregarAgendaDaSala } from "@/lib/festividades/agenda";
import { filhosDiretos } from "@/lib/festividades/salas";
import { calcularProgresso, proximoPasso } from "@/lib/festividades/progresso";

const ROTULO_SITUACAO = {
  completo: ["Completo", "bg-emerald-100 text-emerald-800"],
  parcial: ["Parcial", "bg-amber-100 text-amber-800"],
  nao_enviou: ["Não enviou", "bg-red-100 text-red-700"],
  sem_departamentos: ["Sem departamentos", "bg-slate-100 text-slate-600"],
};
const TOM = {
  ok: "bg-emerald-50 border-emerald-300 text-emerald-900",
  info: "bg-blue-50 border-blue-300 text-blue-900",
  alerta: "bg-amber-50 border-amber-400 text-amber-900",
};

const prisma = new PrismaClient();
const ABERTAS = ["enviada", "em_analise"];
const ABAS = [
  { id: "grade", rotulo: "Grade" },
  { id: "datas", rotulo: "Datas" },
  { id: "progresso", rotulo: "Progresso" },
  { id: "pedidos", rotulo: "Pedidos" },
  { id: "congregacoes", rotulo: "Filhos" },
  { id: "configuracoes", rotulo: "Configurações" },
];

const fmtData = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const fmtPrazo = (d) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
const fmtDataHora = (d) =>
  new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const fmtHora = (d) =>
  new Date(d).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export default async function ProgramaSetorPage({ params, searchParams }) {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const { id } = await params;
  const { aba = "grade" } = await searchParams;

  const programa = await prisma.program.findUnique({
    where: { id },
    include: {
      parentRoom: { select: { slug: true, name: true } },
      regions: { orderBy: { name: "asc" } },
      departments: { orderBy: { name: "asc" } },
      children: { include: { region: true, room: true, departments: { include: { department: true } } } },
      requests: { include: { room: true, department: true }, orderBy: { start: "asc" } },
      releasedDays: { orderBy: { date: "asc" } },
    },
  });
  // Só as salas filhas do criador participam do programa (setores ou congregações).
  if (!programa) redirect("/dashboard");

  const membro = await prisma.member.findFirst({
    where: { userId, roomId: programa.parentRoomId },
  });
  if (!membro) redirect("/dashboard");
  const ehGestor = ["OWNER", "ADMIN"].includes(membro.role);

  const solicitacoes = solicitacoesDoPrograma(programa);
  const grade = montarGrade({ programa, solicitacoes });
  const pendentes = programa.requests.filter((r) => ABERTAS.includes(r.status));
  const abaAtiva = ABAS.some((a) => a.id === aba) ? aba : "grade";
  const agendaPai = await carregarAgendaDaSala(
    prisma,
    programa.parentRoomId,
    programa.startsAt,
    programa.endsAt,
  );

  // Informação de decisão: região de cada sala, ordem de chegada e concorrentes no mesmo dia.
  const regiaoPorSala = Object.fromEntries(
    programa.children.map((c) => [c.roomId, c.region?.name ?? "Sem região"]),
  );
  const pedidosAtivos = programa.requests.filter((r) => !["rejeitada", "substituida"].includes(r.status));
  const diasComPedido = [...new Set(pedidosAtivos.map((r) => chaveDia(r.start)))];
  const pendentesOrdenados = [...pendentes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  function concorrentesDe(pedido) {
    const dia = chaveDia(pedido.start);
    return pedidosAtivos
      .filter((r) => r.id !== pedido.id && r.roomId !== pedido.roomId && chaveDia(r.start) === dia)
      .map((r) => ({
        id: r.id,
        sala: r.room.name,
        departamento: r.department?.name ?? "—",
        regiao: regiaoPorSala[r.roomId] ?? "Sem região",
        status: r.status,
        hora: fmtHora(r.start),
        mesmaRegiao: regiaoPorSala[r.roomId] === regiaoPorSala[pedido.roomId],
      }));
  }

  const idsDentro = programa.children.map((c) => c.roomId);
  const todasSalas = await prisma.room.findMany({
    select: { id: true, name: true, type: true, parentId: true },
    orderBy: { name: "asc" },
  });
  const salasFora = filhosDiretos(todasSalas, programa.parentRoomId)
    .filter((s) => !idsDentro.includes(s.id))
    .map((s) => ({ id: s.id, name: s.name }));
  const progresso = calcularProgresso({
    filhos: programa.children,
    salasFora,
    pedidos: programa.requests,
    departamentos: programa.departments.filter((d) => d.active),
  });
  const passo = proximoPasso({
    progresso,
    pendentes: pendentes.length,
    prazoVencido: !!programa.deadline && new Date(programa.deadline) < new Date(),
    totalFilhos: programa.children.length,
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-16 font-sans text-slate-900">
      <AtualizacaoAutomatica />
      <CabecalhoPrograma sala={programa.parentRoom} titulo="Programa" />
      <div className="mx-auto grid min-w-0 max-w-7xl gap-4 p-3 sm:p-4 md:gap-5 md:p-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black sm:text-2xl">{programa.name}</h1>
            <p className="text-sm text-slate-500">
              {fmtData(programa.startsAt)} a {fmtData(programa.endsAt)}
              {programa.deadline && ` · prazo para pedidos: ${fmtPrazo(programa.deadline)}`}
            </p>
          </div>
          <div className="grid w-full grid-cols-3 gap-2 text-center sm:flex sm:w-auto sm:gap-4">
            <Indicador rotulo="Filhos" valor={programa.children.length} />
            <Indicador rotulo="Aguardando" valor={pendentes.length} destaque={pendentes.length > 0} />
            <Indicador
              rotulo="Aprovadas"
              valor={programa.requests.filter((r) => r.status === "aprovada").length}
            />
          </div>
        </header>

        <nav className="-mx-3 flex gap-1 overflow-x-auto border-b px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0">
          {ABAS.map((a) => (
            <Link
              key={a.id}
              href={`/programas/${programa.id}?aba=${a.id}`}
              className={`px-3 py-2 text-sm font-bold whitespace-nowrap border-b-2 -mb-px sm:px-4 ${
                abaAtiva === a.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {a.rotulo}
              {a.id === "pedidos" && pendentes.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-xs px-1.5">{pendentes.length}</span>
              )}
            </Link>
          ))}
        </nav>

        <Link
          href={`/programas/${programa.id}?aba=${passo.aba}`}
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${TOM[passo.tom]}`}
        >
          Próximo passo: {passo.texto} →
        </Link>

        {abaAtiva === "progresso" && (
          <div className="grid gap-5">
            <section className="bg-white rounded-2xl border p-5 grid gap-2">
              <div className="flex justify-between text-sm font-bold">
                <span>Envio geral</span>
                <span>
                  {progresso.totalEnviado}/{progresso.totalEsperado} pedidos · {progresso.percentual}%
                </span>
              </div>
              <Barra valor={progresso.percentual} />
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-5">
                <h2 className="font-black">Por região</h2>
                {progresso.porRegiao.length === 0 && <p className="text-sm text-slate-500">Sem salas filhas ainda.</p>}
                {progresso.porRegiao.map((r) => (
                  <div key={r.nome} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{r.nome}</span>
                      <span className="text-slate-500">
                        {r.completas}/{r.congregacoes} salas completas · {r.percentual}%
                      </span>
                    </div>
                    <Barra valor={r.percentual} />
                  </div>
                ))}
              </section>

              <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-5">
                <h2 className="font-black">Por departamento</h2>
                {progresso.porDepartamento.map((d) => (
                  <div key={d.id} className="grid gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{d.nome}</span>
                      <span className="text-slate-500">
                        {d.enviaram}/{d.participantes} enviaram · {d.aprovadas} aprovada(s)
                      </span>
                    </div>
                    <Barra valor={d.percentual} />
                    {d.faltam.length > 0 && (
                      <p className="text-xs text-slate-500">Faltam: {d.faltam.join(", ")}</p>
                    )}
                  </div>
                ))}
              </section>
            </div>

            <section className="grid gap-2 rounded-2xl border bg-white p-4 sm:p-5">
              <h2 className="font-black">Salas filhas</h2>
              {progresso.congregacoes.map((c) => {
                const [texto, cor] = ROTULO_SITUACAO[c.situacao];
                return (
                  <div key={c.roomId} className="border rounded-lg px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold">{c.nome}</span>
                      <span className="text-sm text-slate-500"> · {c.regiao}</span>
                      {c.faltando.length > 0 && c.situacao !== "sem_departamentos" && (
                        <div className="text-xs text-slate-500">Falta enviar: {c.faltando.join(", ")}</div>
                      )}
                    </div>
                    <span className={`text-xs font-bold rounded-full px-2 py-1 ${cor}`}>{texto}</span>
                  </div>
                );
              })}
              {progresso.naoEntraram.length > 0 && (
                <div className="mt-2 border border-dashed rounded-lg px-4 py-3 text-sm">
                  <div className="font-bold text-red-700">Ainda não entraram no programa</div>
                  <div className="text-slate-600">{progresso.naoEntraram.map((s) => s.name).join(", ")}</div>
                </div>
              )}
            </section>
          </div>
        )}

        {abaAtiva === "grade" && (
          <GradeSolicitacoes
            grade={grade}
            programId={programa.id}
            regioes={programa.regions}
            agendaPai={agendaPai}
            filhos={programa.children.map((c) => ({
              id: c.roomId,
              name: c.room.name,
              regiao: c.region?.name ?? c.room.group ?? "",
              corRegiao: c.room.groupColor ?? "",
            }))}
            podeAdicionar={ehGestor}
            inicio={new Date(programa.startsAt).toISOString()}
            fim={new Date(programa.endsAt).toISOString()}
            liberadas={programa.releasedDays.map((d) => new Date(d.date).toISOString())}
          />
        )}

        {abaAtiva === "datas" && (
          <div className="grid gap-4">
            {ehGestor ? (
              <EditorDatas
                programId={programa.id}
                inicio={new Date(programa.startsAt).toISOString()}
                fim={new Date(programa.endsAt).toISOString()}
                liberadas={programa.releasedDays.map((d) => new Date(d.date).toISOString())}
                usadas={diasComPedido}
                agenda={agendaPai}
              />
            ) : (
              <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                <h2 className="font-black">Datas liberadas pelo pai</h2>
                <p className="text-sm text-slate-500">
                  Quem define as datas é o pai. Aqui você acompanha o que está liberado para pedir.
                </p>
                {programa.releasedDays.length === 0 ? (
                  <p className="text-sm font-bold text-slate-700">
                    Nenhuma data escolhida: todos os dias do período estão liberados.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {programa.releasedDays.map((d) => (
                      <span
                        key={d.date}
                        className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                      >
                        {fmtData(d.date)}
                      </span>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}

        {abaAtiva === "pedidos" && (
          <div className="grid gap-4">
            {programa.criteria && (
              <section className="rounded-2xl border border-violet-200 bg-violet-50 px-5 py-3">
                <h2 className="text-sm font-black text-violet-900">Critérios do programa</h2>
                <p className="text-sm text-violet-800 whitespace-pre-line">{programa.criteria}</p>
              </section>
            )}
            <section className="bg-white rounded-2xl border p-5 grid gap-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-black">Pedidos aguardando decisão</h2>
                <span className="text-xs text-slate-500">Em ordem de chegada</span>
              </div>
              {pendentesOrdenados.length === 0 && <p className="text-sm text-slate-500">Nenhum pedido pendente.</p>}
              {pendentesOrdenados.map((r, i) => {
                const concorrentes = concorrentesDe(r);
                return (
                  <div key={r.id} className="border rounded-xl p-4 grid gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <span className="flex-none w-7 h-7 rounded-lg bg-slate-100 text-slate-600 grid place-items-center text-xs font-black">
                          #{i + 1}
                        </span>
                        <div>
                          <div className="font-bold">
                            {r.room.name} · {r.department?.name ?? "—"}
                          </div>
                          <div className="text-sm text-slate-600">
                            {fmtDataHora(r.start)} às {fmtHora(r.end)} · {ROTULO_STATUS[r.status] ?? r.status}
                          </div>
                          <div className="text-xs text-slate-500">
                            Região: {regiaoPorSala[r.roomId] ?? "Sem região"} · chegou em {fmtDataHora(r.createdAt)}
                          </div>
                        </div>
                      </div>
                      {ehGestor && <BotaoDecisao requestId={r.id} />}
                    </div>
                    {concorrentes.length > 0 && (
                      <div className="rounded-lg bg-slate-50 border px-3 py-2 grid gap-1">
                        <div className="text-xs font-black text-slate-700">Concorrentes no mesmo dia</div>
                        {concorrentes.map((c) => (
                          <div key={c.id} className="flex flex-wrap items-center gap-x-2 text-xs text-slate-600">
                            <span className="font-bold text-amber-700">
                              {c.mesmaRegiao ? "⚠ Mesma região" : "Outra região"}
                            </span>
                            <span>
                              {c.sala} · {c.departamento} · {c.hora} · {c.regiao}
                            </span>
                            <span className="text-slate-500">{ROTULO_STATUS[c.status] ?? c.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {abaAtiva === "congregacoes" && (
          <div className="grid gap-4">
            <section className="grid gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
              <h2 className="font-black">Link para as salas filhas</h2>
              <p className="text-sm text-slate-600">
                As salas filhas deste programa já entram automaticamente. O link é só um
                atalho para elas abrirem o programa.
              </p>
              <code className="text-xs break-all rounded-lg bg-white border border-blue-100 px-3 py-2">
                /programas/convite/{programa.inviteCode}
              </code>
              <div className="flex flex-wrap items-center gap-3">
                <BotaoCopiar caminho={`/programas/convite/${programa.inviteCode}`} />
                <Link
                  href={`/programas/convite/${programa.inviteCode}`}
                  className="text-sm font-bold text-blue-600 hover:underline"
                >
                  Abrir o link →
                </Link>
              </div>
            </section>

            <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-black">Salas filhas participantes</h2>
                <div className="flex flex-wrap gap-2">
                  <BotaoSincronizarCongregacoes programId={programa.id} />
                  <BotaoSincronizarRegioes programId={programa.id} />
                </div>
              </div>
              <p className="text-sm text-slate-500">
                As regiões vêm configuradas das congregações (menu Congregações). Use
                “Sincronizar regiões” depois de alterar alguma. Duas salas da mesma região
                não podem marcar o mesmo departamento no mesmo dia.
              </p>
              {programa.children.length === 0 && (
                <p className="text-sm text-slate-500">
                  Nenhuma sala filha vinculada ainda. Quando criar uma, use
                  “Sincronizar salas filhas”.
                </p>
              )}
              <div className="grid gap-2">
                {programa.children.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 sm:px-4 sm:py-3">
                    <div className="min-w-0">
                      <div className="truncate font-bold">{c.room.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.departments.map((d) => d.department.name).join(", ") || "Sem departamentos escolhidos"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Região
                      </span>
                      <SeletorRegiaoDoFilho
                        programId={programa.id}
                        roomId={c.roomId}
                        regioes={programa.regions}
                        atual={c.regionId ?? ""}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {abaAtiva === "configuracoes" && (
          <section className="bg-white rounded-2xl border p-5 grid gap-5 md:grid-cols-2">
            <div className="grid gap-2">
              <h2 className="font-black">Regiões</h2>
              {programa.regions.map((r) => (
                <div key={r.id} className="border rounded-lg px-3 py-2 text-sm font-bold">
                  {r.name}
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <h2 className="font-black">Departamentos</h2>
              {programa.departments.map((d) => (
                <div key={d.id} className="border rounded-lg px-3 py-2 text-sm">
                  {d.name}
                  {!d.active && <span className="text-slate-400"> (inativo)</span>}
                </div>
              ))}
            </div>
            <div className="md:col-span-2 text-sm text-slate-500">
              Todos os dias do período disponíveis (sem restrição de formato)
              {programa.criteria && <p className="mt-2">Critérios: {programa.criteria}</p>}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Barra({ valor }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full bg-blue-600" style={{ width: `${valor}%` }} />
    </div>
  );
}

function Indicador({ rotulo, valor, destaque = false }) {
  return (
    <div className={`rounded-xl border bg-white px-2 py-1.5 sm:px-4 sm:py-2 ${destaque ? "border-amber-400" : ""}`}>
      <div className={`text-lg font-black sm:text-xl ${destaque ? "text-amber-600" : ""}`}>{valor}</div>
      <div className="text-[10px] text-slate-500 sm:text-xs">{rotulo}</div>
    </div>
  );
}
