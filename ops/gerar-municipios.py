"""Gera mun/<uf>.json: contorno de cada município (SVG) por estado, com o código do TSE.

Uso: python3 -I ops/gerar-municipios.py <pasta com UF.geojson do IBGE> <mun-e006258-cm.json do TSE> mun/
  IBGE: servicodados.ibge.gov.br/api/v3/malhas/estados/<UF>?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=minima
  TSE:  resultados.tse.jus.br/oficial/ele2026/6258/config/mun-e006258-cm.json (liga código IBGE -> código TSE)
"""
import json, math, os, sys

src, cmfile, out = sys.argv[1:4]
cm = json.load(open(cmfile))
ibge2tse = {}
for abr in cm['abr']:
    for m in abr['mu']:
        ibge2tse[m['cdi']] = (abr['cd'], m['cd'], m['nm'])

def rings(geom):
    polys = geom['coordinates'] if geom['type'] == 'MultiPolygon' else [geom['coordinates']]
    for poly in polys:
        for i, ring in enumerate(poly):
            yield i, ring

for fn in sorted(os.listdir(src)):
    uf = fn.split('.')[0].lower()
    feats = json.load(open(os.path.join(src, fn)))['features']
    xs, ys = [], []
    for f in feats:
        for _, r in rings(f['geometry']):
            for lon, lat in r: xs.append(lon); ys.append(lat)
    k = math.cos(math.radians((min(ys) + max(ys)) / 2))
    w, h = (max(xs) - min(xs)) * k, max(ys) - min(ys)
    S = min(1000 / w, 900 / h)
    W, H = round(w * S), round(h * S)
    tol = max(W, H) / 1400  # descarta pontos muito próximos (tamanho de arquivo)
    P = lambda lon, lat: ((lon - min(xs)) * k * S, (max(ys) - lat) * S)
    mun = {}
    for f in feats:
        cdi = f['properties']['codarea']
        if cdi not in ibge2tse: print('sem código TSE:', uf, cdi); continue
        _, cd, nm = ibge2tse[cdi]
        parts, best = [], (0, None)
        for i, ring in rings(f['geometry']):
            pts = [P(*c) for c in ring]
            simp = [pts[0]]
            for p in pts[1:]:
                if abs(p[0] - simp[-1][0]) + abs(p[1] - simp[-1][1]) > tol: simp.append(p)
            if len(simp) < 3: simp = pts
            parts.append('M' + 'L'.join(f'{x:.1f},{y:.1f}' for x, y in simp) + 'Z')
            if i == 0:
                a = cx = cy = 0
                for (x1, y1), (x2, y2) in zip(simp, simp[1:] + simp[:1]):
                    c = x1 * y2 - x2 * y1; a += c; cx += (x1 + x2) * c; cy += (y1 + y2) * c
                if a and abs(a) > abs(best[0]): best = (a, [round(cx / (3 * a), 1), round(cy / (3 * a), 1)])
        mun[cd] = {'n': nm, 'd': ''.join(parts), 'c': best[1]}
    json.dump({'viewBox': f'0 0 {W} {H}', 'mun': mun}, open(os.path.join(out, uf + '.json'), 'w'), separators=(',', ':'), ensure_ascii=False)
    print(uf, len(mun), os.path.getsize(os.path.join(out, uf + '.json')))
