/* DCL – shared data for the Google Apps Script version of the app.
   Gives the page the same small "database" the app already uses (collection().onSnapshot, doc().set / delete, user id),
   backed by the Datre sheet through google.script.run.  Loaded before the app; does nothing outside Apps Script. */
(function () {
  'use strict';
  if (!(window.google && google.script && google.script.run)) return;
  const run = (fn, ...a) => new Promise((ok, no) => { google.script.run.withSuccessHandler(ok).withFailureHandler((e) => no(e instanceof Error ? e : new Error((e && e.message) || String(e)))) [fn](...a); });
  const POLL_MS = 15000;
  let ver = 0, loaded = false, busy = false, failed = null, timer = null, flushTimer = null;
  const all = {};                 // path -> JSON text
  const listeners = [];           // { col, cb, err, known: {id: json}, first: true }
  let queue = [];                 // [path, json|null, resolve, reject]

  const idOf = (p) => p.slice(p.indexOf('/') + 1);
  const colOf = (p) => p.slice(0, p.indexOf('/'));
  function notify(l) {
    const changes = [], seen = {};
    Object.keys(all).forEach((p) => {
      if (colOf(p) !== l.col) return;
      const id = idOf(p), j = all[p]; seen[id] = 1;
      if (l.known[id] === undefined) changes.push({ type: 'added', doc: mk(id, j) });
      else if (l.known[id] !== j) changes.push({ type: 'modified', doc: mk(id, j) });
      l.known[id] = j;
    });
    Object.keys(l.known).forEach((id) => { if (!seen[id]) { delete l.known[id]; changes.push({ type: 'removed', doc: mk(id, '{}') }); } });
    if (l.first || changes.length) { l.first = false; try { l.cb({ docChanges: () => changes, size: Object.keys(l.known).length, empty: !Object.keys(l.known).length }); } catch (e) { console.error(e); } }
  }
  const mk = (id, j) => ({ id, exists: true, data: () => JSON.parse(j), metadata: {} });
  const notifyAll = () => listeners.forEach(notify);

  async function poll() {
    if (busy) return; busy = true;
    try {
      const r = await run('dbSince', loaded ? ver : 0);
      r.docs.forEach((d) => { if (d.d == null) delete all[d.p]; else all[d.p] = JSON.stringify(d.d); });
      ver = r.ver; loaded = true; failed = null; notifyAll();
    } catch (e) {
      if (!loaded) { failed = e; listeners.forEach((l) => { if (l.first) { l.first = false; try { l.err && l.err(e); } catch (x) { console.error(x); } } }); }
    } finally { busy = false; }
  }
  function start() {
    if (timer) return;
    timer = setInterval(() => { if (!document.hidden) poll(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    window.addEventListener('online', poll);
    poll();
  }
  function flush() {
    flushTimer = null; if (!queue.length) return;
    const batch = queue; queue = [];
    run('dbWrite', batch.map((q) => [q[0], q[1]])).then(() => { batch.forEach((q) => q[2]()); setTimeout(poll, 1200); }, (e) => batch.forEach((q) => q[3](e)));
  }
  function write(path, json) {
    if (json == null) delete all[path]; else all[path] = json;
    notifyAll();                                                   // own change shows at once
    return new Promise((ok, no) => { queue.push([path, json, ok, no]); if (!flushTimer) flushTimer = setTimeout(flush, 250); });
  }
  const db = {
    collection: (col) => ({ onSnapshot: (cb, err) => { const l = { col, cb, err, known: {}, first: true }; listeners.push(l); start(); if (loaded) notify(l); else if (failed) { l.first = false; setTimeout(() => err && err(failed), 0); } return () => { const i = listeners.indexOf(l); if (i >= 0) listeners.splice(i, 1); }; } }),
    doc: (path) => ({ path, id: idOf(path), set: (obj) => write(path, JSON.stringify(obj)), delete: () => write(path, null) })
  };

  let uid = '';
  try { uid = localStorage.getItem('dcl_gas_uid') || ''; if (!uid) { uid = 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); localStorage.setItem('dcl_gas_uid', uid); } } catch (e) { uid = 'g' + Math.random().toString(36).slice(2, 12); }
  const user = { id: async () => uid, me: async () => ({}), can: () => true };
  const downloads = { save: ({ filename, data }) => new Promise((ok, no) => {
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'text/plain' })); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); ok({ status: 'saved' }); } catch (e) { no(e); }
  }) };
  window.claude = { gas: true, poll, use: async (n) => (n === 'db' ? db : n === 'user' ? user : n === 'downloads' ? downloads : null) };
})();
