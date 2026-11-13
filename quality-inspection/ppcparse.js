/* DCL – reads the PPC "Daily Performance Report" (DCL/PPC/05) from the text positions of its PDF pages.
   Input: pages = [ [ {x, y, w, s}, ... ], ... ] where x = left edge, y = distance from the top, w = width, s = text.
   Page 1 holds production, despatch and the "Castings on progress in factory" (WIP) table by customer;
   page 2 holds the pouring status by item.  Works from positions, so wrapped names and empty cells are handled. */
(function () {
  'use strict';
  const NUM = /^-?\(?[\d,]*\.?\d+\)?$/;
  const isNum = (s) => NUM.test(s) || s === '-';
  const val = (s) => (s === '-' ? 0 : parseFloat(String(s).replace(/[(),]/g, '')) || 0);
  const right = (i) => i.x + i.w;
  const cluster = (items, tol) => {            // group items into lines by y
    const a = items.slice().sort((p, q) => p.y - q.y || p.x - q.x), out = [];
    a.forEach((i) => { const l = out[out.length - 1]; if (l && Math.abs(i.y - l.y) <= tol) { l.items.push(i); l.y = (l.y * (l.items.length - 1) + i.y) / l.items.length; } else out.push({ y: i.y, items: [i] }); });
    out.forEach((l) => l.items.sort((p, q) => p.x - q.x));
    return out;
  };
  const words = (items) => items.slice().sort((p, q) => Math.round(p.y / 3) - Math.round(q.y / 3) || p.x - q.x).map((i) => i.s).join(' ').replace(/\s+/g, ' ').trim();

  function parseDaily(pages) {
    const warn = [], p1 = pages[0] || [], p2 = pages[1] || [];
    const has = (p, w) => p.some((i) => i.s === w);
    if (!has(p1, 'DAILY') || !has(p1, 'PERFORMANCE')) return { error: 'This does not look like the PPC Daily Performance Report.' };
    const d = p1.filter((i) => /^\d\d\.\d\d\.\d\d$/.test(i.s)).sort((a, b) => a.y - b.y)[0];
    if (!d) return { error: 'The report date was not found.' };
    const asOn = '20' + d.s.slice(6, 8) + '-' + d.s.slice(3, 5) + '-' + d.s.slice(0, 2);

    /* ---- WIP by customer (right table of page 1) ---- */
    const hdr = p1.filter((i) => i.s === 'Customer' && i.y < 80 && i.x > 150).sort((a, b) => a.x - b.x)[0];
    let wip = [], wipTotal = null;
    if (!hdr) warn.push('The WIP table was not found on page 1.');
    else {
      const xC = hdr.x, yH = hdr.y;
      const tot = p1.find((i) => i.s === 'TOTAL' && i.x > xC - 15 && i.x < xC + 10 && i.y > yH);
      const yEnd = tot ? tot.y + 2 : yH + 220;
      const reg = p1.filter((i) => i.x >= xC - 12 && i.y > yH + 8 && i.y < yEnd + 4);
      const nums = reg.filter((i) => i.x >= xC + 25 && isNum(i.s));
      const rows = cluster(nums, 2.2).filter((l) => l.items.length >= 6 && !(tot && Math.abs(l.y - tot.y) < 3));
      const names = reg.filter((i) => i.x < xC + 25 && !isNum(i.s) && i.y < yEnd - 2);
      rows.forEach((r) => { r.name = []; });
      names.forEach((n) => { let best = null; rows.forEach((r) => { const dy = Math.abs(r.y - n.y); if (!best || dy < best.dy) best = { r, dy }; }); if (best && best.dy <= 9) best.r.name.push(n); });
      rows.forEach((r) => {
        const v = r.items.slice(-6).map((i) => val(i.s)); const name = words(r.name);
        if (!name) { warn.push('A WIP row without a customer name was skipped: ' + JSON.stringify(v)); return; }
        wip.push({ customer: name, movMT: v[0], movLac: v[1], nonMT: v[2], nonLac: v[3], totMT: v[4], totLac: v[5] });
      });
      if (tot) { const t = cluster(p1.filter((i) => Math.abs(i.y - tot.y) < 3 && i.x > xC + 25 && isNum(i.s)), 3)[0]; if (t && t.items.length >= 6) wipTotal = t.items.slice(-6).map((i) => val(i.s)); }
      if (wipTotal) { const s = wip.reduce((a, r) => a + r.totMT, 0); if (Math.abs(s - wipTotal[4]) > 0.06) warn.push(`WIP rows add up to ${s.toFixed(2)} MT but the report total is ${wipTotal[4]} MT. Please check the figures.`); }
      wip = wip.map((r) => ({ customer: r.customer, movMT: r.movMT, movLac: r.movLac, nonMT: r.nonMT, nonLac: r.nonLac }));
    }

    /* ---- production and despatch (left table of page 1) ---- */
    const left = p1.filter((i) => i.x < 200);
    const rowAt = (y) => left.filter((i) => Math.abs(i.y - y) < 2.5 && isNum(i.s) && i.x > 70).sort((a, b) => a.x - b.x).map((i) => val(i.s));
    const lab = (a, b) => left.find((i) => i.s === a && i.x < 60 && (!b || left.some((j) => j.s === b && Math.abs(j.y - i.y) < 2.5 && j.x > i.x && j.x < i.x + 40)));
    const kpi = {};
    const gc = lab('GC', '(MT)'); if (gc) { const v = rowAt(gc.y); if (v.length >= 6) kpi.gc = { target: v[0], daily: v[1], month: v[2], rate: v[3], year: v[4], value: v[5] }; }
    const mm = lab('MM', '(Nos)'); if (mm) { const v = rowAt(mm.y); if (v.length >= 4) kpi.mm = { daily: v[v.length - 4], month: v[v.length - 3] }; }
    const dp = left.find((i) => i.s === '(Ton)' && i.x < 90);
    if (dp) { const v = rowAt(dp.y); if (v.length >= 5) kpi.desp = { target: v[0], daily: v[1], month: v[2], rate: v[3], year: v[4] }; }
    const yl = lab('Yield', '(%)'); if (yl) { const v = rowAt(yl.y); if (v.length >= 3) kpi.yieldPct = v[1]; }

    /* ---- pouring status by item (page 2) ---- */
    const pouring = [];
    if (!p2.length || !has(p2, 'Pouring')) warn.push('The pouring status page was not found.');
    else {
      const hn = p2.filter((i) => (i.s === '(Nos)' || i.s === '(kg/Ton)') && i.y > 75 && i.y < 95).sort((a, b) => a.x - b.x).map(right);
      const hk = p2.find((i) => i.s === '(kg)' && i.y > 70 && i.y < 95 && i.x > 150 && i.x < 215);
      if (hn.length < 6 || !hk) warn.push('The pouring status column headings were not recognised.');
      else {
        const anchors = [right(hk)].concat(hn.slice(0, 6));            // unit wt, order qty, order wt, plan qty, plan wt, poured qty, poured wt
        const body = p2.filter((i) => i.y > 100);
        const num = body.filter((i) => isNum(i.s) && i.x > 150 && i.x < 380);
        const lines = cluster(num, 2.2).map((l) => {
          const col = {}; l.items.forEach((i) => { let b = -1, bd = 9; anchors.forEach((a, k) => { const dd = Math.abs(right(i) - a); if (dd < bd) { bd = dd; b = k; } }); if (b >= 0 && col[b] == null) col[b] = val(i.s); });
          return { y: l.y, col };
        }).filter((l) => l.col[0] != null && l.col[1] != null && l.col[2] != null);          // an item row has unit wt, order qty and order wt
        const itemW = body.filter((i) => i.x > 70 && right(i) < 138);
        const matW = body.filter((i) => !isNum(i.s) && right(i) >= 138 && i.x < 190);
        const custW = body.filter((i) => !isNum(i.s) && right(i) <= 85 && !/^(Sub|Total|TOTAL|Ltd|Pvt|Engg|India|Ltd\.|Pvt\.|Engg\.)$/.test(i.s));
        lines.forEach((l) => {
          const nm = itemW.filter((i) => Math.abs(i.y - l.y) <= 10 && !/^(Sub|Total)$/.test(i.s)).filter((i) => { const own = lines.reduce((b, o) => (Math.abs(o.y - i.y) < Math.abs(b.y - i.y) ? o : b), lines[0]); return own === l; });
          const item = words(nm); if (!item) return;
          const mt = words(matW.filter((i) => Math.abs(i.y - l.y) <= 10 && lines.reduce((b, o) => (Math.abs(o.y - i.y) < Math.abs(b.y - i.y) ? o : b), lines[0]) === l));
          const cw = custW.slice().sort((a, b) => Math.abs(a.y - l.y) - Math.abs(b.y - l.y))[0];
          pouring.push({ item, material: mt, unitWt: l.col[0], order: l.col[1], plan: l.col[3] || 0, poured: l.col[5] || 0, customer: cw ? cw.s.replace(/\.$/, '') : '' });
        });
      }
    }
    if (!pouring.length) warn.push('No pouring status rows were read.');
    return { kind: 'daily', asOn, wip, wipTotal, kpi, pouring, warn };
  }

  window.PPCPARSE = { parseDaily, cluster, isNum, val };
})();
