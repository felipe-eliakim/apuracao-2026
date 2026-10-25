// Baixa os resultados dos municípios de um estado, poucos de cada vez.
// Na primeira abertura busca todos os que têm seção apurada; nas atualizações,
// só os que mudaram segundo o arquivo de andamento do estado.
import { fetchMunResult, fetchStateProgress } from './tse.js';

const PARALLEL = 20; // HTTP/2: muitas requisições pequenas numa conexão só

export function createMunLoader(onChange) {
  let ctx = null; // { round, uf, results, prog, seen, token }
  let token = 0;

  async function pool(items, worker) {
    let i = 0;
    const run = async () => { while (i < items.length) { const it = items[i++]; await worker(it); } };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, run));
  }

  async function refresh(allCodes) {
    if (!ctx) return;
    const my = ctx.token;
    let prog = null;
    try { prog = await fetchStateProgress(ctx.round, ctx.uf); } catch { /* sem andamento: busca tudo */ }
    if (!ctx || ctx.token !== my) return;
    if (prog) ctx.prog = prog;

    const todo = allCodes.filter((cd) => {
      const p = prog?.[cd];
      if (!p) return !prog || !ctx.seen[cd];       // sem andamento: busca uma vez
      if (p.done === 0) return false;              // nada apurado ali ainda
      return ctx.seen[cd] !== p.key;
    });
    if (!todo.length) { onChange(ctx, false); return; }

    ctx.loading = { done: 0, total: todo.length };
    onChange(ctx, true);
    let lastPaint = 0;
    await pool(todo, async (cd) => {
      if (!ctx || ctx.token !== my) return;
      try {
        ctx.results[cd] = await fetchMunResult(ctx.round, ctx.uf, cd);
        ctx.seen[cd] = prog?.[cd]?.key ?? 'ok';
      } catch { /* município fica para a próxima rodada */ }
      if (!ctx || ctx.token !== my) return;
      ctx.loading.done++;
      const now = performance.now();
      if (now - lastPaint > 250) { lastPaint = now; onChange(ctx, true); }
    });
    if (!ctx || ctx.token !== my) return;
    ctx.loading = null;
    onChange(ctx, false);
  }

  return {
    get ctx() { return ctx; },
    async open(round, uf, allCodes) {
      if (ctx && ctx.round === round && ctx.uf === uf) return;
      ctx = { round, uf, results: {}, prog: {}, seen: {}, loading: null, token: ++token, codes: allCodes };
      await refresh(allCodes);
    },
    async update() { if (ctx && !ctx.loading) await refresh(ctx.codes); },
    close() { ctx = null; token++; },
  };
}
