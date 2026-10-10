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
  var state = { fy: '2026-27', month: 1, tab: 'in', theme: '', data: {}, ytd: false, dy: 'all', dp: 'fy', dm: 'net_sales', dc: '' };
  var HIST = window.MIS_HIST || { years: {}, contrib: [] };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) for (var k in state) if (sv[k] !== undefined) state[k] = sv[k]; } catch (e) {}
  var hadSaved = false; try { hadSaved = !!localStorage.getItem(KEY); } catch (e) {}
  if (window.MIS_SEED && !hadSaved) { state.fy = window.MIS_SEED.fy; state.month = window.MIS_SEED.month; state.data = JSON.parse(JSON.stringify(window.MIS_SEED.data)); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function applyTheme() { if (state.theme) document.documentElement.setAttribute('data-theme', state.theme); else document.documentElement.removeAttribute('data-theme'); }
  applyTheme();
  function fyData() { return state.data[state.fy] || (state.data[state.fy] = {}); }
  function md(m) { return fyData()[m] || (fyData()[m] = {}); }
  function has(v) { return v !== undefined && v !== null && String(v).trim() !== '' && !isNaN(parseFloat(v)); }
  function num(v) { return has(v) ? parseFloat(v) : 0; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function fyHasEntries(fy) { var o = state.data[fy] || {}; return Object.keys(o).some(function (m) { return hasData(o[m]); }); }
  function histOnly(fy) { return !fyHasEntries(fy) && !!HIST.years[fy]; }
  function hasData(d) { return ALLKEYS.some(function (k) { return has(d[k]); }); }

  /* ---------- the MIS formulas (same as the Excel template) ---------- */
  function calc(m, fy) {
    var fk = fy || state.fy, d = (state.data[fk] || {})[m] || {}, prev = (state.data[fk] || {})[m - 1] || {};
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
    var seg = h('div', 'card'); var sbx = h('div', 'pad'); sbx.style.paddingTop = '14px';
    var vl = h('label', 'dd', 'View'); var vs = document.createElement('select'); vs.id = 'mis-view'; vs.appendChild(new Option('This month only', 'm')); vs.appendChild(new Option('Year to date (Apr to this month)', 'y')); vs.value = state.ytd ? 'y' : 'm';
    vs.addEventListener('change', function () { state.ytd = vs.value === 'y'; save(); renderOut(); }); vl.appendChild(vs); sbx.appendChild(vl); seg.appendChild(sbx); v.appendChild(seg);
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
    var fc = h('div', 'card'); var fh = h('div', 'hd'); fh.style.cursor = 'default'; var fl = h('div'); fl.appendChild(h('h2', '', 'Full MIS by month')); fl.appendChild(h('div', 'sub', 'Every line, Rs. lakh')); fh.appendChild(fl); fc.appendChild(fh);
    var ftw = h('div', 'tw'), ft = h('table'), fth = h('thead'), ftr = h('tr'); ftr.appendChild(h('th', '', 'Particulars')); ms.forEach(function (m) { ftr.appendChild(h('th', '', SHORT[m - 1])); }); ftr.appendChild(h('th', '', 'Total')); fth.appendChild(ftr); ft.appendChild(fth); var ftb = h('tbody');
    LINES.forEach(function (ln) { var r = h('tr', ln[0] === 'sec' ? 'sec' : ln[2] ? 'tot' : ''); if (ln[0] === 'sec') { var td = h('td', '', ln[1]); td.colSpan = ms.length + 2; r.appendChild(td); } else { r.appendChild(h('td', '', ln[1])); ms.forEach(function (m) { r.appendChild(h('td', Ls[m][ln[0]] < -0.005 ? 'neg' : '', fmt(Ls[m][ln[0]]))); }); r.appendChild(h('td', T[ln[0]] < -0.005 ? 'neg' : '', fmt(T[ln[0]]))); } ftb.appendChild(r); });
    ft.appendChild(ftb); ftw.appendChild(ft); fc.appendChild(ftw); v.appendChild(fc);
    var ic = h('div', 'card'); var ih = h('div', 'hd'); ih.style.cursor = 'default'; var il = h('div'); il.appendChild(h('h2', '', 'Every figure entered')); il.appendChild(h('div', 'sub', 'Factory PL feed, HO items, adjustments and statistics')); ih.appendChild(il); ic.appendChild(ih);
    var itw = h('div', 'tw'), it = h('table'), ith = h('thead'), itr = h('tr'); itr.appendChild(h('th', '', 'Item')); ms.forEach(function (m) { itr.appendChild(h('th', '', SHORT[m - 1])); }); ith.appendChild(itr); it.appendChild(ith); var itb = h('tbody');
    SECTIONS.forEach(function (sc) { var sr = h('tr', 'sec'); var sd = h('td', '', sc.title); sd.colSpan = ms.length + 1; sr.appendChild(sd); itb.appendChild(sr);
      sc.fields.forEach(function (f) { if (!ms.some(function (m) { return has(((state.data[state.fy] || {})[m] || {})[f.k]); })) return; var r = h('tr'); r.appendChild(h('td', '', f.l)); ms.forEach(function (m) { var x = ((state.data[state.fy] || {})[m] || {})[f.k]; r.appendChild(h('td', has(x) && num(x) < 0 ? 'neg' : '', has(x) ? fmt(num(x)) : '–')); }); itb.appendChild(r); }); });
    it.appendChild(itb); itw.appendChild(it); ic.appendChild(itw); v.appendChild(ic);
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
    fi.addEventListener('change', function () { var f = fi.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { try { var o = JSON.parse(rd.result); if (typeof o !== 'object' || !o) throw 0; state.data = o; save(); buildInputs(); buildFY(); render(); toast('Backup loaded'); } catch (e) { toast('That file is not a valid backup'); } }; rd.readAsText(f); });
    b2.appendChild(fi); b2.appendChild(mk('alt', 'Load backup file', function () { fi.click(); }));
    c2.appendChild(b2); c2.appendChild(h('p', 'note pad', 'Figures stay on this phone only. Save a backup before clearing browser data.')); v.appendChild(c2);
    if (window.MIS_SEED) {
      var c5 = h('div', 'card'); var h5 = h('div', 'hd'); h5.style.cursor = 'default'; h5.appendChild(h('h2', '', 'Available data')); c5.appendChild(h5);
      var b5 = h('div', 'btns'), a5 = h('div');
      b5.appendChild(mk('alt', 'Reload the supplied figures', function () {
        a5.replaceChildren(); var cf = h('div', 'confirm'); cf.appendChild(h('span', '', 'Replace everything on this phone with the supplied figures?'));
        cf.appendChild(mk('danger', 'Yes, replace', function () { state.fy = window.MIS_SEED.fy; state.data = JSON.parse(JSON.stringify(window.MIS_SEED.data)); state.month = window.MIS_SEED.month; ms.value = state.month; buildFY(); save(); loadInputs(); render(); toast('Supplied figures loaded'); }));
        cf.appendChild(mk('alt', 'Cancel', function () { a5.replaceChildren(); })); a5.appendChild(cf);
      }));
      b5.appendChild(a5); c5.appendChild(b5); v.appendChild(c5);
    }
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


  /* ---------- Data tab: key outputs and cost-sheet contribution, all years ---------- */
  var MEASURES = [['net_sales', 'Net sales (Rs. lakh)'], ['pbt', 'PBT (Rs. lakh)'], ['npo', 'Net profit from operations (Rs. lakh)'], ['storage', 'Storage facility income (Rs. lakh)'], ['production', 'Production (MT)'], ['despatch', 'Despatch (MT)'], ['rejection', 'In-house rejections (MT)'], ['collections', 'Collections incl GST (Rs. lakh)'], ['contribution', 'Contribution, ledger (Rs. lakh)']];
  var CURMAP = { net_sales: 'net', pbt: 'pbt', npo: 'npo', storage: 'stor', production: 'prod', despatch: 'desp', rejection: 'rej', collections: 'coll', contribution: 'contr' };
  var PERIODS = [['fy', 'Full year'], ['q1', 'Q1 (Apr to Jun)'], ['q2', 'Q2 (Jul to Sep)'], ['q3', 'Q3 (Oct to Dec)'], ['q4', 'Q4 (Jan to Mar)']].concat(MONTHS.map(function (n, i) { return ['m' + (i + 1), n]; }));
  var HIDX = { fy: 10, q1: 3, q2: 7, q3: 8, q4: 9, m1: 0, m2: 1, m3: 2, m4: 4, m5: 5, m6: 6 };
  function pMonths(p) { if (p === 'fy') return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; if (p.charAt(0) === 'q') { var q = +p.slice(1); return [q * 3 - 2, q * 3 - 1, q * 3]; } return [+p.slice(1)]; }
  function mval(fy, meas, p) {
    if (fyHasEntries(fy)) { var tot = 0, n = 0; pMonths(p).forEach(function (m) { var d = (state.data[fy] || {})[m]; if (d && hasData(d)) { tot += calc(m, fy)[CURMAP[meas]]; n++; } }); return n ? tot : null; }
    var y = HIST.years[fy]; if (!y || !y[meas]) return null; var i = HIDX[p]; var v = i === undefined ? null : y[meas][i]; return v === undefined ? null : v;
  }
  function hasMonth(fy, m) { var d = (state.data[fy] || {})[m]; return !!(d && hasData(d)); }
  function partialFY(fy, p) { return fyHasEntries(fy) && pMonths(p).some(function (m) { return !hasMonth(fy, m); }); }
  function lfl(fy, prevFy, meas, p) {
    if (!partialFY(fy, p)) return { prev: mval(prevFy, meas, p), label: prevFy };
    var cov = pMonths(p).filter(function (m) { return hasMonth(fy, m); }), qs = [];
    for (var q = 1; q <= 4; q++) { var qm = [q * 3 - 2, q * 3 - 1, q * 3]; if (qm.every(function (m) { return cov.indexOf(m) >= 0; })) qs.push(q); }
    var inQ = cov.every(function (m) { return qs.indexOf(Math.ceil(m / 3)) >= 0; });
    if (!qs.length || !inQ) return { prev: null, label: prevFy };
    var tot = 0; for (var i = 0; i < qs.length; i++) { var x = mval(prevFy, meas, 'q' + qs[i]); if (x === null) return { prev: null, label: prevFy }; tot += x; }
    return { prev: tot, label: prevFy + ' same quarters (Q' + qs[0] + (qs.length > 1 ? ' to Q' + qs[qs.length - 1] : '') + ')' };
  }
  var HCOLS = [['m1', 'Apr'], ['m2', 'May'], ['m3', 'Jun'], ['q1', 'Q1'], ['m4', 'Jul'], ['m5', 'Aug'], ['m6', 'Sep'], ['q2', 'Q2'], ['q3', 'Q3'], ['q4', 'Q4'], ['fy', 'Total']];
  function histTable(fy) {
    var c = card2('Month by month, ' + fy, fyHasEntries(fy) ? 'From the figures entered. Rs. lakh or MT' : 'Published MIS comparison. Rs. lakh or MT');
    var tw = h('div', 'tw'), t = h('table'), th = h('thead'), tr = h('tr'); tr.appendChild(h('th', '', 'Key output')); HCOLS.forEach(function (x) { tr.appendChild(h('th', '', x[1])); }); th.appendChild(tr); t.appendChild(th); var tb = h('tbody');
    MEASURES.forEach(function (m) { var row = h('tr'); row.appendChild(h('td', '', m[1].replace(/ \(.*\)$/, ''))); HCOLS.forEach(function (x) { var q = mval(fy, m[0], x[0]); row.appendChild(h('td', q !== null && q < -0.005 ? 'neg' : (x[0].charAt(0) !== 'm' ? 'sum' : ''), q === null ? 'n/a' : fmt(q))); }); tb.appendChild(row); });
    t.appendChild(tb); tw.appendChild(t); c._p.appendChild(tw); return c;
  }
  var CSLAB = { wt: 'Weight per casting (kg)', pn: 'Pouring (Nos)', t: 'Pouring (MT)', rn: 'In-house rejections (Nos)', dn: 'Destruct tests (Nos)', y: 'Effective yield %', mr: 'Melting raw material Rs/kg', rf: 'Melting refractories etc Rs/kg', ml: 'MLD material Rs/kg', ft: 'FTL material Rs/kg', cp: 'Component Rs/kg', ip: 'Inspection material Rs/kg', sp: 'Special material Rs/kg', pk: 'Packing and painting Rs/kg', tm: 'Total material Rs/kg', od: 'Other direct expenses Rs/kg', lb: 'Labour Rs/kg', pw: 'Power (variable) Rs/kg', tv: 'Total variable cost Rs/kg', sl: 'Effective sale price Rs/kg', ck: 'Contribution Rs/kg', k: 'Contribution Rs lakh', rl: 'Rejection loss Rs lakh', dl: 'Destruct test loss Rs lakh', l: 'Loss of contribution Rs lakh' };
  var csQ = '', csSort = 'k', csLim = 25;
  function renderCSList(box, rows, summ) {
    var q = csQ.trim().toLowerCase(), list = rows.filter(function (r) { return !q || (r.p + ' ' + r.c).toLowerCase().indexOf(q) >= 0; });
    var key = csSort;
    list = list.slice().sort(function (a, b) { var x = a[key], y2 = b[key]; if (key === 'p') return String(x).localeCompare(String(y2)); if (key === 'm') return (a.f + ('0' + a.m).slice(-2)).localeCompare(b.f + ('0' + b.m).slice(-2)); if (key === 'rk') { x = a.t ? a.k * 100 / a.t : 0; y2 = b.t ? b.k * 100 / b.t : 0; } return y2 - x; });
    var tk = 0, tt = 0; list.forEach(function (r) { tk += r.k; tt += r.t; });
    summ.textContent = list.length + ' rows, ' + fmt(tt) + ' MT, contribution ' + fmt(tk) + ' Rs. lakh';
    box.replaceChildren();
    list.slice(0, csLim).forEach(function (r) {
      var it = h('div', 'csr'); it.tabIndex = 0; it.setAttribute('role', 'button'); it.setAttribute('aria-expanded', 'false');
      var top = h('div', 'csr-top'); var l = h('div'); l.appendChild(h('div', 'csr-p', r.p)); l.appendChild(h('div', 'csr-s', r.c + ' · ' + r.f + ' · ' + MONTHS[r.m - 1])); top.appendChild(l);
      var rt = h('div', 'csr-v' + (r.k < 0 ? ' neg' : '')); rt.appendChild(h('b', '', fmt(r.k))); rt.appendChild(h('span', '', fmt(r.t) + ' MT' + (r.t ? ' · ' + fmt(r.k * 100 / r.t) + '/kg' : ''))); top.appendChild(rt); it.appendChild(top);
      var det = h('div', 'csr-d'); det.hidden = true; Object.keys(CSLAB).forEach(function (k) { if (r[k] === undefined) return; var d = h('div'); d.appendChild(h('span', '', CSLAB[k])); d.appendChild(h('b', '', fmt(r[k]))); det.appendChild(d); }); it.appendChild(det);
      var tg = function () { det.hidden = !det.hidden; it.setAttribute('aria-expanded', det.hidden ? 'false' : 'true'); };
      it.addEventListener('click', tg); it.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tg(); } });
      box.appendChild(it);
    });
    if (list.length > csLim) { var mb = h('button', 'btn alt', 'Show ' + Math.min(25, list.length - csLim) + ' more'); mb.type = 'button'; mb.style.marginTop = '.6rem'; mb.addEventListener('click', function () { csLim += 25; renderCSList(box, rows, summ); }); box.appendChild(mb); }
    if (!list.length) box.appendChild(h('div', 'empty', 'No cost-sheet rows match'));
  }
  function fyList() { return allFYs().filter(function (y) { return HIST.years[y] || fyHasEntries(y); }); }
  var YC = ['--y1', '--y2', '--y3', '--y4'];
  function ycol(i, n) { return 'var(' + YC[Math.max(0, 4 - n) + i] + ')'; }
  function sel2(id, label, opts, val, fn) { var l = h('label', 'dd', label), s2 = document.createElement('select'); s2.id = id; opts.forEach(function (o) { s2.appendChild(new Option(o[1], o[0])); }); s2.value = val; s2.addEventListener('change', function () { fn(s2.value); save(); renderData(); }); l.appendChild(s2); return l; }
  function readoutBox() { var r = h('div', 'readout', 'Tap a bar.'); return r; }
  function tapRead(box, title, rows) { box.replaceChildren(); box.appendChild(h('b', '', title)); rows.forEach(function (x) { var d = h('div', 'r'); var l = h('span'); if (x.c) { var i = h('i'); i.style.background = x.c; l.appendChild(i); } l.appendChild(document.createTextNode(x.n)); d.appendChild(l); d.appendChild(h('span', '', x.v)); box.appendChild(d); }); }
  function gbars(host, box, cats, series) {
    var NS = 'http://www.w3.org/2000/svg', w = Math.max(240, host.clientWidth || 320), hg = 210, svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hg); svg.style.width = '100%'; svg.style.display = 'block'; host.appendChild(svg);
    var all = []; series.forEach(function (x) { x.v.forEach(function (q) { if (q !== null) all.push(q); }); });
    if (!all.length) { host.appendChild(h('div', 'empty', 'No figures for this selection')); svg.remove(); return; }
    var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max(0, Math.max.apply(null, all)) || 1, y = function (q) { return 10 + (hi - q) / (hi - lo || 1) * (hg - 36); };
    var ml = 56, band = (w - ml - 4) / cats.length, inner = band * 0.8, bw = inner / series.length - 1.5;
    var mk = function (tag, at, tx) { var e = document.createElementNS(NS, tag); for (var k in at) e.setAttribute(k, at[k]); if (tx !== undefined) e.textContent = tx; svg.appendChild(e); return e; };
    var z = mk('line', { x1: ml, x2: w - 4, y1: y(0), y2: y(0) }); z.style.stroke = 'var(--muted)';
    var top = mk('text', { x: ml - 5, y: y(hi) + 4, 'text-anchor': 'end', 'font-size': 10.5 }, Math.round(hi).toLocaleString('en-IN')); top.style.fill = 'var(--muted)';
    cats.forEach(function (c, ci) {
      var x0 = ml + ci * band + (band - inner) / 2;
      series.forEach(function (sr, si) { var q = sr.v[ci]; if (q === null) return; var r = mk('rect', { x: x0 + si * (bw + 1.5), y: Math.min(y(q), y(0)), width: Math.max(2, bw), height: Math.max(1.5, Math.abs(y(q) - y(0))), rx: 3 }); r.style.fill = sr.c; });
      var t = mk('text', { x: ml + ci * band + band / 2, y: hg - 8, 'text-anchor': 'middle', 'font-size': 10.5 }, c); t.style.fill = 'var(--muted)';
      var hit = mk('rect', { x: ml + ci * band, y: 0, width: band, height: hg - 18, fill: 'transparent' });
      hit.addEventListener('pointerdown', function () { tapRead(box, c, series.map(function (sr) { return { c: sr.c, n: sr.n, v: sr.v[ci] === null ? 'n/a' : fmt(sr.v[ci]) }; })); });
    });
  }
  function legendY(box, items) { var l = h('div', 'leg'); items.forEach(function (it) { var s3 = h('span'); var i = h('i'); i.style.background = it.c; s3.appendChild(i); s3.appendChild(document.createTextNode(it.n)); l.appendChild(s3); }); return l; }
  function card2(title, sub) { var c = h('section', 'card'); var hd = h('div', 'hd'); hd.style.cursor = 'default'; var l = h('div'); l.appendChild(h('h2', '', title)); if (sub) l.appendChild(h('div', 'sub', sub)); hd.appendChild(l); c.appendChild(hd); var p = h('div', 'pad'); c.appendChild(p); c._p = p; return c; }
  function pct1(a, b) { return b ? ((a - b) / Math.abs(b)) * 100 : null; }

  function renderData() {
    var v = $('#v-data'); v.replaceChildren();
    var fys = fyList();
    if (!fys.length) { v.appendChild(h('div', 'card empty', 'No figures yet. Enter a month on the first tab.')); return; }
    if (state.dy !== 'all' && fys.indexOf(state.dy) < 0) state.dy = 'all';
    var fcard = h('section', 'card'); var fp = h('div', 'pad'); fp.style.paddingTop = '14px'; fp.style.display = 'grid'; fp.style.gap = '.6rem';
    fp.appendChild(sel2('d-year', 'Year', [['all', 'All years']].concat(fys.map(function (y) { return [y, y]; })), state.dy, function (x) { state.dy = x; }));
    fp.appendChild(sel2('d-per', 'Period', PERIODS, state.dp, function (x) { state.dp = x; }));
    fp.appendChild(sel2('d-meas', 'Key output', MEASURES, state.dm, function (x) { state.dm = x; }));
    var custs = Array.from(new Set(HIST.contrib.map(function (r) { return r.c; }))).sort();
    if (custs.length) fp.appendChild(sel2('d-cust', 'Customer (cost-sheet contribution)', [['', 'All customers']].concat(custs.map(function (c) { return [c, c]; })), state.dc, function (x) { state.dc = x; }));
    var rb = h('button', 'btn alt', 'Reset filters'); rb.type = 'button'; rb.addEventListener('click', function () { state.dy = 'all'; state.dp = 'fy'; state.dm = 'net_sales'; state.dc = ''; save(); renderData(); }); fp.appendChild(rb);
    fcard.appendChild(fp); v.appendChild(fcard);

    var mname = MEASURES.filter(function (m) { return m[0] === state.dm; })[0][1], pname = PERIODS.filter(function (p) { return p[0] === state.dp; })[0][1];
    var focus = state.dy === 'all' ? fys[fys.length - 1] : state.dy, fi = fys.indexOf(focus), prevFy = fi > 0 ? fys[fi - 1] : null;
    var cur = mval(focus, state.dm, state.dp), pv = prevFy ? lfl(focus, prevFy, state.dm, state.dp) : { prev: null, label: '' }, prv = pv.prev;
    var k = h('div', 'kpis'); var kc = h('div', 'kpi wide'); kc.appendChild(h('div', 'l', mname + ', ' + pname + ', ' + focus + (partialFY(focus, state.dp) ? ' (months entered so far)' : '')));
    kc.appendChild(h('div', 'v' + (cur !== null && cur < -0.005 ? ' neg' : ''), cur === null ? 'n/a' : fmt(cur)));
    var ch = cur !== null && prv !== null ? pct1(cur, prv) : null;
    kc.appendChild(h('div', 'n', ch === null ? (prevFy ? 'No figure for ' + prevFy : 'No earlier year') : (ch > 0 ? '+' : '') + ch.toFixed(1) + '% vs ' + pv.label + ' (' + fmt(prv) + ')')); k.appendChild(kc); v.appendChild(k);

    var shown = state.dy === 'all' ? fys : fys.filter(function (y) { return y === state.dy || y === prevFy; });
    var c1 = card2(mname + ' by year', pname); var hb = h('div', 'chart'); var bx = readoutBox(); c1._p.appendChild(hb); c1._p.appendChild(bx); v.appendChild(c1);
    gbars(hb, bx, shown.map(function (y) { return partialFY(y, state.dp) ? y + '*' : y; }), [{ n: mname, c: 'var(--c1)', v: shown.map(function (y) { return mval(y, state.dm, state.dp); }) }]);

    if (shown.some(function (y) { return partialFY(y, state.dp); })) c1._p.appendChild(h('p', 'note', '* Part year: only the months entered so far.'));
    var c2 = card2(mname + ' by quarter', 'Quarter totals for each year'); var yl = shown.map(function (y, i) { return { n: y, c: ycol(i, shown.length) }; }); c2._p.appendChild(legendY(null, yl));
    var hb2 = h('div', 'chart'), bx2 = readoutBox(); c2._p.appendChild(hb2); c2._p.appendChild(bx2); v.appendChild(c2);
    gbars(hb2, bx2, ['Q1', 'Q2', 'Q3', 'Q4'], shown.map(function (y, i) { return { n: y, c: ycol(i, shown.length), v: ['q1', 'q2', 'q3', 'q4'].map(function (q) { return mval(y, state.dm, q); }) }; }));

    var c3 = card2('All key outputs', pname + ', Rs. lakh or MT'); var tw = h('div', 'tw'), t = h('table'), th = h('thead'), tr = h('tr'); tr.appendChild(h('th', '', 'Key output')); shown.forEach(function (y) { tr.appendChild(h('th', '', y)); });
    if (state.dy !== 'all' && prevFy) tr.appendChild(h('th', '', 'Change')); th.appendChild(tr); t.appendChild(th); var tb = h('tbody');
    MEASURES.forEach(function (m) { var row = h('tr', m[0] === state.dm ? 'tot' : ''); row.appendChild(h('td', '', m[1].replace(/ \(.*\)$/, '')));
      shown.forEach(function (y) { var q = mval(y, m[0], state.dp); row.appendChild(h('td', q !== null && q < -0.005 ? 'neg' : '', q === null ? 'n/a' : fmt(q))); });
      if (state.dy !== 'all' && prevFy) { var a = mval(state.dy, m[0], state.dp), b2 = lfl(state.dy, prevFy, m[0], state.dp).prev, p = a !== null && b2 !== null ? pct1(a, b2) : null; row.appendChild(h('td', p !== null && p < 0 ? 'neg' : '', p === null ? 'n/a' : (p > 0 ? '+' : '') + p.toFixed(1) + '%')); }
      tb.appendChild(row); });
    t.appendChild(tb); tw.appendChild(t); c3._p.appendChild(tw); v.appendChild(c3);
    v.appendChild(histTable(focus));

    if (!HIST.contrib.length) return;
    var months = pMonths(state.dp), inP = function (r) { return months.indexOf(r.m) >= 0; };
    var base = HIST.contrib.filter(function (r) { return inP(r) && (state.dy === 'all' || r.f === state.dy); });
    var by = {}; base.forEach(function (r) { var o = by[r.c] || (by[r.c] = { c: r.c, k: 0, t: 0 }); o.k += r.k; o.t += r.t; });
    var rank = Object.keys(by).map(function (x) { return by[x]; }).sort(function (a, b) { return b.k - a.k; });
    var c4 = card2('Contribution by customer', 'Rs. lakh, cost sheet, ' + (state.dy === 'all' ? 'all years' : state.dy) + ', ' + pname + '. Tap a bar to pick a customer.');
    var NS = 'http://www.w3.org/2000/svg', rh = 36, w = Math.max(240, window.innerWidth - 64), hg = Math.max(70, rank.length * rh + 8), svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + w + ' ' + hg); svg.style.width = '100%'; svg.style.display = 'block';
    var max = Math.max.apply(null, rank.map(function (r) { return Math.max(r.k, 0); }).concat([1])), ml = 118;
    rank.forEach(function (r, i) { var yy = 6 + i * rh, wd = Math.max(3, (w - ml - 50) * Math.max(r.k, 0) / max);
      var tx = document.createElementNS(NS, 'text'); tx.setAttribute('x', ml - 6); tx.setAttribute('y', yy + 16); tx.setAttribute('text-anchor', 'end'); tx.setAttribute('font-size', 11); tx.style.fill = 'var(--muted)'; tx.textContent = r.c.length > 17 ? r.c.slice(0, 16) + '…' : r.c; svg.appendChild(tx);
      var rc = document.createElementNS(NS, 'rect'); rc.setAttribute('x', ml); rc.setAttribute('y', yy); rc.setAttribute('width', wd); rc.setAttribute('height', 24); rc.setAttribute('rx', 4); rc.style.fill = !state.dc || state.dc === r.c ? 'var(--c1)' : 'var(--mute)'; svg.appendChild(rc);
      var vt = document.createElementNS(NS, 'text'); vt.setAttribute('x', ml + wd + 5); vt.setAttribute('y', yy + 16); vt.setAttribute('font-size', 11); vt.style.fill = 'var(--fg)'; vt.textContent = (Math.round(r.k * 10) / 10).toFixed(1); svg.appendChild(vt);
      var hit = document.createElementNS(NS, 'rect'); hit.setAttribute('x', 0); hit.setAttribute('y', yy - 4); hit.setAttribute('width', w); hit.setAttribute('height', rh); hit.setAttribute('fill', 'transparent'); hit.addEventListener('pointerdown', function () { state.dc = state.dc === r.c ? '' : r.c; save(); renderData(); }); svg.appendChild(hit); });
    if (rank.length) c4._p.appendChild(svg); else c4._p.appendChild(h('div', 'empty', 'No cost-sheet rows for this selection')); v.appendChild(c4);

    var fyc = Array.from(new Set(HIST.contrib.map(function (r) { return r.f; }))).sort();
    var c5 = card2('Contribution by year, ' + (state.dc || 'all customers'), 'Rs. lakh, cost sheet, ' + pname); var hb5 = h('div', 'chart'), bx5 = readoutBox(); c5._p.appendChild(hb5); c5._p.appendChild(bx5); v.appendChild(c5);
    gbars(hb5, bx5, fyc, [{ n: 'Contribution', c: 'var(--c1)', v: fyc.map(function (y) { var s4 = 0, n4 = 0; HIST.contrib.forEach(function (r) { if (r.f === y && inP(r) && (!state.dc || r.c === state.dc)) { s4 += r.k; n4++; } }); return n4 ? s4 : null; }) }, { n: 'Loss from rejections', c: 'var(--mute)', v: fyc.map(function (y) { var s4 = 0, n4 = 0; HIST.contrib.forEach(function (r) { if (r.f === y && inP(r) && (!state.dc || r.c === state.dc)) { s4 += r.l; n4++; } }); return n4 ? s4 : null; }) }]);

    var csRows = base.filter(function (r) { return !state.dc || r.c === state.dc; });
    var c6 = card2('Cost sheet, all rows', (state.dc || 'all customers') + ', ' + (state.dy === 'all' ? 'all years' : state.dy) + ', ' + pname + '. Tap a row for every column.');
    var cs1 = h('div', 'cs-tools'); var si = document.createElement('input'); si.type = 'search'; si.id = 'cs-search'; si.placeholder = 'Search product or customer'; si.value = csQ; si.setAttribute('aria-label', 'Search cost sheet');
    var ss = document.createElement('select'); ss.id = 'cs-sort'; ss.setAttribute('aria-label', 'Sort cost sheet'); [['k', 'Sort: contribution'], ['t', 'Sort: tonnage'], ['rk', 'Sort: Rs per kg'], ['l', 'Sort: loss from rejections'], ['m', 'Sort: date'], ['p', 'Sort: product name']].forEach(function (o) { ss.appendChild(new Option(o[1], o[0])); }); ss.value = csSort;
    cs1.appendChild(si); cs1.appendChild(ss); c6._p.appendChild(cs1); var csum = h('p', 'note'), cbox = h('div', 'cs-list'); c6._p.appendChild(csum); c6._p.appendChild(cbox);
    si.addEventListener('input', function () { csQ = si.value; csLim = 25; renderCSList(cbox, csRows, csum); }); ss.addEventListener('change', function () { csSort = ss.value; csLim = 25; renderCSList(cbox, csRows, csum); });
    renderCSList(cbox, csRows, csum); v.appendChild(c6);
  }

  /* ---------- shell ---------- */
  var VIEWS = { in: null, out: renderOut, yr: renderYr, data: renderData, more: renderMore };
  function render() {
    document.querySelectorAll('.view').forEach(function (e) { e.classList.toggle('on', e.id === 'v-' + state.tab); });
    document.querySelectorAll('nav.tabs button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === state.tab ? 'true' : 'false'); });
    var blocked = histOnly(state.fy) && (state.tab === 'in' || state.tab === 'out' || state.tab === 'yr');
    if (blocked) { var vv = $('#v-' + state.tab); vv.replaceChildren(); var nc = h('div', 'card'); var nh = h('div', 'hd'); nh.style.cursor = 'default'; nh.appendChild(h('h2', '', state.fy + ' key figures only')); nc.appendChild(nh);
      var np = h('div', 'pad'); np.appendChild(h('p', 'note', 'For ' + state.fy + ' only the published key figures and the cost-sheet contribution are available, not line-by-line inputs. The published figures are below; the Data tab has filters and the cost sheet.'));
      var nb = h('button', 'btn', 'Open Data tab'); nb.type = 'button'; nb.style.marginTop = '.6rem'; nb.addEventListener('click', function () { state.dy = state.fy; state.tab = 'data'; save(); render(); window.scrollTo(0, 0); }); np.appendChild(nb); nc.appendChild(np); vv.appendChild(nc); vv.appendChild(histTable(state.fy)); }
    else if (VIEWS[state.tab]) VIEWS[state.tab]();
    refresh();
  }
  var ms = $('#month'); MONTHS.forEach(function (n, i) { ms.appendChild(new Option(n, i + 1)); }); ms.value = state.month;
  function allFYs() { var set = {}; Object.keys(HIST.years).forEach(function (k) { set[k] = 1; }); Object.keys(state.data).forEach(function (k) { set[k] = 1; }); set['2026-27'] = 1; set['2027-28'] = 1; set[state.fy] = 1; return Object.keys(set).sort(); }
  function buildFY() { var f = $('#fy'); f.replaceChildren(); allFYs().forEach(function (y) { f.appendChild(new Option(y, y)); }); f.value = state.fy; }
  buildFY();
  ms.addEventListener('change', function () { state.month = +ms.value; save(); loadInputs(); render(); });
  $('#fy').addEventListener('change', function () { state.fy = $('#fy').value; save(); loadInputs(); render(); });
  document.querySelectorAll('nav.tabs button').forEach(function (b) { b.addEventListener('click', function () { state.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }); });
  $('#theme').addEventListener('click', function () {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' || (!document.documentElement.getAttribute('data-theme') && matchMedia('(prefers-color-scheme: dark)').matches);
    state.theme = dark ? 'light' : 'dark'; applyTheme(); save();
  });
  buildInputs(); render();
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__mis = { calc: calc, state: state, md: md };
})();
