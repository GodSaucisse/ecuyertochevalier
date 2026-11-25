#!/usr/bin/env python3
"""Change le numéro de version dans tous les liens entre fichiers du jeu.

Les navigateurs gardent les fichiers en mémoire (cache). En changeant le numéro
à chaque mise à jour, on force le chargement de la nouvelle version.
Utilisation : python3 tools/version.py
"""
import re, time, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
v = time.strftime('%Y%m%d%H%M')
pattern = re.compile(r"""((?:from\s+|import\s*\(\s*)['"]\./[^'"?]+\.js)(\?v=[0-9]+)?(['"])""")
for f in (root / 'src').glob('*.js'):
    text = f.read_text()
    f.write_text(pattern.sub(lambda m: f"{m.group(1)}?v={v}{m.group(3)}", text))
html = (root / 'index.html').read_text()
html = re.sub(r'(src/main\.js|style\.css)(\?v=[0-9]+)?', lambda m: f"{m.group(1)}?v={v}", html)
(root / 'index.html').write_text(html)
print('version', v)
