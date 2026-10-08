/* DCL Quality Inspection – raw material inspection register (incoming lots by MRN).
   Links to production: MRNs typed on the furnace log are checked against this register and consumption is tracked per lot;
   accepted lot analyses can refresh the charge-mix material table; each heat shows the lots (supplier, analysis) charged into it. */
(function () {
  'use strict';
  const QI = window.QI;
  const S = () => QI.S();
  const num = (v) => (v === '' || v == null || !isFinite(+v)) ? 0 : +v;
  const has = (v) => v !== '' && v != null && isFinite(+v);

  QI.RM_EL = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Cu', 'Ti', 'Al'];
  QI.RM_DEFAULTS = {
    rmMaterial: ['MS Scrap 1', 'WI Scrap (2% MO)', 'WI Scrap (1.2% MO)', 'Hardox', 'CrMoNi Scrap', 'SS304', 'SS310/HK40', 'SS 410', 'SS430', 'Pig iron', 'HcFeCr', 'LCFeCr', 'HcFeMn', 'MCFeMn', 'Mn Metal', 'FeMo', 'FeSiMn', 'FeSi', 'FeTi', 'CPC (carbon)', 'Nickel', 'Cu', 'Al', 'New sand (P1)', 'Resin', 'Catalyst', 'Coating', 'Refractory / ladle bricks'],
    rmSupplier: ['Rama Ferro Alloys & Finance Pvt Ltd.', 'DRK Ispat Ltd.', 'Mill Stores Trading Company', 'Access Metals Industries'],
    rmChecks: ['Documents (TC / COA) received', 'Material as per PO / grade', 'Free from oil, grease and moisture', 'No closed / sealed containers', 'Size / form acceptable', 'Packing and labelling OK', 'Free from tramp / non-ferrous contamination'],
    rmRemarks: ['Accepted as per TC', 'Accepted – lab analysis confirms TC', 'Rejected – analysis out of spec', 'Returned to supplier', 'Held for re-test', 'Accepted under deviation (customer informed)'],
  };
  QI.rmList = (k) => QI.opts(k, QI.RM_DEFAULTS[k]);
  QI.rmStore = () => { const s = S().settings; return s.rm || (s.rm = { specs: {} }); };
  QI.rmLot = (mrn) => S().rmLots.find((l) => QI.mpNorm(l.mrn) === QI.mpNorm(mrn));
  QI.rmNew = (mrn, material) => ({ mrn: mrn || '', date: new Date().toISOString().slice(0, 10), material: material || '', supplier: '', po: '', challan: '', vehicle: '', supplierLot: '', cert: '', qty: '', rate: '',
    spec: JSON.parse(JSON.stringify((QI.rmStore().specs || {})[material] || {})), tc: {}, lab: {}, checks: QI.rmList('rmChecks').slice(0, 7).map((c) => ({ name: c, res: '', note: '' })),
    decision: 'pending', accQty: '', rejQty: '', remarks: '', remarkNote: '' });

  /* accepted analysis = own lab result where entered, otherwise the supplier certificate */
  QI.rmAnalysis = (l) => Object.fromEntries(QI.RM_EL.map((e) => [e, has(l.lab[e]) && l.lab[e] !== '' ? +l.lab[e] : has(l.tc[e]) && l.tc[e] !== '' ? +l.tc[e] : null]).filter(([, v]) => v != null));
  QI.rmStatus = (l, e, v) => { const s = l.spec[e]; if (!s || !has(v) || v === '') return ''; if (has(s.min) && +s.min > 0 && +v < +s.min) return 'low'; if (has(s.max) && +s.max > 0 && +v > +s.max) return 'high'; return 'ok'; };
  QI.rmIssues = (l) => {
    const out = [];
    ['lab', 'tc'].forEach((src) => QI.RM_EL.forEach((e) => { const st = QI.rmStatus(l, e, l[src][e]); if (st === 'low' || st === 'high') out.push(`${src === 'lab' ? 'Lab' : 'TC'} ${e} ${l[src][e]} is ${st} (limit ${QI.limText(has(l.spec[e].min) && +l.spec[e].min > 0 ? +l.spec[e].min : null, has(l.spec[e].max) && +l.spec[e].max > 0 ? +l.spec[e].max : null, '%')})`); }));
    l.checks.forEach((c) => { if (c.res === 'nok') out.push(`${c.name}: Not OK`); });
    return out;
  };
  QI.rmSuggest = (l) => { if (QI.rmIssues(l).length) return 'rejected'; const done = l.checks.some((c) => c.res === 'ok') || Object.keys(QI.rmAnalysis(l)).length; return done ? 'accepted' : 'pending'; };
  QI.RM_DECISIONS = [['pending', 'Pending'], ['accepted', 'Accepted'], ['deviation', 'Accepted under deviation'], ['hold', 'Hold – re-test'], ['rejected', 'Rejected']];

  /* consumption of a lot in furnace logs (scrap rows and ferro-alloy rows that carry its MRN) */
  QI.rmUsage = (mrn) => {
    const key = QI.mpNorm(mrn), rows = [];
    S().furnaceLogs.forEach((f) => {
      let kg = 0;
      (f.scrap || []).forEach((r) => { if (r.mrn && QI.mpNorm(r.mrn) === key) kg += num(r.wt); });
      Object.keys(f.alloys || {}).forEach((k) => { const a = f.alloys[k]; if (a && a.mrn && QI.mpNorm(a.mrn) === key) kg += (a.w || []).reduce((x, v) => x + num(v), 0); });
      if (kg > 0) rows.push({ heat: f.heat, date: f.date, kg });
    });
    return { rows, kg: rows.reduce((a, r) => a + r.kg, 0) };
  };
  /* issues with the MRNs typed on a furnace log */
  QI.mlMrnCheck = (log) => {
    const out = [], seen = {};
    const chk = (mrn, wt, label) => {
      if (!mrn || !num(wt)) return; const k = QI.mpNorm(mrn); if (seen[k]) return; seen[k] = 1;
      const lot = QI.rmLot(mrn);
      if (!lot) out.push({ mrn, lvl: 'info', msg: `MRN ${mrn} (${label}) is not in the raw material register` });
      else if (lot.decision === 'rejected') out.push({ mrn, lvl: 'bad', msg: `MRN ${mrn} (${label}) was REJECTED in raw material inspection` });
      else if (lot.decision === 'pending' || lot.decision === 'hold') out.push({ mrn, lvl: 'warn', msg: `MRN ${mrn} (${label}) is still ${lot.decision === 'hold' ? 'on hold' : 'pending'} in raw material inspection` });
    };
    (log.scrap || []).forEach((r) => chk(r.mrn, r.wt, r.mat || 'scrap'));
    QI.ML_ALLOYS.forEach(([k, t]) => { const a = (log.alloys || {})[k]; if (a) chk(a.mrn, (a.w || []).reduce((x, v) => x + num(v), 0), t); });
    return out;
  };
  QI.rmHeatLots = (heat) => {
    const f = QI.furnaceLog(heat); if (!f) return [];
    const m = {};
    const add = (mrn, kg, label) => { if (!mrn || !kg) return; const k = QI.mpNorm(mrn); (m[k] = m[k] || { mrn, label, kg: 0 }).kg += kg; };
    (f.scrap || []).forEach((r) => add(r.mrn, num(r.wt), r.mat));
    QI.ML_ALLOYS.forEach(([k, t]) => { const a = (f.alloys || {})[k]; if (a) add(a.mrn, (a.w || []).reduce((x, v) => x + num(v), 0), t); });
    return Object.values(m).map((x) => Object.assign(x, { lot: QI.rmLot(x.mrn) }));
  };

  QI.rmSave = (l) => {
    if (!QI.can('rm')) return { error: 'Only Quality, QC Manager, Lab and Planning can record raw material receipts.' };
    const mrn = (l.mrn || '').trim(); if (!mrn) return { error: 'Enter the MRN number.' };
    if (!l.material) return { error: 'Choose the material.' };
    l.mrn = mrn;
    if (l.decision !== 'pending' && !QI.can('rmdecide')) { const old = QI.rmLot(mrn); l.decision = old ? old.decision : 'pending'; }
    l.analysis = QI.rmAnalysis(l);
    if (l.decision === 'rejected' && !has(l.rejQty)) l.rejQty = l.qty;
    if ((l.decision === 'accepted' || l.decision === 'deviation') && !has(l.accQty)) l.accQty = l.qty;
    if (l.material) QI.rmStore().specs[l.material] = JSON.parse(JSON.stringify(l.spec));
    [['rmMaterial', l.material], ['rmSupplier', l.supplier], ['rmRemarks', l.remarks]].forEach(([k, v]) => QI.learn(k, v)); l.checks.forEach((c) => QI.learn('rmChecks', c.name));
    l.by = S().settings.inspector || QI.me.name || ''; l.ts = Date.now();
    const i = S().rmLots.findIndex((x) => QI.mpNorm(x.mrn) === QI.mpNorm(mrn)), copy = JSON.parse(JSON.stringify(l));
    if (i >= 0) S().rmLots[i] = copy; else S().rmLots.push(copy);
    QI.save(); return { ok: true };
  };

  /* summaries for regular review / later output analysis */
  QI.rmSummary = () => {
    const sup = {}, mat = {};
    S().rmLots.forEach((l) => {
      const s = sup[l.supplier || '–'] || (sup[l.supplier || '–'] = { lots: 0, ok: 0, rej: 0, kg: 0, rejKg: 0 });
      s.lots++; s.kg += num(l.qty); if (l.decision === 'rejected') { s.rej++; s.rejKg += num(l.rejQty || l.qty); } else if (l.decision === 'accepted' || l.decision === 'deviation') s.ok++;
      const m = mat[l.material] || (mat[l.material] = { lots: 0, el: {} });
      if (l.decision === 'accepted' || l.decision === 'deviation') { m.lots++; const a = l.analysis || QI.rmAnalysis(l); Object.keys(a).forEach((e) => (m.el[e] = m.el[e] || []).push(a[e])); }
    });
    return { sup, mat };
  };
  QI.rmChargeUpdate = (recipe) => {      // latest accepted lot for each recipe material
    const out = [];
    recipe.mats.forEach((m, i) => {
      const lots = S().rmLots.filter((l) => l.material === m.name && (l.decision === 'accepted' || l.decision === 'deviation')).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.ts - a.ts);
      if (lots[0]) out.push({ i, name: m.name, lot: lots[0] });
    });
    return out;
  };
})();
