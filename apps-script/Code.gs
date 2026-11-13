/**
 * Quest Board backend for a Google Sheet.
 * Setup is in the README: paste this into Extensions > Apps Script, run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 *
 * Sheets it uses:
 *   Users  username | password | displayName      (one row per person who can sign in)
 *   Docs   collection | id | data (JSON) | updatedAt   (everything on the boards; leave it to the page)
 */
var USERS = 'Users';
var DOCS = 'Docs';

/** Run once from the editor: creates the two sheets with headers and a first login. */
function setup() {
  var ss = SpreadsheetApp.getActive();
  var u = ss.getSheetByName(USERS);
  if (!u) {
    u = ss.insertSheet(USERS);
    u.appendRow(['username', 'password', 'displayName']);
    u.appendRow(['dan', 'change-me', 'Dan']);
    u.setFrozenRows(1);
  }
  var d = ss.getSheetByName(DOCS);
  if (!d) {
    d = ss.insertSheet(DOCS);
    d.appendRow(['collection', 'id', 'data', 'updatedAt']);
    d.setFrozenRows(1);
  }
  d.getRange('A:D').setNumberFormat('@'); // keep ids and JSON as plain text
  bumpRev();
}

/** Opening the URL in a browser just confirms it's live. */
function doGet() {
  return out({ ok: true, app: 'quest-board' });
}

function doPost(e) {
  var b;
  try { b = JSON.parse(e.postData.contents); } catch (x) { return out({ ok: false, error: 'Bad request' }); }
  var user = auth(b.username, b.password);
  if (!user) return out({ ok: false, code: 'auth', error: 'Wrong name or password' });
  try {
    if (b.action === 'login') return out({ ok: true, displayName: user.displayName });
    if (b.action === 'list') return out(list(b.since));
    if (b.action === 'write') return out(write(b.ops || []));
    return out({ ok: false, error: 'Unknown action' });
  } catch (x) {
    return out({ ok: false, code: 'server', error: String((x && x.message) || x) });
  }
}

/** Someone edited the sheet by hand: make the page reload everything on its next check. */
function onEdit() { bumpRev(); }

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function auth(name, pass) {
  name = String(name || '').trim().toLowerCase();
  if (!name || !pass) return null;
  var rows = SpreadsheetApp.getActive().getSheetByName(USERS).getDataRange().getValues().slice(1);
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[0]).trim().toLowerCase() === name && String(r[1]) === String(pass)) {
      return { username: name, displayName: String(r[2] || r[0]) };
    }
  }
  return null;
}

function getRev() { return Number(PropertiesService.getScriptProperties().getProperty('rev') || 0); }
function bumpRev() {
  var p = PropertiesService.getScriptProperties();
  var rev = Number(p.getProperty('rev') || 0) + 1;
  p.setProperty('rev', String(rev));
  return rev;
}

/** Everything on the boards. If nothing changed since the caller's last look, says so instead. */
function list(since) {
  var rev = getRev();
  if (since != null && Number(since) === rev) return { ok: true, rev: rev, same: true };
  var sh = SpreadsheetApp.getActive().getSheetByName(DOCS);
  var n = sh.getLastRow() - 1;
  var v = n > 0 ? sh.getRange(2, 1, n, 3).getValues() : [];
  var docs = [];
  v.forEach(function (r) {
    if (!r[0] || !r[1]) return;
    try { docs.push({ c: String(r[0]), i: String(r[1]), d: JSON.parse(r[2]) }); } catch (x) {}
  });
  return { ok: true, rev: rev, docs: docs };
}

/** ops: [{op:'set'|'update'|'delete', c:collection, i:id, d:data}] applied in order, all at once. */
function write(ops) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(DOCS);
    var n = Math.max(0, sh.getLastRow() - 1);
    var rows = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];
    var idx = {};
    rows.forEach(function (r, k) { if (r[0] && r[1]) idx[r[0] + '/' + r[1]] = k; });
    var now = new Date().toISOString();
    ops.forEach(function (o) {
      if (!o || !o.c || !o.i) return;
      var key = o.c + '/' + o.i, k = idx[key];
      if (o.op === 'delete') {
        if (k != null) rows[k] = null;
        delete idx[key];
        return;
      }
      var data = o.d || {};
      if (o.op === 'update') {
        if (k == null || !rows[k]) return; // nothing to update
        var cur = {};
        try { cur = JSON.parse(rows[k][2] || '{}'); } catch (x) {}
        for (var f in data) cur[f] = data[f];
        data = cur;
      }
      var row = [String(o.c), String(o.i), JSON.stringify(data), now];
      if (k != null && rows[k]) rows[k] = row;
      else { idx[key] = rows.length; rows.push(row); }
    });
    var kept = rows.filter(function (r) { return r && r[0]; });
    // write in one go, blanking any rows left over from deletes
    var total = Math.max(n, kept.length);
    if (total > 0) {
      var vals = kept.slice();
      while (vals.length < total) vals.push(['', '', '', '']);
      var range = sh.getRange(2, 1, total, 4);
      range.setNumberFormat('@');
      range.setValues(vals);
    }
    return { ok: true, rev: bumpRev() };
  } finally {
    lock.releaseLock();
  }
}
