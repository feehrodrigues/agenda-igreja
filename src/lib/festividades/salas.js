// Todas as congregações abaixo de uma sala (filhas, netas...), em qualquer
// profundidade. Setores e ministérios entram na caminhada mas não na lista:
// eles organizam o programa, não pedem datas.
export function congregacoesAbaixo(todas, parentRoomId) {
  const porPai = new Map();
  for (const sala of todas) {
    if (!sala.parentId) continue;
    if (!porPai.has(sala.parentId)) porPai.set(sala.parentId, []);
    porPai.get(sala.parentId).push(sala);
  }

  const resultado = [];
  const visitados = new Set([parentRoomId]);
  const fila = [parentRoomId];

  while (fila.length > 0) {
    const atual = fila.shift();
    for (const filho of porPai.get(atual) ?? []) {
      if (visitados.has(filho.id)) continue;
      visitados.add(filho.id);
      fila.push(filho.id);
      if (!["setor", "ministerio"].includes(filho.type)) resultado.push(filho);
    }
  }

  return resultado;
}
