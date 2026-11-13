/**
 * Daily Production & Inspection – web app for phones without a Claude account.
 * Serves the app and keeps its shared data in a sheet named "db" of this spreadsheet.
 * Setup: see gas/SETUP.md.  Nothing here needs a sign-in from the people who use the link.
 */
var APP_FILE_ID = '';         // paste the Google Drive file id of app.html here (see SETUP.md)
var DB_SHEET = 'db';          // columns: A path | B version | C deleted | D..H JSON (split in 40,000-character pieces)
var CHUNK = 40000, CHUNKS = 5;

function doGet() {
  var html;
  if (APP_FILE_ID) html = DriveApp.getFileById(APP_FILE_ID).getBlob().getDataAsString('UTF-8');
  else html = HtmlService.createHtmlOutputFromFile('app').getContent();
  return HtmlService.createHtmlOutput(html)
    .setTitle('Daily Production & Inspection')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(DB_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DB_SHEET); sh.getRange(1, 1, 1, 3).setValues([['path', 'version', 'deleted']]);
    sh.getRange(1, 1, sh.getMaxRows(), 1).setNumberFormat('@'); sh.getRange(1, 4, sh.getMaxRows(), CHUNKS).setNumberFormat('@');   // plain text: a piece starting with = must not become a formula
  }
  return sh;
}
function curVersion_() { return parseInt(PropertiesService.getScriptProperties().getProperty('ver') || '0', 10); }

/** Cheap check the phones call every few seconds: the current version number. */
function dbVersion() {
  var c = CacheService.getScriptCache().get('ver');
  if (c != null) return parseInt(c, 10);
  var v = curVersion_(); CacheService.getScriptCache().put('ver', String(v), 21600); return v;
}

/** Everything that changed after version `since` (since = 0 returns the whole database). */
function dbSince(since) {
  since = since || 0;
  var cur = dbVersion();
  if (since === cur) return { ver: cur, docs: [] };
  var sh = sheet_(), n = sh.getLastRow() - 1, docs = [];
  if (n > 0) {
    var rows = sh.getRange(2, 1, n, 3 + CHUNKS).getValues();
    rows.forEach(function (r) {
      if (!r[0] || Number(r[1]) <= since) return;
      if (Number(r[2]) === 1) { docs.push({ p: r[0], d: null }); return; }
      var json = ''; for (var i = 0; i < CHUNKS; i++) json += r[3 + i] || '';
      if (since === 0 && !json) return;
      docs.push({ p: r[0], d: json ? JSON.parse(json) : null });
    });
  }
  return { ver: cur, docs: docs };
}

/** Apply a batch of writes: ops = [[path, jsonString | null], ...]; null deletes the document. Returns the new version. */
function dbWrite(ops) {
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var sh = sheet_(), last = sh.getLastRow(), index = {};
    if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { index[r[0]] = i + 2; });
    var ver = curVersion_() + 1, append = [], appendAt = {};
    ops.forEach(function (op) {
      var path = String(op[0]), json = op[1];
      if (path.length > 400) return;
      var row = [path, ver, json == null ? 1 : 0]; var text = json == null ? '' : String(json);
      if (text.length > CHUNK * CHUNKS) throw new Error('Document too large: ' + path);
      for (var i = 0; i < CHUNKS; i++) row.push(text.substr(i * CHUNK, CHUNK));
      if (index[path]) sh.getRange(index[path], 1, 1, row.length).setValues([row]);
      else if (appendAt[path] != null) append[appendAt[path]] = row;
      else { appendAt[path] = append.length; append.push(row); }
    });
    if (append.length) {
      var at = sh.getLastRow() + 1;
      sh.getRange(at, 1, append.length, 1).setNumberFormat('@'); sh.getRange(at, 4, append.length, CHUNKS).setNumberFormat('@');
      sh.getRange(at, 1, append.length, 3 + CHUNKS).setValues(append);
    }
    PropertiesService.getScriptProperties().setProperty('ver', String(ver));
    CacheService.getScriptCache().put('ver', String(ver), 21600);
    return ver;
  } finally { lock.releaseLock(); }
}
