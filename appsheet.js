/* appsheet.js — data layer for Electric Trailer inventory PWA.
 *
 * Backends (Settings → Backend; stored in localStorage 'et-backend'):
 *  - Demo mode (default): items live in localStorage, seeded from DEMO data.
 *    Every change is recorded in a sync queue; "Sync now" marks them synced.
 *  - AppSheet mode: when an AppSheet Access Key + table name are saved in
 *    Settings (stored ONLY in this device's localStorage — never in code),
 *    changes are sent to the AppSheet API and "Test connection" runs a
 *    real Find action against the app.
 *  - Google Sheet mode: syncs directly to the backend spreadsheet via
 *    the Apps Script bridge in sheets.js (window.ETSheets) — rows are
 *    pulled into local items, and the queue flushes as bridge ops.
 *
 * AppSheet API docs: POST https://api.appsheet.com/api/v2/apps/{appId}/tables/{table}/Action
 * Header: ApplicationAccessKey: <key>
 */
(function () {
  'use strict';

  var LS = {
    items: 'et.items.v1',
    suppliers: 'et.suppliers.v1',
    queue: 'et.queue.v1',
    settings: 'et.settings.v1',
    meta: 'et.meta.v1'
  };

  var DEFAULT_SETTINGS = {
    appId: 'bd77482b-d437-4804-a3ef-fc2815feff2e',
    table: 'Inventory',
    accessKey: ''
  };

  var DEMO_SUPPLIERS = [
    { id: 'sup-dexter',   name: 'Dexter Axle Supply',  leadTime: '3-5 days',  contact: 'Parts desk',  phone: '(555) 010-2201', email: 'orders@example.com' },
    { id: 'sup-etrailer', name: 'eTrailer Wholesale',  leadTime: '2-4 days',  contact: 'Sam R.',      phone: '(555) 010-8840', email: 'wholesale@example.com' },
    { id: 'sup-redneck',  name: 'Redneck Trailer Co.', leadTime: '5-7 days',  contact: 'Dana W.',     phone: '(555) 010-3317', email: 'sales@example.com' },
    { id: 'sup-solar',    name: 'SunSpark Solar',      leadTime: '7-10 days', contact: 'Priya K.',    phone: '(555) 010-9025', email: 'support@example.com' },
    { id: 'sup-general',  name: 'General Trailer Parts', leadTime: '1-3 days', contact: 'Front counter', phone: '(555) 010-1173', email: 'counter@example.com' }
  ];

  var DEMO_ITEMS = [
    { id: 'brake-controller',  name: 'Brake Controller',        sku: 'ET-BRK-101', qty: 14, bin: 'A1', level: 3, supplier: 'eTrailer Wholesale',   cost: 89.99,  icon: 'controller', nfcId: '', updated: '' },
    { id: 'wiring-harness-7pin', name: '7-Pin Wiring Harness',  sku: 'ET-WIR-207', qty: 32, bin: 'A2', level: 2, supplier: 'General Trailer Parts', cost: 24.50, icon: 'plug', nfcId: '', updated: '' },
    { id: 'led-tail-light',    name: 'LED Tail Light',          sku: 'ET-LGT-310', qty: 48, bin: 'A3', level: 3, supplier: 'General Trailer Parts', cost: 18.75, icon: 'light', nfcId: '', updated: '' },
    { id: 'trailer-tire',      name: 'Trailer Tire ST205/75R15', sku: 'ET-TIR-415', qty: 9,  bin: 'D1', level: 1, supplier: 'Redneck Trailer Co.',  cost: 112.00, icon: 'tire', nfcId: '', updated: '' },
    { id: 'axle-3500',         name: '3500 lb Axle',            sku: 'ET-AXL-350', qty: 4,  bin: 'D3', level: 1, supplier: 'Dexter Axle Supply',   cost: 289.00, icon: 'axle', nfcId: '', updated: '' },
    { id: 'coupler-2in',       name: '2" Coupler',              sku: 'ET-CPL-020', qty: 21, bin: 'B1', level: 2, supplier: 'Dexter Axle Supply',   cost: 32.40,  icon: 'link', nfcId: '', updated: '' },
    { id: 'safety-chains',     name: 'Safety Chains (pair)',    sku: 'ET-CHN-050', qty: 5,  bin: 'B2', level: 2, supplier: 'General Trailer Parts', cost: 21.99, icon: 'chain', nfcId: '', updated: '' },
    { id: 'tongue-jack',       name: 'Tongue Jack',             sku: 'ET-JCK-700', qty: 7,  bin: 'B3', level: 2, supplier: 'Redneck Trailer Co.',  cost: 64.95,  icon: 'jack', nfcId: '', updated: '' },
    { id: 'battery-12v',       name: '12V Deep-Cycle Battery',  sku: 'ET-BAT-120', qty: 11, bin: 'C1', level: 1, supplier: 'SunSpark Solar',       cost: 139.00, icon: 'battery', nfcId: '', updated: '' },
    { id: 'power-inverter',    name: 'Power Inverter 2000W',    sku: 'ET-INV-200', qty: 3,  bin: 'C2', level: 2, supplier: 'SunSpark Solar',       cost: 219.00, icon: 'bolt', nfcId: '', updated: '' },
    { id: 'solar-kit',         name: 'Solar Panel Kit 200W',    sku: 'ET-SOL-200', qty: 6,  bin: 'C3', level: 1, supplier: 'SunSpark Solar',       cost: 349.00, icon: 'solar', nfcId: '', updated: '' },
    { id: 'hub-assembly',      name: 'Hub Assembly 5-Lug',      sku: 'ET-HUB-505', qty: 16, bin: 'B4', level: 2, supplier: 'Dexter Axle Supply',   cost: 58.25,  icon: 'hub', nfcId: '', updated: '' },
    { id: 'leaf-spring',       name: 'Leaf Spring 4-Leaf',      sku: 'ET-SPR-440', qty: 2,  bin: 'D4', level: 1, supplier: 'Dexter Axle Supply',   cost: 74.80,  icon: 'spring', nfcId: '', updated: '' },
    { id: 'fender-single',     name: 'Single-Axle Fender',      sku: 'ET-FND-010', qty: 8,  bin: 'D2', level: 1, supplier: 'Redneck Trailer Co.',  cost: 46.60,  icon: 'fender', nfcId: '', updated: '' },
    { id: 'winch-2500',        name: 'Winch 2500 lb',           sku: 'ET-WIN-250', qty: 5,  bin: 'C4', level: 1, supplier: 'eTrailer Wholesale',   cost: 129.99, icon: 'hook', nfcId: '', updated: '' },
    { id: 'wiring-kit',        name: 'Wiring Kit Complete',     sku: 'ET-WIR-900', qty: 19, bin: 'A4', level: 2, supplier: 'eTrailer Wholesale',   cost: 39.95,  icon: 'kit', nfcId: '', updated: '' },
    { id: 'breakaway-kit',     name: 'Breakaway Kit',           sku: 'ET-BRK-900', qty: 1,  bin: 'A5', level: 3, supplier: 'eTrailer Wholesale',   cost: 54.30,  icon: 'alert', nfcId: '', updated: '' },
    { id: 'reflector-set',     name: 'Reflector Set (12 pc)',   sku: 'ET-RFL-012', qty: 0,  bin: 'A6', level: 4, supplier: 'General Trailer Parts', cost: 9.99, icon: 'diamond', nfcId: '', updated: '' }
  ];

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage full/blocked */ }
  }
  function nowISO() { return new Date().toISOString(); }

  function seedIfNeeded() {
    var existing = read(LS.items, null);
    if (!existing) {
      var items = DEMO_ITEMS.map(function (it) {
        var copy = Object.assign({}, it); copy.updated = nowISO(); return copy;
      });
      write(LS.items, items);
    } else {
      // Location levels (v15): backfill demo items saved before `level`
      // existed, matched by id from the demo set. Other items keep theirs.
      var levelsById = {};
      DEMO_ITEMS.forEach(function (it) { levelsById[it.id] = it.level; });
      var changed = false;
      existing.forEach(function (it) {
        var ok = Number(it.level) >= 1 && Number(it.level) <= 4;
        if (!ok && levelsById[it.id]) { it.level = levelsById[it.id]; changed = true; }
      });
      if (changed) write(LS.items, existing);
    }
    if (!read(LS.suppliers, null)) write(LS.suppliers, DEMO_SUPPLIERS);
    if (!read(LS.queue, null)) write(LS.queue, []);
    if (!read(LS.meta, null)) write(LS.meta, { lastSync: '', lastError: '' });
  }
  seedIfNeeded();

  function getSettings() {
    var s = read(LS.settings, null) || {};
    return {
      appId: s.appId || DEFAULT_SETTINGS.appId,
      table: s.table || DEFAULT_SETTINGS.table,
      accessKey: s.accessKey || ''
    };
  }
  function saveSettings(s) {
    write(LS.settings, {
      appId: (s.appId || '').trim(),
      table: (s.table || '').trim() || DEFAULT_SETTINGS.table,
      accessKey: (s.accessKey || '').trim()
    });
  }
  function appSheetConfigured() {
    var s = getSettings();
    return !!(s.accessKey && s.table && s.appId);
  }

  /* ---------- Backend selection: 'demo' | 'appsheet' | 'sheet' ----------
   * Stored in localStorage 'et-backend'. With nothing stored, behavior
   * matches the original app: AppSheet when an Access Key is saved,
   * Demo otherwise. 'sheet' = the direct Google Sheet bridge (sheets.js,
   * window.ETSheets). activeBackend() is the EFFECTIVE backend — a
   * chosen-but-unconfigured backend falls back to 'demo'. */
  var BACKEND_KEY = 'et-backend';
  function getBackend() {
    var m = null;
    try { m = localStorage.getItem(BACKEND_KEY); } catch (e) { /* storage blocked */ }
    if (m === 'demo' || m === 'appsheet' || m === 'sheet') return m;
    return appSheetConfigured() ? 'appsheet' : 'demo';
  }
  function setBackend(mode) {
    if (mode !== 'demo' && mode !== 'appsheet' && mode !== 'sheet') mode = 'demo';
    try { localStorage.setItem(BACKEND_KEY, mode); } catch (e) { /* storage blocked */ }
    return mode;
  }
  function sheetConfigured() {
    return !!(window.ETSheets && window.ETSheets.isConfigured());
  }
  function activeBackend() {
    var m = getBackend();
    if (m === 'sheet') return sheetConfigured() ? 'sheet' : 'demo';
    if (m === 'appsheet') return appSheetConfigured() ? 'appsheet' : 'demo';
    return 'demo';
  }
  function isLive() { return activeBackend() !== 'demo'; }

  function getItems() { return read(LS.items, []); }
  function getSuppliers() { return read(LS.suppliers, []); }
  function getItem(id) {
    return getItems().filter(function (i) { return i.id === id; })[0] || null;
  }
  function getQueue() { return read(LS.queue, []); }
  function getMeta() { return read(LS.meta, { lastSync: '', lastError: '' }); }
  function setMeta(patch) {
    var m = getMeta(); Object.assign(m, patch); write(LS.meta, m);
  }

  function queueChange(type, itemId, detail) {
    var q = getQueue();
    q.push({ id: 'q' + Date.now() + Math.random().toString(36).slice(2, 7), type: type, itemId: itemId, detail: detail, at: nowISO(), synced: false });
    write(LS.queue, q);
    return q.length;
  }

  /* Qty edits coalesce (SPEC PLATE): repeated edits to the same item merge
   * into ONE pending op that keeps the ORIGINAL baseline qty (baseQty) and
   * carries the latest qty. An edit that returns qty to the baseline drops
   * the op entirely, and no-op edits never reach this function. The op
   * shape stays flush-compatible: type !== 'add' flushes as an Edit with
   * the item's current row. */
  function qtyDetail(item, from, to) {
    var d = to - from;
    return item.name + ' · ' + from + ' → ' + to + ' (' + (d > 0 ? '+' : '') + d + ')';
  }
  function queueQty(item, beforeQty, afterQty) {
    var q = getQueue();
    var idx = -1;
    for (var i = q.length - 1; i >= 0; i--) {
      if (!q[i].synced && q[i].itemId === item.id && q[i].kind === 'qty') { idx = i; break; }
    }
    if (idx >= 0) {
      var op = q[idx];
      if (afterQty === op.baseQty) q.splice(idx, 1);   // back at baseline — nothing to send
      else {
        op.qty = afterQty;
        op.type = 'qty';
        op.detail = qtyDetail(item, op.baseQty, afterQty);
        op.at = nowISO();
      }
    } else if (afterQty !== beforeQty) {
      q.push({ id: 'q' + Date.now() + Math.random().toString(36).slice(2, 7), type: 'qty', kind: 'qty', itemId: item.id, baseQty: beforeQty, qty: afterQty, detail: qtyDetail(item, beforeQty, afterQty), at: nowISO(), synced: false });
    }
    write(LS.queue, q);
  }

  function saveItems(items) { write(LS.items, items); }

  function updateQty(id, delta) {
    var items = getItems();
    var item = items.filter(function (i) { return i.id === id; })[0];
    if (!item) return null;
    var before = item.qty;
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === before) return item;   // no-op edits never queue
    item.updated = nowISO();
    saveItems(items);
    queueQty(item, before, item.qty);
    return item;
  }

  /* Set an absolute qty (exact-count entry, count mode, undo). Same
   * coalescing rules as updateQty. */
  function setQty(id, qty) {
    var items = getItems();
    var item = items.filter(function (i) { return i.id === id; })[0];
    if (!item) return null;
    var before = item.qty;
    item.qty = Math.max(0, Math.floor(Number(qty) || 0));
    if (item.qty === before) return item;
    item.updated = nowISO();
    saveItems(items);
    queueQty(item, before, item.qty);
    return item;
  }

  function addItem(data) {
    var items = getItems();
    var base = (data.name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
    var id = base, n = 2;
    while (items.some(function (i) { return i.id === id; })) id = base + '-' + (n++);
    var item = {
      id: id,
      name: data.name, sku: data.sku || ('ET-' + Math.floor(100 + Math.random() * 900)),
      qty: Number(data.qty) || 0, bin: data.bin || 'A1', level: Math.min(4, Math.max(1, Number(data.level) || 2)),
      supplier: data.supplier || '', cost: Number(data.cost) || 0,
      icon: data.icon || 'box', nfcId: '', updated: nowISO()
    };
    items.push(item);
    saveItems(items);
    queueChange('add', id, 'New item: ' + item.name);
    return item;
  }

  function apiUrl() {
    var s = getSettings();
    return 'https://api.appsheet.com/api/v2/apps/' + encodeURIComponent(s.appId) +
           '/tables/' + encodeURIComponent(s.table) + '/Action';
  }

  function apiAction(action, rows) {
    var s = getSettings();
    return fetch(apiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'ApplicationAccessKey': s.accessKey },
      body: JSON.stringify({ Action: action, Properties: { Locale: 'en-US' }, Rows: rows || [] })
    }).then(function (res) {
      return res.text().then(function (text) {
        var body = null;
        try { body = JSON.parse(text); } catch (e) { /* non-JSON body */ }
        if (!res.ok) {
          var msg = (body && (body.error || body.Message)) || text || ('HTTP ' + res.status);
          throw new Error('AppSheet API ' + res.status + ': ' + String(msg).slice(0, 300));
        }
        return body;
      });
    });
  }

  /* Sheet mode: pull the inventory rows from the Google Sheet and make
   * them the local items — the sheet is the source of truth. Two local
   * protections: an item with a qty change still queued keeps its local
   * qty (the queue will push it), and an item added on this device that
   * isn't in the sheet yet is kept until its 'add' op flushes. */
  function refreshFromBackend() {
    if (activeBackend() !== 'sheet' || !window.ETSheets) {
      return Promise.resolve({ ok: false, skipped: true, message: 'Not in Google Sheet mode.' });
    }
    return window.ETSheets.fetchRows().then(function (res) {
      if (!res.ok) { setMeta({ lastError: res.message }); return res; }
      var pendingQty = {}, pendingAdd = {};
      getQueue().forEach(function (c) {
        if (c.synced) return;
        if (c.type === 'add') pendingAdd[c.itemId] = true;
        else if (c.kind === 'qty' || c.type === 'qty') pendingQty[c.itemId] = true;
      });
      var localById = {};
      getItems().forEach(function (i) { localById[i.id] = i; });
      var seen = {};
      var merged = res.items.map(function (fi) {
        seen[fi.id] = true;
        var li = localById[fi.id];
        if (li && pendingQty[fi.id]) return Object.assign({}, fi, { qty: li.qty, updated: li.updated });
        return fi;
      });
      getItems().forEach(function (li) {
        if (pendingAdd[li.id] && !seen[li.id]) merged.push(li);
      });
      write(LS.items, merged);
      setMeta({ lastSync: nowISO(), lastError: '', sheetRows: res.rows });
      return { ok: true, mode: 'sheet', rows: res.rows, message: res.message };
    }).catch(function (err) {
      var msg = String((err && err.message) || err);
      setMeta({ lastError: msg });
      return { ok: false, mode: 'sheet', message: msg };
    });
  }

  function testConnection() {
    var active = activeBackend();
    if (active === 'sheet') {
      return window.ETSheets.testConnection().then(function (r) {
        if (!r.ok) { setMeta({ lastError: r.message }); return r; }
        setMeta({ lastError: '' });
        // A good test also imports the rows, so the app shows real data.
        return refreshFromBackend().then(function () { return r; });
      });
    }
    if (active !== 'appsheet') {
      return Promise.resolve({ ok: false, mode: 'demo', message: 'Demo mode — pick AppSheet or Google Sheet under Backend in Settings, add its connection details, then test again.' });
    }
    return apiAction('Find', [])
      .then(function (body) {
        var rows = Array.isArray(body) ? body.length : (body && body.Rows ? body.Rows.length : 0);
        setMeta({ lastError: '', lastSync: nowISO() });
        return { ok: true, mode: 'live', message: 'Connected. AppSheet returned ' + rows + ' row(s) from "' + getSettings().table + '".', rows: rows };
      })
      .catch(function (err) {
        setMeta({ lastError: String(err.message || err) });
        return { ok: false, mode: 'live', message: String(err.message || err) + ' — If AppSheet says the app is not deployed / plan upgrade needed, a deployment check needs to be run in AppSheet first (see SETUP.md).' };
      });
  }

  /* Sheet-mode flush: translate pending queue entries into bridge ops
   * and send them in one POST. Qty ops send just the new Qty (the
   * bridge stamps Updated); adds/edits send the full field set.
   * An op is marked synced only when the bridge's per-op result says
   * ok — partial progress is kept, failures stay queued. */
  function sheetFields(item, full) {
    if (!full) return { Qty: item.qty };
    var f = {
      Name: item.name, SKU: item.sku, Qty: item.qty, Bin: item.bin,
      Level: item.level || 2, Supplier: item.supplier, Cost: item.cost,
      Icon: item.icon || 'box', 'NFC ID': item.nfcId || ''
    };
    if (item.photo) f.Photo = item.photo;
    return f;
  }
  function flushViaSheet(q, pending) {
    var itemsById = {};
    getItems().forEach(function (i) { itemsById[i.id] = i; });
    var jobs = [];
    pending.forEach(function (c) {
      var item = itemsById[c.itemId];
      if (!item) { c.synced = true; c.syncedAt = nowISO(); return; }
      var kind = c.type === 'add' ? 'add' : ((c.kind === 'qty' || c.type === 'qty') ? 'qty' : 'edit');
      jobs.push({ entry: c, op: { id: item.id, kind: kind, fields: sheetFields(item, kind !== 'qty') } });
    });
    if (!jobs.length) {
      write(LS.queue, q.slice(-200));
      setMeta({ lastSync: nowISO(), lastError: '' });
      return Promise.resolve({ ok: true, flushed: pending.length, message: 'Synced ' + pending.length + ' change(s) to the Google Sheet.' });
    }
    return window.ETSheets.flushOps(jobs.map(function (j) { return j.op; })).then(function (res) {
      if (!res.ok) throw new Error(res.message || 'Sheet bridge unreachable.');
      var byId = {};
      (res.results || []).forEach(function (r) { if (r && r.id && !byId[r.id]) byId[r.id] = r; });
      var failed = [];
      jobs.forEach(function (j) {
        var r = byId[j.op.id];
        if (r && r.ok) { j.entry.synced = true; j.entry.syncedAt = nowISO(); }
        else failed.push(j.op.id + (r && r.error ? ' (' + r.error + ')' : ' (no result)'));
      });
      write(LS.queue, q.slice(-200));
      if (failed.length) throw new Error(failed.length + ' change(s) rejected by the sheet: ' + failed.join(', '));
      setMeta({ lastSync: nowISO(), lastError: '' });
      return { ok: true, flushed: pending.length, message: 'Synced ' + pending.length + ' change(s) to the Google Sheet.' };
    }).catch(function (err) {
      write(LS.queue, q.slice(-200));
      setMeta({ lastError: String((err && err.message) || err) });
      return { ok: false, flushed: 0, message: 'Sheet sync failed: ' + String((err && err.message) || err) };
    });
  }

  /* Flush the pending queue. Demo mode: mark synced locally.
     Live mode: send an Edit for qty changes / Add for new items; if any call
     fails, keep the queue and record the error honestly. */
  function flushQueue() {
    var q = getQueue();
    var pending = q.filter(function (c) { return !c.synced; });
    if (!pending.length) return Promise.resolve({ ok: true, flushed: 0, message: 'Queue is already empty.' });
    if (!navigator.onLine) return Promise.resolve({ ok: false, flushed: 0, message: 'Still offline — changes stay queued.' });
    if (!isLive()) {
      // Keep full history with synced flags, capped at the newest 200:
      write(LS.queue, q.map(function (c) { return c.synced ? c : Object.assign({}, c, { synced: true, syncedAt: nowISO() }); }).slice(-200));
      setMeta({ lastSync: nowISO(), lastError: '' });
      return Promise.resolve({ ok: true, flushed: pending.length, message: 'Demo sync complete — ' + pending.length + ' change(s) marked synced locally.' });
    }
    if (activeBackend() === 'sheet') return flushViaSheet(q, pending);
    var itemsById = {};
    getItems().forEach(function (i) { itemsById[i.id] = i; });
    var chain = Promise.resolve();
    pending.forEach(function (c) {
      chain = chain.then(function () {
        var item = itemsById[c.itemId];
        if (!item) { c.synced = true; c.syncedAt = nowISO(); return; }
        var row = { Id: item.id, Name: item.name, SKU: item.sku, Qty: item.qty, Bin: item.bin, Level: item.level || 2, Supplier: item.supplier, Cost: item.cost };
        return apiAction(c.type === 'add' ? 'Add' : 'Edit', [row]).then(function () {
          c.synced = true; c.syncedAt = nowISO();
        });
      });
    });
    return chain.then(function () {
      write(LS.queue, q.slice(-200));
      var stillPending = q.filter(function (c) { return !c.synced; }).length;
      if (stillPending) throw new Error(stillPending + ' change(s) could not be sent.');
      setMeta({ lastSync: nowISO(), lastError: '' });
      return { ok: true, flushed: pending.length, message: 'Synced ' + pending.length + ' change(s) to AppSheet.' };
    }).catch(function (err) {
      write(LS.queue, q.slice(-200));
      setMeta({ lastError: String(err.message || err) });
      return { ok: false, flushed: 0, message: 'Live sync failed: ' + String(err.message || err) };
    });
  }

  function resetDemo() {
    [LS.items, LS.suppliers, LS.queue, LS.meta].forEach(function (k) { localStorage.removeItem(k); });
    seedIfNeeded();
  }

  window.ETData = {
    getSettings: getSettings, saveSettings: saveSettings, isLive: isLive,
    getBackend: getBackend, setBackend: setBackend, activeBackend: activeBackend,
    getItems: getItems, getSuppliers: getSuppliers, getItem: getItem,
    getQueue: getQueue, getMeta: getMeta,
    updateQty: updateQty, setQty: setQty, addItem: addItem,
    testConnection: testConnection, flushQueue: flushQueue, resetDemo: resetDemo,
    refreshFromBackend: refreshFromBackend,
    stickerUrl: function (id) { return 'https://masstahl.github.io/electric-trailer/?item=' + encodeURIComponent(id); }
  };
})();
