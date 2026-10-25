# Apuração 2026

Site estático (sem build, sem dependências) que lê os JSON públicos do TSE no navegador. Ver README para os endereços do TSE e a estrutura.

- Testar: `python3 -m http.server 8931` e abrir `http://127.0.0.1:8931/` (ES modules não rodam em `file://`).
- Repositório **público** no GitHub; nada de segredo aqui (o ID do AdSense é público por natureza).
- Deploy: Netlify (site `apuracao-2026`), ligado ao GitHub — publica a cada push na branch `main`.
- Regenerar `geo.js`: script Python que projeta a malha do IBGE (ver histórico da sessão de 2026-10-25; projeção equiretangular com cos(15°)).
