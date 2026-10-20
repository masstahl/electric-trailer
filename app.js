/* app.js — Electric Trailer inventory PWA.
 * Screens (bottom tabs):
 *   Home      #08 Photo-First Grid (+ item detail #02 NFC Tap-to-Open)
 *   Map       #03 Warehouse / Bin Map
 *   Add       #22 Quick Add New Item
 *   Settings  Sync Queue (#16) + Sync Health + Appearance
 * Data layer lives in appsheet.js (window.ETData); the Google Sheet
 * bridge provider is sheets.js (window.ETSheets).
 */
(function () {
  'use strict';
  var D = window.ETData;
  var $ = function (id) { return document.getElementById(id); };
  var AISLES = ['A', 'B', 'C', 'D'];
  var BINS = [];
  AISLES.forEach(function (a) { for (var i = 1; i <= 6; i++) BINS.push(a + i); });
  /* Location model, two realities: an item added in the app (or a
   * sheet row whose Location matches the bin pattern) carries a coded
   * bin "B5" — shelf letter A–D + position 1–6 — plus item.level
   * (1-4, 1 = floor, 4 = top), shown in the notation short
   * "B · L4 · P5" / long "Shelf B · Level 4 · Position 5". A sheet
   * Location in free text ('Shelf 59', 'EC42', 'Shelf 58 Kit_5') is
   * NOT parsed or re-homed: cards and sheets show it verbatim, and
   * the shelf map simply has no A–D cell for it. */
  var LEVELS_TOP_DOWN = [4, 3, 2, 1];
  var BIN_PATTERN = /^[A-Da-d][1-6]$/;
  function levelOf(item) { var l = parseInt(item && item.level, 10); return (l >= 1 && l <= 4) ? l : 2; }
  function shelfOf(bin) { return String(bin || 'A1').charAt(0).toUpperCase(); }
  function posOf(bin) { return parseInt(String(bin || 'A1').slice(1), 10) || 1; }
  function locShort(item) {
    var bin = String((item && item.bin) || '');
    if (BIN_PATTERN.test(bin)) return shelfOf(bin) + ' · L' + levelOf(item) + ' · P' + posOf(bin);
    return bin;   // free-text location, shown exactly as the sheet has it
  }
  function locLong(item) {
    var bin = String((item && item.bin) || '');
    if (BIN_PATTERN.test(bin)) return 'Shelf ' + shelfOf(bin) + ' · Level ' + levelOf(item) + ' · Position ' + posOf(bin);
    return bin;
  }
  function locShortParts(bin, level) { return shelfOf(bin) + ' · L' + level + ' · P' + posOf(bin); }
  function locLongParts(bin, level) { return 'Shelf ' + shelfOf(bin) + ' · Level ' + level + ' · Position ' + posOf(bin); }
  function cellKey(bin, level) { return bin + '-L' + level; }
  /* ---------- Angular icon system (Cybertruck clipped geometry) ----------
   * Flat geometric line icons: straight segments, chamfered/clipped shapes,
   * stroke=currentColor so every theme tints them. Items store an icon KEY
   * (e.g. 'bolt'); legacy emoji values are mapped in EMOJI_TO_KEY so saved
   * inventories keep rendering with no data rewrite. */
  var ICON_PATHS = {
    home: '<path d="M3 11 L12 3 L21 11"/><path d="M6 9.5 V21 H18 V9.5"/><path d="M10 21 V14 H14 V21"/>',
    map: '<path d="M12 21.5 L5 13.8 V6.8 L12 2.8 L19 6.8 V13.8 Z"/><path d="M12 12.5 L9.3 9.8 L12 7.2 L14.7 9.8 Z"/>',
    factory: '<path d="M3 21 V10 L9 13.2 V10 L15 13.2 V5.5 H21 V21"/><path d="M2.5 21 H21.5"/>',
    plus: '<path d="M8 3.5 H16 L20.5 8 V16 L16 20.5 H8 L3.5 16 V8 Z"/><path d="M12 8 V16 M8 12 H16"/>',
    sync: '<path d="M4 9.5 H15.5 L12 5"/><path d="M20 14.5 H8.5 L12 19"/>',
    hex: '<path d="M12 2.8 L20 7.4 V16.6 L12 21.2 L4 16.6 V7.4 Z"/><path d="M12 15.8 L8.3 9.4 H15.7 Z"/>',
    scan: '<path d="M3 7.5 V3.5 H7.5"/><path d="M16.5 3.5 H21 V7.5"/><path d="M21 16.5 V20.5 H16.5"/><path d="M7.5 20.5 H3 V16.5"/><path d="M6.5 12 H17.5"/>',
    check: '<path d="M3.5 12.5 L9.5 18.5 L20.5 5.5"/>',
    box: '<path d="M12 2.8 L21 7.4 V16.6 L12 21.2 L3 16.6 V7.4 Z"/><path d="M3 7.4 L12 12 L21 7.4"/><path d="M12 12 V21.2"/>',
    plug: '<path d="M8.5 2.8 V8 M15.5 2.8 V8"/><path d="M5 8 H19 V12.8 L12 16.8 L5 12.8 Z"/><path d="M12 16.8 V21.2"/>',
    light: '<path d="M12 2.8 L17.2 8.2 L14.6 14 H9.4 L6.8 8.2 Z"/><path d="M9.4 17.2 H14.6"/><path d="M10.2 20.4 H13.8"/>',
    tire: '<path d="M8.2 3 H15.8 L21 8.2 V15.8 L15.8 21 H8.2 L3 15.8 V8.2 Z"/><circle cx="12" cy="12" r="2.4"/><path d="M12 3.2 V9.2 M12 14.8 V20.8 M3.2 12 H9.2 M14.8 12 H20.8"/>',
    axle: '<path d="M1.8 12 H22.2"/><path d="M3.8 8.6 L8 8.6 L8 15.4 L3.8 15.4 Z"/><path d="M16 8.6 L20.2 8.6 L20.2 15.4 L16 15.4 Z"/>',
    link: '<path d="M10.2 13.8 L5 8.6 L8 5.6 L13.2 10.8"/><path d="M13.8 10.2 L19 15.4 L16 18.4 L10.8 13.2"/>',
    chain: '<path d="M2.8 12 L6.8 7.8 L11 12 L6.8 16.2 Z"/><path d="M13 12 L17.2 7.8 L21.2 12 L17.2 16.2 Z"/><path d="M11 12 H13"/>',
    jack: '<path d="M12 3 L20.5 21 H16.8 L12 10.8 L7.2 21 H3.5 Z"/><path d="M8.8 16.5 H15.2"/>',
    battery: '<path d="M2.8 8 H18.2 V16.2 H2.8 Z"/><path d="M21.2 10.4 V13.8"/><path d="M13.2 9.3 L9.4 13.2 H11.8 L10.4 15.4 L14.8 11.2 H12.3 Z" fill="currentColor" stroke="none"/>',
    bolt: '<path d="M13.2 2.2 L4.8 13.6 H10.8 L9.2 21.8 L19.2 9.6 H12.8 Z" fill="currentColor" stroke="none"/>',
    solar: '<path d="M5.2 3.8 H18.8 L20.8 14.8 H3.2 Z"/><path d="M8.4 3.8 L6.8 14.8 M15.6 3.8 L17.2 14.8 M4.2 9.3 H19.8"/><path d="M12 14.8 V18.8 M7.8 21 H16.2 M12 18.8 V21"/>',
    hub: '<path d="M8.2 3 H15.8 L21 8.2 V15.8 L15.8 21 H8.2 L3 15.8 V8.2 Z"/><path d="M12 7.8 L15.6 10.4 L14.2 14.6 H9.8 L8.4 10.4 Z"/>',
    spring: '<path d="M3.5 3.5 H20.5"/><path d="M6 3.5 L18 7.5 L6 11.5 L18 15.5 L6 19.5"/><path d="M3.5 20.5 H20.5"/>',
    fender: '<path d="M2.8 13 L7 5.8 L12 3.8 L17 5.8 L21.2 13"/><path d="M8 20.2 L9.6 13.4 H14.4 L16 20.2"/><path d="M2.8 20.2 H21.2"/>',
    hook: '<path d="M9 2.6 H15 V6.2 H9 Z"/><path d="M12 6.2 V11.8 L17.2 15.2 V17.8 L12 21.4 L6.8 17.8 V14"/>',
    kit: '<path d="M8.5 6.8 V3.8 H15.5 V6.8"/><path d="M5 6.8 H19 L21 8.8 V18.8 L19 20.8 H5 L3 18.8 V8.8 Z"/><path d="M3 12.4 H21"/>',
    alert: '<path d="M12 3 L22 20.2 H2 Z"/><path d="M12 9.2 V13.8"/><path d="M12 16.8 V17.1"/>',
    diamond: '<path d="M12 2.8 L21.2 12 L12 21.2 L2.8 12 Z"/><path d="M12 7.4 L16.6 12 L12 16.6 L7.4 12 Z"/>',
    controller: '<path d="M5 3.8 H19 L21 5.8 V18.2 L19 20.2 H5 L3 18.2 V5.8 Z"/><path d="M7.5 8 V16"/><path d="M5.8 11 H9.2"/><path d="M12 8 V16"/><path d="M10.3 13.5 H13.7"/><path d="M16.5 8 V16"/><path d="M14.8 9.5 H18.2"/>',
    truck: '<path d="M2 16.2 L4.8 9.4 L9.6 8.4 L13.8 3.6 L17.8 8.2 L22 10.2 V16.2"/><path d="M2 16.2 H22"/><circle cx="7.4" cy="17.4" r="1.9"/><circle cx="16.6" cy="17.4" r="1.9"/><path d="M9.3 17.4 H14.7"/>'
  };
  var EMOJI_TO_KEY = {
    '\u{1F4E6}': 'box',
    '\u{1F50C}': 'plug',
    '\u{1F4A1}': 'light',
    '\u{1F6DE}': 'tire',
    '\u{2699}': 'hex',
    '\u{1F517}': 'link',
    '\u{26D3}': 'chain',
    '\u{1F3D7}': 'jack',
    '\u{1F50B}': 'battery',
    '\u{26A1}': 'bolt',
    '\u{2600}': 'solar',
    '\u{1F39B}': 'controller',
    '\u{1F3AF}': 'hub',
    '\u{1F33F}': 'spring',
    '\u{1F6E1}': 'fender',
    '\u{1FA9D}': 'hook',
    '\u{1F9F0}': 'kit',
    '\u{1F6A8}': 'alert',
    '\u{1F536}': 'diamond',
    '\u{1F690}': 'truck',
    '\u{1F3ED}': 'factory'
  };
  var ICON_KEYS = ['box', 'controller', 'plug', 'light', 'bolt', 'battery', 'solar', 'tire', 'axle', 'hub', 'link', 'chain', 'hook', 'kit', 'spring', 'diamond'];
  function svgIcon(key) {
    var inner = ICON_PATHS[key] || ICON_PATHS.box;
    return '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="miter" stroke-linecap="square" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  function iconKeyFor(item) {
    if (!item || !item.icon) return 'box';
    if (ICON_PATHS[item.icon]) return item.icon;
    var stripped = String(item.icon).replace(/\uFE0F/g, '');
    return EMOJI_TO_KEY[stripped] || 'box';
  }
  function iconFor(item) { return svgIcon(iconKeyFor(item)); }
  /* Item plate content: the item's real photo (from the backend's Photo
   * column, when present) laid over the angular icon. If the image
   * fails to load — hotlink protection, offline, bad URL — it hides
   * itself and the icon underneath shows through. */
  function plateImg(item) {
    if (!item || !item.photo) return '';
    return '<img class="plate-img" src="' + esc(item.photo) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
  }
  function iconPlate(item) { return plateImg(item) + iconFor(item); }
  var currentItemId = null;
  var selectedBin = null;
  var currentBin = null;
  var currentLevel = null;
  var locateTarget = null;   // { id, name, bin, level } — blink-on-search target
  var selectedIcon = ICON_KEYS[0];
  var lowFilter = false;
  /* Categories home state: null = folder browse · 'ALL' = all items ·
   * '<folder name>' = drilled into that folder. */
  var homeFolder = null;
  var folderEdit = false;          // folder rename/remove edit mode
  var pendingRemoveFolder = null;
  var fabMenuOpen = false;
  function itemCategory(i) { return D.categoryFor(i); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  /* SPEC PLATE status scale — always a word, never hue alone:
   * 0 = OUT, 1–2 = CRITICAL, 3–5 = LOW, 6+ = OK. */
  function statusOf(q) { return q <= 0 ? 'out' : (q <= 2 ? 'crit' : (q <= 5 ? 'low' : 'ok')); }
  function qtyClass(q) { return 'qty-' + statusOf(q); }
  function qtyLabel(q) {
    var s = statusOf(q);
    if (s === 'out') return 'OUT';
    if (s === 'crit') return 'CRITICAL · ' + q;
    if (s === 'low') return 'LOW · ' + q;
    return q + ' in stock';
  }
  function qtyStateWord(q) {
    var s = statusOf(q);
    return s === 'out' ? 'Out of stock' : (s === 'crit' ? 'Critical' : (s === 'low' ? 'Low stock' : 'In stock'));
  }
  function hideToast() { $('toast').classList.add('hidden'); }
  function toast(msg, ms) {
    var t = $('toast');
    $('toastMsg').textContent = msg;
    $('toastUndo').classList.add('hidden');
    t.classList.remove('hidden');
    clearTimeout(t._h); t._h = setTimeout(hideToast, ms || 3000);
  }
  /* Qty changes get a 6-second UNDO toast (SPEC PLATE) — replaces, never stacks. */
  function showUndoToast(msg, undoFn) {
    var t = $('toast');
    $('toastMsg').textContent = msg;
    var u = $('toastUndo');
    u.classList.remove('hidden');
    t.classList.remove('hidden');
    clearTimeout(t._h);
    u.onclick = function () { hideToast(); if (undoFn) undoFn(); toast('Undone', 2000); };
    t._h = setTimeout(hideToast, 6000);
  }
  function fmtTime(iso) {
    if (!iso) return 'never';
    try { return new Date(iso).toLocaleString(); } catch (e) { return iso; }
  }

  /* ---------- appearance / themes ---------- */
  var THEMES = {
    midnight:  { themeColor: '#0f172a' },
    warehouse: { themeColor: '#ffffff' },
    electric:  { themeColor: '#0a1230' },
    hivis:     { themeColor: '#000000' },
    paper:     { themeColor: '#fffaf0' },
    workshop:  { themeColor: '#1b4332' },
    milwaukee: { themeColor: '#8f0112' }
  };
  function savedTheme() {
    var t = 'milwaukee';
    try {
      // One-time switch to Milwaukee Red (mirrors the index.html head script).
      if (localStorage.getItem('et-theme-force') !== 'mk1') {
        localStorage.setItem('et-theme', 'milwaukee');
        localStorage.setItem('et-theme-force', 'mk1');
      }
      t = localStorage.getItem('et-theme') || 'milwaukee';
    } catch (e) { /* storage blocked */ }
    return THEMES[t] ? t : 'milwaukee';
  }
  function markThemeCards(name) {
    document.querySelectorAll('[data-theme-pick]').forEach(function (card) {
      var on = card.getAttribute('data-theme-pick') === name;
      card.classList.toggle('sel', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function applyTheme(name, save) {
    if (!THEMES[name]) name = 'milwaukee';
    document.documentElement.dataset.theme = name;
    if (save) { try { localStorage.setItem('et-theme', name); } catch (e) { /* storage blocked */ } }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEMES[name].themeColor);
    markThemeCards(name);
  }
  function initTheme() {
    // The <head> script in index.html already set data-theme pre-paint;
    // here we just sync the picker UI + browser chrome color to it.
    applyTheme(document.documentElement.dataset.theme || savedTheme(), false);
    document.querySelectorAll('[data-theme-pick]').forEach(function (card) {
      card.addEventListener('click', function () {
        var name = card.getAttribute('data-theme-pick');
        applyTheme(name, true);
        toast('Look: ' + card.querySelector('.theme-name').textContent);
      });
    });
  }

  /* ---------- header / global status ---------- */
  function refreshChrome() {
    var pending = D.getQueue().filter(function (c) { return !c.synced; }).length;
    var live = D.isLive();
    var mb = $('modeBadge');
    mb.textContent = live ? 'Live · Google Sheet' : 'Local only';
    mb.className = 'badge ' + (live ? 'badge-live' : 'badge-demo');
    var nb = $('netBadge');
    nb.textContent = navigator.onLine ? '● Online' : '● Offline';
    nb.className = 'badge ' + (navigator.onLine ? 'badge-online' : 'badge-offline');
    var qb = $('queueBadge');
    qb.textContent = pending + ' pending';
    qb.classList.toggle('hidden', pending === 0);
    var tc = $('tabQueueCount');
    tc.textContent = pending; tc.classList.toggle('hidden', pending === 0);
  }

  /* ---------- shared qty-change path (cards, sheet, bin sheet, count) ----------
   * Every change routes through ETData (which coalesces the sync queue),
   * raises the UNDO toast, and refreshes whichever surfaces are visible. */
  function changeQty(id, delta) {
    var item = D.getItem(id);
    if (!item) return null;
    var before = item.qty;
    var updated = D.updateQty(id, delta);
    if (!updated || updated.qty === before) return updated;
    showUndoToast(updated.name + ' → ' + updated.qty, function () { D.setQty(id, before); afterQtyChange(id); });
    afterQtyChange(id);
    return updated;
  }
  function setQtyWithUndo(id, qty) {
    var item = D.getItem(id);
    if (!item) return null;
    var before = item.qty;
    var updated = D.setQty(id, qty);
    if (!updated || updated.qty === before) return updated;
    showUndoToast(updated.name + ' → ' + updated.qty, function () { D.setQty(id, before); afterQtyChange(id); });
    afterQtyChange(id);
    return updated;
  }
  function afterQtyChange(id) {
    refreshChrome();
    if ($('view-home').classList.contains('active')) renderHome();
    if (currentItemId === id && !$('itemOverlay').classList.contains('hidden')) syncSheetQty();
    if (currentBin && !$('binOverlay').classList.contains('hidden')) renderBinSheetItems();
    if ($('view-map').classList.contains('active')) renderMap();
    if ($('view-suppliers').classList.contains('active')) renderSuppliers();
    if ($('view-sync').classList.contains('active')) renderQueue();
  }

  /* ---------- shared numeric qty editor ----------
   * One editor for the item sheet, Home cards, bin rows and Count Mode.
   * It summons the phone's numeric pad, starts with the value selected,
   * and treats an empty/invalid entry as a cancel — never as zero. */
  var qtyEditState = null;
  function qtyEditFocusTarget(state) {
    if (!state) return null;
    if (state.returnSelector) {
      var bySelector = document.querySelector(state.returnSelector);
      if (bySelector) return bySelector;
    }
    if (state.returnAttr) {
      var found = null;
      document.querySelectorAll('[' + state.returnAttr + ']').forEach(function (el) {
        if (el.getAttribute(state.returnAttr) === state.returnValue) found = el;
      });
      if (found) return found;
    }
    if (state.returnElement && state.returnElement.isConnected) return state.returnElement;
    return null;
  }
  function restoreQtyEditFocus(state) {
    var el = qtyEditFocusTarget(state);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }
  function updateQtyEditSetLabel() {
    if (!qtyEditState) return;
    var raw = $('qtyEditInput').value.trim();
    $('qtyEditSet').textContent = /^\d+$/.test(raw) ? 'Set to ' + Math.min(9999, parseInt(raw, 10)) : 'Set';
  }
  function closeQtyEditor(commit) {
    if (!qtyEditState) return;
    var state = qtyEditState;
    var raw = $('qtyEditInput').value.trim();
    qtyEditState = null;
    $('qtyEditOverlay').classList.add('hidden');
    if (commit && /^\d+$/.test(raw)) {
      var qty = Math.min(9999, parseInt(raw, 10));
      if (qty !== state.value && state.onCommit) state.onCommit(qty);
    }
    restoreQtyEditFocus(state);
  }
  function openQtyEditor(opts) {
    qtyEditState = {
      value: opts.value,
      onCommit: opts.onCommit,
      returnElement: opts.returnElement || null,
      returnSelector: opts.returnSelector || '',
      returnAttr: opts.returnAttr || '',
      returnValue: opts.returnValue || ''
    };
    $('qtyEditLabel').textContent = opts.counted ? 'Counted quantity' : 'Quantity';
    $('qtyEditTitle').textContent = opts.itemName;
    var input = $('qtyEditInput');
    input.setAttribute('aria-label', (opts.counted ? 'New counted quantity for ' : 'New quantity for ') + opts.itemName);
    input.value = opts.value;
    $('qtyEditOverlay').classList.remove('hidden');
    updateQtyEditSetLabel();
    input.focus(); input.select();
  }
  $('qtyEditSet').addEventListener('click', function () { closeQtyEditor(true); });
  $('qtyEditCancel').addEventListener('click', function () { closeQtyEditor(false); });
  $('qtyEditClose').addEventListener('click', function () { closeQtyEditor(false); });
  $('qtyEditOverlay').addEventListener('click', function (e) { if (e.target === $('qtyEditOverlay')) closeQtyEditor(false); });
  $('qtyEditInput').addEventListener('input', function () {
    var clean = this.value.replace(/\D/g, '').slice(0, 4);
    if (this.value !== clean) this.value = clean;
    updateQtyEditSetLabel();
  });
  $('qtyEditInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); closeQtyEditor(true); }
    else if (e.key === 'Escape') { e.preventDefault(); closeQtyEditor(false); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && qtyEditState) closeQtyEditor(false);
  });

  /* The sticky search+stat block docks right under the app header. */
  function fitSticky() {
    var h = document.querySelector('.app-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
  }
  window.addEventListener('resize', fitSticky);

  /* ---------- tabs ---------- */
  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    var el = $('view-' + name); if (el) el.classList.add('active');
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.getAttribute('data-view') === name;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (name !== 'map' && locateTarget) { locateTarget = null; $('locateCaption').classList.add('hidden'); }
    if (name !== 'home') document.body.classList.remove('folders-bg');
    if (name === 'home') renderHome();
    if (name === 'add') prepAddForm();
    if (name === 'map') { renderMap(); if (locateTarget) setTimeout(activateLocate, 40); }
    if (name === 'suppliers') renderSuppliers();
    if (name === 'sync') { renderQueue(); renderSync(); }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { showView(t.getAttribute('data-view')); });
  });

  /* ---------- #08 Photo-First Grid (Home) ---------- */
  function renderHome() {
    var q = ($('searchInput').value || '').trim().toLowerCase();
    var items = D.getItems();
    var totalUnits = items.reduce(function (s, i) { return s + i.qty; }, 0);
    var low = items.filter(function (i) { return i.qty <= 5; }).length;
    $('statItems').textContent = items.length;
    $('statUnits').textContent = totalUnits;
    $('statLow').textContent = low;
    $('statSegLow').classList.toggle('active', lowFilter);
    $('statSegLow').setAttribute('aria-pressed', lowFilter ? 'true' : 'false');
    $('filterHint').classList.toggle('hidden', !lowFilter);
    /* Home states: folder browse (default) · drilled folder / All Items ·
     * global results whenever a search or the LOW filter is active. */
    var searching = !!q || lowFilter;
    var browseFolders = !searching && homeFolder === null;
    document.body.classList.toggle('folders-bg', browseFolders && $('view-home').classList.contains('active'));
    $('folderCaption').classList.toggle('hidden', !searching);
    $('folderHead').classList.toggle('hidden', !browseFolders);
    $('folderEditBtn').classList.toggle('hidden', folderEdit);
    $('folderDoneBtn').classList.toggle('hidden', !folderEdit);
    $('allItemsRow').classList.toggle('hidden', !browseFolders || folderEdit);
    /* Sorting Kit entry: while unfiled items exist, the browse state
     * carries a banner offering Auto-sort and Sort mode. */
    var uncatCount = 0;
    if (browseFolders) D.folderStats().forEach(function (s) { if (s.system) uncatCount = s.count; });
    $('sortBanner').classList.toggle('hidden', !browseFolders || folderEdit || !uncatCount);
    if (uncatCount) $('sortBannerText').textContent = uncatCount + (uncatCount === 1 ? ' item needs' : ' items need') + ' a folder';
    $('folderGrid').classList.toggle('hidden', !browseFolders);
    $('folderBar').classList.toggle('hidden', searching || homeFolder === null);
    $('photoGrid').classList.toggle('hidden', browseFolders);
    if (browseFolders) {
      $('gridEmpty').classList.add('hidden');
      $('allItemsMeta').textContent = items.length + ' items · ' + totalUnits + ' units';
      renderFolders();
      syncFab();
      refreshChrome();
      return;
    }
    if (!searching && homeFolder !== null) {
      var inFolder = homeFolder === 'ALL' ? items : items.filter(function (i) { return itemCategory(i) === homeFolder; });
      $('folderTitle').textContent = homeFolder === 'ALL' ? 'All Items' : homeFolder;
      $('folderMeta').textContent = inFolder.length + ' items · ' + inFolder.reduce(function (s, i) { return s + i.qty; }, 0) + ' units';
    }
    var filtered = items.filter(function (i) {
      if (lowFilter && i.qty > 5) return false;
      if (!q) return true;
      var hay = (i.name + ' ' + i.sku + ' ' + i.bin + ' ' + i.supplier + ' ' + locShort(i) + ' ' + locLong(i)).toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      var compact = q.replace(/[\s·\-]/g, '');
      return compact.length > 1 && locShort(i).toLowerCase().replace(/[\s·]/g, '').indexOf(compact) !== -1;
    });
    if (!searching && homeFolder !== null && homeFolder !== 'ALL') {
      filtered = filtered.filter(function (i) { return itemCategory(i) === homeFolder; });
    }
    if (lowFilter) filtered = filtered.slice().sort(function (a, b) { return a.qty - b.qty; });  // worst first: 0s, then 1–2, then 3–5
    $('photoGrid').innerHTML = filtered.map(function (i) {
      var st = statusOf(i.qty);
      var pill = st === 'ok'
        ? '<span class="qty-pill qty-slot" aria-hidden="true">' + qtyLabel(i.qty) + '</span>'
        : '<span class="qty-pill ' + qtyClass(i.qty) + '">' + qtyLabel(i.qty) + '</span>';
      return '<div class="photo-card st-' + st + '" data-card="' + esc(i.id) + '" role="button" tabindex="0" aria-label="' + esc(i.name) + ', ' + qtyLabel(i.qty) + '">' +
        '<span class="pc-icon">' + iconPlate(i) + '</span>' +
        '<div class="pc-name">' + esc(i.name) + '</div>' +
        '<div class="pc-loc">' + esc(locShort(i)) + '</div>' +
        '<div class="pc-bin">' + esc(i.sku) + '</div>' +
        pill +
        '<div class="stepper-strip">' +
          '<button type="button" data-dec="' + esc(i.id) + '" aria-label="Remove one from ' + esc(i.name) + '">−</button>' +
          '<button type="button" class="ss-qty" data-qty-btn="' + esc(i.id) + '" aria-label="Quantity ' + i.qty + ' for ' + esc(i.name) + ' — tap to type a new quantity">' + i.qty + '</button>' +
          '<button type="button" data-inc="' + esc(i.id) + '" aria-label="Add one to ' + esc(i.name) + '">+</button>' +
        '</div></div>';
    }).join('');
    $('gridEmpty').textContent = (lowFilter && !q) ? 'Nothing is low right now.'
      : (homeFolder && homeFolder !== 'ALL' && !q ? 'This folder is empty — tap + to add an item here.' : 'No items match your search.');
    $('gridEmpty').classList.toggle('hidden', filtered.length > 0);
    var grid = $('photoGrid');
    grid.querySelectorAll('[data-card]').forEach(function (card) {
      card.addEventListener('click', function (e) {
        if (e.target.closest('.stepper-strip')) return;
        openItem(card.getAttribute('data-card'));
      });
      card.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.stepper-strip')) {
          e.preventDefault(); openItem(card.getAttribute('data-card'));
        }
      });
    });
    grid.querySelectorAll('[data-dec]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-dec'), -1); });
    });
    grid.querySelectorAll('[data-inc]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-inc'), 1); });
    });
    grid.querySelectorAll('[data-qty-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-qty-btn');
        var item = D.getItem(id);
        if (!item) return;
        openQtyEditor({
          value: item.qty, itemName: item.name,
          returnAttr: 'data-qty-btn', returnValue: id,
          onCommit: function (qty) { setQtyWithUndo(id, qty); }
        });
      });
    });
    refreshChrome();
    syncFab();
  }
  /* ---------- Categories home: red glass folders ----------
   * Folders are category NAMES on the items (ETData owns the list and
   * the rename/remove cascades). Tiles are red glass; edit mode turns
   * each name into an inline field. Entry: the Edit pill, or a 450ms
   * long-press on a tile (which focuses that folder's field). */
  function folderPillHtml(s) {
    if (!s.worst) return '';
    var label = s.worstCount + ' ' + (s.worst === 'out' ? 'OUT' : (s.worst === 'crit' ? 'CRITICAL' : 'LOW'));
    return '<span class="folder-notch"><span class="attn-pill attn-' + s.worst + '">' + label + '</span></span>';
  }
  function renderFolders() {
    $('folderGrid').innerHTML = D.folderStats().map(function (s) {
      var meta = s.count + (s.count === 1 ? ' item' : ' items') + ' · ' + s.units + ' units';
      if (folderEdit && !s.system) {
        return '<div class="folder-wrap" data-wrap="' + esc(s.name) + '">' +
          '<div class="folder-tile editing">' + folderPillHtml(s) +
            '<span class="folder-icon">' + svgIcon(s.icon) + '</span>' +
            '<input class="folder-name-input" data-folder-input data-old="' + esc(s.name) + '" value="' + esc(s.name) + '" aria-label="Rename folder ' + esc(s.name) + '" autocomplete="off">' +
            '<span class="folder-meta">' + meta + '</span>' +
          '</div>' +
          '<button type="button" class="folder-x" data-remove="' + esc(s.name) + '" aria-label="Remove folder ' + esc(s.name) + '">✕</button>' +
        '</div>';
      }
      return '<div class="folder-wrap" data-wrap="' + esc(s.name) + '">' +
        '<div class="folder-tile" data-folder="' + esc(s.name) + '" role="button" tabindex="0" aria-label="Open folder ' + esc(s.name) + ', ' + meta + '">' +
          folderPillHtml(s) +
          '<span class="folder-icon">' + svgIcon(s.icon) + '</span>' +
          '<span class="folder-name">' + esc(s.name) + '</span>' +
          '<span class="folder-meta">' + meta + (s.system ? ' · system folder' : '') + '</span>' +
        '</div></div>';
    }).join('');
    var grid = $('folderGrid');
    if (folderEdit) {
      grid.querySelectorAll('[data-remove]').forEach(function (b) {
        b.addEventListener('click', function (e) { e.stopPropagation(); askRemoveFolder(b.getAttribute('data-remove')); });
      });
      grid.querySelectorAll('[data-folder-input]').forEach(function (inp) {
        inp.addEventListener('blur', function () { commitFolderRename(inp); });
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
          else if (e.key === 'Escape') { inp.value = inp.getAttribute('data-old'); inp.blur(); }
        });
      });
    } else {
      grid.querySelectorAll('[data-folder]').forEach(function (tile) {
        attachFolderPress(tile, tile.getAttribute('data-folder'));
      });
    }
  }
  function openFolder(name) { homeFolder = name; renderHome(); window.scrollTo(0, 0); }
  /* Tap opens the folder; a 450ms hold enters edit mode on it instead.
   * The press timer + fired-flag keep the two from fighting. */
  var lpTimer = null, lpFiredAt = 0;
  function attachFolderPress(tile, name) {
    tile.addEventListener('pointerdown', function () {
      clearTimeout(lpTimer);
      lpTimer = setTimeout(function () {
        lpFiredAt = Date.now();
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { /* unsupported */ } }
        enterFolderEdit(name);
      }, 450);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      tile.addEventListener(ev, function () { clearTimeout(lpTimer); });
    });
    tile.addEventListener('click', function () {
      if (Date.now() - lpFiredAt < 700) return;   // the long-press already acted
      openFolder(name);
    });
    tile.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFolder(name); }
    });
  }
  function enterFolderEdit(focusName) {
    folderEdit = true;
    closeFabMenu();
    renderHome();
    if (focusName) {
      var target = null;
      $('folderGrid').querySelectorAll('[data-folder-input]').forEach(function (el) {
        if (el.getAttribute('data-old') === focusName) target = el;
      });
      if (target) { target.focus(); target.select(); }
    }
  }
  function exitFolderEdit() {
    commitAllFolderInputs();
    folderEdit = false;
    renderHome();
  }
  function commitAllFolderInputs() {
    $('folderGrid').querySelectorAll('[data-folder-input]').forEach(function (inp) { commitFolderRename(inp); });
  }
  /* Commit on blur/Enter/Done. A valid rename updates the data in place
   * (the input already shows the new name, so no re-render — focus stays
   * put); a rejected one reverts the field and says why. */
  function commitFolderRename(inp) {
    if (!folderEdit) return;
    var oldName = inp.getAttribute('data-old');
    var newName = inp.value.trim();
    if (newName === oldName) return;
    var r = D.renameCategory(oldName, newName);
    if (!r.ok) {
      inp.value = oldName;
      toast(r.message || 'Could not rename folder');
      return;
    }
    inp.setAttribute('data-old', newName);
    inp.value = newName;
    var wrap = inp.closest('[data-wrap]');
    if (wrap) wrap.setAttribute('data-wrap', newName);
    toast('Folder renamed' + (r.count ? ' — ' + r.count + ' item(s) updated' : ''));
  }
  /* Remove: empty folders go instantly; folders with items ask first —
   * items move to Uncategorized, they are never deleted. */
  function askRemoveFolder(name) {
    var s = D.folderStats().filter(function (x) { return x.name === name; })[0];
    var count = s ? s.count : 0;
    if (!count) {
      D.removeCategory(name);
      toast('Folder removed');
      renderHome();
      return;
    }
    pendingRemoveFolder = name;
    $('frTitle').textContent = 'Remove “' + name + '”?';
    $('frText').textContent = 'Move ' + count + ' item(s) to Uncategorized? Items are never deleted.';
    $('folderRemoveOverlay').classList.remove('hidden');
  }
  function closeRemoveConfirm() {
    pendingRemoveFolder = null;
    $('folderRemoveOverlay').classList.add('hidden');
  }
  $('frCancel').addEventListener('click', closeRemoveConfirm);
  $('folderRemoveOverlay').addEventListener('click', function (e) { if (e.target === $('folderRemoveOverlay')) closeRemoveConfirm(); });
  $('frConfirm').addEventListener('click', function () {
    if (!pendingRemoveFolder) return;
    var name = pendingRemoveFolder;
    closeRemoveConfirm();
    var r = D.removeCategory(name);
    toast('Folder removed — ' + (r.moved || 0) + ' item(s) moved to Uncategorized');
    renderHome();
  });
  $('folderEditBtn').addEventListener('click', function () { enterFolderEdit(null); });
  $('folderDoneBtn').addEventListener('click', function () { exitFolderEdit(); });
  $('allItemsRow').addEventListener('click', function () { openFolder('ALL'); });
  $('folderBack').addEventListener('click', function () { homeFolder = null; renderHome(); window.scrollTo(0, 0); });

  /* ---------- Sorting Kit: file the Uncategorized pile ----------
   * suggestCategory proposes a folder from ordered phrase rules over
   * the item's name + SKU, in electrician vocabulary. ORDER IS THE
   * WHOLE GAME: multiword phrases run before the generic words inside
   * them — 'wire nut' (Fasteners) before 'wire' (Wire & Cable),
   * 'conduit strap' (Conduit) before 'strap' (Fasteners), 'cable
   * staple' / 'romex staple' (Fasteners) before 'cable' / 'romex'
   * (Wire), 'smoke detector' (Lighting) before the bare 'detector'.
   * No keyword hit falls back to the item's icon family; still
   * nothing → null, and the row asks a human. A suggestion is only
   * offered while its folder exists in the saved list (a renamed
   * folder never resurrects its old name as a guess). */
  var SUGGEST_RULES = [
    // Phrases first — they outrank every single word below.
    ['wire nut', 'Fasteners & Hardware'], ['wirenut', 'Fasteners & Hardware'],
    ['conduit strap', 'Conduit & Fittings'],
    ['cable staple', 'Fasteners & Hardware'], ['romex staple', 'Fasteners & Hardware'], ['wire staple', 'Fasteners & Hardware'],
    ['wall plate', 'Devices & Plates'],
    ['load center', 'Breakers & Panels'], ['loadcentre', 'Breakers & Panels'],
    ['smoke detector', 'Lighting'], ['smoke alarm', 'Lighting'],
    ['fish tape', 'Tools & Supplies'],
    // Breakers & Panels
    ['breaker', 'Breakers & Panels'], ['panelboard', 'Breakers & Panels'], ['panel', 'Breakers & Panels'],
    ['disconnect', 'Breakers & Panels'], ['fuse', 'Breakers & Panels'], ['surge', 'Breakers & Panels'],
    // Devices & Plates
    ['gfci', 'Devices & Plates'], ['afci', 'Devices & Plates'], ['receptacle', 'Devices & Plates'],
    ['outlet', 'Devices & Plates'], ['switch', 'Devices & Plates'], ['dimmer', 'Devices & Plates'],
    ['plate', 'Devices & Plates'], ['thermostat', 'Devices & Plates'], ['doorbell', 'Devices & Plates'],
    // Conduit & Fittings
    ['conduit', 'Conduit & Fittings'], ['emt', 'Conduit & Fittings'], ['fitting', 'Conduit & Fittings'],
    ['elbow', 'Conduit & Fittings'], ['coupling', 'Conduit & Fittings'], ['pvc', 'Conduit & Fittings'],
    // Boxes & Enclosures
    ['box', 'Boxes & Enclosures'], ['enclosure', 'Boxes & Enclosures'], ['junction', 'Boxes & Enclosures'],
    ['octagon', 'Boxes & Enclosures'], ['cover', 'Boxes & Enclosures'],
    // Lighting
    ['light', 'Lighting'], ['lamp', 'Lighting'], ['led', 'Lighting'], ['bulb', 'Lighting'],
    ['fixture', 'Lighting'], ['recessed', 'Lighting'], ['detector', 'Lighting'],
    // Wire & Cable
    ['romex', 'Wire & Cable'], ['thhn', 'Wire & Cable'], ['nm-b', 'Wire & Cable'], ['uf-b', 'Wire & Cable'],
    ['coax', 'Wire & Cable'], ['cat5', 'Wire & Cable'], ['cat6', 'Wire & Cable'],
    ['cable', 'Wire & Cable'], ['wire', 'Wire & Cable'], ['spool', 'Wire & Cable'],
    // Fasteners & Hardware
    ['tape', 'Fasteners & Hardware'], ['staple', 'Fasteners & Hardware'], ['screw', 'Fasteners & Hardware'],
    ['anchor', 'Fasteners & Hardware'], ['bolt', 'Fasteners & Hardware'], ['nut', 'Fasteners & Hardware'],
    ['washer', 'Fasteners & Hardware'], ['zip tie', 'Fasteners & Hardware'], ['strap', 'Fasteners & Hardware'],
    ['connector', 'Fasteners & Hardware'],
    // Tools & Supplies
    ['tool', 'Tools & Supplies'], ['meter', 'Tools & Supplies'], ['tester', 'Tools & Supplies'],
    ['drill', 'Tools & Supplies'], ['bit', 'Tools & Supplies'], ['gloves', 'Tools & Supplies'],
    ['knife', 'Tools & Supplies'], ['fish tape', 'Tools & Supplies']
  ];
  /* Icon fallback: conservative on purpose. 'box' is deliberately NOT
   * here — it is the default icon for everything, so mapping it would
   * auto-file every unknown item into Boxes & Enclosures. battery and
   * solar stay unmapped for the same reason. */
  var ICON_FOLDER = {
    plug: 'Devices & Plates', light: 'Lighting', bolt: 'Fasteners & Hardware',
    controller: 'Breakers & Panels', kit: 'Tools & Supplies',
    link: 'Wire & Cable', hex: 'Conduit & Fittings'
  };
  function suggestCategory(item) {
    if (!item) return null;
    var known = {};
    D.getCategories().forEach(function (c) { known[c.name] = true; });
    var hay = (' ' + (item.name || '') + ' ' + (item.sku || '') + ' ').toLowerCase();
    for (var r = 0; r < SUGGEST_RULES.length; r++) {
      if (hay.indexOf(SUGGEST_RULES[r][0]) !== -1) return known[SUGGEST_RULES[r][1]] ? SUGGEST_RULES[r][1] : null;
    }
    var byIcon = ICON_FOLDER[iconKeyFor(item)];
    return (byIcon && known[byIcon]) ? byIcon : null;
  }
  function uncatItems() {
    return D.getItems().filter(function (i) { return itemCategory(i) === D.UNCAT; });
  }
  $('autoSortBtn').addEventListener('click', openAutoSort);
  $('sortModeBtn').addEventListener('click', startSort);

  /* ----- Auto-sort: propose every unfiled item, review, apply ----- */
  function openAutoSort() {
    var list = uncatItems();
    if (!list.length) { toast('Nothing to sort — everything has a folder'); return; }
    var catOpts = D.getCategories().map(function (c) { return c.name; });
    $('autoSortList').innerHTML = list.map(function (i) {
      var sug = suggestCategory(i);
      var opts = '<option value="">' + (sug ? 'No folder — skip' : 'No guess — choose') + '</option>' + catOpts.map(function (n) {
        return '<option value="' + esc(n) + '"' + (sug === n ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('');
      return '<div class="list-item row-item"><span class="li-icon">' + iconPlate(i) + '</span>' +
        '<span class="li-main"><span class="li-name">' + esc(i.name) + '</span><br>' +
        '<span class="li-sub">' + esc(i.sku || 'No SKU') + ' · ' + esc(locShort(i)) + '</span></span>' +
        '<select class="autosort-select' + (sug ? '' : ' no-guess') + '" data-autosort="' + esc(i.id) + '" aria-label="Folder for ' + esc(i.name) + '">' + opts + '</select></div>';
    }).join('');
    $('autoSortList').querySelectorAll('[data-autosort]').forEach(function (sel) {
      sel.addEventListener('change', function () { sel.classList.remove('no-guess'); updateAutoSortApply(); });
    });
    updateAutoSortApply();
    $('autoSortOverlay').classList.remove('hidden');
  }
  function autoSortPicks() {
    var picks = [];
    $('autoSortList').querySelectorAll('[data-autosort]').forEach(function (sel) {
      if (sel.value) picks.push({ id: sel.getAttribute('data-autosort'), folder: sel.value });
    });
    return picks;
  }
  function updateAutoSortApply() {
    var n = autoSortPicks().length;
    $('autoSortApply').textContent = n ? 'File ' + n + ' item' + (n === 1 ? '' : 's') : 'File items';
    $('autoSortApply').disabled = !n;
  }
  function closeAutoSort() { $('autoSortOverlay').classList.add('hidden'); }
  $('closeAutoSort').addEventListener('click', closeAutoSort);
  $('autoSortOverlay').addEventListener('click', function (e) { if (e.target === $('autoSortOverlay')) closeAutoSort(); });
  $('autoSortApply').addEventListener('click', function () {
    var picks = autoSortPicks();
    if (!picks.length) { closeAutoSort(); return; }
    var prev = {};
    picks.forEach(function (p) { var it = D.getItem(p.id); prev[p.id] = it ? itemCategory(it) : D.UNCAT; });
    picks.forEach(function (p) { D.setCategory(p.id, p.folder); });
    closeAutoSort();
    renderHome(); refreshChrome();
    /* Batch undo: file everything back where it was. The reverse
     * setCategory calls queue their own edit ops, which land on the
     * backend as the items' original Category values. */
    showUndoToast('Filed ' + picks.length + ' item' + (picks.length === 1 ? '' : 's'), function () {
      picks.forEach(function (p) { D.setCategory(p.id, prev[p.id]); });
      renderHome(); refreshChrome();
    });
  });

  /* ----- Sort Mode: one item, one tap on a folder icon ----- */
  var sortSession = null;   // { entries: [{ id, filedTo }], idx }
  function startSort() {
    var list = uncatItems();
    if (!list.length) { toast('Nothing to sort — everything has a folder'); return; }
    sortSession = { entries: list.map(function (i) { return { id: i.id, filedTo: null }; }), idx: 0 };
    $('sDone').classList.add('hidden');
    $('sMain').classList.remove('hidden');
    $('sortOverlay').classList.remove('hidden');
    showSortStep();
  }
  function sortFiledCount() {
    return sortSession ? sortSession.entries.filter(function (e) { return !!e.filedTo; }).length : 0;
  }
  function showSortStep() {
    if (!sortSession) return;
    var en = sortSession.entries[sortSession.idx];
    var item = en && D.getItem(en.id);
    if (!item) { finishSort(); return; }
    $('sProgress').textContent = 'Sort · ' + (sortSession.idx + 1) + ' of ' + sortSession.entries.length;
    $('sHero').innerHTML = iconPlate(item);
    $('sName').textContent = item.name;
    $('sMeta').textContent = (item.sku ? item.sku + ' · ' : '') + locShort(item) + ' · ' + qtyLabel(item.qty);
    $('sFolders').innerHTML = D.getCategories().map(function (c) {
      var on = en.filedTo === c.name;
      return '<button type="button" class="sort-folder-btn' + (on ? ' sel' : '') + '" data-sort-folder="' + esc(c.name) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="File ' + esc(item.name) + ' in ' + esc(c.name) + '">' +
        '<span class="sfb-icon">' + svgIcon(c.icon) + '</span><span class="sfb-name">' + esc(c.name) + '</span></button>';
    }).join('');
    $('sFolders').querySelectorAll('[data-sort-folder]').forEach(function (b) {
      b.addEventListener('click', function () {
        var en2 = sortSession && sortSession.entries[sortSession.idx];
        if (!en2) return;
        D.setCategory(en2.id, b.getAttribute('data-sort-folder'));
        en2.filedTo = b.getAttribute('data-sort-folder');
        advanceSort();
      });
    });
    $('sBack').disabled = sortSession.idx === 0;
  }
  function advanceSort() {
    if (!sortSession) return;
    if (sortSession.idx < sortSession.entries.length - 1) { sortSession.idx++; showSortStep(); }
    else finishSort();
  }
  function finishSort() {
    if (!sortSession) return;
    var filed = sortFiledCount();
    $('sDoneText').textContent = 'Done — ' + filed + ' filed, ' + (sortSession.entries.length - filed) + ' skipped.';
    $('sMain').classList.add('hidden');
    $('sDone').classList.remove('hidden');
  }
  function closeSort(fromDone) {
    var filed = sortFiledCount();
    $('sortOverlay').classList.add('hidden');
    sortSession = null;
    renderHome(); refreshChrome();
    if (!fromDone && filed) toast('Filed ' + filed + ' — progress saved');
  }
  $('sSkip').addEventListener('click', function () { advanceSort(); });
  $('sBack').addEventListener('click', function () {
    if (sortSession && sortSession.idx > 0) { sortSession.idx--; showSortStep(); }
  });
  $('sClose').addEventListener('click', function () { closeSort(false); });
  $('sDoneBtn').addEventListener('click', function () { closeSort(true); });
  $('sortOverlay').addEventListener('click', function (e) { if (e.target === $('sortOverlay')) closeSort(false); });

  /* ---------- FAB: red glass +, lower right, clear of the dock ---------- */
  function syncFab() {
    var show = $('view-home').classList.contains('active') && !folderEdit;
    $('fabBtn').classList.toggle('hidden', !show);
    if (!show) closeFabMenu();
  }
  function closeFabMenu() {
    fabMenuOpen = false;
    $('fabMenu').classList.add('hidden');
    $('fabScrim').classList.add('hidden');
    $('fabBtn').classList.remove('open');
    $('fabBtn').setAttribute('aria-expanded', 'false');
  }
  $('fabBtn').addEventListener('click', function () {
    if (fabMenuOpen) { closeFabMenu(); return; }
    fabMenuOpen = true;
    $('fabMenu').classList.remove('hidden');
    $('fabScrim').classList.remove('hidden');
    $('fabBtn').classList.add('open');
    $('fabBtn').setAttribute('aria-expanded', 'true');
  });
  $('fabScrim').addEventListener('click', closeFabMenu);
  $('fabNewFolder').addEventListener('click', function () {
    closeFabMenu();
    var cat = D.addCategory();
    homeFolder = null;
    lowFilter = false;
    $('searchInput').value = '';
    enterFolderEdit(cat.name);
    toast('New folder — rename it now');
  });
  $('fabNewItem').addEventListener('click', function () {
    closeFabMenu();
    openQuickAdd();
  });
  function openQuickAdd() {
    showView('add');
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    $('addName').focus();
  }
  /* Quick Add's Folder picker: the saved folder list + Uncategorized.
   * Rebuilt whenever the Add view opens (folders may have been
   * renamed); defaults to the folder you're standing in. */
  function prepAddForm() { refreshFolderSelect(); refreshSupplierList(); updateSkuLookup(); }
  function refreshFolderSelect() {
    var sel = $('addFolder');
    if (!sel) return;
    var prev = sel.value;
    var names = D.getCategories().map(function (c) { return c.name; });
    names.push(D.UNCAT);
    sel.innerHTML = names.map(function (n) { return '<option>' + esc(n) + '</option>'; }).join('');
    if (homeFolder && homeFolder !== 'ALL' && names.indexOf(homeFolder) !== -1) sel.value = homeFolder;
    else if (names.indexOf(prev) !== -1) sel.value = prev;
    else sel.value = names[0];
  }

  $('searchInput').addEventListener('input', renderHome);
  /* Stat bar tap-to-filter: LOW toggles the low-only view; Items/Units clear it. */
  $('statSegLow').addEventListener('click', function () { lowFilter = !lowFilter; renderHome(); });
  $('statSegItems').addEventListener('click', function () { if (lowFilter) { lowFilter = false; renderHome(); } });
  $('statSegUnits').addEventListener('click', function () { if (lowFilter) { lowFilter = false; renderHome(); } });

  /* ---------- #02 NFC Tap-to-Open Item Card ---------- */
  function openItem(id, viaNfc) {
    var item = D.getItem(id);
    if (!item) { toast('Item not found: ' + id); return; }
    currentItemId = id;
    $('dIcon').innerHTML = iconPlate(item);
    $('dName').textContent = item.name;
    $('dMeta').textContent = item.sku + ' · ' + item.supplier;
    $('dBinChip').textContent = locShort(item);
    $('dBinChip').setAttribute('aria-label', locLong(item));
    renderFolderRail(item);
    $('dCost').textContent = money(item.cost) + ' each';
    $('dStickerLink').value = D.stickerUrl(item.id);
    syncSheetQty();
    $('itemOverlay').classList.remove('hidden');
    var sheet = $('itemOverlay').querySelector('.sheet');
    sheet.classList.remove('nfc-pulse');
    if (viaNfc) { void sheet.offsetWidth; sheet.classList.add('nfc-pulse'); }  // signature NFC flash
  }
  function syncSheetQty() {
    if (!currentItemId) return;
    var item = D.getItem(currentItemId);
    if (!item) return;
    $('dQty').textContent = item.qty;
    $('dQtyBtn').setAttribute('aria-label', 'Quantity ' + item.qty + ' for ' + item.name + ' — tap to type a new quantity');
    $('dQtyState').textContent = qtyStateWord(item.qty);
    var pill = $('dStatus');
    pill.className = 'qty-pill ' + qtyClass(item.qty);
    pill.textContent = qtyLabel(item.qty);
    $('dCost').textContent = money(item.cost) + ' each';
    $('dUpdated').textContent = 'Last updated ' + fmtTime(item.updated) + (navigator.onLine ? '' : ' · queued (offline)');
  }
  function closeItem() { $('itemOverlay').classList.add('hidden'); currentItemId = null; renderHome(); }
  $('closeDetail').addEventListener('click', closeItem);
  $('doneDetail').addEventListener('click', closeItem);
  $('itemOverlay').addEventListener('click', function (e) { if (e.target === $('itemOverlay')) closeItem(); });

  function bump(delta) { if (currentItemId) changeQty(currentItemId, delta); }
  $('qtyPlus').addEventListener('click', function () { bump(1); });
  $('qtyMinus').addEventListener('click', function () { bump(-1); });
  /* ±5 is HOLD-to-apply (400ms): a short press does nothing, so a gloved
   * slip can't 5× an edit. Pointer + keyboard holds both work. */
  function attachHold(el, fn) {
    var timer = null, fired = false;
    function start(e) {
      if (e.type === 'keydown' && e.repeat) return;
      fired = false;
      clearTimeout(timer);
      timer = setTimeout(function () { fired = true; fn(); }, 400);
    }
    function cancel() { clearTimeout(timer); }
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
    el.addEventListener('keydown', start);
    el.addEventListener('keyup', cancel);
    el.addEventListener('click', function (e) { if (!fired) e.preventDefault(); });
  }
  attachHold($('qtyPlus5'), function () { bump(5); });
  attachHold($('qtyMinus5'), function () { bump(-5); });
  /* Exact count: tap the giant numeral to summon the numeric pad. */
  $('dQtyBtn').addEventListener('click', function () {
    if (!currentItemId) return;
    var id = currentItemId;
    var item = D.getItem(id);
    if (!item) return;
    openQtyEditor({
      value: item.qty, itemName: item.name, returnElement: $('dQtyBtn'),
      onCommit: function (qty) { setQtyWithUndo(id, qty); }
    });
  });

  function copyText(inputEl, msg) {
    inputEl.select(); inputEl.setSelectionRange(0, 9999);
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inputEl.value).then(done, function () { document.execCommand('copy'); done(); });
    } else { document.execCommand('copy'); done(); }
  }
  $('dCopyBtn').addEventListener('click', function () { copyText($('dStickerLink'), 'Sticker link copied'); });
  /* Folder rail in the item sheet (Sorting Kit): one chip per folder
   * plus Uncategorized, the item's current folder filled with the
   * accent. Tapping a chip files the item there on the spot — this
   * replaces the old folder chip that only jumped Home into the
   * folder; filing from wherever the item was found matters more. */
  function renderFolderRail(item) {
    if (!item) return;
    var cur = itemCategory(item);
    var names = D.getCategories().map(function (c) { return { name: c.name, icon: c.icon }; });
    names.push({ name: D.UNCAT, icon: 'box' });
    $('dFolderRail').innerHTML = names.map(function (f) {
      var on = f.name === cur;
      return '<button type="button" class="folder-rail-chip' + (on ? ' sel' : '') + '" data-rail-folder="' + esc(f.name) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="File ' + esc(item.name) + ' in ' + esc(f.name) + '">' +
        '<span class="frc-icon">' + svgIcon(f.icon) + '</span>' + esc(f.name) + '</button>';
    }).join('');
    $('dFolderRail').querySelectorAll('[data-rail-folder]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!currentItemId) return;
        var name = b.getAttribute('data-rail-folder');
        var it = D.getItem(currentItemId);
        if (!it || itemCategory(it) === name) return;
        D.setCategory(currentItemId, name);
        renderFolderRail(D.getItem(currentItemId));
        refreshChrome();
        toast('Filed in ' + name);
      });
    });
  }

  /* ---------- NFC Live: always-on listening while the app is open ----------
   * Android Chrome (Web NFC): a single NDEFReader.scan() keeps firing
   * `reading` events for every tag presented while the page is visible, so
   * listening can stay on for a whole warehouse session. Chrome requires a
   * user gesture for the first scan, so the header chip tap starts it, and
   * the saved preference ('et-nfc-live') re-arms it on the first touch after
   * the app is reopened. iOS Safari has no Web NFC at all — the chip stays
   * hidden there and stickers keep working because iOS opens their URLs. */
  var NFC_SUPPORTED = ('NDEFReader' in window);
  var nfcLiveWanted = false;
  try { nfcLiveWanted = localStorage.getItem('et-nfc-live') === '1'; } catch (e) { /* storage blocked */ }
  var nfcLiveActive = false;   // a scan() session is running
  var nfcLivePaused = false;   // wanted, but backgrounded or awaiting a gesture
  var nfcReader = null;
  var nfcAbort = null;
  var nfcArmSet = false;
  var nfcLastKey = '';
  var nfcLastAt = 0;

  /* All candidate ids from one tag read: ?item= ids from URL records,
   * raw text from text records, and the tag serial (matched to nfcId). */
  function nfcCandidateIds(ev) {
    var ids = [];
    var records = (ev && ev.message && ev.message.records) || [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec.data) continue;
      try {
        var text = new TextDecoder().decode(rec.data);
        if (rec.recordType === 'url' || rec.recordType === 'text') {
          var m = text.match(/[?&]item=([^&#\s]+)/);
          if (m) ids.push(decodeURIComponent(m[1]));
          if (rec.recordType === 'text' && text.trim()) ids.push(text.trim());
        }
      } catch (e) { /* ignore undecodable record */ }
    }
    if (ev && ev.serialNumber) ids.push(String(ev.serialNumber).replace(/:/g, ''));
    return ids;
  }
  function matchTagIds(ids) {
    var items = D.getItems();
    var i, hit;
    for (i = 0; i < ids.length; i++) {
      hit = items.filter(function (it) { return it.id === ids[i]; })[0];
      if (hit) return hit;
    }
    for (i = 0; i < ids.length; i++) {
      hit = items.filter(function (it) { return it.nfcId && it.nfcId === ids[i]; })[0];
      if (hit) return hit;
    }
    return null;
  }
  /* Shared tag handler — the live listener and the item-detail Scan button
   * both end up here. Accepts an array of candidate ids (or a single raw
   * payload string) plus the tag serial. Debounced: the same outcome within
   * 3 s is ignored, and a tag for the item already open does nothing. */
  function handleTag(rawPayload, serialNumber) {
    var ids = [];
    if (Array.isArray(rawPayload)) ids = rawPayload.slice();
    else if (rawPayload != null && rawPayload !== '') ids = [String(rawPayload)];
    if (serialNumber) ids.push(String(serialNumber).replace(/:/g, ''));
    var item = matchTagIds(ids);
    var key = item ? item.id : '__unlinked__';
    var now = Date.now();
    if (key === nfcLastKey && now - nfcLastAt < 3000) return 'debounced';
    nfcLastKey = key; nfcLastAt = now;
    if (!item) { toast('Tag not linked to an item'); return 'unlinked'; }
    if (currentItemId === item.id) return 'open';
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* unsupported */ } }
    openItem(item.id, true);
    toast('NFC · ' + item.name);
    return 'opened';
  }

  /* Wake Lock: while NFC Live is on and the page is visible, keep the
   * screen awake so the scanner doesn't die in a pocket mid-session.
   * Absence of the API is fine — everything degrades silently. */
  var wakeLock = null;
  function updateWakeLock() {
    var want = nfcLiveWanted && nfcLiveActive && !document.hidden && ('wakeLock' in navigator);
    if (want && !wakeLock) {
      try {
        navigator.wakeLock.request('screen').then(function (lock) {
          wakeLock = lock;
          lock.addEventListener('release', function () { wakeLock = null; });
        }).catch(function () { /* denied — NFC still works */ });
      } catch (e) { /* unsupported */ }
    } else if (!want && wakeLock) {
      try { wakeLock.release(); } catch (e) { /* already released */ }
      wakeLock = null;
    }
  }
  function renderNfcChip() {
    var btn = $('nfcLiveBtn');
    if (!btn) return;
    btn.classList.toggle('hidden', !NFC_SUPPORTED);
    if (!NFC_SUPPORTED) return;
    var label = $('nfcLiveLabel');
    btn.classList.remove('is-live', 'is-paused');
    if (nfcLivePaused) { btn.classList.add('is-paused'); label.textContent = 'NFC · Paused — tap'; }
    else if (nfcLiveActive) { btn.classList.add('is-live'); label.textContent = 'NFC · Live'; }
    else if (nfcLiveWanted) { btn.classList.add('is-paused'); label.textContent = 'NFC · Tap to resume'; }
    else { label.textContent = 'NFC · Off'; }
    btn.setAttribute('aria-pressed', nfcLiveWanted ? 'true' : 'false');
  }
  function startNfcLive() {
    if (!NFC_SUPPORTED) return Promise.resolve(false);
    nfcLiveWanted = true;
    try { localStorage.setItem('et-nfc-live', '1'); } catch (e) { /* storage blocked */ }
    if (nfcLiveActive) { nfcLivePaused = false; renderNfcChip(); return Promise.resolve(true); }
    if (!nfcReader) {
      nfcReader = new NDEFReader();
      nfcReader.addEventListener('reading', function (ev) {
        if (!nfcLiveWanted) return;   // stopped logically — Web NFC has no stop API of its own
        handleTag(nfcCandidateIds(ev), ev.serialNumber);
      });
      nfcReader.addEventListener('readingerror', function () {
        if (nfcLiveWanted) toast('Could not read that tag — try again');
      });
    }
    nfcAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var scanPromise = nfcAbort ? nfcReader.scan({ signal: nfcAbort.signal }) : nfcReader.scan();
    return scanPromise.then(function () {
      nfcLiveActive = true; nfcLivePaused = false; renderNfcChip(); updateWakeLock();
      return true;
    }).catch(function () {
      // Most often NotAllowedError: no gesture yet / permission not granted.
      // The chip stays in "Paused — tap"; tapping it retries with a gesture.
      nfcLiveActive = false; nfcLivePaused = true; renderNfcChip();
      return false;
    });
  }
  function stopNfcLive() {
    nfcLiveWanted = false; nfcLiveActive = false; nfcLivePaused = false;
    try { localStorage.setItem('et-nfc-live', '0'); } catch (e) { /* storage blocked */ }
    if (nfcAbort) { try { nfcAbort.abort(); } catch (e) { /* already settled */ } nfcAbort = null; }
    renderNfcChip(); updateWakeLock();
  }
  /* Chrome needs a gesture: arm a one-time first-touch retry. */
  function armNfcOnFirstTouch() {
    if (nfcArmSet || !NFC_SUPPORTED) return;
    nfcArmSet = true;
    document.addEventListener('pointerdown', function () {
      nfcArmSet = false;
      if (nfcLiveWanted && !nfcLiveActive) startNfcLive();
    }, { once: true });
  }
  $('nfcLiveBtn').addEventListener('click', function () {
    if (!NFC_SUPPORTED) return;
    if (nfcLiveWanted && nfcLiveActive) { stopNfcLive(); toast('NFC Live off'); }
    else startNfcLive();   // this tap is the user gesture Chrome requires
  });
  document.addEventListener('visibilitychange', function () {
    if (!NFC_SUPPORTED || !nfcLiveWanted) return;
    if (document.hidden) {
      // Readings stop while hidden; end the session so resume is clean.
      if (nfcAbort) { try { nfcAbort.abort(); } catch (e) { /* settled */ } nfcAbort = null; }
      nfcLiveActive = false; nfcLivePaused = true; renderNfcChip(); updateWakeLock();
    } else {
      // Try an immediate restart; if Chrome refuses without a gesture,
      // the next touch anywhere re-arms it.
      startNfcLive().then(function (ok) { if (!ok) armNfcOnFirstTouch(); updateWakeLock(); });
    }
  });
  function initNfcLive() {
    renderNfcChip();
    if (NFC_SUPPORTED && nfcLiveWanted) {
      startNfcLive().then(function (ok) { if (!ok) armNfcOnFirstTouch(); });
    }
  }

  /* No Scan button in the item detail: NFC Live (header chip) listens
   * globally while the app is open and opens items via handleTag(). */

  /* Sticker taps: ?item=<id> opens that item directly on load. */
  function openFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('item');
    if (id) openItem(id);
  }

  /* ---------- #03 Warehouse / Bin Map ---------- */
  var STATUS_RANK = { out: 0, crit: 1, low: 2, ok: 3 };
  function worstStatus(list) {
    var worst = 'ok';
    list.forEach(function (i) { if (STATUS_RANK[statusOf(i.qty)] < STATUS_RANK[worst]) worst = statusOf(i.qty); });
    return worst;
  }
  function renderMap() {
    var items = D.getItems();
    var byCell = {};
    items.forEach(function (i) { var k = cellKey(i.bin, levelOf(i)); (byCell[k] = byCell[k] || []).push(i); });
    $('binMap').innerHTML = AISLES.map(function (a) {
      var shelfItems = items.filter(function (i) { return shelfOf(i.bin) === a; });
      var lowOut = shelfItems.filter(function (i) { return i.qty <= 5; }).length;
      var bands = LEVELS_TOP_DOWN.map(function (lv) {
        var cells = '';
        for (var n = 1; n <= 6; n++) {
          var bin = a + n;
          var list = byCell[cellKey(bin, lv)] || [];
          var total = list.reduce(function (sum, i) { return sum + i.qty; }, 0);
          var cls, label;
          if (!list.length) { cls = 'bin-empty'; label = '·'; }
          else {
            var worst = worstStatus(list);
            cls = 'bin-' + worst;
            label = (worst === 'out' ? '✕ ' : (worst === 'ok' ? '' : '▲ ')) + total;
          }
          var isTarget = locateTarget && locateTarget.bin === bin && locateTarget.level === lv;
          cells += '<button class="bin-cell ' + cls + (isTarget ? ' sel' : '') + '" data-cell="' + cellKey(bin, lv) + '" data-bin="' + bin + '" data-level="' + lv + '" aria-label="' + locLongParts(bin, lv) + (list.length ? ', ' + total + ' units' : ', empty') + '">' +
            '<strong>P' + n + '</strong><small>' + label + '</small></button>';
        }
        return '<div class="shelf-band"><div class="level-rail">L' + lv + '</div><div class="bin-row">' + cells + '</div></div>';
      }).join('');
      var hasTarget = locateTarget && shelfOf(locateTarget.bin) === a;
      return '<section class="shelf-section" id="shelf-' + a + '"><div class="shelf-head' + (hasTarget ? ' has-target' : '') + '"><strong>SHELF ' + a + '</strong><span>24 cells · ' + lowOut + ' low/out</span></div>' + bands + '<div class="shelf-floor"></div></section>';
    }).join('');
    $('binMap').querySelectorAll('[data-cell]').forEach(function (c) {
      c.addEventListener('click', function () {
        if (locateTarget) { locateTarget = null; $('locateCaption').classList.add('hidden'); }
        openBinSheet(c.getAttribute('data-bin'), parseInt(c.getAttribute('data-level'), 10));
      });
    });
    updateLocateCaption();
  }

  /* ---------- Blink-on-search: "Show on shelf" ----------
   * The target cell pulses 3x in the accent color, then the .sel ring and
   * the caption hold it until dismissed, a cell is tapped, or tabs change.
   * Reduced motion: no pulse — the solid ring + caption are the signal. */
  function updateLocateCaption() {
    var cap = $('locateCaption');
    if (!locateTarget) { cap.classList.add('hidden'); return; }
    $('locateCaptionText').innerHTML = '<strong>' + esc(locateTarget.name) + '</strong> — ' + esc(locLongParts(locateTarget.bin, locateTarget.level));
    cap.classList.remove('hidden');
  }
  function blinkCell(cell) {
    if (!cell) return;
    cell.classList.remove('blink');
    void cell.offsetWidth;
    cell.classList.add('blink');
  }
  function activateLocate() {
    if (!locateTarget) return;
    updateLocateCaption();
    var cell = $('binMap').querySelector('[data-cell="' + cellKey(locateTarget.bin, locateTarget.level) + '"]');
    if (!cell) return;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    cell.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(function () {
      blinkCell(cell);
      try { cell.focus({ preventScroll: true }); } catch (e) { /* focus is a bonus */ }
    }, reduced ? 0 : 350);
  }
  function showOnShelf() {
    if (!currentItemId) return;
    var item = D.getItem(currentItemId);
    if (!item) return;
    locateTarget = { id: item.id, name: item.name, bin: item.bin, level: levelOf(item) };
    closeItem();
    showView('map');
  }
  $('showOnShelfBtn').addEventListener('click', showOnShelf);
  $('locateCaptionText').addEventListener('click', activateLocate);
  $('locateDismiss').addEventListener('click', function () {
    locateTarget = null;
    $('locateCaption').classList.add('hidden');
    renderMap();
  });
  document.querySelectorAll('[data-jump]').forEach(function (b) {
    b.addEventListener('click', function () {
      var el = document.getElementById('shelf-' + b.getAttribute('data-jump'));
      if (!el) return;
      var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' });
    });
  });
  /* ---------- Bin Sheet: a bin's contents as a sheet over the map ---------- */
  function openBinSheet(bin, level) {
    currentBin = bin; currentLevel = (level >= 1 && level <= 4) ? level : 2; selectedBin = bin;
    renderMap();
    renderBinSheetItems();
    $('binOverlay').classList.remove('hidden');
  }
  function closeBinSheet() { $('binOverlay').classList.add('hidden'); currentBin = null; currentLevel = null; }
  function renderBinSheetItems() {
    if (!currentBin) return;
    var list = D.getItems().filter(function (i) { return i.bin === currentBin && levelOf(i) === currentLevel; });
    var total = list.reduce(function (s, i) { return s + i.qty; }, 0);
    $('bTitle').textContent = locShortParts(currentBin, currentLevel);
    var worst = list.length ? worstStatus(list) : 'ok';
    var statusHtml = !list.length ? 'Empty bin'
      : '<span class="qty-pill ' + ('qty-' + worst) + '">' + (worst === 'ok' ? 'STOCKED' : qtyLabel(list.reduce(function (m, i) { return STATUS_RANK[statusOf(i.qty)] < STATUS_RANK[statusOf(m.qty)] ? i : m; }).qty)) + '</span>';
    $('bMeta').innerHTML = locLongParts(currentBin, currentLevel) + ' · ' + list.length + ' item(s) · ' + total + ' units &nbsp;' + statusHtml;
    $('binItems').innerHTML = list.length ? list.map(function (i) {
      return '<div class="list-item row-item"><span class="li-icon">' + iconPlate(i) + '</span>' +
        '<button type="button" class="li-main row-open" data-open="' + esc(i.id) + '"><span class="li-name">' + esc(i.name) + '</span><br>' +
        '<span class="li-sub">' + esc(i.sku) + ' · ' + esc(i.supplier) + '</span></button>' +
        '<span class="row-stepper">' +
          '<button type="button" data-bdec="' + esc(i.id) + '" aria-label="Remove one from ' + esc(i.name) + '">−</button>' +
          '<button type="button" class="row-qty-btn" data-bin-qty-btn="' + esc(i.id) + '" aria-label="Quantity ' + i.qty + ' for ' + esc(i.name) + ' — tap to type a new quantity">' + i.qty + '</button>' +
          '<button type="button" data-binc="' + esc(i.id) + '" aria-label="Add one to ' + esc(i.name) + '">+</button>' +
        '</span></div>';
    }).join('') : '<p class="muted">Nothing stored in this bin yet.</p>';
    var box = $('binItems');
    box.querySelectorAll('[data-open]').forEach(function (el) {
      el.addEventListener('click', function () { var id = el.getAttribute('data-open'); closeBinSheet(); openItem(id); });
    });
    box.querySelectorAll('[data-bdec]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-bdec'), -1); });
    });
    box.querySelectorAll('[data-binc]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-binc'), 1); });
    });
    box.querySelectorAll('[data-bin-qty-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-bin-qty-btn');
        var item = D.getItem(id);
        if (!item) return;
        openQtyEditor({
          value: item.qty, itemName: item.name,
          returnAttr: 'data-bin-qty-btn', returnValue: id,
          onCommit: function (qty) { setQtyWithUndo(id, qty); }
        });
      });
    });
  }
  $('closeBin').addEventListener('click', closeBinSheet);
  $('binOverlay').addEventListener('click', function (e) { if (e.target === $('binOverlay')) closeBinSheet(); });
  $('binAddBtn').addEventListener('click', function () {
    var bin = currentBin, level = currentLevel;
    closeBinSheet();
    openAddForBin(bin, level);
  });
  $('binCountBtn').addEventListener('click', function () { startCount(currentBin, currentLevel); });

  /* ---------- #19 Supplier Hub ----------
   * The list is ETData's union: suppliers the user added by hand plus
   * any supplier named on an item, each with live counts. It starts
   * EMPTY — no demo suppliers. Tapping a row drills into that
   * supplier's items (bin-sheet row pattern: open area + steppers
   * through the shared changeQty path). Edit mode reveals a remove ✕
   * on hand-added rows only; removing one never touches items, so a
   * name items still carry stays on as a "from items" row. */
  var selectedSupplier = null;   // drilled-in supplier name, or null = list
  var supplierEdit = false;
  function supplierEntry(name) {
    return D.getSuppliers().filter(function (s) { return s.name === name; })[0] || null;
  }
  function renderSuppliers() {
    var hub = D.getSuppliers();
    var drilled = selectedSupplier ? supplierEntry(selectedSupplier) : null;
    if (selectedSupplier && !drilled) {
      // The drilled supplier vanished (entry removed, no items left).
      selectedSupplier = null; supplierEdit = false;
    }
    $('supplierListWrap').classList.toggle('hidden', !!selectedSupplier);
    $('supplierDetail').classList.toggle('hidden', !selectedSupplier);
    $('supplierEditBtn').classList.toggle('hidden', !!selectedSupplier || supplierEdit || !hub.some(function (s) { return s.explicit; }));
    $('supplierDoneBtn').classList.toggle('hidden', !!selectedSupplier || !supplierEdit);
    if (selectedSupplier) { renderSupplierItems(drilled); return; }
    $('supplierEmpty').classList.toggle('hidden', hub.length > 0);
    $('supplierList').innerHTML = hub.map(function (s) {
      var counts = s.items + (s.items === 1 ? ' item' : ' items') + ' · ' + s.units + ' units';
      var sub = s.blurb ? esc(s.blurb) : '';
      var main = '<span class="li-main"><span class="li-name">' + esc(s.name) + '</span>' +
        (s.explicit ? '' : ' <span class="sup-tag">from items</span>') +
        (sub ? '<br><span class="li-sub">' + sub + '</span>' : '') + '</span>';
      var tail = '<span class="sup-counts">' + counts + '</span><span class="air-chev" aria-hidden="true">›</span>';
      if (supplierEdit && s.explicit) {
        return '<div class="list-item supplier-row"><span class="li-icon">' + svgIcon('factory') + '</span>' + main + tail +
          '<button type="button" class="sup-x" data-sup-remove="' + esc(s.name) + '" aria-label="Remove supplier ' + esc(s.name) + '">✕</button></div>';
      }
      return '<button type="button" class="list-item supplier-row" data-supplier="' + esc(s.name) + '" aria-label="Open supplier ' + esc(s.name) + ', ' + counts + '">' +
        '<span class="li-icon">' + svgIcon('factory') + '</span>' + main + tail + '</button>';
    }).join('');
    var list = $('supplierList');
    list.querySelectorAll('[data-supplier]').forEach(function (row) {
      row.addEventListener('click', function () {
        selectedSupplier = row.getAttribute('data-supplier');
        renderSuppliers();
        window.scrollTo(0, 0);
      });
    });
    list.querySelectorAll('[data-sup-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.getAttribute('data-sup-remove');
        D.removeSupplier(name);
        toast('Removed ' + name + ' — items keep their supplier name', 2600);
        renderSuppliers();
      });
    });
  }
  function renderSupplierItems(entry) {
    var name = selectedSupplier;
    var mine = D.getItems().filter(function (i) { return String(i.supplier || '').trim() === name; });
    $('supTitle').textContent = name;
    $('supMeta').textContent = mine.length + (mine.length === 1 ? ' item' : ' items') + ' · ' +
      mine.reduce(function (s, i) { return s + i.qty; }, 0) + ' units' +
      (entry && entry.blurb ? ' · ' + entry.blurb : '');
    $('supplierItemsEmpty').classList.toggle('hidden', mine.length > 0);
    $('supplierItems').innerHTML = mine.map(function (i) {
      return '<div class="list-item row-item"><span class="li-icon">' + iconPlate(i) + '</span>' +
        '<button type="button" class="li-main row-open" data-sopen="' + esc(i.id) + '"><span class="li-name">' + esc(i.name) + '</span><br>' +
        '<span class="li-sub">' + esc(i.sku) + ' · ' + esc(locShort(i)) + '</span></button>' +
        '<span class="qty-pill ' + qtyClass(i.qty) + '">' + qtyLabel(i.qty) + '</span>' +
        '<span class="row-stepper">' +
          '<button type="button" data-sdec="' + esc(i.id) + '" aria-label="Remove one from ' + esc(i.name) + '">−</button>' +
          '<button type="button" class="row-qty-btn" data-sup-qty-btn="' + esc(i.id) + '" aria-label="Quantity ' + i.qty + ' for ' + esc(i.name) + ' — tap to type a new quantity">' + i.qty + '</button>' +
          '<button type="button" data-sinc="' + esc(i.id) + '" aria-label="Add one to ' + esc(i.name) + '">+</button>' +
        '</span></div>';
    }).join('');
    var box = $('supplierItems');
    box.querySelectorAll('[data-sopen]').forEach(function (el) {
      el.addEventListener('click', function () { openItem(el.getAttribute('data-sopen')); });
    });
    box.querySelectorAll('[data-sdec]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-sdec'), -1); });
    });
    box.querySelectorAll('[data-sinc]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-sinc'), 1); });
    });
    box.querySelectorAll('[data-sup-qty-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-sup-qty-btn');
        var item = D.getItem(id);
        if (!item) return;
        openQtyEditor({
          value: item.qty, itemName: item.name,
          returnAttr: 'data-sup-qty-btn', returnValue: id,
          onCommit: function (qty) { setQtyWithUndo(id, qty); }
        });
      });
    });
  }
  $('supBack').addEventListener('click', function () { selectedSupplier = null; renderSuppliers(); window.scrollTo(0, 0); });
  $('supplierEditBtn').addEventListener('click', function () { supplierEdit = true; renderSuppliers(); });
  $('supplierDoneBtn').addEventListener('click', function () { supplierEdit = false; renderSuppliers(); });
  /* Add-supplier sheet */
  function openSupplierForm() {
    $('supName').value = '';
    $('supBlurb').value = '';
    $('supError').classList.add('hidden');
    $('supplierOverlay').classList.remove('hidden');
    $('supName').focus();
  }
  function closeSupplierForm() { $('supplierOverlay').classList.add('hidden'); }
  $('addSupplierBtn').addEventListener('click', openSupplierForm);
  $('supCancelBtn').addEventListener('click', closeSupplierForm);
  $('supplierOverlay').addEventListener('click', function (e) { if (e.target === $('supplierOverlay')) closeSupplierForm(); });
  $('supSaveBtn').addEventListener('click', function () {
    var res = D.addSupplier($('supName').value, $('supBlurb').value);
    if (!res.ok) {
      $('supError').textContent = res.message || 'Couldn\'t add that supplier.';
      $('supError').classList.remove('hidden');
      return;
    }
    closeSupplierForm();
    supplierEdit = false;
    renderSuppliers();
    refreshSupplierList();
    toast('Supplier added');
  });

  /* ---------- Count Mode: walk a bin item by item, then apply ---------- */
  var countSession = null;
  function startCount(bin, level) {
    if (!bin) return;
    var lv = (level >= 1 && level <= 4) ? level : 2;
    var list = D.getItems().filter(function (i) { return i.bin === bin && levelOf(i) === lv; });
    if (!list.length) { toast(locShortParts(bin, lv) + ' is empty — nothing to count'); return; }
    countSession = {
      bin: bin, level: lv,
      entries: list.map(function (i) { return { id: i.id, system: i.qty, counted: i.qty }; }),
      idx: 0
    };
    closeBinSheet();
    $('countOverlay').classList.remove('hidden');
    showCountStep();
  }
  function showCountStep() {
    if (!countSession) return;
    $('cReview').classList.add('hidden');
    $('cMain').classList.remove('hidden');
    var en = countSession.entries[countSession.idx];
    var item = D.getItem(en.id);
    if (!item) return;
    $('cProgress').textContent = (countSession.idx + 1) + ' of ' + countSession.entries.length + ' · ' + locShort(item);
    $('cHero').innerHTML = iconPlate(item);
    $('cName').textContent = item.name;
    $('cMeta').textContent = locShort(item) + ' · system qty ' + en.system;
    $('cQty').textContent = en.counted;
    $('cQtyBtn').setAttribute('aria-label', 'Counted quantity ' + en.counted + ' for ' + item.name + ' — tap to type a new counted quantity');
    $('cBack').textContent = countSession.idx === 0 ? 'Cancel' : 'Back';
    $('cNext').textContent = countSession.idx === countSession.entries.length - 1 ? 'Finish' : 'Next';
  }
  function closeCount() { $('countOverlay').classList.add('hidden'); countSession = null; }
  $('cQtyBtn').addEventListener('click', function () {
    if (!countSession) return;
    var en = countSession.entries[countSession.idx];
    var item = D.getItem(en.id);
    if (!item) return;
    openQtyEditor({
      value: en.counted, itemName: item.name, counted: true, returnSelector: '#cQtyBtn',
      onCommit: function (qty) {
        en.counted = qty;
        $('cQty').textContent = qty;
        $('cQtyBtn').setAttribute('aria-label', 'Counted quantity ' + qty + ' for ' + item.name + ' — tap to type a new counted quantity');
      }
    });
  });
  $('cPlus').addEventListener('click', function () {
    if (!countSession) return;
    var en = countSession.entries[countSession.idx];
    en.counted++; $('cQty').textContent = en.counted;
    var itemUp = D.getItem(en.id); if (itemUp) $('cQtyBtn').setAttribute('aria-label', 'Counted quantity ' + en.counted + ' for ' + itemUp.name + ' — tap to type a new counted quantity');
  });
  $('cMinus').addEventListener('click', function () {
    if (!countSession) return;
    var en = countSession.entries[countSession.idx];
    en.counted = Math.max(0, en.counted - 1); $('cQty').textContent = en.counted;
    var itemDown = D.getItem(en.id); if (itemDown) $('cQtyBtn').setAttribute('aria-label', 'Counted quantity ' + en.counted + ' for ' + itemDown.name + ' — tap to type a new counted quantity');
  });
  $('cBack').addEventListener('click', function () {
    if (!countSession) return;
    if (countSession.idx === 0) closeCount();
    else { countSession.idx--; showCountStep(); }
  });
  $('cNext').addEventListener('click', function () {
    if (!countSession) return;
    if (countSession.idx < countSession.entries.length - 1) { countSession.idx++; showCountStep(); }
    else finishCount();
  });
  /* Variance gate: flag counts off by >20% OR >10 units before applying. */
  function countVariance(en) {
    var diff = Math.abs(en.counted - en.system);
    return diff > 10 || (en.system > 0 && diff > 0.2 * en.system);
  }
  function finishCount() {
    var flagged = countSession.entries.filter(countVariance);
    if (!flagged.length) { applyCount(); return; }
    $('cMain').classList.add('hidden');
    $('cReview').classList.remove('hidden');
    $('cReviewList').innerHTML = flagged.map(function (en) {
      var item = D.getItem(en.id);
      var diff = en.counted - en.system;
      return '<div class="list-item"><span class="li-icon">' + (item ? iconFor(item) : '') + '</span>' +
        '<span class="li-main"><span class="li-name">' + esc(item ? item.name : en.id) + '</span><br>' +
        '<span class="li-sub">System ' + en.system + ' → counted ' + en.counted + ' (' + (diff > 0 ? '+' : '') + diff + ')</span></span></div>';
    }).join('');
  }
  $('cReviewBack').addEventListener('click', function () { showCountStep(); });
  $('cApplyBtn').addEventListener('click', function () { applyCount(); });
  function applyCount() {
    var session = countSession;
    if (!session) return;
    var changed = session.entries.filter(function (en) { return en.counted !== en.system; });
    var prev = {};
    changed.forEach(function (en) { prev[en.id] = en.system; D.setQty(en.id, en.counted); });
    closeCount();
    if ($('view-map').classList.contains('active')) renderMap();
    if ($('view-home').classList.contains('active')) renderHome();
    refreshChrome();
    if (changed.length) {
      showUndoToast('Count applied — ' + changed.length + ' item(s) updated', function () {
        changed.forEach(function (en) { D.setQty(en.id, prev[en.id]); });
        if ($('view-map').classList.contains('active')) renderMap();
        if ($('view-home').classList.contains('active')) renderHome();
        refreshChrome();
      });
    } else {
      toast('Count matches — no changes');
    }
  }
  $('countOverlay').addEventListener('click', function (e) { if (e.target === $('countOverlay')) closeCount(); });
  /* ---------- #22 Quick Add ---------- */
  var iconTouched = false;      // user picked a category manually — stop auto-assigning
  var pendingAdd = null;        // { data, dup } while the duplicate warning is up
  function selectIcon(key) {
    selectedIcon = key;
    $('iconPicker').querySelectorAll('.icon-choice').forEach(function (x) {
      x.classList.toggle('sel', x.getAttribute('data-icon') === key);
    });
  }
  /* Icon auto-assign by name keywords (until the user picks one manually). */
  function autoIconFor(name) {
    var n = ' ' + String(name || '').toLowerCase() + ' ';
    if (/breaker|panel|disconnect/.test(n)) return 'controller';
    if (/outlet|receptacle|switch|gfci|afci|dimmer|plate|plug/.test(n)) return 'plug';
    if (/light|lamp|bulb|led|fixture/.test(n)) return 'light';
    if (/romex|thhn|wire|cable|coax/.test(n)) return 'link';
    if (/box|enclosure|junction/.test(n)) return 'box';
    if (/conduit|emt|elbow|coupling|fitting/.test(n)) return 'hex';
    if (/screw|bolt|nut|washer|anchor|staple|tape/.test(n)) return 'bolt';
    if (n.indexOf('battery') !== -1) return 'battery';
    return 'kit';
  }
  /* Supplier is a free-text field; the datalist offers the Suppliers
   * hub names (hand-added entries + names already on items) so
   * spelling stays consistent. */
  function refreshSupplierList() {
    var dl = $('supplierNames');
    if (!dl) return;
    dl.innerHTML = D.getSuppliers().map(function (s) { return '<option value="' + esc(s.name) + '">'; }).join('');
  }
  function initAddForm() {
    refreshFolderSelect();
    refreshSupplierList();
    $('addBin').innerHTML = BINS.map(function (b) { return '<option>' + b + '</option>'; }).join('');
    $('iconPicker').innerHTML = ICON_KEYS.map(function (key, idx) {
      return '<button type="button" class="icon-choice' + (idx === 0 ? ' sel' : '') + '" data-icon="' + key + '" aria-label="' + key + '">' + svgIcon(key) + '</button>';
    }).join('');
    $('iconPicker').querySelectorAll('[data-icon]').forEach(function (b) {
      b.addEventListener('click', function () { iconTouched = true; selectIcon(b.getAttribute('data-icon')); });
    });
    $('addName').addEventListener('input', function () {
      if (iconTouched) return;
      var key = autoIconFor($('addName').value);
      if (key) selectIcon(key);
    });
    $('addSku').addEventListener('input', updateSkuLookup);
    $('addName').addEventListener('input', updateSkuLookup);
    updateSkuLookup();
  }
  /* Part-number lookup: with a part number typed, offer one-tap web
   * searches for it (query = part number + name when present). The
   * links open in a new tab; the app itself never fetches the results
   * — supplier sites block programmatic reads, and an honest shortcut
   * beats a scraper that breaks. */
  function lookupHref(kind, query) {
    var q = encodeURIComponent(query);
    if (kind === 'images') return 'https://www.google.com/search?tbm=isch&q=' + q;
    if (kind === 'amazon') return 'https://www.amazon.com/s?k=' + q;
    return 'https://www.google.com/search?q=' + q;
  }
  function updateSkuLookup() {
    var skuEl = $('addSku');
    if (!skuEl) return;
    var sku = skuEl.value.trim();
    var show = !!sku;
    $('skuLookup').classList.toggle('hidden', !show);
    $('skuLookupHint').classList.toggle('hidden', !show);
    if (!show) return;
    var query = (sku + ' ' + $('addName').value.trim()).trim();
    $('lkWeb').href = lookupHref('web', query);
    $('lkImages').href = lookupHref('images', query);
    $('lkAmazon').href = lookupHref('amazon', query);
  }
  function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function doAdd(data) {
    var item = D.addItem(data);
    pendingAdd = null;
    $('addDupWarn').classList.add('hidden');
    $('addForm').classList.add('hidden');
    $('addSuccess').classList.remove('hidden');
    $('addSuccessText').textContent = item.name + ' — ' + item.qty + ' in ' + locShort(item) + ' · Folder: ' + itemCategory(item) + '. Stick an NFC sticker on the bin/item and write this link to it:';
    $('addStickerLink').value = D.stickerUrl(item.id);
    $('addWriteNfcBtn').classList.toggle('hidden', !('NDEFReader' in window));
    $('addWriteNfcBtn').onclick = function () { writeSticker(D.stickerUrl(item.id)); };
    refreshChrome();
    toast('Added ' + item.name);
  }
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = {
      name: $('addName').value.trim(),
      sku: $('addSku').value.trim(),
      qty: $('addQty').value, cost: $('addCost').value,
      bin: $('addBin').value, level: $('addLevel').value, supplier: $('addSupplier').value, icon: selectedIcon,
      category: $('addFolder').value || D.UNCAT
    };
    if (!data.name) return;
    /* Duplicate-name check: offer "Receive this instead" rather than
     * silently creating a twin of an item that already exists. */
    var dup = D.getItems().filter(function (i) { return normName(i.name) === normName(data.name); })[0];
    if (dup) {
      pendingAdd = { data: data, dup: dup };
      $('dupText').textContent = '“' + dup.name + '” already exists — ' + locShort(dup) + ', ' + dup.qty + ' in stock. Receive against that item instead of adding a duplicate?';
      $('addDupWarn').classList.remove('hidden');
      return;
    }
    doAdd(data);
  });
  $('dupReceiveBtn').addEventListener('click', function () {
    if (!pendingAdd) return;
    var dup = pendingAdd.dup;
    pendingAdd = null;
    $('addDupWarn').classList.add('hidden');
    openItem(dup.id);
  });
  $('dupAnywayBtn').addEventListener('click', function () {
    if (!pendingAdd) return;
    doAdd(pendingAdd.data);
  });
  /* Quick Add launched from a bin (bin sheet) — bin comes pre-filled. */
  function openAddForBin(bin, level) {
    showView('add');
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    if (bin) $('addBin').value = bin;
    if (level >= 1 && level <= 4) $('addLevel').value = String(level);
    $('addName').focus();
  }
  $('addCopyBtn').addEventListener('click', function () { copyText($('addStickerLink'), 'Sticker link copied'); });
  $('addAnotherBtn').addEventListener('click', function () {
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    $('addForm').reset(); $('addQty').value = 1;
    updateSkuLookup();
    iconTouched = false; pendingAdd = null;
    $('addDupWarn').classList.add('hidden');
    selectIcon(ICON_KEYS[0]);
  });
  function writeSticker(url) {
    if (!('NDEFReader' in window)) { toast('Web NFC writing needs Chrome on Android'); return; }
    try {
      var writer = new NDEFReader();
      writer.write({ records: [{ recordType: 'url', data: url }] })
        .then(function () { toast('Sticker written — hold it near the phone to test.'); })
        .catch(function (err) { toast('Write failed: ' + err.message); });
    } catch (e) { toast('NFC writing not available here'); }
  }

  /* ---------- #16 Offline-First / Sync Queue ---------- */
  function renderQueue() {
    $('queueNetStatus').textContent = navigator.onLine ? 'Online' : 'Offline';
    var q = D.getQueue();
    var pending = q.filter(function (c) { return !c.synced; });
    $('queuePendingCount').textContent = pending.length;
    $('queueLastSync').textContent = fmtTime(D.getMeta().lastSync);
    var sorted = q.slice().reverse();
    $('queueList').innerHTML = sorted.length ? sorted.map(function (c) {
      return '<div class="list-item queue-item' + (c.synced ? ' synced' : '') + '"><span class="li-icon">' + (c.synced ? svgIcon('check') : svgIcon('sync')) + '</span>' +
        '<span class="li-main"><span class="li-name">' + esc(c.detail) + '</span><br><span class="li-when">' + esc(c.type) + ' · ' + fmtTime(c.at) + '</span></span>' +
        '<span class="sync-tag' + (c.synced ? ' done' : '') + '">' + (c.synced ? 'SYNCED' : 'PENDING') + '</span></div>';
    }).join('') : '<p class="muted">No changes yet — adjust a quantity and it will appear here.</p>';
    refreshChrome();
  }
  $('syncNowBtn').addEventListener('click', function () {
    var out = $('syncResult');
    out.textContent = 'Syncing…'; out.className = 'result';
    D.flushQueue().then(function (r) {
      out.textContent = r.message; out.className = 'result ' + (r.ok ? 'ok' : 'err');
      renderQueue(); renderSync();
    });
  });
  /* Auto-flush: when the connection returns or the app comes back to the
   * foreground, quietly push the queue if a live backend is connected. */
  function maybeAutoFlush() {
    if (!navigator.onLine || !D.isLive()) return;
    if (!D.getQueue().some(function (c) { return !c.synced; })) return;
    D.flushQueue().then(function (r) {
      refreshChrome();
      if ($('view-sync').classList.contains('active')) { renderQueue(); renderSync(); }
      if (!r.ok) return;   // failure stays visible in Settings — no noisy toast
    });
  }
  window.addEventListener('online', function () { refreshChrome(); renderQueue(); toast('Back online'); maybeAutoFlush(); });
  window.addEventListener('offline', function () { refreshChrome(); renderQueue(); toast('Offline — changes will queue'); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) maybeAutoFlush(); });

  /* ---------- Sync Health & Settings ---------- */
  function renderSync() {
    var active = D.activeBackend();
    if (window.ETSheets) {
      var sc = window.ETSheets.getConfig();
      if (document.activeElement !== $('setSheetUrl')) $('setSheetUrl').value = sc.url;
      if (document.activeElement !== $('setSheetToken')) $('setSheetToken').value = sc.token;
    }
    $('healthMode').textContent = active === 'sheet' ? 'Live · Google Sheet' : 'Demo (local data)';
    $('healthSheetRows').textContent = D.getMeta().sheetRows == null ? '–' : D.getMeta().sheetRows;
    $('healthRows').textContent = D.getItems().length;
    $('healthQueue').textContent = D.getQueue().filter(function (c) { return !c.synced; }).length + ' pending';
    $('healthLastSync').textContent = fmtTime(D.getMeta().lastSync);
    $('healthError').textContent = D.getMeta().lastError || 'none';
    refreshChrome();
  }

  /* One Connect button: saves the pasted link on this device, then
   * tests it — in Sheet mode testConnection also imports the rows. */
  $('connectSheetBtn').addEventListener('click', function () {
    var out = $('sheetTestResult');
    var pasted = $('setSheetUrl').value.trim();
    // Guard the mix-up that produces a bare "Load failed": the sheet's
    // own link is not the bridge link. Say so, in plain words, before
    // anything is saved or fetched.
    if (/docs\.google\.com\/spreadsheets/.test(pasted)) {
      out.textContent = 'That is the spreadsheet link, not the Web app link — the app needs the link from the script editor: Deploy → Manage deployments → Web app URL (starts with script.google.com, ends in /exec).';
      out.className = 'result err';
      return;
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(pasted)) {
      out.textContent = 'That does not look like a Web app link — it should start with script.google.com/macros/s/ and end in /exec. Find it in the script editor: Deploy → Manage deployments.';
      out.className = 'result err';
      return;
    }
    if (window.ETSheets) window.ETSheets.saveConfig({ url: pasted, token: $('setSheetToken').value });
    out.textContent = 'Connecting…'; out.className = 'result';
    D.testConnection().then(function (r) {
      out.textContent = r.message; out.className = 'result ' + (r.ok ? 'ok' : 'err');
      if (r.ok) { renderHome(); refreshChrome(); }
      renderSync();
    });
  });
  /* ---------- init ---------- */
  initTheme();
  initNfcLive();
  initAddForm();
  renderHome();
  renderSync();
  refreshChrome();
  // Sheet mode: pull the sheet's rows so the app opens on real data.
  D.refreshFromBackend().then(function (r) {
    if (r && r.ok) { renderHome(); renderSync(); refreshChrome(); }
  });
  fitSticky();
  openFromUrl();
})();
