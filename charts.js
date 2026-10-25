// Gráficos desenhados à mão (HTML + SVG), sem biblioteca.
// Cada função recebe os dados e devolve HTML. Tooltip: atributo data-tip (ver app.js).
import { UFS, REGIONS, photoUrl } from './tse.js';
import { partyColor, hasOwnColor } from './colors.js';
import { fmtPct, fmtInt, fmtShort, esc, title } from './format.js';

const tip = (html) => `data-tip="${esc(html)}"`;
const barColor = (c) => (hasOwnColor(c.party) ? partyColor(c.party) : 'var(--muted)');

// ---------- Placar principal ----------
export function hero(br, round) {
  if (!br) return '<p class="muted">Aguardando dados do TSE…</p>';
  const top = br.cands.slice(0, 2);
  const cards = top.map((c, i) => `
    <article class="cand ${i ? 'right' : ''}" style="--pc:${partyColor(c.party)}">
      <img src="${photoUrl(round, c.sq)}" alt="" width="72" height="96" loading="lazy" onerror="this.style.visibility='hidden'">
      <div class="cand-info">
        <div class="cand-name">${esc(title(c.name))} ${c.elected ? '<span class="badge-elected">Eleito</span>' : ''}</div>
        <div class="muted">${esc(c.party)} · ${esc(c.n)}${c.vice ? ' · vice ' + esc(title(c.vice)) : ''}</div>
        <div class="cand-pct">${fmtPct(c.pct)}</div>
        <div class="muted">${fmtInt(c.votes)} votos</div>
      </div>
    </article>`).join('');

  const [a, b] = top;
  const total = br.cands.reduce((s, c) => s + c.votes, 0) || 1;
  const segs = br.cands.filter((c) => c.votes > 0).map((c) =>
    `<span class="seg" style="width:${(c.votes / total) * 100}%;background:${barColor(c)}" ${tip(`<b>${esc(title(c.name))}</b> ${fmtPct(c.pct)}<br>${fmtInt(c.votes)} votos`)}></span>`).join('');
  const diff = a && b ? a.votes - b.votes : 0;
  const lead = a && diff > 0
    ? `<b>${esc(title(a.name))}</b> à frente por <b>${fmtInt(diff)}</b> votos (${fmtPct(a.pct - b.pct)} p.p.)`
    : 'Empate';
  return `<div class="cands">${cards}</div>
    <div class="split" role="img" aria-label="Divisão dos votos válidos">${segs}<i class="half" title="50%"></i></div>
    <p class="lead-line">${br.cands.length ? lead : ''}</p>`;
}

// Lista de candidatos (útil no 1º turno, com 12 nomes).
export function candList(r, round) {
  if (!r) return '';
  const max = Math.max(...r.cands.map((c) => c.pct), 1);
  return `<ul class="hbars">${r.cands.map((c) => `
    <li ${tip(`<b>${esc(title(c.name))}</b> (${esc(c.party)})<br>${fmtInt(c.votes)} votos · ${fmtPct(c.pct)}`)}>
      <span class="hb-name">${esc(title(c.name))} <span class="muted">${esc(c.party)}</span></span>
      <span class="hb-track"><span class="hb-bar" style="width:${(c.pct / max) * 100}%;background:${barColor(c)}"></span></span>
      <span class="hb-val">${fmtPct(c.pct)}</span>
    </li>`).join('')}</ul>`;
}

