/* DCL Quality Inspection – charge-mix calculator.
   Implements the method of the "Charge Calculation" sheets in the QC n Design folder (Tega T1, Thejo CrMo, Escorts M201,
   HT Bar, Vedanta 4%Ni, BEML Idler):
     contribution = Wt x analysis / 100;  total % = sum(Wt x analysis) / sum(Wt)  (+ lining pick-up);
     after loss = total x (1 - element loss %);  kg charged = Wt / sum(non-return Wt) x (liquid metal - foundry return);
     cost block = per-kg cost of casting after yield, rejection and lining. */
(function () {
  'use strict';
  const QI = window.QI;
  const S = () => QI.S();
  const EL_ALL = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Cu', 'Ti', 'Al'];
  QI.EL = EL_ALL;
  const has = (v) => v !== undefined && v !== null && v !== '' && isFinite(+v);
  const n = (v) => (has(v) ? +v : 0);

  QI.cm = () => { const s = S().settings; if (!s.charge || !s.charge.recipes) s.charge = { v: 2, recipes: [] }; return s.charge; };
  QI.cmRecipe = (name) => QI.cm().recipes.find((r) => r.name === name);

  /* ---------- the sheet's calculation ---------- */
  QI.sheetCalc = (r) => {
    const els = r.els || [];
    const mats = r.mats || [];
    const sumAll = mats.reduce((a, m) => a + n(m.wt), 0);
    const sumNon = mats.filter((m) => !m.fr).reduce((a, m) => a + n(m.wt), 0);
    const out = { sumAll, sumNon, contrib: [], kg: [], rs: [], total: {}, after: {}, status: {} };
    if (!(sumAll > 0)) return Object.assign(out, { error: 'Enter the charge weights (Wt) for the materials.' });
    const lm = n(r.lm), fr = n(r.fr), rest = Math.max(lm - fr, 0);
    mats.forEach((m) => {
      out.contrib.push(Object.fromEntries(els.map((e) => [e, n(m.wt) * n(m.comp && m.comp[e]) / 100])));
      out.kg.push(m.fr ? fr : (sumNon > 0 ? n(m.wt) / sumNon * rest : 0));
      out.rs.push(n(m.wt) * n(m.rate));
    });
    els.forEach((e) => {
      const base = out.contrib.reduce((a, c) => a + c[e], 0) / (sumAll / 100) + n(r.lin && r.lin[e]);
      out.total[e] = base;
      out.after[e] = base * (1 - n(r.loss && r.loss[e]) / 100);
      const t = (r.tg && r.tg[e]) || {};
      const v = Math.round(out.after[e] * 100) / 100;   // the sheets compare at 2 decimals
      out.status[e] = !has(t.min) && !has(t.max) ? 'na' : has(t.min) && +t.min > 0 && v < +t.min - 1e-9 ? 'low' : has(t.max) && +t.max > 0 && v > +t.max + 1e-9 ? 'high' : 'ok';
    });
    out.ok = els.every((e) => out.status[e] !== 'low' && out.status[e] !== 'high');
    const cost = out.rs.reduce((a, b) => a + b, 0), y = n(r.yield) || 65, rej = n(r.rej) / 100;
    const retVal = sumNon > 0 ? (100 - y) * cost / sumNon : 0;
    const perKg = (cost - retVal) / y;
    const perKgRej = perKg / (1 - rej);
    const credit = cost / sumAll * rej * (1 - rej);
    out.cost = { total: cost, retKg: 100 - y, retVal, perKg, perKgRej, credit, net: perKgRej - credit, final: perKgRej - credit + n(r.other) };
    return out;
  };

  QI.cmNewRecipe = () => ({ customer: '', grade: '', name: '', els: ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni'], tg: {}, loss: {}, lin: {}, lm: 2000, fr: 0, yield: 65, rej: 5, other: 1.75, meltLoss: 5, mats: [] });
  QI.cmSaveRecipe = (r) => {
    const C = QI.cm(); r.name = (r.customer ? r.customer + ' – ' : '') + (r.grade || 'grade');
    const i = C.recipes.findIndex((x) => x.id === r.id); const copy = JSON.parse(JSON.stringify(r));
    if (i >= 0) C.recipes[i] = copy; else { copy.id = 'r' + Date.now().toString(36); r.id = copy.id; C.recipes.push(copy); }
    QI.learn('grade', r.grade); QI.save(); return copy;
  };
  QI.cmDelete = (id) => { const C = QI.cm(); C.recipes = C.recipes.filter((x) => x.id !== id); QI.save(); };

  /* ---------- save to heat / apply grade limits ---------- */
  QI.saveCharge = (heatNo, r) => {
    const h = QI.heat(heatNo); if (!h) return { error: 'Heat not found.' };
    const c = QI.sheetCalc(r); if (c.error) return { error: c.error };
    h.charge = { recipe: r.name, lm: r.lm, fr: r.fr, rows: r.mats.map((m, i) => ({ name: m.name, wt: n(m.wt), kg: +c.kg[i].toFixed(2) })).filter((x) => x.wt > 0),
      expected: Object.fromEntries(r.els.map((e) => [e, +c.after[e].toFixed(3)])), ok: c.ok, finalCost: +c.cost.final.toFixed(2), by: S().settings.inspector || QI.me.name || '', ts: Date.now() };
    QI.save(); return { ok: true };
  };
  QI.applyGradeSpec = (heatNo, r) => {
    const h = QI.heat(heatNo); if (!h) return;
    h.chemSpec = r.els.filter((e) => r.tg[e] && (has(r.tg[e].min) || has(r.tg[e].max))).map((e) => ({ name: e, min: has(r.tg[e].min) && +r.tg[e].min > 0 ? String(r.tg[e].min) : '', max: has(r.tg[e].max) && +r.tg[e].max > 0 ? String(r.tg[e].max) : '' }));
    if (!h.grade) h.grade = r.grade; QI.save();
  };

  /* ---------- seed: the six sheets in "QC n Design / Charge Calculation" ---------- */
  const COLS = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Ti'];
  const M = (name, comp, rate, wt, fr) => ({ name, mrn: '', comp: Object.fromEntries(comp.map((v, i) => [COLS[i], v]).filter(([, v]) => v !== '' && v !== null && v !== undefined)), rate: rate === '' ? '' : rate, wt: wt === '' ? '' : wt, fr: !!fr });
  const common = (o) => {   // ferro-alloy / stainless rows shared by the sheets (analysis as per each sheet)
    return [
      M('SS304', [0.06, 0.9, 1, 0.01, 0.04, 18, 0, 8], 155, o.ss304 || ''),
      M('SS310/HK40', [0.2, 0.85, 1.1, 0.02, 0.04, 24.1, 0.13, 19], 405, ''),
      M('SS 410', [0.02, 0.52, 1.21, 0.015, 0.005, 11.27, '', 0.17], o.ss410rate || 60, ''),
    ];
  };
  const fe = (o) => [
    M('HcFeCr', o.hcfecr || [6.66, 2.5, '', '', '', 59.56], o.hcfecrRate || 131, o.hcfecrWt || ''),
    M('LCFeCr', [0.2, '', '', '', '', 63], o.lcfecrRate || '', o.lcfecrWt || ''),
    M('HcFeMn', [6.5, '', 70], o.hcfemnRate || 85, o.hcfemnWt || ''),
    M('MCFeMn', [2.5, '', 65], '', ''),
    M('Mn Metal', [0, '', 90], '', o.mnmetalWt || ''),
    M('FeMo', [0, 0, 0, 0, 0, 0, 60], o.femoRate || 3200, o.femoWt || ''),
    M('FeSiMn', [2.5, 14, 60, 0.03, 0.03], 80, o.fesimnWt || ''),
    M('FeSi', [o.fesiC || '', 70], o.fesiRate || 131, o.fesiWt || ''),
    M('CPC (carbon)', [95], 80, o.cpcWt || ''),
  ];
  const T = (arr) => Object.fromEntries(['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Ti', 'Al'].map((e, i) => [e, { min: arr[i * 3], max: arr[i * 3 + 1], aim: arr[i * 3 + 2] }]).filter(([, v]) => v.min !== undefined || v.max !== undefined));
  QI.seedCharge = () => {
    const C = QI.cm(); if (C.recipes.length && C.v === 2 && C.seeded === 2) return;
    if (C.seeded === 2) return;
    const base = { yield: 65, rej: 5, other: 1.75, meltLoss: 5, els: ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni'] };
    const R = [];
    R.push(Object.assign({}, base, { customer: 'Tega', grade: 'T1', lm: 2000, fr: 0,
      tg: T([2.4, 2.5, 2.4, 1.25, 1.35, 1.25, 0.7, 0.8, 0.7, 0, 0.1, 0.1, 0, 0.06, 0.06, 21, 21.5, 21, 1.53, 1.56, 1.53, 0, 0.5, 0.5]),
      loss: { C: 5, Mn: 4, Cr: 3.15 }, lin: { Si: 0.06 }, bath: {},
      mats: [M('Foundry Return', [2.5, 1.15, 0.75, 0.04, 0.02, 21.2, 1.52, 0.2], '', 0, true), M('MS Scrap 1', [0.087, 0.11, 0.0315, 0.022, 0.013, 0, 0, 0.01], 46, 20.15),
        M('WI Scrap (2% MO)', [2.97, 0.41, 1.3, 0.026, 0.005, 28.41, 0.81, 0.41], 88, 40), M('WI Scrap (1.2% MO)', [3, 0.39, 1.26, 0.03, 0.01, 26, 1.8, 1], 92, ''), M('WI Scrap 3', [], 47, ''),
        M('SS304', [0.06, 0.9, 1, 0.01, 0.04, 18, 0, 8], 155, ''), M('SS310/HK40', [0.2, 0.85, 1.1, 0.02, 0.04, 24.1, 0.13, 19], 405, ''), M('SS 410', [0, 0.52, 1.21, 0.015, 0.005, 11.27, '', 0.17], 60, ''),
        M('SS430', [0.03, 0.51, 0.17, 0.03, 0.01, 19.01, '', 0.23], 73, 30)].concat(fe({ hcfecr: [7.98, 3.95, '', 0.04, 0.04, 59.56], hcfecrWt: 9, femoWt: 2.1, fesimnWt: 0.3, fesiWt: 0.7, fesiRate: 131, cpcWt: 0.75, hcfemnRate: 81, femoRate: 3200 })).map((m) => m.name === 'FeSi' ? M('FeSi', ['', 70.51], 131, 0.7) : m) }));
    R.push(Object.assign({}, base, { customer: 'Thejo', grade: 'AS2074/L2B Mod (0.85C CrMo)', lm: 3000, fr: 1000, els: ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Ti'],
      tg: T([0.8, 0.88, 0.85, 0.4, 0.5, 0.45, 0.65, 0.75, 0.7, 0, 0.03, 0.03, 0, 0.03, 0.03, 1.8, 1.9, 1.85, 0.25, 0.35, 0.3, 0, 0.5, 0.5, 0.01, 0.02, 0.015]),
      loss: {}, lin: { Si: 0.06 }, bath: {},
      mats: [M('Foundry Return', [0.85, 0.45, 0.7, 0.02, 0.02, 1.85, 0.3, 0.2, 0.015], '', 33.33, true), M('MS Scrap 1', [0.05, 0.02, 0.182, 0.01, 0.005, 0.05, '', 0.01], 46, 34.67),
        M('WI Scrap (2% MO)', [3, 0.7, 1.2, 0.05, 0.02, 24, 0.8, 0.8], 88, ''), M('WI Scrap (1.2% MO)', [3, 0.39, 1.26, 0.03, 0.01, 26, 1.8, 0.32], 92, ''), M('Hardox', [0.25, 0.22, 0.9, 0.01, 0.01, 0.8, 0.18, 0], 47, 65),
        M('SS304', [0.06, 0.9, 1, 0.01, 0.04, 18, 0, 8], 155, ''), M('SS310/HK40', [0.2, 0.85, 1.1, 0.02, 0.04, 24.1, 0.13, 19], 405, ''), M('SS 410', [0.02, 0.52, 1.21, 0.015, 0.005, 11.27, '', 0.17], 60, ''), M('SS430', [0.02, 0.4, 0.2, 0.02, 0.01, 17.7, 0.12, 0.25], 73, '')]
        .concat(fe({ hcfecrWt: 2.2, femoWt: 0.25, fesiWt: 0.35, cpcWt: 0.5, hcfemnRate: 81 }), [M('FeTi', [1, '', '', '', '', '', '', '', 45], '', 0.04)]) }));
    R.push(Object.assign({}, base, { customer: 'Escorts', grade: 'M201 Gr E', lm: 2000, fr: 0,
      tg: T([0.27, 0.3, 0.27, 1, 1.1, 1, 1.7, 1.8, 1.75, 0, 0.035, 0.035, 0, 0.035, 0.035, 0, 0.16, 0.16, 0, 0.05, 0.05, 0, 0.1, 0.1]),
      loss: { Mn: 20 }, lin: { Si: 0.06 }, bath: {},
      mats: [M('Foundry Return', [0.28, 1.05, 1.75, 0.03, 0.03, 0.17, 0.01, 0.05], '', 0, true), M('MS Scrap 1', [0.05, 0.02, 0.182, 0.01, 0.005, 0.05, '', 0.01], 47, 98.77),
        M('Scrap Type -2', [0.25, 0.46, 1.03, 0.024, 0.008, 0.49, 0, 0], 88, ''), M('WI Scrap (1.2% MO)', [3, 0.39, 1.26, 0.03, 0.01, 26, 1.8, 0.32], 92, ''), M('Hardox', [0.25, 0.22, 0.9, 0.01, 0.01, 0.8, 0.18, 0], 47, ''),
        M('SS304', [0.06, 0.9, 1, 0.01, 0.04, 18, 0, 8], 155, ''), M('SS310/HK40', [0.2, 0.85, 1.1, 0.02, 0.04, 24.1, 0.13, 19], 405, ''), M('SS 410', [0.02, 0.52, 1.21, 0.015, 0.005, 11.27, '', 0.17], 60, ''), M('SS430', [0.02, 0.4, 0.2, 0.02, 0.01, 17.7, 0.12, 0.25], 73, '')]
        .concat(fe({ hcfecr: [7.98, 3.95, '', 0.04, 0.04, 59.56], hcfemnRate: 81, hcfemnWt: 1.23, mnmetalWt: 0.14, fesimnWt: 1.67, fesiWt: 1.1, fesiC: 0.15, cpcWt: 0.1, femoRate: 3200 })) }));
    R.push(Object.assign({}, base, { customer: 'HT BAR', grade: 'HT BAR', lm: 4000, fr: 1000, note: 'As per design sheet: 3000 kg of other materials + 1000 kg foundry return. 200 kg foundry return to be added at the end.',
      tg: T([2.45, 2.55, 2.37, 1.1, 1.2, 1.14, 0.7, 0.8, 0.7, 0, 0.1, 0.1, 0, 0.06, 0.06, 21, 21.5, 12.43, 1.52, 1.57, 0.55, 0, 0.5, 2.53]),
      loss: { C: 2, Si: 10, Cr: 2 }, lin: {}, bath: {},
      mats: [M('Foundry Return', [2.5, 1.15, 0.75, 0.04, 0.02, 21.2, 1.52, 0.2], '', 33.33, true), M('MS Scrap 1', [0.05, 0.02, 0.182, 0.01, 0.005, 0.05, '', 0.01], 48, 26.15),
        M('WI Scrap (2% MO)', [2.85, 0.574, 0.875, 0.037, 0.04, 19.8, 2, 0.823], 125, 0), M('WI Scrap (1.2% MO)', [2.994, 0.583, 1.06, 0.04, 0.02, 23.76, 1.6, 0.14], 120, 23),
        M('ROLLER BEAM F/R', [0.39, 1.16, 0.86, 0, 0, 20.04, 0.04, 3.6], '', 6), M('HT BAR F/R', [2.37, 1.14, 0.54, 0.01, 0.02, 9, 0.5, 2.5], '', 26), M('Hardox', [0.25, 0.22, 0.9, 0.01, 0.01, 0.8, 0.18, 0], 47, ''),
        M('SS304', [0.06, 0.9, 1, 0.01, 0.04, 18, 0, 8], 155, 20), M('SS310/HK40', [0.2, 0.85, 1.1, 0.02, 0.04, 24.1, 0.13, 19], 405, ''), M('SS 410', [0.02, 0.52, 1.21, 0.015, 0.005, 11.27, '', 0.17], 60, ''), M('SS430', [0.02, 0.4, 0.2, 0.02, 0.01, 19, 0.12, 0.25], 75, '')]
        .concat(fe({ hcfecrRate: 115, fesiWt: 0.8, cpcWt: 1.05, femoRate: 4250 })) }));
    R.push(Object.assign({}, base, { customer: 'Vedanta', grade: '4%Ni (Roller Skid & Beam ECL)', lm: 3000, fr: 1000,
      tg: T([0.35, 0.4, 0.36, 1.3, 1.5, 1.35, 0.8, 1, 0.8, 0, 0.035, 0.035, 0, 0.03, 0.03, 24.5, 25.5, 24.5, 0, 0, 0, 3.6, 3.75, 3.6]),
      loss: { C: 2, Si: 5, Mn: 5, Cr: 2 }, lin: {}, bath: {},
      mats: [M('Foundry Return', [0.36, 1.4, 0.9, 0.02, 0.02, 26, 0.1, 3.2], '', 33.33, true), M('MS Scrap 1', [0.05, 0.02, 0.182, 0.01, 0.005, 0.05, '', 0.01], 48, 0),
        M('WI Scrap (2% MO)', [3, 0.7, 1.2, 0.05, 0.02, 25, 2, 0.8], 125, ''), M('WI Scrap (1.2% MO)', [3, 0.07, 1.5, 0.05, 0.02, 25, 1.2, 0.7], 120, ''), M('Hardox', [0.25, 0.22, 0.9, 0.01, 0.01, 0.8, 0.18, 0], 47, ''),
        M('SS304', [0.05, 0.42, 1.28, 0.01, 0.04, 18, 0, 8], 155, 44), M('SS310/HK40', [0.24, 0.95, 0.89, 0.02, 0.02, 24, 0.13, 19], 405, ''), M('SS 410', [0.02, 0.52, 1.21, 0.015, 0.005, 24.45, 0.247, 19], 60, ''), M('SS430', [0.02, 0.4, 0.2, 0.02, 0.01, 17.7, 0.12, 0.25], 75, 41.47)]
        .concat(fe({ hcfecrRate: 115, hcfecrWt: 4.5, lcfecrWt: 11.5, mnmetalWt: 0.23, fesiWt: 1.3, femoRate: 4250 })).map((m) => m.name === 'LCFeCr' ? M('LCFeCr', [0.1, '', '', '', '', 61], '', 11.5) : m) }));
    R.push(Object.assign({}, base, { customer: 'BEML (Wilson)', grade: 'IDLER', lm: 3000, fr: 0,
      tg: T([0.39, 0.42, 0.4, 0.55, 0.65, 0.55, 1.1, 1.2, 1.1, 0, 0.04, 0.04, 0, 0.04, 0.04, 0, 0.2, 0.2, 0, 0.15, 0.15, 0, 0.3, 0.3]),
      loss: { Cr: 5, Si: 10, Mn: 10 }, lin: { Si: 0.06 }, bath: {},
      mats: [M('Foundry Return', [0.4, 0.55, 1.1, 0.03, 0.03, 0.2, 0.007, 0.01], '', 0, true), M('MS Scrap 1', [0.067, 0.02, 0.196, 0.015, 0.005, 0.045, 0.007, 0.01], 48, 101.1),
        M('CrMoNi Scrap', [0.135, 0.25, 0.47, 0.022, 0.015, 1.867, 0.9, 0.12], 46, ''), M('MS Scrap 3', [0.096, 0.07, 0.063, 0.039, 0.017], '', ''), M('SS 410', [0.02, 0.52, 1.21, 0.015, 0.005, 11.27, '', 0.17], 45, ''),
        M('HcFeCr', [6.66, 2.5, '', '', '', 59.56], 91, ''), M('LCFeCr', [0.2, '', '', '', '', 63], '', ''), M('HcFeMn', [6.5, '', 70], 85, 0.87), M('FeMo', [0, 0, 0, 0, 0, 0, 60], 1370, ''),
        M('FeSiMn', [2.5, 14, 60, 0.03, 0.03], 80, 0.5), M('FeSi', ['', 70], 131, 0.44), M('CPC (carbon)', [95], 80, 0.09), M('Cu', [], 550, ''), M('Al', [], 225, 0.1)] }));
    const C2 = QI.cm();
    R.forEach((r) => { r.name = r.customer + ' – ' + r.grade; r.id = 'seed-' + r.customer.toLowerCase().replace(/[^a-z0-9]/g, ''); });
    C2.recipes = R; C2.v = 2; C2.seeded = 2; QI.save();
  };
})();
