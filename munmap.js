// Mapa de municípios de um estado (abre ao clicar no estado no mapa do Brasil).
// Contornos em mun/<uf>.json, gerados por ops/gerar-municipios.py a partir do IBGE.
import { partyColor, shadeFor } from './colors.js';
import { fmtPct, esc, title } from './format.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const geoCache = {};

export async function loadMunGeo(uf) {
  if (!geoCache[uf]) {
    geoCache[uf] = fetch(`mun/${uf}.json`).then((r) => {
      if (!r.ok) throw new Error('contorno ' + uf);
      return r.json();
    });
    geoCache[uf].catch(() => { delete geoCache[uf]; });
  }
  return geoCache[uf];
}

export function createMunMap(container, { onHover, onLeave, onSelect }) {
  let svg = null, nodes = {}, current = null;

  function build(uf, geo) {
    container.innerHTML = '';
    nodes = {};
    current = uf;
    svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', geo.viewBox);
    svg.setAttribute('class', 'map-svg mun-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Mapa dos municípios com o candidato que lidera em cada um. Use a busca para escolher um município pelo teclado.');
    const g = document.createElementNS(SVGNS, 'g');
    for (const [cd, m] of Object.entries(geo.mun)) {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', m.d);
      p.setAttribute('class', 'mun');
      p.dataset.cd = cd;
      g.appendChild(p);
      nodes[cd] = p;
    }
    svg.appendChild(g);
    // Um ouvinte só para centenas de caminhos.
    svg.addEventListener('pointermove', (ev) => { const cd = ev.target.dataset?.cd; if (cd) onHover(cd, ev); else onLeave(); });
    svg.addEventListener('pointerleave', onLeave);
    svg.addEventListener('click', (ev) => { const cd = ev.target.dataset?.cd; if (cd) onSelect(cd); });
    container.appendChild(svg);
  }

  return {
    get uf() { return current; },
    async show(uf) {
      if (current === uf && svg) return;
      container.innerHTML = '<p class="muted map-loading">Carregando mapa do estado…</p>';
      current = uf;
      const geo = await loadMunGeo(uf);
      if (current === uf) build(uf, geo);
    },
    update(results, selected) {
      for (const [cd, p] of Object.entries(nodes)) {
        const lead = results[cd]?.cands?.[0];
        p.classList.toggle('sel', cd === selected);
        if (!lead || lead.votes === 0) { p.style.fill = 'url(#hatch)'; p.style.fillOpacity = 1; continue; }
        p.style.fill = partyColor(lead.party);
        p.style.fillOpacity = shadeFor(lead.pct);
      }
      // Selecionado por cima dos vizinhos, para a borda aparecer inteira.
      if (selected && nodes[selected]) nodes[selected].parentNode.appendChild(nodes[selected]);
    },
    reset() { current = null; svg = null; nodes = {}; container.innerHTML = ''; },
  };
}

export function munTooltip(name, ufName, r, prog) {
  const head = `<b>${esc(title(name))}</b> <span class="muted">${esc(ufName)}</span>`;
  if (!r || !r.cands.some((c) => c.votes)) {
    return `${head}<div class="muted">${prog && prog.total ? 'Nenhuma seção apurada ainda' : 'Sem dados ainda'}</div>`;
  }
  const rows = r.cands.slice(0, 3).map((c) => `
    <div class="tip-row"><span class="dot" style="background:${partyColor(c.party)}"></span>
    <span>${esc(title(c.name))}</span><b>${fmtPct(c.pct)}</b></div>`).join('');
  return `${head}${rows}<div class="muted tip-foot">${fmtPct(r.progress)} das seções apuradas</div>`;
}
