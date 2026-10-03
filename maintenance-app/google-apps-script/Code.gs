/**
 * Datre Maintenance Desk — Google Apps Script backend.
 * Serves the app (Index.html) and stores every record in the "Data" tab of
 * the Google Sheet this script is attached to. Readable report tabs
 * (Breakdowns, Sourcing, Downtime) are rebuilt from the menu or hourly.
 */
const DATA_SHEET = 'Data';
const HEADER = ['collection', 'id', 'json', 'updatedAt', 'updatedBy'];

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Datre Maintenance Desk')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://www.gstatic.com/images/icons/material/system/2x/build_black_48dp.png');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Maintenance Desk')
    .addItem('Refresh report tabs', 'buildReports')
    .addItem('Import Tally stock summary', 'importTally')
    .addItem('Create Tally Import tab', 'tallySheet_')
    .addItem('Turn on hourly report refresh', 'installTrigger')
    .addToUi();
}

function dataSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** All records changed after `since` (ms). Deleted records come back with an empty json. */
function getDocs(since) {
  const sh = dataSheet_();
  const now = Date.now();
  const last = sh.getLastRow();
  if (last < 2) return { now: now, docs: [] };
  const rows = sh.getRange(2, 1, last - 1, 4).getValues();
  const docs = [];
  rows.forEach(function (r) {
    if (Number(r[3]) > (since || 0)) docs.push([String(r[0]), String(r[1]), String(r[2])]);
  });
  return { now: now, docs: docs };
}

/** Batch upsert: [[collection, id, json or '' to delete], ...] */
function putDocs(batch) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = dataSheet_();
    const last = sh.getLastRow();
    const keys = last >= 2 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
    const index = {};
    keys.forEach(function (k, i) { index[k[0] + '/' + k[1]] = i + 2; });
    const who = Session.getActiveUser().getEmail() || 'app';
    const appendRows = [];
    batch.forEach(function (b) {
      const ts = Date.now();
      const row = [b[0], b[1], b[2] || '', ts, who];
      const at = index[b[0] + '/' + b[1]];
      if (at) sh.getRange(at, 1, 1, 5).setValues([row]);
      else appendRows.push(row);
    });
    if (appendRows.length) sh.getRange(sh.getLastRow() + 1, 1, appendRows.length, 5).setValues(appendRows);
    return { ok: true, now: Date.now() };
  } finally {
    lock.releaseLock();
  }
}

function load_(collection) {
  const out = [];
  const sh = dataSheet_();
  if (sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    if (r[0] === collection && r[2]) out.push(JSON.parse(r[2]));
  });
  return out;
}

function writeTab_(name, header, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
}

/** Human-readable tabs for management and Excel export. */
function buildReports() {
  const d = function (t) { return t ? new Date(t) : ''; };
  const bds = load_('breakdowns').sort(function (a, b) { return b.start - a.start; });
  writeTab_('Breakdowns',
    ['Machine', 'Type', 'Stopped', 'Problem', 'Status', 'Priority', 'Start', 'End', 'Downtime h', 'Assigned', 'Root cause', 'Spares', 'Work done'],
    bds.map(function (b) {
      const h = b.stopped && b.start ? (((b.end || Date.now()) - b.start) / 36e5) : 0;
      return [b.m, b.d === 'E' ? 'Electrical' : 'Mechanical', b.stopped ? 'Yes' : 'No', b.sym || '', b.status || '', b.prio || '',
        d(b.start), d(b.end), Math.round(h * 10) / 10, b.assigned || '', b.root || '', b.spares || '', b.work || ''];
    }));
  writeTab_('Sourcing',
    ['Item', 'Machine', 'Qty', 'Stage', 'Priority', 'Vendor', 'Indent/PO/WO', 'ETA', 'Value ₹', 'Remarks'],
    load_('sourcing').map(function (s) {
      return [s.item || '', s.m || '', s.qty || '', s.stage || '', s.prio || '', s.vendor || '', s.ref || '', s.eta || '', s.val || '', s.note || ''];
    }));
  // Downtime machine × month (breakdowns with machine stopped + manual entries)
  const dt = {};
  const add = function (m, ym, h) { dt[m] = dt[m] || {}; dt[m][ym] = (dt[m][ym] || 0) + h; };
  bds.forEach(function (b) {
    if (!b.stopped || !b.start) return;
    let s = b.start; const e = b.end || Date.now();
    while (s < e) {
      const x = new Date(s); const nx = new Date(x.getFullYear(), x.getMonth() + 1, 1).getTime(); const seg = Math.min(e, nx);
      add(b.m, Utilities.formatDate(x, Session.getScriptTimeZone(), 'yyyy-MM'), (seg - s) / 36e5); s = seg;
    }
  });
  load_('dtmanual').forEach(function (r) { if (r.h) add(r.m, r.ym, Number(r.h)); });
  const now = new Date(); const fy = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const months = []; for (let i = 0; i < 12; i++) months.push(Utilities.formatDate(new Date(fy, 3 + i, 1), Session.getScriptTimeZone(), 'yyyy-MM'));
  writeTab_('Downtime', ['Machine'].concat(months).concat(['FY total h']),
    Object.keys(dt).sort().map(function (m) {
      const v = months.map(function (ym) { return Math.round((dt[m][ym] || 0) * 10) / 10; });
      return [m].concat(v).concat([Math.round(v.reduce(function (a, b) { return a + b; }, 0) * 10) / 10]);
    }));
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'buildReports') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('buildReports').timeBased().everyHours(1).create();
  SpreadsheetApp.getUi().alert('Report tabs will refresh every hour.');
}

