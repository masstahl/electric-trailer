/* sheets.js — Google Sheet provider for Electric Trailer (window.ETSheets).
 *
 * The live backend: talks directly to the inventory Google Sheet
 * through a small Apps Script bridge installed in the sheet itself
 * (apps-script.gs in this repo — see SETUP.md). The bridge link is
 * stored ONLY in this device's localStorage ('et-sheet-config') —
 * never in code, never in the repo.
 *
 * The link alone connects when the bridge's TOKEN is blank. If the
 * script has a TOKEN set, the same token entered in Settings is sent
 * along with every request — the two must match exactly.
 */
(function () {
  'use strict';

  var LS_KEY = 'et-sheet-config';

  function getConfig() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { /* blocked/corrupt */ }
    return { url: c.url || '', token: c.token || '' };
  }
  function saveConfig(cfg) {
    try {
      var out = { url: (cfg && cfg.url || '').trim() };
      /* A token is only ever kept if one is passed in explicitly or a
       * legacy config already holds one — the Settings UI sends just
       * the URL, and must not silently wipe a working legacy token. */
      var token = '';
      if (cfg && Object.prototype.hasOwnProperty.call(cfg, 'token')) token = String(cfg.token || '').trim();
      else token = getConfig().token;
      if (token) out.token = token;
      localStorage.setItem(LS_KEY, JSON.stringify(out));
    } catch (e) { /* storage blocked */ }
  }
  function isConfigured() {
    var c = getConfig();
    return !!c.url;
  }

  /* Case-insensitive header lookup over a bridge row object. */
  function pick(row, names) {
    var keys = Object.keys(row || {});
    for (var n = 0; n < names.length; n++) {
      for (var k = 0; k < keys.length; k++) {
        if (keys[k].trim().toLowerCase() === names[n]) return row[keys[k]];
      }
    }
    return undefined;
  }
  function num(v, dflt) {
    var n = Number(v);
    return isFinite(n) ? n : dflt;
  }
  function str(v) { return v == null ? '' : String(v).trim(); }

  /* Bridge row (keyed by the sheet's header names) → the same item
   * shape the rest of the app uses. Headers are matched by NAME,
   * trimmed and case-insensitive (see pick()). The real inventory
   * sheet's headers are its own, so each field lists the real header
   * first and the legacy aliases after it:
   *   Item ID → id · Description → name (the human-readable name),
   *   with Name (the part code) becoming the item's sku · Image →
   *   photo · Location → bin (the RAW string — 'Shelf 59', 'EC42' —
   *   never parsed, never defaulted) · Vendor → supplier ·
   *   Quantity → qty (blank = 0) · Category → category.
   * When a row has no Description, Name is the display name and the
   * sku falls back to the legacy SKU / Part Number columns. */
  function normalizeRow(row, idx, usedIds) {
    var desc = str(pick(row, ['description']));
    var code = str(pick(row, ['name']));
    var legacySku = str(pick(row, ['sku', 'part number', 'partnumber']));
    var name, sku;
    if (desc) { name = desc; sku = code || legacySku; }
    else { name = code; sku = legacySku; }
    var id = str(pick(row, ['item id', 'id']));
    if (!id) {
      id = (name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
      id = id + '-r' + (idx + 2);   // no id in the sheet — synthesize one from the row
    }
    if (usedIds[id]) { var base = id, n = 2; while (usedIds[base + '-' + n]) n++; id = base + '-' + n; }
    usedIds[id] = true;
    var level = num(pick(row, ['level']), 2);
    level = Math.min(4, Math.max(1, Math.floor(level) || 2));
    return {
      id: id,
      name: name || id,
      sku: sku,
      qty: Math.max(0, Math.floor(num(pick(row, ['quantity', 'qty']), 0))),
      bin: str(pick(row, ['location', 'bin'])),
      level: level,
      supplier: str(pick(row, ['vendor', 'supplier'])),
      cost: num(pick(row, ['cost', 'price']), 0),
      icon: str(pick(row, ['icon'])) || 'box',
      category: str(pick(row, ['category', 'folder'])),
      nfcId: str(pick(row, ['nfc id', 'nfcid', 'nfc'])),
      photo: str(pick(row, ['image', 'photo', 'photo url', 'image url'])),
      updated: str(pick(row, ['updated', 'last updated']))
    };
  }

  /* Canonical op fields (from ETData — item-shaped: name, sku, qty,
   * bin, supplier, category, icon, nfcId, photo) → this sheet's
   * header names, applied at the bridge boundary so the rest of the
   * app never has to know the sheet's column titles. A qty op posts
   * ONLY { Quantity } (the bridge stamps Updated if that column
   * exists). Edit/add post the full set: the human name goes back to
   * Description and the part code to Name — the mirror of the read
   * mapping. Guard: an item with no part code (its name came FROM
   * the Name column) writes its name to Name and leaves Description
   * untouched, instead of blanking the code column. The bridge
   * applies each field by header name and skips any column the sheet
   * doesn't have (Icon / NFC ID on sheets without those columns). */
  function toSheetFields(op) {
    var f = (op && op.fields) || {};
    if (op && op.kind === 'qty') return { Quantity: f.qty };
    var out = {};
    if (f.sku) { out.Description = f.name; out.Name = f.sku; }
    else if (f.name != null) out.Name = f.name;
    out.Quantity = f.qty;
    out.Location = f.bin;
    out.Vendor = f.supplier;
    if (f.photo) out.Image = f.photo;
    out.Category = f.category;
    out.Icon = f.icon;
    out['NFC ID'] = f.nfcId;
    return out;
  }

  /* A failed fetch surfaces as a raw platform string ("Load failed" on
   * iOS, "Failed to fetch" on Chrome). Translate it into the two checks
   * that actually fix it: right link shape, and Anyone access. */
  function unreachable(err) {
    return 'Could not reach the Sheet link (' + String((err && err.message) || err) + '). ' +
      'Check that it is the Web app link from Deploy (script.google.com/macros/s/…, ending in /exec) ' +
      'and that the deployment access is set to Anyone.';
  }

  function notConfigured() {
    return { ok: false, mode: 'sheet', rows: 0, items: [],
             message: 'Google Sheet is not connected — paste the Sheet link (the Web app link from Deploy, ending in /exec) in Settings → Google Sheet.' };
  }

  function fetchRows() {
    if (!isConfigured()) return Promise.resolve(notConfigured());
    var c = getConfig();
    var url = c.url + (c.url.indexOf('?') === -1 ? '?' : '&') + 'action=rows';
    if (c.token) url += '&token=' + encodeURIComponent(c.token);  // legacy setups only
    return fetch(url).then(function (res) { return res.text(); }).then(function (text) {
      var body = null;
      try { body = JSON.parse(text); } catch (e) { /* non-JSON body */ }
      if (!body) throw new Error('Sheet bridge returned a non-JSON response — check the Web App URL (it should end in /exec) and that the deployment is live.');
      if (body.ok === false) throw new Error(body.error || 'Sheet bridge error');
      var rawRows = Array.isArray(body) ? body : (body.rows || []);
      var usedIds = {};
      var items = rawRows.map(function (r, i) { return normalizeRow(r, i, usedIds); });
      return { ok: true, mode: 'sheet', rows: rawRows.length, items: items,
               message: 'Connected. Google Sheet returned ' + rawRows.length + ' row(s).' };
    }).catch(function (err) {
      return { ok: false, mode: 'sheet', rows: 0, items: [], message: unreachable(err) };
    });
  }

  /* ops: [{ id, kind: 'qty'|'edit'|'add', fields: {canonical fields} }]
   * Fields are translated to the sheet's header names here
   * (toSheetFields) before anything is sent.
   * Sent as text/plain on purpose: Apps Script web apps don't answer
   * CORS preflight (OPTIONS), and a "simple" content type avoids one. */
  function flushOps(ops) {
    if (!isConfigured()) return Promise.resolve({ ok: false, results: [], message: notConfigured().message });
    var c = getConfig();
    var payload = { ops: (ops || []).map(function (op) {
      return { id: op.id, kind: op.kind, fields: toSheetFields(op) };
    }) };
    if (c.token) payload.token = c.token;  // legacy setups only
    return fetch(c.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (res) { return res.text(); }).then(function (text) {
      var body = null;
      try { body = JSON.parse(text); } catch (e) { /* non-JSON body */ }
      if (!body) throw new Error('Sheet bridge returned a non-JSON response — check the Web App URL (it should end in /exec) and that the deployment is live.');
      if (body.ok === false && !body.results) throw new Error(body.error || 'Sheet bridge error');
      return { ok: true, results: body.results || [] };
    }).catch(function (err) {
      return { ok: false, results: [], message: unreachable(err) };
    });
  }

  function testConnection() {
    return fetchRows().then(function (r) {
      return { ok: r.ok, mode: 'sheet', rows: r.rows, message: r.message };
    });
  }

  window.ETSheets = {
    getConfig: getConfig, saveConfig: saveConfig, isConfigured: isConfigured,
    fetchRows: fetchRows, flushOps: flushOps, testConnection: testConnection,
    toSheetFields: toSheetFields
  };
})();
