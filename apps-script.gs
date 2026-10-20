/* apps-script.gs — Electric Trailer ⇄ Google Sheet bridge.
 *
 * HOW TO INSTALL (full walkthrough: SETUP.md, "Option B"):
 *   1. Open the inventory Google Sheet → Extensions → Apps Script.
 *   2. Delete the default code and paste this whole file in.
 *   3. Set TOKEN below to a long random string (keep it private), and
 *      SHEET_NAME if the inventory tab isn't the first sheet.
 *   4. Deploy → New deployment → Web app: Execute as "Me",
 *      Who has access: "Anyone with the link". Copy the /exec URL.
 *   5. In the app: Settings → Backend → Google Sheet → paste the URL
 *      and the same TOKEN → Test connection.
 *
 * API (JSON in, JSON out):
 *   GET  ?action=rows&token=...   → { ok:true, rows:[ {Header: value, …} ] }
 *   POST { token, ops:[…] }       → { ok:true, results:[ {id, ok, error?} ] }
 * Each op: { id, kind: 'qty' | 'edit' | 'add', fields: { Qty: 12, … } }.
 * 'qty'/'edit' find the row whose Id column matches op.id and apply the
 * given fields (by header name); 'add' appends a full row. If an
 * 'Updated' column exists it is stamped with the current time per write.
 *
 * SECURITY: the token is a shared secret — anyone with the Web App URL
 * and the token can read and write this inventory. Keep both private.
 * The script runs as the sheet owner's account.
 */

const TOKEN = 'CHANGE_ME';   // ← replace with a long random string
const SHEET_NAME = '';       // ← blank = first sheet tab; or the exact tab name

/* ---------------- helpers ---------------- */

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function tokenOk_(token) {
  return !!TOKEN && TOKEN !== 'CHANGE_ME' && !!token && String(token) === TOKEN;
}

function inventorySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = SHEET_NAME ? ss.getSheetByName(SHEET_NAME) : ss.getSheets()[0];
  if (!sh) throw new Error('Sheet tab not found: "' + SHEET_NAME + '"');
  return sh;
}

function headersOf_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) throw new Error('The sheet has no header row.');
  return sh.getRange(1, 1, 1, lastCol).getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

/* Header lookup is by name: trimmed, case-insensitive. */
function headerMap_(headers) {
  var map = {};
  headers.forEach(function (h, i) { if (h) map[h.toLowerCase()] = i; });
  return map;
}

function setField_(rowValues, hmap, name, value) {
  var idx = hmap[String(name).trim().toLowerCase()];
  if (idx == null) return;  // sheet has no such column — skip gracefully
  var key = String(name).trim().toLowerCase();
  if (key === 'qty' || key === 'level') {
    var n = parseInt(value, 10);
    value = isNaN(n) ? 0 : n;
  } else if (key === 'cost') {
    var c = Number(value);
    value = isNaN(c) ? 0 : c;
  }
  rowValues[idx] = value;
}

function stampUpdated_(rowValues, hmap) {
  var idx = hmap['updated'];
  if (idx != null) rowValues[idx] = new Date().toISOString();
}

/* ---------------- GET: read all rows ---------------- */

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (!tokenOk_(p.token)) return jsonOut_({ ok: false, error: 'Bad token.' });
    var action = String(p.action || 'rows');
    if (action !== 'rows') return jsonOut_({ ok: false, error: 'Unknown action: ' + action });

    var sh = inventorySheet_();
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return jsonOut_({ ok: true, rows: [] });
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var rows = [];
    for (var r = 1; r < values.length; r++) {
      var obj = {};
      var any = false;
      headers.forEach(function (h, c) {
        if (!h) return;
        obj[h] = values[r][c];
        if (values[r][c] !== '' && values[r][c] != null) any = true;
      });
      if (any) rows.push(obj);  // skip fully blank rows
    }
    return jsonOut_({ ok: true, rows: rows });
  } catch (err) {
    return jsonOut_({ ok: false, error: String((err && err.message) || err) });
  }
}

/* ---------------- POST: apply ops ---------------- */

function doPost(e) {
  try {
    var body = {};
    try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (parseErr) { return jsonOut_({ ok: false, error: 'Request body was not valid JSON.' }); }
    if (!tokenOk_(body.token)) return jsonOut_({ ok: false, error: 'Bad token.' });
    var ops = body.ops || [];
    if (!ops.length) return jsonOut_({ ok: true, results: [] });

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sh = inventorySheet_();
      var headers = headersOf_(sh);
      var hmap = headerMap_(headers);
      var idIdx = hmap['id'];
      if (idIdx == null) throw new Error('No "Id" column found in the sheet header row.');

      // Map Id → sheet row number (1-based), read once per batch.
      var lastRow = sh.getLastRow();
      var rowById = {};
      if (lastRow > 1) {
        var ids = sh.getRange(2, idIdx + 1, lastRow - 1, 1).getValues();
        ids.forEach(function (r, i) {
          var id = String(r[0]).trim();
          if (id && rowById[id] == null) rowById[id] = i + 2;
        });
      }

      var results = ops.map(function (op) {
        return applyOp_(sh, headers, hmap, rowById, op);
      });
      return jsonOut_({ ok: true, results: results });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: String((err && err.message) || err) });
  }
}

function applyOp_(sh, headers, hmap, rowById, op) {
  var id = String((op && op.id) || '').trim();
  var kind = String((op && op.kind) || 'edit');
  var fields = (op && op.fields) || {};
  if (!id) return { id: id, ok: false, error: 'Missing id' };

  var rowNum = rowById[id];

  if (kind === 'add' && !rowNum) {
    var newRow = headers.map(function () { return ''; });
    setField_(newRow, hmap, 'Id', id);
    Object.keys(fields).forEach(function (k) { setField_(newRow, hmap, k, fields[k]); });
    stampUpdated_(newRow, hmap);
    sh.appendRow(newRow);
    rowById[id] = sh.getLastRow();
    return { id: id, ok: true };
  }

  if (!rowNum) return { id: id, ok: false, error: 'Id not found in sheet' };

  var range = sh.getRange(rowNum, 1, 1, headers.length);
  var values = range.getValues()[0];
  Object.keys(fields).forEach(function (k) { setField_(values, hmap, k, fields[k]); });
  stampUpdated_(values, hmap);
  range.setValues([values]);
  return { id: id, ok: true };
}
