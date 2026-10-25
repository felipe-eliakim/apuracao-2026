// Orquestra: busca os dados do TSE, guarda o estado da tela e redesenha.
import { ROUNDS, UFS, fetchAll, fetchResult } from './tse.js';
import { createMap, stateTooltip } from './map.js';
import { partyColor, SHADES } from './colors.js';
import * as C from './charts.js';
import { fmtPct, fmtInt, esc, title } from './format.js';
import { initAds } from './ads.js';
import { createMunMap, loadMunGeo, munTooltip } from './munmap.js';
import { createMunLoader } from './munload.js';
import { initTracking, trackState } from './track.js';

const POLL_MS = 60_000; // o próprio TSE marca os arquivos com cache de 60 s
const $ = (id) => document.getElementById(id);

const state = {
  round: Number(new URLSearchParams(location.search).get('turno')) === 1 ? 1 : 2,
  data: { 1: null, 2: null },
  selected: null,     // UF aberta no mapa de municípios
  selectedMun: null,  // código TSE do município escolhido
  munGeo: null,       // contornos/nome dos municípios da UF aberta
  sort: 'name',
  nextAt: 0,
  loading: false,
};

// ---------- Histórico local (para a linha de evolução) ----------
const histKey = (r) => `apuracao2026-hist-${r}`;
function loadHist(r) {
  try { return JSON.parse(localStorage.getItem(histKey(r)) || '[]'); } catch { return []; }
}
function pushHist(r, br) {
  if (!br || !br.cands.length) return loadHist(r);
  const h = loadHist(r);
  const last = h[h.length - 1];
  if (!last || last.time !== br.time || last.progress !== br.progress) {
    h.push({ time: br.time, progress: br.progress, pct: Object.fromEntries(br.cands.map((c) => [c.n, c.pct])) });
    h.sort((a, b) => a.progress - b.progress);
    try { localStorage.setItem(histKey(r), JSON.stringify(h.slice(-400))); } catch { /* sem storage: segue sem histórico */ }
  }
  return h;
}

// ---------- Tooltip único ----------
const tipEl = $('tip');
function showTip(html, ev) {
  tipEl.innerHTML = html;
  tipEl.hidden = false;
  const r = ev.target.getBoundingClientRect?.();
  const x = ev.clientX ?? (r ? r.left + r.width / 2 : 0);
  const y = ev.clientY ?? (r ? r.top : 0);
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  tipEl.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 14)) + 'px';
  tipEl.style.top = (y + h + 24 > window.innerHeight ? y - h - 14 : y + 16) + 'px';
}
const hideTip = () => { tipEl.hidden = true; };
document.addEventListener('pointerover', (ev) => {
  const t = ev.target.closest?.('[data-tip]');
  if (t) showTip(t.dataset.tip, ev);
});
document.addEventListener('pointermove', (ev) => {
  const t = ev.target.closest?.('[data-tip]');
  if (t) showTip(t.dataset.tip, ev);
});
document.addEventListener('pointerout', (ev) => {
  if (ev.target.closest?.('[data-tip]') && !ev.relatedTarget?.closest?.('[data-tip]')) hideTip();
});

// ---------- Mapa ----------
const map = createMap($('map'), {
  onHover: (uf, ev) => showTip(stateTooltip(uf, cur()?.ufs[uf]), ev),
  onLeave: hideTip,
  onSelect: (uf) => openState(uf),
});

const cur = () => state.data[state.round];

// ---------- Municípios ----------
const munMap = createMunMap($('munmap'), {
  onHover: (cd, ev) => {
    const ctx = munLoader.ctx, m = state.munGeo?.mun[cd];
    if (m) showTip(munTooltip(m.n, UFS[state.selected][0], ctx?.results[cd], ctx?.prog[cd]), ev);
  },
  onLeave: hideTip,
  onSelect: (cd) => { state.selectedMun = state.selectedMun === cd ? null : cd; render(); },
});
const munLoader = createMunLoader((ctx) => {
  if (ctx.uf === state.selected && ctx.round === state.round) render();
});

async function openState(uf) {
  if (uf === 'zz') return;
  trackState(uf);
  state.selected = uf;
  state.selectedMun = null;
  state.munGeo = null;
  $('mun-search').value = '';
  render();
  $('map-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  try {
    await munMap.show(uf);
    const geo = await loadMunGeo(uf);
    if (state.selected !== uf) return;
    state.munGeo = geo;
    $('mun-list').innerHTML = Object.values(geo.mun).map((m) => `<option value="${esc(title(m.n))}">`).join('');
    render();
    munLoader.open(state.round, uf, Object.keys(geo.mun));
  } catch {
    $('mun-status').textContent = 'Não foi possível carregar o mapa do estado.';
  }
}

