"use client";

import { useState, useTransition } from "react";
import {
  criarPrograma,
  enviarConfirmacaoAvulsa,
  enviarSolicitacao,
  entrarNoPrograma,
  definirDepartamentosDaCongregacao,
  decidirSolicitacao,
  sincronizarCongregacoesDoPrograma,
} from "./actions";

const campo =
  "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none";
const botao =
  "bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 disabled:opacity-50 transition-all";

function Mensagem({ estado }) {
  if (!estado) return null;
  if (estado.error) return <p className="text-sm text-red-600 font-bold">{estado.error}</p>;
  return <p className="text-sm text-green-700 font-bold">Salvo com sucesso.</p>;
}

// Copia o link do programa para compartilhar com as congregações.
export function BotaoCopiar({ caminho, rotulo = "Copiar link" }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const url = `${window.location.origin}${caminho}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copie o link:", url);
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  }

  return (
    <button type="button" onClick={copiar} className={botao}>
      {copiado ? "Link copiado!" : rotulo}
    </button>
  );
}

// Adiciona ao programa as congregações do setor que ainda não estão nele.
export function BotaoSincronizarCongregacoes({ programId }) {
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        className={botao}
        onClick={() =>
          startTransition(async () => setEstado(await sincronizarCongregacoesDoPrograma(programId)))
        }
      >
        {pending ? "Sincronizando…" : "Sincronizar congregações"}
      </button>
      {estado?.error && <span className="text-sm font-bold text-red-600">{estado.error}</span>}
      {estado?.success && (
        <span className="text-sm font-bold text-green-700">
          {estado.adicionadas === 0 && (estado.removidas ?? 0) === 0
            ? "As congregações já estão em dia."
            : [
                estado.adicionadas > 0 ? `${estado.adicionadas} incluída(s)` : null,
                estado.removidas > 0 ? `${estado.removidas} removida(s)` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </span>
      )}
    </div>
  );
}

// Formulário de criação do programa, promovido por uma sala setor/ministério escolhida.
export function FormCriarPrograma({ salas }) {
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    startTransition(async () => {
      const r = await criarPrograma(formData);
      setEstado(r);
      if (r.success) form.reset();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-3">
      <label className="text-xs font-bold text-slate-600">Sala promotora (setor ou ministério)
        <select name="parentRoomId" required defaultValue="" className={campo}>
          <option value="" disabled>Selecione a sala</option>
          {salas.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-600">Título do programa
        <input name="name" required placeholder="Ex.: o título que o setor escolher" className={campo} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-slate-600">Início
          <input name="startsAt" type="date" required className={campo} />
        </label>
        <label className="text-xs font-bold text-slate-600">Fim
          <input name="endsAt" type="date" required className={campo} />
        </label>
      </div>
      <label className="text-xs font-bold text-slate-600">Prazo para solicitações (opcional — vale até o fim do dia)
        <input name="deadline" type="date" className={campo} />
      </label>
      
      <input name="regions" required placeholder="Regiões (ex.: 1, 2, 3 ou A, B, C)" className={campo} />
      <input name="departments" required placeholder="Departamentos (ex.: UMADEB, CREIO, UMADEB+CREIO)" className={campo} />
      <textarea name="criteria" rows={2} placeholder="Critérios de aceite (opcional)" className={campo} />
      <div className="flex items-center gap-3">
        <button disabled={pending} className={botao}>Criar programa</button>
        <Mensagem estado={estado} />
      </div>
    </form>
  );
}

// Confirmação avulsa, sem programa e sem prazo.
export function FormAvulso({ salas }) {
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    const formData = new FormData();
    formData.set("roomId", dados.get("roomId") ?? "");
    formData.set("title", dados.get("title") ?? "");
    formData.set("start", `${dados.get("data")}T${dados.get("inicio")}`);
    formData.set("end", `${dados.get("data")}T${dados.get("fim")}`);
    startTransition(async () => {
      const r = await enviarConfirmacaoAvulsa(formData);
      setEstado(r);
      if (r.success) form.reset();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-3">
      <label className="text-xs font-bold text-slate-600">Sala solicitante
        <select name="roomId" required defaultValue="" className={campo}>
          <option value="" disabled>Selecione a sala</option>
          {salas.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </label>
      <input name="title" placeholder="Título do evento" className={campo} />
      <input name="data" type="date" required className={campo} />
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-bold text-slate-600">Início
          <input name="inicio" type="time" defaultValue="19:00" required className={campo} />
        </label>
        <label className="text-xs font-bold text-slate-600">Término
          <input name="fim" type="time" defaultValue="21:00" required className={campo} />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={botao}>Enviar ao setor</button>
        <Mensagem estado={estado} />
      </div>
    </form>
  );
}

// Congregação entra no programa escolhendo sua região.
export function FormEntrarPrograma({ inviteCode, roomId, regioes, rotulo = "Aderir ao programa" }) {
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function enviar(e) {
    e.preventDefault();
    const regionId = new FormData(e.currentTarget).get("regionId");
    startTransition(async () => {
      setEstado(await entrarNoPrograma(inviteCode, roomId, String(regionId)));
    });
  }

  return (
    <form onSubmit={enviar} className="flex items-center gap-3 flex-wrap">
      <select name="regionId" required className={campo + " max-w-xs"} defaultValue="">
        <option value="" disabled>Selecione a região</option>
        {regioes.map((r) => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>
      <button disabled={pending} className={botao}>{rotulo}</button>
      <Mensagem estado={estado} />
    </form>
  );
}

// Congregação escolhe quais departamentos terá no programa.
export function FormDepartamentos({ programId, roomId, departamentos, selecionados }) {
  const [marcados, setMarcados] = useState(new Set(selecionados));
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function alternar(id) {
    setMarcados((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function salvar() {
    startTransition(async () => {
      setEstado(await definirDepartamentosDaCongregacao(programId, roomId, [...marcados]));
    });
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {departamentos.map((d) => (
          <label key={d.id} className="flex items-center gap-2 text-sm border rounded-lg px-3 py-2 bg-white">
            <input type="checkbox" checked={marcados.has(d.id)} onChange={() => alternar(d.id)} />
            {d.name}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={pending} className={botao}>Salvar departamentos</button>
        <Mensagem estado={estado} />
      </div>
    </div>
  );
}

// Solicitação de data para um departamento (padrão 19h–21h).
export function FormSolicitacao({ programId, roomId, departamento, dataInicial = "" }) {
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function enviar(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const dados = new FormData(form);
    const formData = new FormData();
    formData.set("programId", programId);
    formData.set("roomId", roomId);
    formData.set("departmentId", departamento.id);
    formData.set("title", dados.get("title") ?? "");
    formData.set("start", `${dados.get("data")}T${dados.get("inicio")}`);
    formData.set("end", `${dados.get("data")}T${dados.get("fim")}`);
    startTransition(async () => {
      const r = await enviarSolicitacao(formData);
      setEstado(r);
      if (r.success) form.reset();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-2 border rounded-xl p-4 bg-white">
      <p className="font-bold text-slate-800">{departamento.name}</p>
      <input name="title" placeholder="Título (opcional)" className={campo} />
      <div className="grid grid-cols-3 gap-2">
        <input name="data" type="date" required defaultValue={dataInicial} className={campo} />
        <input name="inicio" type="time" defaultValue="19:00" required className={campo} />
        <input name="fim" type="time" defaultValue="21:00" required className={campo} />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={botao}>Solicitar data</button>
        <Mensagem estado={estado} />
      </div>
      {estado?.avisos?.length > 0 && (
        <p className="text-xs text-amber-700">
          Atenção: {estado.avisos.length} outra(s) congregação(ões) de outra região tem festividade neste dia. A solicitação foi enviada.
        </p>
      )}
    </form>
  );
}

// Pedido direto na célula da grade: só horário (padrão 19h–21h) e um clique.
export function FormRapido({ programId, roomId, departamento, dia, onConcluido, onCancelar }) {
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function enviar(e) {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    const formData = new FormData();
    formData.set("programId", programId);
    formData.set("roomId", roomId);
    formData.set("departmentId", departamento.id);
    formData.set("title", "");
    formData.set("start", `${dia}T${dados.get("inicio")}`);
    formData.set("end", `${dia}T${dados.get("fim")}`);
    startTransition(async () => {
      const r = await enviarSolicitacao(formData);
      setEstado(r);
      if (r.success) onConcluido?.(r);
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-1.5 rounded-lg border border-blue-300 bg-blue-50 p-2">
      <div className="flex items-center gap-1">
        <input name="inicio" type="time" defaultValue="19:00" required className="w-full rounded border px-1 py-0.5 text-xs" />
        <span className="text-xs text-slate-500">–</span>
        <input name="fim" type="time" defaultValue="21:00" required className="w-full rounded border px-1 py-0.5 text-xs" />
      </div>
      <div className="flex gap-1">
        <button disabled={pending} className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-60">
          {pending ? "Enviando…" : "Pedir"}
        </button>
        <button type="button" onClick={onCancelar} className="rounded border px-2 py-1 text-xs text-slate-600">
          ✕
        </button>
      </div>
      <Mensagem estado={estado} />
    </form>
  );
}

// Botões de decisão do setor sobre uma solicitação.
export function BotaoDecisao({ requestId }) {
  const [motivo, setMotivo] = useState("");
  const [estado, setEstado] = useState(null);
  const [pending, startTransition] = useTransition();

  function decidir(decisao) {
    startTransition(async () => {
      setEstado(await decidirSolicitacao(requestId, decisao, motivo));
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => decidir("aprovar")} disabled={pending} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50">Aprovar</button>
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (se rejeitar)" className="border rounded-lg px-2 py-1.5 text-sm" />
      <button onClick={() => decidir("rejeitar")} disabled={pending} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50">Rejeitar</button>
      <Mensagem estado={estado} />
    </div>
  );
}
