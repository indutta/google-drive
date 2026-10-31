/* DCL Daily Production & Inspection – PPC data (monthly pouring plan, WIP, heat treatment plan) synchronised with the inspection plan.
   Seed values are copied from the PPC "Daily Performance Report" of 26.10.26 and the "Tentative Pouring Plan October'26" mailed by Tamal Mithia. */
(function () {
  'use strict';
  const QI = window.QI;
  const S = () => QI.S();
  const num = (v) => (v === '' || v == null || !isFinite(+v)) ? 0 : +v;
  const today = () => new Date().toISOString().slice(0, 10);

  /* [customer, item, material, unit wt kg, planned moulds' casting wt kg, patterns per m/c, moulds, order qty, poured qty (cum.)] */
  const PLAN = [
    ['Tega', 'RM-22-11493ON00-T1', 'White Iron', 605, 3630, 1, 6, 6, 6], ['Tega', 'RM-22-11494ON00-T1', 'White Iron', 595, 0, 1, 0, 3, 0],
    ['Tega', 'RM-22-11904ON00-T1', 'White Iron', 32, 8960, 6, 47, 280, 280], ['Tega', 'RM-22-11905ON00-T1', 'White Iron', 31, 8680, 6, 47, 280, 280],
    ['Tega', 'RM-22-11906ON00-T1', 'White Iron', 63, 12600, 3, 67, 464, 166], ['Tega', 'RM-22-11907ON00-T1', 'White Iron', 62, 12214, 3, 66, 464, 155],
    ['Tega', 'RM-22-11909ON00-T1', 'White Iron', 38, 10640, 4, 70, 280, 276], ['Tega', 'RM-22-11910ON00-T1', 'White Iron', 37, 9472, 4, 64, 280, 228],
    ['Tega', 'RM-22-11912ON00-T1', 'White Iron', 62, 5952, 3, 32, 96, 96], ['Tega', 'RM-22-11913ON00-T1', 'White Iron', 61, 5856, 3, 32, 96, 96],
    ['Tega', 'RM-22-11939ON00-TI', 'White Iron', 127, 27178, 3, 71, 220, 214], ['Tega', 'RM-22-11939ON01-TI', 'White Iron', 93, 4092, 3, 15, 44, 44],
    ['Tega', 'RM-22-05785AN00-T1', 'White Iron', 65, 0, 3, 0, 384, 379], ['Tega', 'RM-22-05786AN00-T1', 'White Iron', 61, 0, 3, 0, 32, 28],
    ['Tega', 'RM-22-05788AN00-T1', 'White Iron', 44, 0, 4, 0, 32, 27], ['BEML', 'Idler-175 TF 31734 Rev.2', 'IS:2707 Gr.II', 560, 14000, 1, 25, 25, 25]
  ];
  /* [customer, moving MT, moving value (Lac), non-moving MT, non-moving value (Lac)] – castings on progress in factory, 26.10.26 */
  const WIP = [['Tega', 75.43, 224.92, 6.67, 17.17], ['Escorts', 3.02, 5.77, 1.02, 2.08], ['BEML', 8.4, 9.54, 15.96, 25.16], ['Thejo', 0.19, 0.37, 0.31, 1.02],
    ['Wilson', 1.6, 2.05, 0, 0], ['Uchimura', 3.89, 8.89, 0, 0], ['Others', 0, 0, 5.67, 11.54]];

  QI.ppcSeed = () => {
    const st = S().settings;
    if (st.ppc && st.ppc.wip) return;
    st.ppc = { asOn: '2026-10-26', month: '2026-10', source: 'PPC Daily Performance Report 26.10.26 and Tentative Pouring Plan Oct\'26',
      plan: PLAN.map((r) => ({ customer: r[0], item: r[1], material: r[2], unitWt: r[3], planKg: r[4], patt: r[5], moulds: r[6], order: r[7], poured: r[8] })),
      wip: WIP.map((r) => ({ customer: r[0], movMT: r[1], movLac: r[2], nonMT: r[3], nonLac: r[4] })),
      targets: { prodMT: 118.53, despMT: 113, despLac: 332 } };
  };

  /* ---- heat treatment daily plan ---- */
  QI.htPlan = (date) => S().htPlans.find((p) => p.date === date);
  QI.htNew = (date) => ({ date, rows: [{ item: '', furnace: '', start: '', cycle: '', weight: '' }], note: '' });
  QI.htSave = (p) => {
    if (!QI.can('ht')) return { error: 'Only Fettling / Heat treatment, Planning and Quality can save the heat treatment plan.' };
    if (!p.date) return { error: 'Choose the date.' };
    p.rows = p.rows.filter((r) => r.item || r.furnace || r.weight);
    p.rows.forEach((r) => { QI.learn('mlProduct', r.item); QI.learn('htFurnace', r.furnace); });
    if (!p.rows.length) p.rows = [{ item: '', furnace: '', start: '', cycle: '', weight: '' }];
    p.by = S().settings.inspector || QI.me.name || ''; p.ts = Date.now();
    const i = S().htPlans.findIndex((x) => x.date === p.date), copy = JSON.parse(JSON.stringify(p));
    if (i >= 0) S().htPlans[i] = copy; else S().htPlans.push(copy);
    QI.save(); return { ok: true };
  };
  QI.htDelete = (date) => { const i = S().htPlans.findIndex((x) => x.date === date); if (i >= 0) { S().htPlans.splice(i, 1); QI.save(); } };

  /* ---- customer matching: PPC customer name <-> work order customer ---- */
  const cust = (n) => String(n || '').toLowerCase().replace(/[^a-z]/g, '');
  QI.ppcCustomerMatch = (ppcName, jobCustomer) => { const a = cust(ppcName), b = cust(jobCustomer); return !!a && !!b && (b.includes(a) || a.includes(b)); };

  /* ---- WIP in the inspection app by customer and current stage ---- */
  QI.ppcWipApp = () => {
    const out = {};
    S().castings.forEach((c) => {
      if (c.status !== 'active') return;
      const j = QI.job(c.jobNo) || {}; const x = QI.castingState(c);
      const k = j.customer || 'Unassigned'; const o = out[k] || (out[k] = { n: 0, byStage: {}, failing: 0, awaiting: 0 });
      o.n++; const sn = x.stageNo || 10; o.byStage[sn] = (o.byStage[sn] || 0) + 1; if (x.failing) o.failing++; if (!x.label.startsWith('Stage')) o.awaiting++;
    });
    return out;
  };

  /* ---- inspection requirement of each department's plan for a date ---- */
  const stat = (scope, owner, ids) => { let ok = 0, nok = 0, open = 0; ids.forEach((id) => { const s = QI.status(scope, owner, id); if (s === 'ok') ok++; else if (s === 'nok') nok++; else open++; }); return { ok, nok, open, total: ids.length }; };
  const stepIds = (stageNo) => QI.stageOf[stageNo].groups.flatMap((g) => g.steps.flatMap((sp) => sp.checks.map((c) => c.id)));
  QI.ppcInspection = (date) => {
    const st = S();
    const logs = st.logs.filter((l) => l.date === date);
    const sandIds = stepIds(2).filter((id) => { const c = QI.checks[id]; return c && (c.freq === 'shift' || c.freq === 'daily'); });
    const sand = logs.map((l) => Object.assign({ log: l }, stat('log', l.id, sandIds)));
    const mp = QI.mouldPlan(date), mpl = QI.meltPlan(date), ht = QI.htPlan(date);
    const heatIds = stepIds(4);
    const heats = ((mpl && mpl.rows) || []).filter((r) => r.heat).map((r) => { const no = QI.heatNoFor(r.heat); return Object.assign({ row: r, heatNo: no, exists: !!QI.heat(no), log: !!QI.furnaceLog(no) }, stat('heat', no, heatIds)); });
    const htItems = ((ht && ht.rows) || []).filter((r) => r.item).map((r) => {
      const k = QI.mpNorm(r.item); const cs = st.castings.filter((c) => c.status === 'active' && QI.mpNorm((QI.job(c.jobNo) || {}).part || '') === k);
      return { row: r, castings: cs.length };
    });
    const at56 = st.castings.filter((c) => { if (c.status !== 'active') return false; const x = QI.castingState(c); return x.stageNo >= 5 && x.stageNo <= 6 && x.label.startsWith('Stage'); }).length;
    return { date, sand, sandIds: sandIds.length, mould: mp, melt: mpl, heats, ht, htItems, at56 };
  };

  /* ---- monthly plan progress ---- */
  QI.ppcPlanTotals = () => {
    const p = (S().settings.ppc || {}).plan || [];
    return { planKg: p.reduce((a, r) => a + num(r.planKg), 0), moulds: p.reduce((a, r) => a + num(r.moulds), 0),
      order: p.reduce((a, r) => a + num(r.order), 0), poured: p.reduce((a, r) => a + num(r.poured), 0) };
  };
})();
