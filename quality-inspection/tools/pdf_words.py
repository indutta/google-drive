#!/usr/bin/env python3
"""Usage: python3 -I pdf_words.py report.pdf words.json  - word positions of pages 1-4 (needs poppler's pdftotext)."""
import re, sys, json, subprocess
pdf, out = sys.argv[1], sys.argv[2]
html = subprocess.run(['pdftotext', '-bbox', '-f', '1', '-l', '4', pdf, '-'], capture_output=True, text=True, check=True).stdout
pages = []
for p in html.split('<page ')[1:]:
    items = [{'x': float(a), 'y': float(b), 'w': float(c) - float(a), 's': t.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&apos;', "'").replace('&quot;', '"')}
             for a, b, c, d, t in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</word>', p)]
    pages.append(items)
json.dump(pages, open(out, 'w'))
print('pages', [len(p) for p in pages])
