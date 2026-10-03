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