function closeState() {
  state.selected = null;
  state.selectedMun = null;
  state.munGeo = null;
  munLoader.close();
  munMap.reset();
  render();
}

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function findMun(text) {
  const q = norm(text);
  if (!q || !state.munGeo) return null;
  const all = Object.entries(state.munGeo.mun);
  return (all.find(([, m]) => norm(m.n) === q) ?? all.find(([, m]) => norm(m.n).startsWith(q)))?.[0] ?? null;
}

function munStatusText(ctx) {
  if (!state.munGeo || !ctx) return 'Carregando municípios…';
  const n = Object.keys(state.munGeo.mun).length;
  if (ctx.loading) return `Baixando resultados: ${ctx.loading.done} de ${ctx.loading.total} municípios…`;
  const withVotes = Object.values(ctx.results).filter((r) => r.cands.some((c) => c.votes)).length;
  return `${withVotes} de ${n} municípios com votos apurados`;
}

// ---------- Desenho ----------
function renderLegend(d) {
  const parties = [...new Set(Object.values(d?.ufs ?? {}).map((r) => r.cands[0]).filter((c) => c && c.votes).map((c) => c.party))];
  $('map-legend').innerHTML = parties.map((p) => {
    const c = partyColor(p);
    return `<div class="ml-row"><span class="ml-p">${esc(p)}</span>${SHADES.map((s) => `<span class="ml-sw" style="background:${c};opacity:${s.op}" title="${s.label}"></span>`).join('')}</div>`;
  }).join('') + `<div class="ml-scale"><span></span>${SHADES.map((s) => `<span>${s.label.replace('%', '')}</span>`).join('')}</div>
    <div class="ml-row"><span class="ml-sw hatch"></span><span class="muted">sem votos apurados</span></div>`;
}

// Quantos municípios cada candidato lidera no estado aberto.
function munWins(ctx) {
  const by = {};
  for (const r of Object.values(ctx?.results ?? {})) {
    const lead = r.cands[0];
    if (lead?.votes) (by[lead.n] ??= { c: lead, k: 0 }).k++;
  }
  const list = Object.values(by).sort((a, b) => b.k - a.k);
  if (!list.length) return '';
  return `<div class="mun-wins"><div class="tile-l">Municípios em que lidera</div>
    <ul class="legend">${list.map((x) => `<li><span class="dot" style="background:${partyColor(x.c.party)}"></span>${esc(title(x.c.name))} <b>${fmtInt(x.k)}</b></li>`).join('')}</ul></div>`;
}

function renderSide(d) {
  const uf = state.selected, cd = state.selectedMun;
  const ctx = munLoader.ctx;
  let r, name, back;
  if (uf && cd) {
    r = ctx?.results[cd];
    name = `${title(state.munGeo?.mun[cd]?.n ?? '')} (${uf.toUpperCase()})`;
    back = `← ${UFS[uf][0]}`;
  } else if (uf) {
    r = d?.ufs[uf]; name = UFS[uf][0]; back = '← Brasil';
  } else {
    r = d?.br; name = 'Brasil';
  }
  $('side-title').textContent = name;
  $('side-back').hidden = !uf;
  $('side-back').textContent = back ?? '';
  if (!r) {
    const p = cd && ctx?.prog[cd];
    $('side-body').innerHTML = `<p class="muted">${p && p.done === 0 ? 'Nenhuma seção apurada aqui ainda.' : 'Sem dados ainda.'}</p>`;
    return;
  }
  $('side-body').innerHTML = `
    <div class="side-prog"><span>${fmtPct(r.progress)} das seções apuradas</span>
      <span class="pg-track"><span class="pg-bar" style="width:${r.progress}%"></span></span>
      <span class="muted small">${fmtInt(r.sectionsDone)} de ${fmtInt(r.sections)} seções · boletim ${esc(r.time || '—')}</span></div>
    ${C.candList(r, state.round)}
    ${uf && !cd ? munWins(ctx) : ''}
    ${C.turnout(r)}`;
}

function renderMapCard(d) {
  const uf = state.selected;
  $('map').hidden = Boolean(uf);
  $('munmap').hidden = !uf;
  $('mun-tools').hidden = !uf;
  $('map-back').hidden = !uf;
  $('map-title').textContent = uf ? `Municípios — ${UFS[uf][0]}` : 'Quem lidera em cada estado';
  $('map-help').textContent = uf
    ? 'Cor do candidato que lidera em cada município. Toque numa cidade ou use a busca.'
    : 'Cor do partido que lidera; quanto mais forte, maior a % dos votos válidos. Toque num estado para ver os municípios.';
  if (uf) {
    const ctx = munLoader.ctx;
    munMap.update(ctx?.results ?? {}, state.selectedMun);
    $('mun-status').textContent = munStatusText(ctx);
  } else {
    map.update(d?.ufs ?? {}, null);
  }
}

