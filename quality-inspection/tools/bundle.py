#!/usr/bin/env python3
"""Inline CSS + JS into one file (dcl-quality-inspection.html) that can be shared by WhatsApp / e-mail / Drive
and opened in Chrome on any Android phone - no server, no install, no Claude."""
import os, re
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
rd = lambda n: open(os.path.join(root, n), encoding='utf-8').read()
h = rd('index.html')
h = re.sub(r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\n', '', h)
h = h.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + rd('styles.css') + '\n</style>')
for js in ('plan.js', 'store.js', 'charge.js', 'app.js'):
    h = h.replace(f'<script src="{js}"></script>', '<script>\n' + rd(js) + '\n</script>')
h = re.sub(r'<script>if\("serviceWorker".*?</script>\n', '', h, flags=re.S)
open(os.path.join(root, 'dcl-quality-inspection.html'), 'w', encoding='utf-8').write(h)
print('bundle written', len(h) // 1024, 'KB')

# ---- Artifact build: page fragment (no doctype/head/body) for the claude.ai Artifact tool ----
import re as _re
b = rd('index.html')
body = _re.search(r'<body>(.*)</body>', b, _re.S).group(1)
body = _re.sub(r'<script src="[^"]+"></script>\n?', '', body)
body = _re.sub(r'<script>if\("serviceWorker".*?</script>\n?', '', body, flags=_re.S)
frag = '<title>DCL Quality Inspection</title>\n<style>\n' + rd('styles.css') + '\n</style>\n' + body.strip() + '\n'
for js in ('plan.js', 'store.js', 'charge.js', 'app.js'):
    frag += '<script>\n' + rd(js) + '\n</script>\n'
open(os.path.join(root, 'artifact.html'), 'w', encoding='utf-8').write(frag)
print('artifact fragment written', len(frag) // 1024, 'KB')
