// Reconhece datas coladas de uma agenda (texto, lista ou planilha).
// Formatos: 05/02, 05/02/2027, 05-02-27 e 2027-02-05. Sem ano, usa o ano do período.
const deChave = (chave) => new Date(`${chave}T00:00:00Z`);

export function extrairDatas(texto, inicio, fim) {
  const datas = new Set();
  const anos = [...new Set([inicio.slice(0, 4), fim.slice(0, 4)].map(Number))];
  const padrao = /(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/g;
  let fora = 0;
  let achado;

  while ((achado = padrao.exec(String(texto ?? "")))) {
    let ano = null;
    let mes;
    let dia;

    if (achado[1]) {
      ano = Number(achado[1]);
      mes = Number(achado[2]);
      dia = Number(achado[3]);
    } else {
      dia = Number(achado[4]);
      mes = Number(achado[5]);
      if (achado[6]) {
        ano = Number(achado[6]);
        if (ano < 100) ano += 2000;
      }
    }

    let valida = false;
    for (const candidato of ano ? [ano] : anos) {
      const chave = `${candidato}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
      const data = deChave(chave);
      const ehReal =
        data.getUTCFullYear() === candidato &&
        data.getUTCMonth() === mes - 1 &&
        data.getUTCDate() === dia;
      if (ehReal && chave >= inicio && chave <= fim) {
        datas.add(chave);
        valida = true;
        break;
      }
    }
    if (!valida) fora += 1;
  }

  return { datas: [...datas].sort(), fora };
}
