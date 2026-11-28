#!/usr/bin/env python3
"""Inline CSS + JS: inspection-data.html (standalone), artifact.html (Claude Artifact) and gas/app.html (Google Sheet / Apps Script)."""
import os, re
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda n: open(os.path.join(root, n), encoding='utf-8').read()
JS = ('plan.js', 'store.js', 'pdfreport.js', 'logo.js', 'app.js')
h = rd('index.html')
h = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n', '', h)
h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + rd('styles.css') + '\n</style>')
for js in JS: h = h.replace(f'<script src="{js}"></script>', '<script>\n' + rd(js) + '\n</script>')
h = re.sub(r'<script>if\("serviceWorker".*?</script>\n', '', h, flags=re.S)
open(os.path.join(root, 'inspection-data.html'), 'w', encoding='utf-8').write(h); print('standalone', len(h) // 1024, 'KB')
body = re.search(r'<body>(.*)</body>', rd('index.html'), re.S).group(1)
body = re.sub(r'<script src="[^"]+"></script>\n?', '', body)
body = re.sub(r'<script>if\("serviceWorker".*?</script>\n?', '', body, flags=re.S)
frag = '<title>Inspection Data</title>\n<style>\n' + rd('styles.css') + '\n</style>\n' + body.strip() + '\n'
for js in JS: frag += '<script>\n' + rd(js) + '\n</script>\n'
open(os.path.join(root, 'artifact.html'), 'w', encoding='utf-8').write(frag); print('artifact', len(frag) // 1024, 'KB')
g = h.replace('<script>\n' + rd('plan.js'), '<script>\n' + rd('gas/gasdb.js') + '\n</script>\n<script>\n' + rd('plan.js'), 1)
assert g != h
open(os.path.join(root, 'gas', 'app.html'), 'w', encoding='utf-8').write(g); print('apps script', len(g) // 1024, 'KB')
