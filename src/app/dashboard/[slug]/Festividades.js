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
export default function Programas({ room, programas, participacoes, avulsas, ehGestor, ehPai }) {
  const temPai = !!room.parentId;
  return (
    <div className="h-full overflow-y-auto p-3 sm:p-4 md:p-8">
      <div className="mx-auto grid max-w-4xl gap-4 md:gap-6">
        <header>
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">Programas</h2>
          <p className="text-sm text-slate-500">
            {ehPai
              ? `Programas de agendamento (com título próprio) promovidos por ${room.name}.`
              : "Programas do seu pai (setor ou ministério). Abra um programa para alocar suas datas na grade."}
          </p>
        </header>

        {ehPai && (
          <section className="grid gap-4 rounded-2xl border bg-white p-4 sm:p-6">
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
                      {fmt(p.startsAt)} a {fmt(p.endsAt)} · {p.participantes} sala(s) filha(s)
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

        {ehPai && (
          <section className="grid gap-4 rounded-2xl border bg-white p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="font-black">Confirmações avulsas</h3>
                <p className="text-sm text-slate-500">
                  Eventos das salas filhas que precisam da sua confirmação, fora de programa e sem prazo.
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

        {temPai && (
          <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:p-6">
            <h3 className="font-black">Programas em que {room.name} participa</h3>
            {participacoes.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum ainda. Quando o pai enviar o link do programa, abra-o por aqui.
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

        {temPai && (
          <section className="grid gap-4 rounded-2xl border bg-white p-4 sm:p-6">
            <div>
              <h3 className="font-black">Confirmação avulsa ao pai</h3>
              <p className="text-sm text-slate-500">
                Para eventos que precisam de confirmação do pai (setor ou ministério), fora de programa e sem prazo.
              </p>
            </div>
            <FormAvulso salas={[{ id: room.id, name: room.name }]} />
          </section>
        )}

        {!ehPai && !temPai && (
          <p className="text-sm text-slate-500">Esta sala não está vinculada a um pai (setor ou ministério).</p>
        )}
      </div>
    </div>
  );
}
