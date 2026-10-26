/* apps-script.gs — Electric Trailer ⇄ Google Sheet bridge.
 *
 * HOW TO INSTALL (full walkthrough: SETUP.md, "Option B"):
 *   1. Open the inventory Google Sheet → Extensions → Apps Script.
 *   2. Delete the default code and paste this whole file in.
 *   3. Nothing to configure. (Optionally set SHEET_NAME below if the
 *      inventory tab isn't the first sheet.)
 *   4. Deploy → New deployment → Web app: Execute as "Me",
 *      Who has access: "Anyone". Copy the /exec URL.
 *   5. In the app: Settings → Backend → Google Sheet → paste the link
 *      into "Sheet link" → Connect.
 *
 * API (JSON in, JSON out):
 *   GET  ?action=rows             → { ok:true, rows:[ {Header: value, …} ] }
 *   POST { ops:[…] }              → { ok:true, results:[ {id, ok, error?} ] }
 *   POST { action:'uploadPhoto', name, dataBase64 }
 *                                 → { ok:true, url } | { ok:false, error }
 * Each op: { id, kind: 'qty' | 'edit' | 'add', fields: { Quantity: 12, … } }.
 * 'qty'/'edit' find the row whose id column matches op.id — the id
 * column may be headed 'Id' or 'Item ID' — and apply the given fields
 * (by header name); 'add' appends a full row. If an 'Updated' column
 * exists it is stamped with the current time per write.
 *
 * PHOTO UPLOADS are optional and off until configured: the
 * uploadPhoto action commits the image into the app repo's photos/
 * folder on GitHub and answers with its public URL. The GitHub
 * credential lives ONLY in Script Properties (key GITHUB_TOKEN —
 * see SETUP.md, "Photo uploads") — never in this file and never in
 * the app. Without it, uploads answer a plain "not set up" error
 * and everything else works as before.
 *
 * TOKEN is optional and OFF by default — leave it blank unless you
 * want a shared secret. With it blank, anyone who has the deployed
 * link can read and write this sheet's inventory through the bridge,
 * so keep the link among the people using it. To turn the token on,
 * set TOKEN here to a long random string and add the same value as
 * "token" in the app's saved sheet config on each device; requests
 * without a matching token are then rejected.
 * The script runs as the sheet owner's account.
 */

const TOKEN = '';            // ← optional shared secret; blank = no token check
const SHEET_NAME = '';       // ← blank = first sheet tab; or the exact tab name

/* Photo uploads: where committed photos live, and the decoded-size
 * cap (the app shrinks photos to ~50 KB before sending; the cap is
 * a guardrail, not a target). */
const PHOTO_REPO = 'masstahl/electric-trailer';
const PHOTO_DIR = 'photos';
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024;

/* ---------------- helpers ---------------- */

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* Token check is skipped entirely while TOKEN is blank (the default).
 * When TOKEN is set, the request must carry the same token. */
