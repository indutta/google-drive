(function () {
  'use strict';
  var MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March'];
  var SHORT = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  var nf = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var KEY = 'datre-mis-calc-v1';

  /* ---------- input definition: factory PL feed, HO items, adjustments, statistics ---------- */
  var SECTIONS = [
    { id: 'sales', title: 'Sales and returns', hint: 'Rs. lakh. From the factory PL rows 7 to 10.', fields: [
      { k: 'sale_a', l: 'Actual despatch made (sale ex GST)', n: 'PL row 8a' },
      { k: 'sale_b', l: 'Ready to despatch adjustment', neg: 1, n: 'PL row 8b. Can be negative.' },
      { k: 'sret', l: 'Sales return for the month', n: 'PL row 10' },
      { k: 'rst_op', l: 'Returned goods stock, opening', auto: 'rst_cl', n: 'Fills from last month closing if left blank' },
      { k: 'rst_cl', l: 'Returned goods stock, closing', n: 'PL row 7. Change in stock is closing less opening' },
      { k: 'pat', l: 'Pattern income', n: 'Shown as other business income' },
      { k: 'stor', l: 'Storage facility service charges', n: 'Shown as storage facility income' } ] },
    { id: 'mat', title: 'Materials and stock', hint: 'Rs. lakh. PL rows 1 and 6.', fields: [
      { k: 'basic', l: 'Basic raw material' }, { k: 'cons', l: 'Consumables' }, { k: 'addl', l: 'Additional expense on purchase' },
      { k: 'wip_op', l: 'Work in progress, opening', auto: 'wip_cl', n: 'Fills from last month closing if left blank' },
      { k: 'wip_cl', l: 'Work in progress, closing', n: 'PL row 6' } ] },
    { id: 'job', title: 'Job work', hint: 'Rs. lakh. PL row 2.', fields: [
      { k: 'j1', l: 'Krishna Enterprise, MLT MLD etc' }, { k: 'jqc', l: 'Rahaman Enterprise QC' }, { k: 'j2', l: 'Krishna / Rahaman, FLT' },
      { k: 'j3', l: 'Sree Engineering' }, { k: 'j4', l: 'Tapas Samanta and outside-inside machining' }, { k: 'j5', l: 'Outside heat treatment' }, { k: 'jrad', l: 'Radiography charges' } ] },
    { id: 'pow', title: 'Power', hint: 'Rs. lakh. PL row 3.', fields: [
      { k: 'dem', l: 'Demand charges', n: 'Goes to fixed power cost' }, { k: 'powx', l: 'Power cost excluding demand charge', n: 'Goes to variable power cost' }, { k: 'dg', l: 'DG fuel' } ] },
    { id: 'oth', title: 'Repairs and other factory expenses', hint: 'Rs. lakh. PL rows 4 and 5.', fields: [
      { k: 'repair', l: 'Consumption for plant and machinery maintenance' },
      { k: 'o1', l: 'Machinery maintenance, service' }, { k: 'o2', l: 'Maintenance, building' }, { k: 'o3', l: 'Security expense' }, { k: 'o4', l: 'Manufacturing overhead' },
      { k: 'o5', l: 'Selling and distribution expense' }, { k: 'o6', l: 'Business promotion' }, { k: 'o7', l: 'Transport against sale' },
      { k: 'o8', l: 'Transport on sale return' }, { k: 'o9', l: 'Liquidity damages' } ] },
    { id: 'ho', title: 'HO ledger items', hint: 'Rs. lakh. Not in the factory feed.', fields: [
      { k: 'admin', l: 'Administrative expenses' }, { k: 'sal', l: 'Salary and wages' }, { k: 'defr', l: 'Deferred revenue expenses' },
      { k: 'nonop', l: 'Other non-operating expenses' }, { k: 'dep', l: 'Depreciation' }, { k: 'int', l: 'Interest' },
      { k: 'gst', l: 'GST rate on domestic sales (%)', n: 'Leave blank for 18%', pctf: 1 } ] },
    { id: 'adj', title: 'HO adjustments', hint: 'Rs. lakh. Plus increases the cost or income shown. Note the reason for each.', fields: [
      { k: 'amat', l: 'Material consumed adjustment', neg: 1 }, { k: 'astk', l: '(Increase)/decrease in stock adjustment', neg: 1 },
      { k: 'apow', l: 'Variable power adjustment', neg: 1 }, { k: 'ajob', l: 'Job-work adjustment', neg: 1, n: 'For example QC job work not in the factory feed' },
      { k: 'carve', l: 'Selling expenses carved out of other factory expenses', n: 'Moves cost from other overhead to selling expenses. No PBT effect' },
      { k: 'patre', l: 'Pattern income shown under storage income', n: 'Moves income between the two lines. No PBT effect' } ] },
    { id: 'stat', title: 'Statistics', hint: 'MT for tonnage, Rs. lakh for collections.', fields: [
      { k: 'prod', l: 'Production (MT)' }, { k: 'desp', l: 'Despatch (MT)' }, { k: 'rej', l: 'In-house rejections (MT)' }, { k: 'coll', l: 'Collections including GST (Rs. lakh)' } ] }
  ];
  var ALLKEYS = []; SECTIONS.forEach(function (s) { s.fields.forEach(function (f) { ALLKEYS.push(f.k); }); });

  /* ---------- state ---------- */
  var state = { fy: '2026-27', month: 1, tab: 'in', theme: '', data: {}, ytd: false };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) for (var k in state) if (sv[k] !== undefined) state[k] = sv[k]; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function applyTheme() { if (state.theme) document.documentElement.setAttribute('data-theme', state.theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();
  function fyData() { return state.data[state.fy] || (state.data[state.fy] = {}); }
  function md(m) { return fyData()[m] || (fyData()[m] = {}); }
  function has(v) { return v !== undefined && v !== null && String(v).trim() !== '' && !isNaN(parseFloat(v)); }
  function num(v) { return has(v) ? parseFloat(v) : 0; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function hasData(d) { return ALLKEYS.some(function (k) { return has(d[k]); }); }

  /* ---------- the MIS formulas (same as the Excel template) ---------- */
  function calc(m) {
    var d = md(m), prev = (state.data[state.fy] || {})[m - 1] || {};
    var g = function (k) { return num(d[k]); };
    var gst = has(d.gst) ? num(d.gst) : 18;
    var L = {};
    L.sex = g('sale_a') + g('sale_b');
    L.gst = r2(L.sex * gst / 100);
    L.sinc = L.sex + L.gst;
    L.ret = g('sret');
    L.net = L.sex - L.ret;
    L.oinc = g('pat') - g('patre');
    var rop = has(d.rst_op) ? num(d.rst_op) : has(prev.rst_cl) ? num(prev.rst_cl) : 0;
    L.srg = has(d.rst_cl) ? num(d.rst_cl) - rop : 0;
    L.sub = L.net + L.oinc + L.srg;
    L.matpl = g('basic') + g('cons') + g('addl');
    L.mat = L.matpl + g('amat');
    var wop = has(d.wip_op) ? num(d.wip_op) : has(prev.wip_cl) ? num(prev.wip_cl) : 0;
    L.wipchg = has(d.wip_cl) ? num(d.wip_cl) - wop : 0;
    L.stk = -L.wipchg + g('astk');
    L.powv = g('powx') + g('dg') + g('apow');
    L.job = g('j1') + g('jqc') + g('j2') + g('j3') + g('j4') + g('j5') + g('jrad') + g('ajob');
    L.nvc = L.mat + L.stk + L.powv + L.job;
    L.contr = L.sub - L.nvc;
    L.adm = g('admin');
    L.rep = g('repair');
    L.othtot = g('o1') + g('o2') + g('o3') + g('o4') + g('o5') + g('o6') + g('o7') + g('o8') + g('o9');
    L.omo = L.othtot - g('carve');
    L.sal = g('sal');
    L.powf = g('dem');
    L.sell = g('carve');
    L.tfc = L.adm + L.rep + L.omo + L.sal + L.powf + L.sell;
    L.npo = L.contr - L.tfc;
    L.pad = L.npo - g('defr') - g('nonop');
    L.stor = g('stor') + g('patre');
    L.ebitda = L.pad + L.stor;
    L.pbt = L.ebitda - g('dep') - g('int');
    L.prod = g('prod'); L.desp = g('desp'); L.rej = g('rej'); L.coll = g('coll');
    L.real = g('desp') ? g('sale_a') / g('desp') : 0;
    return L;
  }
  var LINES = [
    ['sec', 'Turnover'], ['sinc', 'Sales domestic (incl GST)'], ['gst', 'Less GST'], ['sex', 'Sales domestic (ex GST)'], ['ret', 'Less: sales return'], ['net', 'Net sales', 1],
    ['oinc', 'Other business income'], ['srg', 'Stock of return goods'], ['sub', 'Net turnover for contribution', 1],
    ['sec', 'Variable costs'], ['mat', 'Material consumed'], ['stk', '(Increase)/decrease in stock'], ['powv', 'Power and fuel (variable)'], ['job', 'Job-work charges'], ['nvc', 'Total net variable costs', 1],
    ['contr', 'Contribution', 1],
    ['sec', 'Fixed costs'], ['adm', 'Administrative expenses'], ['rep', 'Repair and maintenance'], ['omo', 'Other manufacturing overhead'], ['sal', 'Salary and wages'], ['powf', 'Power and fuel (fixed)'], ['sell', 'Selling expenses'], ['tfc', 'Total fixed costs', 1],
    ['npo', 'Net profit from operations', 1], ['stor', 'Storage facility income'], ['ebitda', 'EBITDA', 1], ['pbt', 'PBT', 1]
  ];
  var SUMKEYS = LINES.filter(function (l) { return l[0] !== 'sec'; }).map(function (l) { return l[0]; }).concat(['prod', 'desp', 'rej', 'coll', 'wipchg']);
  function lastMonth() { return state.month; }
  function ytd(upto) {
    var T = {}; SUMKEYS.forEach(function (k) { T[k] = 0; }); var n = 0;
    for (var m = 1; m <= upto; m++) { var d = (state.data[state.fy] || {})[m]; if (d && hasData(d)) { var L = calc(m); SUMKEYS.forEach(function (k) { T[k] += L[k]; }); n++; } }
    T._n = n; return T;
  }
  function fmt(v) { return nf.format(Math.abs(v) < 0.005 ? 0 : v); }
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function toast(msg) { var t = h('div', 'toast', msg); document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }

  /* ---------- Enter view ---------- */
  var inputs = {};
  function buildInputs() {
    var v = $('#v-in'); v.replaceChildren(); inputs = {};
    SECTIONS.forEach(function (s, si) {
      var det = h('details', 'card'); if (si === 0) det.open = true;
      var sum = h('summary'); var left = h('div'); left.appendChild(h('h2', '', s.title)); left.appendChild(h('div', 'sub', s.hint)); sum.appendChild(left);
      var badge = h('span', 'badge'); badge.id = 'bd-' + s.id; sum.appendChild(badge);
      sum.insertAdjacentHTML('beforeend', '<svg class="chev" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>');
      det.appendChild(sum);
      var box = h('div', 'fields');
      s.fields.forEach(function (f) {
        var row = h('div', 'f'); var lab = h('label', 'l', f.l); var id = 'in-' + f.k; lab.htmlFor = id; row.appendChild(lab);
        var wrap = h('div', 'in');
        var inp = document.createElement('input'); inp.id = id; inp.type = 'text'; inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.setAttribute('enterkeyhint', 'next'); inp.placeholder = '0.00';
        inp.addEventListener('input', function () {
          var val = inp.value.replace(/,/g, '').replace(/[^0-9.\-]/g, ''); if (val !== inp.value) inp.value = val;
          md(state.month)[f.k] = val; save(); refresh();
        });
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var all = Array.prototype.slice.call(document.querySelectorAll('#v-in input')); var i = all.indexOf(inp); if (all[i + 1]) { var nx = all[i + 1]; var d = nx.closest('details'); if (d) d.open = true; nx.focus(); } else inp.blur(); } });
        wrap.appendChild(inp);
        if (f.neg) { var sg = h('button', 'sign', '±'); sg.type = 'button'; sg.setAttribute('aria-label', 'Change sign of ' + f.l); sg.addEventListener('click', function () { var c = inp.value.trim(); if (!c) { inp.value = '-'; inp.focus(); } else inp.value = c.charAt(0) === '-' ? c.slice(1) : '-' + c; md(state.month)[f.k] = inp.value; save(); refresh(); }); wrap.appendChild(sg); }
        row.appendChild(wrap);
        if (f.n) row.appendChild(h('div', 'n', f.n));
        box.appendChild(row); inputs[f.k] = inp;
      });
      det.appendChild(box); v.appendChild(det);
    });
    loadInputs();
  }
  function loadInputs() {
    var d = md(state.month), prev = (state.data[state.fy] || {})[state.month - 1] || {};
    SECTIONS.forEach(function (s) { s.fields.forEach(function (f) {
      var inp = inputs[f.k]; inp.value = d[f.k] !== undefined ? d[f.k] : '';
      if (f.auto) { var pv = prev[f.auto]; inp.placeholder = has(pv) ? String(pv) : '0.00'; inp.classList.toggle('auto', !has(d[f.k]) && has(pv)); } else inp.placeholder = f.pctf ? '18' : '0.00';
    }); });
  }
  function updateBadges() {
    var d = md(state.month);
    SECTIONS.forEach(function (s) { var n = s.fields.filter(function (f) { return has(d[f.k]); }).length, b = $('#bd-' + s.id); if (!b) return; b.textContent = n + ' of ' + s.fields.length; b.classList.toggle('ok', n === s.fields.length); });
  }
  function updateLive() {
    var L = calc(state.month), live = $('#live'); live.replaceChildren();
    var box = h('div');
    [['Contribution', L.contr], ['Operating profit', L.npo], ['PBT', L.pbt]].forEach(function (x) {
      var c = h('div'); c.appendChild(h('span', '', x[0])); var b = h('b', x[1] < -0.005 ? 'neg' : '', fmt(x[1])); c.appendChild(b); box.appendChild(c);
    });
    live.appendChild(box);
    live.style.display = state.tab === 'in' ? 'flex' : 'none';
  }
  function refresh() { updateBadges(); updateLive(); }

  /* ---------- MIS view ---------- */
  function checks(m, L) {
    var d = md(m), prev = (state.data[state.fy] || {})[m - 1] || {}, out = [];
    if (!hasData(d)) return [['warn', 'No figures entered for ' + MONTHS[m - 1] + ' yet.']];
    if (has(d.sale_a) && !has(d.wip_cl)) out.push(['warn', 'Closing work in progress is blank, so no stock change is included.']);
    if (!has(d.admin) || !has(d.sal)) out.push(['warn', 'Administrative expenses or salary and wages are blank. They come from HO ledgers, not the factory feed.']);
    if (!has(d.desp) || !has(d.prod)) out.push(['warn', 'Production or despatch tonnage is blank.']);
    var dup = ['prod', 'desp', 'rej'].every(function (k) { return has(d[k]) && has(prev[k]) && num(d[k]) === num(prev[k]); });
    if (dup) out.push(['warn', 'Production, despatch and rejections are identical to last month. Check they were not copied forward.']);
    var adj = ['amat', 'astk', 'apow', 'ajob'].filter(function (k) { return Math.abs(num(d[k])) > 0.02; });
    if (adj.length) out.push(['warn', adj.length + ' HO adjustment' + (adj.length > 1 ? 's' : '') + ' entered. Make sure each has a documented reason.']);
    if (L.contr < 0) out.push(['warn', 'Contribution is negative this month.']);
    if (!out.length) out.push(['good', 'No issues found in the figures entered.']);
    return out;
  }
  function renderOut() {
    var v = $('#v-out'); v.replaceChildren(); var m = state.month, L = state.ytd ? ytd(m) : calc(m);
    var seg = h('div', 'card'); var sb = h('div', 'btns'); sb.style.flexDirection = 'row'; sb.style.paddingTop = '14px';
    [['Month', false], ['Year to date', true]].forEach(function (x) { var b = h('button', 'btn' + (state.ytd === x[1] ? '' : ' alt'), x[0]); b.style.flex = '1'; b.type = 'button'; b.addEventListener('click', function () { state.ytd = x[1]; save(); renderOut(); }); sb.appendChild(b); });
    seg.appendChild(sb); v.appendChild(seg);
    var title = state.ytd ? 'Apr to ' + SHORT[m - 1] + ' ' + state.fy + (L._n ? ' (' + L._n + ' month' + (L._n > 1 ? 's' : '') + ' with figures)' : '') : MONTHS[m - 1] + ' ' + state.fy;
    var k = h('div', 'kpis');
    var kp = function (label, val, note, wide) { var c = h('div', 'kpi' + (wide ? ' wide' : '')); c.appendChild(h('div', 'l', label)); c.appendChild(h('div', 'v' + (val < -0.005 ? ' neg' : ''), fmt(val))); c.appendChild(h('div', 'n', note)); return c; };
    k.appendChild(kp('Net sales', L.net, title + ', Rs. lakh', true));
    k.appendChild(kp('Contribution', L.contr, L.net ? (L.contr / L.net * 100).toFixed(1) + '% of net sales' : 'Rs. lakh'));
    k.appendChild(kp('PBT', L.pbt, 'Rs. lakh'));
    v.appendChild(k);
    var card = h('div', 'card'); var hd = h('div', 'hd'); var hl = h('div'); hl.appendChild(h('h2', '', 'Profit and loss')); hl.appendChild(h('div', 'sub', title + ', Rs. lakh')); hd.appendChild(hl); hd.style.cursor = 'default'; card.appendChild(hd);
    var tw = h('div', 'tw'), t = h('table'), tb = h('tbody');
    LINES.forEach(function (ln) {
      var tr = h('tr', ln[0] === 'sec' ? 'sec' : ln[2] ? 'tot' : '');
      if (ln[0] === 'sec') { var td = h('td', '', ln[1]); td.colSpan = 2; tr.appendChild(td); }
      else { tr.appendChild(h('td', '', ln[1])); tr.appendChild(h('td', L[ln[0]] < -0.005 ? 'neg' : '', fmt(L[ln[0]]))); }
      tb.appendChild(tr);
    });
    t.appendChild(tb); tw.appendChild(t); card.appendChild(tw); v.appendChild(card);
    var st = h('div', 'card'); var sh = h('div', 'hd'); sh.appendChild(h('h2', '', 'Statistics')); sh.style.cursor = 'default'; st.appendChild(sh);
    var tw2 = h('div', 'tw'), t2 = h('table'), tb2 = h('tbody');
    [['Production (MT)', L.prod], ['Despatch (MT)', L.desp], ['In-house rejections (MT)', L.rej]].concat(state.ytd ? [] : [['Realisation per MT (Rs. lakh)', L.real]]).concat([['Collections incl GST', L.coll]]).forEach(function (r) { var tr = h('tr'); tr.appendChild(h('td', '', r[0])); tr.appendChild(h('td', '', fmt(r[1]))); tb2.appendChild(tr); });
    t2.appendChild(tb2); tw2.appendChild(t2); st.appendChild(tw2); v.appendChild(st);
    var ck = h('div', 'card'); var ch = h('div', 'hd'); ch.appendChild(h('h2', '', 'Checks for ' + MONTHS[m - 1])); ch.style.cursor = 'default'; ck.appendChild(ch);
    var cl = h('div', 'chk'); checks(m, calc(m)).forEach(function (c) { cl.appendChild(h('div', c[0], c[1])); }); ck.appendChild(cl); v.appendChild(ck);
  }

  /* ---------- Year view ---------- */
  function renderYr() {
    var v = $('#v-yr'); v.replaceChildren(); var ms = [];
    for (var m = 1; m <= 12; m++) { var d = (state.data[state.fy] || {})[m]; if (d && hasData(d)) ms.push(m); }
    if (!ms.length) { v.appendChild(h('div', 'card empty', 'No months entered yet for ' + state.fy + '. Enter figures on the first tab.')); return; }
    var rows = [['net', 'Net sales'], ['contr', 'Contribution'], ['tfc', 'Fixed costs'], ['npo', 'Operating profit'], ['stor', 'Storage income'], ['pbt', 'PBT']];
    var Ls = {}; ms.forEach(function (m) { Ls[m] = calc(m); }); var T = ytd(12);
    var card = h('div', 'card'); var hd = h('div', 'hd'); var hl = h('div'); hl.appendChild(h('h2', '', 'Year ' + state.fy)); hl.appendChild(h('div', 'sub', 'Rs. lakh, months with figures')); hd.appendChild(hl); hd.style.cursor = 'default'; card.appendChild(hd);
    var tw = h('div', 'tw'), t = h('table'), th = h('thead'), tr = h('tr'); tr.appendChild(h('th', '', 'Line')); ms.forEach(function (m) { tr.appendChild(h('th', '', SHORT[m - 1])); }); tr.appendChild(h('th', '', 'Total')); th.appendChild(tr); t.appendChild(th);
    var tb = h('tbody');
    rows.forEach(function (r) { var row = h('tr', r[0] === 'pbt' ? 'tot' : ''); row.appendChild(h('td', '', r[1])); ms.forEach(function (m) { row.appendChild(h('td', Ls[m][r[0]] < -0.005 ? 'neg' : '', fmt(Ls[m][r[0]]))); }); row.appendChild(h('td', T[r[0]] < -0.005 ? 'neg' : '', fmt(T[r[0]]))); tb.appendChild(row); });
    t.appendChild(tb); tw.appendChild(t); card.appendChild(tw); v.appendChild(card);
    var bc = h('div', 'card'); var bh = h('div', 'hd'); bh.appendChild(h('h2', '', 'PBT by month')); bh.style.cursor = 'default'; bc.appendChild(bh);
    var pad = h('div', 'pad'); var w = Math.max(260, Math.min(600, window.innerWidth - 64)), hgt = 170, svgNS = 'http://www.w3.org/2000/svg';
    var vals = ms.map(function (m) { return Ls[m].pbt; }), lo = Math.min(0, Math.min.apply(null, vals)), hi = Math.max(0, Math.max.apply(null, vals)) || 1;
    var y = function (x) { return 10 + (hi - x) / (hi - lo || 1) * (hgt - 36); };
    var svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hgt); svg.style.width = '100%'; svg.style.display = 'block';
    var band = (w - 8) / ms.length, bw = Math.min(40, band * 0.6);
    var z = document.createElementNS(svgNS, 'line'); z.setAttribute('x1', 4); z.setAttribute('x2', w - 4); z.setAttribute('y1', y(0)); z.setAttribute('y2', y(0)); z.style.stroke = 'var(--muted)'; svg.appendChild(z);
    ms.forEach(function (m, i) {
      var x = 4 + i * band + (band - bw) / 2, val = vals[i], rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', Math.min(y(val), y(0))); rect.setAttribute('width', bw); rect.setAttribute('height', Math.max(1.5, Math.abs(y(val) - y(0)))); rect.setAttribute('rx', 3); rect.style.fill = val < 0 ? 'var(--bad)' : 'var(--c1)'; svg.appendChild(rect);
      var tx = document.createElementNS(svgNS, 'text'); tx.setAttribute('x', x + bw / 2); tx.setAttribute('y', hgt - 6); tx.setAttribute('text-anchor', 'middle'); tx.setAttribute('font-size', '11'); tx.style.fill = 'var(--muted)'; tx.textContent = SHORT[m - 1]; svg.appendChild(tx);
      var vt = document.createElementNS(svgNS, 'text'); vt.setAttribute('x', x + bw / 2); vt.setAttribute('y', val < 0 ? y(val) + 12 : y(val) - 4); vt.setAttribute('text-anchor', 'middle'); vt.setAttribute('font-size', '10.5'); vt.style.fill = 'var(--fg)'; vt.textContent = (Math.round(val * 10) / 10).toFixed(1); svg.appendChild(vt);
    });
    pad.appendChild(svg); bc.appendChild(pad); v.appendChild(bc);
  }

  /* ---------- More view ---------- */
  function summaryText(m, useYtd) {
    var L = useYtd ? ytd(m) : calc(m), t = 'Datre MIS ' + (useYtd ? 'Apr to ' + SHORT[m - 1] : MONTHS[m - 1]) + ' ' + state.fy + ' (Rs. lakh)\n';
    [['net', 'Net sales'], ['contr', 'Contribution'], ['tfc', 'Fixed costs'], ['npo', 'Operating profit'], ['stor', 'Storage income'], ['pbt', 'PBT']].forEach(function (r) { t += r[1] + ': ' + fmt(L[r[0]]) + '\n'; });
    t += 'Production ' + fmt(L.prod) + ' MT, despatch ' + fmt(L.desp) + ' MT'; return t;
  }
  function share(text, title) {
    if (navigator.share) navigator.share({ title: title, text: text }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); }, function () { toast('Could not copy'); });
    else toast('Sharing is not available');
  }
  function renderMore() {
    var v = $('#v-more'); v.replaceChildren();
    var c1 = h('div', 'card'); var hd = h('div', 'hd'); hd.style.cursor = 'default'; hd.appendChild(h('h2', '', 'Share')); c1.appendChild(hd);
    var b1 = h('div', 'btns');
    var mk = function (cls, text, fn) { var b = h('button', 'btn ' + cls, text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    b1.appendChild(mk('', 'Share ' + SHORT[state.month - 1] + ' summary', function () { share(summaryText(state.month, false), 'Datre MIS'); }));
    b1.appendChild(mk('alt', 'Share year to date summary', function () { share(summaryText(state.month, true), 'Datre MIS year to date'); }));
    c1.appendChild(b1); v.appendChild(c1);
    var c2 = h('div', 'card'); var h2 = h('div', 'hd'); h2.style.cursor = 'default'; h2.appendChild(h('h2', '', 'Backup')); c2.appendChild(h2);
    var b2 = h('div', 'btns');
    b2.appendChild(mk('alt', 'Save backup file', function () {
      try { var blob = new Blob([JSON.stringify(state.data)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'datre-mis-backup-' + state.fy + '.json'; document.body.appendChild(a); a.click(); a.remove(); toast('Backup saved'); } catch (e) { toast('Could not save'); }
    }));
    var fi = document.createElement('input'); fi.type = 'file'; fi.accept = 'application/json,.json'; fi.hidden = true; fi.id = 'imp';
    fi.addEventListener('change', function () { var f = fi.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { var o = JSON.parse(rd.result); if (typeof o !== 'object' || !o) throw 0; state.data = o; save(); buildInputs(); render(); toast('Backup loaded'); } catch (e) { toast('That file is not a valid backup'); } }; rd.readAsText(f); });
    b2.appendChild(fi); b2.appendChild(mk('alt', 'Load backup file', function () { fi.click(); }));
    c2.appendChild(b2); c2.appendChild(h('p', 'note pad', 'Figures stay on this phone only. Save a backup before clearing browser data.')); v.appendChild(c2);
    var c3 = h('div', 'card'); var h3 = h('div', 'hd'); h3.style.cursor = 'default'; h3.appendChild(h('h2', '', 'Clear figures')); c3.appendChild(h3);
    var b3 = h('div', 'btns'); var area = h('div');
    b3.appendChild(mk('danger', 'Clear ' + MONTHS[state.month - 1] + ' figures', function () {
      area.replaceChildren(); var cf = h('div', 'confirm'); cf.appendChild(h('span', '', 'Clear all figures for ' + MONTHS[state.month - 1] + '?'));
      cf.appendChild(mk('danger', 'Yes, clear', function () { delete fyData()[state.month]; save(); loadInputs(); refresh(); area.replaceChildren(); toast('Cleared'); }));
      cf.appendChild(mk('alt', 'Cancel', function () { area.replaceChildren(); })); area.appendChild(cf);
    }));
    b3.appendChild(area); c3.appendChild(b3); v.appendChild(c3);
    var c4 = h('div', 'card'); var h4 = h('div', 'hd'); h4.style.cursor = 'default'; h4.appendChild(h('h2', '', 'How it works')); c4.appendChild(h4);
    var p = h('div', 'pad');
    ['Enter the factory PL figures, HO ledger items and adjustments for a month. The MIS is worked out with the same formulas as the HO Accounts Excel template.',
      'Opening work in progress and returned goods stock fill from the previous month closing.',
      'Sales ex GST is the actual despatch value plus the ready-to-despatch adjustment. GST is the rate on that amount.',
      'Contribution is net turnover less material, stock change, variable power and job work. PBT is after fixed costs, storage income, depreciation and interest.'].forEach(function (t) { p.appendChild(h('p', 'note', t)); });
    c4.appendChild(p); v.appendChild(c4);
  }

  /* ---------- shell ---------- */
  var VIEWS = { in: null, out: renderOut, yr: renderYr, more: renderMore };
  function render() {
    document.querySelectorAll('.view').forEach(function (e) { e.classList.toggle('on', e.id === 'v-' + state.tab); });
    document.querySelectorAll('nav.tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === state.tab ? 'true' : 'false'); });
    if (VIEWS[state.tab]) VIEWS[state.tab]();
    refresh();
  }
  var ms = $('#month'); MONTHS.forEach(function (n, i) { ms.appendChild(new Option(n, i + 1)); }); ms.value = state.month;
  $('#fy').value = state.fy;
  ms.addEventListener('change', function () { state.month = +ms.value; save(); loadInputs(); render(); });
  $('#fy').addEventListener('change', function () { var v = $('#fy').value.trim() || '2026-27'; state.fy = v; save(); loadInputs(); render(); });
  document.querySelectorAll('nav.tabs button').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }); });
  $('#theme').addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    state.theme = dark ? 'light' : 'dark'; applyTheme(); save();
  });
  buildInputs(); render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__mis = { calc: calc, state: state, md: md };
})();
