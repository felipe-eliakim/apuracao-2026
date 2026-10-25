// Cor de cada partido. Os dois que disputam o 2º turno usam a cor de sempre
// (PT vermelho, PL azul). Os demais candidatos do 1º turno ficam em cinza nos
// gráficos de barras, para não virar um arco-íris de 12 cores.
const PARTY = {
  PT: '#c8102e',
  PL: '#1f5fc8',
};

const MINOR = ['#c77700', '#0f8a6d', '#7a4cc2'];
const minorSeen = [];

export function partyColor(party) {
  if (PARTY[party]) return PARTY[party];
  // Partido que venceu algum estado no 1º turno fora PT/PL: cor fixa por ordem de aparição.
  let i = minorSeen.indexOf(party);
  if (i < 0) { minorSeen.push(party); i = minorSeen.length - 1; }
  return MINOR[i] ?? 'var(--muted)';
}

export function hasOwnColor(party) {
  return Boolean(PARTY[party]);
}

// Opacidade do estado no mapa conforme a força do vencedor (% dos válidos).
export const SHADES = [
  { min: 0, label: 'até 50%', op: 0.32 },
  { min: 50, label: '50–55%', op: 0.48 },
  { min: 55, label: '55–60%', op: 0.66 },
  { min: 60, label: '60–70%', op: 0.84 },
  { min: 70, label: '70%+', op: 1 },
];

export function shadeFor(pct) {
  let s = SHADES[0];
  for (const x of SHADES) if (pct >= x.min) s = x;
  return s.op;
}
