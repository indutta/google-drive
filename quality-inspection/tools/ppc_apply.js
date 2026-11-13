#!/usr/bin/env node
/* Merge one PPC Daily Performance Report into the app's shared config (the "ppc" part of meta/config).
   Usage: node ppc_apply.js <words.json> <config.json> <out.json> "<report file name>" "<by>"
   words.json = output of pdf_words.py.  Writes out.json = {"ppc": {...}} ready for the database update.
   Exit code 0 = merged, 3 = nothing to do (same or older date), 2 = could not read the report / warnings (nothing written). */
'use strict';
global.window = global;
const fs = require('fs'), path = require('path');
require(path.join(__dirname, '..', 'ppcparse.js'));
const [words, cfg, out, file, by] = process.argv.slice(2);
const r = window.PPCPARSE.parseDaily(JSON.parse(fs.readFileSync(words)));
if (r.error) { console.log('ERROR ' + r.error); process.exit(2); }
if (r.warn.length || !r.wip.length || !r.pouring.length) { console.log('WARNINGS ' + JSON.stringify(r.warn) + ' wip=' + r.wip.length + ' pouring=' + r.pouring.length); process.exit(2); }
const live = JSON.parse(fs.readFileSync(cfg)); const pp = live.ppc || { plan: [], wip: [] };
if (pp.asOn && r.asOn <= pp.asOn) { console.log('SKIP report ' + r.asOn + ' is not newer than the app (' + pp.asOn + ')'); process.exit(3); }
const nk = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
pp.asOn = r.asOn; pp.wip = r.wip; if (Object.keys(r.kpi).length) pp.kpi = Object.assign({ asOn: r.asOn }, r.kpi);
pp.plan = pp.plan || []; let upd = 0, add = 0;
r.pouring.forEach((p) => {
  const c = pp.plan.find((x) => nk(x.item) === nk(p.item));
  if (c) { c.order = p.order; c.poured = p.poured; if (p.unitWt) c.unitWt = p.unitWt; if (!c.material && p.material) c.material = p.material; upd++; }
  else { pp.plan.push({ customer: p.customer, item: p.item, material: p.material, unitWt: p.unitWt, planKg: 0, patt: '', moulds: 0, order: p.order, poured: p.poured }); add++; }
});
pp.history = (pp.history || []).concat([{ ts: Date.now(), by: by || 'Daily PPC sync', file: file || '', asOn: r.asOn, wip: r.wip.length, pour: r.pouring.length }]).slice(-30);
fs.writeFileSync(out, JSON.stringify({ ppc: pp }));
console.log(`MERGED ${r.asOn}: wip ${r.wip.length} customers, pouring ${r.pouring.length} items (${upd} updated, ${add} new), GC month ${r.kpi.gc ? r.kpi.gc.month : '?'} MT`);
