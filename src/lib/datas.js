// Utilidades de data/hora com fuso fixo de Brasília.
// O servidor (Vercel) roda em UTC; sem isso, horários "19:00" viram "22:00".
export const FUSO = "America/Sao_Paulo";
export const OFFSET = "-03:00";

// "2026-11-20" no fuso de Brasília.
export function chaveDiaSP(data) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("sv-SE", { timeZone: FUSO });
}

export function horaSP(data) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dataSP(data, opcoes = {}) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { timeZone: FUSO, ...opcoes });
}

export function dataHoraSP(data, opcoes = {}) {
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", {
    timeZone: FUSO,
    dateStyle: "short",
    timeStyle: "short",
    ...opcoes,
  });
}

// Chave "YYYY-MM-DD" → meia-noite em Brasília (03:00Z).
export function inicioDoDiaSP(chave) {
  return new Date(`${String(chave).slice(0, 10)}T00:00:00${OFFSET}`);
}

// Soma dias a uma chave "YYYY-MM-DD" sem depender do fuso do servidor.
export function somarDiasChave(chave, dias) {
  const [ano, mes, dia] = String(chave).slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

// Dia seguinte (fim exclusivo, convenção de calendário para "dia todo").
export function fimExclusivoSP(chaveFimInclusivo) {
  return inicioDoDiaSP(somarDiasChave(chaveFimInclusivo, 1));
}

// Converte o fim exclusivo de um evento "dia todo" no último dia visível.
export function ultimoDiaInclusivo(chaveFimExclusivo) {
  return somarDiasChave(chaveFimExclusivo, -1);
}

// Aceita "2026-11-20", "2026-11-20T19:00", ISO completo...
// Datas sem fuso são interpretadas como horário de Brasília.
export function parseDataSP(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return new Date(`${texto}T00:00:00${OFFSET}`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(texto)) {
    return new Date(`${texto}${OFFSET}`);
  }
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Valores para inputs (sempre no fuso de Brasília).
export function valorDataInput(data) {
  return chaveDiaSP(data);
}

export function valorDataHoraInput(data) {
  const chave = chaveDiaSP(data);
  return `${chave}T${horaSP(data)}`;
}

// Rótulo curto de um período de dia inteiro: "20 nov" ou "20 – 22 nov".
export function rotuloPeriodoDiaTodo(inicio, fimExclusivo) {
  const primeira = chaveDiaSP(inicio);
  const ultima = ultimoDiaInclusivo(chaveDiaSP(fimExclusivo));
  if (!primeira || !ultima) return "";
  if (primeira === ultima) return dataSP(inicio, { day: "2-digit", month: "short" });
  const mesmaAno = primeira.slice(0, 4) === ultima.slice(0, 4);
  const fim = dataSP(inicioDoDiaSP(ultima), {
    day: "2-digit",
    month: "short",
    ...(mesmaAno ? {} : { year: "numeric" }),
  });
  return `${dataSP(inicio, { day: "2-digit", month: "short" })} – ${fim}`;
}

// "Dia todo" (1 dia) / "3 dias · dia todo" (vários).
export function rotuloDiaTodo(inicio, fimExclusivo) {
  const dias = Math.max(
    1,
    Math.round(
      (inicioDoDiaSP(chaveDiaSP(fimExclusivo)).getTime() -
        inicioDoDiaSP(chaveDiaSP(inicio)).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );
  return dias <= 1 ? "Dia todo" : `${dias} dias · dia todo`;
}
