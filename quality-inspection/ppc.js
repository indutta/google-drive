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

  /* starting figures: PPC Daily Report as on 12.11.26 merged into the October pouring plan */
  const SEED_PPC = {"asOn":"2026-11-25","history":[{"asOn":"2026-11-12","by":"Claude (from PPC mail)","file":"Daily Report as on 12.11.26.pdf","pour":17,"ts":1794575507855,"wip":15},{"ts":1795698147990,"by":"Daily PPC sync","file":"Daily Report as on 25.11.26.pdf","asOn":"2026-11-25","wip":15,"pour":23}],"kpi":{"asOn":"2026-11-25","gc":{"target":96.86,"daily":7.56,"month":75.15,"rate":93.94,"year":726.07,"value":1955.44},"mm":{"daily":0,"month":335},"desp":{"target":106.03,"daily":9.585,"month":52.666,"rate":65.83,"year":639.62},"yieldPct":67.3},"month":"2026-10","plan":[{"customer":"Tega","item":"RM-22-11493ON00-T1","material":"White Iron","moulds":6,"order":6,"patt":1,"planKg":3630,"poured":6,"unitWt":605},{"customer":"Tega","item":"RM-22-11494ON00-T1","material":"White Iron","moulds":0,"order":3,"patt":1,"planKg":0,"poured":0,"unitWt":595},{"customer":"Tega","item":"RM-22-11904ON00-T1","material":"White Iron","moulds":47,"order":280,"patt":6,"planKg":8960,"poured":280,"unitWt":32},{"customer":"Tega","item":"RM-22-11905ON00-T1","material":"White Iron","moulds":47,"order":280,"patt":6,"planKg":8680,"poured":280,"unitWt":31},{"customer":"Tega","item":"RM-22-11906ON00-T1","material":"White Iron","moulds":67,"order":464,"patt":3,"planKg":12600,"poured":166,"unitWt":63},{"customer":"Tega","item":"RM-22-11907ON00-T1","material":"White Iron","moulds":66,"order":464,"patt":3,"planKg":12214,"poured":155,"unitWt":62},{"customer":"Tega","item":"RM-22-11909ON00-T1","material":"White Iron","moulds":70,"order":280,"patt":4,"planKg":10640,"poured":276,"unitWt":38},{"customer":"Tega","item":"RM-22-11910ON00-T1","material":"White Iron","moulds":64,"order":280,"patt":4,"planKg":9472,"poured":228,"unitWt":37},{"customer":"Tega","item":"RM-22-11912ON00-T1","material":"White Iron","moulds":32,"order":96,"patt":3,"planKg":5952,"poured":42,"unitWt":62},{"customer":"Tega","item":"RM-22-11913ON00-T1","material":"White Iron","moulds":32,"order":96,"patt":3,"planKg":5856,"poured":0,"unitWt":61},{"customer":"Tega","item":"RM-22-11939ON00-TI","material":"White Iron","moulds":71,"order":220,"patt":3,"planKg":27178,"poured":39,"unitWt":125},{"customer":"Tega","item":"RM-22-11939ON01-TI","material":"White Iron","moulds":15,"order":44,"patt":3,"planKg":4092,"poured":1,"unitWt":93},{"customer":"Tega","item":"RM-22-05785AN00-T1","material":"White Iron","moulds":0,"order":384,"patt":3,"planKg":0,"poured":262,"unitWt":65},{"customer":"Tega","item":"RM-22-05786AN00-T1","material":"White Iron","moulds":0,"order":32,"patt":3,"planKg":0,"poured":28,"unitWt":61},{"customer":"Tega","item":"RM-22-05788AN00-T1","material":"White Iron","moulds":0,"order":32,"patt":4,"planKg":0,"poured":27,"unitWt":44},{"customer":"BEML","item":"Idler-175 TF 31734 Rev.2","material":"IS:2707 Gr.II","moulds":25,"order":25,"patt":1,"planKg":14000,"poured":13,"unitWt":560},{"customer":"Tega","item":"RM-22-12117ON00-T1","material":"White Iron","moulds":0,"order":216,"patt":"","planKg":0,"poured":216,"unitWt":114},{"customer":"Tega","item":"RM-22-12121ON00-T1","material":"White Iron","moulds":0,"order":54,"patt":"","planKg":0,"poured":54,"unitWt":79},{"customer":"Tega","item":"RM-22-01952AN00-T1","material":"White Iron","moulds":0,"order":24,"patt":"","planKg":0,"poured":20,"unitWt":20},{"customer":"Tega","item":"RM-22-03068BN00-T1","material":"White Iron","moulds":0,"order":112,"patt":"","planKg":0,"poured":112,"unitWt":25},{"customer":"Tega","item":"RM-22-03071BN00-T1","material":"White Iron","moulds":0,"order":8,"patt":"","planKg":0,"poured":8,"unitWt":17},{"customer":"Tega","item":"RM-22-06182ON00-T1","material":"White Iron","moulds":0,"order":4,"patt":"","planKg":0,"poured":4,"unitWt":18},{"customer":"Uchimura","item":"Idler-17M3053110","material":"","moulds":0,"order":1,"patt":"","planKg":0,"poured":1,"unitWt":365},{"customer":"Uchimura","item":"Idler-1953061510","material":"SCSiMn2H","moulds":0,"order":1,"patt":"","planKg":0,"poured":1,"unitWt":510},{"customer":"Uchimura","item":"Idler-21N3033310","material":"","moulds":0,"order":2,"patt":"","planKg":0,"poured":2,"unitWt":671},{"customer":"Uchimura","item":"Idler-1543074110JW","material":"","moulds":0,"order":2,"patt":"","planKg":0,"poured":2,"unitWt":210},{"customer":"Tega","item":"RM-22-02718LN00-T1","material":"White Iron","unitWt":470,"planKg":0,"patt":"","moulds":0,"order":240,"poured":30},{"customer":"Tega","item":"RM-22-05946AN00-T1","material":"White Iron","unitWt":47,"planKg":0,"patt":"","moulds":0,"order":94,"poured":81},{"customer":"SONA","item":"RM-22-05947AN00-T1","material":"White Iron","unitWt":47,"planKg":0,"patt":"","moulds":0,"order":59,"poured":46}],"source":"PPC Daily Performance Report 26.10.26 and Tentative Pouring Plan Oct'26","targets":{"despLac":332,"despMT":113,"prodMT":118.53},"wip":[{"customer":"Tega","movMT":74.98,"movLac":221.45,"nonMT":6.8,"nonLac":17.89},{"customer":"Escorts Ltd","movMT":6.77,"movLac":11.75,"nonMT":1.02,"nonLac":2.082},{"customer":"BEML Ltd.","movMT":10.08,"movLac":11.44,"nonMT":14.7,"nonLac":23.17},{"customer":"Thejo Engg.","movMT":0,"movLac":0,"nonMT":0.5,"nonLac":1.39},{"customer":"Wilson Engg.","movMT":1.6,"movLac":2.05,"nonMT":0,"nonLac":0},{"customer":"TATA Metaliks Ltd.","movMT":0,"movLac":0,"nonMT":0.04,"nonLac":0.11},{"customer":"Uchimura/Komatsu","movMT":6.53,"movLac":18.1,"nonMT":0,"nonLac":0},{"customer":"ECL","movMT":0,"movLac":0,"nonMT":0.04,"nonLac":0.11},{"customer":"Aaditya Consultancy","movMT":0,"movLac":0,"nonMT":0.26,"nonLac":0.01},{"customer":"Hensley","movMT":0,"movLac":0,"nonMT":0.31,"nonLac":0.97},{"customer":"Paharpur","movMT":0,"movLac":0,"nonMT":0.44,"nonLac":1.15},{"customer":"METCO","movMT":0,"movLac":0,"nonMT":0.28,"nonLac":0.28},{"customer":"ESL","movMT":0,"movLac":0,"nonMT":2.87,"nonLac":8.79},{"customer":"IISCO","movMT":0,"movLac":0,"nonMT":0.3,"nonLac":0.64},{"customer":"Metso India Pvt. Ltd.","movMT":0,"movLac":0,"nonMT":0.12,"nonLac":0.31}]};
  QI.ppcSeed = () => {
    const st = S().settings;
    if (st.ppc && st.ppc.wip) return;
    st.ppc = JSON.parse(JSON.stringify(SEED_PPC));
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


  /* ---- upload of the PPC Daily Performance Report: compare with the figures in the app, then apply ---- */
  const nk = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  QI.ppcDiff = (r) => {
    const pp = S().settings.ppc || { plan: [], wip: [] }, plan = pp.plan || [];
    const upd = [], add = [];
    r.pouring.forEach((p) => {
      const cur = plan.find((x) => nk(x.item) === nk(p.item));
      if (!cur) add.push(p);
      else if (num(cur.order) !== num(p.order) || num(cur.poured) !== num(p.poured) || num(cur.unitWt) !== num(p.unitWt)) upd.push({ item: p.item, from: { order: num(cur.order), poured: num(cur.poured) }, to: { order: p.order, poured: p.poured } });
    });
    return { upd, add, older: pp.asOn && r.asOn < pp.asOn ? pp.asOn : '' };
  };
  QI.ppcApply = (r, fileName) => {
    if (!QI.can('ppc')) return { error: 'Only Planning and Quality can update the PPC figures.' };
    const st = S().settings; QI.ppcSeed(); const pp = st.ppc;
    pp.asOn = r.asOn; pp.wip = r.wip.map((x) => Object.assign({}, x));
    if (r.kpi && Object.keys(r.kpi).length) pp.kpi = Object.assign({ asOn: r.asOn }, r.kpi);
    pp.plan = pp.plan || [];
    r.pouring.forEach((p) => {
      const cur = pp.plan.find((x) => nk(x.item) === nk(p.item));
      if (cur) { cur.order = p.order; cur.poured = p.poured; if (p.unitWt) cur.unitWt = p.unitWt; if (!cur.material && p.material) cur.material = p.material; }
      else pp.plan.push({ customer: p.customer, item: p.item, material: p.material, unitWt: p.unitWt, planKg: 0, patt: '', moulds: 0, order: p.order, poured: p.poured });
    });
    pp.history = (pp.history || []).concat([{ ts: Date.now(), by: st.inspector || QI.me.name || '', file: fileName || '', asOn: r.asOn, wip: r.wip.length, pour: r.pouring.length }]).slice(-30);
    QI.save(); return { ok: true };
  };

  /* ---- monthly plan progress ---- */
  QI.ppcPlanTotals = () => {
    const p = (S().settings.ppc || {}).plan || [];
    return { planKg: p.reduce((a, r) => a + num(r.planKg), 0), moulds: p.reduce((a, r) => a + num(r.moulds), 0),
      order: p.reduce((a, r) => a + num(r.order), 0), poured: p.reduce((a, r) => a + num(r.poured), 0) };
  };
})();