// ---------- Estados conquistados (waffle: 1 quadrado = 1 estado) ----------
export function statesWon(ufs) {
  const list = Object.keys(UFS).filter((k) => k !== 'zz').map((k) => ({ k, lead: ufs[k]?.cands?.[0] }))
    .filter((x) => x.lead && x.lead.votes > 0);
  const byCand = {};
  for (const x of list) (byCand[x.lead.name] ??= { c: x.lead, ufs: [] }).ufs.push(x.k);
  const groups = Object.values(byCand).sort((a, b) => b.ufs.length - a.ufs.length);
  const waiting = 27 - list.length;
  const cells = groups.flatMap((g) => g.ufs.map((k) =>
    `<span class="cell" style="background:${partyColor(g.c.party)}" ${tip(`<b>${esc(UFS[k][0])}</b><br>${esc(title(g.c.name))} ${fmtPct(ufs[k].cands[0].pct)}`)}>${k.toUpperCase()}</span>`))
    .concat(Array.from({ length: waiting }, () => '<span class="cell empty">·</span>')).join('');
  const legend = groups.map((g) => `<li><span class="dot" style="background:${partyColor(g.c.party)}"></span>${esc(title(g.c.name))} <b>${g.ufs.length}</b></li>`).join('')
    + (waiting ? `<li><span class="dot hatch"></span>Sem votos ainda <b>${waiting}</b></li>` : '');
  return `<ul class="legend">${legend}</ul><div class="waffle">${cells}</div>`;
}

// ---------- Vantagem por estado (divergente entre os dois primeiros) ----------
export function margins(ufs, a, b) {
  if (!a || !b) return '';
  const rows = Object.keys(UFS).map((k) => {
    const r = ufs[k];
    const ca = r?.cands.find((c) => c.n === a.n), cb = r?.cands.find((c) => c.n === b.n);
    if (!ca || !cb || ca.votes + cb.votes === 0) return null;
    return { k, m: ca.pct - cb.pct, ca, cb };
  }).filter(Boolean).sort((x, y) => y.m - x.m);
  const max = Math.max(10, ...rows.map((r) => Math.abs(r.m)));
  const html = rows.map((r) => {
    const w = (Math.abs(r.m) / max) * 50;
    const who = r.m >= 0 ? a : b;
    const style = r.m >= 0 ? `left:50%;width:${w}%` : `left:${50 - w}%;width:${w}%`;
    return `<li ${tip(`<b>${esc(UFS[r.k][0])}</b><br>${esc(title(a.name))} ${fmtPct(r.ca.pct)}<br>${esc(title(b.name))} ${fmtPct(r.cb.pct)}<br>Vantagem: ${fmtPct(Math.abs(r.m), 1)} p.p.`)}>
      <span class="mg-uf">${r.k === 'zz' ? 'EXT' : r.k.toUpperCase()}</span>
      <span class="mg-track"><span class="mg-bar" style="${style};background:${partyColor(who.party)}"></span></span>
      <span class="mg-val">${r.m >= 0 ? '+' : '−'}${Math.abs(r.m).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
    </li>`;
  }).join('');
  return `<div class="mg-head"><span style="color:var(--ink-2)">◀ ${esc(title(b.name))}</span><span>${esc(title(a.name))} ▶</span></div><ul class="margins">${html}</ul>`;
}

// ---------- Por região (barra 100% empilhada) ----------
export function regions(ufs, top) {
  const agg = Object.fromEntries(REGIONS.map((r) => [r, { tot: 0, by: {} }]));
  for (const [k, r] of Object.entries(ufs)) {
    const g = agg[UFS[k][1]];
    for (const c of r.cands) { g.tot += c.votes; g.by[c.n] = (g.by[c.n] ?? 0) + c.votes; }
  }
  return `<ul class="regions">${REGIONS.map((reg) => {
    const g = agg[reg];
    if (!g.tot) return `<li><span class="rg-name">${reg}</span><span class="rg-track empty">sem votos ainda</span></li>`;
    const segs = top.map((c) => ({ c, v: g.by[c.n] ?? 0 }));
    const other = g.tot - segs.reduce((s, x) => s + x.v, 0);
    const parts = segs.map(({ c, v }) => `<span class="seg" style="width:${(v / g.tot) * 100}%;background:${partyColor(c.party)}" ${tip(`<b>${reg}</b><br>${esc(title(c.name))} ${fmtPct((v / g.tot) * 100)}<br>${fmtInt(v)} votos`)}></span>`).join('')
      + (other > 0 ? `<span class="seg" style="width:${(other / g.tot) * 100}%;background:var(--muted)" ${tip(`<b>${reg}</b><br>Outros ${fmtPct((other / g.tot) * 100)}`)}></span>` : '');
    const lead = segs.sort((x, y) => y.v - x.v)[0];
    return `<li><span class="rg-name">${reg}</span><span class="rg-track">${parts}</span><span class="rg-val">${fmtPct((lead.v / g.tot) * 100, 1)} <span class="muted">${esc(title(lead.c.name).split(' ')[0])}</span></span></li>`;
  }).join('')}</ul>`;
}

