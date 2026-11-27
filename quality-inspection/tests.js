/* Test results kept with the castings / heats: sand (moulding), chemical composition (melting), dimensions and physical tests
   at each heat-treatment stage (testing) – and the link from the daily production plans to those results. */
(function () {
  'use strict';
  const QI = window.QI;
  QI.PHYS_STAGES = ['As cast', 'After normalising', 'After quenching', 'After tempering', 'Final (after all heat treatment)'];
  QI.CHEM_EL = ['C', 'Si', 'Mn', 'P', 'S', 'Cr', 'Mo', 'Ni', 'Al', 'Cu', 'Sn', 'Ti'];
  QI.SAND_F = [['resinMixed', 'Resin % (mixed sand)'], ['catalystMixed', 'Catalyst % (mixed sand)'], ['resinNew', 'Resin % (new sand)'], ['catalystNew', 'Catalyst % (new sand)'], ['fines', 'Fines'], ['moisture', 'Moisture'], ['tensile', 'Tensile strength'], ['compressive', 'Compressive strength'], ['gas', 'Gas content'], ['loi', 'L.O.I'], ['newCompressive', 'Compressive strength (new sand)'], ['mouldHardness', 'Mould hardness (scratch)'], ['paint', 'Paint (°Bé)']];
  QI.PHYS_F = [['uts', 'UTS (MPa)'], ['ys', 'YS (MPa)'], ['el', 'Elongation %E'], ['ra', 'Reduction of area %RA'], ['impact', 'Impact (J)'], ['hardness', 'Hardness (HB)']];
  const has = (v) => v !== '' && v != null;
  QI.tests = (c) => c.tests || (c.tests = {});
  QI.sandOf = (c) => (c.tests && c.tests.sand) || null;
  QI.physOf = (c) => (c.tests && c.tests.phys) || [];
  QI.dimOf = (c) => (c.tests && c.tests.dim) || null;
  QI.castingsForItem = (item) => { const k = QI.mpNorm(item); return k ? QI.S().castings.filter((c) => c.status === 'active' && QI.mpNorm((QI.job(c.jobNo) || {}).part || '') === k) : []; };
  /* limits entered on the heat (Specification) are used to flag a result */
  QI.chemFlag = (heat, el, v) => { const s = (heat.chemSpec || []).find((x) => String(x.name).toUpperCase() === el.toUpperCase()); if (!s || !has(v)) return ''; const n = +v; if (has(s.min) && n < +s.min) return 'low'; if (has(s.max) && n > +s.max) return 'high'; return 'ok'; };
  QI.testSave = (kind, c, data) => {
    if (!QI.can('test', kind)) return { error: 'Your department cannot record this test.' };
    if (kind === 'sand') QI.tests(c).sand = data;
    else if (kind === 'dim') QI.tests(c).dim = data;
    else if (kind === 'phys') { const t = QI.tests(c); t.phys = (t.phys || []).filter((p) => p.stage !== data.stage).concat([data]).sort((a, b) => QI.PHYS_STAGES.indexOf(a.stage) - QI.PHYS_STAGES.indexOf(b.stage)); }
    QI.save(); return { ok: true };
  };
  QI.chemSave = (heat, data) => { if (!QI.can('test', 'chem')) return { error: 'Your department cannot record chemical composition.' }; heat.chem = data; QI.save(); return { ok: true }; };

  /* Daily production plans (moulding, melting, heat treatment) against the test results of the same items / heats */
  QI.testSync = (date) => {
    const mp = QI.mouldPlan(date), ml = QI.meltPlan(date), ht = QI.htPlan(date), out = { mould: [], melt: [], ht: [] };
    const cnt = (cs, f) => [cs.filter(f).length, cs.length];
    ((mp && mp.items) || []).filter((i) => i.item).forEach((i) => { const cs = QI.castingsForItem(i.item); out.mould.push({ item: i.item, sand: cnt(cs, (c) => QI.sandOf(c)) }); });
    ((ml && ml.rows) || []).filter((r) => r.heat).forEach((r) => { const no = QI.heatNoFor(r.heat), h = QI.heat(no); out.melt.push({ heat: r.heat, no, exists: !!h, chem: !!(h && h.chem), castings: h ? QI.heatCastings(no).length : 0 }); });
    ((ht && ht.rows) || []).filter((r) => r.item).forEach((r) => { const cs = QI.castingsForItem(r.item);
      out.ht.push({ item: r.item, rec: cnt(cs, (c) => c.htRec && c.htRec.ts), phys: cnt(cs, (c) => QI.physOf(c).length), dim: cnt(cs, (c) => QI.dimOf(c)), stages: QI.PHYS_STAGES.slice(1, 4).map((s) => [s, cnt(cs, (c) => QI.physOf(c).some((p) => p.stage === s))]) }); });
    return out;
  };
  QI.testTotals = () => { const s = QI.S(), cs = s.castings.filter((c) => c.status === 'active');
    return { sandPending: cs.filter((c) => !QI.sandOf(c)).length, chemPending: s.heats.filter((h) => !h.chem).length, physPending: cs.filter((c) => !QI.physOf(c).length).length, dimPending: cs.filter((c) => !QI.dimOf(c)).length }; };
})();
