/* DCL Quality Inspection – charge-mix calculator.
   Given a grade (target chemistry), total charge weight and the base charge (returns / scrap / pig iron),
   it solves the ferro-alloy and recarburiser additions that bring the predicted melt to the grade aim,
   allowing for element recoveries, and checks the result against the grade limits. */
(function () {
  'use strict';
  const QI = window.QI;
  const EL = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Ni', 'Mo', 'Cu'];
  QI.EL = EL;
  QI.DEF_REC = { C: 95, Si: 90, Mn: 85, P: 100, S: 100, Cr: 95, Ni: 100, Mo: 97, Cu: 100 };      // % of the element charged that reaches the melt
  QI.DEF_ADJ = { C: 'Recarburiser (graphite)', Si: 'FeSi 75', Mn: 'FeMn HC', Cr: 'FeCr HC', Ni: 'Nickel', Mo: 'FeMo', Cu: 'Copper' };
  const S = () => QI.S();
  QI.cm = () => (S().settings.charge || (S().settings.charge = { materials: [], grades: [] }));
  QI.cmMat = (n) => QI.cm().materials.find((m) => m.name === n);
  QI.cmGrade = (n) => QI.cm().grades.find((g) => g.name === n);

  /* Starter data: typical handbook values so the calculator works on day one.
     CONFIRM every value against your material certificates and customer / standard specification. */
  QI.seedCharge = () => {
    const c = QI.cm(); if (c.seeded) return;
    c.materials = [
      { name: 'Steel scrap (MS)', comp: { C: 0.2, Si: 0.25, Mn: 0.5, P: 0.025, S: 0.025 } },
      { name: 'Pig iron', comp: { C: 4.0, Si: 1.5, Mn: 0.4, P: 0.04, S: 0.02 } },
      { name: 'Returns – carbon steel', comp: { C: 0.25, Si: 0.45, Mn: 0.8, P: 0.02, S: 0.02 } },
      { name: 'Returns – SG iron', comp: { C: 3.6, Si: 2.4, Mn: 0.3, P: 0.04, S: 0.01 } },
      { name: 'Recarburiser (graphite)', comp: { C: 98 } },
      { name: 'FeSi 75', comp: { Si: 75, C: 0.2 } },
      { name: 'FeMn HC', comp: { Mn: 75, C: 7, Si: 1, P: 0.3 } },
      { name: 'FeCr HC', comp: { Cr: 60, C: 8, Si: 2 } },
      { name: 'FeMo', comp: { Mo: 65 } },
      { name: 'Nickel', comp: { Ni: 99 } },
      { name: 'Copper', comp: { Cu: 99 } },
    ];
    c.grades = [
      { name: 'Carbon steel ASTM A216 WCB', note: 'Typical limits – confirm with the standard / PO',
        spec: { C: { max: 0.3, aim: 0.24 }, Si: { max: 0.6, aim: 0.45 }, Mn: { max: 1.0, aim: 0.8 }, P: { max: 0.035 }, S: { max: 0.035 } },
        base: [{ mat: 'Returns – carbon steel', pct: 40 }, { mat: 'Steel scrap (MS)', pct: 60 }] },
      { name: 'SG iron EN-GJS-500-7', note: 'Typical base-iron chemistry before Mg treatment – confirm with your metallurgist',
        spec: { C: { min: 3.5, max: 3.9 }, Si: { min: 2.2, max: 2.8 }, Mn: { max: 0.4 }, P: { max: 0.05 }, S: { max: 0.02 } },
        base: [{ mat: 'Returns – SG iron', pct: 40 }, { mat: 'Pig iron', pct: 30 }, { mat: 'Steel scrap (MS)', pct: 30 }] },
    ];
    c.seeded = 1; QI.save();
  };

  /* p: { grade:{spec}, weight (kg), loss (%), base:[{mat,pct}], adj:{El:material}, rec:{El:%} } */
  QI.chargeCalc = (p) => {
    const W = +p.weight;
    if (!(W > 0)) return { error: 'Enter the total charge weight.' };
    const loss = +p.loss || 0, liquid = W * (1 - loss / 100);
    const rec = Object.assign({}, QI.DEF_REC, p.rec || {});
    const base = (p.base || []).filter((b) => b.mat && +b.pct > 0).map((b) => ({ mat: b.mat, pct: +b.pct }));
    const pctSum = base.reduce((a, b) => a + b.pct, 0);
    if (!pctSum) return { error: 'Choose the base charge materials (returns, scrap, pig iron) and their %.' };
    const comp = (name, e) => { const m = QI.cmMat(name); return (m && m.comp && +m.comp[e]) || 0; };
    const spec = (p.grade && p.grade.spec) || {};
    const has = (v) => v !== undefined && v !== null && v !== '';
    const aim = (e) => { const s = spec[e]; if (!s) return null; if (has(s.aim)) return +s.aim; if (has(s.min) && has(s.max)) return (+s.min + +s.max) / 2; if (has(s.min)) return +s.min; return null; };
    const alloys = {};
    const predict = () => {
      const aTot = Object.values(alloys).reduce((a, b) => a + b, 0), baseKg = Math.max(W - aTot, 0), out = {};
      EL.forEach((e) => {
        let mass = 0;
        base.forEach((b) => { mass += baseKg * b.pct / pctSum * comp(b.mat, e) / 100 * rec[e] / 100; });
        Object.keys(alloys).forEach((n) => { mass += alloys[n] * comp(n, e) / 100 * rec[e] / 100; });
        out[e] = mass / liquid * 100;
      });
      return out;
    };
    for (let it = 0; it < 400; it++) {
      const pr = predict(); let moved = 0;
      EL.forEach((e) => {
        const a = aim(e), adj = p.adj && p.adj[e]; if (a == null || !adj) return;
        const c = comp(adj, e); if (!c) return;
        const delta = (a - pr[e]) / 100 * liquid / (c / 100 * rec[e] / 100);
        const cur = alloys[adj] || 0, nk = Math.max(cur + delta * 0.5, 0);
        moved += Math.abs(nk - cur); alloys[adj] = nk;
      });
      if (moved < 1e-5) break;
    }
    const pred = predict();
    const aTot = Object.values(alloys).reduce((a, b) => a + b, 0), baseKg = Math.max(W - aTot, 0);
    const rows = base.map((b) => ({ name: b.mat, kg: baseKg * b.pct / pctSum, kind: 'base' }))
      .concat(Object.keys(alloys).filter((n) => alloys[n] > 0.005).map((n) => ({ name: n, kg: alloys[n], kind: 'alloy' })));
    rows.forEach((r) => { r.pct = r.kg / W * 100; const m = QI.cmMat(r.name); r.cost = m && +m.cost > 0 ? r.kg * +m.cost : null; });
    const status = {};
    EL.forEach((e) => {
      const s = spec[e]; if (!s || (!has(s.min) && !has(s.max))) { status[e] = 'na'; return; }
      status[e] = has(s.min) && pred[e] < +s.min - 1e-9 ? 'low' : has(s.max) && pred[e] > +s.max + 1e-9 ? 'high' : 'ok';
    });
    const costed = rows.length && rows.every((r) => r.cost != null);
    const cost = costed ? rows.reduce((a, r) => a + r.cost, 0) : null;
    return { rows, pred, status, aim: Object.fromEntries(EL.map((e) => [e, aim(e)])), liquid, total: W, cost, perKg: cost != null ? cost / liquid : null, ok: EL.every((e) => status[e] !== 'low' && status[e] !== 'high') };
  };
  QI.saveCharge = (heatNo, params, res) => {
    const h = QI.heat(heatNo); if (!h) return { error: 'Heat not found.' };
    h.charge = { grade: params.gradeName, weight: params.weight, loss: params.loss, base: params.base, adj: params.adj, rec: params.rec,
      rows: res.rows.map((r) => ({ name: r.name, kg: +r.kg.toFixed(2), kind: r.kind })), pred: Object.fromEntries(Object.keys(res.pred).map((e) => [e, +res.pred[e].toFixed(3)])), ok: res.ok, by: S().settings.inspector || QI.me.name || '', ts: Date.now() };
    QI.save(); return { ok: true };
  };
  QI.applyGradeSpec = (heatNo, gradeName) => {
    const h = QI.heat(heatNo), g = QI.cmGrade(gradeName); if (!h || !g) return;
    h.chemSpec = EL.filter((e) => g.spec[e] && (g.spec[e].min !== undefined && g.spec[e].min !== '' || g.spec[e].max !== undefined && g.spec[e].max !== ''))
      .map((e) => ({ name: e, min: g.spec[e].min === undefined ? '' : String(g.spec[e].min), max: g.spec[e].max === undefined ? '' : String(g.spec[e].max) }));
    if (!h.grade) h.grade = gradeName;
    QI.save();
  };
})();
