/* DCL Quality Inspection – UI. Hash-routed single page app, no build step. */
(function () {
  'use strict';
  const { S, num } = { S: () => QI.S(), num: QI.num };
  const $ = (sel, el) => (el || document).querySelector(sel);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fdt = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
  const fd = (ts) => ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–';
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const ui = { open: {}, filter: { castings: '', ncr: 'open', plan: '' }, stageOpen: {} };
  const SCOPE_LABEL = { job: 'Work order', log: 'Sand & calibration log', heat: 'Heat', casting: 'Casting' };

  /* ================= small components ================= */
  const badge = (t, cls) => `<span class="badge ${cls || ''}">${esc(t)}</span>`;
  const stBadge = (s) => ({ ok: badge('OK', 'ok'), nok: badge('Not OK', 'bad'), none: badge('Pending', 'mute'), done: badge('Complete', 'ok'), fail: badge('Failed – action needed', 'bad'),
    progress: badge('In progress', 'info'), open: badge('Not started', 'mute'), na: badge('Not applicable', 'mute') }[s] || '');
  const dot = (s) => `<span class="dot ${s === 'ok' || s === 'done' ? 'ok' : s === 'nok' || s === 'fail' ? 'bad' : s === 'progress' ? 'info' : ''}"></span>`;
  const link = (href, t) => `<a href="#${href}">${esc(t)}</a>`;
  const empty = (msg, extra) => `<div class="empty">${msg}${extra || ''}</div>`;
  const table = (head, rows) => `<div class="tw"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const progressBar = (c) => {
    const t = QI.castingStages(c);
    return `<span class="pbar" title="Stage progress">${t.stages.map((s) => `<i class="${s.status === 'done' ? 'ok' : s.status === 'fail' ? 'bad' : s.status === 'progress' ? 'info' : s.status === 'na' ? 'na' : ''}" title="${s.stage.no}. ${esc(s.stage.name)}"></i>`).join('')}</span>`;
  };
  const stateBadge = (c) => { const s = QI.castingState(c); return badge(s.label, s.cls); };

  /* ================= modal ================= */
  function modal(title, body, onOk, okLabel) {
    const dlg = $('#dlg');
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
  const fld = (label, name, val, attrs) => `<label class="f"><span>${label}</span><input name="${name}" value="${esc(val == null ? '' : val)}" ${attrs || ''}></label>`;
  const sel = (label, name, opts, val) => `<label class="f"><span>${label}</span><select name="${name}">${opts.map((o) => { const [v, t] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select></label>`;
  const ta = (label, name, val, hint, rows) => `<label class="f"><span>${label}</span><textarea name="${name}" rows="${rows || 4}">${esc(val || '')}</textarea>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const val = (form, n) => (form.elements[n] ? form.elements[n].value.trim() : '');

  function needInspector() {
    if (S().settings.inspector) return false;
    modal('Who is inspecting?', fld('Your name (shown on every record you sign)', 'name', '', 'required'), (f) => {
      if (!val(f, 'name')) return 'Enter your name.'; S().settings.inspector = val(f, 'name'); QI.save();
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
    const canRecord = owner && !o.locked && !o.readonly;
    const pending = last && last.result === 'nok' && QI.classify(last.action) === 'rework';
    const tags = [ch.tbc || ch.assumed ? badge(ch.assumed && !ch.tbc ? 'criteria assumed – confirm' : 'to be confirmed', 'warn') : '',
      o.required === false ? badge('sampled / optional', 'mute') : '', ch.freq ? badge(QI.PERIOD_LABEL[ch.freq], 'mute') : ''].join('');
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
    const acts = (ch.actions && ch.actions.length ? ch.actions : ['Other']).concat(ch.actions && ch.actions.includes('Other') ? [] : ['Other']);
    return `<form class="chkform" data-key="${esc(key)}" data-scope="${scope}" data-owner="${esc(owner)}" data-check="${ch.id}" onsubmit="return false">
      ${inner}
      <div class="grid2">${fld('Report / certificate / ref. no. (optional)', 'ref', '')}${fld('Remarks (optional)', 'remarks', '')}</div>
      ${sel('If Not OK – action / disposal', 'action', acts, acts[0])}
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
    const input = { ref: g('ref').trim(), remarks: g('remarks').trim(), action: g('action') };
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
  function saveCheck(key) {
    if (needInspector()) return;
    const f = $(`form.chkform[data-key="${CSS.escape(key)}"]`);
    const { scope, owner, check } = f.dataset;
    const input = readForm(f);
    const ch = QI.eff(check);
    const ev = QI.evaluate(ch, input, { heat: scope === 'heat' ? QI.heat(owner) : null });
    if (ev.error) { const p = $('.preview', f); p.className = 'preview err'; p.textContent = ev.error; return; }
    if (ev.result === 'nok') {
      const tg = QI.rejectTargets(scope, owner, check, input.action);
      if (tg.length && !confirm(`“${input.action}” will REJECT ${tg.length} casting(s):\n${tg.join(', ')}\n\nContinue?`)) return;
    }
    const r = QI.record(scope, owner, check, input);
    if (r.error) { const p = $('.preview', f); p.className = 'preview err'; p.textContent = r.error; return; }
    delete ui.open[key];
    render();
    if (r.ncr) toast(`${r.ncr.id} raised – ${ch.param}${r.rejected.length ? ` · ${r.rejected.length} casting(s) rejected` : ''}`, 'bad'); else toast('Saved – OK', 'ok');
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
    if (!st.jobs.length) return `<h2>Dashboard</h2>${empty('<b>Welcome to the DCL Quality Inspection app.</b><br>Start by creating a work order, then add castings and follow each one through the 10 inspection stages.',
      `<div class="row c"><a class="btn primary" href="#/jobs">Create first work order</a><button class="btn" data-act="demo">Load demo data</button></div>`)}`;
    const max = Math.max(1, ...Object.values(s.wip));
    const nmax = Math.max(1, ...Object.values(s.ncrByStage));
    const due = QI.due();
    const attention = st.castings.filter((c) => c.status === 'active' && QI.castingState(c).failing);
    const pct = (v) => v == null ? '–' : Math.round(v * 100) + '%';
    return `<h2>Dashboard</h2>
    <div class="kpis">
      <div class="kpi"><b>${s.active}</b><span>Castings in process</span></div>
      <div class="kpi"><b>${s.released}</b><span>Released</span></div>
      <div class="kpi"><b class="${s.rejected ? 'badT' : ''}">${s.rejected}</b><span>Rejected</span></div>
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
    <section class="card"><h3>Stage ${st1.no} · ${esc(st1.name)} ${stBadge(s1.every((x) => x === 'ok') ? 'done' : s1.some((x) => x === 'ok') ? 'progress' : 'open')}</h3>${stageBlock(st1, 'job', no)}</section>`;
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
        body = note + stageBlock(x.stage, sc, owner, { locked: x.locked || c.status !== 'active' && sc === 'casting', job: j });
      }
      return `<section class="card stage ${x.status}"><div class="sh" data-act="stage-toggle" data-k="${esc(c.id + no)}"><span class="sn">${no}</span><span class="sname">${esc(x.stage.name)}</span>${x.stage.optional ? badge('per PO / QAP', 'mute') : ''}${stBadge(x.status)}<span class="chev">${open ? '▾' : '▸'}</span></div>${open ? `<div class="sb">${body}</div>` : ''}</section>`;
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
    ${[4, 8].map((n) => {
      const st = QI.stageOf[n];
      const sts = st.groups[0].steps.flatMap((s) => s.checks).map((c) => QI.status('heat', no, c.id));
      return `<section class="card"><h3>Stage ${n} · ${esc(st.name)} ${n === 8 ? '<small class="muted">test bars / samples from this heat – tests required depend on each casting’s PO / QAP</small>' : ''}</h3>
        ${n === 8 && Object.keys(req).length ? `<div class="muted sm pad">Required by castings on this heat: ${Object.keys(req).map((k) => `${k} (${[...req[k]].join(', ')})`).join(' · ')}</div>` : ''}${stageBlock(st, 'heat', no)}</section>`;
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
      <section class="card">${stageBlock(QI.stageOf[2], 'log', id)}</section>`;
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
    <section class="card"><h3>Inspector</h3><div class="row"><input id="insp" value="${esc(S().settings.inspector)}" placeholder="Your name"><button class="btn primary" data-act="save-insp">Save</button></div><div class="muted sm">Your name is stamped on every inspection result you record.</div></section>
    <section class="card"><h3>Data</h3><div class="muted sm pad">Data is stored in this browser (works offline). ${QI.persistent ? '' : '<b class="badT">Browser storage is unavailable – export your data before closing!</b>'} Export a backup regularly, and import it to move data to another device.</div>
      <div class="row"><button class="btn" data-act="export-json">Backup (JSON)</button><label class="btn">Restore backup<input type="file" accept="application/json" hidden data-act="import-json"></label><button class="btn" data-act="export-csv">Export all results (CSV)</button></div></section>
    <section class="card"><h3>Demo</h3><div class="row"><button class="btn" data-act="demo">Load demo data</button><button class="btn danger" data-act="wipe">Erase everything</button></div></section>`;

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
      rows.push(`<tr class="rs"><td colspan="7">Stage ${x.stage.no} · ${esc(x.stage.name)}</td></tr>`);
      x.items.forEach((i) => {
        const a = i.owner ? QI.last(i.scope, i.owner, i.check.id) : null;
        const ch = QI.eff(i.check.id);
        rows.push(`<tr><td>${ch.id}</td><td>${esc(ch.param)}<div class="sm">${esc(QI.steps[ch.step].name)}</div></td><td>${esc(critText(ch))}</td><td>${a ? esc(a.summary) + (a.detail ? `<div class="sm">${esc(a.detail)}</div>` : '') : ''}</td>
          <td>${a ? (a.result === 'ok' ? 'OK' : 'NOT OK') : i.required ? 'Pending' : '–'}</td><td>${a ? esc(a.by) + '<div class="sm">' + fdt(a.ts) + '</div>' : ''}</td><td>${a ? esc(a.ref) : ''}</td></tr>`);
      });
    });
    const ncrs = S().ncrs.filter((n) => n.castings.includes(c.id));
    return `<div class="noprint hd"><a class="btn" href="#/casting/${esc(c.id)}">← Back</a><button class="btn primary" onclick="window.print()">Print / Save as PDF</button></div>
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
    return `<div class="grid2">${fld('Work order no.', 'no', j.no, j.no ? 'readonly' : 'required')}${fld('Customer', 'customer', j.customer)}${fld('PO / order no.', 'po', j.po)}${fld('Order qty', 'qty', j.qty, 'type="number" min="1"')}
      ${fld('Part name', 'part', j.part)}${fld('Drawing no.', 'drawing', j.drawing)}${fld('Pattern no.', 'pattern', j.pattern)}${fld('Material grade', 'grade', j.grade)}</div>
      ${ta('Drawing dimensions (optional – pre-fills dimension checks)', 'dims', j.dims, 'One per line: <i>feature, nominal, −tol, +tol</i> e.g. <i>Bore Ø, 100, 0.5, 0.5</i>')}`;
  };
  const readJob = (f) => ({ no: val(f, 'no'), customer: val(f, 'customer'), po: val(f, 'po'), qty: val(f, 'qty'), part: val(f, 'part'), drawing: val(f, 'drawing'), pattern: val(f, 'pattern'), grade: val(f, 'grade'), dims: val(f, 'dims') });
  const heatForm = (h) => {
    h = h || {};
    return `<div class="grid2">${fld('Heat no.', 'no', h.no, h.created ? 'readonly' : 'required')}${fld('Date', 'date', h.date || today(), 'type="date"')}${fld('Furnace', 'furnace', h.furnace)}${fld('Grade', 'grade', h.grade)}
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
    'modal-cancel': () => $('#dlg').close(),
    'filter-castings': (el) => { ui.filter.castings = el.value; render(); const i = $('.search'); i.focus(); i.setSelectionRange(99, 99); },
    'filter-plan': (el) => { ui.filter.plan = el.value; render(); const i = $('.search'); i.focus(); i.setSelectionRange(99, 99); },
    'ncr-filter': (el) => { ui.filter.ncr = el.dataset.f; render(); },
    'save-insp': () => { S().settings.inspector = $('#insp').value.trim(); QI.save(); toast('Saved', 'ok'); },
    'new-job': () => modal('New work order', jobForm(), (f) => { const r = QI.addJob(readJob(f)); if (r.error) return r.error; location.hash = '/job/' + val(f, 'no'); }),
    'edit-job': (el) => { const j = QI.job(el.dataset.no); modal('Edit work order ' + j.no, jobForm(j), (f) => { Object.assign(j, readJob(f)); QI.save(); }); },
    applic: (el) => { QI.job(el.dataset.no).applic[el.dataset.step] = el.checked; QI.save(); render(); },
    'add-castings': (el) => modal('Add castings', `${fld('How many castings?', 'n', 1, 'type="number" min="1" max="200"')}<small class="muted">Serial numbers are assigned automatically (${esc(el.dataset.no)}-001, -002 …).</small>`, (f) => { const n = parseInt(val(f, 'n'), 10); if (!(n > 0)) return 'Enter a quantity.'; const cs = QI.addCastings(el.dataset.no, n); toast(`${cs.length} casting(s) created`, 'ok'); }),
    'new-heat': (el) => modal('New heat', heatForm(), (f) => { const r = QI.addHeat({ no: val(f, 'no'), date: val(f, 'date'), furnace: val(f, 'furnace'), grade: val(f, 'grade'), tapMin: val(f, 'tapMin'), tapMax: val(f, 'tapMax'), pourMin: val(f, 'pourMin'), pourMax: val(f, 'pourMax') }); if (r.error) return r.error; if (el.dataset.for) { QI.casting(el.dataset.for).heatNo = val(f, 'no'); QI.save(); } else location.hash = '/heat/' + val(f, 'no'); setTimeout(() => ACT['heat-spec']({ dataset: { no: val(f, 'no') } }), 50); }),
    'edit-heat': (el) => { const h = QI.heat(el.dataset.no); modal('Edit heat ' + h.no, heatForm(h), (f) => { Object.assign(h, { date: val(f, 'date'), furnace: val(f, 'furnace'), grade: val(f, 'grade'), tapMin: val(f, 'tapMin'), tapMax: val(f, 'tapMax'), pourMin: val(f, 'pourMin'), pourMax: val(f, 'pourMax') }); QI.save(); }); },
    'heat-spec': (el) => { const h = QI.heat(el.dataset.no); modal(`Specification – heat ${h.no}`, `${ta('Chemical composition (%) – checks 4.1 / 4.2', 'chem', specText(h.chemSpec), 'One per line: <i>element, min, max</i> — e.g. <i>C, 0.18, 0.25</i> · <i>Mn, 0.6, 1.0</i> · <i>S, , 0.035</i> (leave min or max blank for one-sided limits)', 8)}${ta('Mechanical properties – check 8.1', 'mech', specText(h.mechSpec), 'Same format, e.g. <i>UTS (MPa), 485, 655</i>. Remove lines you do not test.', 6)}`, (f) => { h.chemSpec = parseSpec(val(f, 'chem')); h.mechSpec = parseSpec(val(f, 'mech')); QI.save(); }); },
    'heat-add': (el) => { const id = $('#addc').value; QI.casting(id).heatNo = el.dataset.no; QI.save(); render(); },
    'set-heat': (el) => { QI.casting(el.dataset.id).heatNo = el.value || null; QI.save(); render(); },
    'set-log': (el) => { QI.casting(el.dataset.id).logId = el.value || null; QI.save(); render(); },
    'new-log': (el) => modal('New sand & calibration log', `${fld('Date', 'date', today(), 'type="date" required')}${sel('Shift', 'shift', ['A', 'B', 'C'], 'A')}`, (f) => { const r = QI.addLog(val(f, 'date'), val(f, 'shift')); if (r.error && !r.id) return r.error; if (el.dataset.for) { QI.casting(el.dataset.for).logId = r.id; QI.save(); } else location.hash = '/log/' + r.id; }),
    release: (el) => { if (needInspector()) return; const c = QI.casting(el.dataset.id); modal('Release casting ' + c.id, `<p>Confirms that all inspection stages are complete and the casting conforms.</p>${fld('Released by', 'by', S().settings.inspector)}${fld('Remarks', 'remarks', '')}`, (f) => { const r = QI.release(c, val(f, 'by'), val(f, 'remarks')); if (r.error) return r.error; toast('Casting released', 'ok'); }, 'Release'); },
    'reject-casting': (el) => { if (needInspector()) return; const c = QI.casting(el.dataset.id); modal('Reject casting ' + c.id, `${fld('Reason for rejection', 'reason', '', 'required')}<small class="muted">The casting is stopped and goes back for melting. This cannot be undone.</small>`, (f) => { if (!val(f, 'reason')) return 'Enter a reason.'; QI.manualReject(c, val(f, 'reason')); }, 'Reject casting'); },
    'ncr-close': (el) => modal('Close ' + el.dataset.id, fld('Closure note (action taken / verification)', 'note', '', 'required'), (f) => { if (!val(f, 'note')) return 'Enter a closure note.'; QI.closeNcr(el.dataset.id, val(f, 'note')); }, 'Close NCR'),
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
    'import-json': (el) => { const file = el.files[0]; if (!file) return; const r = new FileReader(); r.onload = () => { try { if (!confirm('Replace all current data with this backup?')) return; QI.replace(JSON.parse(r.result)); toast('Backup restored', 'ok'); render(); } catch (e) { alert('Not a valid backup file.'); } }; r.readAsText(file); },
    demo: () => { if (S().jobs.length && !confirm('This adds demo records to your existing data. Continue?')) return; demoData(); location.hash = '/dashboard'; render(); toast('Demo data loaded', 'ok'); },
    wipe: () => { if (confirm('Erase ALL data in this browser? Export a backup first.') && confirm('Really erase everything?')) { QI.reset(); location.hash = '/dashboard'; render(); } },
  };
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    if (el.tagName === 'INPUT' || el.tagName === 'SELECT') return;     // handled on change/input
    if (el.tagName === 'LABEL') return;
    const fn = ACT[el.dataset.act]; if (fn) { fn(el); }
  });
  document.addEventListener('change', (e) => {
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
    QI.save();
  }

  /* ================= router ================= */
  const NAV = [['dashboard', 'Dashboard'], ['jobs', 'Work orders'], ['castings', 'Castings'], ['heats', 'Heats'], ['logs', 'Sand & calibration'], ['ncr', 'NCRs'], ['plan', 'Inspection plan'], ['settings', 'Settings']];
  function render() {
    const parts = (location.hash.replace(/^#\/?/, '') || 'dashboard').split('/');
    const view = parts[0]; const arg = decodeURIComponent(parts.slice(1).join('/'));
    const fn = V[view] || V.dashboard;
    const open = $('#dlg').open;
    const active = view === 'job' ? 'jobs' : view === 'casting' || view === 'report' ? 'castings' : view === 'heat' ? 'heats' : view === 'log' ? 'logs' : view;
    $('#nav').innerHTML = NAV.map(([k, t]) => `<a href="#/${k}" class="${active === k ? 'on' : ''}">${t}</a>`).join('');
    $('#who').textContent = S().settings.inspector ? '👤 ' + S().settings.inspector : 'Set inspector';
    const y = window.scrollY;
    $('#main').innerHTML = fn(arg);
    document.body.classList.toggle('printing', view === 'report');
    if (!open) $('#main').dataset.view = view;
    window.scrollTo(0, y);
    document.title = 'DCL Quality Inspection';
  }
  window.addEventListener('hashchange', () => { window.scrollTo(0, 0); render(); });
  $('#who').addEventListener('click', () => location.hash = '/settings');
  render();
  if (!QI.persistent) toast('Browser storage unavailable – data will not be saved. Use Settings → Backup.', 'bad');
  window.QIApp = { render, demoData };
})();
