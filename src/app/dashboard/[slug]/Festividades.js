"use client";
import Link from "next/link";
import { BotaoDecisao, FormAvulso, FormCriarPrograma } from "../../programas/formularios";

const fmt = (d) => new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
const fmtHora = (d) =>
  new Date(d).toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });

// Aba "Programas" dentro da sala: o setor promove programas, a congregação participa deles.
export default function Programas({ room, programas, participacoes, avulsas, ehGestor, ehSetor }) {
  const temSetor = !!room.parentId;
  return (
    <div className="h-full overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto grid gap-6">
        <header>
          <h2 className="text-2xl font-black text-slate-900">Programas</h2>
          <p className="text-sm text-slate-500">
            {ehSetor
              ? `Programas de agendamento (com título próprio) promovidos por ${room.name}.`
              : "Programas do seu setor ou ministério. Abra um programa para alocar suas datas na grade."}
          </p>
        </header>

        {ehSetor && (
          <section className="bg-white rounded-2xl border p-6 grid gap-4">
            <h3 className="font-black">Programas desta sala</h3>
            {programas.length === 0 && <p className="text-sm text-slate-500">Nenhum programa criado ainda.</p>}
            <div className="grid gap-2">
              {programas.map((p) => (
                <Link
                  key={p.id}
                  href={`/programas/${p.id}`}
                  className="flex flex-wrap justify-between items-center gap-2 border rounded-lg px-4 py-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      {fmt(p.startsAt)} a {fmt(p.endsAt)} · {p.congregacoes} congregação(ões)
                      {p.pendentes > 0 && ` · ${p.pendentes} pedido(s) aguardando`}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-600">Abrir grade →</span>
                </Link>
              ))}
            </div>
            {ehGestor && (
              <details className="border-t pt-4">
                <summary className="cursor-pointer font-bold text-sm">+ Criar novo programa</summary>
                <div className="pt-4">
                  <FormCriarPrograma salas={[{ id: room.id, name: room.name }]} />
                </div>
              </details>
            )}
          </section>
        )}

        {ehSetor && (
          <section className="bg-white rounded-2xl border p-6 grid gap-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-black">Confirmações avulsas</h3>
                <p className="text-sm text-slate-500">
                  Eventos das congregações que precisam da sua confirmação, fora de programa e sem prazo.
                </p>
              </div>
              {avulsas.length > 0 && (
                <span className="text-xs font-bold rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">
                  {avulsas.length} aguardando
                </span>
              )}
            </div>
            {avulsas.length === 0 && <p className="text-sm text-slate-500">Nenhuma confirmação pendente.</p>}
            {avulsas.map((r) => (
              <div key={r.id} className="border rounded-xl p-4 grid gap-2">
                <div className="font-bold">{r.title ?? "Evento sem título"}</div>
                <div className="text-sm text-slate-600">
                  {r.sala} · {fmt(r.start)} às {fmtHora(r.end)} · enviado em {fmt(r.createdAt)}
                </div>
                {ehGestor && <BotaoDecisao requestId={r.id} />}
              </div>
            ))}
          </section>
        )}

        {temSetor && (
          <section className="bg-white rounded-2xl border p-6 grid gap-3">
            <h3 className="font-black">Programas em que {room.name} participa</h3>
            {participacoes.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum ainda. Quando o setor enviar o link do programa, abra-o por aqui.
              </p>
            )}
            {participacoes.map((p) => (
              <Link
                key={p.id}
                href={`/programas/convite/${p.inviteCode}?roomId=${room.id}`}
                className="flex justify-between items-center border rounded-lg px-4 py-3 hover:bg-slate-50"
              >
                <span className="font-bold">{p.name}</span>
                <span className="text-sm font-bold text-blue-600">Abrir grade →</span>
              </Link>
            ))}
          </section>
        )}

        {temSetor && (
          <section className="bg-white rounded-2xl border p-6 grid gap-4">
            <div>
              <h3 className="font-black">Confirmação avulsa ao setor</h3>
              <p className="text-sm text-slate-500">
                Para eventos que precisam de confirmação do setor, fora de programa e sem prazo.
              </p>
            </div>
            <FormAvulso salas={[{ id: room.id, name: room.name }]} />
          </section>
        )}

        {!ehSetor && !temSetor && (
          <p className="text-sm text-slate-500">Esta sala não está associada a um setor ou ministério.</p>
        )}
      </div>
    </div>
  );
}
