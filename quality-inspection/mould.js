/* DCL Quality Inspection – Moulding Daily Plan: item x heat quantities and sand / resin / catalyst / water calibration for P1-P3.
   Calibration posts to the sand & calibration log (stage 2 checks 2.4 resin, 2.5 catalyst, 2.6 / 2.7 sand). */
(function () {
  'use strict';
  const QI = window.QI;
  const S = () => QI.S();
  const num = (v) => (v === '' || v == null || !isFinite(+v)) ? 0 : +v;
  const has = (v) => v !== '' && v != null && isFinite(+v);
  QI.MP_PLANTS = ['p1', 'p2', 'p3'];
  QI.MP_CALIB = [['sand', 'Sand (kg / 15 sec)'], ['resin', 'Resin (ml / 15 sec)'], ['catalyst', 'Catalyst (ml / 15 sec)'], ['water', 'Water']];
  QI.mpStore = () => { const s = S().settings; return s.mould || (s.mould = { densResin: 1.15, densCat: 1.2 }); };    // densities convert ml -> kg for the % checks: CONFIRM against your resin / catalyst data sheets
  QI.mpNorm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  QI.mouldPlan = (date) => S().mouldPlans.find((p) => p.date === date);
  QI.mpNew = (date, copyFrom) => ({ date, items: copyFrom ? JSON.parse(JSON.stringify(copyFrom.items)) : [{ item: '', lines: [{ heat: '', qty: '' }] }],
    calib: { sand: {}, resin: {}, catalyst: {}, water: {} }, remarks: '' });

  QI.mpCalc = (p) => {
    const d = QI.mpStore(), perItem = p.items.map((it) => it.lines.reduce((a, l) => a + num(l.qty), 0));
    const heats = {};
    p.items.forEach((it) => it.lines.forEach((l) => { if (l.heat && num(l.qty)) { const k = QI.mpNorm(l.heat); (heats[k] = heats[k] || { label: l.heat, qty: 0 }).qty += num(l.qty); } }));
    const resinPct = {}, catPct = {};
    QI.MP_PLANTS.forEach((k) => {
      const sand = num(p.calib.sand[k]), res = num(p.calib.resin[k]), cat = num(p.calib.catalyst[k]);
      resinPct[k] = sand > 0 && res > 0 ? res * num(d.densResin) / (sand * 1000) * 100 : null;
      catPct[k] = res > 0 && cat > 0 ? cat * num(d.densCat) / (res * num(d.densResin)) * 100 : null;
    });
    return { perItem, total: perItem.reduce((a, b) => a + b, 0), heats: Object.values(heats), resinPct, catPct };
  };
  /* planned quantity vs boxes poured according to the furnace log of the same heat */
  QI.mpPoured = (heat, item) => {
    const fl = QI.furnaceLog(QI.heatNoFor(heat)); if (!fl) return null;
    return fl.alloc.filter((r) => QI.mpNorm(r.product) === QI.mpNorm(item)).reduce((a, r) => a + num(r.boxes), 0);
  };
  QI.heatNoFor = (typed) => { const h = S().heats.find((x) => QI.mpNorm(x.no) === QI.mpNorm(typed)); return h ? h.no : typed; };

  QI.mpSave = (p) => {
    if (!QI.can('mould')) return { error: 'Only Planning, Sand / Moulding and Quality can save the moulding plan.' };
    if (!p.date) return { error: 'Choose the date.' };
    p.items = p.items.filter((it) => it.item || it.lines.some((l) => l.heat || l.qty));
    p.items.forEach((it) => { QI.learn('mlProduct', it.item); it.lines.forEach((l) => QI.learn('mpHeat', l.heat)); });
    p.by = S().settings.inspector || QI.me.name || ''; p.ts = Date.now();
    const i = S().mouldPlans.findIndex((x) => x.date === p.date), copy = JSON.parse(JSON.stringify(p));
    if (i >= 0) S().mouldPlans[i] = copy; else S().mouldPlans.push(copy);
    QI.save(); return { ok: true };
  };

  /* calibration readings -> sand & calibration log checks (failing plants are posted last so the check ends on the failure) */
  QI.mpPreview = (p) => {
    const c = QI.mpCalc(p), out = [];
    const add = (id, label, plant, value) => { const ch = QI.eff(id), ev = QI.evaluate(ch, { value }, {}); out.push({ id, label, plant, value, ev, actions: ch.actions || [] }); };
    QI.MP_PLANTS.forEach((k) => { if (c.resinPct[k] != null) add('2.4.1', 'Resin calibration', k.toUpperCase(), +c.resinPct[k].toFixed(2)); });
    QI.MP_PLANTS.forEach((k) => { if (c.catPct[k] != null) add('2.5.1', 'Catalyst calibration', k.toUpperCase(), +c.catPct[k].toFixed(2)); });
    if (has(p.calib.sand.p1) && p.calib.sand.p1 !== '') add('2.6.1', 'P1 sand calibration', 'P1', +p.calib.sand.p1);
    if (has(p.calib.sand.p2) && p.calib.sand.p2 !== '') add('2.7.1', 'P2 sand calibration', 'P2', +p.calib.sand.p2);
    return out;
  };
  QI.mpPost = (p, shift, actions) => {
    const logId = `SL-${p.date.replace(/-/g, '')}-${shift}`;
    if (!QI.log(logId)) { const r = QI.addLog(p.date, shift); if (r.error && !QI.log(logId)) return { error: r.error }; }
    const items = QI.mpPreview(p).filter((x) => !x.ev.error).sort((a, b) => (a.ev.result === 'nok') - (b.ev.result === 'nok'));
    const res = items.map((it) => { const r = QI.record('log', logId, it.id, { value: it.value, ref: 'Moulding plan ' + p.date, remarks: it.plant, action: (actions && actions[it.id + it.plant]) || it.actions[0] || 'Other' }); return r.error ? { id: it.id, error: r.error } : { id: it.id, result: r.attempt.result, ncr: r.ncr && r.ncr.id }; });
    return { logId, res };
  };
})();