// ---------- Andamento da apuração por estado ----------
export function progress(ufs) {
  const rows = Object.keys(UFS).map((k) => ({ k, p: ufs[k]?.progress ?? 0 })).sort((a, b) => b.p - a.p);
  return `<ul class="prog">${rows.map((r) => `
    <li ${tip(`<b>${esc(UFS[r.k][0])}</b><br>${fmtPct(r.p)} das seções apuradas<br>${fmtInt(ufs[r.k]?.sectionsDone ?? 0)} de ${fmtInt(ufs[r.k]?.sections ?? 0)}`)}>
      <span class="pg-uf">${r.k === 'zz' ? 'EXT' : r.k.toUpperCase()}</span>
      <span class="pg-track"><span class="pg-bar" style="width:${r.p}%"></span></span>
      <span class="pg-val">${fmtPct(r.p, 1)}</span>
    </li>`).join('')}</ul>`;
}

// ---------- Comparecimento, brancos e nulos ----------
export function turnout(r) {
  if (!r) return '';
  const tiles = [
    ['Eleitorado', fmtShort(r.voters), `${fmtInt(r.voters)} eleitores aptos`],
    ['Comparecimento', fmtPct(r.turnoutPct, 1), `${fmtInt(r.turnout)} votaram (das seções apuradas)`],
    ['Abstenção', fmtPct(r.abstentionPct, 1), `${fmtInt(r.abstention)} não votaram`],
    ['Brancos', fmtPct(r.blankPct, 1), `${fmtInt(r.blank)} votos`],
    ['Nulos', fmtPct(r.nullPct, 1), `${fmtInt(r.nullv)} votos`],
  ];
  return `<div class="tiles">${tiles.map(([l, v, t]) => `<div class="tile" ${tip(t)}><div class="tile-l">${l}</div><div class="tile-v">${v}</div></div>`).join('')}</div>`;
}

// ---------- 1º turno × 2º turno ----------
export function compareRounds(r2, r1) {
  if (!r2 || !r1) return '<p class="muted">Carregando 1º turno…</p>';
  return `<ul class="cmp">${r2.cands.slice(0, 2).map((c) => {
    const f = r1.cands.find((x) => x.n === c.n);
    const d = f ? c.pct - f.pct : 0;
    return `<li style="--pc:${partyColor(c.party)}">
      <div class="cmp-name"><span class="dot" style="background:${partyColor(c.party)}"></span>${esc(title(c.name))}</div>
      <div class="cmp-row"><span class="muted">1º turno</span><span class="cmp-track"><span style="width:${f?.pct ?? 0}%" class="cmp-bar faint"></span></span><b>${fmtPct(f?.pct ?? 0)}</b></div>
      <div class="cmp-row"><span class="muted">2º turno</span><span class="cmp-track"><span style="width:${c.pct}%" class="cmp-bar"></span></span><b>${fmtPct(c.pct)}</b></div>
      <div class="muted cmp-delta">${d >= 0 ? '▲' : '▼'} ${fmtPct(Math.abs(d))} p.p. em relação ao 1º turno · ${fmtInt(f?.votes ?? 0)} votos no 1º turno</div>
    </li>`;
  }).join('')}</ul>`;
}

