// Leitura dos arquivos públicos de resultado do TSE (resultados.tse.jus.br).
// O servidor do TSE libera CORS, então o navegador busca direto, sem backend.

const BASE = 'https://resultados.tse.jus.br/oficial/ele2026';

export const ROUNDS = {
  2: { code: '6258', label: '2º turno', date: '25/10/2026' },
  1: { code: '6257', label: '1º turno', date: '04/10/2026' },
};

export const UFS = {
  ac: ['Acre', 'Norte'], al: ['Alagoas', 'Nordeste'], am: ['Amazonas', 'Norte'], ap: ['Amapá', 'Norte'],
  ba: ['Bahia', 'Nordeste'], ce: ['Ceará', 'Nordeste'], df: ['Distrito Federal', 'Centro-Oeste'],
  es: ['Espírito Santo', 'Sudeste'], go: ['Goiás', 'Centro-Oeste'], ma: ['Maranhão', 'Nordeste'],
  mg: ['Minas Gerais', 'Sudeste'], ms: ['Mato Grosso do Sul', 'Centro-Oeste'], mt: ['Mato Grosso', 'Centro-Oeste'],
  pa: ['Pará', 'Norte'], pb: ['Paraíba', 'Nordeste'], pe: ['Pernambuco', 'Nordeste'], pi: ['Piauí', 'Nordeste'],
  pr: ['Paraná', 'Sul'], rj: ['Rio de Janeiro', 'Sudeste'], rn: ['Rio Grande do Norte', 'Nordeste'],
  ro: ['Rondônia', 'Norte'], rr: ['Roraima', 'Norte'], rs: ['Rio Grande do Sul', 'Sul'], sc: ['Santa Catarina', 'Sul'],
  se: ['Sergipe', 'Nordeste'], sp: ['São Paulo', 'Sudeste'], to: ['Tocantins', 'Norte'],
  zz: ['Exterior', 'Exterior'],
};

export const REGIONS = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul', 'Exterior'];

// "42,34" -> 42.34
const num = (s) => (s == null || s === '' ? 0 : Number(String(s).replace(',', '.')) || 0);

const fileCode = (code) => 'e' + code.padStart(6, '0');

export function photoUrl(round, sq) {
  return `${BASE}/${ROUNDS[round].code}/fotos/br/${sq}.jpeg`;
}

export function parse(j) {
  const cands = [];
  for (const agr of j.carg?.[0]?.agr ?? []) {
    for (const par of agr.par ?? []) {
      for (const c of par.cand ?? []) {
        cands.push({
          n: c.n,
          sq: c.sqcand,
          name: c.nmu,
          fullName: c.nm,
          party: par.sg,
          votes: num(c.vap),
          pct: num(c.pvapn || c.pvap),
          elected: c.e === 's',
          vice: c.vs?.[0]?.nmu ?? '',
        });
      }
    }
  }
  cands.sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const s = j.s ?? {}, e = j.e ?? {}, v = j.v ?? {};
  return {
    date: j.dg, time: j.hg,
    finished: j.tf === 's',
    defined: j.md === 's',
    progress: num(s.pstn || s.pst),
    sections: num(s.ts), sectionsDone: num(s.st),
    voters: num(e.te), turnout: num(e.c), abstention: num(e.a),
    turnoutPct: num(e.pcn || e.pc), abstentionPct: num(e.pan || e.pa),
    valid: num(v.vv), blank: num(v.vb), nullv: num(v.tvn),
    blankPct: num(v.pvbn || v.pvb), nullPct: num(v.ptvnn || v.ptvn),
    cands,
  };
}

export async function fetchResult(round, abr) {
  const code = ROUNDS[round].code;
  const res = await fetch(`${BASE}/${code}/dados/${abr}/${abr}-c0001-${fileCode(code)}-u.json`);
  if (!res.ok) throw new Error(`TSE ${abr}: ${res.status}`);
  return parse(await res.json());
}

// Brasil + 27 UFs + exterior. Um arquivo que falhar não derruba os outros.
export async function fetchAll(round) {
  const keys = ['br', ...Object.keys(UFS)];
  const out = await Promise.allSettled(keys.map((k) => fetchResult(round, k)));
  const data = { br: null, ufs: {}, errors: 0 };
  out.forEach((r, i) => {
    if (r.status !== 'fulfilled') { data.errors++; return; }
    if (keys[i] === 'br') data.br = r.value; else data.ufs[keys[i]] = r.value;
  });
  return data;
}

// ---------- Municípios ----------
// O TSE publica um arquivo por município. O andamento de todos os municípios
// de um estado vem num arquivo só (…-ab.json), usado para saber quais mudaram.

export async function fetchMunResult(round, uf, cd) {
  const code = ROUNDS[round].code;
  const res = await fetch(`${BASE}/${code}/dados/${uf}/${uf}${cd}-c0001-${fileCode(code)}-u.json`);
  if (!res.ok) throw new Error(`TSE ${uf}${cd}: ${res.status}`);
  return parse(await res.json());
}

// { codigoTSE: { done: seções apuradas, total, key: muda quando o município é atualizado } }
export async function fetchStateProgress(round, uf) {
  const code = ROUNDS[round].code;
  const res = await fetch(`${BASE}/${code}/dados/${uf}/${uf}-${fileCode(code)}-ab.json`);
  if (!res.ok) throw new Error(`TSE ab ${uf}: ${res.status}`);
  const j = await res.json();
  const out = {};
  for (const a of j.abr ?? []) {
    if (a.tpabr !== 'mun') continue;
    out[a.cdabr] = { done: num(a.s?.st), total: num(a.s?.ts), key: `${a.s?.st}|${a.dt}|${a.ht}` };
  }
  return out;
}
