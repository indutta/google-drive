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
  const ui = { mpl: null, rmx: null, rmf: null, mp: null, ml: null, cm: null, open: {}, stale: false, filter: { castings: '', ncr: 'open', plan: '' }, stageOpen: {} };
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
  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
  const stagePeople = (no, key) => uniq(QI.stageOf[no].groups.flatMap((g) => g.steps.flatMap((sp) => sp.checks.flatMap((c) => c[key] || []))));
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
      const asg = k === 'inspector' ? stagePeople(no, 'inspectors') : k === 'head' ? stagePeople(no, 'approvers') : [];
      return `<div class="ap ${s ? 'done' : cur === role ? 'now' : ''}"><div class="apl">${label}</div>${asg.length && !s ? `<div class="muted sm">Assigned: ${esc(asg.join(', '))}</div>` : ''}${s ? `<div><b>${esc(s.by)}</b></div><div class="muted sm">${fdt(s.ts)}${s.note ? ' · ' + esc(s.note) : ''}</div>`
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

  const GREET = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };
  const tile = (href, n, label, cls) => `<a class="tile ${cls || ''}" href="#/${href}"><b>${n}</b><span>${label}</span></a>`;
  const stageNowCount = (nos) => S().castings.filter((c) => { if (c.status !== 'active') return false; const x = QI.castingState(c); return x.stageNo && nos.includes(x.stageNo) && x.label.startsWith('Stage'); });

  const SECTIONS = () => { const out = []; QI.stages.forEach((st) => { let x = out.find((o) => o.name === st.section); if (!x) out.push(x = { name: st.section, stages: [] }); x.stages.push(st); }); return out; };
  const owners = (st) => st.scope === 'log' ? S().logs.slice().sort((a, b) => b.id.localeCompare(a.id)).map((l) => ({ id: l.id, label: `${l.date} · shift ${l.shift}`, href: '/log/' + l.id }))
    : st.scope === 'heat' ? S().heats.slice().reverse().map((h) => ({ id: h.no, label: 'Heat ' + h.no, href: '/heat/' + h.no }))
    : S().castings.filter((c) => c.status === 'active').slice().reverse().map((c) => ({ id: c.id, label: c.id, href: '/casting/' + c.id }));
  const ownerStatus = (st, id) => QI.ownerStage(st.no, st.scope, id, st.scope === 'casting' ? [QI.job((QI.casting(id) || {}).jobNo)].filter(Boolean) : QI.jobsOf(st.scope, id)).status;
  const pendingOf = (sec) => { let n = 0; sec.stages.forEach((st) => owners(st).forEach((o) => { const x = ownerStatus(st, o.id); if (x !== 'done' && x !== 'na') n++; })); return n; };
  V.dashboard = () => {
    const s = QI.stats(), st = S(), dp = QI.dept();
    const role = QI.mode === 'shared' && dp && dp.approver;
    const toApprove = role ? QI.pending().filter((p) => p.status === role) : [];
    const attention = st.castings.filter((c) => c.status === 'active' && QI.castingState(c).failing);
    const due = QI.due();
    const name = (QI.mode === 'shared' ? QI.me.name : st.settings.inspector) || '';
    const intro = st.jobs.length ? '' : `<div class="empty intro"><b>Welcome.</b><br>Start with <b>+ New entry → Work order</b>, add castings, then follow the flow: Moulding → Melting &amp; pouring → Fettling → Heat treatment → Mechanical tests → Finished casting.</div>`;
    const mine = QI.mode === 'shared' && dp && dp.stages.length && !dp.all ? SECTIONS().filter((x) => x.stages.some((t) => dp.stages.includes(t.no))) : [];
    return `<div class="hello"><div><h2>${GREET()}${name ? ', ' + esc(name.split(' ')[0]) : ''} 👋</h2><div class="muted">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div></div>${intro}
    ${toApprove.length ? `<section class="card"><h3>Waiting for your approval <span class="badge warn">${toApprove.length}</span></h3>${toApprove.slice(0, 8).map((p) => `<div class="li">${link('/casting/' + (p.castings ? p.castings[0] : ''), (p.castings || [''])[0])} <span class="muted sm">Stage ${p.stageNo}</span></div>`).join('')}<a class="btn sm" href="#/approvals">All approvals</a></section>` : ''}
    ${mine.length ? `<section class="card"><h3>Your department</h3>${mine.map((x) => `<div class="li"><a href="#/flow/${encodeURIComponent(x.name)}"><b>${esc(x.name)}</b></a><span class="badge ${pendingOf(x) ? 'warn' : 'ok'}">${pendingOf(x)} to do</span></div>`).join('')}</section>` : ''}
    <div class="tiles">${tile('castings', s.active, 'Castings in process')}${tile('approvals', s.awaiting, 'Awaiting approval', s.awaiting ? 'warn' : '')}${tile('ncr', s.openNcr, 'Open NCRs', s.openNcr ? 'warn' : 'ok')}${tile('castings', s.released, 'Released', 'ok')}</div>
    <section class="card"><h3>The flow <span class="muted sm">· still to do in each section</span></h3>${SECTIONS().map((x, i) => `<div class="li"><span>${i + 1}. <a href="#/flow/${encodeURIComponent(x.name)}">${esc(x.name)}</a></span><span class="badge ${pendingOf(x) ? 'warn' : 'ok'}">${pendingOf(x)}</span></div>`).join('')}</section>
    <section class="card"><h3>Needs attention</h3>${attention.length ? attention.map((c) => `<div class="li">${link('/casting/' + c.id, c.id)} ${stateBadge(c)}</div>`).join('') : '<div class="muted">No failed checks waiting ✔</div>'}${due.length ? `<div class="li sm"><span>${dot('nok')} ${due.length} calibration / test(s) due</span></div>` : ''}</section>`;
  };
  /* ---- the flow chart, section by section, with the records to enter in sequence ---- */
  /* ---- day-wise inspection data of a department (section): every recorded attempt, grouped by inspection date ---- */
  const dkey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const dayData = (sec) => {
    const nos = sec.stages.map((x) => x.no), days = {};
    Object.keys(S().results).forEach((k) => {
      const [scope, owner, id] = k.split('|'); const ch = QI.checks[id]; if (!ch || !nos.includes(ch.stageNo)) return;
      S().results[k].attempts.forEach((a) => { (days[dkey(a.ts)] = days[dkey(a.ts)] || []).push({ stage: ch.stageNo, scope, owner, id, param: ch.param, step: (QI.steps[ch.step] || {}).name || '', unit: ch.unit || '', a }); });
    });
    return Object.keys(days).sort().reverse().map((d) => ({ date: d, rows: days[d].sort((x, y) => x.stage - y.stage || x.id.localeCompare(y.id, undefined, { numeric: true }) || x.a.ts - y.a.ts) }));
  };
  const ownerHref = (r) => r.scope === 'log' ? '/log/' + r.owner : r.scope === 'heat' ? '/heat/' + r.owner : '/casting/' + r.owner;
  const ent = (n) => n + (n === 1 ? ' entry' : ' entries');
  const fday = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  function dayCard(sec) {
    const days = dayData(sec); ui.flowDate = ui.flowDate || {};
    const sel0 = ui.flowDate[sec.name] || 'all'; const shown = sel0 === 'all' ? days : days.filter((d) => d.date === sel0);
    if (!days.length) return `<section class="card"><h3>Inspection data by date</h3><div class="muted sm">No inspections recorded yet for ${esc(sec.name)}.</div></section>`;
    const tot = (d) => ({ ok: d.rows.filter((r) => r.a.result === 'ok').length, bad: d.rows.filter((r) => r.a.result !== 'ok').length });
    return `<section class="card"><h3>Inspection data by date <span class="muted sm">· ${esc(sec.name)}</span></h3>
      <label class="f"><span>Inspection date</span><select data-act="flow-date" data-sec="${esc(sec.name)}"><option value="all" ${sel0 === 'all' ? 'selected' : ''}>All dates (${days.length})</option>${days.map((d) => `<option value="${d.date}" ${sel0 === d.date ? 'selected' : ''}>${esc(fday(d.date))} – ${ent(d.rows.length)}</option>`).join('')}</select></label>
      ${shown.map((d, i) => { const t = tot(d); return `<details class="ht-d day" ${shown.length === 1 || i === 0 ? 'open' : ''}><summary><b>${esc(fday(d.date))}</b> <span class="badge ok">${t.ok} OK</span>${t.bad ? ` <span class="badge bad">${t.bad} not OK</span>` : ''} <span class="muted sm">${ent(d.rows.length)}</span></summary>
        ${sec.stages.map((st) => { const rs = d.rows.filter((r) => r.stage === st.no); return rs.length ? `<details class="ht-d sub" open><summary><b>Stage ${st.no} · ${esc(st.name)}</b> <span class="muted sm">${rs.length}</span></summary>${table(['Record', 'Check', 'Result', 'Value', 'By', 'Time'], rs.map((r) => `<tr><td><a href="#${ownerHref(r)}">${esc(r.owner)}</a></td><td title="${esc(r.step)}">${esc(r.id)} ${esc(r.param)}</td><td>${r.a.result === 'ok' ? badge('OK', 'ok') : badge('Not OK', 'bad')}</td><td>${esc(r.a.summary || '')}</td><td>${esc(r.a.by || '')}</td><td class="sm">${new Date(r.a.ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td></tr>`))}</details>` : ''; }).join('')}</details>`; }).join('')}</section>`;
  }
  V.flow = (sec) => {
    const all = SECTIONS(); const cur = all.find((x) => x.name === sec) || all[0];
    const chips = `<div class="chips">${all.map((x, i) => `<a class="chip ${x === cur ? 'on' : ''}" href="#/flow/${encodeURIComponent(x.name)}">${i + 1}. ${esc(x.name)}</a>`).join('')}</div>`;
    const body = cur.stages.map((st) => {
      const os = owners(st);
      const steps = st.groups.flatMap((g) => g.steps).map((sp) => `<div class="fstep"><b>${esc(sp.id)} ${esc(sp.name)}</b>${sp.optional ? ' ' + badge('per PO / customer plan', 'mute') : ''}${sp.sampled ? ' ' + badge('sampled', 'mute') : ''}<div class="sm"><span class="ftxt g">Frequency: ${esc(sp.checks[0].sample || '')}</span><br><span class="ftxt r">Accept: ${esc(sp.checks.map((c) => c.criteria).filter((x, i, a) => x && a.indexOf(x) === i).join(' · '))}</span></div></div>`).join('<div class="farrow">▼</div>');
      const pend = os.filter((o) => { const x = ownerStatus(st, o.id); return x !== 'done' && x !== 'na'; });
      const done = os.length - pend.length;
      const what = st.scope === 'log' ? 'shift logs' : st.scope === 'heat' ? 'heats' : 'castings';
      return `<section class="card"><h3>Stage ${st.no} · ${esc(st.name)} <span class="muted sm">recorded per ${SCOPE_LABEL[st.scope].toLowerCase()}</span></h3>${steps}
        ${st.gate ? `<div class="gate"><b>◆ ${esc(st.gate.question)}</b> <span class="muted sm">No → ${esc(st.gate.no)}</span></div>` : ''}
        <h5>Enter records · ${pend.length} of ${os.length} ${what} to do</h5>
        ${st.scope === 'log' && QI.can('create', 'log') ? '<button class="btn sm primary" data-act="new-log">+ New shift log</button>' : ''}${st.scope === 'heat' && QI.can('create', 'heat') ? '<button class="btn sm primary" data-act="new-heat">+ New heat</button>' : ''}
        ${pend.slice(0, 12).map((o) => `<div class="li"><a href="#${o.href}"><b>${esc(o.label)}</b></a>${stBadge(ownerStatus(st, o.id))}</div>`).join('') || `<div class="muted sm">${os.length ? 'All done ✔' : 'None yet.'}</div>`}${pend.length > 12 ? `<div class="muted sm">+ ${pend.length - 12} more – open from ${st.scope === 'heat' ? 'More → Heats' : st.scope === 'log' ? 'More → Shift logs' : 'Castings'}</div>` : ''}${done ? `<div class="muted sm">${done} complete</div>` : ''}</section>`;
    }).join('');
    return chips + dayCard(cur) + body;
  };
  V.more = () => `<h2>More</h2><div class="menu">${[['jobs', '📋 Work orders'], ['heats', '🔥 Heats'], ['logs', '🧱 Sand shift logs'], ['ncr', '⚠️ NCRs'], ['plan', '📐 Inspection plan'], ['settings', '⚙️ Settings & backup']].map(([k, t]) => `<a class="menurow" href="#/${k}">${t}</a>`).join('')}</div>`;

  /* ---- jobs ---- */
  V.jobs = () => `<div class="hd"><h2>Work orders</h2><button class="btn primary" data-act="new-job">+ New work order</button></div>
    ${S().jobs.length ? table(['Work order', 'Customer / PO', 'Part', 'Grade', 'Castings', 'Released', ''], S().jobs.slice().reverse().map((j) => {
      const cs = QI.jobCastings(j.no);
      return `<tr><td>${link('/job/' + j.no, j.no)}</td><td>${esc(j.customer)}<div class="muted sm">${esc(j.po)}</div></td><td>${esc(j.part)}<div class="muted sm">Dwg ${esc(j.drawing)} · Pattern ${esc(j.pattern)}</div></td><td>${esc(j.grade)}</td><td>${cs.length}${j.qty ? ' / ' + esc(j.qty) : ''}</td><td>${cs.filter((c) => c.status === 'released').length}</td><td>${link('/job/' + j.no, 'Open →')}</td></tr>`;
    })) : empty('No work orders yet.')}`;

  V.job = (no) => {
    const j = QI.job(no); if (!j) return empty('Work order not found.');
    const cs = QI.jobCastings(no);
    return `<div class="hd"><div><h2>${esc(j.no)} <small>${esc(j.part)}</small></h2><div class="muted">${esc(j.customer)} · PO ${esc(j.po)} · Drawing ${esc(j.drawing)} · Pattern ${esc(j.pattern)} · Grade ${esc(j.grade)}${j.qty ? ' · Order qty ' + esc(j.qty) : ''}</div></div>
      <div class="row"><button class="btn" data-act="edit-job" data-no="${esc(no)}">Edit</button><button class="btn" data-act="pdf-job" data-no="${esc(no)}">Customer report (PDF)</button><button class="btn primary" data-act="add-castings" data-no="${esc(no)}">+ Add castings</button></div></div>
    <section class="card"><h3>Inspection requirements for this order <small class="muted">(per PO / customer QAP)</small></h3>
      <div class="chips">${Object.keys(j.applic).map((id) => `<label class="chip"><input type="checkbox" data-act="applic" data-no="${esc(no)}" data-step="${id}" ${j.applic[id] ? 'checked' : ''}> ${id} ${esc(QI.steps[id].name)}</label>`).join('')}</div>
      <div class="muted sm">Unticked steps are skipped for every casting of this order. Mould & core making is sampled and never blocks a casting.</div></section>
    <section class="card"><h3>Castings (${cs.length})</h3>${cs.length ? castingTable(cs) : empty('No castings yet – add the first one.')}</section>`;
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
      <div class="row"><a class="btn" href="#/report/${esc(c.id)}">Inspection report</a><button class="btn" data-act="pdf-casting" data-id="${esc(c.id)}">PDF</button>
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
    return `<div class="hd"><div><h2>Heat ${esc(h.no)}</h2><div class="muted">${esc(h.date)} · Furnace ${esc(h.furnace || '–')} · Grade ${esc(h.grade || '–')}</div></div>
      <div class="row"><button class="btn" data-act="edit-heat" data-no="${esc(no)}">Edit heat</button><button class="btn" data-act="heat-spec" data-no="${esc(no)}">Chemistry & mechanical limits</button></div></div>
    <section class="card"><h3>Castings poured from this heat (${cs.length})</h3>${cs.length ? castingTable(cs) : '<div class="muted">None yet.</div>'}
      ${unassigned.length ? `<div class="row pad"><select id="addc">${unassigned.map((c) => `<option>${esc(c.id)}</option>`).join('')}</select><button class="btn sm" data-act="heat-add" data-no="${esc(no)}">Add casting to heat</button></div>` : ''}</section>
    ${QI.stages.filter((st) => st.scope === 'heat').map((st) => {
      const sts = st.groups.flatMap((g) => g.steps).flatMap((sp) => sp.checks).map((c) => QI.status('heat', no, c.id));
      return `<section class="card"><h3>Stage ${st.no} · ${esc(st.name)} <small class="muted">${esc(st.section)}</small> ${stBadge(sts.every((x) => x === 'ok') ? 'done' : sts.some((x) => x === 'ok') ? 'progress' : 'open')}</h3>${st.gate ? `<div class="gate"><b>◆ ${esc(st.gate.question)}</b> <span class="muted sm">No → ${esc(st.gate.no)}</span></div>` : ''}${stageBlock(st, 'heat', no)}${approvalStrip('heat', no, st.no, QI.jobsOf('heat', no))}</section>`;
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
    return `<div class="hd"><div><h2>Sand shift log – ${esc(l.date)}, shift ${esc(l.shift)}</h2><div class="muted">${QI.logCastings(id).length} casting(s) linked · opened by ${esc(l.by || '–')}</div></div></div>
      <section class="card">${QI.stages.filter((st) => st.scope === 'log').map((st) => `<h3>Stage ${st.no} · ${esc(st.name)}</h3>${stageBlock(st, 'log', id)}${approvalStrip('log', id, st.no, QI.jobsOf('log', id))}`).join('')}</section>`;
  };


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
        rows.push(`<tr><td><b>${c.id}</b></td><td>${esc(sp.name)}</td><td>${esc(c.sample)}</td><td>${esc(c.param)}</td><td>${esc(c.method)}</td><td>${esc(critText(c))} ${c.tbc ? badge('TBC', 'warn') : ''}${c.assumed && !c.tbc ? badge('assumed', 'warn') : ''}${S().settings.overrides[c.id] ? badge('edited', 'info') : ''}</td><td>${esc((c.actions || []).join(' / '))}</td><td class="sm">${esc((c.inspectors || []).join(', ')) || '–'}</td><td class="sm">${esc((c.approvers || []).join(', ')) || '–'}</td><td><button class="btn sm ghost" data-act="edit-check" data-id="${c.id}">Edit</button></td></tr>`);
      })));
      return rows.length ? `<section class="card"><h3>Stage ${st.no} · ${esc(st.name)} <small class="muted">recorded per ${SCOPE_LABEL[st.scope].toLowerCase()}</small></h3>${table(['Check', 'Step', 'Sample / frequency', 'Parameter', 'Method / equipment', 'Acceptance', 'If Not OK', 'Inspector', 'Final approval', ''], rows)}</section>` : '';
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
    <section class="card"><h3>Demo</h3><div class="row"><button class="btn" data-act="demo">Enter Sona knuckle data</button><button class="btn danger" data-act="wipe">Erase everything</button></div></section>`;

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
    return `<div class="noprint hd"><a class="btn" href="#/casting/${esc(c.id)}">← Back</a><button class="btn primary" data-act="pdf-casting" data-id="' + esc(c.id) + '">Download PDF</button></div>
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
    'flow-date': (el) => { ui.flowDate = ui.flowDate || {}; ui.flowDate[el.dataset.sec] = el.value; render(); },
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
  Object.assign(ACT, { 'pdf-casting': (el) => savePdf(`Inspection-report-${el.dataset.id}.pdf`, () => PDFREPORT.casting(el.dataset.id)), 'pdf-job': (el) => savePdf(`Inspection-summary-${el.dataset.no}.pdf`, () => PDFREPORT.job(el.dataset.no)) });
  async function savePdf(name, make) {
    toast('Making the PDF …');
    try { const blob = await make(); download(name, blob, 'application/pdf'); }
    catch (e) { toast((e && e.message) || 'Could not make the PDF', 'bad'); }
  }
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
    if (['applic', 'set-heat', 'set-log', 'import-json', 'flow-date'].includes(el.dataset.act)) ACT[el.dataset.act](el);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset && (el.dataset.act === 'filter-castings' || el.dataset.act === 'filter-plan')) return ACT[el.dataset.act](el);
    const f = el.closest && el.closest('form.chkform'); if (f) liveEval(f);
  });

  /* ================= demo data ================= */
  /* ---- Knuckle (Sona) heat-wise sheet: heats H430, H447, H450 ---- */
  const KN_CHEM = 'C, 0.29, 0.31\nSi, 0.43, 0.62\nMn, 1.16, 1.50\nP, 0.022, 0.031\nS, 0.010, 0.020\nCr, 0.03, 0.30\nMo, 0.12, 0.13\nNi, 0.18, 0.23\nAl, 0.031, 0.048\nSn, 0.003, 0.004';
  const KN = [
    { no: 'H430', shift: 'A', sand: { '1.1.1': 1.9, '1.1.2': 20, '1.1.3': 1.9, '1.1.4': 18, '1.2.1': 6.2, '1.3.1': 3.2, '1.3.2': 0.34, '1.3.3': 6.9, '1.3.4': 5.75, '1.3.5': 9.1, '1.3.6': 3.7 }, paint: 55, hard: 59, chem: { C: 0.29, Si: 0.43, Mn: 1.16, P: 0.022, S: 0.010, Cr: 0.03, Mo: 0.12, Ni: 0.23, Al: 0.048, Sn: 0.004 }, shake: 28 },
    { no: 'H447', shift: 'B', sand: { '1.1.1': 1.8, '1.1.2': 19, '1.1.3': 1.8, '1.1.4': 18, '1.2.1': 6.47, '1.3.1': 3.65, '1.3.2': 0.39, '1.3.3': 6.57, '1.3.4': 4.97, '1.3.5': 9.3, '1.3.6': 2.7 }, paint: 55, hard: 57, chem: { C: 0.31, Si: 0.62, Mn: 1.49, P: 0.031, S: 0.018, Cr: 0.30, Mo: 0.13, Ni: 0.19, Al: 0.031, Sn: 0.003 }, shake: 30 },
    { no: 'H450', shift: 'C', sand: { '1.1.1': 2.0, '1.1.2': 20, '1.1.3': 1.8, '1.1.4': 19, '1.2.1': 6.27, '1.3.1': 3.32, '1.3.2': 0.41, '1.3.3': 6.9, '1.3.4': 5.35, '1.3.5': 9.1 }, paint: 56, hard: 60, chem: { C: 0.29, Si: 0.62, Mn: 1.50, P: 0.030, S: 0.020, Cr: 0.30, Mo: 0.13, Ni: 0.18, Al: 0.036, Sn: 0.003 }, shake: 30 }];
  function knuckleData() {
    const st = S(); st.settings.inspector = st.settings.inspector || 'Data entry';
    const jobNo = 'SONA-KNUCKLE';
    if (!QI.job(jobNo)) QI.addJob({ no: jobNo, customer: 'Sona', po: '', qty: String(KN.length), part: 'Knuckle', drawing: '', pattern: '', grade: '', dims: '' });
    const j = QI.job(jobNo); Object.keys(j.applic || {}).forEach((k) => { j.applic[k] = false; });
    const ok = (scope, owner, id, input) => QI.record(scope, owner, id, Object.assign({ action: '' }, input));
    const results = [];
    KN.forEach((r) => {
      if (!QI.heat(r.no)) QI.addHeat({ no: r.no, date: today(), furnace: '', grade: 'Knuckle' });
      const h = QI.heat(r.no); h.chemSpec = parseSpec(KN_CHEM);
      const log = QI.addLog(today(), r.shift).id;
      let c = QI.jobCastings(jobNo).find((x) => x.heatNo === r.no);
      if (!c) { c = QI.addCastings(jobNo, 1)[0]; }
      c.heatNo = r.no; c.logId = log;
      Object.keys(r.sand).forEach((id) => results.push([id, ok('log', log, id, { value: r.sand[id] })]));
      results.push(['1.4.1', ok('log', log, '1.4.1', { value: r.paint })]);
      results.push(['2.2.1', ok('casting', c.id, '2.2.1', { value: r.hard })]);
      results.push(['3.3.1', ok('heat', r.no, '3.3.1', { vals: r.chem })]);
      results.push(['3.5.1', ok('heat', r.no, '3.5.1', { value: r.shake })]);
      results.push(['5.2.1', ok('heat', r.no, '5.2.1', { value: 920 })]);
      results.push(['5.2.2', ok('heat', r.no, '5.2.2', { value: 100, result: 'ok' })]);
      results.push(['5.2.3', ok('heat', r.no, '5.2.3', { value: 4 })]);
    });
    QI.save();
    return results.filter((x) => x[1] && x[1].error).map((x) => x[0] + ': ' + x[1].error);
  }

  /* ================= router ================= */
  const GROUPS = [['dashboard', '🏠', 'Today'], ['flow', '🔀', 'Flow'], ['castings', '🔩', 'Castings'], ['approvals', '✅', 'Approvals'], ['more', '☰', 'More']];
  const PERM = { 'new-job': ['create', 'job'], 'edit-job': ['create', 'job'], applic: ['create', 'job'], 'add-castings': ['create', 'casting'], 'new-heat': ['create', 'heat'], 'edit-heat': ['create', 'heat'],
    'new-log': ['create', 'log'], 'heat-spec': ['spec'], 'heat-add': ['link', 'heat'], 'set-heat': ['link', 'heat'], 'set-log': ['link', 'log'], release: ['release'], 'reject-casting': ['reject'],
    'ncr-close': ['ncr'], 'ht-add': ['ht'], 'ht-del': ['ht'], 'ht-save': ['ht'], 'ht-delplan': ['ht'], 'mpl-new': ['mplan'], 'mpl-save': ['mplan'], 'mpl-addrow': ['mplan'], 'mpl-delrow': ['mplan'], 'mpl-additem': ['mplan'], 'mpl-delitem': ['mplan'], 'rm-new': ['rm'], 'rm-save': ['rm'], 'rm-addcheck': ['rm'], 'rm-delcheck': ['rm'], 'cm-lots': ['charge'], 'mp-new': ['mould'], 'mp-save': ['mould'], 'mp-post': ['mould'], 'mp-addline': ['mould'], 'mp-delline': ['mould'], 'mp-additem': ['mould'], 'mp-delitem': ['mould'], 'ml-new': ['melt'], 'ml-save': ['melt'], 'ml-post': ['melt'], 'ml-sign': ['melt'], 'ml-addscrap': ['melt'], 'ml-addalloc': ['melt'], 'cm-save': ['charge'], 'cm-dup': ['charge'], 'cm-del': ['charge'], 'cm-toheat': ['charge'], 'cm-plan': ['charge'], 'edit-items': ['master'], 'add-customer': ['master'], 'edit-check': ['plan'], 'export-json': ['admin'], 'import-json': ['admin'], demo: ['admin'], wipe: ['admin'] };
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
    const tabOf = { job: 'more', jobs: 'more', heat: 'more', heats: 'more', log: 'more', logs: 'more', ncr: 'more', plan: 'more', settings: 'more', casting: 'castings', report: 'castings' };
    const active = tabOf[view] || view;
    $('#nav').innerHTML = GROUPS.map(([k, ic, t]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}"><i>${ic}</i><span>${t}</span></a>`).join('');
    $('#who').textContent = QI.mode === 'shared' ? (QI.me.dept ? `👤 ${QI.me.name || 'You'} · ${QI.dept().name.split(' ')[0]}` : 'Choose department') : (S().settings.inspector ? '👤 ' + S().settings.inspector : 'Set inspector');
    $('#back').hidden = !hist.length;
    $('#stale').hidden = true; ui.stale = false;
    const sy = $('#sync'); sy.textContent = QI.mode === 'shared' ? (QI.ready ? '● Shared · live' : '○ Connecting…') : (HOSTED ? '○ Local only (sign in to share)' : '○ This device only'); sy.className = 'sync ' + (QI.mode === 'shared' && QI.ready ? 'on' : '');
    const y = window.scrollY;
    $('#main').innerHTML = fn(arg);
    applyPerms($('#main'));
    document.body.classList.toggle('printing', view === 'report');
    if (!open) $('#main').dataset.view = view;
    window.scrollTo(0, y);
    document.title = 'Inspection Data';
  }
  if (window.DCL_LOGO) { const lg = $('#logo'); lg.src = window.DCL_LOGO; lg.hidden = false; }
  /* ---- "+ New entry" button: one tap to the entry forms ---- */
  const FAB = [['Work order', ['create', 'job'], 'new-job'], ['Inspect a casting', null, '#castings'], ['Sand shift log', ['create', 'log'], 'new-log'], ['New heat', ['create', 'heat'], 'new-heat'], ['Follow the flow', null, '#flow']];
  document.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[data-home]'); if (!b) return;
    const k = b.dataset.home;
    if (k === 'upload') { go('wip'); const fi = $('#ppc-file'); if (fi) fi.click(); } else if (k.slice(0, 3) === 'go:') go(k.slice(3)); else if (k.slice(0, 4) === 'act:' && ACT[k.slice(4)]) ACT[k.slice(4)](b);
  });
  $('#fab').addEventListener('click', () => {
    $('#fabbtns').innerHTML = FAB.filter((f) => !f[1] || (Array.isArray(f[1]) ? QI.can(f[1][0], f[1][1]) : QI.can(f[1]))).map((f) => `<button class="btn big" data-fab="${f[2]}">${esc(f[0])}</button>`).join('');
    $('#fabsheet').hidden = false;
  });
  const fabHide = () => { $('#fabsheet').hidden = true; };
  $('#fabclose').addEventListener('click', fabHide);
  $('#fabsheet').addEventListener('click', (e) => {
    if (e.target.id === 'fabsheet') return fabHide();
    const b = e.target.closest('[data-fab]'); if (!b) return; fabHide();
    const k = b.dataset.fab; if (k[0] === '#') go(k.slice(1)); else if (ACT[k]) ACT[k](b);
  });
  $('#who').addEventListener('click', () => go('settings'));
  $('#back').addEventListener('click', () => { if (hist.length) { route = hist.pop(); window.scrollTo(0, 0); render(); } });
  $('#stale').addEventListener('click', () => render());
  QI.onChange = (first) => {
    if (first) { booting = false; render(); if (QI.mode === 'shared' && (!QI.me.dept || !QI.me.name)) profileModal(); return; }
    if ($('#dlg').open || $('form.chkform')) { ui.stale = true; $('#stale').hidden = false; } else render();
  };
  QI.onError = (e) => toast('Not saved: ' + ((e && e.code === 'not_writer') || (e && /permission|writer|denied/i.test(e.message || '')) ? 'you have view-only access.' : (e && e.message) || 'connection problem.'), 'bad');
  if (!HOSTED) QI.seed();
  render();
  if (HOSTED) {
    const use = (n) => Promise.race([Promise.resolve().then(() => window.claude.use(n)).catch(() => null), new Promise((r) => setTimeout(() => r(null), 5000))]);
    const local = (why) => { booting = false; if (QI.mode === 'shared') { QI.detach(); } else { QI.seed(); render(); } if (why) toast(why, 'bad'); };
    (async () => {
      const db = await use('db');
      if (!db) return local('Shared data is not available here – working on this device only.');
      const [user, dl] = await Promise.all([use('user'), use('downloads')]);
      DL = dl;
      try { await QI.attach(db, user); } catch (e) { local('Shared data could not be opened – working on this device only.'); }
    })();
  }
  if (!QI.persistent) toast('Browser storage unavailable – data will not be saved. Use Settings → Backup.', 'bad');
  window.QIApp = { render, knuckleData };
})();
