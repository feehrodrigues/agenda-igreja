const ATIVAS = ["enviada", "em_analise", "aprovada"];

const pct = (parte, total) => (total === 0 ? 0 : Math.round((parte / total) * 100));

// Cruza congregações, departamentos escolhidos e pedidos ativos para mostrar quem falta.
export function calcularProgresso({ filhos, salasFora = [], pedidos, departamentos }) {
  const ativos = pedidos.filter((p) => ATIVAS.includes(p.status));
  const temPedido = (salaId, depId) => ativos.some((p) => p.roomId === salaId && p.departmentId === depId);

  const congregacoes = filhos.map((c) => {
    const esperados = c.departments.map((d) => d.departmentId);
    const enviados = esperados.filter((depId) => temPedido(c.roomId, depId));
    const faltando = c.departments
      .filter((d) => !temPedido(c.roomId, d.departmentId))
      .map((d) => d.department.name);
    let situacao = "completo";
    if (esperados.length === 0) situacao = "sem_departamentos";
    else if (enviados.length === 0) situacao = "nao_enviou";
    else if (faltando.length > 0) situacao = "parcial";
    return {
      roomId: c.roomId,
      nome: c.room.name,
      regiao: c.region?.name ?? "Sem região",
      situacao,
      faltando,
      esperados: esperados.length,
      enviados: enviados.length,
    };
  });

  const porDepartamento = departamentos.map((dep) => {
    const participantes = filhos.filter((c) => c.departments.some((d) => d.departmentId === dep.id));
    const enviaram = participantes.filter((c) => temPedido(c.roomId, dep.id));
    const aprovadas = ativos.filter((p) => p.departmentId === dep.id && p.status === "aprovada").length;
    return {
      id: dep.id,
      nome: dep.name,
      participantes: participantes.length,
      enviaram: enviaram.length,
      aprovadas,
      faltam: participantes.filter((c) => !temPedido(c.roomId, dep.id)).map((c) => c.room.name),
      percentual: pct(enviaram.length, participantes.length),
    };
  });

  const nomesRegioes = [...new Set(congregacoes.map((c) => c.regiao))].sort();
  const porRegiao = nomesRegioes.map((nome) => {
    const lista = congregacoes.filter((c) => c.regiao === nome);
    const esperados = lista.reduce((s, c) => s + c.esperados, 0);
    const enviados = lista.reduce((s, c) => s + c.enviados, 0);
    return {
      nome,
      congregacoes: lista.length,
      completas: lista.filter((c) => c.situacao === "completo").length,
      esperados,
      enviados,
      percentual: pct(enviados, esperados),
    };
  });

  const totalEsperado = congregacoes.reduce((s, c) => s + c.esperados, 0);
  const totalEnviado = congregacoes.reduce((s, c) => s + c.enviados, 0);

  return {
    congregacoes,
    porDepartamento,
    porRegiao,
    naoEntraram: salasFora,
    totalEsperado,
    totalEnviado,
    percentual: pct(totalEnviado, totalEsperado),
  };
}

// Diz ao setor qual é a próxima ação mais útil neste momento.
export function proximoPasso({ progresso, pendentes, prazoVencido, totalFilhos }) {
  if (totalFilhos === 0) {
    return {
      tom: "info",
      texto: "Nenhuma congregação vinculada ainda. Inclua as congregações para começar.",
      aba: "congregacoes",
    };
  }
  if (pendentes > 0) {
    return { tom: "alerta", texto: `${pendentes} pedido(s) aguardando sua decisão.`, aba: "pedidos" };
  }
  const semResposta = progresso.congregacoes.filter((c) => c.situacao !== "completo").length;
  if (semResposta > 0) {
    return {
      tom: prazoVencido ? "alerta" : "info",
      texto: `${semResposta} congregação(ões) ainda não enviaram tudo${prazoVencido ? " e o prazo já passou" : ""}.`,
      aba: "progresso",
    };
  }
  return { tom: "ok", texto: "Todas as congregações enviaram e não há pedidos pendentes.", aba: "grade" };
}
