// Formatação em pt-BR.
const nf = new Intl.NumberFormat('pt-BR');

export const fmtInt = (n) => nf.format(Math.round(n));

export function fmtPct(n, digits = 2) {
  return (n ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + '%';
}

export function fmtShort(n) {
  if (n >= 1e6) return (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
  if (n >= 1e3) return (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
  return fmtInt(n);
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// "Flavio Nantes" -> "Flavio Nantes" com só a primeira letra maiúscula de cada palavra.
export function title(s) {
  return String(s ?? '').toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase())
    .replace(/\b(Da|De|Do|Dos|Das|E)\b/g, (m) => m.toLowerCase());
}