function tokenOk_(token) {
  if (!TOKEN) return true;
  return !!token && String(token) === TOKEN;
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
  if (key === 'qty' || key === 'quantity' || key === 'level') {
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
    if (String(body.action || '') === 'uploadPhoto') return uploadPhoto_(body);
    var ops = body.ops || [];
    if (!ops.length) return jsonOut_({ ok: true, results: [] });

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sh = inventorySheet_();
      var headers = headersOf_(sh);
      var hmap = headerMap_(headers);
      var idIdx = hmap['id'];
      if (idIdx == null) idIdx = hmap['item id'];  // the inventory sheet heads it 'Item ID'
      if (idIdx == null) throw new Error('No "Id" (or "Item ID") column found in the sheet header row.');

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

/* ---------------- POST: photo upload ----------------
 * Reached only after the same token check the ops path uses (in
 * doPost, above). Commits the image to the repo's photos/ folder
 * via the GitHub Contents API and answers with the public Pages
 * URL; the app then stores that URL in the item's Image cell
 * through the normal ops path. Always creates a NEW file name
 * (slug, then slug-2, slug-3, …) — an existing photo is never
 * overwritten. */
function uploadPhoto_(body) {
  var ghToken = '';
  try { ghToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') || ''; }
  catch (e) { /* Script Properties unavailable */ }
  if (!ghToken) return jsonOut_({ ok: false, error: 'Uploads are not set up on the sheet script.' });

  var raw = String((body && body.dataBase64) || '').replace(/^data:[^,]*,/, '').replace(/\s+/g, '');
  if (!raw) return jsonOut_({ ok: false, error: 'No photo data was sent.' });
  var bytes;
  try { bytes = Utilities.base64Decode(raw); }
  catch (e) { return jsonOut_({ ok: false, error: 'That photo data could not be read.' }); }
  if (bytes.length > UPLOAD_MAX_BYTES) return jsonOut_({ ok: false, error: 'That photo is too large.' });
  var ext = imageExtFromBytes_(bytes);
  if (!ext) return jsonOut_({ ok: false, error: 'That file is not an image.' });

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var name = uniquePhotoName_(ghToken, body && body.name, ext);
    var res = UrlFetchApp.fetch(ghContentsUrl_(name), {
      method: 'put',
      contentType: 'application/json',
      headers: ghHeaders_(ghToken),
      payload: JSON.stringify({ message: 'Add item photo', content: Utilities.base64Encode(bytes) }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code !== 200 && code !== 201) {
      return jsonOut_({ ok: false, error: 'The photo host rejected the upload (HTTP ' + code + ').' });
    }
    return jsonOut_({ ok: true, url: 'https://masstahl.github.io/electric-trailer/' + PHOTO_DIR + '/' + name });
  } finally {
    lock.releaseLock();
  }
}

function ghHeaders_(ghToken) {
  return { Authorization: 'Bearer ' + ghToken, Accept: 'application/vnd.github+json' };
}

function ghContentsUrl_(name) {
  return 'https://api.github.com/repos/' + PHOTO_REPO + '/contents/' + PHOTO_DIR + '/' + encodeURIComponent(name);
}

function ghPhotoExists_(ghToken, name) {
  var res = UrlFetchApp.fetch(ghContentsUrl_(name), {
    method: 'get',
    headers: ghHeaders_(ghToken),
    muteHttpExceptions: true
  });
  return res.getResponseCode() === 200;
}

/* First free name for this photo: the pure naming rule below,
 * probed against the repo one candidate at a time. */
function uniquePhotoName_(ghToken, base, ext) {
  var taken = {};
  var name = photoFileName_(base, ext, taken);
  while (ghPhotoExists_(ghToken, name)) {
    taken[name] = true;
    name = photoFileName_(base, ext, taken);
  }
  return name;
}

/* Pure naming helpers — no Apps Script services, so they can be
 * exercised outside the script editor. */
function photoSlug_(base) {
  var s = String(base == null ? '' : base).toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return s || 'photo';
}

function photoFileName_(base, ext, taken) {
  var slug = photoSlug_(base);
  var name = slug + '.' + ext;
  var n = 2;
  while (taken && taken[name]) { name = slug + '-' + n + '.' + ext; n++; }
  return name;
}

/* Image sniffing by magic bytes (Apps Script bytes are signed —
 * mask before comparing values above 0x7F). */
function imageExtFromBytes_(bytes) {
  if (!bytes || bytes.length < 3) return '';
  if ((bytes[0] & 0xFF) === 0xFF && (bytes[1] & 0xFF) === 0xD8 && (bytes[2] & 0xFF) === 0xFF) return 'jpg';
  if (bytes.length >= 4 && (bytes[0] & 0xFF) === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'webp';
  return '';
}

function applyOp_(sh, headers, hmap, rowById, op) {
  var id = String((op && op.id) || '').trim();
  var kind = String((op && op.kind) || 'edit');
  var fields = (op && op.fields) || {};
  if (!id) return { id: id, ok: false, error: 'Missing id' };

  var rowNum = rowById[id];

  if (kind === 'add' && !rowNum) {
    var newRow = headers.map(function () { return ''; });
    setField_(newRow, hmap, hmap['id'] != null ? 'Id' : 'Item ID', id);
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
