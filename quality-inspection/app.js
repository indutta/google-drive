/* DCL Quality Inspection – UI. Hash-routed single page app, no build step. */
(function () {
  'use strict';
  const { S, num } = { S: () => QI.S(), num: QI.num };
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fdt = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const fd = (ts) => ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  let route = 'dashboard', booting = !!(window.claude && window.claude.use), DL = null;
  const hist = [];
  const HOSTED = !!window.claude;
  const go = (p) => { p = String(p).replace(/^#?\/?/, '') || 'dashboard'; if (p !== route) { hist.push(route); route = p; } window.scrollTo(0, 0); render(); };
  const ui = { mp: null, ml: null, cm: null, open: {}, stale: false, filter: { castings: '', ncr: 'open', plan: '' }, stageOpen: {} };
  const SCOPE_LABEL = { job: 'Work order', log: 'Sand & calibration log', heat: 'Heat', casting: 'Casting' };

  /* ================= small components ================= */
  const badge = (t, cls) => `<span class="badge ${cls || ''}">${esc(t)}</span>`;
  const stBadge = (s) => ({ ok: badge('OK', 'ok'), nok: badge('Not OK', 'bad'), none: badge('Pending', 'mute'), done: badge('Complete', 'ok'), fail: badge('Failed – action needed', 'bad'),
    progress: badge('In progress', 'info'), review: badge('Awaiting inspector sign-off', 'info'), qc: badge('Awaiting QC Manager', 'warn'), head: badge('Awaiting Factory Head', 'warn'), open: badge('Not started', 'mute'), na: badge('Not applicable', 'mute') }[s] || '');
  const dot = (s) => `<span class="dot ${s === 'ok' || s === 'done' ? 'ok' : s === 'nok' || s === 'fail' ? 'bad' : ['progress', 'review', 'qc', 'head'].includes(s) ? 'info' : ''}"></span>`;
  const link = (href, t) => `<a href="#${href}">${esc(t)}</a>`;
  const empty = (msg, extra) => `<div class="empty">${msg}${extra || ''}</div>`;
  const table = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const progressBar = (c) => {
    const t = QI.castingStages(c);
    return `<span class="pbar" title="Stage progress">${t.stages.map((s) => `<i class="${s.status === 'done' ? 'ok' : s.status === 'fail' ? 'bad' : ['progress', 'review', 'qc', 'head'].includes(s.status) ? 'info' : s.status === 'na' ? 'na' : ''}" title="${s.stage.no}. ${esc(s.stage.name)}"></i>`).join('')}</span>`;
  };
  const deptName = (no) => ((QI.DEPTS.find((d) => d.stages.includes(no) && !d.all) || { name: 'Quality' }).name);
  const stateBadge = (c) => { const s = QI.castingState(c); return badge(s.label, s.cls); };

  /* ================= modal ================= */
  function modal(title, body, onOk, okLabel) {
    const dlg = $('#dlg'); if (dlg.open) dlg.close();
    dlg.innerHTML = `<form method="dialog" class="mform"><h3>${esc(title)}</h3><div class="mbody">${body}</div><div class="merr" id="merr"></div>
      <div class="mact"><button type="button" class="btn ghost" data-act="modal-cancel">Cancel</button>${onOk ? `<button type="submit" class="btn primary">${esc(okLabel || 'Save')}</button>` : ''}</div></form>`;
    const form = $('form', dlg);
    form.onsubmit = (e) => {
      e.preventDefault();
      if (!onOk) return dlg.close();
      const err = onOk(form);
      if (err) { $('#merr').textContent = err; } else { dlg.close(); render(); }
    };
    dlg.showModal();
    const f = $('input,select,textarea', form); if (f) f.focus();
  }
  const ask = (msg, yes, label) => modal('Please confirm', `<p class="pre">${esc(msg)}</p>`, () => { yes(); }, label || 'Continue');
  const fld = (label, name, val, attrs) => `<label class="f"><span>${label}</span><input name="${name}" value="${esc(val == null ? '' : val)}" ${attrs || ''}></label>`;
  const sel = (label, name, opts, val) => `<label class="f"><span>${label}</span><select name="${name}">${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  const ta = (label, name, val, hint, rows) => `<label class="f"><span>${label}</span><textarea name="${name}" rows="${rows || 4}">${esc(val || '')}</textarea>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const val = (form, n) => (form.elements[n] ? form.elements[n].value.trim() : '');

  /* dropdown with "Other (specify)…"; whatever is typed under Other is remembered for next time */
  const combo = (label, name, listKey, cur, defs, o) => {
    o = o || {};
    const opts = QI.opts(listKey, defs);
    if (cur && !opts.includes(cur)) opts.unshift(cur);
    return `<label class="f"><span>${label}</span><select name="${name}" data-combo>${o.noBlank ? '' : `<option value="">${esc(o.blank || '– select –')}</option>`}${o.group ? `<optgroup label="${esc(o.group)}">` : ''}${opts.map((x) => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')}${o.group ? '</optgroup>' : ''}<option value="__other">＋ Other (specify)…</option></select>
      <input name="${name}__o" class="other" placeholder="Type new value – saved for next time" hidden></label>`;
  };
  const cval = (form, name, listKey) => {
    const sl = form.elements[name]; if (!sl) return '';
    if (sl.value !== '__other') return sl.value.trim();
    const v = (form.elements[name + '__o'].value || '').trim();
    if (v && listKey) QI.learn(listKey, v);
    return v;
  };

  function profileModal() {
    modal('Your name and department', `${fld('Your name (stamped on every record you sign)', 'name', QI.me.name, 'required')}
      <label class="f"><span>Department</span><select name="dept">${QI.DEPTS.map((d) => `<option value="${d.id}" ${d.id === QI.me.dept ? 'selected' : ''}>${esc(d.name)} – ${esc(d.about)}</option>`).join('')}</select></label>
      <small class="muted">Each department records its own stages; everything else is view-only. Pick the department you work in.</small>`, (f) => {
      if (!val(f, 'name')) return 'Enter your name.';
      QI.setPerson(val(f, 'name'), val(f, 'dept'));
    }, 'Save');
  }
  function needInspector(force) {
    if (QI.mode === 'shared') { if (QI.me.dept && QI.me.name && !force) return false; profileModal(); return true; }
    if (S().settings.inspector && !force) return false;
    modal('Who is inspecting?', combo('Inspector (shown on every record you sign)', 'name', 'inspector', S().settings.inspector, [], { blank: '– choose your name –' }), (f) => {
      const n = cval(f, 'name', 'inspector'); if (!n) return 'Choose or enter your name.'; S().settings.inspector = n; QI.save();
    }, 'Continue');
    return true;
  }

  /* ================= check rows & forms ================= */
  function critText(ch) {
    if (ch.min != null || ch.max != null) return QI.limText(ch.min, ch.max, ch.unit);
    return ch.criteria || '';
  }
  function lastSummary(a) {
    if (!a) return '<span class="muted">No record yet</span>';
    return `${a.result === 'ok' ? badge('OK', 'ok') : badge('Not OK', 'bad')} <span class="muted">${esc(a.summary || '')} · ${esc(a.by)} · ${fdt(a.ts)}${a.n > 1 ? ` · attempt ${a.n}` : ''}</span>`;
  }
  function checkRow(scope, owner, id, o) {
    o = o || {};
    const ch = QI.eff(id);
    const key = QI.rkey(scope, owner, id);
    const last = owner ? QI.last(scope, owner, id) : null;
    const st = last ? last.result : 'none';
    const rec = owner ? QI.rec(scope, owner, id) : null;
    const open = ui.open[key];
    const perm = QI.can('record', ch.stageNo);
    const signedOff = owner && QI.signed(scope, owner, ch.stageNo);
    const canRecord = owner && !o.locked && !o.readonly && perm && !signedOff;
    const pending = last && last.result === 'nok' && QI.classify(last.action) === 'rework';
    const tags = [ch.tbc || ch.assumed ? badge(ch.assumed && !ch.tbc ? 'criteria assumed – confirm' : 'to be confirmed', 'warn') : '',
      o.required === false ? badge('sampled / optional', 'mute') : '', owner && !o.locked && signedOff ? badge('signed off – locked', 'ok') : '', owner && !o.locked && !perm && !signedOff ? badge('view only · ' + deptName(ch.stageNo), 'mute') : '', ch.freq ? badge(QI.PERIOD_LABEL[ch.freq], 'mute') : ''].join('');
    return `<div class="chk ${st}" data-key="${esc(key)}">
      <div class="chk-h">${dot(st)}<div class="chk-t"><b>${esc(ch.id)}</b> ${esc(ch.param)} ${tags}
        <div class="muted sm">Sample: ${esc(ch.sample || '–')} · Method: ${esc(ch.method || '–')} · Accept: <b>${esc(critText(ch))}</b></div>
        <div class="sm">${lastSummary(last)}</div>
        ${pending ? `<div class="sm warnT">⚠ Rework required: ${esc(last.action)} – then re-inspect.</div>` : ''}</div>
        <div class="chk-a">${canRecord ? `<button class="btn ${st === 'ok' ? 'ghost' : 'primary'} sm" data-act="toggle" data-key="${esc(key)}">${open ? 'Close' : st === 'none' ? 'Record' : st === 'ok' ? 'Re-record' : 'Re-inspect'}</button>` : ''}</div></div>
      ${open && canRecord ? checkForm(scope, owner, ch, key) : ''}
      ${rec && rec.attempts.length ? `<details class="hist"><summary>History (${rec.attempts.length})</summary>${rec.attempts.slice().reverse().map((a) => `<div class="hrow">${a.result === 'ok' ? badge('OK', 'ok') : badge('Not OK', 'bad')} #${a.n} · ${fdt(a.ts)} · ${esc(a.by)} · ${esc(a.summary || '')}${a.detail ? ` <span class="muted">(${esc(a.detail)})</span>` : ''}${a.ref ? ` · Ref ${esc(a.ref)}` : ''}${a.action ? ` · Action: ${esc(a.action)}` : ''}${a.remarks ? ` · “${esc(a.remarks)}”` : ''}</div>`).join('')}</details>` : ''}
    </div>`;
  }

  function checkForm(scope, owner, ch, key) {
    const last = QI.last(scope, owner, ch.id);
    const li = (last && last.input) || {};
    const heat = scope === 'heat' ? QI.heat(owner) : null;
    let inner = '';
    const unit = ch.unit ? ` (${esc(ch.unit)})` : '';
    if (['max', 'min', 'range'].includes(ch.kind)) {
      inner = fld(`Measured value${unit} — limit ${esc(critText(ch))}`, 'value', '', 'type="number" step="any" inputmode="decimal" autocomplete="off"');
    } else if (ch.kind === 'yn') {
      inner = `<div class="f"><span>Result</span><div class="radios"><label><input type="radio" name="result" value="ok"> OK</label><label><input type="radio" name="result" value="nok"> Not OK</label></div></div>`;
    } else if (ch.kind === 'spec') {
      let mn = li.min || '', mx = li.max || '';
      if (heat && ch.id === '4.3.1') { mn = heat.tapMin || mn; mx = heat.tapMax || mx; }
      if (heat && ch.id === '4.4.1') { mn = heat.pourMin || mn; mx = heat.pourMax || mx; }
      inner = `<div class="grid3">${fld(`Measured value${unit}`, 'value', '', 'type="number" step="any" inputmode="decimal"')}${fld('Min limit', 'min', mn, 'type="number" step="any"')}${fld('Max limit', 'max', mx, 'type="number" step="any"')}</div>
        ${sel('Result (only needed when no limits are entered)', 'result', [['', 'Auto – from limits'], ['ok', 'OK'], ['nok', 'Not OK']], '')}`;
    } else if (ch.kind === 'dim') {
      const jobNo = scope === 'casting' ? (QI.casting(owner) || {}).jobNo : scope === 'job' ? owner : null;
      let rows = (li.rows && li.rows.length) ? li.rows : parseDims((QI.job(jobNo) || {}).dims);
      if (!rows.length) rows = [{}];
      inner = `<div class="f"><span>Dimensions (nominal ± tolerance, actual measured)</span><table class="dimt"><thead><tr><th>Feature</th><th>Nominal</th><th>− Tol</th><th>+ Tol</th><th>Actual</th><th></th></tr></thead><tbody>${rows.map(dimRow).join('')}</tbody></table>
        <button type="button" class="btn ghost sm" data-act="dim-add">+ Add dimension</button></div>`;
    } else if (ch.kind === 'chem' || ch.kind === 'mech') {
      const spec = heat ? (ch.kind === 'chem' ? heat.chemSpec : heat.mechSpec) : [];
      inner = !spec.length ? `<div class="warnBox">No specification defined. <button type="button" class="btn sm" data-act="heat-spec" data-no="${esc(owner)}">Define ${ch.kind === 'chem' ? 'chemistry' : 'mechanical'} spec</button></div>`
        : `<div class="f"><span>${ch.kind === 'chem' ? 'Spectrometer reading (%)' : 'Test results'}</span><div class="specgrid">${spec.map((r) => `<label><span>${esc(r.name)} <em>${esc(QI.limText(num(r.min), num(r.max), ''))}</em></span><input data-val="${esc(r.name)}" type="number" step="any" inputmode="decimal"></label>`).join('')}</div></div>`;
    }
    const acts = [...new Set([...(ch.actions || []).filter((x) => x !== 'Other'), ...QI.opts('action:' + ch.id)])];
    return `<form class="chkform" data-key="${esc(key)}" data-scope="${scope}" data-owner="${esc(owner)}" data-check="${ch.id}" onsubmit="return false">
      ${inner}
      <div class="grid2">${fld('Report / certificate / ref. no. (optional)', 'ref', '')}${combo('Remarks (optional)', 'remarks', 'remarks', '', QI.DEFAULTS.remarks, { blank: '– none –' })}</div>
      ${`<label class="f"><span>If Not OK – action / disposal</span><select name="action" data-combo>${acts.map((x, i) => `<option value="${esc(x)}" ${i === 0 ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__other">＋ Other (specify)…</option></select><input name="action__o" class="other" placeholder="Describe the action – saved for next time" hidden></label>
      <label class="f clsrow" hidden><span>This action means the casting is…</span><select name="actionCls"><option value="rework">Reworked / corrected (re-inspect)</option><option value="reject">Rejected / scrapped</option></select></label>`}
      <div class="preview" aria-live="polite"></div>
      <div class="row"><button type="button" class="btn primary" data-act="save-check" data-key="${esc(key)}">Save inspection result</button><button type="button" class="btn ghost" data-act="toggle" data-key="${esc(key)}">Cancel</button></div>
    </form>`;
  }
  const dimRow = (r) => `<tr class="dimrow"><td><input data-d="name" value="${esc(r.name || '')}" placeholder="e.g. Bore Ø"></td><td><input data-d="nominal" type="number" step="any" value="${esc(r.nominal == null ? '' : r.nominal)}"></td>
    <td><input data-d="tm" type="number" step="any" value="${esc(r.tm == null ? '' : r.tm)}"></td><td><input data-d="tp" type="number" step="any" value="${esc(r.tp == null ? '' : r.tp)}"></td><td><input data-d="actual" type="number" step="any"></td>
    <td><button type="button" class="x" data-act="dim-del" title="Remove">×</button></td></tr>`;
  function parseDims(txt) {
    return String(txt || '').split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ name: p[0], nominal: p[1], tm: p[2], tp: p[3] == null || p[3] === '' ? p[2] : p[3] }));
  }
  function readForm(f) {
    const ch = QI.eff(f.dataset.check);
    const g = (n) => (f.elements[n] ? f.elements[n].value : '');
    const input = { ref: g('ref').trim(), remarks: g('remarks') === '__other' ? g('remarks__o').trim() : g('remarks').trim(), action: g('action') === '__other' ? g('action__o').trim() : g('action') };
    if (g('action') === '__other') { input.newAction = true; input.actionCls = g('actionCls'); }
    if (g('remarks') === '__other') input.newRemark = true;
    if (['max', 'min', 'range'].includes(ch.kind)) input.value = g('value');
    if (ch.kind === 'yn') input.result = g('result');
    if (ch.kind === 'spec') { input.value = g('value'); input.min = g('min'); input.max = g('max'); input.result = g('result'); }
    if (ch.kind === 'dim') input.rows = [...f.querySelectorAll('tr.dimrow')].map((tr) => { const r = {}; tr.querySelectorAll('[data-d]').forEach((i) => (r[i.dataset.d] = i.value)); return r; });
    if (ch.kind === 'chem' || ch.kind === 'mech') { input.vals = {}; f.querySelectorAll('[data-val]').forEach((i) => (input.vals[i.dataset.val] = i.value)); }
    return input;
  }
  function liveEval(f) {
    const ch = QI.eff(f.dataset.check);
    const ev = QI.evaluate(ch, readForm(f), { heat: f.dataset.scope === 'heat' ? QI.heat(f.dataset.owner) : null });
    const p = $('.preview', f);
    p.className = 'preview ' + (ev.error ? '' : ev.result);
    p.textContent = ev.error ? '' : ev.result === 'ok' ? `✔ OK — ${ev.summary}` : `✖ NOT OK — ${ev.summary}. An NCR will be raised.`;
  }
  function saveCheck(key, confirmed) {
    if (needInspector()) return;
    const f = $(`form.chkform[data-key="${CSS.escape(key)}"]`);
    const { scope, owner, check } = f.dataset;
    const input = readForm(f);
    const ch = QI.eff(check);
    const ev = QI.evaluate(ch, input, { heat: scope === 'heat' ? QI.heat(owner) : null });
    if (ev.error) { const p = $('.preview', f); p.className = 'preview err'; p.textContent = ev.error; return; }
    if (ev.result === 'nok' && input.newAction) {
      if (!input.action) { const p = $('.preview', f); p.className = 'preview err'; p.textContent = 'Describe the action taken / required.'; return; }
      QI.learnAction(check, input.action, input.actionCls);
    }
    if (input.newRemark) QI.learn('remarks', input.remarks);
    if (ev.result === 'nok') {
      const tg = QI.rejectTargets(scope, owner, check, input.action);
      if (tg.length && !confirmed) { ask(`“${input.action}” will REJECT ${tg.length} casting(s): ${tg.join(', ')}.`, () => saveCheck(key, true), 'Reject & save'); return; }
    }
    const r = QI.record(scope, owner, check, input);
    if (r.error) { const p = $('.preview', f); p.className = 'preview err'; p.textContent = r.error; return; }
    delete ui.open[key];
    render();
    if (r.ncr) toast(`${r.ncr.id} raised – ${ch.param}${r.rejected.length ? ` · ${r.rejected.length} casting(s) rejected` : ''}`, 'bad'); else toast('Saved – OK', 'ok');
  }

  /* ---- Inspector -> QC Manager -> Factory Head approval strip ---- */
  const STEPS = [['inspector', 'Inspector', 'review'], ['qc', 'QC Manager', 'qc'], ['head', 'Factory Head', 'head']];
  function approvalStrip(scope, owner, no, jobs, jobNo) {
    if (!owner) return '';
    const os = QI.ownerStage(no, scope, owner, jobs);
    const a = os.approval;
    if (os.checks !== 'done' && !(a && a.log && a.log.length)) return '';
    const cur = os.status;
    const data = `data-scope="${scope}" data-owner="${esc(owner)}" data-no="${no}" data-job="${esc(jobNo || '')}"`;
    const boxes = STEPS.map(([k, label, role]) => {
      const s = a && a.steps && a.steps[k];
      const mine = cur === role && (role === 'review' ? QI.can('record', no) : QI.can('approve', role));
      return `<div class="ap ${s ? 'done' : cur === role ? 'now' : ''}"><div class="apl">${label}</div>${s ? `<div><b>${esc(s.by)}</b></div><div class="muted sm">${fdt(s.ts)}${s.note ? ' · ' + esc(s.note) : ''}</div>`
        : cur === role ? (mine ? `<button class="btn primary sm" data-act="sign" data-role="${role}" ${data}>${role === 'review' ? 'Sign off checks' : 'Approve'}</button>${role !== 'review' ? `<button class="btn sm" data-act="return-stage" ${data}>Return</button>` : ''}` : '<div class="muted sm">Waiting…</div>')
        : '<div class="muted sm">–</div>'}</div>`;
    }).join('<span class="apa">›</span>');
    const last = a && a.log && a.log[a.log.length - 1];
    return `<div class="appr"><div class="aph">Stage ${no} approval ${cur === 'done' ? badge('Fully approved', 'ok') : os.checks === 'done' ? badge('Awaiting ' + QI.ROLE_LABEL[cur], 'warn') : badge('Checks reopened', 'mute')}</div><div class="aps">${boxes}</div>
      ${cur === 'done' && QI.can('reopen') ? `<button class="btn sm ghost" data-act="reopen-stage" ${data}>Reopen stage…</button>` : ''}
      ${last && /Returned|reopened/.test(last.action) && cur !== 'done' ? `<div class="sm warnT">↩ ${esc(last.action)}${last.note ? ': ' + esc(last.note) : ''} – ${esc(last.by)}</div>` : ''}
      ${a && a.log && a.log.length ? `<details class="hist"><summary>Approval history (${a.log.length})</summary>${a.log.map((l) => `<div class="hrow">${fdt(l.ts)} · ${esc(l.by)} · ${esc(l.action)}${l.note ? ' – ' + esc(l.note) : ''}</div>`).join('')}</details>` : ''}</div>`;
  }

  /* stage block */
  function stageBlock(st, scope, owner, o) {
    o = o || {};
    const items = [];
    st.groups.forEach((g) => {
      if (g.name) items.push(`<div class="grp">${esc(g.name)}</div>`);
      g.steps.forEach((sp) => {
        if (o.job && !QI.applicable(o.job, sp.checks[0])) { items.push(`<div class="step na"><h5>${esc(sp.id)} ${esc(sp.name)} ${badge('not required for this work order', 'mute')}</h5></div>`); return; }
        items.push(`<div class="step"><h5>${esc(sp.id)} ${esc(sp.name)}</h5>${sp.checks.map((c) => checkRow(scope, owner, c.id, { locked: o.locked, required: o.job ? QI.required(o.job, c) : !sp.sampled })).join('')}</div>`);
      });
    });
    return items.join('');
  }

  /* ================= views ================= */
  const V = {};

  V.dashboard = () => {
    const s = QI.stats(); const st = S();
    const intro = st.jobs.length ? '' : `<div class="empty intro"><b>Welcome to the DCL Quality Inspection app.</b><br>No work orders yet. Create a work order, add castings, and follow each one through the 10 inspection stages.${QI.can('create', 'job') ? `<div class="row c"><a class="btn primary" href="#/jobs">Create first work order</a><button class="btn" data-act="demo">Load sample data</button></div>` : '<div class="muted pad">Planning or Quality will create the first work order.</div>'}</div>`;
    const dp = QI.dept();
    const role = QI.mode === 'shared' && dp && dp.approver;
    const toApprove = role ? QI.pending().filter((p) => p.status === role) : null;
    const mine = QI.mode === 'shared' && dp && dp.stages.length && !dp.all ? st.castings.filter((c) => { if (c.status !== 'active') return false; const x = QI.castingState(c); return x.stageNo && dp.stages.includes(x.stageNo) && x.label.startsWith('Stage'); }) : null;
    const max = Math.max(1, ...Object.values(s.wip));
    const nmax = Math.max(1, ...Object.values(s.ncrByStage));
    const due = QI.due();
    const attention = st.castings.filter((c) => c.status === 'active' && QI.castingState(c).failing);
    const pct = (v) => v == null ? '–' : Math.round(v * 100) + '%';
    return `<h2>Dashboard</h2>${intro}
    ${toApprove ? `<section class="card"><h3>Waiting for your approval <span class="badge warn">${toApprove.length}</span></h3>${toApprove.length ? toApprove.slice(0, 12).map((p) => `<div class="li">${link('/casting/' + p.castings[0], 'Stage ' + p.stageNo + ' · ' + QI.stageOf[p.stageNo].name)} <span class="muted sm">${esc(SCOPE_LABEL[p.scope])} ${esc(p.owner)} · ${p.castings.length} casting(s)</span></div>`).join('') : '<div class="muted">Nothing waiting for you ✔</div>'}</section>` : ''}
    ${mine ? `<section class="card"><h3>Waiting for ${esc(dp.name)} <span class="badge info">${mine.length}</span></h3>${mine.length ? mine.slice(0, 12).map((c) => `<div class="li">${link('/casting/' + c.id, c.id)} <span class="muted sm">${esc(QI.castingState(c).label)}</span></div>`).join('') : '<div class="muted">Nothing waiting for your department ✔</div>'}</section>` : ''}
    <div class="kpis">
      <div class="kpi"><b>${s.active}</b><span>Castings in process</span></div>
      <div class="kpi"><b>${s.released}</b><span>Released</span></div>
      <div class="kpi"><b class="${s.rejected ? 'badT' : ''}">${s.rejected}</b><span>Rejected</span></div>
      <div class="kpi"><b class="${s.awaiting ? 'warnT' : ''}">${s.awaiting}</b><span>Awaiting QC / Factory Head</span></div>
      <div class="kpi"><b class="${s.openNcr ? 'warnT' : ''}">${s.openNcr}</b><span>Open NCRs</span></div>
      <div class="kpi"><b>${pct(s.fpy)}</b><span>First-time-OK rate (checks)</span></div>
      <div class="kpi"><b>${pct(s.yield)}</b><span>Casting yield (released ÷ finished)</span></div>
    </div>
    <div class="cols">
      <section class="card"><h3>Castings by current stage</h3>${QI.stages.map((x) => `<div class="bar"><span class="bl">${x.no}. ${esc(x.name)}</span><span class="bt"><i style="width:${s.wip[x.no] / max * 100}%"></i></span><b>${s.wip[x.no]}</b></div>`).join('')}</section>
      <section class="card"><h3>Non-conformances by stage</h3>${QI.stages.map((x) => `<div class="bar"><span class="bl">${x.no}. ${esc(x.name)}</span><span class="bt bad"><i style="width:${s.ncrByStage[x.no] / nmax * 100}%"></i></span><b>${s.ncrByStage[x.no]}</b></div>`).join('')}</section>
    </div>
    <div class="cols">
      <section class="card"><h3>Calibration & testing due</h3>${due.length ? due.map((d) => `<div class="li"><span>${dot('nok')} ${esc(d.check.id)} ${esc(QI.steps[d.check.step].name)}<div class="muted sm">${esc(QI.PERIOD_LABEL[d.check.freq])} · last ${d.last ? fd(d.last) : 'never'}</div></span></div>`).join('') : '<div class="muted">All up to date ✔</div>'}
        <a class="btn sm" href="#/logs">Open sand & calibration logs</a></section>
      <section class="card"><h3>Needs attention</h3>${attention.length ? attention.map((c) => `<div class="li">${link('/casting/' + c.id, c.id)} ${stateBadge(c)}</div>`).join('') : '<div class="muted">No failed checks waiting ✔</div>'}
        ${st.ncrs.filter((n) => n.status === 'open').slice(-5).reverse().map((n) => `<div class="li sm"><b>${n.id}</b> ${esc(n.param)} – ${esc(n.found)}<div class="muted">${esc(n.action)}</div></div>`).join('')}
        <a class="btn sm" href="#/ncr">NCR register</a></section>
    </div>`;
  };

  /* ---- jobs ---- */
  V.jobs = () => `<div class="hd"><h2>Work orders</h2><button class="btn primary" data-act="new-job">+ New work order</button></div>
    ${S().jobs.length ? table(['Work order', 'Customer / PO', 'Part', 'Grade', 'Castings', 'Released', ''], S().jobs.slice().reverse().map((j) => {
      const cs = QI.jobCastings(j.no);
      return `<tr><td>${link('/job/' + j.no, j.no)}</td><td>${esc(j.customer)}<div class="muted sm">${esc(j.po)}</div></td><td>${esc(j.part)}<div class="muted sm">Dwg ${esc(j.drawing)} · Pattern ${esc(j.pattern)}</div></td><td>${esc(j.grade)}</td><td>${cs.length}${j.qty ? ' / ' + esc(j.qty) : ''}</td><td>${cs.filter((c) => c.status === 'released').length}</td><td>${link('/job/' + j.no, 'Open →')}</td></tr>`;
    })) : empty('No work orders yet.')}`;

  V.job = (no) => {
    const j = QI.job(no); if (!j) return empty('Work order not found.');
    const cs = QI.jobCastings(no);
    const st1 = QI.stageOf[1];
    const s1 = QI.stageOf[1].groups[0].steps.flatMap((s) => s.checks).map((c) => QI.status('job', no, c.id));
    return `<div class="hd"><div><h2>${esc(j.no)} <small>${esc(j.part)}</small></h2><div class="muted">${esc(j.customer)} · PO ${esc(j.po)} · Drawing ${esc(j.drawing)} · Pattern ${esc(j.pattern)} · Grade ${esc(j.grade)}${j.qty ? ' · Order qty ' + esc(j.qty) : ''}</div></div>
      <div class="row"><button class="btn" data-act="edit-job" data-no="${esc(no)}">Edit</button><button class="btn primary" data-act="add-castings" data-no="${esc(no)}">+ Add castings</button></div></div>
    <section class="card"><h3>Inspection requirements for this order <small class="muted">(per PO / customer QAP)</small></h3>
      <div class="chips">${Object.keys(j.applic).map((id) => `<label class="chip"><input type="checkbox" data-act="applic" data-no="${esc(no)}" data-step="${id}" ${j.applic[id] ? 'checked' : ''}> ${id} ${esc(QI.steps[id].name)}</label>`).join('')}</div>
      <div class="muted sm">Unticked steps are skipped for every casting of this order. 3.2 and 8.3 are sampled (10 %) and never block a casting.</div></section>
    <section class="card"><h3>Castings (${cs.length})</h3>${cs.length ? castingTable(cs) : empty('No castings yet – add the first one.')}</section>
    <section class="card"><h3>Stage ${st1.no} · ${esc(st1.name)} ${stBadge(s1.every((x) => x === 'ok') ? 'done' : s1.some((x) => x === 'ok') ? 'progress' : 'open')}</h3>${stageBlock(st1, 'job', no)}${approvalStrip('job', no, 1, [j])}</section>`;
  };
  function castingTable(cs) {
    return table(['Serial no.', 'Heat', 'Progress', 'Status', ''], cs.map((c) => `<tr><td>${link('/casting/' + c.id, c.id)}</td><td>${c.heatNo ? link('/heat/' + c.heatNo, c.heatNo) : '<span class="muted">–</span>'}</td><td>${progressBar(c)}</td><td>${stateBadge(c)}</td><td>${link('/casting/' + c.id, 'Open →')}</td></tr>`));
  }

  /* ---- castings ---- */
  V.castings = () => {
    const q = ui.filter.castings.toLowerCase();
    const cs = S().castings.filter((c) => !q || (c.id + ' ' + (c.heatNo || '') + ' ' + QI.castingState(c).label).toLowerCase().includes(q));
    return `<div class="hd"><h2>Castings</h2><input class="search" placeholder="Search serial, heat, status…" value="${esc(ui.filter.castings)}" data-act="filter-castings"></div>
    ${cs.length ? table(['Serial no.', 'Work order', 'Heat', 'Progress (stages 1–10)', 'Status', ''], cs.slice().reverse().map((c) => `<tr><td>${link('/casting/' + c.id, c.id)}</td><td>${link('/job/' + c.jobNo, c.jobNo)}</td><td>${c.heatNo ? link('/heat/' + c.heatNo, c.heatNo) : '<span class="muted">–</span>'}</td><td>${progressBar(c)}</td><td>${stateBadge(c)}</td><td>${link('/casting/' + c.id, 'Open →')}</td></tr>`)) : empty('No castings found. Create castings from a work order.')}`;
  };

  V.casting = (id) => {
    const c = QI.casting(id); if (!c) return empty('Casting not found.');
    const j = QI.job(c.jobNo) || {};
    const t = QI.castingStages(c);
    const s = QI.castingState(c);
    const openN = S().ncrs.filter((n) => n.status === 'open' && n.castings.includes(c.id));
    const heats = S().heats, logs = S().logs;
    return `<div class="hd"><div><h2>${esc(c.id)} ${stateBadge(c)}</h2><div class="muted">${link('/job/' + c.jobNo, c.jobNo)} · ${esc(j.part)} · Dwg ${esc(j.drawing)} · Grade ${esc(j.grade)}</div></div>
      <div class="row"><a class="btn" href="#/report/${esc(c.id)}">Inspection report</a>
      ${c.status === 'active' ? `<button class="btn" data-act="reject-casting" data-id="${esc(c.id)}">Reject casting</button><button class="btn primary" data-act="release" data-id="${esc(c.id)}" ${t.allDone && !openN.length ? '' : 'disabled title="Complete all stages and close NCRs first"'}>Release casting</button>` : ''}</div></div>
    ${c.status === 'rejected' ? `<div class="banner bad"><b>Rejected</b> at stage ${c.reject.stageNo || '–'} – ${esc(c.reject.reason)} · ${esc(c.reject.action)} · ${esc(c.reject.by)}, ${fdt(c.reject.ts)}</div>` : ''}
    ${c.status === 'released' ? `<div class="banner ok"><b>Released</b> by ${esc(c.release.by)} on ${fdt(c.release.ts)} ${c.release.remarks ? '· ' + esc(c.release.remarks) : ''}</div>` : ''}
    ${openN.length ? `<div class="banner warn"><b>${openN.length} open NCR(s):</b> ${openN.map((n) => `${n.id} (${esc(n.param)} – ${esc(n.action)})`).join('; ')}</div>` : ''}
    <section class="card links"><div class="grid2">
      <div><span class="lbl">Heat (melt)</span><div class="row">${c.status === 'active' || !c.heatNo ? `<select data-act="set-heat" data-id="${esc(c.id)}"><option value="">– select heat –</option>${heats.map((h) => `<option ${h.no === c.heatNo ? 'selected' : ''}>${esc(h.no)}</option>`).join('')}</select>` : esc(c.heatNo)}<button class="btn sm" data-act="new-heat" data-for="${esc(c.id)}">+ New heat</button></div></div>
      <div><span class="lbl">Sand & calibration log (mould-making shift)</span><div class="row"><select data-act="set-log" data-id="${esc(c.id)}"><option value="">– select log –</option>${logs.map((l) => `<option value="${esc(l.id)}" ${l.id === c.logId ? 'selected' : ''}>${esc(l.date)} · shift ${esc(l.shift)}</option>`).join('')}</select><button class="btn sm" data-act="new-log" data-for="${esc(c.id)}">+ New log</button></div></div></div></section>
    ${t.stages.map((x) => {
      const no = x.stage.no;
      const open = ui.stageOpen[c.id + no] != null ? ui.stageOpen[c.id + no] : (no === t.current || x.status === 'fail');
      const sc = x.stage.scope;
      const owner = QI.ownerOf(c, sc);
      let body;
      if (x.locked && c.status !== 'rejected') body = `<div class="muted pad">🔒 Locked – complete the previous stage first.</div>`;
      else if (!owner) body = `<div class="warnBox">${sc === 'heat' ? 'Assign this casting to a heat (melt) to record this stage.' : 'Link the sand & calibration log for the shift in which the mould was made.'}</div>`;
      else {
        const note = sc !== 'casting' ? `<div class="muted sm pad">Recorded once for ${SCOPE_LABEL[sc].toLowerCase()} <b>${esc(owner)}</b> and shared by all castings of it${sc === 'heat' ? ` · ${link('/heat/' + owner, 'open heat record')}` : sc === 'log' ? ` · ${link('/log/' + owner, 'open log')}` : ''}.</div>` : '';
        body = note + stageBlock(x.stage, sc, owner, { locked: x.locked || c.status !== 'active' && sc === 'casting', job: j }) + (c.status === 'rejected' ? '' : approvalStrip(sc, owner, no, [j], c.jobNo));
      }
      return `<section class="card stage ${x.status}"><div class="sh" data-act="stage-toggle" data-k="${esc(c.id + no)}"><span class="sn">${no}</span><span class="sname">${esc(x.stage.name)}</span>${QI.mode === 'shared' ? badge(deptName(no), 'mute') : ''}${x.stage.optional ? badge('per PO / QAP', 'mute') : ''}${stBadge(x.status)}<span class="chev">${open ? '▾' : '▸'}</span></div>${open ? `<div class="sb">${body}</div>` : ''}</section>`;
    }).join('')}`;
  };

  /* ---- heats ---- */
  V.heats = () => `<div class="hd"><h2>Heats (melts)</h2><button class="btn primary" data-act="new-heat">+ New heat</button></div>
    ${S().heats.length ? table(['Heat no.', 'Date', 'Furnace', 'Grade', 'Castings', 'Chemistry (4.2)', ''], S().heats.slice().reverse().map((h) => `<tr><td>${link('/heat/' + h.no, h.no)}</td><td>${esc(h.date)}</td><td>${esc(h.furnace)}</td><td>${esc(h.grade)}</td><td>${QI.heatCastings(h.no).length}</td><td>${stBadge(QI.status('heat', h.no, '4.2.1'))}</td><td>${link('/heat/' + h.no, 'Open →')}</td></tr>`)) : empty('No heats yet.')}`;

  V.heat = (no) => {
    const h = QI.heat(no); if (!h) return empty('Heat not found.');
    const cs = QI.heatCastings(no);
    const unassigned = S().castings.filter((c) => !c.heatNo && c.status === 'active');
    const req = {};
    cs.forEach((c) => QI.stageOf[8].groups[0].steps.forEach((sp) => { if (QI.required(QI.job(c.jobNo), sp.checks[0])) (req[sp.id] = req[sp.id] || new Set()).add(c.jobNo); }));
    return `<div class="hd"><div><h2>Heat ${esc(h.no)}</h2><div class="muted">${esc(h.date)} · Furnace ${esc(h.furnace || '–')} · Grade ${esc(h.grade || '–')} · Tapping ${esc(QI.limText(num(h.tapMin), num(h.tapMax), '°C') || 'limits not set')} · Pouring ${esc(QI.limText(num(h.pourMin), num(h.pourMax), '°C') || 'limits not set')}</div></div>
      <div class="row"><button class="btn" data-act="edit-heat" data-no="${esc(no)}">Edit heat & limits</button><button class="btn" data-act="heat-spec" data-no="${esc(no)}">Chemistry & mechanical spec</button></div></div>
    <section class="card"><h3>Castings poured from this heat (${cs.length})</h3>${cs.length ? castingTable(cs) : '<div class="muted">None yet.</div>'}
      ${unassigned.length ? `<div class="row pad"><select id="addc">${unassigned.map((c) => `<option>${esc(c.id)}</option>`).join('')}</select><button class="btn sm" data-act="heat-add" data-no="${esc(no)}">Add casting to heat</button></div>` : ''}</section>
    ${(() => { const fl = QI.furnaceLog(no); if (!fl) return QI.can('melt') ? `<section class="card"><h3>Furnace log sheet</h3><div class="muted sm pad">No furnace log for this heat yet.</div><button class="btn sm" data-act="ml-open" data-heat="${esc(no)}">Open furnace log</button></section>` : ''; const c = QI.mlCalc(fl); return `<section class="card"><h3>Furnace log sheet <small class="muted">${esc(fl.furnace ? 'Furnace ' + fl.furnace : '')} · saved by ${esc(fl.by)}, ${fdt(fl.ts)}</small></h3><div class="sm">Total LM <b>${f2(c.lm, 0)} kg</b> · charges ${f2(c.charges, 0)} kg · melting loss ${c.lossPct == null ? '–' : f2(c.lossPct, 1) + ' %'} · ${c.kwhPerT == null ? '–' : f2(c.kwhPerT, 0) + ' kWh/t'} · tapping ${esc(fl.tapTemp || '–')} °C · pouring ${esc(fl.pourTemp || '–')} °C</div><button class="btn sm" data-act="ml-open" data-heat="${esc(no)}">Open furnace log</button></section>`; })()}
    ${h.charge ? `<section class="card"><h3>Charge mix <small class="muted">${esc(h.charge.recipe)} · LM ${esc(h.charge.lm)} kg · saved by ${esc(h.charge.by)}, ${fdt(h.charge.ts)}</small></h3>
      <div class="sm">${h.charge.rows.map((x) => `${esc(x.name)} <b>${x.kg} kg</b>`).join(' · ')}</div><div class="muted sm pad">Expected: ${Object.keys(h.charge.expected).map((e) => e + ' ' + h.charge.expected[e]).join(' · ')} ${h.charge.ok ? badge('within target', 'ok') : badge('outside target', 'warn')} · Final cost Rs ${h.charge.finalCost}/kg</div>
      <button class="btn sm" data-act="cm-load" data-no="${esc(no)}">Open in calculator</button></section>` : `<section class="card"><h3>Charge mix</h3><div class="muted sm pad">No charge calculated for this heat yet.</div><button class="btn sm" data-act="cm-plan">Plan charge mix</button></section>`}
    ${[4, 8].map((n) => {
      const st = QI.stageOf[n];
      const sts = st.groups[0].steps.flatMap((s) => s.checks).map((c) => QI.status('heat', no, c.id));
      return `<section class="card"><h3>Stage ${n} · ${esc(st.name)} ${n === 8 ? '<small class="muted">test bars / samples from this heat – tests required depend on each casting’s PO / QAP</small>' : ''}</h3>
        ${n === 8 && Object.keys(req).length ? `<div class="muted sm pad">Required by castings on this heat: ${Object.keys(req).map((k) => `${k} (${[...req[k]].join(', ')})`).join(' · ')}</div>` : ''}${stageBlock(st, 'heat', no)}${approvalStrip('heat', no, n, QI.jobsOf('heat', no))}</section>`;
    }).join('')}`;
  };

  /* ---- logs ---- */
  V.logs = () => {
    const due = QI.due();
    return `<div class="hd"><h2>Sand & calibration logs</h2><button class="btn primary" data-act="new-log">+ New shift log</button></div>
    <section class="card"><h3>Due / overdue</h3>${due.length ? due.map((d) => `<div class="li">${dot('nok')} <b>${esc(d.check.id)}</b> ${esc(QI.steps[d.check.step].name)} – ${esc(d.check.param)} <span class="muted">(${esc(QI.PERIOD_LABEL[d.check.freq])}, last ${d.last ? fd(d.last) : 'never'})</span></div>`).join('') : '<div class="muted">All periodic calibrations and tests are up to date ✔</div>'}</section>
    ${S().logs.length ? table(['Date', 'Shift', 'Checks recorded', 'Failed', 'Castings', ''], S().logs.slice().sort((a, b) => b.id.localeCompare(a.id)).map((l) => {
      const ids = Object.keys(S().results).filter((k) => k.startsWith('log|' + l.id + '|'));
      const bad = ids.filter((k) => QI.last('log', l.id, k.split('|')[2]).result === 'nok').length;
      return `<tr><td>${link('/log/' + l.id, l.date)}</td><td>${esc(l.shift)}</td><td>${ids.length}</td><td>${bad ? badge(bad, 'bad') : '0'}</td><td>${QI.logCastings(l.id).length}</td><td>${link('/log/' + l.id, 'Open →')}</td></tr>`;
    })) : empty('No logs yet.')}`;
  };
  V.log = (id) => {
    const l = QI.log(id); if (!l) return empty('Log not found.');
    return `<div class="hd"><div><h2>Sand & calibration log – ${esc(l.date)}, shift ${esc(l.shift)}</h2><div class="muted">${QI.logCastings(id).length} casting(s) linked · opened by ${esc(l.by || '–')}</div></div></div>
      <section class="card">${stageBlock(QI.stageOf[2], 'log', id)}${approvalStrip('log', id, 2, QI.jobsOf('log', id))}</section>`;
  };


  /* ---- charge mix calculator (method of the "Charge Calculation" design sheets) ---- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const f2 = (v, d) => (v == null || !isFinite(v)) ? '–' : Number(v).toFixed(d == null ? 2 : d);
  const cmEls = () => ui.cm.r.els;
  const setPath = (obj, path, v) => { const k = path.split('.'); let o = obj; for (let i = 0; i < k.length - 1; i++) { if (o[k[i]] == null) o[k[i]] = /^\d+$/.test(k[i + 1]) ? [] : {}; o = o[k[i]]; } o[k[k.length - 1]] = v; };
  const cmOpen = (rec) => { ui.cm = { id: rec ? rec.id : null, r: rec ? clone(rec) : null, dirty: false }; };
  const cmIn = (p, v, extra) => `<input data-p="${p}" value="${esc(v == null ? '' : v)}" type="number" step="any" inputmode="decimal" ${extra || ''}>`;
  const cmBadge = (s) => s === 'ok' ? badge('OK', 'ok') : s === 'low' ? badge('Low', 'bad') : s === 'high' ? badge('High', 'bad') : '';
  function cmValues() {      // every computed cell, keyed by its data-c attribute
    const r = ui.cm.r, c = QI.sheetCalc(r), m = {};
    if (c.error) return { err: c.error };
    r.mats.forEach((mt, i) => { m['kg.' + i] = f2(c.kg[i], 1); m['rs.' + i] = f2(c.rs[i], 0); r.els.forEach((e) => (m[`ct.${i}.${e}`] = c.contrib[i][e] ? f2(c.contrib[i][e], 3) : '')); });
    r.els.forEach((e) => { m['tot.' + e] = f2(c.total[e], 2); m['aft.' + e] = f2(c.after[e], 2); m['st.' + e] = cmBadge(c.status[e]); });
    m.sumwt = f2(c.sumAll, 2); m.sumrs = f2(c.cost.total, 0); m.sumkg = f2(c.kg.reduce((a, b) => a + b, 0), 1);
    m.verdict = c.ok ? '<div class="banner ok">✔ Expected composition (after loss) is within the target limits.</div>' : `<div class="banner warn">⚠ Outside target: ${r.els.filter((e) => c.status[e] === 'low' || c.status[e] === 'high').map((e) => e + ' ' + c.status[e]).join(', ')} – adjust the charge weights.</div>`;
    const k = c.cost; m['cost.total'] = f2(k.total, 0); m['cost.retkg'] = f2(k.retKg, 0); m['cost.retval'] = f2(k.retVal, 0); m['cost.perkg'] = f2(k.perKg); m['cost.rej'] = f2(k.perKgRej); m['cost.credit'] = f2(k.credit); m['cost.net'] = f2(k.net); m['cost.final'] = f2(k.final);
    return m;
  }
  function cmUpdate() {
    const m = cmValues();
    document.querySelectorAll('#cm [data-c]').forEach((el) => { const k = el.dataset.c; if (m.err) { el.innerHTML = k === 'verdict' ? `<div class="warnBox">${esc(m.err)}</div>` : ''; } else if (m[k] != null) el.innerHTML = m[k]; });
    const d = $('#cm-dirty'); if (d) d.hidden = !ui.cm.dirty;
  }
  V.charge = () => {
    const C = QI.cm();
    if (!ui.cm || !ui.cm.r) cmOpen(C.recipes[0]);
    if (!ui.cm.r) return `<div class="hd"><h2>Charge mix</h2></div>${empty('No charge recipes yet.')}`;
    const r = ui.cm.r, els = r.els, w = (e) => 'style="min-width:62px"';
    const th = els.map((e) => `<th>${e}%</th>`).join('');
    const per = C.recipes.map((x) => ({ x, c: QI.sheetCalc(x) }));
    return `<div id="cm"><div class="hd"><h2>Charge mix</h2><div class="row"><select id="cm-pick" aria-label="Recipe">${C.recipes.map((x) => `<option value="${esc(x.id)}" ${x.id === ui.cm.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="btn" data-act="cm-dup">Copy as new grade…</button></div></div>
    <div class="banner warn" id="cm-dirty" ${ui.cm.dirty ? '' : 'hidden'}>Unsaved changes – <button class="btn sm primary" data-act="cm-save">Save recipe</button> <button class="btn sm" data-act="cm-reset">Discard</button></div>
    ${r.note ? `<div class="banner">${esc(r.note)}</div>` : ''}
    <div class="muted sm pad">Method as per the “Charge Calculation” sheets in the QC n Design folder. Edit any number; results update as you type. Saved recipes are shared with every department.</div>
    <section class="card"><h3>${esc(r.customer)} · ${esc(r.grade)}</h3>
      <div class="grid3"><label class="f"><span>Liquid metal to tap, LM (kg)</span>${cmIn('lm', r.lm)}</label><label class="f"><span>Foundry return in charge, FR (kg)</span>${cmIn('fr', r.fr)}</label><label class="f"><span>Melt loss (%)</span>${cmIn('meltLoss', r.meltLoss)}</label>
      <label class="f"><span>Yield (%)</span>${cmIn('yield', r.yield)}</label><label class="f"><span>Rejection (%)</span>${cmIn('rej', r.rej)}</label><label class="f"><span>Lining & other cost (Rs/kg)</span>${cmIn('other', r.other)}</label></div></section>
    <section class="card"><h3>Target composition <button class="btn sm ghost" data-act="cm-cols">Columns…</button></h3><div class="tw"><table class="cmt"><thead><tr><th></th>${th}</tr></thead><tbody>
      ${['min', 'max', 'aim'].map((k) => `<tr><th>${k === 'min' ? 'Min' : k === 'max' ? 'Max' : 'Aim at'}</th>${els.map((e) => `<td>${cmIn(`tg.${e}.${k}`, r.tg[e] && r.tg[e][k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <section class="card"><h3>Raw materials – chemical analysis as per report</h3><div class="tw"><table class="cmt"><thead><tr><th>Material</th><th>FR</th><th>MRN</th>${th}<th>Rs/kg</th><th></th></tr></thead><tbody>
      ${r.mats.map((m, i) => `<tr><td><input data-p="mats.${i}.name" value="${esc(m.name)}"></td><td><input type="checkbox" data-p="mats.${i}.fr" ${m.fr ? 'checked' : ''} title="Foundry return (fixed kg)"></td><td><input data-p="mats.${i}.mrn" value="${esc(m.mrn)}" style="min-width:70px"></td>${els.map((e) => `<td>${cmIn(`mats.${i}.comp.${e}`, m.comp && m.comp[e])}</td>`).join('')}<td>${cmIn(`mats.${i}.rate`, m.rate)}</td><td><button class="x" data-act="cm-delmat" data-i="${i}" title="Remove">×</button></td></tr>`).join('')}</tbody></table></div>
      <button class="btn sm ghost" data-act="cm-addmat">+ Add material</button></section>
    <section class="card"><h3>Charging</h3><div data-c="verdict"></div><div class="tw"><table class="cmt"><thead><tr><th>Material</th><th>Wt</th><th>Charge kg</th><th>Rs</th>${th}</tr></thead><tbody>
      ${r.mats.map((m, i) => `<tr><td>${esc(m.name)}${m.fr ? ' ' + badge('FR', 'mute') : ''}</td><td>${cmIn(`mats.${i}.wt`, m.wt)}</td><td data-c="kg.${i}"></td><td data-c="rs.${i}"></td>${els.map((e) => `<td class="muted" data-c="ct.${i}.${e}"></td>`).join('')}</tr>`).join('')}
      <tr class="tot"><th>Total</th><th data-c="sumwt"></th><th data-c="sumkg"></th><th data-c="sumrs"></th>${els.map((e) => `<th data-c="tot.${e}"></th>`).join('')}</tr>
      <tr><th>Loss % of element</th><td colspan="4"></td>${els.map((e) => `<td>${cmIn('loss.' + e, r.loss[e])}</td>`).join('')}</tr>
      <tr><th>From lining (added)</th><td colspan="4"></td>${els.map((e) => `<td>${cmIn('lin.' + e, r.lin[e])}</td>`).join('')}</tr>
      <tr class="tot"><th>Expected composition (after loss)</th><td colspan="4"></td>${els.map((e) => `<th data-c="aft.${e}"></th>`).join('')}</tr>
      <tr><th>Check vs target</th><td colspan="4"></td>${els.map((e) => `<td data-c="st.${e}"></td>`).join('')}</tr>
      <tr><th>Actual bath report</th><td colspan="4"></td>${els.map((e) => `<td>${cmIn('bath.' + e, r.bath && r.bath[e])}</td>`).join('')}</tr></tbody></table></div></section>
    <section class="card"><h3>Cost per kg</h3><table class="kv2"><tbody>
      <tr><td>Cost of charge (Rs)</td><td data-c="cost.total"></td></tr><tr><td>Less: value of returns (<span data-c="cost.retkg"></span> kg)</td><td data-c="cost.retval"></td></tr>
      <tr><td>Cost per kg</td><td data-c="cost.perkg"></td></tr><tr><td>Cost per kg after rejection (${esc(r.rej)} %)</td><td data-c="cost.rej"></td></tr>
      <tr><td>Less: material cost of rejected material</td><td data-c="cost.credit"></td></tr><tr><td>Net cost per kg</td><td data-c="cost.net"></td></tr>
      <tr><td>Lining and other cost</td><td>${f2(r.other)}</td></tr><tr class="tot"><td><b>Final cost per kg (Rs)</b></td><td><b data-c="cost.final"></b></td></tr></tbody></table>
      <div class="row pad"><button class="btn primary" data-act="cm-save">Save recipe</button><button class="btn" data-act="cm-toheat">Use for a heat…</button><button class="btn danger" data-act="cm-del">Delete recipe</button></div></section>
    <section class="card"><h3>Charge mix of each grade</h3>${table(['Customer · grade', 'LM kg', 'Charge (kg)', 'Expected vs target', 'Final Rs/kg', ''], per.map(({ x, c }) => `<tr><td>${esc(x.name)}</td><td>${esc(x.lm)}</td><td class="sm">${c.error ? '–' : x.mats.map((m, i) => n0(m.wt) > 0 ? `${esc(m.name)} <b>${f2(c.kg[i], 0)}</b>` : '').filter(Boolean).join(' · ')}</td><td>${c.error ? '' : c.ok ? badge('within target', 'ok') : badge('check', 'warn')}</td><td>${c.error ? '–' : f2(c.cost.final)}</td><td><button class="btn sm ghost" data-act="cm-open" data-id="${esc(x.id)}">Open</button></td></tr>`))}</section></div>`;
  };
  const n0 = (v) => (v === '' || v == null || !isFinite(+v)) ? 0 : +v;
  const CHARGE_ACTS = {
    'cm-open': (el) => { cmOpen(QI.cm().recipes.find((x) => x.id === el.dataset.id)); render(); window.scrollTo(0, 0); },
    'cm-reset': () => { cmOpen(QI.cm().recipes.find((x) => x.id === ui.cm.id)); render(); },
    'cm-save': () => { const r = ui.cm.r; const rec = QI.cmSaveRecipe(r); cmOpen(rec); render(); toast('Recipe saved', 'ok'); },
    'cm-del': () => ask(`Delete the recipe “${ui.cm.r.name}”?`, () => { QI.cmDelete(ui.cm.id); ui.cm = null; }, 'Delete'),
    'cm-addmat': () => { ui.cm.r.mats.push({ name: 'New material', mrn: '', comp: {}, rate: '', wt: '', fr: false }); ui.cm.dirty = true; render(); },
    'cm-delmat': (el) => { ui.cm.r.mats.splice(+el.dataset.i, 1); ui.cm.dirty = true; render(); },
    'cm-cols': () => modal('Element columns', `<div class="chips">${QI.EL.map((e) => `<label class="chip"><input type="checkbox" name="el_${e}" ${ui.cm.r.els.includes(e) ? 'checked' : ''}> ${e}</label>`).join('')}</div>`, (f) => { const els = QI.EL.filter((e) => f.elements['el_' + e].checked); if (!els.length) return 'Choose at least one element.'; ui.cm.r.els = els; ui.cm.dirty = true; }),
    'cm-dup': () => modal('Copy as a new grade', `${combo('Customer', 'customer', 'customer', ui.cm.r.customer)}${fld('Grade', 'grade', '', 'required')}<label class="chip"><input type="checkbox" name="keep" checked> Keep target, weights and losses (untick to start with empty weights)</label>`, (f) => {
      const grade = val(f, 'grade'); if (!grade) return 'Enter the grade.'; const r = clone(ui.cm.r); delete r.id; r.customer = cval(f, 'customer', 'customer'); r.grade = grade; r.note = '';
      if (!f.elements.keep.checked) { r.mats.forEach((m) => { m.wt = ''; }); r.tg = {}; r.loss = {}; r.lin = {}; r.bath = {}; }
      const rec = QI.cmSaveRecipe(r); cmOpen(rec); }, 'Create'),
    'cm-toheat': () => {
      if (!S().heats.length) { toast('Create a heat first (Heats page).', 'bad'); return; }
      const r = ui.cm.r; if (QI.sheetCalc(r).error) { toast('Enter the charge weights first.', 'bad'); return; }
      modal('Use this charge for a heat', `${sel('Heat', 'heat', S().heats.map((h) => h.no), '')}<label class="chip"><input type="checkbox" name="spec" checked> Also set the target limits as the heat’s chemistry specification (checks 4.1 / 4.2)</label>`, (f) => {
        const h = val(f, 'heat'); const res = QI.saveCharge(h, r); if (res.error) return res.error; if (f.elements.spec.checked) QI.applyGradeSpec(h, r); toast('Charge saved to heat ' + h, 'ok'); }, 'Save to heat');
    },
    'cm-load': (el) => { const h = QI.heat(el.dataset.no); const rec = h && h.charge && QI.cm().recipes.find((x) => x.name === h.charge.recipe); cmOpen(rec || QI.cm().recipes[0]); go('charge'); },
    'cm-plan': () => { go('charge'); },
  };
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.closest || !t.closest('#cm') || !t.dataset.p) return;
    const isText = /\.(name|mrn)$/.test(t.dataset.p);
    setPath(ui.cm.r, t.dataset.p, t.type === 'checkbox' ? t.checked : isText ? t.value : t.value === '' ? '' : parseFloat(t.value));
    ui.cm.dirty = true; cmUpdate();
  });
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t.closest || !t.closest('#cm')) return;
    if (t.id === 'cm-pick') { cmOpen(QI.cm().recipes.find((x) => x.id === t.value)); render(); return; }
    if (t.type === 'checkbox' && t.dataset.p) { setPath(ui.cm.r, t.dataset.p, t.checked); ui.cm.dirty = true; cmUpdate(); }
  });

  /* ---- furnace log sheet (DCL/FR/04 Re/05) ---- */
  const getP = (o, path) => path.split('.').reduce((x, k) => (x == null ? '' : x[k]), o);
  const mlLoad = (heat) => { const ex = QI.furnaceLog(heat); ui.ml = { log: ex ? clone(ex) : QI.mlNew(heat, ''), dirty: false, isNew: !ex }; };
  const mlIn = (p, o) => { o = o || {}; const v = getP(ui.ml.log, p); return `<input data-p="${p}" type="${o.type || 'number'}" ${o.type ? '' : 'step="any" inputmode="decimal"'} value="${esc(v == null ? '' : v)}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.extra || ''}>`; };
  const mlSel = (p, listKey, defs) => {      // dropdown with "Other (specify)…" that learns new values
    const cur = getP(ui.ml.log, p) || ''; const opts = QI.opts(listKey, defs); if (cur && !opts.includes(cur)) opts.unshift(cur);
    return `<select class="mlsel" data-p="${p}" data-list="${listKey}"><option value="">– select –</option>${opts.map((x) => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__other">＋ Other (specify)…</option></select><input class="other" data-other="${p}" data-list="${listKey}" placeholder="Type new value – saved for next time" hidden>`;
  };
  const mlLbl = (t, inner) => `<label class="f"><span>${t}</span>${inner}</label>`;
  function mlValues() {
    const l = ui.ml.log, c = QI.mlCalc(l), m = {};
    m['ml.scrap'] = f2(c.scrap, 1); m['ml.alloy'] = f2(c.alloy, 1); m['ml.charges'] = f2(c.charges, 1); m['ml.lm'] = f2(c.lm, 1);
    m['ml.loss'] = c.loss == null ? '–' : f2(c.loss, 1); m['ml.losspct'] = c.lossPct == null ? '–' : f2(c.lossPct, 2) + ' %'; m['ml.kwh'] = c.kwh == null ? '–' : f2(c.kwh, 0); m['ml.kwhpt'] = c.kwhPerT == null ? '–' : f2(c.kwhPerT, 0); m['ml.ht'] = c.heatTime || '–';
    QI.ML_ALLOYS.forEach(([k]) => { m['at.' + k] = f2(((l.alloys[k] && l.alloys[k].w) || []).reduce((x, v) => x + n0(v), 0), 1); });
    return m;
  }
  function mlUpdate() {
    if (!ui.ml) return; const m = mlValues();
    document.querySelectorAll('#ml [data-c]').forEach((el) => { if (m[el.dataset.c] != null) el.textContent = m[el.dataset.c]; });
    document.querySelectorAll('#ml input[data-rd]').forEach((el) => { const [bk, e] = el.dataset.rd.split('.'); const st = QI.mlStatus(ui.ml.log, e, getP(ui.ml.log, `bath.${bk}.${e}`)); el.className = st ? 'rd-' + st : ''; });
    const d = $('#ml-dirty'); if (d) d.hidden = !ui.ml.dirty;
  }
  V.melt = () => {
    const L = S().furnaceLogs.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '') || y.heat.localeCompare(x.heat));
    return `<div class="hd"><h2>Melting log <small>Furnace Log Sheet</small></h2><button class="btn primary" data-act="ml-new">+ New furnace log</button></div>
    ${L.length ? table(['Heat', 'Date', 'Furnace', 'Grade', 'Total LM (kg)', 'Melting loss', 'kWh / t', 'Signed', ''], L.map((l) => { const c = QI.mlCalc(l); const sg = ['shift', 'incharge', 'metallurgist'].filter((k) => l.sign && l.sign[k]).length;
      return `<tr><td><b>${esc(l.heat)}</b></td><td>${esc(l.date)}</td><td>${esc(l.furnace)}</td><td>${esc(l.grade)}</td><td>${f2(c.lm, 0)}</td><td>${c.lossPct == null ? '–' : f2(c.lossPct, 1) + ' %'}</td><td>${c.kwhPerT == null ? '–' : f2(c.kwhPerT, 0)}</td><td>${badge(sg + ' / 3', sg === 3 ? 'ok' : 'mute')}</td><td><button class="btn sm ghost" data-act="ml-open" data-heat="${esc(l.heat)}">Open</button></td></tr>`; })) : empty('No furnace logs yet. Tap “New furnace log” to record a heat exactly as on the paper Furnace Log Sheet.')}`;
  };
  V.meltlog = (heat) => {
    if (!ui.ml || ui.ml.log.heat !== heat) mlLoad(heat);
    const l = ui.ml.log, els = QI.ML_EL;
    const rowEl = (key, label, f) => `<tr><th>${label}</th>${els.map((e) => `<td>${f(e)}</td>`).join('')}</tr>`;
    const posted = !!l.ts;
    return `<div id="ml"><div class="hd"><div><h2>Furnace Log Sheet <small>Format No. DCL/FR/04 Re/05</small></h2><div class="muted sm">${posted ? `Last saved by ${esc(l.by)}, ${fdt(l.ts)}` : 'Not saved yet'}</div></div>
      <div class="row"><button class="btn primary" data-act="ml-save">Save log</button><button class="btn" data-act="ml-post">Post to inspection…</button><button class="btn" data-act="ml-dl">Download sheet</button></div></div>
    <div class="banner warn" id="ml-dirty" ${ui.ml.dirty ? '' : 'hidden'}>Unsaved changes – tap <b>Save log</b>.</div>
    <section class="card"><h3>Heat</h3><div class="grid3">
      ${mlLbl('Heat No.', `<input data-p="heat" type="text" value="${esc(l.heat)}" ${posted ? 'readonly' : ''}>`)}${mlLbl('Furnace No.', mlSel('furnace', 'furnace', QI.ML_DEFAULTS.furnace))}${mlLbl('Material grade', mlSel('grade', 'mlGrade', QI.ML_DEFAULTS.mlGrade))}
      ${mlLbl('Date', mlIn('date', { type: 'date' }))}${mlLbl('Heat on lining', mlIn('lining'))}${mlLbl('Heat on patching', mlIn('patching', { type: 'text', ph: 'e.g. 02-10' }))}</div></section>
    <section class="card"><h3>Chemical analysis (%)</h3><div class="muted sm pad">Spec min / max are remembered for each grade and offered next time. Readings outside the spec turn red.</div><div class="tw"><table class="cmt"><thead><tr><th></th>${els.map((e) => `<th>${e}</th>`).join('')}</tr></thead><tbody>
      ${rowEl('smin', 'Spec Min', (e) => mlIn(`spec.${e}.min`))}${rowEl('smax', 'Spec Max', (e) => mlIn(`spec.${e}.max`))}
      ${[['b1', 'Bath 1'], ['b2', 'Bath 2'], ['b3', 'Bath 3'], ['final', 'Ladle Final']].map(([k, t]) => rowEl(k, t, (e) => mlIn(`bath.${k}.${e}`, { extra: `data-rd="${k}.${e}"` }))).join('')}</tbody></table></div>
      <div class="grid3 pad">${mlLbl('Power on at', mlIn('powerOn', { type: 'time' }))}${mlLbl('Tapped at', mlIn('tapped', { type: 'time' }))}${mlLbl('Heat time (hh:mm)', '<div class="calc" data-c="ml.ht"></div>')}</div></section>
    <section class="card"><h3>Input charges</h3><div class="tw"><table class="cmt"><thead><tr><th>Scrap</th><th>Wt (kg)</th><th>MRN No.</th></tr></thead><tbody>
      ${l.scrap.map((r, i) => `<tr><td>${mlSel(`scrap.${i}.mat`, 'mlScrap', QI.ML_DEFAULTS.mlScrap)}</td><td>${mlIn(`scrap.${i}.wt`)}</td><td>${mlIn(`scrap.${i}.mrn`, { type: 'text' })}</td></tr>`).join('')}
      <tr><td>Foundry return (runner / riser etc.)</td><td>${mlIn('fr.wt')}</td><td>${mlIn('fr.note', { type: 'text' })}</td></tr>
      <tr class="tot"><th>Scrap + return</th><th><span data-c="ml.scrap"></span></th><th></th></tr></tbody></table></div><button class="btn sm ghost" data-act="ml-addscrap">+ Add scrap row</button></section>
    <section class="card"><h3>Ferro alloys <small class="muted">weight per addition: charge + after Bath 1 + after Bath 2</small></h3><div class="tw"><table class="cmt"><thead><tr><th>Alloy</th><th>Wt 1</th><th>Wt 2</th><th>Wt 3</th><th>Total</th><th>MRN No.</th></tr></thead><tbody>
      ${QI.ML_ALLOYS.map(([k, t]) => `<tr><td>${t}</td>${[0, 1, 2].map((i) => `<td>${mlIn(`alloys.${k}.w.${i}`)}</td>`).join('')}<td><span class="calc" data-c="at.${k}"></span></td><td>${mlIn(`alloys.${k}.mrn`, { type: 'text' })}</td></tr>`).join('')}
      <tr class="tot"><th>Ferro alloys total</th><td colspan="3"></td><th data-c="ml.alloy"></th><td></td></tr></tbody></table></div></section>
    <section class="card"><h3>LM distribution</h3><div class="grid3">${[['mould', 'Mould pouring (kg)'], ['pigged', 'Pigged (kg)'], ['heel', 'Heel / Return (kg)'], ['floor', 'Floor loss (kg)'], ['skull', 'Ladle skull (kg)']].map(([k, t]) => mlLbl(t, mlIn('lm.' + k))).join('')}
      ${mlLbl('Total LM (kg)', '<div class="calc" data-c="ml.lm"></div>')}${mlLbl('Total charges (kg)', '<div class="calc" data-c="ml.charges"></div>')}${mlLbl('Melting loss (kg)', '<div class="calc" data-c="ml.loss"></div>')}${mlLbl('Melting loss (%)', '<div class="calc" data-c="ml.losspct"></div>')}</div></section>
    <section class="card"><h3>Power, ladle and temperatures</h3><div class="grid3">
      ${mlLbl('Meter reading – initial', mlIn('power.init'))}${mlLbl('Meter reading – final', mlIn('power.final'))}${mlLbl('Meter multiplier', mlIn('power.mult'))}
      ${mlLbl('Actual (kWh)', '<div class="calc" data-c="ml.kwh"></div>')}${mlLbl('kWh per tonne LM', '<div class="calc" data-c="ml.kwhpt"></div>')}${mlLbl('Furnace max power (kWh)', mlIn('power.max'))}
      ${mlLbl('Ladle No.', mlSel('ladle.no', 'mlLadle', QI.ML_DEFAULTS.mlLadle))}${mlLbl('Ladle life (heats)', mlIn('ladle.life'))}${mlLbl('Ladle preheating', mlIn('ladle.preheat', { type: 'text' }))}
      ${mlLbl('L.D.O. / HSD used (litres)', mlIn('ldo'))}${mlLbl('Witness', mlSel('witness', 'mlWitness', []))}<div></div>
      ${mlLbl('Tapping temp (°C)', mlIn('tapTemp'))}${mlLbl('Tapping limit min', mlIn('tapMin'))}${mlLbl('Tapping limit max', mlIn('tapMax'))}
      ${mlLbl('Pouring temp (°C)', mlIn('pourTemp'))}${mlLbl('Pouring limit min', mlIn('pourMin'))}${mlLbl('Pouring limit max', mlIn('pourMax'))}</div><div class="muted sm">Limits come from the method plan DCL/MTD/01 and are stored on the heat.</div></section>
    <section class="card"><h3>Mould pouring allocation</h3><div class="tw"><table class="cmt"><thead><tr><th>No. of boxes</th><th>Product code / Drg. No.</th><th>Quantity</th><th>L.M.W.T</th><th>Net casting</th></tr></thead><tbody>
      ${l.alloc.map((r, i) => `<tr><td>${mlIn(`alloc.${i}.boxes`)}</td><td>${mlSel(`alloc.${i}.product`, 'mlProduct', [])}</td><td>${mlIn(`alloc.${i}.qty`)}</td><td>${mlIn(`alloc.${i}.lmwt`)}</td><td>${mlIn(`alloc.${i}.net`)}</td></tr>`).join('')}</tbody></table></div>
      <button class="btn sm ghost" data-act="ml-addalloc">+ Add row</button><div class="grid2 pad">${mlLbl('Rin LM / Heel (kg)', mlIn('rinLM'))}${mlLbl('Rejected casting', mlIn('rejected', { type: 'text' }))}</div></section>
    <section class="card"><h3>Fluxes, de-oxidisers, consumables and refractory</h3><div class="specgrid">${[].concat(QI.ML_FLUX.map(([k, t]) => [`flux.${k}`, t + ' (kg)`'.slice(0, 0) + ' (kg)']), QI.ML_CONSUM.map(([k, t]) => [`consum.${k}`, t]), QI.ML_REFR.map(([k, t]) => [`refr.${k}`, t])).map(([p, t]) => mlLbl(t, mlIn(p))).join('')}${mlLbl('Nozzle size (mm)', mlIn('nozzleSize', { type: 'text' }))}</div></section>
    <section class="card"><h3>Remarks</h3><div class="grid2">${mlLbl('Remark', mlSel('remarks', 'mlRemarks', QI.ML_DEFAULTS.mlRemarks))}${mlLbl('Pouring time (mm:ss)', mlIn('pourTime', { type: 'text', ph: '08:57' }))}</div>${mlLbl('Notes', `<textarea data-p="remarkNote" rows="3">${esc(l.remarkNote)}</textarea>`)}</section>
    <section class="card"><h3>Signatures</h3><div class="aps">${[['shift', 'Shift Engineer'], ['incharge', 'Melting Shop Incharge'], ['metallurgist', 'Plant Metallurgist']].map(([k, t]) => { const s = l.sign && l.sign[k]; return `<div class="ap ${s ? 'done' : ''}"><div class="apl">${t}</div>${s ? `<div><b>${esc(s.by)}</b></div><div class="muted sm">${fdt(s.ts)}</div>` : posted ? `<button class="btn sm primary" data-act="ml-sign" data-role="${k}">Sign</button>` : '<div class="muted sm">Save the log first</div>'}</div>`; }).join('')}</div></section></div>`;
  };
  function mlSheetHtml(l) {
    const c = QI.mlCalc(l), E = QI.ML_EL, td = (v) => `<td>${esc(v == null ? '' : v)}</td>`;
    return `<h2>Datre Corporation Limited – Furnace Log Sheet <small>DCL/FR/04 Re/05</small></h2>
    <table><tr><th>Heat No.</th>${td(l.heat)}<th>Material grade</th>${td(l.grade)}<th>Date</th>${td(l.date)}</tr><tr><th>Furnace No.</th>${td(l.furnace)}<th>Heat on lining</th>${td(l.lining)}<th>Heat on patching</th>${td(l.patching)}</tr></table>
    <table><tr><th></th>${E.map((e) => `<th>${e}</th>`).join('')}</tr><tr><th>Spec Min</th>${E.map((e) => td(l.spec[e] && l.spec[e].min)).join('')}</tr><tr><th>Spec Max</th>${E.map((e) => td(l.spec[e] && l.spec[e].max)).join('')}</tr>${[['b1', 'Bath 1'], ['b2', 'Bath 2'], ['b3', 'Bath 3'], ['final', 'Ladle Final']].map(([k, t]) => `<tr><th>${t}</th>${E.map((e) => td(l.bath[k][e])).join('')}</tr>`).join('')}</table>
    <p>Power on ${esc(l.powerOn)} · Tapped ${esc(l.tapped)} · Heat time ${esc(c.heatTime)} · Tapping ${esc(l.tapTemp)} °C · Pouring ${esc(l.pourTemp)} °C · Ladle ${esc(l.ladle.no)} (life ${esc(l.ladle.life)}) · Witness ${esc(l.witness)}</p>
    <table><tr><th>Input charges</th><th>Wt kg</th><th>MRN</th></tr>${l.scrap.filter((r) => r.mat || r.wt).map((r) => `<tr>${td(r.mat)}${td(r.wt)}${td(r.mrn)}</tr>`).join('')}<tr>${td('Foundry return ' + (l.fr.note || ''))}${td(l.fr.wt)}${td('')}</tr></table>
    <table><tr><th>Ferro alloy</th><th>Wt 1</th><th>Wt 2</th><th>Wt 3</th><th>Total</th><th>MRN</th></tr>${QI.ML_ALLOYS.filter(([k]) => l.alloys[k] && (l.alloys[k].w || []).some((v) => v !== '')).map(([k, t]) => { const w = l.alloys[k].w || []; return `<tr>${td(t)}${td(w[0])}${td(w[1])}${td(w[2])}${td(f2(w.reduce((x, v) => x + n0(v), 0), 1))}${td(l.alloys[k].mrn)}</tr>`; }).join('')}</table>
    <p>Mould pouring ${esc(l.lm.mould)} · Pigged ${esc(l.lm.pigged)} · Heel ${esc(l.lm.heel)} · Floor loss ${esc(l.lm.floor)} · Ladle skull ${esc(l.lm.skull)} · <b>Total LM ${f2(c.lm, 0)} kg</b> · Total charges ${f2(c.charges, 0)} kg · Melting loss ${c.loss == null ? '–' : f2(c.loss, 1)} kg (${c.lossPct == null ? '–' : f2(c.lossPct, 2)} %)</p>
    <p>Power ${c.kwh == null ? '–' : f2(c.kwh, 0)} kWh (${c.kwhPerT == null ? '–' : f2(c.kwhPerT, 0)} kWh/t) · Max power ${esc(l.power.max)} · L.D.O./HSD ${esc(l.ldo)} l</p>
    <table><tr><th>Boxes</th><th>Product / Drg</th><th>Qty</th><th>LMWT</th><th>Net casting</th></tr>${l.alloc.filter((r) => r.product || r.boxes).map((r) => `<tr>${td(r.boxes)}${td(r.product)}${td(r.qty)}${td(r.lmwt)}${td(r.net)}</tr>`).join('')}</table>
    <p>Remarks: ${esc(l.remarks)} ${esc(l.remarkNote)} · Pouring time ${esc(l.pourTime)}</p>
    <div class="sig">${[['shift', 'Shift Engineer'], ['incharge', 'Melting Shop Incharge'], ['metallurgist', 'Plant Metallurgist']].map(([k, t]) => `<div>${t}<br>${l.sign && l.sign[k] ? esc(l.sign[k].by) + ', ' + fd(l.sign[k].ts) : ''}</div>`).join('')}</div>`;
  }
  const MELT_ACTS = {
    'ml-new': () => modal('New furnace log', `${fld('Heat No.', 'heat', '', 'required')}${combo('Material grade', 'grade', 'mlGrade', '', QI.ML_DEFAULTS.mlGrade)}${combo('Furnace No.', 'furnace', 'furnace', '', QI.ML_DEFAULTS.furnace)}`, (f) => {
      const heat = val(f, 'heat'); if (!heat) return 'Enter the heat number.'; if (QI.furnaceLog(heat)) { mlLoad(heat); go('meltlog/' + heat); return; }
      const grade = cval(f, 'grade', 'mlGrade'), furnace = cval(f, 'furnace', 'furnace');
      ui.ml = { log: Object.assign(QI.mlNew(heat, grade), { furnace }), dirty: true, isNew: true }; go('meltlog/' + heat); }, 'Open log'),
    'ml-open': (el) => { mlLoad(el.dataset.heat); go('meltlog/' + el.dataset.heat); },
    'ml-save': () => { if (needInspector()) return; const r = QI.mlSave(ui.ml.log); if (r.error) { toast(r.error, 'bad'); return; } ui.ml.dirty = false; render(); toast('Furnace log saved', 'ok'); },
    'ml-sign': (el) => { if (needInspector()) return; if (ui.ml.dirty) { toast('Save the log first.', 'bad'); return; } const r = QI.mlSign(ui.ml.log.heat, el.dataset.role); if (r.error) { toast(r.error, 'bad'); return; } mlLoad(ui.ml.log.heat); render(); },
    'ml-addscrap': () => { ui.ml.log.scrap.push({ mat: '', wt: '', mrn: '' }); ui.ml.dirty = true; render(); },
    'ml-addalloc': () => { ui.ml.log.alloc.push({ boxes: '', product: '', qty: '', lmwt: '', net: '' }); ui.ml.dirty = true; render(); },
    'ml-dl': () => download(`furnace-log-${ui.ml.log.heat}.html`, `<!doctype html><meta charset="utf-8"><title>Furnace Log ${esc(ui.ml.log.heat)}</title><style>body{font:12px system-ui;margin:14px}table{border-collapse:collapse;width:100%;margin-bottom:8px}th,td{border:1px solid #888;padding:2px 5px;text-align:left}th{background:#eee}small{font-weight:400}.sig{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:36px}.sig div{border-top:1px solid #000;padding-top:3px}</style>${mlSheetHtml(ui.ml.log)}`, 'text/html'),
    'ml-post': () => {
      if (needInspector()) return; if (ui.ml.dirty || !ui.ml.log.ts) { toast('Save the log first.', 'bad'); return; }
      const heat = ui.ml.log.heat, items = QI.mlPreview(heat);
      if (!items.length) { toast('Enter bath / ladle readings or temperatures first.', 'bad'); return; }
      modal('Post to inspection records', `<p class="muted sm">These results will be recorded against heat ${esc(heat)} (stage 4).</p>${items.map((it) => `<div class="li"><b>${it.id}</b> ${esc(it.label)}<div class="sm">${it.ev.error ? `<span class="badT">${esc(it.ev.error)}</span>` : `${it.ev.result === 'ok' ? badge('OK', 'ok') : badge('Not OK', 'bad')} ${esc(it.ev.summary || '')}`}${it.recheck ? `<div class="sm">↻ Then re-checked with the ladle-final readings: ${badge('OK', 'ok')} (corrected by the ferro addition – the NCR closes automatically)</div>` : ''}</div>
        ${!it.ev.error && it.ev.result === 'nok' && !it.recheck ? `<label class="f"><span>If Not OK – action</span><select name="act_${it.id}">${it.actions.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>${it.id === '4.2.1' ? '<div class="sm badT">Choosing “Reject all castings poured” rejects every casting already assigned to this heat.</div>' : ''}` : ''}</div>`).join('')}`,
        (f) => { const acts = {}; items.forEach((it) => { if (f.elements['act_' + it.id]) acts[it.id] = f.elements['act_' + it.id].value; });
          const res = QI.mlPost(heat, acts); const bad = res.filter((x) => x.error); const ok = res.filter((x) => !x.error);
          if (!ok.length) return bad.map((x) => x.id + ': ' + x.error).join(' · ');
          toast(`Posted ${ok.length} check(s)${ok.some((x) => x.ncr) ? ' · NCR raised' : ''}${bad.length ? ' · ' + bad.length + ' skipped' : ''}`, ok.some((x) => x.result === 'nok') ? 'bad' : 'ok'); }, 'Post');
    },
  };
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.closest || !t.closest('#ml') || !ui.ml) return;
    if (t.dataset.other) { setPath(ui.ml.log, t.dataset.other, t.value); ui.ml.dirty = true; return; }
    if (!t.dataset.p || t.tagName === 'SELECT') return;
    setPath(ui.ml.log, t.dataset.p, t.type === 'number' ? (t.value === '' ? '' : parseFloat(t.value)) : t.value);
    if (/^heat$/.test(t.dataset.p)) { ui.ml.log.heat = t.value; }
    ui.ml.dirty = true; mlUpdate();
  });
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t.closest || !t.closest('#ml') || !ui.ml) return;
    if (t.dataset.other) { QI.learn(t.dataset.list, t.value.trim()); ui.ml.dirty = true; render(); return; }
    if (t.classList.contains('mlsel')) {
      const o = t.parentNode.querySelector('input[data-other]');
      if (t.value === '__other') { o.hidden = false; o.focus(); return; }
      setPath(ui.ml.log, t.dataset.p, t.value); ui.ml.dirty = true;
      if (t.dataset.p === 'grade') { const sp = (QI.mlStore().specs || {})[t.value]; if (sp && !Object.keys(ui.ml.log.spec).length) ui.ml.log.spec = clone(sp); render(); } else mlUpdate();
    }
  });

  /* ---- moulding daily plan ---- */
  const mpLoad = (date) => { const ex = QI.mouldPlan(date); ui.mp = { plan: ex ? clone(ex) : QI.mpNew(date), dirty: false }; };
  const mpIn = (p, o) => { o = o || {}; const v = getP(ui.mp.plan, p); return `<input data-p="${p}" type="${o.type || 'number'}" ${o.type ? '' : 'step="any" inputmode="decimal"'} value="${esc(v == null ? '' : v)}" ${o.extra || ''}>`; };
  const mpSel = (p, listKey, defs, extraOpts) => {
    const cur = getP(ui.mp.plan, p) || ''; const opts = QI.opts(listKey, defs); (extraOpts || []).forEach((x) => { if (!opts.includes(x)) opts.push(x); }); if (cur && !opts.includes(cur)) opts.unshift(cur);
    return `<select class="mpsel" data-p="${p}" data-list="${listKey}"><option value="">– select –</option>${opts.map((x) => `<option value="${esc(x)}" ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('')}<option value="__other">＋ Other (specify)…</option></select><input class="other" data-other="${p}" data-list="${listKey}" placeholder="Type new value – saved for next time" hidden>`;
  };
  const calibStatus = (kind, v) => v == null ? '' : kind === 'resin' ? (v >= 1.8 && v <= 2 ? 'ok' : 'bad') : (v >= 18 && v <= 21 ? 'ok' : 'bad');
  function mpValues() {
    const c = QI.mpCalc(ui.mp.plan), m = {}; m['mp.total'] = String(c.total);
    ui.mp.plan.items.forEach((it, i) => { m['mp.item.' + i] = String(c.perItem[i]); });
    m['mp.heats'] = c.heats.length ? c.heats.map((h) => `${esc(h.label)}: <b>${h.qty}</b>`).join(' · ') : '–';
    QI.MP_PLANTS.forEach((k) => { const r = c.resinPct[k], t = c.catPct[k]; m['mp.res.' + k] = r == null ? '–' : `<span class="rd-${calibStatus('resin', r)}">${r.toFixed(2)} %</span>`; m['mp.cat.' + k] = t == null ? '–' : `<span class="rd-${calibStatus('cat', t)}">${t.toFixed(1)} %</span>`; });
    return m;
  }
  function mpUpdate() { if (!ui.mp) return; const m = mpValues(); document.querySelectorAll('#mp [data-c]').forEach((el) => { if (m[el.dataset.c] != null) el.innerHTML = m[el.dataset.c]; }); const d = $('#mp-dirty'); if (d) d.hidden = !ui.mp.dirty; }
  V.mould = () => {
    const L = S().mouldPlans.slice().sort((x, y) => y.date.localeCompare(x.date));
    return `<div class="hd"><h2>Moulding log <small>Daily plan &amp; calibration</small></h2><button class="btn primary" data-act="mp-new">+ New moulding plan</button></div>
    ${L.length ? table(['Date', 'Items', 'Moulds planned', 'Heats', 'Calibration', ''], L.map((p) => { const c = QI.mpCalc(p); const cal = QI.MP_CALIB.slice(0, 3).some(([k]) => QI.MP_PLANTS.some((q) => p.calib[k] && p.calib[k][q] !== '' && p.calib[k][q] != null));
      return `<tr><td><b>${esc(p.date)}</b></td><td>${p.items.length}</td><td>${c.total}</td><td class="sm">${c.heats.map((h) => esc(h.label) + ' ' + h.qty).join(' · ')}</td><td>${cal ? badge('recorded', 'ok') : badge('–', 'mute')}</td><td><button class="btn sm ghost" data-act="mp-open" data-date="${esc(p.date)}">Open</button></td></tr>`; })) : empty('No moulding plans yet. Tap “New moulding plan” to record the day’s items, heat-wise quantities and calibration.')}`;
  };
  V.mouldplan = (date) => {
    if (!ui.mp || ui.mp.plan.date !== date) mpLoad(date);
    const p = ui.mp.plan, d = QI.mpStore(), saved = !!p.ts;
    const heats = S().heats.map((h) => h.no);
    return `<div id="mp"><div class="hd"><div><h2>Moulding Daily Plan</h2><div class="muted sm">${saved ? `Saved by ${esc(p.by)}, ${fdt(p.ts)}` : 'Not saved yet'}</div></div>
      <div class="row"><button class="btn primary" data-act="mp-save">Save plan</button><button class="btn" data-act="mp-post">Post calibration…</button><button class="btn" data-act="mp-dl">Download sheet</button></div></div>
    <div class="banner warn" id="mp-dirty" ${ui.mp.dirty ? '' : 'hidden'}>Unsaved changes – tap <b>Save plan</b>.</div>
    <section class="card"><h3>Date</h3><div class="grid3">${mlLbl('Date', mpIn('date', { type: 'date', extra: saved ? 'readonly' : '' }))}${mlLbl('Moulds planned (total)', '<div class="calc" data-c="mp.total"></div>')}${mlLbl('Heat-wise total', '<div class="calc sm" data-c="mp.heats"></div>')}</div></section>
    ${p.items.map((it, i) => `<section class="card"><div class="hd"><h3>Item ${i + 1} <span class="muted sm">· moulds: <b data-c="mp.item.${i}"></b></span></h3><button class="btn sm ghost" data-act="mp-delitem" data-i="${i}">Remove item</button></div>
      ${mlLbl('Item name', mpSel(`items.${i}.item`, 'mlProduct', []))}
      <div class="tw"><table class="cmt"><thead><tr><th>H/T No.</th><th>Qty</th><th>Furnace log</th><th></th></tr></thead><tbody>
        ${it.lines.map((l, j) => { const pr = l.heat && it.item ? QI.mpPoured(l.heat, it.item) : null; return `<tr><td>${mpSel(`items.${i}.lines.${j}.heat`, 'mpHeat', [], heats)}</td><td>${mpIn(`items.${i}.lines.${j}.qty`)}</td><td>${pr == null ? '<span class="muted sm">no log</span>' : badge('poured ' + pr, pr >= n0(l.qty) && n0(l.qty) > 0 ? 'ok' : 'warn')}</td><td><button class="x" data-act="mp-delline" data-i="${i}" data-j="${j}" title="Remove">×</button></td></tr>`; }).join('')}</tbody></table></div>
      <button class="btn sm ghost" data-act="mp-addline" data-i="${i}">+ Add heat line</button></section>`).join('')}
    <button class="btn" data-act="mp-additem">+ Add item</button>
    <section class="card pad"><h3>Calibration</h3><div class="muted sm pad">Readings per plant P1–P3. Resin and catalyst are checked as % (resin ÷ sand weight, catalyst ÷ resin) against the plan limits 1.8–2 % and 18–21 %.</div>
      <div class="tw"><table class="cmt"><thead><tr><th></th>${QI.MP_PLANTS.map((k) => `<th>${k.toUpperCase()}</th>`).join('')}</tr></thead><tbody>
        ${QI.MP_CALIB.map(([k, t]) => `<tr><th>${t}</th>${QI.MP_PLANTS.map((q) => `<td>${mpIn(`calib.${k}.${q}`)}</td>`).join('')}</tr>`).join('')}
        <tr class="tot"><th>Resin % of sand wt</th>${QI.MP_PLANTS.map((q) => `<td><span class="calc" data-c="mp.res.${q}"></span></td>`).join('')}</tr>
        <tr class="tot"><th>Catalyst % of resin wt</th>${QI.MP_PLANTS.map((q) => `<td><span class="calc" data-c="mp.cat.${q}"></span></td>`).join('')}</tr></tbody></table></div>
      <div class="grid2 pad"><label class="f"><span>Resin density (kg/l) – confirm from data sheet</span><input data-g="densResin" type="number" step="any" value="${esc(d.densResin)}"></label><label class="f"><span>Catalyst density (kg/l) – confirm from data sheet</span><input data-g="densCat" type="number" step="any" value="${esc(d.densCat)}"></label></div></section>
    <section class="card"><h3>Remarks</h3><textarea data-p="remarks" rows="3">${esc(p.remarks)}</textarea></section></div>`;
  };
  function mpSheetHtml(p) {
    const c = QI.mpCalc(p), td = (v) => `<td>${esc(v == null ? '' : v)}</td>`;
    return `<h2>Molding Daily Plan – ${esc(p.date)}</h2><table><tr><th>Item name</th><th>H/T No, Qty</th></tr>${p.items.map((it) => `<tr>${td(it.item)}<td>${it.lines.filter((l) => l.heat || l.qty).map((l) => esc(l.heat) + '-' + esc(l.qty)).join(' &nbsp; ')}</td></tr>`).join('')}</table>
    <p>Total moulds: <b>${c.total}</b> &nbsp; ${c.heats.map((h) => esc(h.label) + ': ' + h.qty).join(' · ')}</p>
    <table><tr><th>Calibration</th><th>P1</th><th>P2</th><th>P3</th></tr>${QI.MP_CALIB.map(([k, t]) => `<tr><th>${t}</th>${QI.MP_PLANTS.map((q) => td(p.calib[k][q])).join('')}</tr>`).join('')}<tr><th>Resin % of sand</th>${QI.MP_PLANTS.map((q) => td(c.resinPct[q] == null ? '' : c.resinPct[q].toFixed(2))).join('')}</tr><tr><th>Catalyst % of resin</th>${QI.MP_PLANTS.map((q) => td(c.catPct[q] == null ? '' : c.catPct[q].toFixed(1))).join('')}</tr></table><p>${esc(p.remarks)}</p>`;
  }
  const MOULD_ACTS = {
    'mp-new': () => { const last = S().mouldPlans.slice().sort((x, y) => y.date.localeCompare(x.date))[0]; modal('New moulding plan', `${fld('Date', 'date', today(), 'type="date" required')}${last ? `<label class="chip"><input type="checkbox" name="copy"> Copy items from the last plan (${esc(last.date)})</label>` : ''}`, (f) => {
      const date = val(f, 'date'); if (!date) return 'Choose the date.'; if (QI.mouldPlan(date)) { mpLoad(date); go('mouldplan/' + date); return; }
      ui.mp = { plan: QI.mpNew(date, f.elements.copy && f.elements.copy.checked ? last : null), dirty: true }; go('mouldplan/' + date); }, 'Open plan'); },
    'mp-open': (el) => { mpLoad(el.dataset.date); go('mouldplan/' + el.dataset.date); },
    'mp-save': () => { if (needInspector()) return; const r = QI.mpSave(ui.mp.plan); if (r.error) { toast(r.error, 'bad'); return; } ui.mp.dirty = false; mpLoad(ui.mp.plan.date); render(); toast('Moulding plan saved', 'ok'); },
    'mp-addline': (el) => { ui.mp.plan.items[+el.dataset.i].lines.push({ heat: '', qty: '' }); ui.mp.dirty = true; render(); },
    'mp-delline': (el) => { const ls = ui.mp.plan.items[+el.dataset.i].lines; if (ls.length > 1) ls.splice(+el.dataset.j, 1); else ls[0] = { heat: '', qty: '' }; ui.mp.dirty = true; render(); },
    'mp-additem': () => { ui.mp.plan.items.push({ item: '', lines: [{ heat: '', qty: '' }] }); ui.mp.dirty = true; render(); },
    'mp-delitem': (el) => { ui.mp.plan.items.splice(+el.dataset.i, 1); if (!ui.mp.plan.items.length) ui.mp.plan.items.push({ item: '', lines: [{ heat: '', qty: '' }] }); ui.mp.dirty = true; render(); },
    'mp-dl': () => download(`moulding-plan-${ui.mp.plan.date}.html`, `<!doctype html><meta charset="utf-8"><title>Molding Daily Plan ${esc(ui.mp.plan.date)}</title><style>body{font:13px system-ui;margin:14px}table{border-collapse:collapse;margin-bottom:10px}th,td{border:1px solid #888;padding:3px 8px;text-align:left}th{background:#eee}</style>${mpSheetHtml(ui.mp.plan)}`, 'text/html'),
    'mp-post': () => {
      if (needInspector()) return; if (ui.mp.dirty || !ui.mp.plan.ts) { toast('Save the plan first.', 'bad'); return; }
      const p = ui.mp.plan, items = QI.mpPreview(p);
      if (!items.length) { toast('Enter calibration readings first.', 'bad'); return; }
      modal('Post calibration to the sand & calibration log', `${sel('Shift', 'shift', ['A', 'B', 'C'], 'A')}<p class="muted sm">Recorded against the sand log of ${esc(p.date)} (stage 2). P3 sand and water have no check in the plan and are not posted.</p>
        ${items.map((it) => `<div class="li"><b>${it.id}</b> ${esc(it.label)} – ${it.plant}: ${it.ev.error ? esc(it.ev.error) : `${it.ev.result === 'ok' ? badge('OK', 'ok') : badge('Not OK', 'bad')} ${esc(it.ev.summary)}`}
          ${!it.ev.error && it.ev.result === 'nok' ? `<label class="f"><span>If Not OK – action</span><select name="act_${it.id}${it.plant}">${it.actions.map((x) => `<option>${esc(x)}</option>`).join('')}</select></label>` : ''}</div>`).join('')}`,
        (f) => { const acts = {}; items.forEach((it) => { const e = f.elements['act_' + it.id + it.plant]; if (e) acts[it.id + it.plant] = e.value; });
          const r = QI.mpPost(p, val(f, 'shift'), acts); if (r.error) return r.error; const bad = r.res.filter((x) => x.error); if (!r.res.length || bad.length === r.res.length) return (bad[0] && bad[0].error) || 'Nothing to post.';
          toast(`Posted ${r.res.length - bad.length} calibration check(s) to ${r.logId}${r.res.some((x) => x.ncr) ? ' · NCR raised' : ''}`, r.res.some((x) => x.result === 'nok') ? 'bad' : 'ok'); }, 'Post');
    },
  };
  document.addEventListener('input', (e) => {
    const t = e.target; if (!t.closest || !t.closest('#mp') || !ui.mp) return;
    if (t.dataset.g) { const d = QI.mpStore(); d[t.dataset.g] = parseFloat(t.value) || 0; QI.save(); mpUpdate(); return; }
    if (t.dataset.other) { setPath(ui.mp.plan, t.dataset.other, t.value); ui.mp.dirty = true; return; }
    if (!t.dataset.p || t.tagName === 'SELECT') return;
    setPath(ui.mp.plan, t.dataset.p, t.type === 'number' ? (t.value === '' ? '' : parseFloat(t.value)) : t.value); ui.mp.dirty = true; mpUpdate();
  });
  document.addEventListener('change', (e) => {
    const t = e.target; if (!t.closest || !t.closest('#mp') || !ui.mp) return;
    if (t.dataset.other) { QI.learn(t.dataset.list, t.value.trim()); ui.mp.dirty = true; render(); return; }
    if (t.classList.contains('mpsel')) {
      const o = t.parentNode.querySelector('input[data-other]');
      if (t.value === '__other') { o.hidden = false; o.focus(); return; }
      setPath(ui.mp.plan, t.dataset.p, t.value); ui.mp.dirty = true; render();
    }
  });

  /* ---- approvals queue ---- */
  V.approvals = () => {
    const list = QI.pending();
    const order = { qc: 0, head: 1, review: 2 };
    list.sort((x, y) => order[x.status] - order[y.status] || x.stageNo - y.stageNo);
    const mineRole = (p) => p.status === 'review' ? QI.can('record', p.stageNo) : QI.can('approve', p.status);
    return `<div class="hd"><h2>Approvals</h2></div><p class="muted">Every stage is signed three times: <b>Inspector → QC Manager → Factory Head</b>. The next stage opens only after the Factory Head approves.</p>
    ${list.length ? table(['Stage', 'Record', 'Castings', 'Waiting for', ''], list.map((p) => `<tr><td>${p.stageNo} · ${esc(QI.stageOf[p.stageNo].name)}</td><td>${esc(SCOPE_LABEL[p.scope])} <b>${esc(p.owner)}</b></td><td>${p.castings.slice(0, 3).map((c) => link('/casting/' + c, c)).join(', ')}${p.castings.length > 3 ? ' +' + (p.castings.length - 3) : ''}</td><td>${stBadge(p.status)}</td><td>${mineRole(p) ? `<a class="btn sm primary" href="#/casting/${esc(p.castings[0])}">Open →</a>` : ''}</td></tr>`)) : empty('Nothing is waiting for sign-off or approval.')}`;
  };

  /* ---- NCR ---- */
  V.ncr = () => {
    const f = ui.filter.ncr;
    const list = S().ncrs.filter((n) => f === 'all' || n.status === f).slice().reverse();
    return `<div class="hd"><h2>Non-conformance register</h2><div class="seg">${['open', 'closed', 'all'].map((x) => `<button class="${f === x ? 'on' : ''}" data-act="ncr-filter" data-f="${x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join('')}</div></div>
    ${list.length ? table(['NCR', 'Date', 'Stage / check', 'Found', 'Action / disposal', 'Affects', 'Status', ''], list.map((n) => `<tr><td><b>${n.id}</b></td><td>${fdt(n.ts)}<div class="muted sm">${esc(n.by)}</div></td><td>${n.stageNo || ''} ${esc(n.checkId || '')}<div class="muted sm">${esc(n.param)}</div></td><td>${esc(n.found)}</td><td>${esc(n.action)} ${badge(n.cls === 'reject' ? 'reject' : 'rework', n.cls === 'reject' ? 'bad' : 'warn')}</td>
      <td>${esc(SCOPE_LABEL[n.scope])} ${esc(n.owner)}<div class="sm">${n.castings.slice(0, 4).map((c) => link('/casting/' + c, c)).join(', ')}${n.castings.length > 4 ? ' …' : ''}</div></td><td>${n.status === 'open' ? badge('Open', 'warn') : badge('Closed', 'ok')}<div class="muted sm">${esc(n.closeNote || '')}</div></td>
      <td>${n.status === 'open' ? `<button class="btn sm" data-act="ncr-close" data-id="${n.id}">Close…</button>` : ''}</td></tr>`)) : empty('No NCRs in this view.')}`;
  };

  /* ---- plan ---- */
  V.plan = () => {
    const q = ui.filter.plan.toLowerCase();
    return `<div class="hd"><h2>Inspection plan</h2><input class="search" placeholder="Filter by step, parameter, method…" value="${esc(ui.filter.plan)}" data-act="filter-plan"></div>
    <p class="muted">Imported from <i>INS_Inspection_Flow.xlsx</i>. Numeric limits and the “to be confirmed” items can be edited here; edits apply to all new inspections. “If Not OK” actions drive the NCR disposition.</p>
    ${QI.stages.map((st) => {
      const rows = [];
      st.groups.forEach((g) => g.steps.forEach((sp) => sp.checks.forEach((c0) => {
        const c = QI.eff(c0.id);
        const hay = `${sp.id} ${sp.name} ${c.param} ${c.method} ${c.criteria}`.toLowerCase();
        if (q && !hay.includes(q)) return;
        rows.push(`<tr><td><b>${c.id}</b></td><td>${esc(sp.name)}</td><td>${esc(c.sample)}</td><td>${esc(c.param)}</td><td>${esc(c.method)}</td><td>${esc(critText(c))} ${c.tbc ? badge('TBC', 'warn') : ''}${c.assumed && !c.tbc ? badge('assumed', 'warn') : ''}${S().settings.overrides[c.id] ? badge('edited', 'info') : ''}</td><td>${esc((c.actions || []).join(' / '))}</td><td><button class="btn sm ghost" data-act="edit-check" data-id="${c.id}">Edit</button></td></tr>`);
      })));
      return rows.length ? `<section class="card"><h3>Stage ${st.no} · ${esc(st.name)} <small class="muted">recorded per ${SCOPE_LABEL[st.scope].toLowerCase()}</small></h3>${table(['Check', 'Step', 'Sample / frequency', 'Parameter', 'Method / equipment', 'Acceptance', 'If Not OK', ''], rows)}</section>` : '';
    }).join('')}`;
  };

  /* ---- settings ---- */
  V.settings = () => `<h2>Settings & data</h2>
    ${QI.mode === 'shared' ? `<section class="card"><h3>Departments using this app</h3>${Object.values(QI.people).length ? table(['Name', 'Department'], Object.values(QI.people).map((p) => `<tr><td>${esc(p.name)}</td><td>${esc((QI.DEPTS.find((d) => d.id === p.dept) || {}).name || '')}</td></tr>`)) : '<div class="muted">Nobody has chosen a department yet.</div>'}</section>` : ''}<section class="card"><h3>Inspector</h3><div class="row"><b>${esc(S().settings.inspector || 'not set')}</b><button class="btn" data-act="change-insp">Change / add inspector</button></div><div class="muted sm">Your name is stamped on every result you record. On a shared phone, switch inspector here.</div></section>
    <section class="card"><h3>Customers & casting items</h3><div class="muted sm pad">The item dropdown on a new work order shows the items listed here for the chosen customer.</div>
      ${QI.opts('customer').map((c) => { const it = QI.opts('part:' + c); return `<div class="li"><b>${esc(c)}</b> <span class="muted sm">${it.length ? esc(it.join(' · ')) : 'no items yet'}</span> <button class="btn sm" data-act="edit-items" data-c="${esc(c)}">Edit items</button></div>`; }).join('')}
      <div class="pad"><button class="btn sm primary" data-act="add-customer">+ Add customer</button></div></section>
    <section class="card"><h3>Dropdown lists</h3><div class="muted sm pad">Values typed under “Other (specify)…” are added to the dropdowns automatically. Tap × to remove a wrong entry.</div>${listsHtml()}</section>
    <section class="card"><h3>Data</h3><div class="muted sm pad">Data is stored in this browser (works offline). ${QI.persistent ? '' : '<b class="badT">Browser storage is unavailable – export your data before closing!</b>'} Export a backup regularly, and import it to move data to another device.</div>
      <div class="row"><button class="btn" data-act="export-json">Backup (JSON)</button><label class="btn">Restore backup<input type="file" accept="application/json" hidden data-act="import-json"></label><button class="btn" data-act="export-csv">Export all results (CSV)</button></div></section>
    <section class="card"><h3>Demo</h3><div class="row"><button class="btn" data-act="demo">Load demo data</button><button class="btn danger" data-act="wipe">Erase everything</button></div></section>`;

  const LIST_NAMES = { signNote: 'Sign-off remarks', returnReason: 'Return / reopen reasons', inspector: 'Inspectors', customer: 'Customers', part: 'Parts', grade: 'Material grades', furnace: 'Furnaces', remarks: 'Inspection remarks', rejectReason: 'Rejection reasons', closeNote: 'NCR closure notes', releaseRemarks: 'Release remarks' };
  function listsHtml() {
    const L = S().settings.lists || {};
    const keys = Object.keys(L).filter((k) => L[k].length);
    if (!keys.length) return '<div class="muted">Nothing added yet.</div>';
    return keys.map((k) => `<div class="lbl pad">${esc(LIST_NAMES[k] || (k.startsWith('part:') ? 'Items – ' + k.slice(5) : k.startsWith('action:') ? 'Actions for check ' + k.slice(7) : k))}</div><div class="chips">${L[k].map((v) => `<span class="chip">${esc(v)} <button class="x" data-act="unlearn" data-list="${esc(k)}" data-v="${esc(v)}" aria-label="Remove">×</button></span>`).join('')}</div>`).join('');
  }

  /* ---- report ---- */
  V.report = (id) => {
    const c = QI.casting(id); if (!c) return empty('Casting not found.');
    const j = QI.job(c.jobNo) || {}; const h = c.heatNo ? QI.heat(c.heatNo) : null;
    const t = QI.castingStages(c);
    const s = QI.castingState(c);
    const rows = [];
    t.stages.forEach((x) => {
      const done = x.items.filter((i) => i.owner);
      if (!done.length) { return; }
      const ap = x.approval && x.approval.steps || {};
      rows.push(`<tr class="rs"><td colspan="7">Stage ${x.stage.no} · ${esc(x.stage.name)}<div class="sm">Inspector: ${ap.inspector ? esc(ap.inspector.by) + ', ' + fd(ap.inspector.ts) : '–'} · QC Manager: ${ap.qc ? esc(ap.qc.by) + ', ' + fd(ap.qc.ts) : '–'} · Factory Head: ${ap.head ? esc(ap.head.by) + ', ' + fd(ap.head.ts) : '–'}</div></td></tr>`);
      x.items.forEach((i) => {
        const a = i.owner ? QI.last(i.scope, i.owner, i.check.id) : null;
        const ch = QI.eff(i.check.id);
        rows.push(`<tr><td>${ch.id}</td><td>${esc(ch.param)}<div class="sm">${esc(QI.steps[ch.step].name)}</div></td><td>${esc(critText(ch))}</td><td>${a ? esc(a.summary) + (a.detail ? `<div class="sm">${esc(a.detail)}</div>` : '') : ''}</td>
          <td>${a ? (a.result === 'ok' ? 'OK' : 'NOT OK') : i.required ? 'Pending' : '–'}</td><td>${a ? esc(a.by) + '<div class="sm">' + fdt(a.ts) + '</div>' : ''}</td><td>${a ? esc(a.ref) : ''}</td></tr>`);
      });
    });
    const ncrs = S().ncrs.filter((n) => n.castings.includes(c.id));
    return `<div class="noprint hd"><a class="btn" href="#/casting/${esc(c.id)}">← Back</a>${HOSTED ? '<button class="btn primary" data-act="report-dl" data-id="' + esc(c.id) + '">Download report</button>' : '<button class="btn primary" onclick="window.print()">Print / Save as PDF</button>'}</div>
    <article class="report"><header><div><h1>${esc(QI.plan.company)}</h1><div>Casting Inspection Report</div></div><div class="rs-r"><b>${esc(c.id)}</b><div>${esc(s.label)}</div></div></header>
      <table class="kv"><tr><th>Work order</th><td>${esc(j.no)}</td><th>Customer / PO</th><td>${esc(j.customer)} / ${esc(j.po)}</td></tr>
      <tr><th>Part</th><td>${esc(j.part)}</td><th>Drawing / Pattern</th><td>${esc(j.drawing)} / ${esc(j.pattern)}</td></tr>
      <tr><th>Material grade</th><td>${esc(j.grade)}</td><th>Heat no.</th><td>${esc(c.heatNo || '–')}${h ? ' (' + esc(h.date) + ')' : ''}</td></tr>
      <tr><th>Sand log</th><td>${c.logId ? esc(c.logId) : '–'}</td><th>Report date</th><td>${fd(Date.now())}</td></tr></table>
      <table class="rt"><thead><tr><th>Check</th><th>Parameter</th><th>Acceptance</th><th>Result / reading</th><th>Status</th><th>Inspected by</th><th>Ref</th></tr></thead><tbody>${rows.join('')}</tbody></table>
      ${ncrs.length ? `<h4>Non-conformances</h4><table class="rt"><tr><th>NCR</th><th>Check</th><th>Found</th><th>Action</th><th>Status</th></tr>${ncrs.map((n) => `<tr><td>${n.id}</td><td>${esc(n.param)}</td><td>${esc(n.found)}</td><td>${esc(n.action)}</td><td>${esc(n.status)} ${esc(n.closeNote || '')}</td></tr>`).join('')}</table>` : ''}
      ${c.status === 'released' ? `<p><b>Released for dispatch</b> by ${esc(c.release.by)} on ${fdt(c.release.ts)}. ${esc(c.release.remarks)}</p>` : c.status === 'rejected' ? `<p><b>REJECTED:</b> ${esc(c.reject.reason)} (${esc(c.reject.action)})</p>` : '<p><b>Not yet released.</b></p>'}
      <div class="sig"><div>Prepared By<br><br>Name / Sign / Date: ____________</div><div>Issued By<br><br>Name / Sign / Date: ____________</div><div>Approved By<br><br>Name / Sign / Date: ____________</div></div></article>`;
  };

  /* ================= actions ================= */
  const toast = (msg, cls) => { const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (cls || ''); clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 3500); };
  const jobForm = (j) => {
    j = j || {};
    return `<div class="grid2">${fld('Work order no.', 'no', j.no, j.no ? 'readonly' : 'required')}${combo('Customer', 'customer', 'customer', j.customer)}${fld('PO / order no.', 'po', j.po)}${fld('Order qty', 'qty', j.qty, 'type="number" min="1"')}
      ${combo('Item / part', 'part', 'part:' + (j.customer || ''), j.part, [], { group: 'Castings' })}${fld('Drawing no.', 'drawing', j.drawing)}${fld('Pattern no.', 'pattern', j.pattern)}${combo('Material grade', 'grade', 'grade', j.grade)}</div>
      ${ta('Drawing dimensions (optional – pre-fills dimension checks)', 'dims', j.dims, 'One per line: <i>feature, nominal, −tol, +tol</i> e.g. <i>Bore Ø, 100, 0.5, 0.5</i>')}`;
  };
  const readJob = (f) => { const customer = cval(f, 'customer', 'customer'); return ({ no: val(f, 'no'), customer, po: val(f, 'po'), qty: val(f, 'qty'), part: cval(f, 'part', 'part:' + customer), drawing: val(f, 'drawing'), pattern: val(f, 'pattern'), grade: cval(f, 'grade', 'grade'), dims: val(f, 'dims') }); };
  const heatForm = (h) => {
    h = h || {};
    return `<div class="grid2">${fld('Heat no.', 'no', h.no, h.created ? 'readonly' : 'required')}${fld('Date', 'date', h.date || today(), 'type="date"')}${combo('Furnace', 'furnace', 'furnace', h.furnace)}${combo('Grade', 'grade', 'grade', h.grade)}
      ${fld('Tapping temp min (°C)', 'tapMin', h.tapMin, 'type="number"')}${fld('Tapping temp max (°C)', 'tapMax', h.tapMax, 'type="number"')}${fld('Pouring temp min (°C)', 'pourMin', h.pourMin, 'type="number"')}${fld('Pouring temp max (°C)', 'pourMax', h.pourMax, 'type="number"')}</div>
      <small class="muted">Temperature limits come from the method plan DCL/MTD/01.</small>`;
  };
  const specText = (rows) => rows.map((r) => [r.name, r.min, r.max].join(', ').replace(/(, )+$/, '')).join('\n');
  const parseSpec = (t) => t.split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((p) => p[0]).map((p) => ({ name: p[0], min: p[1] || '', max: p[2] || '' }));

  const ACT = {
    toggle: (el) => { const k = el.dataset.key; ui.open[k] = !ui.open[k]; render(); },
    'save-check': (el) => saveCheck(el.dataset.key),
    'stage-toggle': (el) => { const k = el.dataset.k; const cur = ui.stageOpen[k]; const sec = el.closest('.stage'); const isOpen = !!$('.sb', sec); ui.stageOpen[k] = !isOpen; render(); },
    'dim-add': (el) => { el.parentNode.querySelector('tbody').insertAdjacentHTML('beforeend', dimRow({})); },
    'dim-del': (el) => { const tb = el.closest('tbody'); if (tb.rows.length > 1) el.closest('tr').remove(); liveEval(el.closest('form')); },
    'report-dl': (el) => { const r = $('.report'); download(`inspection-report-${el.dataset.id}.html`, `<!doctype html><meta charset="utf-8"><title>Inspection report ${el.dataset.id}</title><style>body{font:13px system-ui;margin:16px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th,td{border:1px solid #999;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eee}.sm{font-size:11px}.rs td{background:#d9ead3;font-weight:700}header{display:flex;justify-content:space-between;border-bottom:2px solid #000;margin-bottom:8px}.sig{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:40px}.sig div{border-top:1px solid #000}</style>${r.outerHTML}`, 'text/html'); },
    sign: (el) => {
      if (needInspector()) return; const d = el.dataset; const role = d.role;
      const title = role === 'review' ? 'Inspector sign-off' : role === 'qc' ? 'QC Manager approval' : 'Factory Head approval';
      modal(`${title} – stage ${d.no}`, `<p>${role === 'review' ? 'Confirms every check in this stage has been inspected and recorded. The checks lock after sign-off.' : 'Confirms you have reviewed this stage’s results.'}</p>${fld('Signing as', 'by', S().settings.inspector, QI.mode === 'shared' ? 'readonly' : '')}${combo('Remarks (optional)', 'note', 'signNote', '', [], { blank: '– none –' })}`,
        (f) => { const r = QI.signoff(d.scope, d.owner, +d.no, role, val(f, 'by'), cval(f, 'note', 'signNote'), d.job || null); if (r.error) return r.error; toast(r.done ? 'Stage fully approved' : 'Signed – passed to the next approver', 'ok'); }, role === 'review' ? 'Sign off' : 'Approve');
    },
    'return-stage': (el) => { if (needInspector()) return; const d = el.dataset; modal(`Return stage ${d.no} for rework`, `${combo('Reason', 'reason', 'returnReason', '', ['Re-measure and re-record', 'Reading doubtful – repeat the test', 'Records or reference numbers missing', 'Defect to be corrected first'])}<small class="muted">All sign-offs on this stage are cleared; the inspector re-records and signs again.</small>`, (f) => { const rs = cval(f, 'reason', 'returnReason'); if (!rs) return 'Choose or enter a reason.'; const r = QI.returnStage(d.scope, d.owner, +d.no, rs, d.job || null); if (r.error) return r.error; }, 'Return stage'); },
    'reopen-stage': (el) => { const d = el.dataset; modal(`Reopen stage ${d.no}`, `${combo('Reason', 'reason', 'returnReason', '', ['Re-measure and re-record', 'Reading doubtful – repeat the test', 'Customer / PO change'])}<small class="muted">Clears all three approvals so the checks can be re-recorded.</small>`, (f) => { const rs = cval(f, 'reason', 'returnReason'); if (!rs) return 'Choose or enter a reason.'; const r = QI.reopenStage(d.scope, d.owner, +d.no, rs); if (r.error) return r.error; }, 'Reopen'); },
    'edit-items': (el) => { const c = el.dataset.c; modal(`Casting items – ${c}`, ta('Items (one per line)', 'items', QI.opts('part:' + c).join('\n'), 'e.g. Knuckle, Main Body, …', 10), (f) => { const L = S().settings.lists || (S().settings.lists = {}); L['part:' + c] = [...new Set(val(f, 'items').split('\n').map((x) => x.trim()).filter(Boolean))]; QI.save(); }); },
    'add-customer': () => modal('Add customer', `${fld('Customer name', 'name', '', 'required')}${ta('Casting items (one per line)', 'items', '', '', 8)}`, (f) => { const n = val(f, 'name'); if (!n) return 'Enter the customer name.'; QI.learn('customer', n); const L = S().settings.lists; L['part:' + n] = [...new Set(val(f, 'items').split('\n').map((x) => x.trim()).filter(Boolean))]; QI.save(); }),
    'modal-cancel': () => $('#dlg').close(),
    'filter-castings': (el) => { ui.filter.castings = el.value; render(); const i = $('.search'); i.focus(); i.setSelectionRange(99, 99); },
    'filter-plan': (el) => { ui.filter.plan = el.value; render(); const i = $('.search'); i.focus(); i.setSelectionRange(99, 99); },
    'ncr-filter': (el) => { ui.filter.ncr = el.dataset.f; render(); },
    'change-insp': () => needInspector(true),
    unlearn: (el) => { QI.unlearn(el.dataset.list, el.dataset.v); render(); },
    'new-job': () => modal('New work order', jobForm(), (f) => { const r = QI.addJob(readJob(f)); if (r.error) return r.error; go('/job/' + val(f, 'no')); }),
    'edit-job': (el) => { const j = QI.job(el.dataset.no); modal('Edit work order ' + j.no, jobForm(j), (f) => { Object.assign(j, readJob(f)); QI.save(); }); },
    applic: (el) => { QI.job(el.dataset.no).applic[el.dataset.step] = el.checked; QI.save(); render(); },
    'add-castings': (el) => modal('Add castings', `${fld('How many castings?', 'n', 1, 'type="number" min="1" max="200"')}<small class="muted">Serial numbers are assigned automatically (${esc(el.dataset.no)}-001, -002 …).</small>`, (f) => { const n = parseInt(val(f, 'n'), 10); if (!(n > 0)) return 'Enter a quantity.'; const cs = QI.addCastings(el.dataset.no, n); toast(`${cs.length} casting(s) created`, 'ok'); }),
    'new-heat': (el) => modal('New heat', heatForm(), (f) => { const r = QI.addHeat({ no: val(f, 'no'), date: val(f, 'date'), furnace: cval(f, 'furnace', 'furnace'), grade: cval(f, 'grade', 'grade'), tapMin: val(f, 'tapMin'), tapMax: val(f, 'tapMax'), pourMin: val(f, 'pourMin'), pourMax: val(f, 'pourMax') }); if (r.error) return r.error; if (el.dataset.for) { QI.casting(el.dataset.for).heatNo = val(f, 'no'); QI.save(); } else go('/heat/' + val(f, 'no')); if (QI.can('spec')) setTimeout(() => ACT['heat-spec']({ dataset: { no: val(f, 'no') } }), 50); }),
    'edit-heat': (el) => { const h = QI.heat(el.dataset.no); modal('Edit heat ' + h.no, heatForm(h), (f) => { Object.assign(h, { date: val(f, 'date'), furnace: cval(f, 'furnace', 'furnace'), grade: cval(f, 'grade', 'grade'), tapMin: val(f, 'tapMin'), tapMax: val(f, 'tapMax'), pourMin: val(f, 'pourMin'), pourMax: val(f, 'pourMax') }); QI.save(); }); },
    'heat-spec': (el) => { const h = QI.heat(el.dataset.no); modal(`Specification – heat ${h.no}`, `${ta('Chemical composition (%) – checks 4.1 / 4.2', 'chem', specText(h.chemSpec), 'One per line: <i>element, min, max</i> — e.g. <i>C, 0.18, 0.25</i> · <i>Mn, 0.6, 1.0</i> · <i>S, , 0.035</i> (leave min or max blank for one-sided limits)', 8)}${ta('Mechanical properties – check 8.1', 'mech', specText(h.mechSpec), 'Same format, e.g. <i>UTS (MPa), 485, 655</i>. Remove lines you do not test.', 6)}`, (f) => { h.chemSpec = parseSpec(val(f, 'chem')); h.mechSpec = parseSpec(val(f, 'mech')); QI.save(); }); },
    'heat-add': (el) => { const id = $('#addc').value; QI.casting(id).heatNo = el.dataset.no; QI.save(); render(); },
    'set-heat': (el) => { QI.casting(el.dataset.id).heatNo = el.value || null; QI.save(); render(); },
    'set-log': (el) => { QI.casting(el.dataset.id).logId = el.value || null; QI.save(); render(); },
    'new-log': (el) => modal('New sand & calibration log', `${fld('Date', 'date', today(), 'type="date" required')}${sel('Shift', 'shift', ['A', 'B', 'C'], 'A')}`, (f) => { const r = QI.addLog(val(f, 'date'), val(f, 'shift')); if (r.error && !r.id) return r.error; if (el.dataset.for) { QI.casting(el.dataset.for).logId = r.id; QI.save(); } else go('/log/' + r.id); }),
    release: (el) => { if (needInspector()) return; const c = QI.casting(el.dataset.id); modal('Release casting ' + c.id, `<p>Confirms that all inspection stages are complete and the casting conforms.</p>${fld('Released by', 'by', S().settings.inspector)}${combo('Remarks', 'remarks', 'releaseRemarks', '', QI.DEFAULTS.releaseRemarks, { blank: '– none –' })}`, (f) => { const r = QI.release(c, val(f, 'by'), cval(f, 'remarks', 'releaseRemarks')); if (r.error) return r.error; toast('Casting released', 'ok'); }, 'Release'); },
    'reject-casting': (el) => { if (needInspector()) return; const c = QI.casting(el.dataset.id); modal('Reject casting ' + c.id, `${combo('Reason for rejection', 'reason', 'rejectReason', '', QI.DEFAULTS.rejectReason)}<small class="muted">The casting is stopped and goes back for melting. This cannot be undone.</small>`, (f) => { const rs = cval(f, 'reason', 'rejectReason'); if (!rs) return 'Choose or enter a reason.'; QI.manualReject(c, rs); }, 'Reject casting'); },
    'ncr-close': (el) => modal('Close ' + el.dataset.id, combo('Closure note (action taken / verification)', 'note', 'closeNote', '', QI.DEFAULTS.closeNote), (f) => { const n = cval(f, 'note', 'closeNote'); if (!n) return 'Choose or enter a closure note.'; QI.closeNcr(el.dataset.id, n); }, 'Close NCR'),
    'edit-check': (el) => {
      const c = QI.eff(el.dataset.id);
      const numeric = ['max', 'min', 'range'].includes(c.kind);
      modal(`Edit ${c.id} – ${c.param}`, `${numeric ? `<div class="grid2">${fld('Min', 'min', c.min == null ? '' : c.min, 'type="number" step="any"')}${fld('Max', 'max', c.max == null ? '' : c.max, 'type="number" step="any"')}</div>` : ''}${fld('Acceptance criteria text', 'criteria', c.criteria)}${fld('If Not OK actions (separate with “/”)', 'actions', (c.actions || []).join(' / '))}
        <label class="f"><span>Confirmation status</span><select name="tbc"><option value="1" ${c.tbc ? 'selected' : ''}>To be confirmed</option><option value="0" ${!c.tbc ? 'selected' : ''}>Confirmed</option></select></label>`, (f) => {
        const o = { criteria: val(f, 'criteria'), actions: val(f, 'actions').split('/').map((x) => x.trim()).filter(Boolean), tbc: val(f, 'tbc') === '1', assumed: false };
        if (numeric) { o.min = val(f, 'min') === '' ? undefined : parseFloat(val(f, 'min')); o.max = val(f, 'max') === '' ? undefined : parseFloat(val(f, 'max')); }
        if (!o.actions.length) o.actions = ['Other'];
        S().settings.overrides[c.id] = o; QI.save();
      });
    },
    'export-json': () => download(`dcl-quality-backup-${today()}.json`, JSON.stringify(S(), null, 1), 'application/json'),
    'export-csv': () => download(`dcl-inspection-results-${today()}.csv`, QI.csv(), 'text/csv'),
    'import-json': (el) => { const file = el.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { let obj; try { obj = JSON.parse(r.result); if (!obj || !Array.isArray(obj.jobs)) throw 0; } catch (e) { toast('Not a valid backup file.', 'bad'); return; } ask('Replace ALL current data' + (QI.mode === 'shared' ? ' (shared with every department)' : '') + ' with this backup?', () => { QI.replace(obj); toast('Backup restored', 'ok'); }, 'Replace data'); }; r.readAsText(file); },
    demo: () => ask('Add sample records (a work order, heat, sand log and four castings)?' + (QI.mode === 'shared' ? ' Everyone using the app will see them.' : ''), () => { demoData(); go('/dashboard'); toast('Demo data loaded', 'ok'); }, 'Add samples'),
    wipe: () => modal('Erase everything', `<p>This deletes every work order, casting, heat, log, result and NCR${QI.mode === 'shared' ? ' for ALL departments' : ''}. Download a backup first.</p>${fld('Type ERASE to confirm', 't', '')}`, (f) => { if (val(f, 't') !== 'ERASE') return 'Type ERASE to confirm.'; QI.reset(); go('/dashboard'); }, 'Erase all'),
  };
  Object.assign(ACT, CHARGE_ACTS, MELT_ACTS, MOULD_ACTS);
  function download(name, text, type) {
    if (DL) { DL.save({ filename: name, data: text }).then((r) => toast(r.status === 'saved' ? 'File saved' : 'File sent', 'ok')).catch((e) => { if (e && e.code !== 'cancelled' && e.code !== 'declined') toast('Could not save the file', 'bad'); }); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  document.addEventListener('click', (e) => {
    const ln = e.target.closest('a[href^="#/"]'); if (ln) { e.preventDefault(); go(ln.getAttribute('href')); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return;     // handled on change/input
    if (el.tagName === 'LABEL') return;
    const fn = ACT[el.dataset.act]; if (fn) { fn(el); }
  });
  document.addEventListener('change', (e) => {
    const sl = e.target;
    if (sl.matches && sl.matches('select[name=customer]') && sl.form && sl.form.elements.part) {
      const ps = sl.form.elements.part, cur = ps.value;
      const opts = sl.value && sl.value !== '__other' ? QI.opts('part:' + sl.value) : [];
      ps.innerHTML = `<option value="">– select –</option><optgroup label="Castings">${opts.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}</optgroup><option value="__other">＋ Other (specify)…</option>`;
      if (opts.includes(cur)) ps.value = cur;
      const po = sl.form.elements.part__o; if (po) po.hidden = true;
    }
    if (sl.matches && sl.matches('select[data-combo]')) {
      const o = sl.form.elements[sl.name + '__o']; o.hidden = sl.value !== '__other'; if (!o.hidden) o.focus();
      const w = sl.form.querySelector('.clsrow'); if (w && sl.name === 'action') w.hidden = sl.value !== '__other';
      if (sl.form.classList.contains('chkform')) liveEval(sl.form);
    }
    const el = e.target; if (!el.dataset || !el.dataset.act) return;
    if (['applic', 'set-heat', 'set-log', 'import-json'].includes(el.dataset.act)) ACT[el.dataset.act](el);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && (el.dataset.act === 'filter-castings' || el.dataset.act === 'filter-plan')) return ACT[el.dataset.act](el);
    const f = el.closest && el.closest('form.chkform'); if (f) liveEval(f);
  });

  /* ================= demo data ================= */
  function demoData() {
    const st = S();
    st.settings.inspector = st.settings.inspector || 'Demo Inspector';
    const suffix = String(Date.now()).slice(-4);
    const no = 'WO-' + suffix;
    QI.addJob({ no, customer: 'Sample Engineering Ltd', po: 'PO-' + suffix, qty: '6', part: 'Pump Casing', drawing: 'DWG-1042', pattern: 'PTN-77', grade: 'ASTM A216 WCB', dims: 'Bore Ø, 100, 0.5, 0.5\nFlange thickness, 25, 0.3, 0.3' });
    const j = QI.job(no); j.applic['7.1'] = true; j.applic['7.2'] = false; j.applic['7.3'] = false; j.applic['8.4'] = false;
    const ok = (scope, owner, id, input) => QI.record(scope, owner, id, Object.assign({ action: '' }, input));
    const ynOk = { result: 'ok' };
    ['1.1.1', '1.3.1', '1.4.1'].forEach((id) => ok('job', no, id, { rows: [{ name: 'Overall length', nominal: 450, tm: 1, tp: 1, actual: 450.4 }] }));
    ['1.2.1', '1.3.2'].forEach((id) => ok('job', no, id, ynOk));
    const log = QI.addLog(today(), 'A').id;
    const logVals = { '2.1.1': ynOk, '2.2.1': { value: 3.1 }, '2.2.2': { value: 0.6 }, '2.3.1': { value: 3.8 }, '2.3.2': { value: 0.7 }, '2.4.1': { value: 1.9 }, '2.5.1': { value: 19.5 }, '2.10.1': { value: 8.2 }, '2.10.2': { value: 4.1 }, '2.10.3': { value: 2.2 } };
    Object.keys(logVals).forEach((id) => ok('log', log, id, logVals[id]));
    ok('log', log, '2.3.3', { value: 2.8 });
    QI.addHeat({ no: 'H-' + suffix, date: today(), furnace: 'IF-1', grade: 'WCB', tapMin: '1620', tapMax: '1660', pourMin: '1560', pourMax: '1600' });
    const h = QI.heat('H-' + suffix);
    h.chemSpec = parseSpec('C, 0.18, 0.25\nSi, , 0.6\nMn, 0.6, 1.0\nP, , 0.035\nS, , 0.035');
    h.mechSpec = parseSpec('UTS (MPa), 485, 655\nYS (MPa), 250,\nElongation (%), 22,\nRA (%), 35,');
    const ch = { C: 0.21, Si: 0.45, Mn: 0.82, P: 0.02, S: 0.015 };
    ok('heat', h.no, '4.1.1', { vals: ch }); ok('heat', h.no, '4.2.1', { vals: ch });
    ok('heat', h.no, '4.3.1', { value: 1645, min: '1620', max: '1660' }); ok('heat', h.no, '4.4.1', { value: 1585, min: '1560', max: '1600' });
    const cs = QI.addCastings(no, 4);
    cs.forEach((c) => { c.logId = log; c.heatNo = h.no; });
    const casting = (c, ids) => ids.forEach((id) => {
      const ch0 = QI.checks[id];
      const inp = ch0.kind === 'dim' ? { rows: [{ name: 'Bore Ø', nominal: 100, tm: 0.5, tp: 0.5, actual: 100.1 }] } : ch0.kind === 'range' ? { value: (ch0.min + ch0.max) / 2 } : ch0.kind === 'min' ? { value: ch0.min + 5 } : ynOk;
      ok('casting', c.id, id, inp);
    });
    casting(cs[0], ['3.1.1', '3.1.2', '3.2.1', '3.3.1', '3.4.1', '5.1.1', '5.2.1', '5.2.2', '6.1.1', '7.1.1', '9.1.1', '10.1.1', '10.1.2', '10.2.1'].filter((x) => x !== '9.1.1'));
    casting(cs[1], ['3.1.1', '3.1.2', '3.3.1', '3.4.1', '5.1.1']);
    casting(cs[2], ['3.1.1']);
    QI.record('casting', cs[2].id, '3.1.2', { result: 'nok', action: 'Repainting' });
    ok('heat', h.no, '8.1.1', { vals: { 'UTS (MPa)': 520, 'YS (MPa)': 290, 'Elongation (%)': 26, 'RA (%)': 45 } });
    ok('heat', h.no, '8.2.1', ynOk); ok('heat', h.no, '8.3.1', { value: 165, min: '137', max: '207' });
    if (QI.mode === 'local') {
      const sg = (scope, owner, no, jobNo) => [['review', 'Demo Inspector'], ['qc', 'Demo QC Manager'], ['head', 'Demo Factory Head']].forEach(([r, n]) => QI.signoff(scope, owner, no, r, n, '', jobNo));
      sg('job', no, 1, no); sg('log', log, 2, no); sg('casting', cs[0].id, 3, no); sg('heat', h.no, 4, no);
    }
    QI.save();
  }

  /* ================= router ================= */
  const NAV = [['dashboard', 'Dashboard'], ['jobs', 'Work orders'], ['castings', 'Castings'], ['heats', 'Heats'], ['melt', 'Melting log'], ['mould', 'Moulding log'], ['charge', 'Charge mix'], ['logs', 'Sand & calibration'], ['approvals', 'Approvals'], ['ncr', 'NCRs'], ['plan', 'Inspection plan'], ['settings', 'Settings']];
  const PERM = { 'new-job': ['create', 'job'], 'edit-job': ['create', 'job'], applic: ['create', 'job'], 'add-castings': ['create', 'casting'], 'new-heat': ['create', 'heat'], 'edit-heat': ['create', 'heat'],
    'new-log': ['create', 'log'], 'heat-spec': ['spec'], 'heat-add': ['link', 'heat'], 'set-heat': ['link', 'heat'], 'set-log': ['link', 'log'], release: ['release'], 'reject-casting': ['reject'],
    'ncr-close': ['ncr'], 'mp-new': ['mould'], 'mp-save': ['mould'], 'mp-post': ['mould'], 'mp-addline': ['mould'], 'mp-delline': ['mould'], 'mp-additem': ['mould'], 'mp-delitem': ['mould'], 'ml-new': ['melt'], 'ml-save': ['melt'], 'ml-post': ['melt'], 'ml-sign': ['melt'], 'ml-addscrap': ['melt'], 'ml-addalloc': ['melt'], 'cm-save': ['charge'], 'cm-dup': ['charge'], 'cm-del': ['charge'], 'cm-toheat': ['charge'], 'cm-plan': ['charge'], 'edit-items': ['master'], 'add-customer': ['master'], 'edit-check': ['plan'], 'export-json': ['admin'], 'import-json': ['admin'], demo: ['admin'], wipe: ['admin'] };
  function applyPerms(root) {
    root.querySelectorAll('[data-act]').forEach((el) => {
      const p = PERM[el.dataset.act]; if (!p || QI.can(p[0], p[1])) return;
      if (el.tagName === 'SELECT' || el.tagName === 'INPUT' && el.type === 'checkbox') el.disabled = true;
      else if (el.tagName === 'INPUT') el.closest('label').remove();
      else el.remove();
    });
    if (QI.mode === 'shared' && QI.ready && !QI.me.canWrite) root.insertAdjacentHTML('afterbegin', '<div class="banner warn">You have view-only access. Ask the owner for Contributor access to record inspections.</div>');
    else if (QI.mode === 'shared' && QI.ready && !QI.me.dept) root.insertAdjacentHTML('afterbegin', '<div class="banner warn">Choose your department to start recording. <button class="btn sm" data-act="change-insp">Choose department</button></div>');
  }
  function render() {
    const parts = (route || 'dashboard').split('/');
    const view = parts[0]; const arg = decodeURIComponent(parts.slice(1).join('/'));
    const fn = booting || (QI.mode === 'shared' && !QI.ready) ? () => empty('Connecting to shared inspection data…') : (V[view] || V.dashboard);
    const open = $('#dlg').open;
    const active = view === 'mouldplan' ? 'mould' : view === 'meltlog' ? 'melt' : view === 'job' ? 'jobs' : view === 'casting' || view === 'report' ? 'castings' : view === 'heat' ? 'heats' : view === 'log' ? 'logs' : view;
    $('#nav').innerHTML = NAV.map(([k, t]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${t}</a>`).join('');
    $('#who').textContent = QI.mode === 'shared' ? (QI.me.dept ? `👤 ${QI.me.name || 'You'} · ${QI.dept().name.split(' ')[0]}` : 'Choose department') : (S().settings.inspector ? '👤 ' + S().settings.inspector : 'Set inspector');
    $('#back').hidden = !hist.length;
    $('#stale').hidden = true; ui.stale = false;
    const sy = $('#sync'); sy.textContent = QI.mode === 'shared' ? (QI.ready ? '● Shared · live' : '○ Connecting…') : (HOSTED ? '○ Local only (sign in to share)' : '○ This device only'); sy.className = 'sync ' + (QI.mode === 'shared' && QI.ready ? 'on' : '');
    const y = window.scrollY;
    $('#main').innerHTML = fn(arg);
    applyPerms($('#main'));
    if (view === 'charge' && ui.cm && ui.cm.r) cmUpdate();
    if (view === 'meltlog' && ui.ml) mlUpdate();
    if (view === 'mouldplan' && ui.mp) mpUpdate();
    document.body.classList.toggle('printing', view === 'report');
    if (!open) $('#main').dataset.view = view;
    window.scrollTo(0, y);
    document.title = 'DCL Quality Inspection';
  }
  $('#who').addEventListener('click', () => go('settings'));
  $('#back').addEventListener('click', () => { if (hist.length) { route = hist.pop(); window.scrollTo(0, 0); render(); } });
  $('#stale').addEventListener('click', () => render());
  QI.onChange = (first) => {
    if (first) { booting = false; render(); if (!QI.me.dept || !QI.me.name) profileModal(); return; }
    if ($('#dlg').open || $('form.chkform')) { ui.stale = true; $('#stale').hidden = false; } else render();
  };
  QI.onError = (e) => toast('Not saved: ' + ((e && e.code === 'not_writer') || (e && /permission|writer|denied/i.test(e.message || '')) ? 'you have view-only access.' : (e && e.message) || 'connection problem.'), 'bad');
  if (!HOSTED) QI.seed(); if (QI.seedCharge) QI.seedCharge(); if (QI.mlSeed) QI.mlSeed();
  render();
  if (HOSTED) {
    Promise.all([window.claude.use('db'), window.claude.use('user'), window.claude.use('downloads')]).then(([db, user, dl]) => {
      DL = dl;
      if (db) QI.attach(db, user).catch((e) => { booting = false; QI.mode = 'local'; QI.seed(); if (QI.seedCharge) QI.seedCharge(); if (QI.mlSeed) QI.mlSeed(); render(); QI.onError(e); }); else { booting = false; QI.seed(); if (QI.seedCharge) QI.seedCharge(); if (QI.mlSeed) QI.mlSeed(); render(); }
    }).catch(() => { booting = false; QI.seed(); if (QI.seedCharge) QI.seedCharge(); if (QI.mlSeed) QI.mlSeed(); render(); });
  }
  if (!QI.persistent) toast('Browser storage unavailable – data will not be saved. Use Settings → Backup.', 'bad');
  window.QIApp = { render, demoData };
})();
