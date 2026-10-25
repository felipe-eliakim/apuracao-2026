// Painel de visitas: lê /api/stats com a senha (STATS_TOKEN) guardada neste navegador.
import { fmtInt, esc } from './format.js';

const $ = (id) => document.getElementById(id);
const KEY = 'apuracao2026-stats-token';
const getTok = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
const setTok = (t) => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch { /* ok */ } };

const dur = (s) => {
  s = Math.round(s);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60}s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
};
const brHour = (h) => new Date(h + ':00:00Z').toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit' }) + 'h';

function list(obj, label = (k) => k) {
  const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0) || 1;
  if (!rows.length) return '<p class="muted small">Nada ainda.</p>';
  return `<ul class="hbars">${rows.slice(0, 15).map(([k, v]) => `<li><span class="hb-name">${esc(label(k))}</span>
    <span class="hb-track"><span class="hb-bar" style="width:${(v / total) * 100}%;background:var(--ink-2)"></span></span>
    <span class="hb-val">${fmtInt(v)}</span></li>`).join('')}</ul>`;
}

function render(d) {
  const t = d.total;
  const avg = t.views ? t.sec / t.views : 0;
  const hours = d.byHour.slice(-48);
  const max = Math.max(1, ...hours.map((h) => h.views));
  const refName = (k) => ({ direto: 'Direto / app (WhatsApp, Instagram…)', compartilhar: 'Botão Compartilhar do site' })[k] ?? k;
  $('out').innerHTML = `
    <section class="status-bar"><p class="muted small">Atualizado ${new Date(d.generated).toLocaleString('pt-BR')}. Visita = uma aba aberta no site (recarregar não conta de novo).</p></section>
    <div class="st-grid">
      <div class="tile"><div class="tile-l">Visitas</div><div class="tile-v">${fmtInt(t.views)}</div></div>
      <div class="tile"><div class="tile-l">Aparelhos diferentes (por dia)</div><div class="tile-v">${fmtInt(t.newv)}</div></div>
      <div class="tile"><div class="tile-l">Tempo médio por visita</div><div class="tile-v">${dur(avg)}</div></div>
      <div class="tile"><div class="tile-l">Tempo total no site</div><div class="tile-v">${dur(t.sec)}</div></div>
    </div>
    <section class="card" style="margin-bottom:16px"><div class="card-head"><h2>Visitas por hora</h2><p class="muted small">Últimas 48 horas com movimento, horário de Brasília.</p></div>
      ${hours.length ? `<div class="hours">${hours.map((h) => `<span style="height:${(h.views / max) * 100}%" data-tip="${esc(`<b>${brHour(h.h)}</b><br>${fmtInt(h.views)} visitas<br>tempo médio ${dur(h.views ? h.sec / h.views : 0)}`)}"></span>`).join('')}</div>
      <div class="hours-ax"><span>${brHour(hours[0].h)}</span><span>${brHour(hours[hours.length - 1].h)}</span></div>` : '<p class="muted small">Nada ainda.</p>'}
    </section>
    <div class="cols">
      <section class="card"><div class="card-head"><h2>De onde vieram</h2></div>${list(t.ref, refName)}</section>
      <section class="card"><div class="card-head"><h2>Aparelho e turno</h2></div>${list({ Celular: t.dev.m ?? 0, Computador: t.dev.d ?? 0 })}<div style="height:12px"></div>${list({ '2º turno': t.turno[2] ?? 0, '1º turno': t.turno[1] ?? 0 })}</section>
      <section class="card"><div class="card-head"><h2>Estados abertos</h2><p class="muted small">Quantas visitas abriram o mapa de municípios de cada estado.</p></div>${list(t.ufs, (k) => k.toUpperCase())}</section>
    </div>`;
}

async function load() {
  const tok = getTok();
  if (!tok) { $('login').hidden = false; $('out').hidden = true; return; }
  $('reload').disabled = true;
  try {
    const r = await fetch('/api/stats', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' });
    if (r.status === 401) { setTok(''); $('err').textContent = 'Senha incorreta.'; $('login').hidden = false; $('out').hidden = true; return; }
    if (!r.ok) throw new Error(r.status);
    render(await r.json());
    $('login').hidden = true; $('out').hidden = false;
  } catch {
    $('out').hidden = false;
    $('out').innerHTML = '<p class="muted">Não foi possível carregar agora. Tente "Atualizar" daqui a pouco.</p>';
  } finally { $('reload').disabled = false; }
}

$('login').addEventListener('submit', (ev) => { ev.preventDefault(); $('err').textContent = ''; setTok($('tok').value.trim()); load(); });
$('reload').addEventListener('click', load);
$('logout').addEventListener('click', () => { setTok(''); load(); });

// Tooltip simples das barras
const tip = $('tip');
document.addEventListener('pointermove', (ev) => {
  const t = ev.target.closest?.('[data-tip]');
  if (!t) { tip.hidden = true; return; }
  tip.innerHTML = t.dataset.tip; tip.hidden = false;
  tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, ev.clientX + 12) + 'px';
  tip.style.top = ev.clientY + 14 + 'px';
});

load();
