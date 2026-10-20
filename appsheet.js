/* appsheet.js — data layer for Electric Trailer inventory PWA.
 * (File name kept from the app's first backend; the AppSheet API
 * provider below is dormant — no Settings UI reaches it anymore.)
 *
 * Backends (resolved automatically — there is no chooser in Settings):
 *  - Local mode (default): items live in localStorage only. A fresh
 *    install starts EMPTY; every change is recorded in a sync queue
 *    and "Sync now" marks them synced locally.
 *  - Google Sheet mode: when a Sheet link is saved in Settings, the
 *    app syncs directly to the inventory spreadsheet via the Apps
 *    Script bridge in sheets.js (window.ETSheets) — rows are pulled
 *    into local items, and the queue flushes as bridge ops.
 */
(function () {
  'use strict';

  var LS = {
    items: 'et.items.v1',
    suppliers: 'et.suppliers.v1',
    queue: 'et.queue.v1',
    settings: 'et.settings.v1',
    meta: 'et.meta.v1',
    categories: 'et-categories'
  };

  var DEFAULT_SETTINGS = {
    appId: 'bd77482b-d437-4804-a3ef-fc2815feff2e',
    table: 'Inventory',
    accessKey: ''
  };

  /* No demo inventory anymore: a fresh install starts with zero items
   * and fills from the connected Google Sheet (or manual adds). The
   * old demo seed ids are kept ONLY so a successful sheet import can
   * retire leftover demo stock from devices that ran the old seed
   * (see the purge in refreshFromBackend). */
  var DEMO_ITEMS = [];
  var DEMO_SEED_IDS = [
    'brake-controller', 'wiring-harness-7pin', 'led-tail-light', 'trailer-tire',
    'axle-3500', 'coupler-2in', 'safety-chains', 'tongue-jack', 'battery-12v',
    'power-inverter', 'solar-kit', 'hub-assembly', 'leaf-spring', 'fender-single',
    'winch-2500', 'wiring-kit', 'breakaway-kit', 'reflector-set'
  ];

  /* ---------- Categories (home-screen folders) ----------
   * An item's folder is its `category` NAME — a plain string, so a
   * Category column in either backend maps 1:1. The folder list itself
   * lives in localStorage 'et-categories' as [{name, icon}].
   * 'Uncategorized' is a SYSTEM folder: never in the list, pinned last,
   * shown only while it holds items, not renameable or removable. */
  var UNCAT = 'Uncategorized';
  /* Fresh-install folder seeds — electrician job-site departments.
   * Seeded ONLY when no saved list exists; an existing device's
   * 'et-categories' is never overwritten by a new seed. */
  var DEFAULT_CATEGORIES = [
    { name: 'Wire & Cable', icon: 'link' },
    { name: 'Conduit & Fittings', icon: 'hex' },
    { name: 'Breakers & Panels', icon: 'controller' },
    { name: 'Boxes & Enclosures', icon: 'box' },
    { name: 'Devices & Plates', icon: 'plug' },
    { name: 'Lighting', icon: 'light' },
    { name: 'Fasteners & Hardware', icon: 'bolt' },
    { name: 'Tools & Supplies', icon: 'kit' }
  ];
  /* Fallback folder from an item's icon, for rows that arrive without
   * a Category value. Conservative on purpose: only unambiguous icons
   * map ('box' excluded — it is the default icon for everything);
   * anything else lands in Uncategorized for a human to file. */
  var CATEGORY_BY_ICON = {
    link: 'Wire & Cable', hex: 'Conduit & Fittings', controller: 'Breakers & Panels',
    plug: 'Devices & Plates', light: 'Lighting',
    bolt: 'Fasteners & Hardware', kit: 'Tools & Supplies'
  };

  /* Resolve an item's folder: its stored category name, else the icon
   * map, else Uncategorized. */
  function categoryForItem(it) {
    if (it && it.category && String(it.category).trim()) return String(it.category).trim();
    if (it && CATEGORY_BY_ICON[it.icon]) return CATEGORY_BY_ICON[it.icon];
    return UNCAT;
  }
  function getCategories() {
    var cats = read(LS.categories, null);
    if (!Array.isArray(cats)) {
      cats = DEFAULT_CATEGORIES.map(function (c) { return { name: c.name, icon: c.icon }; });
      write(LS.categories, cats);
    }
    return cats;
  }
  function saveCategories(cats) { write(LS.categories, cats); }
  function categoryNameTaken(name, except) {
    var n = String(name || '').trim().toLowerCase();
    if (!n) return false;
    var ex = String(except || '').trim().toLowerCase();
    if (n === UNCAT.toLowerCase() && ex !== n) return true;   // reserved system name
    return getCategories().some(function (c) {
      return c.name.toLowerCase() === n && c.name.toLowerCase() !== ex;
    });
  }
  function addCategory(name, icon) {
    var cats = getCategories();
    var base = String(name || '').trim() || 'New Folder';
    var candidate = base, n = 2;
    while (categoryNameTaken(candidate)) candidate = base + ' ' + (n++);
    var cat = { name: candidate, icon: icon || 'kit' };
    cats.push(cat);
    saveCategories(cats);
    return cat;
  }
  /* Rename a folder: updates the folder list AND every item in it, and
   * queues an 'edit' op per moved item so a live backend rewrites the
   * Category value on those rows. Empty/duplicate names are rejected. */
  function renameCategory(oldName, newName) {
    oldName = String(oldName || '').trim();
    newName = String(newName || '').trim();
    if (oldName === UNCAT) return { ok: false, error: 'system', message: 'The Uncategorized folder can\'t be renamed.' };
    if (!newName) return { ok: false, error: 'empty', message: 'Name can\'t be empty' };
    if (newName === oldName) return { ok: true, count: 0 };
    if (categoryNameTaken(newName, oldName)) return { ok: false, error: 'duplicate', message: 'A folder named “' + newName + '” already exists' };
    var cats = getCategories();
    var found = false;
    cats.forEach(function (c) { if (c.name === oldName) { c.name = newName; found = true; } });
    if (!found) cats.push({ name: newName, icon: 'box' });   // folder existed only via item values
    saveCategories(cats);
    var items = getItems(), movedIds = [];
    items.forEach(function (it) {
      if (categoryForItem(it) === oldName) { it.category = newName; movedIds.push(it.id); }
    });
    if (movedIds.length) {
      saveItems(items);
      movedIds.forEach(function (id) { queueChange('edit', id, 'Folder renamed: ' + oldName + ' → ' + newName); });
    }
    return { ok: true, count: movedIds.length };
  }
  /* Remove a folder: its items move to Uncategorized (never deleted),
   * each with a queued 'edit' op so the backend follows. */
  function removeCategory(name) {
    name = String(name || '').trim();
    if (name === UNCAT) return { ok: false, error: 'system', message: 'The Uncategorized folder can\'t be removed.' };
    saveCategories(getCategories().filter(function (c) { return c.name !== name; }));
    var items = getItems(), movedIds = [];
    items.forEach(function (it) {
      if (categoryForItem(it) === name) { it.category = UNCAT; movedIds.push(it.id); }
    });
    if (movedIds.length) {
      saveItems(items);
      movedIds.forEach(function (id) { queueChange('edit', id, 'Moved to Uncategorized (folder removed: ' + name + ')'); });
    }
    return { ok: true, moved: movedIds.length };
  }
  /* File ONE item into a folder (Sorting Kit: the auto-sort review,
   * Sort Mode, and the item-sheet folder rail all go through here).
   * Mirrors renameCategory's queueing: one 'edit' op per change — a
   * flush sends the item's full current row, Category included. The
   * op carries no `kind`, so a pending qty op for the same item (found
   * by kind 'qty') is never merged into or disturbed by it; both ops
   * survive side by side and both flush (see flushViaSheet). */
  function setCategory(id, folderName) {
    folderName = String(folderName == null ? '' : folderName).trim() || UNCAT;
    var items = getItems();
    var item = null;
    items.forEach(function (it) { if (it.id === id) item = it; });
    if (!item) return null;
    if (item.category === folderName && categoryForItem(item) === folderName) return item;   // already filed there
    var before = categoryForItem(item);
    item.category = folderName;
    item.updated = nowISO();
    saveItems(items);
    // Only queue when the item's effective folder actually changed —
    // materializing a fallback-resolved folder is a local tidy-up,
    // not a backend change.
    if (before !== folderName) queueChange('edit', id, 'Filed in ' + folderName + ': ' + item.name);
    return item;
  }
  /* SPEC PLATE status tiers, mirrored for folder summaries:
   * 0 = OUT, 1–2 = CRITICAL, 3–5 = LOW, 6+ = OK. */
  function statusTier(q) { return q <= 0 ? 'out' : (q <= 2 ? 'crit' : (q <= 5 ? 'low' : 'ok')); }
  var TIER_RANK = { out: 0, crit: 1, low: 2, ok: 3 };
  /* One summary per folder: the saved list first, then any category a
   * backend row introduced, with Uncategorized pinned last and shown
   * only while it holds items. worst/worstCount = the worst attention
   * tier present and how many items sit at it. */
  function folderStats() {
    var items = getItems();
    var order = getCategories().map(function (c) { return { name: c.name, icon: c.icon, system: false }; });
    var seen = {};
    order.forEach(function (o) { seen[o.name] = true; });
    items.forEach(function (it) {
      var n = categoryForItem(it);
      if (!seen[n]) { seen[n] = true; order.push({ name: n, icon: 'box', system: n === UNCAT }); }
    });
    order.sort(function (a, b) { return (a.system ? 1 : 0) - (b.system ? 1 : 0); });   // stable: system last
    return order.map(function (o) {
      var mine = items.filter(function (it) { return categoryForItem(it) === o.name; });
      var worst = null, worstCount = 0, rank = 3;
      mine.forEach(function (it) {
        var t = statusTier(it.qty);
        if (t === 'ok') return;
        if (TIER_RANK[t] < rank) { rank = TIER_RANK[t]; worst = t; worstCount = 1; }
        else if (t === worst) worstCount++;
      });
      return {
        name: o.name, icon: o.icon, system: o.system,
        count: mine.length,
        units: mine.reduce(function (s, i) { return s + i.qty; }, 0),
        worst: worst, worstCount: worstCount
      };
    }).filter(function (s) { return !s.system || s.count > 0; });
  }

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
      // Fresh install: zero items. Stock arrives via the Google Sheet
      // import or manual adds — there is no demo inventory to seed.
      write(LS.items, DEMO_ITEMS.slice());
    } else {
      // Backfill items saved before `category` existed — icon map,
      // else the system folder.
      var changed = false;
      existing.forEach(function (it) {
        if (!it.category || !String(it.category).trim()) { it.category = categoryForItem(it); changed = true; }
      });
      if (changed) write(LS.items, existing);
    }
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

  /* ---------- Backend resolution (no chooser UI anymore) ----------
   * Effective backend: 'sheet' when a Google Sheet link is saved on
   * this device, else 'demo' (local only). A stored 'et-backend' from
   * the old chooser — including 'appsheet' — is ignored for routing:
   * it can never strand a device on a backend with no UI. The
   * AppSheet API provider below stays in the file but is unreachable. */
  function sheetConfigured() {
    return !!(window.ETSheets && window.ETSheets.isConfigured());
  }
  function getBackend() {
    return sheetConfigured() ? 'sheet' : 'demo';
  }
  function setBackend(mode) {   // legacy API compat — routing is automatic now
    return getBackend();
  }
  function activeBackend() { return getBackend(); }
  function isLive() { return activeBackend() !== 'demo'; }

  function getItems() { return read(LS.items, []); }
  /* Supplier names are derived from the items themselves (the sheet's
   * Supplier column is free text) — unique, sorted, plain strings. */
  function getSuppliers() {
    var seen = {}, names = [];
    getItems().forEach(function (i) {
      var s = String(i.supplier || '').trim();
      if (s && !seen[s]) { seen[s] = true; names.push(s); }
    });
    return names.sort();
  }
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
      category: (data.category && String(data.category).trim()) || UNCAT,
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
      var pendingQty = {}, pendingAdd = {}, pendingEdit = {};
      getQueue().forEach(function (c) {
        if (c.synced) return;
        if (c.type === 'add') pendingAdd[c.itemId] = true;
        else if (c.kind === 'qty' || c.type === 'qty') pendingQty[c.itemId] = true;
        else if (c.type === 'edit') pendingEdit[c.itemId] = true;
      });
      var localById = {};
      getItems().forEach(function (i) { localById[i.id] = i; });
      var seen = {};
      var merged = res.items.map(function (fi) {
        seen[fi.id] = true;
        fi.category = categoryForItem(fi);   // row value, else icon fallback
        var li = localById[fi.id];
        // A category edit (e.g. a folder rename) still queued wins over
        // the sheet's older value until it flushes.
        if (li && pendingEdit[fi.id] && li.category) fi.category = li.category;
        if (li && pendingQty[fi.id]) return Object.assign({}, fi, { qty: li.qty, updated: li.updated });
        return fi;
      });
      getItems().forEach(function (li) {
        if (pendingAdd[li.id] && !seen[li.id]) merged.push(li);
      });
      /* Demo purge: a successful import retires leftover DEMO seed
       * items. A demo id that IS in the import is real now (it's in
       * `merged` via `seen`); one that is NOT in the import is dropped
       * — unless it still has pending queue ops, in which case it is
       * kept (appended here) so those ops flush or fail honestly
       * instead of vanishing with the item. */
      var seedIds = {};
      DEMO_SEED_IDS.forEach(function (id) { seedIds[id] = true; });
      var pendingAny = {};
      getQueue().forEach(function (c) { if (!c.synced) pendingAny[c.itemId] = true; });
      var inMerged = {};
      merged.forEach(function (it) { inMerged[it.id] = true; });
      getItems().forEach(function (li) {
        if (seedIds[li.id] && !seen[li.id] && pendingAny[li.id] && !inMerged[li.id]) merged.push(li);
      });
      merged = merged.filter(function (it) {
        return !(seedIds[it.id] && !seen[it.id] && !pendingAny[it.id]);
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
    if (activeBackend() === 'sheet') {
      return window.ETSheets.testConnection().then(function (r) {
        if (!r.ok) { setMeta({ lastError: r.message }); return r; }
        setMeta({ lastError: '' });
        // A good test also imports the rows, so the app shows real data.
        return refreshFromBackend().then(function () { return r; });
      });
    }
    return Promise.resolve({ ok: false, mode: 'demo', message: 'No Google Sheet connected yet — paste the Sheet link in Settings → Google Sheet, then tap Connect.' });
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
      Category: categoryForItem(item),
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
      /* Results come back in op order, but pair them by consuming each
       * result once: an item can have TWO jobs in one flush (e.g. a
       * qty op plus a category 'edit' op), and a first-match-by-id map
       * would hand both jobs the same result — marking a rejected
       * second op synced and silently dropping it from the queue. */
      var pool = (res.results || []).slice();
      var failed = [];
      jobs.forEach(function (j) {
        var r = null;
        for (var k = 0; k < pool.length; k++) {
          if (pool[k] && pool[k].id === j.op.id) { r = pool.splice(k, 1)[0]; break; }
        }
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
        var row = { Id: item.id, Name: item.name, SKU: item.sku, Qty: item.qty, Bin: item.bin, Level: item.level || 2, Supplier: item.supplier, Cost: item.cost, Category: categoryForItem(item) };
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
    [LS.items, LS.suppliers, LS.queue, LS.meta, LS.categories].forEach(function (k) { localStorage.removeItem(k); });
    seedIfNeeded();
  }

  window.ETData = {
    getSettings: getSettings, saveSettings: saveSettings, isLive: isLive,
    getBackend: getBackend, setBackend: setBackend, activeBackend: activeBackend,
    getItems: getItems, getSuppliers: getSuppliers, getItem: getItem,
    getQueue: getQueue, getMeta: getMeta,
    getCategories: getCategories, addCategory: addCategory,
    renameCategory: renameCategory, removeCategory: removeCategory, setCategory: setCategory,
    folderStats: folderStats, categoryFor: categoryForItem, UNCAT: UNCAT,
    updateQty: updateQty, setQty: setQty, addItem: addItem,
    testConnection: testConnection, flushQueue: flushQueue, resetDemo: resetDemo,
    refreshFromBackend: refreshFromBackend,
    stickerUrl: function (id) { return 'https://masstahl.github.io/electric-trailer/?item=' + encodeURIComponent(id); }
  };
})();
