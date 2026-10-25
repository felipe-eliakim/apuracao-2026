// Devolve os números agregados das visitas. Exige o token STATS_TOKEN
// (variável de ambiente no Netlify), enviado no cabeçalho Authorization.
// Horas já fechadas são consolidadas em agg/<hora> e os eventos brutos apagados.
import { getStore } from '@netlify/blobs';

const empty = () => ({ views: 0, newv: 0, ends: 0, sec: 0, ref: {}, dev: { m: 0, d: 0 }, turno: { 1: 0, 2: 0 }, ufs: {} });

function add(a, ev) {
  if (ev.t === 'view') {
    a.views++; a.newv += ev.nw;
    a.dev[ev.dev] = (a.dev[ev.dev] ?? 0) + 1;
    a.turno[ev.turno] = (a.turno[ev.turno] ?? 0) + 1;
    const r = ev.ref || 'direto';
    a.ref[r] = (a.ref[r] ?? 0) + 1;
  } else {
    a.ends++; a.sec += ev.sec;
    for (const u of ev.ufs) a.ufs[u] = (a.ufs[u] ?? 0) + 1;
  }
}
function merge(a, b) {
  a.views += b.views; a.newv += b.newv; a.ends += b.ends; a.sec += b.sec;
  for (const k of ['ref', 'dev', 'turno', 'ufs']) for (const [x, v] of Object.entries(b[k])) a[k][x] = (a[k][x] ?? 0) + v;
}

export default async (req) => {
  const token = process.env.STATS_TOKEN;
  if (!token || req.headers.get('authorization') !== `Bearer ${token}`) return new Response('não autorizado', { status: 401 });

  const store = getStore({ name: 'visitas', consistency: 'strong' });
  const nowHour = new Date().toISOString().slice(0, 13);
  const hours = {};

  // Eventos brutos: agrupa por hora; horas fechadas viram agregado.
  const raw = {};
  for await (const page of store.list({ prefix: 'raw/', paginate: true })) {
    for (const { key } of page.blobs) (raw[key.split('/')[1]] ??= []).push(key);
  }
  for (const [hour, keys] of Object.entries(raw)) {
    const a = hour < nowHour ? ((await store.get(`agg/${hour}`, { type: 'json' })) ?? empty()) : empty();
    for (let i = 0; i < keys.length; i += 50) {
      const evs = await Promise.all(keys.slice(i, i + 50).map((k) => store.get(k, { type: 'json' })));
      evs.forEach((ev) => ev && add(a, ev));
    }
    if (hour < nowHour) {
      await store.setJSON(`agg/${hour}`, a);
      for (let i = 0; i < keys.length; i += 50) await Promise.all(keys.slice(i, i + 50).map((k) => store.delete(k)));
    }
    hours[hour] = a;
  }
  // Agregados já consolidados antes.
  for await (const page of store.list({ prefix: 'agg/', paginate: true })) {
    for (const { key } of page.blobs) {
      const h = key.slice(4);
      if (hours[h]) continue;
      hours[h] = await store.get(key, { type: 'json' });
    }
  }
  const total = empty();
  Object.values(hours).forEach((h) => merge(total, h));
  const byHour = Object.entries(hours).sort(([a], [b]) => a.localeCompare(b)).map(([h, v]) => ({ h, views: v.views, newv: v.newv, sec: v.sec, ends: v.ends }));
  return Response.json({ total, byHour, generated: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
};

export const config = { path: '/api/stats' };
