# Apuração 2026

Site para acompanhar a apuração da eleição para **presidente de 2026** em tempo real: mapa do Brasil com a cor do partido que lidera em cada estado (e a % dele), placar nacional, gráficos e tabela. Funciona para o 1º turno (04/10/2026, já encerrado) e o 2º turno (25/10/2026).

Ao vivo em **<https://apuracao-2026-500.netlify.app>**.

Site independente, sem vínculo com o TSE. O resultado oficial é o divulgado pelo Tribunal Superior Eleitoral.

## Como funciona

- HTML/CSS/JS puros, sem build e sem dependências. Abrir com qualquer servidor estático (`python3 -m http.server`) — módulos ES não abrem por `file://`.
- Os números vêm direto dos arquivos públicos do TSE (`resultados.tse.jus.br`), que liberam CORS: não há backend.
  - Configuração das eleições: `/oficial/comum/config/ele-c.json` → 1º turno presidente = eleição `6257`, 2º turno = `6258`.
  - Resultado: `/oficial/ele2026/<eleição>/dados/<uf>/<uf>-c0001-e00<eleição>-u.json` (`br`, as 27 UFs e `zz` = exterior). Cargo `0001` = Presidente.
  - Fotos: `/oficial/ele2026/<eleição>/fotos/br/<sqcand>.jpeg`.
- A página busca os 29 arquivos (~3 KB cada) a cada 60 s — mesmo tempo do cache que o TSE põe nos arquivos — e para quando o TSE marca a totalização como encerrada. Pausa com a aba escondida.
- Um arquivo que falhar não derruba a página (os outros aparecem normalmente).
- **Mapa de municípios ao clicar num estado:** o TSE publica um arquivo por município (~1 KB compactado cada), sem arquivo único com todos. Ao abrir um estado o site baixa o andamento do estado (`<uf>-e00<eleição>-ab.json`, um arquivo) e só então os municípios que têm seção apurada, 20 por vez, pintando o mapa aos poucos. Nas atualizações seguintes baixa de novo só os municípios cujo andamento mudou. Primeira abertura de SP ≈ 600 KB.
- Contornos dos municípios em `mun/<uf>.json` (2 MB no total, baixado só o estado aberto), gerados por `ops/gerar-municipios.py` a partir da malha do IBGE + tabela de municípios do TSE (`config/mun-e006258-cm.json`, que liga o código IBGE ao do TSE).
- **Linha de evolução:** o TSE não publica histórico; cada navegador guarda (no `localStorage`) os boletins que viu com a página aberta.
- Contorno dos estados: malha do IBGE (`servicodados.ibge.gov.br/api/v3/malhas`, qualidade mínima), convertida para caminhos SVG em `geo.js`.

## Arquivos

| Arquivo | O quê |
|---|---|
| `index.html` / `style.css` | estrutura e visual (tema claro/escuro) |
| `app.js` | estado da tela, busca periódica, interações |
| `tse.js` | leitura e conversão dos arquivos do TSE |
| `map.js` / `geo.js` | mapa SVG e contornos dos estados |
| `charts.js` | gráficos (SVG/HTML desenhados à mão) |
| `colors.js` | cores dos partidos e tons do mapa |
| `munmap.js` / `munload.js` / `mun/` | mapa de municípios, carregamento dos resultados por cidade, contornos |
| `ops/gerar-municipios.py` | gera `mun/*.json` |
| `ads.js` / `config.js` | anúncios (Google AdSense), desligados por padrão |

## Anúncios

Os espaços de anúncio (abaixo do placar, entre os gráficos e antes do rodapé) ficam escondidos até existir uma conta AdSense aprovada. Para ligar:

1. Criar conta em <https://adsense.google.com> e adicionar o domínio do site. O Google revisa o site antes de aprovar (costuma levar de alguns dias a algumas semanas).
2. Criar 3 blocos de anúncio (display, responsivo) no painel.
3. Preencher `config.js` com `client: 'ca-pub-...'` e os IDs dos blocos.
4. Criar `ads.txt` na raiz com a linha que o AdSense mostra (`google.com, pub-..., DIRECT, f08c47fec0942fa0`).
5. Publicar. Sem o ID, nenhum script do Google é carregado (sem rastreamento de terceiros).

Observação: o AdSense exige aviso de cookies/consentimento para visitantes da Europa; para tráfego só do Brasil a LGPD pede pelo menos uma política de privacidade explicando o uso de cookies de anúncio — criar essa página antes de ligar os anúncios.

## Contador de visitas

Contador próprio e anônimo, sem serviço de terceiros: `track.js` manda um evento quando a aba abre (origem do link, celular/computador, turno) e outro quando a aba some (segundos visível, estados abertos). Nada de cookie, IP ou identificador; "aparelhos diferentes" é decidido no navegador (marca de data no `localStorage`).

- Funções do Netlify: `netlify/functions/hit.mjs` (grava cada evento no Netlify Blobs, store `visitas`) e `stats.mjs` (agrega por hora, consolida horas fechadas em `agg/<hora>` e apaga os brutos). Únicas partes com dependência (`@netlify/blobs`).
- Painel: `/stats.html`, pede a senha `STATS_TOKEN` (variável de ambiente no Netlify; cópia local em `~/.config/apuracao-2026/senha-painel-visitas`, fora do git). O site em si não pede senha.
- Plano grátis do Netlify não tem variável "secreta" (dá Forbidden): a senha é variável comum, visível só para quem entra na conta do Netlify.
- Limites (plano grátis): 125 mil chamadas de função por mês — cada visita gasta 2 (abrir + sair), ou seja ~60 mil visitas/mês. Se estourar, o contador para de gravar e o site continua normal.
- Link compartilhado pelo botão do site leva `?o=compartilhar`, para medir quanto o compartilhamento traz. Para medir uma divulgação específica, compartilhe o link com `?o=nome` (ex.: `?o=grupo-igreja`).

## Roadmap

- **2026-10-25:** primeira versão, publicada no dia do 2º turno. Placar, mapa por estado com tons por força do líder, painel do estado selecionado, estados conquistados, região, evolução, 1º × 2º turno, vantagem por estado, andamento por estado, comparecimento/brancos/nulos, tabela ordenável, alternância 1º/2º turno, compartilhar.

- **2026-10-25:** deploy contínuo no Netlify ligado ao GitHub (push na `main` publica sozinho).
- **2026-10-25:** mapa de municípios ao clicar num estado: cor do líder em cada cidade, busca de município, resultado da cidade no painel lateral, contagem de municípios por candidato; continua aberto ao trocar de turno; Esc ou "← Brasil" volta.
- Corrigido: abrindo direto no 1º turno, a busca do placar nacional (usada na comparação) sobrescrevia os dados dos estados.
- **2026-10-25:** divulgação: imagem de prévia do link (`og-image.png`, gerada de `ops/og.html` com o Chrome sem janela), etiquetas Open Graph/Twitter, `robots.txt`, `sitemap.xml`, chave IndexNow (arquivo `<chave>.txt` na raiz) e aviso no topo quando o TSE fica 20 min ou mais sem boletim novo (no 2º turno o TSE pausou a divulgação às 17h06 porque o STF prorrogou a votação até 19h).
- **2026-10-25:** contador de visitas anônimo + painel `/stats.html`; tirado o endereço do Netlify da imagem de prévia.

## Pendências

- Ligar anúncios: o AdSense não aceita subdomínio `*.netlify.app` (o `ads.txt` precisa ficar na raiz de um domínio seu) — exige domínio próprio, aprovação do Google e página de política de privacidade.
- Google Search Console: precisa do dono do site verificar (meta tag ou arquivo).
