/* DCL Quality Inspection – data layer, plan indexes, evaluation rules and workflow logic.
   Everything lives in localStorage (key dcl_qi_v1) so the app works offline on the shop floor. */
(function () {
  'use strict';
  const KEY = 'dcl_qi_v1';
  const QI = (window.QI = {});
  const PLAN = window.PLAN;

  /* ---------- plan indexes ---------- */
  QI.plan = PLAN;
  QI.stages = PLAN.stages;
  QI.checks = {};
  QI.steps = {};
  QI.stageOf = {};
  PLAN.stages.forEach((st) => {
    QI.stageOf[st.no] = st;
    st.groups.forEach((g) => g.steps.forEach((sp) => {
      sp.stageNo = st.no;
      QI.steps[sp.id] = sp;
      sp.checks.forEach((c) => { c.stageNo = st.no; c.scope = st.scope; QI.checks[c.id] = c; });
    }));
  });
  QI.allChecks = () => Object.values(QI.checks);

  /* ---------- state ---------- */
  const blank = () => ({ v: 1, seq: { ncr: 0, log: 0 }, settings: { inspector: '', overrides: {} },
    jobs: [], castings: [], heats: [], logs: [], results: {}, approvals: {}, ncrs: [] });
  let S = blank();
  QI.persistent = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { QI.persistent = false; }
  QI.S = () => S;
  QI.mode = 'local';                       // 'shared' once attached to the artifact database
  QI.save = () => {
    if (QI.mode === 'shared') return pushDiff();
    try { localStorage.setItem(KEY, JSON.stringify(S)); QI.persistent = true; } catch (e) { QI.persistent = false; }
  };
  QI.replace = (obj) => { const keep = S.settings.inspector; S = Object.assign(blank(), obj); S.settings = Object.assign({ overrides: {} }, S.settings, { inspector: keep }); QI.save(); };
  QI.reset = () => { const keep = S.settings.inspector; S = blank(); S.settings.inspector = keep; QI.save(); };
  QI.ncrId = () => {
    const d = new Date(); const base = `NCR-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-`;
    let id; do { id = base + Math.random().toString(36).slice(2, 5).toUpperCase(); } while (S.ncrs.some((n) => n.id === id));
    return id;
  };

  /* ---------- departments & permissions (shared mode only; local mode = everything allowed) ---------- */
  QI.DEPTS = [
    { id: 'planning', name: 'Planning / PPC', stages: [], create: ['job', 'casting'], about: 'Creates work orders and castings' },
    { id: 'pattern', name: 'Pattern shop', stages: [1], about: 'Stage 1' },
    { id: 'sand', name: 'Sand lab & moulding', stages: [2, 3], create: ['log'], link: ['log'], about: 'Stages 2–3, sand logs' },
    { id: 'melt', name: 'Melting & pouring', stages: [4], create: ['heat'], link: ['heat'], about: 'Stage 4, heats' },
    { id: 'fettle', name: 'Shot blasting, fettling & heat treatment', stages: [5, 6], about: 'Stages 5–6' },
    { id: 'lab', name: 'NDT & mechanical / metallurgical lab', stages: [7, 8], about: 'Stages 7–8' },
    { id: 'mach', name: 'Machining', stages: [9], about: 'Stage 9' },
    { id: 'qa', name: 'Quality assurance & final inspection', stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], all: true, about: 'Stage 10, release, rejection, NCR closure, everything else' },
    { id: 'qcm', name: 'QC Manager', stages: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], all: true, approver: 'qc', about: 'Second approval on every stage, plus release / reject / NCR closure' },
    { id: 'head', name: 'Factory Head', stages: [], approver: 'head', extra: ['release', 'reject'], about: 'Final approval on every stage' },
    { id: 'mgmt', name: 'Management (view only)', stages: [], about: 'Dashboards and reports' },
  ];
  QI.me = { uid: null, name: '', dept: null, canWrite: true };
  QI.people = {};
  QI.dept = () => QI.DEPTS.find((d) => d.id === QI.me.dept) || null;
  QI.can = (action, arg) => {
    if (QI.mode === 'local') return true;
    const d = QI.dept(); if (!QI.me.canWrite || !d) return false;
    if (action === 'approve') return d.approver === arg;
    if (action === 'reopen') return !!d.approver;
    if (d.extra && d.extra.includes(action)) return true;
    if (d.all) return true;
    if (action === 'record') return d.stages.includes(arg);
    if (action === 'create') return (d.create || []).includes(arg);
    if (action === 'link') return (d.link || []).includes(arg);
    if (action === 'spec') return d.id === 'melt' || d.id === 'lab';
    return false;                                 // release, reject, ncr, plan, admin: quality only
  };

  /* ---------- shared backend: one db document per job / casting / heat / log / NCR / result ---------- */
  let DB = null, ready = true, synced = {}, queue = Promise.resolve();
  QI.ready = true; QI.onChange = () => {}; QI.onError = () => {};
  const enc = (x) => String(x).replace(/[^A-Za-z0-9_\-.~:@+]/g, (c) => '_' + c.charCodeAt(0).toString(16) + '_');
  const COLS = { jobs: 'no', castings: 'id', heats: 'no', logs: 'id', ncrs: 'id' };
  const cfgForm = () => ({ seeded: !!S.settings.seeded, lists: S.settings.lists || {}, actionCls: S.settings.actionCls || {}, overrides: S.settings.overrides || {} });
  const desired = () => {
    const m = {};
    Object.keys(COLS).forEach((c) => S[c].forEach((x) => (m[c + '/' + enc(x[COLS[c]])] = x)));
    Object.keys(S.results).forEach((k) => (m['results/' + enc(k)] = { key: k, attempts: S.results[k].attempts }));
    Object.keys(S.approvals).forEach((k) => (m['approvals/' + enc(k)] = { key: k, steps: S.approvals[k].steps || {}, log: S.approvals[k].log || [] }));
    m['meta/config'] = cfgForm();
    return m;
  };
  function pushDiff() {
    if (!DB || !ready) return;
    const d = desired(), ops = [];
    Object.keys(d).forEach((p) => { const j = JSON.stringify(d[p]); if (synced[p] !== j) { synced[p] = j; ops.push([p, () => DB.doc(p).set(JSON.parse(j))]); } });
    Object.keys(synced).forEach((p) => { if (!(p in d)) { delete synced[p]; ops.push([p, () => DB.doc(p).delete()]); } });
    ops.forEach(([p, op]) => { queue = queue.then(op).catch((e) => { delete synced[p]; QI.onError(e); }); });
  }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  function putInPlace(arr, keyName, body) {
    const i = arr.findIndex((x) => x[keyName] === body[keyName]);
    if (i < 0) { arr.push(body); return { item: body, changed: true }; }
    const cur = arr[i];
    if (JSON.stringify(cur) === JSON.stringify(body)) return { item: cur, changed: false };
    Object.keys(cur).forEach((k) => delete cur[k]); Object.assign(cur, body);
    return { item: cur, changed: true };
  }
  function listen(path, handler, firstDone) {
    let first = true;
    DB.collection(path).onSnapshot((snap) => {
      let changed = false;
      snap.docChanges().forEach((ch) => { if (handler(ch)) changed = true; });
      if (first) { first = false; firstDone(); } else if (changed) QI.onChange();
    }, (e) => QI.onError(e));
  }
  QI.attach = async (db, user) => {
    DB = db; QI.mode = 'shared'; ready = false; QI.ready = false; S = blank(); synced = {};
    if (user) {
      try { QI.me.uid = await user.id(); const m = await user.me(); QI.me.name = (m && m.name) || ''; } catch (e) {}
      const w = user.can ? user.can('data.write') : null; QI.me.canWrite = w !== false;
    }
    let pending = 0;
    const done = () => { if (--pending === 0) { ready = true; QI.ready = true; QI.seed(); pushDiff(); QI.onChange(true); } };
    const reg = (path, handler) => { pending++; listen(path, handler, done); };
    Object.keys(COLS).forEach((col) => reg(col, (ch) => {
      const body = clone(ch.doc.data() || {}), p = col + '/' + ch.doc.id;
      if (ch.type === 'removed') { const i = S[col].findIndex((x) => x[COLS[col]] === body[COLS[col]]); if (i >= 0) S[col].splice(i, 1); delete synced[p]; return true; }
      const r = putInPlace(S[col], COLS[col], body); synced[p] = JSON.stringify(r.item); return r.changed;
    }));
    reg('results', (ch) => {
      const body = clone(ch.doc.data() || {}), p = 'results/' + ch.doc.id;
      if (ch.type === 'removed') { delete S.results[body.key]; delete synced[p]; return true; }
      const cur = S.results[body.key];
      const same = cur && JSON.stringify(cur.attempts) === JSON.stringify(body.attempts);
      if (!cur) S.results[body.key] = { attempts: body.attempts }; else if (!same) cur.attempts = body.attempts;
      synced[p] = JSON.stringify({ key: body.key, attempts: S.results[body.key].attempts });
      return !same;
    });
    reg('approvals', (ch) => {
      const body = clone(ch.doc.data() || {}), p = 'approvals/' + ch.doc.id;
      if (ch.type === 'removed') { delete S.approvals[body.key]; delete synced[p]; return true; }
      const cur = S.approvals[body.key], nu = { steps: body.steps || {}, log: body.log || [] };
      const same = cur && JSON.stringify(cur) === JSON.stringify(nu);
      if (!cur) S.approvals[body.key] = nu; else if (!same) { cur.steps = nu.steps; cur.log = nu.log; }
      synced[p] = JSON.stringify({ key: body.key, steps: S.approvals[body.key].steps, log: S.approvals[body.key].log });
      return !same;
    });
    reg('meta', (ch) => {
      if (ch.doc.id !== 'config' || ch.type === 'removed') return false;
      const b = clone(ch.doc.data() || {}); const before = JSON.stringify(cfgForm());
      S.settings.seeded = !!b.seeded; S.settings.lists = b.lists || {}; S.settings.actionCls = b.actionCls || {}; S.settings.overrides = b.overrides || {};
      synced['meta/config'] = JSON.stringify(cfgForm()); return before !== synced['meta/config'];
    });
    reg('people', (ch) => {
      if (ch.type === 'removed') { delete QI.people[ch.doc.id]; return true; }
      QI.people[ch.doc.id] = clone(ch.doc.data() || {});
      if (QI.me.uid && ch.doc.id === enc(QI.me.uid)) { QI.me.dept = QI.people[ch.doc.id].dept || null; if (QI.people[ch.doc.id].name) QI.me.name = QI.people[ch.doc.id].name; S.settings.inspector = QI.me.name; }
      return true;
    });
  };
  QI.setPerson = (name, dept) => {
    QI.me.name = name; QI.me.dept = dept; S.settings.inspector = name;
    if (DB && QI.me.uid) DB.doc('people/' + enc(QI.me.uid)).set({ name, dept, ts: Date.now() }).catch((e) => QI.onError(e));
    QI.people[enc(QI.me.uid || 'local')] = { name, dept };
  };

  /* ---------- helpers ---------- */
  const num = (v) => { if (v === '' || v == null) return null; const n = parseFloat(v); return isFinite(n) ? n : null; };
  QI.num = num;
  const inLim = (v, min, max) => (min == null || v >= min) && (max == null || v <= max);
  QI.limText = (min, max, unit) => {
    const u = unit ? ' ' + unit : '';
    if (min != null && max != null) return `${min} – ${max}${u}`;
    if (min != null) return `≥ ${min}${u}`;
    if (max != null) return `≤ ${max}${u}`;
    return '';
  };
  /* ---- dropdown lists: defaults + values users typed under "Other" (learned automatically) ---- */
  QI.opts = (key, defs) => {
    const l = (S.settings.lists && S.settings.lists[key]) || [];
    return [...new Set([...(defs || []), ...l])];
  };
  QI.learn = (key, v) => {
    v = (v || '').trim(); if (!v) return;
    const L = S.settings.lists || (S.settings.lists = {});
    const a = L[key] || (L[key] = []);
    if (!a.some((x) => x.toLowerCase() === v.toLowerCase())) { a.push(v); QI.save(); }
  };
  QI.unlearn = (key, v) => { const a = S.settings.lists && S.settings.lists[key]; if (a) { S.settings.lists[key] = a.filter((x) => x !== v); QI.save(); } };
  /* first-run dropdown content: customers and the items cast for each (editable under Settings -> Dropdown lists) */
  QI.SEED_CUSTOMERS = ['Tega', 'Thejo', 'Komatsu', 'BEML', 'Sona'];
  QI.SEED_PARTS = ['Knuckle', 'Main Body'];
  QI.seed = () => {
    if (S.settings.seeded) return;
    QI.SEED_CUSTOMERS.forEach((c) => { QI.learn('customer', c); QI.SEED_PARTS.forEach((p) => QI.learn('part:' + c, p)); });
    S.settings.seeded = true; QI.save();
  };
  QI.learnAction = (checkId, text, cls) => {
    QI.learn('action:' + checkId, text);
    (S.settings.actionCls || (S.settings.actionCls = {}))[text] = cls || 'rework'; QI.save();
  };
  QI.DEFAULTS = {
    rejectReason: ['Shrinkage', 'Gas porosity / blow hole', 'Sand inclusion', 'Crack', 'Misrun / cold shut', 'Dimensional out of tolerance', 'Chemistry out of spec', 'Surface defect', 'Mould / core damage'],
    remarks: ['Re-tested', 'Sample taken from ladle', 'Customer witnessed', 'Instrument re-calibrated', 'Repeat reading confirmed'],
    closeNote: ['Reworked and re-inspected OK', 'Sand corrected and re-tested', 'Machine re-adjusted and re-calibrated', 'Material disposed / scrapped', 'Accepted as per customer concession'],
    releaseRemarks: ['Dispatch as per PO', 'Customer inspection pending', 'Hold for customer witness'],
  };
  QI.classify = (action) => {
    const a = action || '';
    if (S.settings.actionCls && S.settings.actionCls[a]) return S.settings.actionCls[a];
    if (/re-?heat|re-?machin|rework|repair|re-?close|repaint|re-?mix|re-?adjust|adjust|rectif|salvag|re-?shot|re-?pack|addition|increase|wait|back to furnace|pig the melt|re-?make|remaking|re-?work/i.test(a)) return 'rework';
    if (/reject|destroy|remelt|scrap|dispos|return to supplier/i.test(a)) return 'reject';
    return 'rework';
  };

  /* check definition merged with user overrides from the Inspection Plan page */
  QI.eff = (id) => {
    const base = QI.checks[id];
    const o = S.settings.overrides[id];
    return o ? Object.assign({}, base, o) : base;
  };

  /* ---------- records ---------- */
  const rkey = (scope, owner, id) => `${scope}|${owner}|${id}`;
  QI.rkey = rkey;
  QI.rec = (scope, owner, id) => S.results[rkey(scope, owner, id)] || null;
  QI.last = (scope, owner, id) => { const r = QI.rec(scope, owner, id); return r ? r.attempts[r.attempts.length - 1] : null; };
  QI.status = (scope, owner, id) => { const a = QI.last(scope, owner, id); return a ? a.result : 'none'; };

  /* ---------- lookups ---------- */
  QI.job = (no) => S.jobs.find((j) => j.no === no);
  QI.casting = (id) => S.castings.find((c) => c.id === id);
  QI.heat = (no) => S.heats.find((h) => h.no === no);
  QI.log = (id) => S.logs.find((l) => l.id === id);
  QI.heatCastings = (no) => S.castings.filter((c) => c.heatNo === no);
  QI.logCastings = (id) => S.castings.filter((c) => c.logId === id);
  QI.jobCastings = (no) => S.castings.filter((c) => c.jobNo === no);

  QI.ownerOf = (c, scope) => scope === 'job' ? c.jobNo : scope === 'log' ? c.logId : scope === 'heat' ? c.heatNo : c.id;
  const dflt = { '9.1': false, '7.4': false };
  QI.defaultApplic = () => { const o = {}; Object.keys(QI.steps).forEach((id) => { if (QI.steps[id].optional) o[id] = dflt[id] !== undefined ? dflt[id] : true; }); return o; };
  QI.required = (job, check) => {
    const sp = QI.steps[check.step];
    if (sp.sampled) return false;
    if (sp.optional) return !!(job && job.applic && job.applic[sp.id]);
    return true;
  };
  QI.applicable = (job, check) => { const sp = QI.steps[check.step]; return !sp.optional || !!(job && job.applic && job.applic[sp.id]); };

  /* ---------- evaluation ---------- */
  QI.evaluate = (check, input, ctx) => {
    input = input || {};
    const unit = check.unit || '';
    const k = check.kind;
    if (k === 'max' || k === 'min' || k === 'range') {
      const v = num(input.value);
      if (v == null) return { error: 'Enter the measured value.' };
      return { result: inLim(v, check.min, check.max) ? 'ok' : 'nok', summary: `${v}${unit ? ' ' + unit : ''}` };
    }
    if (k === 'spec') {
      const v = num(input.value), mn = num(input.min), mx = num(input.max);
      if (mn == null && mx == null) {
        if (input.result !== 'ok' && input.result !== 'nok') return { error: 'Enter the limits, or choose OK / Not OK.' };
        return { result: input.result, summary: v != null ? `${v}${unit ? ' ' + unit : ''}` : '' };
      }
      if (v == null) return { error: 'Enter the measured value.' };
      return { result: inLim(v, mn, mx) ? 'ok' : 'nok', summary: `${v}${unit ? ' ' + unit : ''} (limit ${QI.limText(mn, mx, unit)})` };
    }
    if (k === 'yn') {
      if (input.result !== 'ok' && input.result !== 'nok') return { error: 'Choose OK or Not OK.' };
      return { result: input.result, summary: input.result === 'ok' ? 'OK' : 'Not OK' };
    }
    if (k === 'dim') {
      const rows = (input.rows || []).filter((r) => r.name || r.nominal != null || r.actual != null);
      if (!rows.length) return { error: 'Add at least one dimension.' };
      let bad = [];
      for (const r of rows) {
        const nom = num(r.nominal), act = num(r.actual), tm = num(r.tm) || 0, tp = num(r.tp) || 0;
        if (nom == null || act == null) return { error: 'Each dimension needs a nominal and an actual value.' };
        r.ok = act >= nom - Math.abs(tm) - 1e-9 && act <= nom + Math.abs(tp) + 1e-9;
        if (!r.ok) bad.push(r.name || nom);
      }
      return { result: bad.length ? 'nok' : 'ok', summary: bad.length ? `Out of tolerance: ${bad.join(', ')}` : `${rows.length} dimension(s) within tolerance` };
    }
    if (k === 'chem' || k === 'mech') {
      const spec = ctx && ctx.heat ? (k === 'chem' ? ctx.heat.chemSpec : ctx.heat.mechSpec) : null;
      if (!spec || !spec.length) return { error: `Define the ${k === 'chem' ? 'chemical composition' : 'mechanical'} specification on the heat first.` };
      const vals = input.vals || {};
      const bad = [], out = [];
      for (const row of spec) {
        const v = num(vals[row.name]);
        if (v == null) return { error: `Enter a value for ${row.name}.` };
        out.push(`${row.name} ${v}`);
        if (!inLim(v, num(row.min), num(row.max))) bad.push(row.name);
      }
      return { result: bad.length ? 'nok' : 'ok', summary: bad.length ? `Out of spec: ${bad.join(', ')}` : 'All within specification', detail: out.join(' · ') };
    }
    return { error: 'Unknown check type.' };
  };

  /* ---------- creating records ---------- */
  QI.addJob = (d) => {
    if (!QI.can('create', 'job')) return { error: 'Your department cannot create work orders.' };
    if (!d.no) return { error: 'Work order number is required.' };
    if (QI.job(d.no)) return { error: 'A work order with this number already exists.' };
    S.jobs.push(Object.assign({ created: Date.now(), applic: QI.defaultApplic(), counter: 0 }, d));
    QI.save(); return { ok: true };
  };
  QI.addCastings = (jobNo, n, extra) => {
    const j = QI.job(jobNo); if (!j || !QI.can('create', 'casting')) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      do { j.counter = (j.counter || 0) + 1; } while (QI.casting(`${j.no}-${String(j.counter).padStart(3, '0')}`));
      const c = Object.assign({ id: `${j.no}-${String(j.counter).padStart(3, '0')}`, jobNo: j.no, heatNo: null, logId: null, status: 'active', created: Date.now() }, extra || {});
      S.castings.push(c); out.push(c);
    }
    QI.save(); return out;
  };
  QI.addHeat = (d) => {
    if (!QI.can('create', 'heat')) return { error: 'Your department cannot create heats.' };
    if (!d.no) return { error: 'Heat number is required.' };
    if (QI.heat(d.no)) return { error: 'A heat with this number already exists.' };
    S.heats.push(Object.assign({ created: Date.now(), chemSpec: [], mechSpec: defaultMech() }, d));
    QI.save(); return { ok: true };
  };
  const defaultMech = () => [
    { name: 'UTS (MPa)', min: '', max: '' }, { name: 'YS (MPa)', min: '', max: '' },
    { name: 'Elongation (%)', min: '', max: '' }, { name: 'RA (%)', min: '', max: '' }, { name: 'Impact (J)', min: '', max: '' }];
  QI.addLog = (date, shift) => {
    if (!QI.can('create', 'log')) return { error: 'Your department cannot create sand logs.' };
    const id = `SL-${date.replace(/-/g, '')}-${shift}`;
    if (QI.log(id)) return { error: 'A log for this date and shift already exists.', id };
    S.logs.push({ id, date, shift, created: Date.now(), by: S.settings.inspector });
    QI.save(); return { ok: true, id };
  };

  /* ---------- recording an inspection ---------- */
  const ctxFor = (scope, owner) => ({ heat: scope === 'heat' ? QI.heat(owner) : null });
  QI.affected = (scope, owner) => scope === 'casting' ? [owner] : scope === 'heat' ? QI.heatCastings(owner).map((c) => c.id)
    : scope === 'log' ? QI.logCastings(owner).map((c) => c.id) : QI.jobCastings(owner).map((c) => c.id);
  /* castings that would be scrapped by this outcome (shown to the inspector before they confirm) */
  QI.rejectTargets = (scope, owner, checkId, action) => {
    if (QI.classify(action) !== 'reject') return [];
    if (scope === 'casting') return [owner];
    if (scope === 'heat' && checkId === '4.2.1') return QI.heatCastings(owner).filter((c) => c.status === 'active').map((c) => c.id);
    return [];
  };
  QI.record = (scope, owner, checkId, input) => {
    if (!S.settings.inspector) return { error: 'Set the inspector name first (Settings).' };
    const check = QI.eff(checkId);
    if (!QI.can('record', check.stageNo)) return { error: `Stage ${check.stageNo} is recorded by ${(QI.DEPTS.filter((d) => d.stages.includes(check.stageNo) && !d.all)[0] || { name: 'another department' }).name}.` };
    if (QI.signed(scope, owner, check.stageNo)) return { error: 'This stage is signed off. Ask the QC Manager or Factory Head to return it for rework first.' };
    const ev = QI.evaluate(check, input, ctxFor(scope, owner));
    if (ev.error) return { error: ev.error };
    const key = rkey(scope, owner, checkId);
    const rec = S.results[key] || (S.results[key] = { attempts: [] });
    const action = ev.result === 'nok' ? (input.action || (check.actions || [])[0] || 'Other') : null;
    const att = { n: rec.attempts.length + 1, ts: Date.now(), by: S.settings.inspector, result: ev.result,
      input: JSON.parse(JSON.stringify(input)), summary: ev.summary, detail: ev.detail || '', ref: input.ref || '', remarks: input.remarks || '', action };
    rec.attempts.push(att);
    const res = { attempt: att, rejected: [] };
    if (ev.result === 'ok') {
      S.ncrs.forEach((n) => { if (n.key === key && n.status === 'open') { n.status = 'closed'; n.closedTs = att.ts; n.closeNote = `Re-inspected OK (attempt ${att.n}) by ${att.by}`; } });
    } else {
      const cls = QI.classify(action);
      const ncr = { id: QI.ncrId(), ts: att.ts, key, scope, owner, checkId, stageNo: check.stageNo,
        param: check.param, found: ev.summary, by: att.by, action, cls, castings: QI.affected(scope, owner), status: 'open', remarks: att.remarks };
      const tg = QI.rejectTargets(scope, owner, checkId, action);
      if (tg.length) {
        tg.forEach((id) => { const c = QI.casting(id); if (c && c.status === 'active') { c.status = 'rejected'; c.reject = { checkId, stageNo: check.stageNo, reason: `${check.param}: ${ev.summary}`, action, by: att.by, ts: att.ts }; res.rejected.push(id); } });
        ncr.status = 'closed'; ncr.closedTs = att.ts; ncr.closeNote = `Rejected – ${action}`;
      }
      S.ncrs.push(ncr); res.ncr = ncr;
    }
    QI.save();
    return res;
  };
  QI.closeNcr = (id, note) => { const n = S.ncrs.find((x) => x.id === id); if (n) { n.status = 'closed'; n.closedTs = Date.now(); n.closeNote = note || 'Closed manually'; QI.save(); } };

  /* ---------- casting traveller ---------- */
  const ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ROLE_LABEL = { review: 'inspector sign-off', qc: 'QC Manager approval', head: 'Factory Head approval' };
  QI.ROLE_LABEL = ROLE_LABEL;

  /* ---- three-step approval per stage: Inspector -> QC Manager -> Factory Head ---- */
  const akey = (scope, owner, no) => `${scope}|${owner}|${no}`;
  QI.approval = (scope, owner, no) => (owner && S.approvals[akey(scope, owner, no)]) || null;
  QI.signed = (scope, owner, no) => { const a = QI.approval(scope, owner, no); return !!(a && a.steps && a.steps.inspector); };
  const apprStatus = (a) => !a || !a.steps || !a.steps.inspector ? 'review' : !a.steps.qc ? 'qc' : !a.steps.head ? 'head' : 'done';
  QI.apprStatus = apprStatus;

  /* checks of one stage for one owner, across the work orders it serves */
  const buildItems = (no, scope, owner, jobs) => {
    const st = QI.stageOf[no], items = [];
    st.groups.forEach((g) => g.steps.forEach((sp) => sp.checks.forEach((ch) => {
      const app = jobs.length ? jobs.some((j) => QI.applicable(j, ch)) : !QI.steps[ch.step].optional;
      if (!app) return;
      const req = jobs.length ? jobs.some((j) => QI.required(j, ch)) : QI.required(null, ch);
      items.push({ check: ch, scope, owner, required: req, status: owner ? QI.status(scope, owner, ch.id) : 'none' });
    })));
    return items;
  };
  const checkStatus = (no, items, owner) => {
    if (no === 2) {
      if (!owner) return 'open';
      if (items.some((i) => i.status === 'nok')) return 'fail';
      return items.some((i) => i.status === 'ok') ? 'done' : 'open';
    }
    if (!items.length) return 'na';
    const req = items.filter((i) => i.required);
    if (req.some((i) => i.status === 'nok')) return 'fail';
    if (!req.length || req.every((i) => i.status === 'ok')) return req.length ? 'done' : 'na';
    return req.some((i) => i.status === 'ok') ? 'progress' : 'open';
  };
  /* status of a stage for one owner, including approvals: open | progress | fail | review | qc | head | done | na */
  QI.ownerStage = (no, scope, owner, jobs) => {
    const items = buildItems(no, scope, owner, jobs);
    const cs = checkStatus(no, items, owner);
    const a = QI.approval(scope, owner, no);
    return { items, checks: cs, approval: a, status: cs === 'done' ? apprStatus(a) : cs };
  };
  QI.jobsOf = (scope, owner) => {
    if (scope === 'job') return QI.job(owner) ? [QI.job(owner)] : [];
    const cs = scope === 'heat' ? QI.heatCastings(owner) : scope === 'log' ? QI.logCastings(owner) : [];
    return [...new Set(cs.map((c) => c.jobNo))].map((n) => QI.job(n)).filter(Boolean);
  };
  const who = () => ({ by: S.settings.inspector || QI.me.name || 'Unknown', uid: QI.me.uid || null, ts: Date.now() });
  QI.signoff = (scope, owner, no, role, by, note, jobNo) => {
    const step = role === 'review' ? 'inspector' : role;
    const os = QI.ownerStage(no, scope, owner, jobNo ? [QI.job(jobNo)] : QI.jobsOf(scope, owner));
    if (os.status !== role) return { error: `This stage is awaiting ${ROLE_LABEL[os.status] || 'its checks'}.` };
    if (role === 'review' ? !QI.can('record', no) : !QI.can('approve', role)) return { error: role === 'review' ? 'Only the department that records this stage can sign it off.' : `Only the ${role === 'qc' ? 'QC Manager' : 'Factory Head'} can give this approval.` };
    const key = akey(scope, owner, no);
    const a = S.approvals[key] || (S.approvals[key] = { steps: {}, log: [] });
    const w = who(); if (by) w.by = by;
    if (w.uid && Object.values(a.steps).some((x) => x && x.uid === w.uid)) return { error: 'Each approval step must be signed by a different person.' };
    a.steps[step] = { by: w.by, uid: w.uid, ts: w.ts, note: note || '' };
    a.log.push({ ts: w.ts, by: w.by, action: step === 'inspector' ? 'Inspector sign-off' : step === 'qc' ? 'QC Manager approved' : 'Factory Head approved', note: note || '' });
    QI.save(); return { ok: true, done: step === 'head' };
  };
  QI.returnStage = (scope, owner, no, reason, jobNo) => {
    const os = QI.ownerStage(no, scope, owner, jobNo ? [QI.job(jobNo)] : QI.jobsOf(scope, owner));
    if (os.status !== 'qc' && os.status !== 'head') return { error: 'Nothing to return at this step.' };
    if (!QI.can('approve', os.status)) return { error: 'Only the approver for this step can return a stage.' };
    const a = S.approvals[akey(scope, owner, no)]; a.steps = {};
    a.log.push({ ts: Date.now(), by: who().by, action: `Returned for rework by ${os.status === 'qc' ? 'QC Manager' : 'Factory Head'}`, note: reason || '' });
    QI.save(); return { ok: true };
  };
  QI.reopenStage = (scope, owner, no, reason) => {
    const a = QI.approval(scope, owner, no);
    if (!a || !QI.can('reopen')) return { error: 'Only the QC Manager or Factory Head can reopen a stage.' };
    a.steps = {}; a.log.push({ ts: Date.now(), by: who().by, action: 'Stage reopened', note: reason || '' });
    QI.save(); return { ok: true };
  };

  QI.castingStages = (c) => {
    const job = QI.job(c.jobNo);
    let prevOk = true, current = null;
    const out = ORDER.map((no) => {
      const st = QI.stageOf[no];
      const owner = QI.ownerOf(c, st.scope);
      const items = buildItems(no, st.scope, owner, job ? [job] : []);
      const cs = checkStatus(no, items, owner);
      const a = QI.approval(st.scope, owner, no);
      const status = cs === 'done' ? apprStatus(a) : cs;
      const locked = !prevOk || c.status === 'rejected';
      if (!locked && !current && status !== 'done' && status !== 'na') current = no;
      if (status !== 'done' && status !== 'na') prevOk = false;
      return { stage: st, status, checks: cs, approval: a, owner, locked, items };
    });
    return { stages: out, current, allDone: out.every((s) => s.status === 'done' || s.status === 'na') };
  };
  /* stages waiting on someone, de-duplicated across the castings that share them */
  QI.pending = () => {
    const m = {};
    S.castings.filter((c) => c.status === 'active').forEach((c) => {
      QI.castingStages(c).stages.forEach((x) => {
        if (x.locked || !x.owner || !['review', 'qc', 'head'].includes(x.status)) return;
        const k = akey(x.stage.scope, x.owner, x.stage.no);
        (m[k] || (m[k] = { scope: x.stage.scope, owner: x.owner, stageNo: x.stage.no, status: x.status, castings: [] })).castings.push(c.id);
      });
    });
    return Object.values(m);
  };
  QI.castingState = (c) => {
    if (c.status === 'rejected') return { label: 'Rejected', cls: 'bad', stageNo: c.reject ? c.reject.stageNo : null };
    if (c.status === 'released') return { label: 'Released', cls: 'ok', stageNo: 10 };
    const t = QI.castingStages(c);
    if (t.allDone) return { label: 'Ready for release', cls: 'ok', stageNo: 10 };
    const st = t.stages.find((s) => s.stage.no === t.current);
    const failing = t.stages.some((s) => s.status === 'fail');
    const cur = t.stages.find((x) => x.stage.no === t.current);
    const wait = cur && ROLE_LABEL[cur.status];
    return { label: wait ? `Stage ${t.current}: awaiting ${wait}` : `Stage ${t.current}: ${QI.stageOf[t.current].name}`, waiting: cur && cur.status, cls: failing ? 'warn' : 'info', stageNo: t.current, failing };
  };
  QI.release = (c, by, remarks) => {
    if (!QI.can('release')) return { error: 'Only Quality can release castings.' };
    const t = QI.castingStages(c);
    if (c.status !== 'active') return { error: 'Casting is not active.' };
    if (!t.allDone) return { error: 'All applicable stages must be completed before release.' };
    if (S.ncrs.some((n) => n.status === 'open' && n.castings.includes(c.id))) return { error: 'Close all open NCRs for this casting first.' };
    c.status = 'released'; c.release = { by, remarks: remarks || '', ts: Date.now() };
    QI.save(); return { ok: true };
  };
  QI.manualReject = (c, reason) => {
    c.status = 'rejected';
    c.reject = { checkId: null, stageNo: (QI.castingState(Object.assign({}, c, { status: 'active' })).stageNo) || null, reason, action: 'Rejected by inspector', by: S.settings.inspector, ts: Date.now() };
    const ncr = { id: QI.ncrId(), ts: Date.now(), key: `casting|${c.id}|manual`, scope: 'casting', owner: c.id, checkId: null, stageNo: c.reject.stageNo,
      param: 'Manual rejection', found: reason, by: S.settings.inspector, action: 'Rejected by inspector', cls: 'reject', castings: [c.id], status: 'closed', closedTs: Date.now(), closeNote: 'Rejected', remarks: '' };
    S.ncrs.push(ncr); QI.save();
  };

  /* ---------- calibration / sand-test schedule ---------- */
  const PERIOD = { shift: 0.4, daily: 1, weekly: 7, quarterly: 90 };
  QI.PERIOD_LABEL = { shift: 'every shift', daily: 'daily', weekly: 'weekly', quarterly: 'every 3 months' };
  QI.lastDone = (checkId) => {
    let best = null;
    S.logs.forEach((l) => { const a = QI.last('log', l.id, checkId); if (a && (!best || a.ts > best)) best = a.ts; });
    return best;
  };
  QI.due = () => {
    const out = [];
    QI.allChecks().filter((c) => c.scope === 'log' && c.freq && c.freq !== 'shift').forEach((c) => {
      const last = QI.lastDone(c.id);
      const age = last ? (Date.now() - last) / 864e5 : Infinity;
      const p = PERIOD[c.freq];
      if (age > p) out.push({ check: c, last, overdue: last ? Math.floor(age - p) : null });
    });
    return out;
  };

  /* ---------- statistics ---------- */
  QI.stats = () => {
    const cs = S.castings;
    const active = cs.filter((c) => c.status === 'active');
    const wip = {};
    QI.stages.forEach((s) => (wip[s.no] = 0));
    active.forEach((c) => { const st = QI.castingState(c); if (st.stageNo && st.label !== 'Ready for release') wip[st.stageNo]++; else wip[10]++; });
    const ncrByStage = {}; QI.stages.forEach((s) => (ncrByStage[s.no] = 0));
    S.ncrs.forEach((n) => { if (n.stageNo) ncrByStage[n.stageNo]++; });
    let first = 0, total = 0;
    Object.values(S.results).forEach((r) => { total++; if (r.attempts[0].result === 'ok') first++; });
    const released = cs.filter((c) => c.status === 'released').length, rejected = cs.filter((c) => c.status === 'rejected').length;
    const awaiting = QI.pending().filter((p) => p.status !== 'review').length;
    return { awaiting, total: cs.length, active: active.length, released, rejected, openNcr: S.ncrs.filter((n) => n.status === 'open').length,
      wip, ncrByStage, fpy: total ? first / total : null, yield: released + rejected ? released / (released + rejected) : null, checksDone: total };
  };

  /* ---------- export ---------- */
  QI.csv = () => {
    const rows = [['Scope', 'Owner', 'Check', 'Stage', 'Parameter', 'Attempt', 'Date/time', 'Inspector', 'Result', 'Reading / summary', 'Detail', 'Ref no.', 'Action if Not OK', 'Remarks']];
    Object.keys(S.results).forEach((k) => {
      const [scope, owner, id] = k.split('|'); const ch = QI.checks[id];
      S.results[k].attempts.forEach((a) => rows.push([scope, owner, id, ch ? ch.stageNo : '', ch ? ch.param : '', a.n, new Date(a.ts).toISOString(), a.by, a.result === 'ok' ? 'OK' : 'NOT OK', a.summary, a.detail, a.ref, a.action || '', a.remarks]));
    });
    Object.keys(S.approvals).forEach((k) => { const [scope, owner, no] = k.split('|'); (S.approvals[k].log || []).forEach((l, i) => rows.push(['approval-' + scope, owner, 'Stage ' + no, no, l.action, i + 1, new Date(l.ts).toISOString(), l.by, '', '', '', '', '', l.note])); });
    return rows.map((r) => r.map((v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')).join('\n');
  };
})();
