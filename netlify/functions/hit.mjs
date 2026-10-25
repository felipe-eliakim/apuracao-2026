// Recebe um evento anônimo de visita. Não guarda IP, cookie nem identificador:
// só contadores (visita, tempo, origem do link, tipo de aparelho, estado aberto).
// Cada evento vira um blob pequeno; stats.mjs agrega por hora.
import { getStore } from '@netlify/blobs';

const UFS = new Set('ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to'.split(' '));
const clampInt = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
const short = (s, n) => String(s ?? '').toLowerCase().replace(/[^a-z0-9.\-]/g, '').slice(0, n);

export default async (req) => {
  if (req.method !== 'POST') return new Response('', { status: 405 });
  let b;
  try { b = JSON.parse((await req.text()).slice(0, 2000)); } catch { return new Response('', { status: 400 }); }

  const ev = {
    t: b.t === 'end' ? 'end' : 'view',
    nw: b.nw ? 1 : 0,                       // primeira visita do aparelho hoje (decidido no navegador)
    sec: clampInt(b.sec, 6 * 3600),         // segundos com a página visível (só no 'end')
    ref: short(b.ref, 60),                  // só o domínio de origem
    dev: b.dev === 'm' ? 'm' : 'd',
    turno: b.turno === 1 ? 1 : 2,
    ufs: Array.isArray(b.ufs) ? [...new Set(b.ufs.filter((u) => UFS.has(u)))].slice(0, 27) : [],
  };
  const now = new Date();
  const hour = now.toISOString().slice(0, 13); // UTC, ex.: 2026-10-25T22
  const key = `raw/${hour}/${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  await getStore('visitas').setJSON(key, ev);
  return new Response('', { status: 204 });
};

export const config = { path: '/api/hit' };
