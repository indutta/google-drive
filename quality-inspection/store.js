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
    jobs: [], castings: [], heats: [], logs: [], results: {}, ncrs: [] });
  let S = blank();
  QI.persistent = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) S = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { QI.persistent = false; }
  QI.S = () => S;
  QI.save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); QI.persistent = true; } catch (e) { QI.persistent = false; } };
  QI.replace = (obj) => { S = Object.assign(blank(), obj); QI.save(); };
  QI.reset = () => { S = blank(); QI.save(); };

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
  QI.classify = (action) => {
    const a = action || '';
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
    if (!d.no) return { error: 'Work order number is required.' };
    if (QI.job(d.no)) return { error: 'A work order with this number already exists.' };
    S.jobs.push(Object.assign({ created: Date.now(), applic: QI.defaultApplic(), counter: 0 }, d));
    QI.save(); return { ok: true };
  };
  QI.addCastings = (jobNo, n, extra) => {
    const j = QI.job(jobNo); if (!j) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      j.counter = (j.counter || 0) + 1;
      const c = Object.assign({ id: `${j.no}-${String(j.counter).padStart(3, '0')}`, jobNo: j.no, heatNo: null, logId: null, status: 'active', created: Date.now() }, extra || {});
      S.castings.push(c); out.push(c);
    }
    QI.save(); return out;
  };
  QI.addHeat = (d) => {
    if (!d.no) return { error: 'Heat number is required.' };
    if (QI.heat(d.no)) return { error: 'A heat with this number already exists.' };
    S.heats.push(Object.assign({ created: Date.now(), chemSpec: [], mechSpec: defaultMech() }, d));
    QI.save(); return { ok: true };
  };
  const defaultMech = () => [
    { name: 'UTS (MPa)', min: '', max: '' }, { name: 'YS (MPa)', min: '', max: '' },
    { name: 'Elongation (%)', min: '', max: '' }, { name: 'RA (%)', min: '', max: '' }, { name: 'Impact (J)', min: '', max: '' }];
  QI.addLog = (date, shift) => {
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
      const ncr = { id: `NCR-${String(++S.seq.ncr).padStart(4, '0')}`, ts: att.ts, key, scope, owner, checkId, stageNo: check.stageNo,
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
  QI.castingStages = (c) => {
    const job = QI.job(c.jobNo);
    let prevOk = true, current = null;
    const out = ORDER.map((no) => {
      const st = QI.stageOf[no];
      const items = [];
      st.groups.forEach((g) => g.steps.forEach((sp) => sp.checks.forEach((ch) => {
        if (!QI.applicable(job, ch)) return;
        const owner = QI.ownerOf(c, st.scope);
        items.push({ check: ch, scope: st.scope, owner, required: QI.required(job, ch), status: owner ? QI.status(st.scope, owner, ch.id) : 'none' });
      })));
      const req = items.filter((i) => i.required);
      let status;
      if (no === 2) {
        const l = c.logId;
        const bad = l ? items.some((i) => i.status === 'nok') : false;
        status = !l ? 'open' : bad ? 'fail' : 'done';
      } else if (!items.length) status = 'na';
      else if (req.some((i) => i.status === 'nok')) status = 'fail';
      else if (req.every((i) => i.status === 'ok')) status = 'done';
      else if (req.some((i) => i.status === 'ok')) status = 'progress';
      else status = 'open';
      const locked = !prevOk || c.status === 'rejected';
      if (!locked && !current && status !== 'done' && status !== 'na') current = no;
      if (status !== 'done' && status !== 'na') prevOk = false;
      return { stage: st, status, locked, items };
    });
    return { stages: out, current, allDone: out.every((s) => s.status === 'done' || s.status === 'na') };
  };
  QI.castingState = (c) => {
    if (c.status === 'rejected') return { label: 'Rejected', cls: 'bad', stageNo: c.reject ? c.reject.stageNo : null };
    if (c.status === 'released') return { label: 'Released', cls: 'ok', stageNo: 10 };
    const t = QI.castingStages(c);
    if (t.allDone) return { label: 'Ready for release', cls: 'ok', stageNo: 10 };
    const st = t.stages.find((s) => s.stage.no === t.current);
    const failing = t.stages.some((s) => s.status === 'fail');
    return { label: `Stage ${t.current}: ${QI.stageOf[t.current].name}`, cls: failing ? 'warn' : 'info', stageNo: t.current, failing };
  };
  QI.release = (c, by, remarks) => {
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
    const ncr = { id: `NCR-${String(++S.seq.ncr).padStart(4, '0')}`, ts: Date.now(), key: `casting|${c.id}|manual`, scope: 'casting', owner: c.id, checkId: null, stageNo: c.reject.stageNo,
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
    return { total: cs.length, active: active.length, released, rejected, openNcr: S.ncrs.filter((n) => n.status === 'open').length,
      wip, ncrByStage, fpy: total ? first / total : null, yield: released + rejected ? released / (released + rejected) : null, checksDone: total };
  };

  /* ---------- export ---------- */
  QI.csv = () => {
    const rows = [['Scope', 'Owner', 'Check', 'Stage', 'Parameter', 'Attempt', 'Date/time', 'Inspector', 'Result', 'Reading / summary', 'Detail', 'Ref no.', 'Action if Not OK', 'Remarks']];
    Object.keys(S.results).forEach((k) => {
      const [scope, owner, id] = k.split('|'); const ch = QI.checks[id];
      S.results[k].attempts.forEach((a) => rows.push([scope, owner, id, ch ? ch.stageNo : '', ch ? ch.param : '', a.n, new Date(a.ts).toISOString(), a.by, a.result === 'ok' ? 'OK' : 'NOT OK', a.summary, a.detail, a.ref, a.action || '', a.remarks]));
    });
    return rows.map((r) => r.map((v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')).join('\n');
  };
})();
