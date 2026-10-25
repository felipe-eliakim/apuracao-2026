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
- **Mapa por estado, não por município:** o TSE publica um arquivo por município (5.570), pesado demais para atualizar ao vivo no navegador.
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
| `ads.js` / `config.js` | anúncios (Google AdSense), desligados por padrão |

## Anúncios

Os espaços de anúncio (abaixo do placar, entre os gráficos e antes do rodapé) ficam escondidos até existir uma conta AdSense aprovada. Para ligar:

1. Criar conta em <https://adsense.google.com> e adicionar o domínio do site. O Google revisa o site antes de aprovar (costuma levar de alguns dias a algumas semanas).
2. Criar 3 blocos de anúncio (display, responsivo) no painel.
3. Preencher `config.js` com `client: 'ca-pub-...'` e os IDs dos blocos.
4. Criar `ads.txt` na raiz com a linha que o AdSense mostra (`google.com, pub-..., DIRECT, f08c47fec0942fa0`).
5. Publicar. Sem o ID, nenhum script do Google é carregado (sem rastreamento de terceiros).

Observação: o AdSense exige aviso de cookies/consentimento para visitantes da Europa; para tráfego só do Brasil a LGPD pede pelo menos uma política de privacidade explicando o uso de cookies de anúncio — criar essa página antes de ligar os anúncios.

## Roadmap

- **2026-10-25:** primeira versão, publicada no dia do 2º turno. Placar, mapa por estado com tons por força do líder, painel do estado selecionado, estados conquistados, região, evolução, 1º × 2º turno, vantagem por estado, andamento por estado, comparecimento/brancos/nulos, tabela ordenável, alternância 1º/2º turno, compartilhar.

- **2026-10-25:** deploy contínuo no Netlify ligado ao GitHub (push na `main` publica sozinho).

## Pendências

- Ligar anúncios (depende da aprovação do AdSense) + página de política de privacidade.
- Mapa por município ao clicar num estado (exige baixar centenas de arquivos por UF; avaliar).