/* ======================= LIVE STOCK ======================= */
const STOCK_SHEET = 'Stock';
const MOVES_SHEET = 'Stock Moves';
const TALLY_SHEET = 'Tally Import';
const STOCK_HEADER = ['Item', 'Qty', 'Unit', 'Rate', 'Group', 'Updated', 'Updated by'];

function stockSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(STOCK_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STOCK_SHEET);
    sh.getRange(1, 1, 1, STOCK_HEADER.length).setValues([STOCK_HEADER]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function movesSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(MOVES_SHEET);
  if (!sh) {
    sh = ss.insertSheet(MOVES_SHEET);
    sh.appendRow(['Time', 'Item', 'Issued', 'Received', 'Set to', 'Balance', 'Unit', 'Machine', 'Ref', 'By (app)', 'Account']);
    sh.getRange(1, 1, 1, 11).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function tallySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(TALLY_SHEET);
  if (!sh) {
    sh = ss.insertSheet(TALLY_SHEET);
    sh.getRange(1, 1, 1, 4).setValues([['Particulars', 'Quantity', 'Rate', 'Value']]).setFontWeight('bold');
    sh.getRange(1, 6).setValue('Paste the Tally Stock Summary (Item, Closing Qty, Rate, Value) from row 2, then Maintenance Desk → Import Tally stock summary');
  }
  return sh;
}
const stockVer_ = function () { return Number(PropertiesService.getScriptProperties().getProperty('STOCK_VER') || 0); };
const bumpStock_ = function () { const v = Date.now(); PropertiesService.getScriptProperties().setProperty('STOCK_VER', String(v)); return v; };

/** Hand edits on the Stock tab also count as a stock change. */
function onEdit(e) {
  if (e && e.range && e.range.getSheet().getName() === STOCK_SHEET) bumpStock_();
}

/** Stock rows, or {same:true} when nothing changed since `ver`. */
function getStock(ver) {
  const v = stockVer_();
  if (ver && v && Number(ver) === v) return { ver: v, same: true };
  const sh = stockSheet_();
  const last = sh.getLastRow();
  const rows = last < 2 ? [] : sh.getRange(2, 1, last - 1, 5).getValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r) { return [String(r[0]).trim(), Number(r[1]) || 0, String(r[2] || ''), Number(r[3]) || 0, String(r[4] || 'General')]; });
  return { ver: v || Date.now(), rows: rows };
}

/** First run: fill an empty Stock tab with the list built into the app. */
function initStock(rows) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = stockSheet_();
    if (sh.getLastRow() >= 2) return { skipped: true };
    const now = new Date();
    const data = rows.map(function (r) { return [r[0], r[1], r[2], r[3], r[4], now, 'Stores list 02-Oct-26']; });
    if (data.length) sh.getRange(2, 1, data.length, 7).setValues(data);
    bumpStock_();
    return { ok: true, n: data.length };
  } finally { lock.releaseLock(); }
}