function render() {
  const d = cur();
  const br = d?.br;
  const top = br?.cands.slice(0, 2) ?? [];

  document.querySelectorAll('[data-round]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.round) === state.round)));
  $('round-sub').textContent = `${ROUNDS[state.round].label} · ${ROUNDS[state.round].date} · Presidente`;

  // Andamento geral
  const p = br?.progress ?? 0;
  $('progress-bar').style.width = p + '%';
  $('progress-pct').textContent = fmtPct(p);
  $('progress-detail').textContent = br ? `${fmtInt(br.sectionsDone)} de ${fmtInt(br.sections)} seções` : '';
  const finished = br?.finished;
  $('live').className = 'live ' + (finished ? 'done' : 'on');
  $('live-text').textContent = finished ? 'Apuração encerrada' : br?.defined ? 'Matematicamente definido' : 'Ao vivo';

  $('hero').innerHTML = C.hero(br, state.round);
  $('cand-list').innerHTML = state.round === 1 ? C.candList(br, 1) : '';
  $('cand-list').hidden = state.round !== 1;

  renderMapCard(d);
  renderLegend(d);
  renderSide(d);

  $('c-states').innerHTML = C.statesWon(d?.ufs ?? {});
  $('c-regions').innerHTML = C.regions(d?.ufs ?? {}, top);
  $('c-margins').innerHTML = C.margins(d?.ufs ?? {}, top[0], top[1]);
  $('c-progress').innerHTML = C.progress(d?.ufs ?? {});
  $('c-evo').innerHTML = C.evolution(loadHist(state.round), top);
  $('c-turnout').innerHTML = C.turnout(br);
  $('card-compare').hidden = state.round !== 2;
  if (state.round === 2) $('c-compare').innerHTML = C.compareRounds(br, state.data[1]?.br);
  $('c-table').innerHTML = C.table(d?.ufs ?? {}, top, state.sort);

  const leader = top[0];
  document.title = br && leader?.votes
    ? `${title(leader.name)} ${fmtPct(leader.pct, 1)} · ${fmtPct(p, 0)} apurado — Apuração 2026`
    : 'Apuração 2026 — Presidente ao vivo';
}

// ---------- Busca ----------
async function load(round = state.round) {
  if (state.loading) return;
  state.loading = true;
  $('status').textContent = 'Atualizando…';
  try {
    const d = await fetchAll(round);
    if (d.br) {
      state.data[round] = d;
      pushHist(round, d.br);
      $('status').textContent = `Boletim TSE ${d.br.date} ${d.br.time}` + (d.errors ? ` · ${d.errors} arquivo(s) sem resposta` : '');
      renderStale(d.br);
    } else {
      $('status').textContent = 'TSE sem resposta, tentando de novo em 1 min';
    }
  } catch {
    $('status').textContent = 'Falha de conexão, tentando de novo em 1 min';
  } finally {
    state.loading = false;
    state.nextAt = Date.now() + POLL_MS;
    if (round === state.round) {
      render();
      // Estado aberto: atualiza só os municípios que mudaram.
      if (state.selected && !state.data[round]?.br?.finished) munLoader.update();
    }
  }
}

// Aviso quando o TSE passa muito tempo sem boletim novo (ex.: apuração pausada).
function renderStale(br) {
  const el = $('stale');
  const [dd, mm, yy] = (br.date || '').split('/');
  const t = new Date(`${yy}-${mm}-${dd}T${br.time || '00:00:00'}-03:00`).getTime();
  const min = Math.floor((Date.now() - t) / 60000);
  const show = !br.finished && br.progress < 100 && min >= 20 && min < 24 * 60;
  el.hidden = !show;
  if (show) el.textContent = `O TSE não publica boletim novo há ${min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min'}. O site segue checando a cada minuto e mostra os números assim que saírem.`;
}

// Linha do 1º turno usada na comparação (arquivo nacional só, já está fechado).
async function loadFirstRoundBr() {
  if (state.data[1]?.br || state.round === 1) return; // no 1º turno, load() já traz tudo
  try {
    const br = await fetchResult(1, 'br');
    if (!state.data[1]) { state.data[1] = { br, ufs: {} }; render(); } // não sobrescreve dados completos
  } catch { /* comparação fica "carregando" */ }
}

setInterval(() => {
  const br = cur()?.br;
  if (br?.finished) { $('countdown').textContent = ''; return; }
  const s = Math.max(0, Math.ceil((state.nextAt - Date.now()) / 1000));
  $('countdown').textContent = state.loading ? '' : `· nova checagem em ${s}s`;
  if (s === 0 && !state.loading && document.visibilityState !== 'hidden') load();
}, 1000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() > state.nextAt) load();
});

