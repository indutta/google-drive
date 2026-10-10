(function () {
  'use strict';
  var D = window.DATA;
  var MONTHS = D.mis_monthly.slice().sort(function (a, b) { return a.month_no - b.month_no; });
  var FIRST = MONTHS[0].month_no, LAST = MONTHS[MONTHS.length - 1].month_no;
  var CUSTS = Array.from(new Set(D.contrib_cust.map(function (r) { return r.customer; }))).sort();
  var COLS = ['apr', 'may', 'jun', 'jul', 'aug', 'sep'];
  var TOTALS = ['Net sales', 'Net turnover for contribution', 'Total net variable costs', 'Contribution', 'Total fixed costs', 'Net profit from operations', 'EBITDA', 'PBT'];
  var nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var n1 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var KEY = 'datre-mis-state-v1';

  var state = { from: FIRST, to: LAST, cust: '', tab: 'home', theme: '' };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) { for (var k in state) if (sv[k] !== undefined) state[k] = sv[k]; } } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function clamp() {
    state.from = Math.min(Math.max(+state.from || FIRST, FIRST), LAST);
    state.to = Math.min(Math.max(+state.to || LAST, FIRST), LAST);
    if (state.to < state.from) state.to = state.from;
    if (state.cust && CUSTS.indexOf(state.cust) < 0) state.cust = '';
  }
  clamp();
  function applyTheme() { if (state.theme) document.documentElement.setAttribute('data-theme', state.theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();

  function sel() { return MONTHS.filter(function (m) { return m.month_no >= state.from && m.month_no <= state.to; }); }
  function ly(m, k) { var r = D.py_monthly.find(function (x) { return x.fy === '2025-26' && x.month_no === m.month_no; }); return r ? r[k] : null; }
  function sum(rows, f) { return rows.reduce(function (a, r) { return a + (+f(r) || 0); }, 0); }
  function pct(v, b) { return b ? ((v - b) / Math.abs(b)) * 100 : null; }
  function css(n) { return 'var(--' + n + ')'; }
  function svgEl(tag, attrs, text) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  /* ---------- charts ---------- */
  function ticks(lo, hi, n) {
    var span = hi - lo || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), err = (span / n) / step;
    step *= err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
    var a = Math.floor(lo / step) * step, z = Math.ceil(hi / step) * step, out = [];
    for (var v = a; v <= z + step / 2; v += step) out.push(Math.round(v * 1e6) / 1e6);
    return out;
  }
  function textW(svg, strs) {
    var t = svgEl('text', { 'class': 'tick' }); svg.appendChild(t); var m = 0;
    strs.forEach(function (s) { t.textContent = s; m = Math.max(m, t.getComputedTextLength()); });
    svg.removeChild(t); return m;
  }
  function frame(host, hgt) {
    host.replaceChildren();
    var w = Math.max(240, host.clientWidth || 320);
    var svg = svgEl('svg', { viewBox: '0 0 ' + w + ' ' + hgt, role: 'img' });
    host.appendChild(svg); return { svg: svg, w: w };
  }
  function yscale(lo, hi, top, bottom) { return function (v) { return bottom - ((v - lo) / (hi - lo || 1)) * (bottom - top); }; }
  function grid(svg, tk, y, ml, w, mr) {
    tk.forEach(function (v) {
      svg.appendChild(svgEl('line', { x1: ml, x2: w - mr, y1: y(v), y2: y(v), stroke: v === 0 ? css('muted') : css('line'), 'stroke-width': 1 }));
      svg.appendChild(svgEl('text', { 'class': 'tick', x: ml - 6, y: y(v) + 3.5, 'text-anchor': 'end' }, n1.format(v)));
    });
  }
  function readout(host, title, rows) {
    var r = host.parentNode.querySelector('.readout'); if (!r) return;
    r.replaceChildren();
    var t = h('b', '', title); r.appendChild(t);
    rows.forEach(function (x) {
      var d = h('div', 'r'); var l = h('span'); if (x.color) { var i = h('i'); i.style.background = x.color; l.appendChild(i); } l.appendChild(document.createTextNode(x.name));
      d.appendChild(l); d.appendChild(h('span', '', x.val)); r.appendChild(d);
    });
  }
  function grouped(host, cats, series, o) {
    o = o || {}; var hgt = o.h || 220, f = frame(host, hgt), svg = f.svg, w = f.w;
    var all = []; series.forEach(function (s) { s.values.forEach(function (v) { if (v !== null && v !== undefined) all.push(v); }); });
    if (!all.length) { host.appendChild(h('div', 'empty', 'No data for this selection')); return; }
    var tk = ticks(Math.min(0, Math.min.apply(null, all)), Math.max(0, Math.max.apply(null, all)), 4);
    var lo = tk[0], hi = tk[tk.length - 1], y = yscale(lo, hi, 8, hgt - 24);
    var ml = textW(svg, tk.map(function (v) { return n1.format(v); })) + 12, mr = 4;
    grid(svg, tk, y, ml, w, mr);
    var band = (w - ml - mr) / cats.length, inner = band * 0.78, bw = inner / series.length - 2;
    cats.forEach(function (c, ci) {
      var x0 = ml + ci * band + (band - inner) / 2;
      series.forEach(function (s, si) {
        var v = s.values[ci]; if (v === null || v === undefined) return;
        var top = Math.min(y(v), y(0)), bh = Math.max(1.5, Math.abs(y(v) - y(0)));
        svg.appendChild(svgEl('rect', { x: x0 + si * (bw + 2), y: top, width: Math.max(2, bw), height: bh, rx: 3, style: 'fill:' + s.color, opacity: o.dim && o.dim(ci) ? 0.45 : 1 }));
      });
      svg.appendChild(svgEl('text', { 'class': 'tick', x: ml + ci * band + band / 2, y: hgt - 8, 'text-anchor': 'middle' }, c));
      var hit = svgEl('rect', { x: ml + ci * band, y: 0, width: band, height: hgt - 18, fill: 'transparent' });
      hit.addEventListener('pointerdown', function () { readout(host, c, series.map(function (s) { return { color: s.color, name: s.name, val: s.values[ci] == null ? 'n/a' : nf.format(s.values[ci]) }; })); });
      svg.appendChild(hit);
    });
  }
  function lines(host, cats, series) {
    var hgt = 220, f = frame(host, hgt), svg = f.svg, w = f.w, all = [];
    series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    if (!all.length) { host.appendChild(h('div', 'empty', 'No data for this selection')); return; }
    var tk = ticks(Math.min(0, Math.min.apply(null, all)), Math.max(0, Math.max.apply(null, all)), 4), y = yscale(tk[0], tk[tk.length - 1], 8, hgt - 24);
    var ml = textW(svg, tk.map(function (v) { return n1.format(v); })) + 12, mr = 10;
    grid(svg, tk, y, ml, w, mr);
    var step = (w - ml - mr) / cats.length, xs = cats.map(function (c, i) { return ml + step * (i + 0.5); });
    series.forEach(function (s) {
      var d = '', pts = [];
      cats.forEach(function (c, i) { if (s.values[i] != null) { d += (d ? 'L' : 'M') + xs[i] + ' ' + y(s.values[i]); pts.push(i); } });
      svg.appendChild(svgEl('path', { d: d, fill: 'none', style: 'stroke:' + s.color, 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      pts.forEach(function (i) { svg.appendChild(svgEl('circle', { cx: xs[i], cy: y(s.values[i]), r: 4, style: 'fill:' + s.color + ';stroke:var(--panel);stroke-width:2' })); });
    });
    cats.forEach(function (c, i) {
      svg.appendChild(svgEl('text', { 'class': 'tick', x: xs[i], y: hgt - 8, 'text-anchor': 'middle' }, c));
      var hit = svgEl('rect', { x: xs[i] - step / 2, y: 0, width: step, height: hgt - 18, fill: 'transparent' });
      hit.addEventListener('pointerdown', function () { readout(host, c, series.map(function (s) { return { color: s.color, name: s.name, val: s.values[i] == null ? 'n/a' : nf.format(s.values[i]) }; })); });
      svg.appendChild(hit);
    });
  }
  function waterfall(host, rows) {
    var hgt = 230, f = frame(host, hgt), svg = f.svg, w = f.w, vals = [0];
    rows.forEach(function (r) { vals.push(r.start, r.end); });
    var tk = ticks(Math.min.apply(null, vals), Math.max.apply(null, vals), 4), y = yscale(tk[0], tk[tk.length - 1], 18, hgt - 42);
    var ml = textW(svg, tk.map(function (v) { return n1.format(v); })) + 12, mr = 4;
    grid(svg, tk, y, ml, w, mr);
    var band = (w - ml - mr) / rows.length, bw = band * 0.62;
    rows.forEach(function (r, i) {
      var x = ml + i * band + (band - bw) / 2, top = Math.min(y(r.start), y(r.end)), bh = Math.max(1.5, Math.abs(y(r.start) - y(r.end)));
      var fill = r.kind === 'total' ? css('c1') : css('mute');
      var rect = svgEl('rect', { x: x, y: top, width: bw, height: bh, rx: 3, style: 'fill:' + fill });
      rect.addEventListener('pointerdown', function () { readout(host, r.step, [{ color: fill, name: r.kind === 'total' ? 'Total' : 'Change', val: nf.format(r.value) }]); });
      svg.appendChild(rect);
      svg.appendChild(svgEl('text', { 'class': 'val', x: x + bw / 2, y: top - 4, 'text-anchor': 'middle' }, n1.format(r.value)));
      var words = r.step.split(' '), lines2 = [''], maxc = Math.max(7, Math.floor(band / 5.6));
      words.forEach(function (wd) { var cur = lines2[lines2.length - 1]; if ((cur + ' ' + wd).trim().length > maxc) lines2.push(wd); else lines2[lines2.length - 1] = (cur + ' ' + wd).trim(); });
      lines2.slice(0, 3).forEach(function (ln, li) { svg.appendChild(svgEl('text', { 'class': 'tick', x: x + bw / 2, y: hgt - 26 + li * 11, 'text-anchor': 'middle' }, ln)); });
    });
  }
  function hbars(host, rows, selected) {
    var rh = 38, hgt = Math.max(90, rows.length * rh + 8), f = frame(host, hgt), svg = f.svg, w = f.w;
    if (!rows.length) { host.appendChild(h('div', 'empty', 'No data for this selection')); return; }
    var ml = textW(svg, rows.map(function (r) { return r.customer; })) + 12, mr = 46, max = Math.max.apply(null, rows.map(function (r) { return r.contribution; })) || 1;
    rows.forEach(function (r, i) {
      var yy = 6 + i * rh, wd = Math.max(3, (w - ml - mr) * Math.max(r.contribution, 0) / max);
      var fill = selected ? (r.customer === selected ? css('c1') : css('mute')) : (i === 0 ? css('c1') : css('mute'));
      svg.appendChild(svgEl('text', { 'class': 'tick', x: ml - 8, y: yy + 16, 'text-anchor': 'end' }, r.customer));
      var rect = svgEl('rect', { x: ml, y: yy, width: wd, height: 24, rx: 4, style: 'fill:' + fill });
      svg.appendChild(rect);
      svg.appendChild(svgEl('text', { 'class': 'val', x: ml + wd + 5, y: yy + 16 }, n1.format(r.contribution)));
      var hit = svgEl('rect', { x: 0, y: yy - 4, width: w, height: rh, fill: 'transparent' });
      hit.addEventListener('pointerdown', function () { state.cust = state.cust === r.customer ? '' : r.customer; save(); render(); });
      svg.appendChild(hit);
    });
  }
  function legend(el, items) { el.replaceChildren(); items.forEach(function (it) { var s = h('span'); var i = h('i'); i.style.background = it.color; s.appendChild(i); s.appendChild(document.createTextNode(it.name)); el.appendChild(s); }); }

  /* ---------- views ---------- */
  function rangeCust(f, t) {
    var m = {};
    D.contrib_cust.forEach(function (r) {
      if (r.month_no < f || r.month_no > t) return;
      m[r.customer] = m[r.customer] || { customer: r.customer, contribution: 0, pouring_mt: 0 };
      m[r.customer].contribution += r.contribution; m[r.customer].pouring_mt += r.pouring_mt;
    });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.contribution - a.contribution; });
  }
  function kpi(label, value, delta, note, wide) {
    var c = h('div', 'kpi' + (wide ? ' wide' : '')); c.appendChild(h('div', 'l', label)); c.appendChild(h('div', 'v', value));
    var d = h('div', 'd ' + (delta && delta.cls || ''), delta ? delta.text : ''); c.appendChild(d); c.appendChild(h('div', 'n', note)); return c;
  }
  function dlt(v, b) { var p = pct(v, b); if (p === null) return null; return { text: (p > 0 ? '+' : '') + p.toFixed(1) + '% vs last year', cls: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' }; }

  function renderHome() {
    var s = sel(), v = $('#v-home'); v.replaceChildren();
    var ns = sum(s, function (m) { return m.net_sales; }), ct = sum(s, function (m) { return m.contribution; }), pb = sum(s, function (m) { return m.pbt; }), pr = sum(s, function (m) { return m.production_mt; }), ds = sum(s, function (m) { return m.despatch_mt; });
    var lns = sum(s, function (m) { return ly(m, 'net_sales'); }), lpb = sum(s, function (m) { return ly(m, 'pbt'); }), lpr = sum(s, function (m) { return ly(m, 'production_mt'); }), lds = sum(s, function (m) { return ly(m, 'despatch_mt'); });
    var losses = s.filter(function (m) { return m.pbt < 0; }).map(function (m) { return m.label; });
    var pbp = pct(pb, lpb), nsp = pct(ns, lns), dsp = pct(ds, lds);
    v.appendChild(h('p', 'take', 'Profit before tax is ' + (pbp < 0 ? 'below' : 'above') + ' the same months last year, with net sales ' + (nsp < 0 ? 'down' : 'up') + ' and despatches ' + (dsp < 0 ? 'down' : 'up') + '. ' + (losses.length === 0 ? 'Every month in this range was profitable.' : losses.length === s.length ? 'Every month in this range made a loss.' : 'Loss months: ' + losses.join(', ') + '.')));
    var g = h('div', 'kpis');
    g.appendChild(kpi('Net sales', nf.format(ns), dlt(ns, lns), 'Rs. lakh, ex GST, net of returns', true));
    g.appendChild(kpi('Profit before tax', nf.format(pb), dlt(pb, lpb), 'Rs. lakh'));
    g.appendChild(kpi('Contribution', nf.format(ct), { text: ns ? (ct / ns * 100).toFixed(1) + '% of net sales' : '', cls: 'flat' }, 'Rs. lakh'));
    g.appendChild(kpi('Production', nf.format(pr), dlt(pr, lpr), 'MT, as published'));
    g.appendChild(kpi('Despatch', nf.format(ds), dlt(ds, lds), 'MT, as published'));
    v.appendChild(g);
    var c1 = h('section', 'card'); c1.appendChild(h('h2', '', 'Net sales by month')); c1.appendChild(h('p', 'note', 'Rs. lakh. Tap a month for the figures.'));
    var l1 = h('div', 'leg'); c1.appendChild(l1); var ch1 = h('div', 'chart'); c1.appendChild(ch1); c1.appendChild(h('div', 'readout', 'Tap a bar.')); v.appendChild(c1);
    legend(l1, [{ name: '2026-27', color: css('c1') }, { name: '2025-26', color: css('mute') }]);
    var cats = s.map(function (m) { return m.label; });
    grouped(ch1, cats, [{ name: '2025-26', color: css('mute'), values: s.map(function (m) { return ly(m, 'net_sales'); }) }, { name: '2026-27', color: css('c1'), values: s.map(function (m) { return m.net_sales; }) }]);
    var c2 = h('section', 'card'); c2.appendChild(h('h2', '', 'Profit before tax by month')); c2.appendChild(h('p', 'note', 'Rs. lakh. Loss months sit below the zero line.'));
    var l2 = h('div', 'leg'); c2.appendChild(l2); var ch2 = h('div', 'chart'); c2.appendChild(ch2); c2.appendChild(h('div', 'readout', 'Tap a month.')); v.appendChild(c2);
    legend(l2, [{ name: '2026-27', color: css('c1') }, { name: '2025-26', color: css('mute') }]);
    lines(ch2, cats, [{ name: '2025-26', color: css('mute'), values: s.map(function (m) { return ly(m, 'pbt'); }) }, { name: '2026-27', color: css('c1'), values: s.map(function (m) { return m.pbt; }) }]);
  }
  function renderTrends() {
    var s = sel(), v = $('#v-trends'); v.replaceChildren();
    var c = function (k) { return sum(s, function (m) { return m[k]; }); };
    var rows = [
      { step: 'Contribution', start: 0, end: c('contribution'), value: c('contribution'), kind: 'total' },
      { step: 'Fixed costs', start: c('contribution'), end: c('contribution') - c('fixed_costs'), value: -c('fixed_costs'), kind: 'delta' },
      { step: 'Net profit from operations', start: 0, end: c('npo'), value: c('npo'), kind: 'total' },
      { step: 'Storage income', start: c('npo'), end: c('npo') + c('storage'), value: c('storage'), kind: 'delta' },
      { step: 'PBT', start: 0, end: c('pbt'), value: c('pbt'), kind: 'total' }];
    var a = h('section', 'card'); a.appendChild(h('h2', '', 'From contribution to PBT')); a.appendChild(h('p', 'note', 'Rs. lakh, selected months. Fixed costs come off, storage income is added back.'));
    var ca = h('div', 'chart'); a.appendChild(ca); a.appendChild(h('div', 'readout', 'Tap a bar.')); v.appendChild(a); waterfall(ca, rows);
    var b = h('section', 'card'); b.appendChild(h('h2', '', 'Production and despatch')); b.appendChild(h('p', 'note', 'MT per month. July repeats May in the published MIS, so treat July as unconfirmed.'));
    var lb = h('div', 'leg'); b.appendChild(lb); var cb = h('div', 'chart'); b.appendChild(cb); b.appendChild(h('div', 'readout', 'Tap a month.')); v.appendChild(b);
    legend(lb, [{ name: 'Production', color: css('c1') }, { name: 'Despatch', color: css('c2') }]);
    grouped(cb, s.map(function (m) { return m.label; }), [{ name: 'Production', color: css('c1'), values: s.map(function (m) { return m.production_mt; }) }, { name: 'Despatch', color: css('c2'), values: s.map(function (m) { return m.despatch_mt; }) }], { dim: function (i) { return s[i].label === 'Jul'; } });
  }
  function renderCust() {
    var s = sel(), v = $('#v-cust'); v.replaceChildren();
    var a = h('section', 'card'); a.appendChild(h('h2', '', 'Contribution by customer')); a.appendChild(h('p', 'note', 'Rs. lakh, selected months, product-wise cost sheet. Tap a bar to pick a customer.'));
    var ca = h('div', 'chart'); a.appendChild(ca); v.appendChild(a);
    hbars(ca, rangeCust(state.from, state.to), state.cust);
    var rows = D.contrib_cust.filter(function (r) { return !state.cust || r.customer === state.cust; });
    var val = function (m, k) { return sum(rows.filter(function (r) { return r.month_no === m.month_no; }), function (r) { return r[k]; }); };
    var b = h('section', 'card'); b.appendChild(h('h2', '', 'Contribution by month, ' + (state.cust || 'all customers'))); b.appendChild(h('p', 'note', 'Rs. lakh. The grey bar is contribution lost to in-house rejections.'));
    var lb = h('div', 'leg'); b.appendChild(lb); var cb = h('div', 'chart'); b.appendChild(cb); b.appendChild(h('div', 'readout', 'Tap a month.')); v.appendChild(b);
    legend(lb, [{ name: 'Contribution', color: css('c1') }, { name: 'Loss from rejections', color: css('mute') }]);
    grouped(cb, s.map(function (m) { return m.label; }), [{ name: 'Contribution', color: css('c1'), values: s.map(function (m) { return val(m, 'contribution'); }) }, { name: 'Loss from rejections', color: css('mute'), values: s.map(function (m) { return val(m, 'loss'); }) }]);
  }
  function table(head, rows, totalFn) {
    var w = h('div', 'tw'), t = h('table'), th = h('thead'), tr = h('tr');
    head.forEach(function (x) { tr.appendChild(h('th', '', x)); }); th.appendChild(tr); t.appendChild(th);
    var tb = h('tbody');
    rows.forEach(function (r) {
      var row = h('tr', totalFn && totalFn(r) ? 'tot' : '');
      r.forEach(function (c, i) { var td = h('td', typeof c === 'number' && c < 0 ? 'neg' : '', typeof c === 'number' ? nf.format(c) : c); row.appendChild(td); });
      tb.appendChild(row);
    });
    t.appendChild(tb); w.appendChild(t); return w;
  }
  function renderPL() {
    var v = $('#v-pl'); v.replaceChildren();
    var full = state.from === FIRST && state.to === LAST;
    var idx = []; COLS.forEach(function (c, i) { if (i + 1 >= state.from && i + 1 <= state.to) idx.push(i); });
    var head = ['Particulars'].concat(idx.map(function (i) { return MONTHS[i] ? MONTHS[i].label : COLS[i]; }));
    if (full) head.push('Total');
    var rows = D.mis_lines.map(function (r) { var o = [r.line]; idx.forEach(function (i) { o.push(r[COLS[i]]); }); if (full) o.push(r.h1); return o; });
    var c = h('section', 'card'); c.appendChild(h('h2', '', 'Profit and loss, month by month')); c.appendChild(h('p', 'note', 'Rs. lakh, based on sales. Swipe sideways for more months. The total shows when all months are selected.'));
    c.appendChild(table(head, rows, function (r) { return TOTALS.indexOf(r[0]) >= 0; })); v.appendChild(c);
  }
  function renderCheck() {
    var s = sel(), v = $('#v-check'); v.replaceChildren();
    var c = h('section', 'card'); c.appendChild(h('h2', '', 'Cross-check with the cost sheet')); c.appendChild(h('p', 'note', 'Pouring MT on the cost sheet is higher than MIS production every month. The gap is unexplained until the definitions are confirmed.'));
    c.appendChild(table(['Month', 'MIS production', 'Pouring MT', 'Gap'], s.map(function (m) { return [m.label, m.production_mt, m.pouring_mt, Math.round((m.production_mt - m.pouring_mt) * 100) / 100]; }))); v.appendChild(c);
    var n = h('section', 'card'); n.appendChild(h('h2', '', 'To confirm with HO Accounts'));
    var ul = h('ul', 'notes');
    ['July production, despatch and rejection figures repeat May in the published MIS.',
      'Several HO adjustments (material, stock, job-work) were worked out from the published MIS and need their reasons documented.',
      'The 0.06 pattern income in July is shown under storage income.',
      'Transport on sales returns sits in other overheads in June but in selling expenses in September.',
      'Data is a snapshot of the September 2026 MIS. Replace data.js each month to update the app.'].forEach(function (t) { ul.appendChild(h('li', '', t)); });
    n.appendChild(ul); v.appendChild(n);
  }
  var RENDER = { home: renderHome, trends: renderTrends, cust: renderCust, pl: renderPL, check: renderCheck };

  /* ---------- shell ---------- */
  function setupFilters() {
    var f = $('#f-from'), t = $('#f-to'), c = $('#f-cust');
    [f, t].forEach(function (s) { s.replaceChildren(); MONTHS.forEach(function (m) { s.appendChild(new Option(m.label, m.month_no)); }); });
    f.value = state.from; t.value = state.to;
    c.replaceChildren(new Option('All customers', '')); CUSTS.forEach(function (x) { c.appendChild(new Option(x, x)); }); c.value = state.cust;
    var ch = $('#chips'); ch.replaceChildren();
    function add(label, a, z) { var b = h('button', '', label); b.type = 'button'; b.setAttribute('aria-pressed', state.from === a && state.to === z ? 'true' : 'false'); b.addEventListener('click', function () { state.from = a; state.to = z; save(); render(); }); ch.appendChild(b); }
    var nos = MONTHS.map(function (m) { return m.month_no; });
    for (var q = 0; q < 4; q++) { var a = q * 3 + 1, z = q * 3 + 3; if (nos.indexOf(a) >= 0 && nos.indexOf(z) >= 0) add('Q' + (q + 1), a, z); }
    add('All months', FIRST, LAST);
    var s = sel();
    $('#period').textContent = (s.length === 1 ? s[0].label : s[0].label + ' to ' + s[s.length - 1].label) + ' 2026' + (state.cust ? ' · ' + state.cust : '') + ' · Rs. lakh';
  }
  function render() {
    clamp(); setupFilters();
    document.querySelectorAll('.view').forEach(function (e) { e.classList.toggle('on', e.id === 'v-' + state.tab); });
    document.querySelectorAll('nav.tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === state.tab ? 'true' : 'false'); });
    RENDER[state.tab]();
  }
  $('#f-from').addEventListener('change', function (e) { state.from = +e.target.value; if (state.to < state.from) state.to = state.from; save(); render(); });
  $('#f-to').addEventListener('change', function (e) { state.to = +e.target.value; if (state.from > state.to) state.from = state.to; save(); render(); });
  $('#f-cust').addEventListener('change', function (e) { state.cust = e.target.value; save(); render(); });
  $('#f-reset').addEventListener('click', function () { state.from = FIRST; state.to = LAST; state.cust = ''; save(); render(); });
  document.querySelectorAll('nav.tabs button').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }); });
  $('#theme').addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    state.theme = dark ? 'light' : 'dark'; applyTheme(); save(); render();
  });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(render, 150); });
  render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
