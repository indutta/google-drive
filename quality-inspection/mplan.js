/* DCL Quality Inspection – Melting Heat Plan (daily): heat -> items x liquid metal per mould -> total LM and nozzle size.
   Synchronised with: moulding plan (planned moulds per heat/item), furnace log (actual LM, boxes poured, nozzle), heats, charge mix. */
(function () {
  'use strict';
  const QI = window.QI;
  const S = () => QI.S();
  const num = (v) => (v === '' || v == null || !isFinite(+v)) ? 0 : +v;
  QI.ML_DEFAULTS.mlProduct = ['Reinf 11906', 'Reinf 11907', 'Reinf 11909', 'Reinf 11910', 'Reinf 11904', 'Idler 175', 'T.P (test piece)'];
  QI.ML_DEFAULTS.mlNozzle = ['60 mm'];
  QI.mlpNew = (date, copyFrom) => ({ date, rows: copyFrom ? JSON.parse(JSON.stringify(copyFrom.rows)).map((r) => Object.assign(r, { heat: '' })) : [{ heat: '', nozzle: '60 mm', total: '', items: [{ item: '', n: '', lmw: '' }] }], note: '' });
  QI.meltPlan = (date) => S().meltPlans.find((p) => p.date === date);
  QI.mlpRowLM = (r) => r.items.reduce((a, i) => a + num(i.n) * num(i.lmw), 0);
  QI.mlpFor = (heat) => {      // latest plan row for a heat number (H-370 ~ H370)
    const k = QI.mpNorm(heat); let best = null;
    S().meltPlans.forEach((p) => p.rows.forEach((r) => { if (QI.mpNorm(r.heat) === k && (!best || p.date >= best.plan.date)) best = { plan: p, row: r }; }));
    return best;
  };
  QI.mlpSave = (p) => {
    if (!QI.can('mplan')) return { error: 'Only Melting, Planning and Quality can save the melting plan.' };
    if (!p.date) return { error: 'Choose the date.' };
    p.rows = p.rows.filter((r) => r.heat || r.items.some((i) => i.item || i.n || i.lmw));
    p.rows.forEach((r) => { r.items = r.items.filter((i) => i.item || i.n || i.lmw); if (!r.items.length) r.items = [{ item: '', n: '', lmw: '' }];
      r.items.forEach((i) => QI.learn('mlProduct', i.item)); QI.learn('mlNozzle', r.nozzle); QI.learn('mpHeat', r.heat);
      if (r.heat && !QI.heat(QI.heatNoFor(r.heat)) && QI.can('create', 'heat')) QI.addHeat({ no: r.heat, date: p.date }); });
    p.by = S().settings.inspector || QI.me.name || ''; p.ts = Date.now();
    const i = S().meltPlans.findIndex((x) => x.date === p.date), copy = JSON.parse(JSON.stringify(p));
    if (i >= 0) S().meltPlans[i] = copy; else S().meltPlans.push(copy);
    QI.save(); return { ok: true };
  };
  /* plan vs moulding plan vs furnace log */
  QI.mlpSync = (p) => p.rows.filter((r) => r.heat).map((r) => {
    const heatNo = QI.heatNoFor(r.heat), fl = QI.furnaceLog(heatNo), planLM = QI.mlpRowLM(r), entered = num(r.total);
    const calc = fl ? QI.mlCalc(fl) : null, actual = calc && calc.lm > 0 ? calc.lm : null, ref = entered || planLM;
    const items = r.items.filter((i) => i.item).map((i) => {
      const k = QI.mpNorm(i.item); let mould = 0, any = false;
      S().mouldPlans.forEach((mp) => mp.items.forEach((it) => { if (QI.mpNorm(it.item) === k) it.lines.forEach((l) => { if (QI.mpNorm(l.heat) === QI.mpNorm(r.heat)) { mould += num(l.qty); any = true; } }); }));
      const poured = fl ? fl.alloc.filter((a) => QI.mpNorm(a.product) === k).reduce((a, x) => a + num(x.boxes), 0) : null;
      return { item: i.item, n: num(i.n), lm: num(i.n) * num(i.lmw), mould: any ? mould : null, poured };
    });
    return { row: r, heatNo, heat: QI.heat(heatNo), fl, planLM, entered, actual, var: actual != null && ref > 0 ? (actual - ref) / ref * 100 : null,
      nozzlePlan: r.nozzle, nozzleActual: fl && fl.nozzleSize ? fl.nozzleSize : null, items };
  });
  QI.mlpNewLog = (heat, grade) => {     // furnace log prefilled from the melting plan
    const l = QI.mlNew(heat, grade), pr = QI.mlpFor(heat); if (!pr) return l;
    const its = pr.row.items.filter((i) => i.item);
    its.forEach((i, k) => { const row = { boxes: i.n, product: i.item, qty: '', lmwt: num(i.n) * num(i.lmw) || '', net: '' }; if (k < l.alloc.length) l.alloc[k] = row; else l.alloc.push(row); });
    l.nozzleSize = (pr.row.nozzle || '').replace(/\s*mm$/i, ''); l.date = pr.plan.date;
    return l;
  };
})();
