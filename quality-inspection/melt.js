/* DCL Quality Inspection – Furnace Log Sheet (Format No. DCL/FR/04 Re/05): data model, totals, save and posting to inspection checks 4.1-4.4. */
(function () {
  'use strict';
  const QI = window.QI;
  const S = () => QI.S();
  const num = (v) => (v === '' || v == null || !isFinite(+v)) ? 0 : +v;
  const has = (v) => v !== '' && v != null && isFinite(+v);

  QI.ML_EL = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'V', 'Al', 'Cu'];
  QI.ML_ALLOYS = [['hcfemn', 'Hc Fe Mn'], ['mcfemn', 'Mc Fe Mn'], ['lcfemn', 'Lc Fe Mn'], ['fesi', 'Fe Si'], ['hcfecr', 'Hc Fe Cr'], ['lcfecr', 'Lc Fe Cr'], ['nickel', 'Nickel'], ['femo', 'Fe Mo'], ['nimg', 'Ni-Mg'], ['simn', 'Si Mn'], ['cu', 'Cu'], ['cadd', 'C-add']];
  QI.ML_FLUX = [['microalloy', 'Micro Alloy'], ['fesizr', 'Fe Si Zr'], ['casi', 'Ca Si'], ['feti', 'Fe Ti'], ['se', 'Se'], ['cpc', 'CPC'], ['graphite', 'Graphite'], ['aluminium', 'Aluminium'], ['argon', 'Argon'], ['stax30', 'Stax 30'], ['ladcov', 'Lad Cov St']];
  QI.ML_CONSUM = [['boric', 'Boric Acid'], ['sodsil', 'Sod Silicate'], ['accosec', 'Accosec 50'], ['furnforma', 'Furnace Forma'], ['ladbricks', 'Laddle Bricks'], ['asbestos', 'Asbestos Millboard'], ['kaltex', 'Kaltex BRD']];
  QI.ML_REFR = [['stopper', 'Stopper (nos)'], ['nozzle', 'Nozzle (nos)'], ['sleeves', 'Sleeves (nos)'], ['acidrm', 'Acid RM'], ['basicrm', 'Basic RM'], ['tips', 'Tips (nos)']];
  /* dropdown starters (from the Furnace Log Sheet and the Melting Excel log sheet); users add more under "Other" */
  QI.ML_DEFAULTS = {
    furnace: ['A', 'B'],
    mlGrade: ['W.I(T1)', 'M201 E', 'CRMO', 'IS:2707 G2', 'Hi-Si-A.S', 'INGOT', 'SCIMN2H/komatsu', 'AADITYA(W.I)', 'Komatsu', 'BML'],
    mlScrap: ['W.I', 'SS-430', 'SS304', 'SS310/HK40', 'SS 410', 'MS Scrap', 'Hardox', 'CrMoNi Scrap', 'Pig iron'],
    mlLadle: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
    mlRemarks: ['Cold furnace', 'Pouring completed', 'Hot furnace', 'Power trip during melting', 'Delay in pouring', 'Ladle changed'],
    mlWitness: [],
    mlProduct: [],
  };
  QI.mlList = (k) => QI.opts(k, QI.ML_DEFAULTS[k]);
  QI.mlStore = () => { const s = S().settings; return s.melt || (s.melt = { specs: {} }); };
  /* the grade spec printed on the sheet for W.I(T1) is remembered as a starter */
  QI.mlSeed = () => { const m = QI.mlStore(); if (m.seeded) return; m.specs['W.I(T1)'] = { C: { min: 2, max: 3.3 }, Si: { min: 1, max: 2.2 }, Mn: { min: 0.5, max: 1 }, P: { max: 0.1 }, S: { max: 0.06 }, Cr: { min: 18, max: 23 }, Mo: { min: 1.5, max: 2 } }; m.seeded = 1; QI.save(); };

  QI.mlNew = (heat, grade) => ({ heat: heat || '', furnace: '', grade: grade || '', date: new Date().toISOString().slice(0, 10), lining: '', patching: '', spec: JSON.parse(JSON.stringify((QI.mlStore().specs || {})[grade] || {})),
    bath: { b1: {}, b2: {}, b3: {}, final: {} }, powerOn: '', tapped: '', lm: { mould: '', pigged: '', heel: '', floor: '', skull: '' },
    power: { init: '', final: '', mult: 1000, max: '' }, ladle: { no: '', life: '', preheat: '' }, ldo: '', witness: '', tapTemp: '', pourTemp: '', tapMin: '', tapMax: '', pourMin: '', pourMax: '',
    scrap: [{ mat: '', wt: '', mrn: '' }, { mat: '', wt: '', mrn: '' }, { mat: '', wt: '', mrn: '' }, { mat: '', wt: '', mrn: '' }], fr: { wt: '', note: 'R/R' },
    alloys: {}, alloc: [{ boxes: '', product: '', qty: '', lmwt: '', net: '' }, { boxes: '', product: '', qty: '', lmwt: '', net: '' }, { boxes: '', product: '', qty: '', lmwt: '', net: '' }, { boxes: '', product: '', qty: '', lmwt: '', net: '' }],
    rinLM: '', rejected: '', flux: {}, consum: {}, refr: {}, nozzleSize: '', remarks: '', remarkNote: '', pourTime: '', sign: {} });
  QI.furnaceLog = (heat) => S().furnaceLogs.find((l) => l.heat === heat);

  QI.mlCalc = (l) => {
    const scrap = l.scrap.reduce((a, r) => a + num(r.wt), 0), fr = num(l.fr && l.fr.wt);
    const alloy = QI.ML_ALLOYS.reduce((a, [k]) => a + ((l.alloys[k] && l.alloys[k].w) || []).reduce((x, v) => x + num(v), 0), 0);
    const charges = scrap + fr + alloy;
    const lm = ['mould', 'pigged', 'heel', 'floor', 'skull'].reduce((a, k) => a + num(l.lm[k]), 0);
    const loss = lm > 0 ? charges - lm : null;
    const kwh = has(l.power.init) && has(l.power.final) ? (num(l.power.final) - num(l.power.init)) * (num(l.power.mult) || 1) : null;
    let ht = '';
    if (/^\d\d:\d\d$/.test(l.powerOn) && /^\d\d:\d\d$/.test(l.tapped)) { const m = (t) => +t.slice(0, 2) * 60 + +t.slice(3); let d = m(l.tapped) - m(l.powerOn); if (d < 0) d += 1440; ht = String(Math.floor(d / 60)).padStart(2, '0') + ':' + String(d % 60).padStart(2, '0'); }
    return { scrap, fr, alloy, charges, lm, loss, lossPct: loss != null && charges > 0 ? loss / charges * 100 : null, kwh, kwhPerT: kwh != null && lm > 0 ? kwh / (lm / 1000) : null, heatTime: ht };
  };
  QI.mlStatus = (l, el, v) => {          // 'ok' | 'low' | 'high' | '' for one reading against the sheet spec
    const s = l.spec[el]; if (!s || !has(v) || v === '') return '';
    if (has(s.min) && +s.min > 0 && +v < +s.min) return 'low';
    if (has(s.max) && +s.max > 0 && +v > +s.max) return 'high';
    return 'ok';
  };

  QI.mlSave = (l) => {
    const heatNo = (l.heat || '').trim(); if (!heatNo) return { error: 'Enter the heat number.' };
    if (!QI.can('melt')) return { error: 'Only the Melting department can save the furnace log.' };
    l.heat = heatNo;
    let h = QI.heat(heatNo);
    if (!h) { const r = QI.addHeat({ no: heatNo, date: l.date, furnace: l.furnace, grade: l.grade }); if (r.error) return r; h = QI.heat(heatNo); }
    Object.assign(h, { date: l.date, furnace: l.furnace || h.furnace, grade: l.grade || h.grade });
    ['tapMin', 'tapMax', 'pourMin', 'pourMax'].forEach((k) => { if (has(l[k])) h[k] = String(l[k]); });
    if (!(h.chemSpec || []).length) h.chemSpec = QI.ML_EL.filter((e) => l.spec[e] && (has(l.spec[e].min) && +l.spec[e].min > 0 || has(l.spec[e].max) && +l.spec[e].max > 0)).map((e) => ({ name: e, min: has(l.spec[e].min) && +l.spec[e].min > 0 ? String(l.spec[e].min) : '', max: has(l.spec[e].max) && +l.spec[e].max > 0 ? String(l.spec[e].max) : '' }));
    if (l.grade) QI.mlStore().specs[l.grade] = JSON.parse(JSON.stringify(l.spec));
    [['furnace', l.furnace], ['mlGrade', l.grade], ['mlLadle', l.ladle.no], ['mlWitness', l.witness], ['mlRemarks', l.remarks]].forEach(([k, v]) => QI.learn(k, v));
    l.scrap.forEach((r) => QI.learn('mlScrap', r.mat)); l.alloc.forEach((r) => QI.learn('mlProduct', r.product));
    l.by = S().settings.inspector || QI.me.name || ''; l.ts = Date.now();
    const i = S().furnaceLogs.findIndex((x) => x.heat === heatNo), copy = JSON.parse(JSON.stringify(l));
    if (i >= 0) S().furnaceLogs[i] = copy; else S().furnaceLogs.push(copy);
    QI.save(); return { ok: true };
  };
  QI.mlSign = (heat, role) => {
    const l = QI.furnaceLog(heat); if (!l) return { error: 'Save the log first.' };
    if (!QI.can('melt')) return { error: 'Only the Melting department can sign the furnace log.' };
    (l.sign || (l.sign = {}))[role] = { by: S().settings.inspector || QI.me.name || '', ts: Date.now() }; QI.save(); return { ok: true };
  };

  /* what posting to the inspection plan would record: 4.1 (last bath), 4.2 (ladle final), 4.3 tapping and 4.4 pouring temperature */
  QI.mlPreview = (heatNo) => {
    const l = QI.furnaceLog(heatNo), h = QI.heat(heatNo); if (!l || !h) return [];
    const spec = h.chemSpec || [];
    const vals = (b) => Object.fromEntries(spec.map((r) => [r.name, b && b[r.name] != null ? b[r.name] : '']));
    const filled = (b) => b && QI.ML_EL.some((e) => has(b[e]) && b[e] !== '');
    const lastKey = ['b3', 'b2', 'b1'].find((k) => filled(l.bath[k]));
    const items = [];
    const add = (id, label, input) => { const ch = QI.eff(id), ev = QI.evaluate(ch, input, { heat: h }); items.push({ id, label, input, ev, actions: ch.actions || [] }); };
    if (lastKey) add('4.1.1', 'Melting – ' + { b1: 'Bath 1', b2: 'Bath 2', b3: 'Bath 3' }[lastKey], { vals: vals(l.bath[lastKey]), ref: 'Furnace log ' + heatNo, remarks: '' });
    const b1 = items.find((x) => x.id === '4.1.1');
    if (b1 && !b1.ev.error && b1.ev.result === 'nok' && filled(l.bath.final)) {      // corrected by the ferro addition? then the ladle-final readings re-check 4.1
      const inp = { vals: vals(l.bath.final), ref: 'Furnace log ' + heatNo, remarks: 'Re-check after ferro-alloy addition (ladle final)' };
      const ev2 = QI.evaluate(QI.eff('4.1.1'), inp, { heat: h });
      if (!ev2.error && ev2.result === 'ok') b1.recheck = { input: inp, ev: ev2 };
    }
    if (filled(l.bath.final)) add('4.2.1', 'Final chemical composition – ladle final', { vals: vals(l.bath.final), ref: 'Furnace log ' + heatNo, remarks: '' });
    if (has(l.tapTemp) && l.tapTemp !== '') add('4.3.1', 'Tapping temperature', { value: l.tapTemp, min: h.tapMin || '', max: h.tapMax || '', result: '', ref: 'Furnace log ' + heatNo, remarks: '' });
    if (has(l.pourTemp) && l.pourTemp !== '') add('4.4.1', 'Pouring temperature', { value: l.pourTemp, min: h.pourMin || '', max: h.pourMax || '', result: '', ref: 'Furnace log ' + heatNo, remarks: '' });
    return items;
  };
  QI.mlPost = (heatNo, actions) => {
    const out = [];
    QI.mlPreview(heatNo).forEach((it) => {
      if (it.ev.error) { out.push({ id: it.id, error: it.ev.error }); return; }
      const r = QI.record('heat', heatNo, it.id, Object.assign({}, it.input, { action: (actions && actions[it.id]) || it.actions[0] || 'Other' }));
      if (!r.error && it.recheck && r.attempt.result === 'nok') { const r2 = QI.record('heat', heatNo, it.id, Object.assign({}, it.recheck.input, { action: '' })); if (!r2.error) { out.push({ id: it.id, result: 'ok', recheck: true, ncr: r.ncr && r.ncr.id }); return; } }
      out.push(r.error ? { id: it.id, error: r.error } : { id: it.id, result: r.attempt.result, ncr: r.ncr && r.ncr.id, rejected: r.rejected });
    });
    return out;
  };
  QI.mlSeed();
})();
