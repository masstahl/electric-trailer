/* appsheet.js — data layer for Electric Trailer inventory PWA.
 *
 * Two modes:
 *  - Demo mode (default): items live in localStorage, seeded from DEMO data.
 *    Every change is recorded in a sync queue; "Sync now" marks them synced.
 *  - Live mode: when an AppSheet Access Key + table name are saved in the
 *    Sync tab (stored ONLY in this device's localStorage — never in code),
 *    changes are sent to the AppSheet API and "Test connection" runs a
 *    real Find action against the app.
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
    { id: 'brake-controller',  name: 'Brake Controller',        sku: 'ET-BRK-101', qty: 14, bin: 'A1', supplier: 'eTrailer Wholesale',   cost: 89.99,  icon: '🎛️', nfcId: '', updated: '' },
    { id: 'wiring-harness-7pin', name: '7-Pin Wiring Harness',  sku: 'ET-WIR-207', qty: 32, bin: 'A2', supplier: 'General Trailer Parts', cost: 24.50, icon: '🔌', nfcId: '', updated: '' },
    { id: 'led-tail-light',    name: 'LED Tail Light',          sku: 'ET-LGT-310', qty: 48, bin: 'A3', supplier: 'General Trailer Parts', cost: 18.75, icon: '💡', nfcId: '', updated: '' },
    { id: 'trailer-tire',      name: 'Trailer Tire ST205/75R15', sku: 'ET-TIR-415', qty: 9,  bin: 'D1', supplier: 'Redneck Trailer Co.',  cost: 112.00, icon: '🛞', nfcId: '', updated: '' },
    { id: 'axle-3500',         name: '3500 lb Axle',            sku: 'ET-AXL-350', qty: 4,  bin: 'D3', supplier: 'Dexter Axle Supply',   cost: 289.00, icon: '⚙️', nfcId: '', updated: '' },
    { id: 'coupler-2in',       name: '2" Coupler',              sku: 'ET-CPL-020', qty: 21, bin: 'B1', supplier: 'Dexter Axle Supply',   cost: 32.40,  icon: '🔗', nfcId: '', updated: '' },
    { id: 'safety-chains',     name: 'Safety Chains (pair)',    sku: 'ET-CHN-050', qty: 5,  bin: 'B2', supplier: 'General Trailer Parts', cost: 21.99, icon: '⛓️', nfcId: '', updated: '' },
    { id: 'tongue-jack',       name: 'Tongue Jack',             sku: 'ET-JCK-700', qty: 7,  bin: 'B3', supplier: 'Redneck Trailer Co.',  cost: 64.95,  icon: '🏗️', nfcId: '', updated: '' },
    { id: 'battery-12v',       name: '12V Deep-Cycle Battery',  sku: 'ET-BAT-120', qty: 11, bin: 'C1', supplier: 'SunSpark Solar',       cost: 139.00, icon: '🔋', nfcId: '', updated: '' },
    { id: 'power-inverter',    name: 'Power Inverter 2000W',    sku: 'ET-INV-200', qty: 3,  bin: 'C2', supplier: 'SunSpark Solar',       cost: 219.00, icon: '⚡', nfcId: '', updated: '' },
    { id: 'solar-kit',         name: 'Solar Panel Kit 200W',    sku: 'ET-SOL-200', qty: 6,  bin: 'C3', supplier: 'SunSpark Solar',       cost: 349.00, icon: '☀️', nfcId: '', updated: '' },
    { id: 'hub-assembly',      name: 'Hub Assembly 5-Lug',      sku: 'ET-HUB-505', qty: 16, bin: 'B4', supplier: 'Dexter Axle Supply',   cost: 58.25,  icon: '🎯', nfcId: '', updated: '' },
    { id: 'leaf-spring',       name: 'Leaf Spring 4-Leaf',      sku: 'ET-SPR-440', qty: 2,  bin: 'D4', supplier: 'Dexter Axle Supply',   cost: 74.80,  icon: '🌿', nfcId: '', updated: '' },
    { id: 'fender-single',     name: 'Single-Axle Fender',      sku: 'ET-FND-010', qty: 8,  bin: 'D2', supplier: 'Redneck Trailer Co.',  cost: 46.60,  icon: '🛡️', nfcId: '', updated: '' },
    { id: 'winch-2500',        name: 'Winch 2500 lb',           sku: 'ET-WIN-250', qty: 5,  bin: 'C4', supplier: 'eTrailer Wholesale',   cost: 129.99, icon: '🪝', nfcId: '', updated: '' },
    { id: 'wiring-kit',        name: 'Wiring Kit Complete',     sku: 'ET-WIR-900', qty: 19, bin: 'A4', supplier: 'eTrailer Wholesale',   cost: 39.95,  icon: '🧰', nfcId: '', updated: '' },
    { id: 'breakaway-kit',     name: 'Breakaway Kit',           sku: 'ET-BRK-900', qty: 1,  bin: 'A5', supplier: 'eTrailer Wholesale',   cost: 54.30,  icon: '🚨', nfcId: '', updated: '' },
    { id: 'reflector-set',     name: 'Reflector Set (12 pc)',   sku: 'ET-RFL-012', qty: 0,  bin: 'A6', supplier: 'General Trailer Parts', cost: 9.99, icon: '🔶', nfcId: '', updated: '' }
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
    if (!read(LS.items, null)) {
      var items = DEMO_ITEMS.map(function (it) {
        var copy = Object.assign({}, it); copy.updated = nowISO(); return copy;
      });
      write(LS.items, items);
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
  function isLive() {
    var s = getSettings();
    return !!(s.accessKey && s.table && s.appId);
  }

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

  function saveItems(items) { write(LS.items, items); }

  function updateQty(id, delta) {
    var items = getItems();
    var item = items.filter(function (i) { return i.id === id; })[0];
    if (!item) return null;
    item.qty = Math.max(0, item.qty + delta);
    item.updated = nowISO();
    saveItems(items);
    queueChange(delta > 0 ? 'qty+' + delta : 'qty' + delta, id, item.name + ' → ' + item.qty);
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
      qty: Number(data.qty) || 0, bin: data.bin || 'A1',
      supplier: data.supplier || '', cost: Number(data.cost) || 0,
      icon: data.icon || '📦', nfcId: '', updated: nowISO()
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

  function testConnection() {
    if (!isLive()) {
      return Promise.resolve({ ok: false, mode: 'demo', message: 'Demo mode — add an Access Key and table name to test a live AppSheet connection.' });
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
    var itemsById = {};
    getItems().forEach(function (i) { itemsById[i.id] = i; });
    var chain = Promise.resolve();
    pending.forEach(function (c) {
      chain = chain.then(function () {
        var item = itemsById[c.itemId];
        if (!item) { c.synced = true; c.syncedAt = nowISO(); return; }
        var row = { Id: item.id, Name: item.name, SKU: item.sku, Qty: item.qty, Bin: item.bin, Supplier: item.supplier, Cost: item.cost };
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
    getItems: getItems, getSuppliers: getSuppliers, getItem: getItem,
    getQueue: getQueue, getMeta: getMeta,
    updateQty: updateQty, addItem: addItem,
    testConnection: testConnection, flushQueue: flushQueue, resetDemo: resetDemo,
    stickerUrl: function (id) { return 'https://masstahl.github.io/electric-trailer/?item=' + encodeURIComponent(id); }
  };
})();