/** Issue / receipt / physical count from the app. m = {name, delta, set, unit, machine, ref, by} */
function adjustStock(m) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = stockSheet_();
    const name = String(m.name).trim();
    const last = sh.getLastRow();
    const names = last >= 2 ? sh.getRange(2, 1, last - 1, 1).getValues() : [];
    let row = 0;
    for (let i = 0; i < names.length; i++) if (String(names[i][0]).trim().toUpperCase() === name.toUpperCase()) { row = i + 2; break; }
    if (!row) { row = sh.getLastRow() + 1; sh.getRange(row, 1, 1, 5).setValues([[name, 0, m.unit || 'NOS', 0, 'General']]); }
    const cur = Number(sh.getRange(row, 2).getValue()) || 0;
    const unit = String(sh.getRange(row, 3).getValue() || m.unit || '');
    const q = (m.set !== null && m.set !== undefined && m.set !== '') ? Number(m.set) : cur + Number(m.delta || 0);
    if (q < 0) throw new Error('stock would go below zero (balance ' + cur + ')');
    const account = Session.getActiveUser().getEmail() || '';
    sh.getRange(row, 2).setValue(q);
    sh.getRange(row, 6, 1, 2).setValues([[new Date(), m.by || account]]);
    const d = Number(m.delta || 0);
    movesSheet_().appendRow([new Date(), name, d < 0 ? -d : '', d > 0 ? d : '', (m.set !== null && m.set !== undefined && m.set !== '') ? q : '', q, unit, m.machine || '', m.ref || '', m.by || '', account]);
    return { name: String(sh.getRange(row, 1).getValue()), q: q, unit: unit, ver: bumpStock_() };
  } finally { lock.releaseLock(); }
}

/** Rebuild the Stock tab from a Tally Stock Summary pasted into the "Tally Import" tab. */
function importTally() {
  const ui = SpreadsheetApp.getUi();
  const src = tallySheet_();
  const last = src.getLastRow();
  if (last < 2) { ui.alert('Paste the Tally Stock Summary into the "' + TALLY_SHEET + '" tab first (from row 2).'); return; }
  const sh = stockSheet_();
  const old = {};
  if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().forEach(function (r) { old[String(r[0]).trim().toUpperCase()] = r; });
  const out = []; const now = new Date();
  src.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) {
    const name = String(r[0]).trim();
    if (!name || /^(grand )?total/i.test(name)) return;
    let qty = r[1], unit = '';
    if (typeof qty === 'string') {
      const mm = qty.replace(/,/g, '').match(/^\s*(-?[\d.]+)\s*([A-Za-z]+)?/);
      if (!mm) return; qty = Number(mm[1]); unit = mm[2] || '';
    }
    if (qty === '' || isNaN(Number(qty))) return; // group heading rows have no quantity
    const prev = old[name.toUpperCase()];
    const rate = Number(String(r[2]).replace(/[^\d.]/g, '')) || (prev ? Number(prev[3]) : 0);
    out.push([name, Number(qty), unit || (prev ? prev[2] : 'NOS'), rate, prev ? prev[4] : 'General', now, 'Tally import']);
  });
  if (!out.length) { ui.alert('No stock rows found. Columns must be: Particulars, Quantity, Rate, Value.'); return; }
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    sh.getRange(2, 1, out.length, 7).setValues(out);
    bumpStock_();
  } finally { lock.releaseLock(); }
  ui.alert('Stock updated from Tally: ' + out.length + ' items. Phones pick it up within a minute.');
}

/** Stock list replaced from the app's "Update stock from Tally" screen. rows = [[item, qty, unit, rate, group], ...] */
function replaceStock(rows, by) {
  if (!rows || !rows.length) throw new Error('no rows');
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const sh = stockSheet_();
    const now = new Date();
    if (sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, 7).clearContent();
    sh.getRange(2, 1, rows.length, 7).setValues(rows.map(function (r) {
      return [String(r[0]), Number(r[1]) || 0, String(r[2] || ''), Number(r[3]) || 0, String(r[4] || 'General'), now, 'Tally import by ' + (by || 'app')];
    }));
    bumpStock_();
  } finally { lock.releaseLock(); }
  return getStock(0);
}