// ---------- Evolução (linha: % dos válidos conforme a apuração avança) ----------
export function evolution(history, top) {
  if (history.length < 2 || top.length < 2) {
    return '<p class="muted">A linha aparece conforme novos boletins do TSE chegam com a página aberta (o TSE não publica o histórico).</p>';
  }
  const W = 640, H = 240, L = 36, R = 12, T = 12, B = 28;
  const xs = (p) => L + (p / 100) * (W - L - R);
  const vals = history.flatMap((h) => top.map((c) => h.pct[c.n] ?? 50));
  const lo = Math.floor(Math.min(40, ...vals) / 5) * 5, hi = Math.ceil(Math.max(60, ...vals) / 5) * 5;
  const ys = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const grid = [];
  for (let v = lo; v <= hi; v += 5) grid.push(`<line x1="${L}" x2="${W - R}" y1="${ys(v)}" y2="${ys(v)}" class="${v === 50 ? 'ref' : 'grid'}"/><text x="${L - 6}" y="${ys(v) + 4}" class="ax" text-anchor="end">${v}%</text>`);
  for (const p of [0, 25, 50, 75, 100]) grid.push(`<text x="${xs(p)}" y="${H - 8}" class="ax" text-anchor="middle">${p}%</text>`);
  const lines = top.map((c) => {
    const pts = history.map((h) => `${xs(h.progress).toFixed(1)},${ys(h.pct[c.n] ?? 50).toFixed(1)}`).join(' ');
    const last = history[history.length - 1];
    return `<polyline points="${pts}" fill="none" stroke="${partyColor(c.party)}" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="${xs(last.progress)}" cy="${ys(last.pct[c.n] ?? 50)}" r="4" fill="${partyColor(c.party)}" stroke="var(--surface)" stroke-width="2"/>`;
  }).join('');
  const data = esc(JSON.stringify({ L, R, W, top: top.map((c) => ({ n: c.n, name: title(c.name), color: partyColor(c.party) })), h: history.map((h) => ({ p: h.progress, t: h.time, pct: h.pct })) }));
  return `<ul class="legend">${top.map((c) => `<li><span class="dot" style="background:${partyColor(c.party)}"></span>${esc(title(c.name))}</li>`).join('')}</ul>
    <div class="evo-wrap"><svg viewBox="0 0 ${W} ${H}" class="evo" data-evo="${data}" role="img" aria-label="Evolução do percentual de votos válidos ao longo da apuração">
      ${grid.join('')}${lines}<line class="cross" y1="${T}" y2="${H - B}" x1="-10" x2="-10"/>
    </svg></div><p class="muted small">Eixo horizontal: % das seções apuradas.</p>`;
}

// ---------- Tabela completa ----------
export function table(ufs, top, sort) {
  const a = top[0], b = top[1];
  const rows = Object.keys(UFS).map((k) => {
    const r = ufs[k];
    return { k, name: UFS[k][0], p: r?.progress ?? 0, a: r?.cands.find((c) => c.n === a?.n), b: r?.cands.find((c) => c.n === b?.n), lead: r?.cands[0], tot: r?.valid ?? 0 };
  });
  const keyf = { name: (r) => r.name, p: (r) => -r.p, a: (r) => -(r.a?.pct ?? 0), b: (r) => -(r.b?.pct ?? 0), tot: (r) => -r.tot }[sort] ?? ((r) => r.name);
  rows.sort((x, y) => { const u = keyf(x), v = keyf(y); return u < v ? -1 : u > v ? 1 : 0; });
  const th = (k, l) => `<th><button data-sort="${k}" class="${sort === k ? 'on' : ''}">${l}</button></th>`;
  return `<table class="tbl"><thead><tr>${th('name', 'Estado')}${th('p', 'Apurado')}${a ? th('a', esc(title(a.name))) : ''}${b ? th('b', esc(title(b.name))) : ''}${th('tot', 'Votos válidos')}</tr></thead>
    <tbody>${rows.map((r) => `<tr data-uf="${r.k}"><td><span class="dot" style="background:${r.lead && r.lead.votes ? partyColor(r.lead.party) : 'transparent'}"></span>${esc(r.name)}</td>
      <td>${fmtPct(r.p, 1)}</td>${a ? `<td>${fmtPct(r.a?.pct ?? 0)}</td>` : ''}${b ? `<td>${fmtPct(r.b?.pct ?? 0)}</td>` : ''}<td>${fmtInt(r.tot)}</td></tr>`).join('')}</tbody></table>`;
}
