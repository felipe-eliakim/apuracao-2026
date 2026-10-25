// Contador de visitas anônimo e próprio (sem cookies, sem IP, sem serviço de terceiros).
// Envia: abertura da página (com origem do link e tipo de aparelho) e, ao sair ou
// trocar de aba, quantos segundos a página ficou visível e quais estados foram abertos.
const ENDPOINT = '/api/hit';
const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);

function send(data) {
  if (local) return;
  try {
    const body = JSON.stringify(data);
    if (!(navigator.sendBeacon && navigator.sendBeacon(ENDPOINT, body))) {
      fetch(ENDPOINT, { method: 'POST', body, keepalive: true }).catch(() => {});
    }
  } catch { /* contador nunca atrapalha o site */ }
}

function origin() {
  const o = new URLSearchParams(location.search).get('o');
  if (o) return o;
  try { const h = new URL(document.referrer).hostname; return h && h !== location.hostname ? h.replace(/^www\./, '') : ''; } catch { return ''; }
}

let visibleSince = document.visibilityState === 'visible' ? performance.now() : null;
let pendingSec = 0;
const ufs = new Set();

export function trackState(uf) { ufs.add(uf); }

export function initTracking(turno) {
  let first = false, newToday = false;
  try {
    first = !sessionStorage.getItem('ap26-s');
    sessionStorage.setItem('ap26-s', '1');
    const today = new Date().toISOString().slice(0, 10);
    newToday = localStorage.getItem('ap26-d') !== today;
    localStorage.setItem('ap26-d', today);
  } catch { first = true; }
  if (first) send({ t: 'view', nw: newToday, ref: origin(), dev: matchMedia('(max-width: 700px)').matches ? 'm' : 'd', turno });

  const flush = () => {
    if (visibleSince != null) { pendingSec += (performance.now() - visibleSince) / 1000; visibleSince = null; }
    if (pendingSec >= 1 || ufs.size) send({ t: 'end', sec: Math.round(pendingSec), ufs: [...ufs] });
    pendingSec = 0; ufs.clear();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else visibleSince = performance.now();
  });
  addEventListener('pagehide', flush);
}