// ---------- Interações ----------
document.querySelectorAll('[data-round]').forEach((b) => b.addEventListener('click', () => {
  const r = Number(b.dataset.round);
  if (r === state.round) return;
  state.round = r;
  history.replaceState(null, '', r === 1 ? '?turno=1' : location.pathname);
  // Estado aberto continua aberto, com os municípios do outro turno.
  if (state.selected && state.munGeo) munLoader.open(r, state.selected, Object.keys(state.munGeo.mun));
  render();
  const loaded = state.data[r]?.ufs && Object.keys(state.data[r].ufs).length;
  if (!loaded || !state.data[r].br.finished) load(r);
}));
$('side-back').addEventListener('click', () => {
  if (state.selectedMun) { state.selectedMun = null; render(); } else closeState();
});
$('map-back').addEventListener('click', closeState);
$('mun-search').addEventListener('change', (ev) => {
  const cd = findMun(ev.target.value);
  if (cd) { state.selectedMun = cd; render(); }
});
$('mun-search').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') { const cd = findMun(ev.target.value); if (cd) { state.selectedMun = cd; render(); } }
});
$('c-table').addEventListener('click', (ev) => {
  const s = ev.target.closest('[data-sort]');
  if (s) { state.sort = s.dataset.sort; render(); return; }
  const tr = ev.target.closest('tr[data-uf]');
  if (tr && tr.dataset.uf !== 'zz') openState(tr.dataset.uf);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && state.selected && !ev.target.closest('input')) closeState();
});

// Crosshair da linha de evolução
$('c-evo').addEventListener('pointermove', (ev) => {
  const svg = ev.target.closest('svg[data-evo]');
  if (!svg) return;
  const cfg = JSON.parse(svg.dataset.evo);
  const box = svg.getBoundingClientRect();
  const x = ((ev.clientX - box.left) / box.width) * cfg.W;
  const p = ((x - cfg.L) / (cfg.W - cfg.L - cfg.R)) * 100;
  let best = cfg.h[0];
  for (const h of cfg.h) if (Math.abs(h.p - p) < Math.abs(best.p - p)) best = h;
  const cx = cfg.L + (best.p / 100) * (cfg.W - cfg.L - cfg.R);
  const cross = svg.querySelector('.cross');
  cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
  showTip(`<b>${fmtPct(best.p)} apurado</b> <span class="muted">${esc(best.t)}</span>` +
    cfg.top.map((c) => `<div class="tip-row"><span class="dot" style="background:${c.color}"></span><span>${esc(c.name)}</span><b>${fmtPct(best.pct[c.n] ?? 0)}</b></div>`).join(''), ev);
});
$('c-evo').addEventListener('pointerleave', () => {
  const cross = $('c-evo').querySelector('.cross');
  if (cross) { cross.setAttribute('x1', -10); cross.setAttribute('x2', -10); }
  hideTip();
});

// Tema
const root = document.documentElement;
try { const t = localStorage.getItem('apuracao2026-theme'); if (t) root.dataset.theme = t; } catch { /* ok */ }
$('theme').addEventListener('click', () => {
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('apuracao2026-theme', root.dataset.theme); } catch { /* ok */ }
});

// Compartilhar
$('share').addEventListener('click', async () => {
  const br = cur()?.br, t = br?.cands.slice(0, 2) ?? [];
  const text = `Apuração ${ROUNDS[state.round].label} 2026 (${fmtPct(br?.progress ?? 0, 1)} apurado): ` +
    t.map((c) => `${title(c.name)} ${fmtPct(c.pct)}`).join(' × ');
  try {
    const url = location.origin + location.pathname + (state.round === 1 ? '?turno=1&o=compartilhar' : '?o=compartilhar');
    if (navigator.share) await navigator.share({ title: 'Apuração 2026', text, url });
    else { await navigator.clipboard.writeText(`${text} ${url}`); $('share').textContent = 'Link copiado'; setTimeout(() => { $('share').textContent = 'Compartilhar'; }, 2000); }
  } catch { /* cancelado */ }
});

render();
load();
loadFirstRoundBr();
initAds();
initTracking(state.round);
