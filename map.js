// Mapa do Brasil por estado: cada estado pinta com a cor do partido que lidera,
// mais forte quanto maior a vantagem, com a sigla e a % do líder escrita em cima.
import { STATES, VIEWBOX } from './geo.js';
import { UFS } from './tse.js';
import { partyColor, shadeFor } from './colors.js';
import { fmtPct, esc } from './format.js';

const SVGNS = 'http://www.w3.org/2000/svg';
// Estados pequenos demais para caber o rótulo: rótulo vai pro mar, com linha.
const OUTSIDE = { rn: 1, pb: 1, pe: 1, al: 1, se: 1, es: 1, rj: 1, df: 1 };

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function outsidePositions() {
  // NE: coluna à direita, ordenada de norte a sul, com espaço mínimo entre rótulos.
  const ne = ['rn', 'pb', 'pe', 'al', 'se'].map((k) => ({ k, y: STATES[k].c[1] })).sort((a, b) => a.y - b.y);
  const pos = {};
  let last = -1e9;
  for (const s of ne) { const y = Math.max(s.y - 6, last + 34); pos[s.k] = [940, y]; last = y; }
  pos.es = [905, STATES.es.c[1] - 4];
  pos.rj = [880, STATES.rj.c[1] + 34];
  pos.df = [STATES.df.c[0] + 70, STATES.df.c[1] - 40];
  return pos;
}

export function createMap(container, { onHover, onLeave, onSelect }) {
  const svg = el('svg', { viewBox: VIEWBOX, class: 'map-svg', role: 'img', 'aria-label': 'Mapa do Brasil com o candidato que lidera em cada estado' });
  // Padrão listrado (#hatch) fica num <svg> de definições no index.html,
  // para servir também ao mapa de municípios quando este mapa está escondido.

  const gShapes = el('g', {}, svg);
  const gLines = el('g', { class: 'leaders' }, svg);
  const gLabels = el('g', { class: 'labels' }, svg);
  const pos = outsidePositions();
  const nodes = {};

  for (const [uf, geo] of Object.entries(STATES)) {
    const path = el('path', { d: geo.d, class: 'uf', tabindex: 0, 'data-uf': uf, role: 'button', 'aria-label': UFS[uf][0] }, gShapes);
    const [lx, ly] = pos[uf] ?? geo.c;
    if (pos[uf]) el('line', { x1: geo.c[0], y1: geo.c[1], x2: lx - 18, y2: ly - 4 }, gLines);
    const t = el('text', { x: lx, y: ly, class: 'lbl' + (OUTSIDE[uf] ? ' small' : '') }, gLabels);
    const a = el('tspan', { x: lx, class: 'lbl-uf' }, t); a.textContent = uf.toUpperCase();
    const b = el('tspan', { x: lx, dy: '1.1em', class: 'lbl-pct' }, t);
    nodes[uf] = { path, pct: b };

    const show = (ev) => onHover(uf, ev);
    path.addEventListener('pointermove', show);
    path.addEventListener('focus', (ev) => onHover(uf, ev));
    path.addEventListener('pointerleave', onLeave);
    path.addEventListener('blur', onLeave);
    path.addEventListener('click', () => onSelect(uf));
    path.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onSelect(uf); } });
  }
  container.appendChild(svg);

  return {
    update(ufs, selected) {
      for (const [uf, n] of Object.entries(nodes)) {
        const r = ufs[uf];
        const lead = r?.cands?.[0];
        n.path.classList.toggle('sel', uf === selected);
        if (!lead || lead.votes === 0) {
          n.path.style.fill = 'url(#hatch)';
          n.path.style.fillOpacity = 1;
          n.pct.textContent = '';
          continue;
        }
        n.path.style.fill = partyColor(lead.party);
        n.path.style.fillOpacity = shadeFor(lead.pct);
        n.pct.textContent = fmtPct(lead.pct, 1);
      }
    },
  };
}

export function stateTooltip(uf, r) {
  if (!r) return `<b>${esc(UFS[uf][0])}</b><div class="muted">Sem dados ainda</div>`;
  const rows = r.cands.slice(0, 4).map((c) => `
    <div class="tip-row"><span class="dot" style="background:${partyColor(c.party)}"></span>
    <span>${esc(c.name)} <span class="muted">${esc(c.party)}</span></span>
    <b>${fmtPct(c.pct)}</b></div>`).join('');
  return `<b>${esc(UFS[uf][0])}</b>${rows}<div class="muted tip-foot">${fmtPct(r.progress)} das seções apuradas</div>`;
}
