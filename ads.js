// Anúncios do Google AdSense. Só carrega se config.js tiver o ID da conta.
// Falha do AdSense (bloqueador, sem rede) nunca afeta o resto da página.
export function initAds() {
  const cfg = window.ADS_CONFIG ?? {};
  if (!/^ca-pub-\d+$/.test(cfg.client || '')) return;
  try {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${cfg.client}`;
    document.head.appendChild(s);
    document.querySelectorAll('[data-ad]').forEach((box) => {
      const slot = cfg.slots?.[box.dataset.ad];
      if (!slot) return;
      box.hidden = false;
      box.innerHTML = `<span class="ad-label">Publicidade</span><ins class="adsbygoogle" style="display:block" data-ad-client="${cfg.client}" data-ad-slot="${slot}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    });
  } catch { /* sem anúncio, segue o jogo */ }
}
