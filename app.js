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
  var currentShelf = null;   // free-text location open in the Shelf view, or null
  var currentLevel = null;
  var locateTarget = null;   // { id, name, bin, level } — blink-on-search target
  var selectedIcon = ICON_KEYS[0];
  var lowFilter = false;
  /* Folder tab strip state (v31): categoryFilter is the selected
   * tab — null = All, otherwise a folder name (D.UNCAT included).
   * The strip sits under the search panel in the sticky header and
   * filters the grid in place; there is no folder browse /
   * drill-in state anymore. */
  var categoryFilter = null;
  var pendingRemoveFolder = null;
  var addMenuOpen = false;
  var jumpListOpen = false;   // folder jump list (v33): All tapped twice
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
    renderSortCounts();
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
    /* Qty-originated re-renders preserve the pinned order (v34):
     * the card updates in place and never changes position, even
     * when its quantity passes a neighbour's. */
    if ($('view-home').classList.contains('active')) renderHome({ preserveOrder: true });
    if (currentItemId === id && !$('itemOverlay').classList.contains('hidden')) syncSheetQty();
    if (currentBin && !$('binOverlay').classList.contains('hidden')) renderBinSheetItems();
    if (currentShelf !== null && !$('shelfOverlay').classList.contains('hidden')) renderShelf({ preserveOrder: true });
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
    closeFolderJump();
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
    closeAddMenu();
    closeFolderJump();
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('active'); });
    var el = $('view-' + name); if (el) el.classList.add('active');
    document.querySelectorAll('.tab').forEach(function (t) {
      var on = t.getAttribute('data-view') === name;
      t.classList.toggle('active', on);
      if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    if (name !== 'map' && locateTarget) { locateTarget = null; $('locateCaption').classList.add('hidden'); }
    if (name === 'home') renderHome();
    if (name === 'add') prepAddForm();
    if (name === 'map') { renderMap(); if (locateTarget) setTimeout(activateLocate, 40); }
    if (name === 'suppliers') renderSuppliers();
    if (name === 'sync') { queueExpanded = false; orphansExpanded = false; renderQueue(); renderSync(); }
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tab').forEach(function (t) {
    if (t.classList.contains('tab-add')) return;  // the dock + opens the create menu instead (below)
    t.addEventListener('click', function () {
      var name = t.getAttribute('data-view');
      /* v37: Home pressed while already on Home toggles the folder
       * jump list — the double-tap All already had, on the dock.
       * Capture both states BEFORE showView runs, because showView
       * closes the list: a press with the list closed opens it, a
       * press with it open leaves it closed. */
      var wasHome = name === 'home' && $('view-home').classList.contains('active');
      var jumpWas = jumpListOpen;
      showView(name);
      if (wasHome && !jumpWas) openFolderJump();
    });
  });

  /* ---------- grid order: quantity, highest first (v34) ----------
   * The standard item grid ranks by stock on hand: qty DESC, ties by
   * display name A→Z (case-insensitive), then id — fully
   * deterministic. (Low/out items have their own stat-filter view, so
   * the main list leads with what's most in stock.) A missing or
   * non-numeric qty counts as 0 and sinks to the end. The order is
   * recomputed on navigation renders — tab/folder selection, search
   * changes, filter changes, view entry, backend refresh/import,
   * jump-list selection — but NEVER by a qty change itself: qty-
   * originated re-renders pass { preserveOrder: true } and reuse the
   * pinned id order, so stepping +/−, undoing a step, or applying a
   * count never moves a card out from under the user's finger. */
  function qtyOf(i) { var n = Number(i && i.qty); return isFinite(n) ? n : 0; }
  function byQtyDesc(a, b) {
    var d = qtyOf(b) - qtyOf(a);
    if (d) return d;
    var an = String(a.name || '').toLowerCase(), bn = String(b.name || '').toLowerCase();
    if (an < bn) return -1;
    if (an > bn) return 1;
    var ai = String(a.id), bi = String(b.id);
    return ai < bi ? -1 : (ai > bi ? 1 : 0);
  }
  /* Reorder `list` (a copy — the caller's array is never mutated) by
   * a pinned id sequence. Items not in the pin (newly matching the
   * filter since the pin was taken) fall to the end, comparator-
   * ordered among themselves. A null/empty pin = plain comparator. */
  function applyPinnedOrder(list, pinnedIds) {
    if (!pinnedIds || !pinnedIds.length) return list.slice().sort(byQtyDesc);
    var rank = {};
    pinnedIds.forEach(function (id, idx) { rank[id] = idx; });
    var pinned = [], fresh = [];
    list.forEach(function (i) {
      if (Object.prototype.hasOwnProperty.call(rank, i.id)) pinned.push(i); else fresh.push(i);
    });
    pinned.sort(function (a, b) { return rank[a.id] - rank[b.id]; });
    fresh.sort(byQtyDesc);
    return pinned.concat(fresh);
  }
  var homeOrder = null;   // pinned grid order (item ids) for qty-originated re-renders

  /* ---------- #08 Photo-First Grid (Home) ---------- */
  function renderHome(opts) {
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
    /* Home is always the item grid now (v31): the folder tab strip
     * under the search panel picks which folder it shows. Searching (or
     * the LOW filter) suspends the folder, as before: results are
     * global and the caption says so. */
    var searching = !!q || lowFilter;
    $('folderCaption').classList.toggle('hidden', !searching);
    renderFolderTabs();
    /* Filing (Auto-sort / Sort mode) lives in Settings only (v39) —
     * Home carries no banner; nothing above the grid but the grid. */
    var filtered = items.filter(function (i) {
      if (lowFilter && i.qty > 5) return false;
      if (!q) return true;
      var hay = (i.name + ' ' + i.sku + ' ' + i.bin + ' ' + i.supplier + ' ' + locShort(i) + ' ' + locLong(i)).toLowerCase();
      if (hay.indexOf(q) !== -1) return true;
      var compact = q.replace(/[\s·\-]/g, '');
      return compact.length > 1 && locShort(i).toLowerCase().replace(/[\s·]/g, '').indexOf(compact) !== -1;
    });
    if (!searching && categoryFilter !== null) {
      filtered = filtered.filter(function (i) { return itemCategory(i) === categoryFilter; });
    }
    /* Quantity order (v34) applies to every grid this function
     * renders — All, a folder tab, search results, and the LOW view
     * (ordered within its filtered set). A qty-originated re-render
     * keeps the pinned order instead of re-sorting. */
    if (opts && opts.preserveOrder) {
      filtered = applyPinnedOrder(filtered, homeOrder);
    } else {
      filtered = filtered.slice().sort(byQtyDesc);
      homeOrder = filtered.map(function (i) { return i.id; });
    }
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
      : (categoryFilter !== null && !q ? 'Nothing filed here yet.' : 'No items match your search.');
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
  }
  /* ---------- Folder tab strip (v31) ----------
   * Folders are category NAMES on the items (ETData owns the list and
   * the rename/remove cascades). On Home they are a horizontal strip
   * of physical folder tabs under the search panel: All, every folder
   * in list order, Uncategorized pinned last. Tapping a
   * tab filters the grid in place — no drill-in page. The strip has
   * carousel manners: scroll-snap, the selected tab centers itself,
   * a direction-locked swipe over the grid steps through folders
   * with wrap-around, and a user scroll of the strip itself selects
   * whichever tab settles at the center. A 450ms long-press on a
   * folder tab opens its rename/remove sheet. Tapping All while
   * All is already selected toggles the folder jump list (v33):
   * every folder as a row under the strip, tap one to jump
   * straight to it instead of scrolling the strip. */
  var tabKeysCache = [];        // last-rendered strip keys: null = All, else folder name
  var tabsSig = '';             // rebuild signature (names + selection)
  var stripProgUntil = 0;       // programmatic-centering guard for settle-select
  var stripSettleTimer = null;

  function tabKeys() {
    var keys = [null];
    D.folderStats().forEach(function (s) { keys.push(s.name); });
    // folderStats only lists the system folder while it holds items;
    // the strip always carries it, pinned last.
    if (keys.indexOf(D.UNCAT) === -1) keys.push(D.UNCAT);
    return keys;
  }
  /* The strip only rebuilds when the folder set or the selection
   * changes (renderHome runs on every keystroke and qty tap, and a
   * rebuild mid-scroll would yank the strip). Scroll position is
   * preserved across a rebuild; centering adjusts it afterwards. */
  function renderFolderTabs() {
    var strip = $('folderTabs');
    if (!strip) return;
    var keys = tabKeys();
    var sig = keys.map(function (k) { return k === null ? '' : k; }).join('|') + '::' + (categoryFilter === null ? '' : categoryFilter) + (jumpListOpen ? '::J' : '');
    if (sig === tabsSig && strip.children.length) { tabKeysCache = keys; return; }
    var keepScroll = strip.scrollLeft;
    tabsSig = sig;
    tabKeysCache = keys;
    strip.innerHTML = keys.map(function (k, idx) {
      var active = k === categoryFilter;
      var label = k === null ? 'All' : k;
      // The All tab carries the jump list's chevron (v33): it flips
      // while the list is open, so the second tap reads as a toggle.
      var chev = k === null
        ? '<svg class="ftab-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="square" aria-hidden="true" focusable="false"><path d="M4 9 L12 17 L20 9"/></svg>'
        : '';
      var allAttrs = k === null
        ? ' aria-haspopup="listbox" aria-expanded="' + (jumpListOpen ? 'true' : 'false') + '"'
        : '';
      return '<div class="ftab-wrap' + (active ? ' active' : '') + '">' +
        '<button type="button" class="ftab' + (active ? ' active' : '') + (k === null && jumpListOpen ? ' jump-open' : '') + '" role="tab" data-tk="' + idx + '"' +
        ' aria-selected="' + (active ? 'true' : 'false') + '"' + allAttrs + '><span class="ftab-label">' + esc(label) + chev + '</span></button></div>';
    }).join('');
    strip.scrollLeft = keepScroll;
    strip.querySelectorAll('[data-tk]').forEach(function (btn) {
      attachTabPress(btn, tabKeysCache[parseInt(btn.getAttribute('data-tk'), 10)]);
    });
  }
  /* Tap selects; a 450ms hold opens the folder's sheet instead (All
   * and the system folder have no sheet). The press timer + fired
   * flag keep the two from fighting, and a >10px move cancels the
   * hold — the strip scrolls, so a hold that turns into a drag must
   * not pop the sheet open mid-scroll. */
  var tabLpTimer = null, tabLpFiredAt = 0, tabLpFiredKey = null;
  function attachTabPress(btn, key) {
    var startX = 0, startY = 0;
    btn.addEventListener('pointerdown', function (e) {
      startX = e.clientX; startY = e.clientY;
      if (key === null || key === D.UNCAT) return;
      clearTimeout(tabLpTimer);
      tabLpTimer = setTimeout(function () {
        tabLpFiredAt = Date.now();
        tabLpFiredKey = key;
        if (navigator.vibrate) { try { navigator.vibrate(30); } catch (err) { /* unsupported */ } }
        openFolderSheet(key);
      }, 450);
    });
    btn.addEventListener('pointermove', function (e) {
      if (Math.abs(e.clientX - startX) > 10 || Math.abs(e.clientY - startY) > 10) clearTimeout(tabLpTimer);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      btn.addEventListener(ev, function () { clearTimeout(tabLpTimer); });
    });
    btn.addEventListener('click', function () {
      // The long-press already acted — swallow THIS tab's trailing
      // click only (a fast tap on a different tab still counts).
      if (key === tabLpFiredKey && Date.now() - tabLpFiredAt < 700) return;
      // All tapped while All is already selected toggles the folder
      // jump list (v33); from any other folder, All just selects.
      if (key === null && categoryFilter === null) { toggleFolderJump(); return; }
      selectCategory(key, {});
    });
  }
  function selectCategory(key, opts) {
    opts = opts || {};
    closeFolderJump();   // any selection change dismisses the jump list
    var prevIdx = tabKeysCache.indexOf(categoryFilter);
    var changed = key !== categoryFilter;
    categoryFilter = key;
    renderHome();
    if (changed) {
      var newIdx = tabKeysCache.indexOf(key);
      var dir = opts.dir || (prevIdx !== -1 && newIdx !== -1 ? Math.sign(newIdx - prevIdx) : 0);
      animateGrid(dir);
    }
    if (!opts.noCenter) centerActiveTab(true);
  }
  /* ---------- Folder jump list (v33) ----------
   * Tapping All while All is already selected drops a panel from
   * under the tab strip listing every folder as a row — mini
   * frosted red-glass folder icon, name, live item count — so a
   * folder can be picked without scrolling the strip. Rows mirror
   * the tab set minus All itself (Uncategorized last, same rule as
   * the strip) and counts are read fresh from folderStats every
   * time the list opens. A row tap rides the normal selection
   * path, which closes the list and centers the tab. The list
   * also closes on: All tapped again, the scrim, a view switch,
   * a search starting, or any sheet/menu opening (the document
   * pointerdown guard below + the explicit closes in showView /
   * openItem / openFolderSheet / openQtyEditor / the dock +). */
  function renderFolderJump() {
    var counts = {};
    D.folderStats().forEach(function (s) { counts[s.name] = s.count; });
    $('folderJumpList').innerHTML = tabKeys().slice(1).map(function (name) {
      var sel = name === categoryFilter;
      return '<button type="button" class="fj-row' + (sel ? ' sel' : '') + '" role="option" aria-selected="' + (sel ? 'true' : 'false') + '" data-fj="' + esc(name) + '">' +
        '<span class="fj-icon" aria-hidden="true"></span>' +
        '<span class="fj-name">' + esc(name) + '</span>' +
        '<span class="fj-count">' + (counts[name] || 0) + '</span></button>';
    }).join('');
    $('folderJumpList').querySelectorAll('[data-fj]').forEach(function (btn) {
      btn.addEventListener('click', function () { selectCategory(btn.getAttribute('data-fj'), {}); });
    });
  }
  function openFolderJump() {
    if (jumpListOpen) return;
    renderFolderJump();   // rows + counts are live at open time
    jumpListOpen = true;
    $('folderJump').classList.remove('hidden');
    $('folderJumpScrim').classList.remove('hidden');
    renderFolderTabs();   // flips the All tab's chevron / expanded state
  }
  function closeFolderJump() {
    if (!jumpListOpen) return;
    jumpListOpen = false;
    $('folderJump').classList.add('hidden');
    $('folderJumpScrim').classList.add('hidden');
    renderFolderTabs();
  }
  function toggleFolderJump() { if (jumpListOpen) closeFolderJump(); else openFolderJump(); }
  $('folderJumpScrim').addEventListener('click', closeFolderJump);
  /* Any press outside the strip/panel dismisses the list — this is
   * what closes it when another control goes on to open a sheet or
   * menu. Presses on the tabs or inside the panel itself are the
   * list's own business and leave it alone. */
  document.addEventListener('pointerdown', function (e) {
    if (!jumpListOpen) return;
    if (e.target && e.target.closest && e.target.closest('.folder-strip')) return;
    if (e.target && e.target.closest && e.target.closest('.tab[data-view="home"]')) return;  // v37: the dock Home press is the list's own toggle (click handler above), not an outside press
    closeFolderJump();
  }, true);
  /* The grid slides a touch in the direction of travel (transform /
   * opacity only, ~160ms; the reduced-motion block in styles.css
   * turns it off). */
  function animateGrid(dir) {
    if (!dir) return;
    var g = $('photoGrid');
    g.classList.remove('gx-next', 'gx-prev');
    void g.offsetWidth;
    g.classList.add(dir > 0 ? 'gx-next' : 'gx-prev');
  }
  function activeTabEl() {
    var strip = $('folderTabs');
    if (!strip) return null;
    var idx = tabKeysCache.indexOf(categoryFilter);
    return idx === -1 ? null : strip.querySelector('[data-tk="' + idx + '"]');
  }
  /* Smooth-scroll the selected tab to the strip's center. While the
   * animation runs, stripProgUntil guards the settle-select below:
   * our own scrolling must never read as a user scroll. */
  function centerActiveTab(smooth) {
    var strip = $('folderTabs');
    var el = activeTabEl();
    if (!strip || !el) return;
    var sr = strip.getBoundingClientRect(), er = el.getBoundingClientRect();
    var delta = (er.left + er.width / 2) - (sr.left + sr.width / 2);
    if (Math.abs(delta) < 2) return;
    stripProgUntil = Date.now() + (smooth ? 500 : 150);
    try { strip.scrollTo({ left: strip.scrollLeft + delta, behavior: smooth ? 'smooth' : 'auto' }); }
    catch (e) { strip.scrollLeft = strip.scrollLeft + delta; }
  }
  /* Select-on-settle: a USER scroll of the strip (touch or wheel)
   * that settles selects the tab nearest the strip center. No
   * re-centering afterwards — the tab is already at the center, and
   * centering again would fight the user's scroll. */
  function initFolderStripScroll() {
    var strip = $('folderTabs');
    if (!strip) return;
    strip.addEventListener('scroll', function () {
      if (Date.now() < stripProgUntil) return;   // programmatic centering — ignore
      clearTimeout(stripSettleTimer);
      stripSettleTimer = setTimeout(settleSelectTab, 120);
    }, { passive: true });
  }
  function settleSelectTab() {
    if (editingOpen() || jumpListOpen) return;
    var strip = $('folderTabs');
    if (!strip) return;
    var sr = strip.getBoundingClientRect();
    var center = sr.left + sr.width / 2;
    var best = null, bestDist = Infinity;
    strip.querySelectorAll('[data-tk]').forEach(function (el) {
      var r = el.getBoundingClientRect();
      var d = Math.abs((r.left + r.width / 2) - center);
      if (d < bestDist) { bestDist = d; best = el; }
    });
    if (!best) return;
    var key = tabKeysCache[parseInt(best.getAttribute('data-tk'), 10)];
    if (key !== undefined && key !== categoryFilter) selectCategory(key, { noCenter: true });
  }
  function stepCategory(dir) {
    var keys = tabKeysCache.length ? tabKeysCache : tabKeys();
    var idx = keys.indexOf(categoryFilter);
    if (idx === -1) idx = 0;
    selectCategory(keys[(idx + dir + keys.length) % keys.length], { dir: dir });
  }
  /* Carousel swipe over the grid: direction-locked (a mostly-vertical
   * gesture is a scroll, never a folder step), ~56px threshold,
   * wrap-around via stepCategory. Detection happens at touchend so
   * vertical scrolling is never blocked; a claimed swipe swallows
   * the tap the browser fires as the finger lifts, so it can't also
   * open a card or press a stepper. Touches starting in the sticky
   * header (search panel / tab strip / stats) or on the dock and
   * its create menu belong to those controls, and swipes are
   * ignored while any sheet is open. */
  var swipeStart = null;
  var suppressClickAt = 0;
  document.addEventListener('click', function (e) {
    if (suppressClickAt && Date.now() - suppressClickAt < 400) {
      suppressClickAt = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
  $('view-home').addEventListener('touchstart', function (e) {
    swipeStart = null;
    if (jumpListOpen) return;   // the jump list's scrim owns touches while it is open
    if (e.touches.length !== 1 || !e.target || !e.target.closest) return;
    if (e.target.closest('.sticky-head') || e.target.closest('.tabbar') || e.target.closest('.add-menu')) return;
    var t = e.touches[0];
    swipeStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });
  $('view-home').addEventListener('touchend', function (e) {
    if (!swipeStart) return;
    var s = swipeStart; swipeStart = null;
    if (editingOpen() || jumpListOpen) return;
    var t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    var dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) < 56 || Math.abs(dx) <= Math.abs(dy) * 1.4) return;
    suppressClickAt = Date.now();
    stepCategory(dx < 0 ? 1 : -1);
  }, { passive: true });
  /* New folder: ETData creates it with a placeholder name and the
   * folder sheet opens on it straight away for the rename. Runs from
   * the dock + create menu; folders live on Home, so land there
   * first if the menu was opened from another view. */
  function newFolderFlow() {
    closeAddMenu();
    if (!$('view-home').classList.contains('active')) showView('home');
    var cat = D.addCategory();
    categoryFilter = null;
    lowFilter = false;
    $('searchInput').value = '';
    renderHome();
    centerActiveTab(false);
    openFolderSheet(cat.name);
    toast('New folder — rename it now');
  }
  /* ---------- Folder sheet: rename / remove one folder ----------
   * Long-press a folder tab to open it. Rename rides ETData's
   * renameCategory cascade (items follow, edit ops queue); when the
   * renamed folder is the selected tab, the selection follows the
   * new name. Remove goes through the shared confirm below. */
  var folderSheetName = null;
  function openFolderSheet(name) {
    if (!name || name === D.UNCAT) return;
    closeFolderJump();
    folderSheetName = name;
    var s = D.folderStats().filter(function (x) { return x.name === name; })[0];
    $('fsTitle').textContent = name;
    $('fsMeta').textContent = s ? (s.count + (s.count === 1 ? ' item' : ' items') + ' · ' + s.units + ' units') : '';
    $('fsNameInput').value = name;
    $('fsError').classList.add('hidden');
    $('folderSheetOverlay').classList.remove('hidden');
    var inp = $('fsNameInput');
    setTimeout(function () { try { inp.focus(); inp.select(); } catch (e) { /* focus is a bonus */ } }, 30);
  }
  function closeFolderSheet() { $('folderSheetOverlay').classList.add('hidden'); folderSheetName = null; }
  $('fsClose').addEventListener('click', closeFolderSheet);
  $('fsCancelBtn').addEventListener('click', closeFolderSheet);
  $('folderSheetOverlay').addEventListener('click', function (e) { if (e.target === $('folderSheetOverlay')) closeFolderSheet(); });
  $('fsNameInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); $('fsRenameBtn').click(); }
  });
  $('fsRenameBtn').addEventListener('click', function () {
    if (!folderSheetName) return;
    var oldName = folderSheetName;
    var newName = $('fsNameInput').value.trim();
    if (newName === oldName) { closeFolderSheet(); return; }
    var r = D.renameCategory(oldName, newName);
    if (!r.ok) {
      $('fsError').textContent = r.message || 'Could not rename folder';
      $('fsError').classList.remove('hidden');
      return;
    }
    if (categoryFilter === oldName) categoryFilter = newName;   // the selected tab follows its folder
    closeFolderSheet();
    renderHome();
    centerActiveTab(false);
    toast('Folder renamed' + (r.count ? ' — ' + r.count + ' item(s) updated' : ''));
  });
  $('fsRemoveBtn').addEventListener('click', function () {
    if (!folderSheetName) return;
    var name = folderSheetName;
    closeFolderSheet();
    askRemoveFolder(name);
  });
  /* Remove: empty folders go instantly; folders with items ask first —
   * items move to Uncategorized, they are never deleted. */
  function askRemoveFolder(name) {
    var s = D.folderStats().filter(function (x) { return x.name === name; })[0];
    var count = s ? s.count : 0;
    if (!count) {
      D.removeCategory(name);
      if (categoryFilter === name) categoryFilter = null;   // a removed tab can't stay selected
      toast('Folder removed');
      renderHome();
      centerActiveTab(false);
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
    if (categoryFilter === name) categoryFilter = null;   // a removed tab can't stay selected
    toast('Folder removed — ' + (r.moved || 0) + ' item(s) moved to Uncategorized');
    renderHome();
    centerActiveTab(false);
  });

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
  /* Auto-sort and Sort Mode are launched from their Settings
   * cards (v39) — see renderSortCounts / the Settings wiring near
   * renderSync. Their old Home-banner buttons are gone. */

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

  /* ---------- Dock + : the one create control (v32) ----------
   * A round frosted red-glass medallion in the dock (the old
   * floating button's look, dock-scaled). It is the app's single
   * add control: tapping it opens the create menu — New Item /
   * New Folder — anchored above the dock center, and the +
   * rotates to a ✕ while the menu is open. */
  function closeAddMenu() {
    addMenuOpen = false;
    var m = $('addMenu'), s = $('addScrim'), b = $('dockAddBtn');
    if (m) m.classList.add('hidden');
    if (s) s.classList.add('hidden');
    if (b) { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); }
  }
  $('dockAddBtn').addEventListener('click', function () {
    closeFolderJump();
    if (addMenuOpen) { closeAddMenu(); return; }
    addMenuOpen = true;
    $('addMenu').classList.remove('hidden');
    $('addScrim').classList.remove('hidden');
    $('dockAddBtn').classList.add('open');
    $('dockAddBtn').setAttribute('aria-expanded', 'true');
  });
  $('addScrim').addEventListener('click', closeAddMenu);
  $('addNewFolder').addEventListener('click', function () { newFolderFlow(); });
  $('addNewItem').addEventListener('click', function () {
    closeAddMenu();
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
    if (categoryFilter && names.indexOf(categoryFilter) !== -1) sel.value = categoryFilter;
    else if (names.indexOf(prev) !== -1) sel.value = prev;
    else sel.value = names[0];
  }

  $('searchInput').addEventListener('input', function () {
    if (this.value.trim()) closeFolderJump();   // starting a search closes the jump list
    renderHome();
  });
  /* Stat bar tap-to-filter: LOW toggles the low-only view; Items/Units clear it. */
  $('statSegLow').addEventListener('click', function () { lowFilter = !lowFilter; renderHome(); });
  $('statSegItems').addEventListener('click', function () { if (lowFilter) { lowFilter = false; renderHome(); } });
  $('statSegUnits').addEventListener('click', function () { if (lowFilter) { lowFilter = false; renderHome(); } });

  /* ---------- #02 NFC Tap-to-Open Item Card ---------- */
  function openItem(id, viaNfc) {
    var item = D.getItem(id);
    if (!item) { toast('Item not found: ' + id); return; }
    closeFolderJump();
    closePhotoEditor();
    folderRailOpen = false;   // the folder picker starts collapsed for every item
    currentItemId = id;
    $('dIcon').innerHTML = iconPlate(item);
    $('dName').textContent = item.name;
    $('dMeta').textContent = item.sku + ' · ' + item.supplier;
    $('dBinChip').textContent = locShort(item);
    $('dBinChip').setAttribute('aria-label', locLong(item) + ' — see everything at this location');
    renderPartLookup(item);
    renderFolderRail(item);
    renderOrphanNotice();
    $('dCost').textContent = money(item.cost) + ' each';
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
  function closeItem() { $('itemOverlay').classList.add('hidden'); currentItemId = null; renderHome({ preserveOrder: true }); }
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

  /* Copy a string that is never rendered anywhere: sticker URLs are
   * plumbing, not content — the sheets show Copy buttons, never the
   * raw link itself. */
  function copyString(str, msg) {
    if (!str) { toast('Nothing to copy yet'); return; }
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(str).then(done, function () { copyFallback(str, done); });
    } else copyFallback(str, done);
  }
  function copyFallback(str, done) {
    var ta = document.createElement('textarea');
    ta.value = str;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { toast('Copy failed — try again'); }
    ta.remove();
  }
  $('dCopyBtn').addEventListener('click', function () {
    if (currentItemId) copyString(D.stickerUrl(currentItemId), 'Link copied');
  });
  /* Folder picker in the item sheet (Sorting Kit rail, v38
   * collapsible): a single row shows the item's current folder;
   * tapping it expands the rail of folder chips (one per folder
   * plus Uncategorized, the current folder filled with the accent)
   * inline. Tapping a chip files the item there on the spot via
   * ETData.setCategory and collapses the picker back to the row,
   * now showing the new folder. Opening an item always starts
   * collapsed (openItem resets folderRailOpen). */
  var folderRailOpen = false;
  function syncFolderRailChrome() {
    $('dFolderRail').classList.toggle('hidden', !folderRailOpen);
    var row = $('dFolderRow');
    row.classList.toggle('open', folderRailOpen);
    row.setAttribute('aria-expanded', folderRailOpen ? 'true' : 'false');
  }
  $('dFolderRow').addEventListener('click', function () {
    folderRailOpen = !folderRailOpen;
    syncFolderRailChrome();
  });
  function renderFolderRail(item) {
    if (!item) return;
    var cur = itemCategory(item);
    $('dFolderName').textContent = cur;
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
        folderRailOpen = false;   // choosing (even the current folder) collapses the picker
        if (!it) { syncFolderRailChrome(); return; }
        if (itemCategory(it) === name) { renderFolderRail(it); return; }
        D.setCategory(currentItemId, name);
        renderFolderRail(D.getItem(currentItemId));
        refreshChrome();
        toast('Filed in ' + name);
      });
    });
    syncFolderRailChrome();
  }

  /* ---------- NFC Live: always-on listening while the app is open ----------
   * Android Chrome (Web NFC): a single NDEFReader.scan() keeps firing
   * `reading` events for every tag presented while the page is visible, so
   * listening can stay on for a whole warehouse session. Chrome requires a
   * user gesture for the first scan, so the NFC tools sheet's Start button
   * (or any first touch, once armed) starts it, and the saved preference
   * ('et-nfc-live') re-arms it on the first touch after the app is
   * reopened. There is deliberately NO header button: the tools sheet is
   * reached from the item and Shelf sheets. iOS Safari has no Web NFC at
   * all — stickers keep working there because iOS opens their URLs. */
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
  /* A shelf sticker's URL carries ?shelf=<location> instead of an
   * item id; pull it out of any URL/text record on the tag. */
  function nfcShelfFromEvent(ev) {
    var records = (ev && ev.message && ev.message.records) || [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec.data || (rec.recordType !== 'url' && rec.recordType !== 'text')) continue;
      try {
        var text = new TextDecoder().decode(rec.data);
        var m = text.match(/[?&]shelf=([^&#\s]+)/);
        if (m) return decodeURIComponent(m[1]);
      } catch (e) { /* ignore undecodable record */ }
    }
    return null;
  }
  function handleShelfTag(loc) {
    var key = 'shelf:' + loc;
    var now = Date.now();
    if (key === nfcLastKey && now - nfcLastAt < 3000) return 'debounced';
    nfcLastKey = key; nfcLastAt = now;
    if (currentShelf === loc && !$('shelfOverlay').classList.contains('hidden')) return 'open';
    if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* unsupported */ } }
    openShelf(loc);
    toast('NFC · ' + loc);
    return 'opened';
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
  /* NFC state has no visible home of its own anymore (the header pill
   * is gone); the only surface is the NFC tools sheet, refreshed here. */
  function renderNfcUi() { renderNfcSheet(); }
  /* ---------- NFC tools sheet (reached from item / shelf sheets) ----------
   * Scan state + the sticker-writing guidance live here and nowhere
   * else in the UI — no dock tab, no Settings card, no header button.
   * On Android Chrome the sheet's button starts/stops NFC Live (the tap
   * is the user gesture Chrome requires); on iPhone it shows the honest
   * notes instead — iOS opens sticker URLs itself. */
  function renderNfcSheet() {
    var state = $('nfcStateText');
    if (!state) return;
    $('nfcToggleBtn').classList.toggle('hidden', !NFC_SUPPORTED);
    $('nfcIosNote').classList.toggle('hidden', NFC_SUPPORTED);
    $('nfcWriteNote').classList.toggle('hidden', !NFC_SUPPORTED);
    $('nfcIosWriteNote').classList.toggle('hidden', NFC_SUPPORTED);
    if (!NFC_SUPPORTED) {
      state.textContent = 'Stickers work on this phone — tapping one opens its item or shelf.';
      return;
    }
    if (nfcLiveActive) state.textContent = 'NFC Live is ON — hold any sticker near the phone and its item or shelf opens.';
    else if (nfcLivePaused) state.textContent = 'NFC Live is paused — tap Start listening to resume (Chrome needs a tap to allow scanning).';
    else if (nfcLiveWanted) state.textContent = 'NFC Live is on but not scanning yet — tap Start listening.';
    else state.textContent = 'NFC Live is off — turn it on and every sticker tap opens its item or shelf while the app is open.';
    $('nfcToggleBtn').textContent = (nfcLiveWanted && nfcLiveActive) ? 'Stop listening' : 'Start listening';
  }
  function openNfcSheet() { renderNfcSheet(); $('nfcOverlay').classList.remove('hidden'); }
  function closeNfcSheet() { $('nfcOverlay').classList.add('hidden'); }
  $('closeNfc').addEventListener('click', closeNfcSheet);
  $('nfcDoneBtn').addEventListener('click', closeNfcSheet);
  $('nfcOverlay').addEventListener('click', function (e) { if (e.target === $('nfcOverlay')) closeNfcSheet(); });
  $('nfcToggleBtn').addEventListener('click', function () {
    if (!NFC_SUPPORTED) return;
    if (nfcLiveWanted && nfcLiveActive) { stopNfcLive(); toast('NFC Live off'); }
    else startNfcLive();   // this tap is the user gesture Chrome requires
    renderNfcSheet();
  });
  /* The doors to the tools sheet: a compact button on the item sheet
   * and on the Shelf view, next to their sticker rows. The sheet
   * stacks above both (see #nfcOverlay in styles.css). */
  $('dNfcToolsBtn').addEventListener('click', function () { openNfcSheet(); });
  $('shNfcToolsBtn').addEventListener('click', function () { openNfcSheet(); });
  function startNfcLive() {
    if (!NFC_SUPPORTED) return Promise.resolve(false);
    nfcLiveWanted = true;
    try { localStorage.setItem('et-nfc-live', '1'); } catch (e) { /* storage blocked */ }
    if (nfcLiveActive) { nfcLivePaused = false; renderNfcUi(); return Promise.resolve(true); }
    if (!nfcReader) {
      nfcReader = new NDEFReader();
      nfcReader.addEventListener('reading', function (ev) {
        if (!nfcLiveWanted) return;   // stopped logically — Web NFC has no stop API of its own
        var shelf = nfcShelfFromEvent(ev);
        if (shelf) { handleShelfTag(shelf); return; }
        handleTag(nfcCandidateIds(ev), ev.serialNumber);
      });
      nfcReader.addEventListener('readingerror', function () {
        if (nfcLiveWanted) toast('Could not read that tag — try again');
      });
    }
    nfcAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var scanPromise = nfcAbort ? nfcReader.scan({ signal: nfcAbort.signal }) : nfcReader.scan();
    return scanPromise.then(function () {
      nfcLiveActive = true; nfcLivePaused = false; renderNfcUi(); updateWakeLock();
      return true;
    }).catch(function () {
      // Most often NotAllowedError: no gesture yet / permission not granted.
      // State shows as paused; the tools sheet's button (or the next
      // touch, once armed) retries with a gesture behind it.
      nfcLiveActive = false; nfcLivePaused = true; renderNfcUi();
      return false;
    });
  }
  function stopNfcLive() {
    nfcLiveWanted = false; nfcLiveActive = false; nfcLivePaused = false;
    try { localStorage.setItem('et-nfc-live', '0'); } catch (e) { /* storage blocked */ }
    if (nfcAbort) { try { nfcAbort.abort(); } catch (e) { /* already settled */ } nfcAbort = null; }
    renderNfcUi(); updateWakeLock();
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
  document.addEventListener('visibilitychange', function () {
    if (!NFC_SUPPORTED || !nfcLiveWanted) return;
    if (document.hidden) {
      // Readings stop while hidden; end the session so resume is clean.
      if (nfcAbort) { try { nfcAbort.abort(); } catch (e) { /* settled */ } nfcAbort = null; }
      nfcLiveActive = false; nfcLivePaused = true; renderNfcUi(); updateWakeLock();
    } else {
      // Try an immediate restart; if Chrome refuses without a gesture,
      // the next touch anywhere re-arms it.
      startNfcLive().then(function (ok) { if (!ok) armNfcOnFirstTouch(); updateWakeLock(); });
    }
  });
  function initNfcLive() {
    renderNfcUi();
    if (NFC_SUPPORTED && nfcLiveWanted) {
      startNfcLive().then(function (ok) { if (!ok) armNfcOnFirstTouch(); });
    }
  }

  /* No Scan button in the item detail: NFC Live listens globally
   * while the app is open and opens items via handleTag(). */

  /* ---------- In-app sticker writing (Web NFC write) ----------
   * Android Chrome can WRITE tags too, not just read them: NDEFReader
   * .write() with a single URL record is how stickers get made — no
   * separate writer app. Web NFC allows one operation at a time, so a
   * running Live scan is paused first and resumed afterwards (the
   * write tap itself is the gesture Chrome needs for the restart).
   * Result is structured — {ok:true} or {ok:false, reason}: */
  var nfcWriter = null;      // dedicated reader instance for writes
  var nfcWriteAbort = null;  // AbortController for the in-flight write
  var nfcWriteBusy = false;  // one write at a time
  function nfcWriteReason(err) {
    var name = (err && err.name) || '';
    if (name === 'AbortError') return 'cancelled';
    if (name === 'NotAllowedError') return 'not-allowed';
    if (name === 'NotSupportedError') return 'not-writable';
    if (name === 'NotReadableError') return 'not-writable';
    if (name === 'NetworkError') return 'tag-lost';
    return 'error';
  }
  function nfcWriteReasonText(reason) {
    if (reason === 'not-writable') return "That sticker isn't writable — NTAG213/216 stickers work.";
    if (reason === 'not-allowed') return "Chrome didn't allow the write — keep the app on screen and tap Write sticker again.";
    if (reason === 'tag-lost') return 'The sticker moved away mid-write — hold it steady against the back of the phone and try again.';
    if (reason === 'busy') return 'Another sticker write is still finishing — give it a second.';
    if (reason === 'unsupported') return "This device's browser can't write NFC stickers.";
    return 'Write failed — hold a blank NTAG sticker to the back of the phone and try again.';
  }
  function nfcWriteUrl(url) {
    if (!NFC_SUPPORTED) return Promise.resolve({ ok: false, reason: 'unsupported' });
    if (nfcWriteBusy) return Promise.resolve({ ok: false, reason: 'busy' });
    nfcWriteBusy = true;
    var resumeScan = nfcLiveActive;
    if (resumeScan) {
      if (nfcAbort) { try { nfcAbort.abort(); } catch (e) { /* settled */ } nfcAbort = null; }
      nfcLiveActive = false; nfcLivePaused = nfcLiveWanted; renderNfcUi();
    }
    if (!nfcWriter) nfcWriter = new NDEFReader();
    nfcWriteAbort = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var settled = function (res) {
      nfcWriteBusy = false; nfcWriteAbort = null;
      if (resumeScan && nfcLiveWanted) startNfcLive();
      return res;
    };
    var writePromise;
    try {
      writePromise = nfcWriteAbort
        ? nfcWriter.write({ records: [{ recordType: 'url', data: url }] }, { signal: nfcWriteAbort.signal })
        : nfcWriter.write({ records: [{ recordType: 'url', data: url }] });
    } catch (e) {
      return Promise.resolve(settled({ ok: false, reason: nfcWriteReason(e) }));
    }
    return writePromise.then(
      function () { return settled({ ok: true }); },
      function (err) { return settled({ ok: false, reason: nfcWriteReason(err) }); }
    );
  }
  function cancelNfcWrite() {
    if (nfcWriteAbort) { try { nfcWriteAbort.abort(); } catch (e) { /* settled */ } }
  }
  /* One wiring for all three Write sticker buttons (item sheet, Shelf
   * view, Quick Add success): shows the hold-the-sticker status with a
   * Cancel while the write waits for a tag, then reports the outcome.
   * The button exists only where writing is possible (Web NFC). */
  function attachStickerWriter(getUrl, writeBtn, statusEl, statusTextEl, cancelBtn) {
    if (!writeBtn) return;
    writeBtn.classList.toggle('hidden', !NFC_SUPPORTED);
    var session = 0;
    function setWaiting(on) {
      if (statusEl) statusEl.classList.toggle('hidden', !on);
      writeBtn.disabled = !!on;
      if (on && statusTextEl) statusTextEl.textContent = 'Hold a blank sticker to the back of the phone…';
    }
    writeBtn.addEventListener('click', function () {
      var mine = ++session;
      setWaiting(true);
      nfcWriteUrl(getUrl()).then(function (res) {
        if (mine !== session) return;   // user cancelled — stay quiet
        setWaiting(false);
        if (res.ok) {
          if (navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* unsupported */ } }
          toast('Sticker written — hold the phone to it to test');
        } else if (res.reason !== 'cancelled') {
          toast(nfcWriteReasonText(res.reason));
        }
      });
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      session++;             // suppress the pending write's outcome
      setWaiting(false);
      cancelNfcWrite();      // scan resume happens when the write settles
    });
  }
  attachStickerWriter(
    function () { return currentItemId ? D.stickerUrl(currentItemId) : ''; },
    $('dWriteBtn'), $('dWriteStatus'), $('dWriteStatusText'), $('dWriteCancel'));
  attachStickerWriter(
    function () { return currentShelf !== null ? D.shelfUrl(currentShelf) : ''; },
    $('shWriteBtn'), $('shWriteStatus'), $('shWriteStatusText'), $('shWriteCancel'));
  attachStickerWriter(
    function () { return lastAddUrl; },
    $('addWriteNfcBtn'), $('addWriteStatus'), $('addWriteStatusText'), $('addWriteCancel'));

  /* Sticker taps: ?item=<id> opens that item, ?shelf=<location>
   * opens the Shelf view — both directly on load. In Sheet mode the
   * rows may still be in flight on a cold load, so an item link that
   * doesn't resolve yet is retried once the import lands (the init
   * refresh calls openFromUrl again); a handled link never re-fires. */
  var urlOpenedFor = '';
  function openFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('item');
    var shelf = params.get('shelf');
    var key = id ? 'item:' + id : (shelf ? 'shelf:' + shelf : '');
    if (!key || key === urlOpenedFor) return;
    if (id) {
      if (D.getItem(id)) { urlOpenedFor = key; openItem(id); }
    } else if (shelf) {
      urlOpenedFor = key;
      openShelf(shelf);
    }
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
    renderShelfList();
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

  /* ---------- Shelf View: everything at one free-text location ----------
   * A shelf sticker carries ?shelf=<location> and lands here; the same
   * view opens from an item's location chip and from the Map tab's
   * Shelves list. Matching is the EXACT location string (item.bin) —
   * 'Shelf 58 Kit_5' is its own shelf, distinct from 'Shelf 58'. Rows
   * follow the supplier drill-in pattern: tap opens the item sheet,
   * steppers go through the shared changeQty path. */
  function itemsAtLocation(loc) {
    return D.getItems().filter(function (i) { return String(i.bin || '') === loc; });
  }
  function openShelf(loc) {
    currentShelf = String(loc == null ? '' : loc);
    renderShelf();
    $('shelfOverlay').classList.remove('hidden');
  }
  function closeShelf() { $('shelfOverlay').classList.add('hidden'); currentShelf = null; }
  var shelfOrder = null;   // pinned Shelf-view order (v34), same rule as the grid's
  function renderShelf(opts) {
    if (currentShelf === null) return;
    var list = itemsAtLocation(currentShelf);
    /* The Shelf view's item list carries the same quantity order as
     * the grid (v34); a qty change made inside the shelf re-renders
     * with the pinned order so rows stay put while stepping. */
    if (opts && opts.preserveOrder) list = applyPinnedOrder(list, shelfOrder);
    else { list = list.slice().sort(byQtyDesc); shelfOrder = list.map(function (i) { return i.id; }); }
    var units = list.reduce(function (s, i) { return s + i.qty; }, 0);
    $('shTitle').textContent = currentShelf;
    $('shMeta').textContent = list.length + (list.length === 1 ? ' item' : ' items') + ' · ' + units + ' units';
    $('shelfItemsEmpty').classList.toggle('hidden', list.length > 0);
    $('shelfItems').innerHTML = list.map(function (i) {
      return '<div class="list-item row-item"><span class="li-icon">' + iconPlate(i) + '</span>' +
        '<button type="button" class="li-main row-open" data-shopen="' + esc(i.id) + '"><span class="li-name">' + esc(i.name) + '</span><br>' +
        '<span class="li-sub">' + esc(i.sku) + ' · ' + esc(i.supplier) + '</span></button>' +
        '<span class="qty-pill ' + qtyClass(i.qty) + '">' + qtyLabel(i.qty) + '</span>' +
        '<span class="row-stepper">' +
          '<button type="button" data-shdec="' + esc(i.id) + '" aria-label="Remove one from ' + esc(i.name) + '">−</button>' +
          '<button type="button" class="row-qty-btn" data-sh-qty-btn="' + esc(i.id) + '" aria-label="Quantity ' + i.qty + ' for ' + esc(i.name) + ' — tap to type a new quantity">' + i.qty + '</button>' +
          '<button type="button" data-shinc="' + esc(i.id) + '" aria-label="Add one to ' + esc(i.name) + '">+</button>' +
        '</span></div>';
    }).join('');
    var box = $('shelfItems');
    box.querySelectorAll('[data-shopen]').forEach(function (el) {
      el.addEventListener('click', function () { var id = el.getAttribute('data-shopen'); closeShelf(); openItem(id); });
    });
    box.querySelectorAll('[data-shdec]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-shdec'), -1); });
    });
    box.querySelectorAll('[data-shinc]').forEach(function (b) {
      b.addEventListener('click', function () { changeQty(b.getAttribute('data-shinc'), 1); });
    });
    box.querySelectorAll('[data-sh-qty-btn]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-sh-qty-btn');
        var item = D.getItem(id);
        if (!item) return;
        openQtyEditor({
          value: item.qty, itemName: item.name,
          returnAttr: 'data-sh-qty-btn', returnValue: id,
          onCommit: function (qty) { setQtyWithUndo(id, qty); }
        });
      });
    });
  }
  $('closeShelf').addEventListener('click', closeShelf);
  $('shelfOverlay').addEventListener('click', function (e) { if (e.target === $('shelfOverlay')) closeShelf(); });
  $('shCopyBtn').addEventListener('click', function () {
    if (currentShelf !== null) copyString(D.shelfUrl(currentShelf), 'Link copied');
  });
  /* The item sheet's location chip is the third door into a location:
   * coded bins (A1–D6) open their bin sheet on the map; free-text
   * locations open the Shelf view. */
  $('dBinChip').addEventListener('click', function () {
    if (!currentItemId) return;
    var item = D.getItem(currentItemId);
    if (!item) return;
    var bin = String(item.bin || '');
    if (BIN_PATTERN.test(bin)) {
      var lv = levelOf(item);
      closeItem();
      showView('map');
      openBinSheet(bin, lv);
    } else if (bin) {
      closeItem();
      openShelf(bin);
    }
  });
  /* Map tab, below the elevation: every distinct free-text location
   * with its counts. Pattern bins stay in the elevation only. */
  function renderShelfList() {
    var byLoc = {}, order = [];
    D.getItems().forEach(function (i) {
      var bin = String(i.bin || '');
      if (!bin || BIN_PATTERN.test(bin)) return;
      if (!byLoc[bin]) { byLoc[bin] = { loc: bin, items: 0, units: 0 }; order.push(byLoc[bin]); }
      byLoc[bin].items++; byLoc[bin].units += Number(i.qty) || 0;
    });
    order.sort(function (a, b) { return a.loc < b.loc ? -1 : (a.loc > b.loc ? 1 : 0); });
    $('shelfListEmpty').classList.toggle('hidden', order.length > 0);
    $('shelfList').innerHTML = order.map(function (s) {
      var counts = s.items + (s.items === 1 ? ' item' : ' items') + ' · ' + s.units + ' units';
      return '<button type="button" class="list-item supplier-row" data-shelf="' + esc(s.loc) + '" aria-label="Open shelf ' + esc(s.loc) + ', ' + counts + '">' +
        '<span class="li-icon">' + svgIcon('map') + '</span>' +
        '<span class="li-main"><span class="li-name">' + esc(s.loc) + '</span></span>' +
        '<span class="sup-counts">' + counts + '</span><span class="air-chev" aria-hidden="true">›</span></button>';
    }).join('');
    $('shelfList').querySelectorAll('[data-shelf]').forEach(function (row) {
      row.addEventListener('click', function () { openShelf(row.getAttribute('data-shelf')); });
    });
  }

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
    $('supplierOrganizeBtn').classList.toggle('hidden', !!selectedSupplier);
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

  /* ---------- Supplier Organize: merge / rename / clear ----------
   * One overlay over the hub. Top: ETData's suggested merge groups
   * (case/punctuation twins, vendor+junk-suffix roots, word-prefix
   * folds) — each confirmed individually, never auto-applied. Below:
   * every raw supplier name with Rename (cascades to its items) and
   * Clear (for strings that aren't vendors at all), plus checkbox
   * multi-select → pick a canonical name → merge. Every mutation
   * snapshots first; the UNDO toast restores items + the explicit
   * list exactly. */
  var orgSuggestions = [];
  var orgChecked = {};        // raw supplier name -> true
  var orgPickNames = null;    // names in the open canonical picker
  var orgRenameName = null;
  var orgClearName = null;
  function orgAfterMutation(msg, res) {
    renderSuppliers();
    refreshSupplierList();
    refreshChrome();
    renderOrganize();
    if (res && res.undo) {
      showUndoToast(msg, function () {
        D.restoreSuppliers(res.undo);
        orgChecked = {};
        renderSuppliers();
        refreshSupplierList();
        refreshChrome();
        renderOrganize();
      });
    } else {
      toast(msg);
    }
  }
  function openOrganize() {
    orgChecked = {};
    $('orgOverlay').classList.remove('hidden');
    renderOrganize();
  }
  function closeOrganize() { $('orgOverlay').classList.add('hidden'); orgChecked = {}; }
  function renderOrganize() {
    if ($('orgOverlay').classList.contains('hidden')) return;
    orgSuggestions = D.suggestSupplierMerges();
    $('orgSuggestEmpty').classList.toggle('hidden', orgSuggestions.length > 0);
    $('orgSuggest').innerHTML = orgSuggestions.map(function (g, gi) {
      var vars = g.variants.map(function (v) {
        return '<span class="org-variant">' + esc(v.name) + ' <span class="sup-counts">' + v.items + (v.items === 1 ? ' item' : ' items') + '</span>' + (v.explicit ? ' <span class="sup-tag">in list</span>' : '') + '</span>';
      }).join('');
      return '<div class="org-group"><div class="org-group-main">' +
        '<div class="org-group-title">Merge into <strong>' + esc(g.canonical) + '</strong></div>' +
        '<div class="org-variants">' + vars + '</div></div>' +
        '<button type="button" class="btn btn-primary org-merge-btn" data-org-apply="' + gi + '">Merge</button></div>';
    }).join('');
    $('orgSuggest').querySelectorAll('[data-org-apply]').forEach(function (b) {
      b.addEventListener('click', function () {
        var g = orgSuggestions[parseInt(b.getAttribute('data-org-apply'), 10)];
        if (!g) return;
        var res = D.mergeSuppliers(g.variants.map(function (v) { return v.name; }), g.canonical);
        if (!res.ok) { toast(res.message || 'Could not merge'); return; }
        orgAfterMutation('Merged into ' + g.canonical + ' — ' + res.count + ' item(s) updated', res);
      });
    });
    var names = D.getSupplierNames();
    // Drop checks for names that no longer exist after a mutation.
    Object.keys(orgChecked).forEach(function (n) {
      if (!names.some(function (s) { return s.name === n; })) delete orgChecked[n];
    });
    $('orgList').innerHTML = names.map(function (s) {
      var counts = s.items + (s.items === 1 ? ' item' : ' items') + ' · ' + s.units + ' units';
      return '<div class="list-item org-row">' +
        '<label class="org-check"><input type="checkbox" data-org-check="' + esc(s.name) + '"' + (orgChecked[s.name] ? ' checked' : '') + ' aria-label="Select ' + esc(s.name) + ' for merging"></label>' +
        '<span class="li-main"><span class="li-name">' + esc(s.name) + '</span>' +
        (s.explicit ? '' : ' <span class="sup-tag">from items</span>') +
        '<br><span class="li-sub">' + counts + (s.blurb ? ' · ' + esc(s.blurb) : '') + '</span></span>' +
        '<button type="button" class="btn org-act" data-org-rename="' + esc(s.name) + '">Rename</button>' +
        '<button type="button" class="btn org-act" data-org-clear="' + esc(s.name) + '">Clear</button></div>';
    }).join('');
    var list = $('orgList');
    list.querySelectorAll('[data-org-check]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var n = cb.getAttribute('data-org-check');
        if (cb.checked) orgChecked[n] = true; else delete orgChecked[n];
        updateOrgSelBar();
      });
    });
    list.querySelectorAll('[data-org-rename]').forEach(function (b) {
      b.addEventListener('click', function () { openSupplierRename(b.getAttribute('data-org-rename')); });
    });
    list.querySelectorAll('[data-org-clear]').forEach(function (b) {
      b.addEventListener('click', function () { askClearSupplier(b.getAttribute('data-org-clear')); });
    });
    updateOrgSelBar();
  }
  function checkedOrgNames() { return Object.keys(orgChecked).filter(function (n) { return orgChecked[n]; }); }
  function updateOrgSelBar() {
    var n = checkedOrgNames().length;
    $('orgSelBar').classList.toggle('hidden', n < 2);
    $('orgSelCount').textContent = n + ' selected';
    $('orgMergeSelBtn').textContent = 'Merge ' + n + ' selected';
  }
  $('supplierOrganizeBtn').addEventListener('click', openOrganize);
  $('closeOrg').addEventListener('click', closeOrganize);
  $('orgOverlay').addEventListener('click', function (e) { if (e.target === $('orgOverlay')) closeOrganize(); });
  $('orgClearSelBtn').addEventListener('click', function () { orgChecked = {}; renderOrganize(); });
  /* Multi-select merge: choose which of the selected names everything
   * becomes. Default pick mirrors the suggestion engine: most items,
   * then a clean (junk-free) name, then the fuller name. */
  $('orgMergeSelBtn').addEventListener('click', function () {
    var names = checkedOrgNames();
    if (names.length < 2) return;
    var info = {};
    D.getSupplierNames().forEach(function (s) { info[s.name] = s; });
    var sorted = names.slice().sort(function (a, b) {
      var ia = info[a] || { items: 0 }, ib = info[b] || { items: 0 };
      if (ib.items !== ia.items) return ib.items - ia.items;
      var ca = D.supplierRoot(a) === a ? 0 : 1, cb2 = D.supplierRoot(b) === b ? 0 : 1;
      if (ca !== cb2) return ca - cb2;
      return b.length - a.length;
    });
    orgPickNames = names;
    $('orgPickList').innerHTML = sorted.map(function (n, i) {
      var s = info[n] || { items: 0 };
      return '<label class="org-pick-row"><input type="radio" name="orgPick" value="' + esc(n) + '"' + (i === 0 ? ' checked' : '') + '>' +
        '<span class="li-main"><span class="li-name">' + esc(n) + '</span><br><span class="li-sub">' + s.items + (s.items === 1 ? ' item' : ' items') + '</span></span></label>';
    }).join('');
    $('orgPickOverlay').classList.remove('hidden');
  });
  function closeOrgPick() { $('orgPickOverlay').classList.add('hidden'); orgPickNames = null; }
  $('orgPickCancel').addEventListener('click', closeOrgPick);
  $('orgPickOverlay').addEventListener('click', function (e) { if (e.target === $('orgPickOverlay')) closeOrgPick(); });
  $('orgPickApply').addEventListener('click', function () {
    if (!orgPickNames) return;
    var sel = $('orgPickList').querySelector('input[name="orgPick"]:checked');
    if (!sel) return;
    var canonical = sel.value;
    var names = orgPickNames;
    closeOrgPick();
    var res = D.mergeSuppliers(names, canonical);
    if (!res.ok) { toast(res.message || 'Could not merge'); return; }
    orgAfterMutation('Merged ' + names.length + ' suppliers into ' + canonical + ' — ' + res.count + ' item(s) updated', res);
  });
  /* Rename: one prompt sheet; the cascade + its edit ops are ETData's. */
  function openSupplierRename(name) {
    orgRenameName = name;
    $('supRenameInput').value = name;
    $('supRenameError').classList.add('hidden');
    $('supRenameOverlay').classList.remove('hidden');
    $('supRenameInput').focus();
    $('supRenameInput').select();
  }
  function closeSupplierRename() { $('supRenameOverlay').classList.add('hidden'); orgRenameName = null; }
  $('supRenameCancel').addEventListener('click', closeSupplierRename);
  $('supRenameOverlay').addEventListener('click', function (e) { if (e.target === $('supRenameOverlay')) closeSupplierRename(); });
  $('supRenameSave').addEventListener('click', function () {
    if (!orgRenameName) return;
    var res = D.renameSupplier(orgRenameName, $('supRenameInput').value);
    if (!res.ok) {
      $('supRenameError').textContent = res.message || 'Could not rename that supplier.';
      $('supRenameError').classList.remove('hidden');
      return;
    }
    var newName = $('supRenameInput').value.trim();
    closeSupplierRename();
    orgAfterMutation('Renamed to ' + newName + ' — ' + res.count + ' item(s) updated', res);
  });
  /* Clear: for strings that aren't vendors at all. Confirm first —
   * the items lose the name entirely (undo restores it). */
  function askClearSupplier(name) {
    orgClearName = name;
    var entry = D.getSupplierNames().filter(function (s) { return s.name === name; })[0];
    var n = entry ? entry.items : 0;
    $('supClearTitle').textContent = 'Clear “' + name + '”?';
    $('supClearText').textContent = 'This removes the supplier name from ' + n + (n === 1 ? ' item' : ' items') +
      ' — for names that aren\'t really a supplier. The items keep everything else, and you can undo right after.';
    $('supClearOverlay').classList.remove('hidden');
  }
  function closeClearSupplier() { $('supClearOverlay').classList.add('hidden'); orgClearName = null; }
  $('supClearCancel').addEventListener('click', closeClearSupplier);
  $('supClearOverlay').addEventListener('click', function (e) { if (e.target === $('supClearOverlay')) closeClearSupplier(); });
  $('supClearConfirm').addEventListener('click', function () {
    if (!orgClearName) return;
    var name = orgClearName;
    closeClearSupplier();
    var res = D.clearSupplier(name);
    if (!res.ok) { toast(res.message || 'Could not clear'); return; }
    orgAfterMutation('Cleared ' + name + ' — ' + res.count + ' item(s) updated', res);
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
    /* Applying a count is a batch of qty changes — the grid keeps
     * its pinned order (v34); the count walk itself runs off the
     * session snapshot and is never re-sorted either. */
    if ($('view-home').classList.contains('active')) renderHome({ preserveOrder: true });
    refreshChrome();
    if (changed.length) {
      showUndoToast('Count applied — ' + changed.length + ' item(s) updated', function () {
        changed.forEach(function (en) { D.setQty(en.id, prev[en.id]); });
        if ($('view-map').classList.contains('active')) renderMap();
        if ($('view-home').classList.contains('active')) renderHome({ preserveOrder: true });
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
  var lastAddUrl = '';          // sticker link of the just-added item (never displayed — Copy/Write use it directly)
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
  /* Item-sheet lookup: search the web for the item's EXACT part
   * number — the Web search wraps it in double quotes so results
   * match the number itself, not near-misses. Source is the SKU when
   * the item has one, else its name; with neither, the row hides. */
  function partLookupHrefs(part) {
    var enc = encodeURIComponent(part);
    return {
      web: 'https://www.google.com/search?q=' + encodeURIComponent('"' + part + '"'),
      images: 'https://www.google.com/search?tbm=isch&q=' + enc,
      amazon: 'https://www.amazon.com/s?k=' + enc
    };
  }
  /* The string the part-number searches look up: the SKU when the
   * item has one, else its name. Shared by the item sheet's lookup
   * row and the photo editor's "Find a different one". */
  function lookupPartFor(item) {
    return String((item && item.sku) || '').trim() || String((item && item.name) || '').trim();
  }
  function renderPartLookup(item) {
    var part = lookupPartFor(item);
    $('dLookup').classList.toggle('hidden', !part);
    if (!part) return;
    var hrefs = partLookupHrefs(part);
    $('dLkWeb').href = hrefs.web;
    $('dLkImages').href = hrefs.images;
    $('dLkAmazon').href = hrefs.amazon;
  }

  /* ---------- Item photo editor ----------
   * An item's photo comes from the backend's Image column. This
   * sheet (opened by the item sheet's Edit photo pill) swaps it:
   * "Find a different one" opens the SAME Google Images search the
   * part-number lookup builds (partLookupHrefs on lookupPartFor —
   * one builder, no fork), the user pastes a candidate's link, and
   * Save routes through ETData.setPhoto — one queued 'edit' op
   * carrying the Image field, live-synced like any other field
   * edit. The item sheet hero and the grid card update in place.
   * Remove clears back to the icon fallback. No device file
   * upload: a pasted link is the whole mechanism. A bad link just
   * degrades to the icon — plateImg's onerror already hides a
   * failed image everywhere it renders. */
  var photoEditId = null;
  function openPhotoEditor() {
    if (!currentItemId) return;
    var item = D.getItem(currentItemId);
    if (!item) return;
    photoEditId = item.id;
    $('peUrl').value = item.photo || '';
    $('peError').classList.add('hidden');
    var part = lookupPartFor(item);
    $('peFind').classList.toggle('hidden', !part);
    if (part) $('peFind').href = partLookupHrefs(part).images;
    $('peRemove').classList.toggle('hidden', !item.photo);
    syncPhotoPreview();
    $('photoEditOverlay').classList.remove('hidden');
  }
  function syncPhotoPreview() {
    var item = photoEditId ? D.getItem(photoEditId) : null;
    if (!item) return;
    /* The preview follows the field: what's pasted is what saving
     * will show, icon underneath if it fails to load. */
    $('pePreview').innerHTML = iconPlate({ photo: $('peUrl').value.trim(), icon: item.icon });
  }
  function closePhotoEditor() { $('photoEditOverlay').classList.add('hidden'); photoEditId = null; }
  function applyPhoto(id, url) {
    var item = D.getItem(id);
    if (!item) { closePhotoEditor(); return; }
    var had = !!item.photo;
    D.setPhoto(id, url);
    var updated = D.getItem(id);
    if (currentItemId === id && updated) $('dIcon').innerHTML = iconPlate(updated);
    renderHome({ preserveOrder: true });
    refreshChrome();
    closePhotoEditor();
    if (url) toast('Photo updated');
    else if (had) toast('Photo removed');
  }
  function savePhotoEditor() {
    if (!photoEditId) return;
    var raw = $('peUrl').value.trim();
    if (raw && !/^https?:\/\//i.test(raw)) {
      var err = $('peError');
      err.textContent = 'That doesn\'t look like a photo link — it should start with http:// or https://';
      err.classList.remove('hidden');
      return;
    }
    applyPhoto(photoEditId, raw);   // an emptied field saves as a removal
  }
  $('dPhotoEditBtn').addEventListener('click', openPhotoEditor);
  $('peClose').addEventListener('click', closePhotoEditor);
  $('peCancel').addEventListener('click', closePhotoEditor);
  $('photoEditOverlay').addEventListener('click', function (e) { if (e.target === $('photoEditOverlay')) closePhotoEditor(); });
  $('peUrl').addEventListener('input', function () { $('peError').classList.add('hidden'); syncPhotoPreview(); });
  $('peSave').addEventListener('click', savePhotoEditor);
  $('peRemove').addEventListener('click', function () { if (photoEditId) applyPhoto(photoEditId, ''); });

  /* ---------- Item photo upload (Uppy) ----------
   * The photo editor's "Upload a photo" — the gap the link-only
   * editor (above) left on purpose, because a photo taken on the
   * device had nowhere to live. Now it does: the sheet bridge
   * (apps-script.gs, action=uploadPhoto) commits the image into
   * this repo's photos/ folder and answers with its public URL,
   * which then rides the exact same applyPhoto → ETData.setPhoto
   * funnel as a pasted link. Uppy (core + Dashboard + image editor,
   * one pinned standalone bundle) is loaded LAZILY from the CDN the
   * first time Upload is tapped: it is not in the app shell, not in
   * the service-worker precache, and if it can't load (offline) the
   * link field keeps working untouched. Before upload, the picked
   * image is shrunk on a canvas to the house spec — max 900px on
   * the longest side, JPEG q80 — so uploads match the existing
   * photos/ set. A failed upload never touches the item's photo.
   * (v41: decode goes through a bitmap→<img> fallback chain, the
   * shrink halves stepwise instead of one giant draw, the editor's
   * output is capped at 1600px, and a failure rejects with its
   * real stage-tagged error — toasted verbatim — instead of
   * dissolving into Uppy's generic "Failed to upload".) */
  var UPPY_VERSION = '4.18.3';
  var UPPY_BASE = 'https://cdn.jsdelivr.net/npm/uppy@' + UPPY_VERSION + '/dist/';
  var PHOTO_MAX_EDGE = 900;
  var PHOTO_JPEG_QUALITY = 0.8;
  var uppyLoadPromise = null;
  var uppyInstance = null;
  var uppyInjected = 0;    // CDN script tags injected (kept observable for tests)
  var uploadCtx = null;    // { id, base } — the item being photographed

  /* The box a w×h image shrinks into: longest side capped at max,
   * aspect kept, never upscaled. */
  function fitWithin(w, h, max) {
    max = max || PHOTO_MAX_EDGE;
    w = Number(w) || 0; h = Number(h) || 0;
    if (!w || !h || Math.max(w, h) <= max) return { width: w, height: h };
    var s = max / Math.max(w, h);
    return { width: Math.max(1, Math.round(w * s)), height: Math.max(1, Math.round(h * s)) };
  }

  function loadUppy() {
    if (window.Uppy && window.Uppy.Uppy) return Promise.resolve(window.Uppy);
    if (uppyLoadPromise) return uppyLoadPromise;
    uppyLoadPromise = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = UPPY_BASE + 'uppy.min.css';
      document.head.appendChild(css);
      var s = document.createElement('script');
      s.src = UPPY_BASE + 'uppy.min.js'; s.async = true;
      s.onload = function () {
        if (window.Uppy && window.Uppy.Uppy) resolve(window.Uppy);
        else reject(new Error('Photo upload could not start.'));
      };
      s.onerror = function () { reject(new Error('Photo upload needs a connection — check signal and try again.')); };
      uppyInjected++;
      document.head.appendChild(s);
    });
    /* A failed load clears the memo so the next tap retries. */
    uppyLoadPromise.then(null, function () { uppyLoadPromise = null; });
    return uppyLoadPromise;
  }

  /* Stage-tagged upload errors: the message alone says which
   * stage failed, in plain words — decode/read on this device,
   * canvas/process on this device, or the bridge (whose own
   * plain-word texts pass through verbatim, unchanged). The
   * err.stage tag rides along for the debug surface. */
  var PHOTO_READ_ERROR = 'That photo could not be read on this device.';
  var PHOTO_PROCESS_ERROR = 'That photo could not be processed on this device.';
  function stageError(stage, message) {
    var err = new Error(message);
    err.stage = stage;
    return err;
  }

  /* The most recent upload failure, as toasted: the 'complete'
   * handler consults it so the same failure is never toasted
   * twice, and the debug surface reports it. */
  var lastFailureToast = { msg: '', at: 0 };
  var failureToastCount = 0;
  var lastFailureInfo = null;   // { stage, message }
  function noteUploadFailure(err) {
    var msg = (err && err.message) || 'Upload failed — try again.';
    lastFailureInfo = { stage: (err && err.stage) || 'bridge', message: msg };
    lastFailureToast = { msg: msg, at: Date.now() };
    failureToastCount++;
    toast(msg, 4000);
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () {
        var s = String(r.result || '');
        var comma = s.indexOf(',');
        resolve(comma === -1 ? s : s.slice(comma + 1));
      };
      r.onerror = function () { reject(stageError('read', PHOTO_READ_ERROR)); };
      r.readAsDataURL(blob);
    });
  }

  /* Decode a picked photo into a drawable source, with a fallback
   * chain: createImageBitmap first (EXIF orientation requested),
   * then the <img> + object-URL path — iOS Safari auto-orients via
   * EXIF there and tolerates formats the bitmap decoder rejects
   * (fresh camera captures can be HEIC). Only when BOTH fail is
   * the photo unreadable on this device.
   * Resolves { src, width, height, via, dispose }. */
  function decodeImage(blob) {
    function bitmapAttempt() {
      return Promise.resolve().then(function () {
        try { return window.createImageBitmap(blob, { imageOrientation: 'from-image' }); }
        catch (e) { return window.createImageBitmap(blob); }
      }).then(function (bmp) {
        return {
          src: bmp, width: bmp.width || 0, height: bmp.height || 0, via: 'bitmap',
          dispose: function () { if (bmp.close) bmp.close(); }
        };
      });
    }
    function imgAttempt() {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          resolve({
            src: img, width: img.naturalWidth || img.width || 0, height: img.naturalHeight || img.height || 0,
            via: 'img', dispose: function () { URL.revokeObjectURL(url); }
          });
        };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('image element could not decode the photo')); };
        img.src = url;
      });
    }
    var chain = window.createImageBitmap
      ? bitmapAttempt().catch(function () { return imgAttempt(); })
      : imgAttempt();
    return chain.catch(function () { throw stageError('read', PHOTO_READ_ERROR); });
  }

  /* One drawImage onto a fresh w×h canvas. Any canvas trouble is
   * a process-stage failure. */
  function drawStep(src, w, h) {
    var canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) throw stageError('process', PHOTO_PROCESS_ERROR);
    try { ctx.drawImage(src, 0, 0, w, h); }
    catch (e) { throw stageError('process', PHOTO_PROCESS_ERROR); }
    return canvas;
  }

  var PHOTO_STEP_EDGE = 1600;   // stepwise halving stops at/below this long edge
  var lastShrinkInfo = null;    // { via, steps:[…], final } — debug/test seam

  /* Shrink to the house spec (≤900px long edge, JPEG q80) the
   * gentle way: decode, then HALVE through intermediate canvases
   * until the long edge is ≤1600, then one final draw to size.
   * A single drawImage from a 48MP camera frame straight to
   * 900px is exactly what iOS Safari chokes on — it no longer
   * happens anywhere in this path. */
  function shrinkImageToJpeg(blob) {
    return decodeImage(blob).then(function (dec) {
      var steps = [];
      var w = dec.width, h = dec.height, cur = dec.src, out;
      try {
        if (!w || !h) throw stageError('read', PHOTO_READ_ERROR);
        while (Math.max(w, h) > PHOTO_STEP_EDGE) {
          w = Math.max(1, Math.round(w / 2));
          h = Math.max(1, Math.round(h / 2));
          cur = drawStep(cur, w, h);
          steps.push(w + 'x' + h);
        }
        var dims = fitWithin(w, h);
        out = drawStep(cur, dims.width, dims.height);
        steps.push(dims.width + 'x' + dims.height);
      } finally {
        dec.dispose();
      }
      lastShrinkInfo = { via: dec.via, steps: steps, final: steps[steps.length - 1] };
      return new Promise(function (resolve, reject) {
        if (!out.toBlob) { reject(stageError('process', PHOTO_PROCESS_ERROR)); return; }
        out.toBlob(function (b) {
          if (b) resolve(b);
          else reject(stageError('process', PHOTO_PROCESS_ERROR));
        }, 'image/jpeg', PHOTO_JPEG_QUALITY);
      });
    }).catch(function (err) {
      if (err && err.stage) throw err;
      throw stageError('read', PHOTO_READ_ERROR);
    });
  }

  /* Suggested file base name for the bridge (it re-slugs and
   * de-collides on its side; this is just the starting point). */
  function uploadBaseName(item) {
    var raw = String((item && (item.sku || item.name || item.id)) || 'photo');
    return raw.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'photo';
  }

  /* The uploader plugin: Uppy handles picking, editing and
   * progress; the actual send is shrink → base64 → the bridge's
   * uploadPhoto action. On failure the plugin records the real
   * error on the file, says it out loud through the app toast
   * (Uppy's dashboard would otherwise show only its generic
   * "Failed to upload" line), and then REJECTS with the same
   * error — Uppy v4's uploader contract (its built-in uploaders
   * do exactly this): a step that swallows its failures leaves
   * core presenting its generic text, while a rejection makes
   * core record the genuine error. (A class, unlike the rest of
   * this file: Uppy's BasePlugin is an ES class and can only be
   * extended with class syntax.) */
  function defineBridgeUploader(U) {
    class BridgeUploader extends U.BasePlugin {
      constructor(uppy, opts) {
        super(uppy, opts || {});
        this.type = 'uploader';
        this.id = 'ETBridgeUploader';
        this.handleUpload = this.handleUpload.bind(this);
      }
      install() { this.uppy.addUploader(this.handleUpload); }
      uninstall() { this.uppy.removeUploader(this.handleUpload); }
      handleUpload(fileIDs) {
        var self = this;
        var jobs = (fileIDs || []).map(function (id) {
          var file = self.uppy.getFile(id);
          if (!file) return Promise.resolve();
          return shrinkImageToJpeg(file.data)
            .then(function (jpeg) {
              self.uppy.emit('upload-progress', file, { uploader: self, bytesUploaded: 0, bytesTotal: jpeg.size || 0 });
              return blobToBase64(jpeg);
            })
            .then(function (b64) {
              return window.ETSheets.uploadPhoto(uploadCtx ? uploadCtx.base : 'photo', b64);
            })
            .then(function (res) {
              if (!res || !res.ok || !res.url) throw stageError('bridge', (res && res.error) || 'Upload failed — try again.');
              self.uppy.emit('upload-progress', file, { uploader: self, bytesUploaded: 1, bytesTotal: 1 });
              self.uppy.emit('upload-success', file, { status: 200, body: { url: res.url }, uploadURL: res.url });
            })
            .catch(function (err) {
              var e = err instanceof Error ? err : new Error(String(err));
              self.uppy.emit('upload-error', file, e);
              noteUploadFailure(e);
              throw e;
            });
        });
        return Promise.all(jobs);
      }
    }
    return BridgeUploader;
  }

  function getUppy() {
    if (uppyInstance) return uppyInstance;
    var U = window.Uppy;
    var uppy = new U.Uppy({
      autoProceed: false,
      allowMultipleUploads: false,
      restrictions: { maxNumberOfFiles: 1, maxFileSize: 20 * 1024 * 1024, allowedFileTypes: ['image/*'] }
    });
    uppy.use(U.Dashboard, {
      inline: false,
      closeModalOnClickOutside: true,
      proudlyDisplayPoweredByUppy: false,
      showNativePhotoCameraButton: true
    });
    if (U.ImageEditor) uppy.use(U.ImageEditor, {
      target: U.Dashboard,
      quality: 0.85,
      /* Cap the editor's output: an edited photo leaves the editor
       * at ≤1600px on its long edge instead of natural (possibly
       * 48MP) resolution — its save() passes croppedCanvasOptions
       * to cropper's getCroppedCanvas. The upload shrink below
       * then only ever starts from ≤1600px too. */
      cropperOptions: { croppedCanvasOptions: { maxWidth: PHOTO_STEP_EDGE, maxHeight: PHOTO_STEP_EDGE } }
    });
    if (U.ThumbnailGenerator) uppy.use(U.ThumbnailGenerator, { thumbnailWidth: 360, waitForThumbnailsBeforeUpload: false });
    uppy.use(defineBridgeUploader(U));
    uppy.on('complete', function (result) {
      var first = result && result.successful && result.successful[0];
      var url = first && first.response && first.response.body && first.response.body.url;
      if (url && uploadCtx) {
        var dash = uppy.getPlugin('Dashboard');
        if (dash && dash.closeModal) dash.closeModal();
        var id = uploadCtx.id;
        uploadCtx = null;
        applyPhoto(id, url);
        /* Clear the finished file so the next open starts empty. */
        uppy.getFiles().forEach(function (f) { uppy.removeFile(f.id); });
      } else if (result && result.failed && result.failed.length) {
        var f = result.failed[0];
        var msg = typeof f.error === 'string' ? f.error : (f.error && f.error.message);
        /* Backstop only: the uploader already toasted this exact
         * failure as it happened — never say the same one twice. */
        var alreadyToasted = !!msg && msg === lastFailureToast.msg && (Date.now() - lastFailureToast.at) < 10000;
        if (!alreadyToasted) {
          if (msg) noteUploadFailure(new Error(msg));
          else toast('Upload failed — try again.', 4000);
        }
      }
    });
    uppyInstance = uppy;
    return uppy;
  }

  function openPhotoUploader() {
    if (!photoEditId) return;
    var item = D.getItem(photoEditId);
    if (!item) return;
    uploadCtx = { id: item.id, base: uploadBaseName(item) };
    loadUppy().then(function () {
      var dash = getUppy().getPlugin('Dashboard');
      if (dash && dash.openModal) dash.openModal();
    }).catch(function (err) {
      toast((err && err.message) || 'Photo upload could not start.', 4000);
    });
  }
  $('peUpload').addEventListener('click', openPhotoUploader);

  /* Small surface for the test harness (and future debugging):
   * the pure helpers, the loader, and whether the CDN script had
   * to be injected at all. */
  window.ETUpload = {
    loadUppy: loadUppy,
    fitWithin: fitWithin,
    shrinkImageToJpeg: shrinkImageToJpeg,
    openPhotoUploader: openPhotoUploader,
    instance: function () { return uppyInstance; },
    debug: function () {
      return {
        version: UPPY_VERSION, injected: uppyInjected, hasInstance: !!uppyInstance,
        lastShrink: lastShrinkInfo,
        lastFailure: lastFailureInfo,
        failureToasts: failureToastCount
      };
    }
  };

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
    $('addSuccessText').textContent = item.name + ' — ' + item.qty + ' in ' + locShort(item) + ' · Folder: ' + itemCategory(item) + '. Stick an NFC sticker on the bin/item:';
    lastAddUrl = D.stickerUrl(item.id);
    $('addIosNote').classList.toggle('hidden', NFC_SUPPORTED);
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
  $('addCopyBtn').addEventListener('click', function () { copyString(lastAddUrl, 'Link copied'); });
  $('addAnotherBtn').addEventListener('click', function () {
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    $('addForm').reset(); $('addQty').value = 1;
    updateSkuLookup();
    iconTouched = false; pendingAdd = null;
    $('addDupWarn').classList.add('hidden');
    selectIcon(ICON_KEYS[0]);
  });
  /* ---------- #16 Offline-First / Sync Queue ---------- */
  /* v36: the Settings lists (queued changes, not-in-sheet items)
   * start COLLAPSED — Settings shows the summary counts plus a
   * Show/Hide toggle, and the rows render only while expanded,
   * inside a height-capped region that scrolls internally. Pure
   * presentation: the queue, the sync engine and every action are
   * untouched. The flags reset on every Settings entry (showView),
   * never persist, and re-renders preserve the expanded state (and
   * the region's scroll position) while Settings stays open. */
  var queueExpanded = false, orphansExpanded = false;
  function syncListChrome(listEl, togEl, expanded) {
    listEl.classList.toggle('hidden', !expanded);
    listEl.classList.toggle('list-scroll', expanded);
    togEl.classList.toggle('open', expanded);
    togEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    var lbl = togEl.querySelector('.lt-label');
    if (lbl) lbl.textContent = expanded ? 'Hide' : 'Show';
  }
  function syncQueueChrome(hasEntries) {
    var tog = $('queueToggle');
    tog.classList.toggle('hidden', !hasEntries);
    if (!hasEntries) {
      /* Empty queue: today's plain message in place, no toggle. */
      $('queueList').classList.remove('hidden');
      $('queueList').classList.remove('list-scroll');
      return;
    }
    syncListChrome($('queueList'), tog, queueExpanded);
  }
  function renderQueue() {
    $('queueNetStatus').textContent = navigator.onLine ? 'Online' : 'Offline';
    var q = D.getQueue();
    var pending = q.filter(function (c) { return !c.synced; });
    $('queuePendingCount').textContent = pending.length;
    $('queueLastSync').textContent = fmtTime(D.getMeta().lastSync);
    var sorted = q.slice().reverse();
    var listEl = $('queueList');
    var keepScroll = queueExpanded ? listEl.scrollTop : 0;
    listEl.innerHTML = sorted.length ? sorted.map(function (c) {
      return '<div class="list-item queue-item' + (c.synced ? ' synced' : '') + '"><span class="li-icon">' + (c.synced ? svgIcon('check') : svgIcon('sync')) + '</span>' +
        '<span class="li-main"><span class="li-name">' + esc(c.detail) + '</span><br><span class="li-when">' + esc(c.type) + ' · ' + fmtTime(c.at) + '</span></span>' +
        '<span class="sync-tag' + (c.synced ? ' done' : '') + '">' + (c.synced ? 'SYNCED' : 'PENDING') + '</span></div>';
    }).join('') : '<p class="muted">No changes yet — adjust a quantity and it will appear here.</p>';
    syncQueueChrome(sorted.length > 0);
    if (queueExpanded && sorted.length) listEl.scrollTop = keepScroll;
    refreshChrome();
  }
  $('queueToggle').addEventListener('click', function () {
    queueExpanded = !queueExpanded;
    syncQueueChrome(D.getQueue().length > 0);
  });
  $('orphanToggle').addEventListener('click', function () {
    orphansExpanded = !orphansExpanded;
    syncListChrome($('orphanList'), $('orphanToggle'), orphansExpanded);
  });
  $('syncNowBtn').addEventListener('click', function () {
    var out = $('syncResult');
    out.textContent = 'Syncing…'; out.className = 'result';
    D.flushQueue().then(function (r) {
      out.textContent = r.message; out.className = 'result ' + (r.ok ? 'ok' : 'err');
      renderQueue(); renderSync();
    });
  });
  /* ---------- Live sync engine ----------
   * Changes used to sit in the queue until someone opened Settings
   * and pressed Sync (the only other flushes were the online and
   * foreground events below — nothing fired when a change was MADE).
   * Now every enqueue schedules its own flush: ETData notifies from
   * its two queue funnels (appsheet.js), and this engine debounces
   * bursts into one POST, retries with backoff while the app stays
   * open, and pulls fresh sheet rows on focus and on a ~60 s poll —
   * skipping pulls while a flush is running or an editing sheet is
   * open, and relying on refreshFromBackend's pending-op protection
   * so a pull never clobbers an unsent local change. The Settings
   * Sync button stays as the manual fallback (dead zones, stubborn
   * per-op rejections — failures stay visible there, no noisy toast). */
  var syncFlushTimer = null, syncRetryTimer = null, syncRunning = false;
  var syncRetryDelay = 30000, syncLastRefresh = 0, syncRefreshRunning = false;
  function syncPending() { return D.getQueue().some(function (c) { return !c.synced; }); }
  function scheduleAutoFlush(delay) {
    if (!D.isLive()) return;
    clearTimeout(syncFlushTimer);
    syncFlushTimer = setTimeout(runAutoFlush, delay == null ? 800 : delay);
  }
  function armSyncRetry(grow) {
    clearTimeout(syncRetryTimer);
    if (!D.isLive() || !syncPending()) return;
    syncRetryTimer = setTimeout(runAutoFlush, syncRetryDelay);
    /* Only a real failed send grows the backoff — arming from the
     * offline / nothing-to-send path just parks the timer. */
    if (grow) syncRetryDelay = Math.min(syncRetryDelay * 2, 300000);
  }
  function runAutoFlush() {
    clearTimeout(syncFlushTimer); clearTimeout(syncRetryTimer);
    if (syncRunning) return;   // the running flush re-checks the queue when it settles
    if (!navigator.onLine || !D.isLive() || !syncPending()) { armSyncRetry(false); return; }
    syncRunning = true;
    D.flushQueue().then(function (r) {
      syncRunning = false;
      refreshChrome();
      if (currentItemId && !$('itemOverlay').classList.contains('hidden')) renderOrphanNotice();
      if ($('view-sync').classList.contains('active')) { renderQueue(); renderSync(); }
      if (r.ok) {
        syncRetryDelay = 30000;
        if (syncPending()) scheduleAutoFlush(800);   // ops that arrived mid-flush
      } else {
        armSyncRetry(true);   // stays queued; backed-off retry + next trigger will get it
      }
    });
  }
  D.onQueueChange(function () { scheduleAutoFlush(); });

  var EDIT_OVERLAYS = ['itemOverlay', 'binOverlay', 'countOverlay', 'shelfOverlay', 'orgOverlay', 'orgPickOverlay', 'nfcOverlay', 'qtyEditOverlay', 'autoSortOverlay', 'sortOverlay', 'folderSheetOverlay', 'folderRemoveOverlay', 'supClearOverlay', 'supRenameOverlay', 'supplierOverlay', 'orphanRemoveOverlay', 'photoEditOverlay'];
  function editingOpen() {
    for (var i = 0; i < EDIT_OVERLAYS.length; i++) {
      var o = $(EDIT_OVERLAYS[i]);
      if (o && !o.classList.contains('hidden')) return true;
    }
    var av = $('view-add');
    return !!(av && av.classList.contains('active'));
  }
  /* ---------- App-update gate (v35) ----------
   * The service-worker bootstrap in index.html reloads the page when
   * a new build takes over — but never mid-task. It asks this gate
   * whether the user is busy: any editing sheet open (the same
   * predicate the auto-refresher uses), a live Count Mode session,
   * or the create menu up. A takeover that arrives while busy stays
   * pending in the bootstrap and is applied once this reports idle. */
  window.ETUpdateGate = {
    isBusy: function () {
      return editingOpen() || countSession !== null || addMenuOpen;
    }
  };
  function maybeAutoRefresh(force) {
    if (!D.isLive() || document.hidden) return;
    if (syncRunning || syncRefreshRunning) return;
    if (editingOpen()) return;
    var now = Date.now();
    if (!force && now - syncLastRefresh < 60000) return;
    if (force && now - syncLastRefresh < 4000) return;   // focus + visibility often fire together
    syncRefreshRunning = true;
    D.refreshFromBackend().then(function (r) {
      syncRefreshRunning = false; syncLastRefresh = Date.now();
      if (r && r.ok) {
        renderHome(); refreshChrome();
        if (currentShelf !== null && !$('shelfOverlay').classList.contains('hidden')) renderShelf();
        if ($('view-sync').classList.contains('active')) renderSync();
      }
    });
  }
  setInterval(function () { maybeAutoRefresh(false); }, 60000);

  window.addEventListener('online', function () { refreshChrome(); renderQueue(); toast('Back online'); scheduleAutoFlush(300); maybeAutoRefresh(true); });
  window.addEventListener('offline', function () { refreshChrome(); renderQueue(); toast('Offline — changes will queue'); });
  window.addEventListener('focus', function () { maybeAutoRefresh(true); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    scheduleAutoFlush(0);
    maybeAutoRefresh(true);
  });

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
    renderOrphans();
    renderSortCounts();
    refreshChrome();
  }

  /* ---------- Filing in Settings: Auto-sort + Sort mode ----------
   * Filing lives ONLY here (v39 — the Home banner is gone): two
   * cards, Auto-sort (the review overlay) and Sort mode (one item
   * at a time), both through the SAME entry points they have
   * always used — openAutoSort / startSort, nothing forked —
   * including their shared empty state (at zero unfiled, each
   * toasts "Nothing to sort — everything has a folder"). The
   * count lines are live: renderSync refreshes them on Settings
   * entry and after syncs, and refreshChrome (called after every
   * queue/data change) keeps them current while Settings sits
   * open. */
  function renderSortCounts() {
    var n = uncatItems().length;
    var text = n + (n === 1 ? ' item needs' : ' items need') + ' a folder';
    var a = $('setAutoSortLine'); if (a) a.textContent = text;
    var s = $('setSortModeLine'); if (s) s.textContent = text;
  }
  $('setAutoSortCard').addEventListener('click', function () { openAutoSort(); });
  $('setSortModeCard').addEventListener('click', function () { startSort(); });

  /* ---------- Not-in-sheet items (orphans) ----------
   * ETData flags an item when the sheet bridge answers one of its
   * ops with 'Id not found in sheet' — the item lives only on this
   * device (added before it connected, or a leftover the demo purge
   * spared), so its changes can never sync until it gets a row. Two
   * exits, offered here in Sync Health AND on the item sheet itself:
   * Add to sheet (ETData queues one 'add' op with the item's full
   * current state under its existing id — the auto-flush sends it,
   * and the flag clears when it lands), or Remove from this device
   * (confirm first). In local-only mode there is no sheet to be
   * missing from: the section stays hidden. */
  function orphanEntries() {
    if (D.activeBackend() !== 'sheet') return [];
    return D.getOrphans().map(function (id) { return D.getItem(id); }).filter(function (it) { return !!it; });
  }
  function orphanLabel(it) {
    return (it.name && String(it.name).trim()) || it.sku || 'Unnamed item';
  }
  function renderOrphans() {
    var block = $('orphanBlock');
    if (!block) return;
    var entries = orphanEntries();
    block.classList.toggle('hidden', !entries.length);
    if (!entries.length) return;
    /* v36: count stays visible; the rows sit behind the toggle. */
    $('orphanCount').textContent = entries.length + (entries.length === 1 ? ' item' : ' items');
    $('orphanToggle').classList.remove('hidden');
    var oList = $('orphanList');
    var keepScroll = orphansExpanded ? oList.scrollTop : 0;
    oList.innerHTML = entries.map(function (it) {
      var label = orphanLabel(it);
      var sub = [];
      if (it.sku && it.sku !== label) sub.push(it.sku);
      sub.push('Qty ' + it.qty);
      if (it.bin) sub.push(it.bin);
      return '<div class="list-item orphan-item"><span class="li-main"><span class="li-name">' + esc(label) + '</span><br><span class="li-when">' + esc(sub.join(' · ')) + '</span></span>' +
        '<span class="orphan-actions"><button type="button" class="btn btn-primary" data-orphan-add="' + esc(it.id) + '">Add to sheet</button>' +
        '<button type="button" class="btn" data-orphan-remove="' + esc(it.id) + '">Remove</button></span></div>';
    }).join('');
    oList.querySelectorAll('[data-orphan-add]').forEach(function (b) {
      b.addEventListener('click', function () { addOrphanFromUi(b.getAttribute('data-orphan-add'), $('orphanResult')); });
    });
    oList.querySelectorAll('[data-orphan-remove]').forEach(function (b) {
      b.addEventListener('click', function () { askRemoveOrphan(b.getAttribute('data-orphan-remove')); });
    });
    syncListChrome(oList, $('orphanToggle'), orphansExpanded);
    if (orphansExpanded) oList.scrollTop = keepScroll;
  }
  /* Shared Add action (Sync Health row + item-sheet notice). The add
   * op rides the live-sync auto-flush — ETData's queueChange notify
   * schedules it — and the flag (and this UI) clears when it lands;
   * runAutoFlush re-renders both surfaces on completion. */
  function addOrphanFromUi(id, outEl) {
    var item = D.getItem(id);
    var res = D.addOrphanToSheet(id);
    if (!res.ok) { toast(res.message || 'Could not add that item'); return; }
    if (outEl) { outEl.textContent = 'Adding “' + (item ? orphanLabel(item) : id) + '” to the sheet…'; outEl.className = 'result'; }
    toast('Adding “' + (item ? orphanLabel(item) : id) + '” to the sheet…');
    renderOrphans();
  }
  /* Item-sheet notice: shown only while the open item is flagged.
   * renderOrphanNotice also restores the Add button after a flush —
   * if the flag cleared, the notice hides; if the add is still
   * waiting (offline, another rejection), the button re-arms. */
  function renderOrphanNotice() {
    var notice = $('dOrphanNotice');
    if (!notice) return;
    var show = !!currentItemId && D.activeBackend() === 'sheet' && D.isOrphan(currentItemId) && !!D.getItem(currentItemId);
    notice.classList.toggle('hidden', !show);
    if (show) {
      var btn = $('dOrphanAddBtn');
      btn.disabled = false;
      btn.textContent = 'Add to sheet';
    }
  }
  $('dOrphanAddBtn').addEventListener('click', function () {
    if (!currentItemId) return;
    var btn = $('dOrphanAddBtn');
    btn.disabled = true;
    btn.textContent = 'Adding…';
    addOrphanFromUi(currentItemId, null);
  });
  /* Remove: confirm first — the item and its pending changes leave
   * this device; the sheet never had it and is not touched. */
  var orphanRemoveId = null;
  function askRemoveOrphan(id) {
    var item = D.getItem(id);
    if (!item) { renderOrphans(); return; }
    orphanRemoveId = id;
    $('orTitle').textContent = 'Remove “' + orphanLabel(item) + '”?';
    $('orText').textContent = 'This item isn\'t in the sheet. Remove it and its pending changes from this device? The sheet is not changed.';
    $('orphanRemoveOverlay').classList.remove('hidden');
  }
  function closeRemoveOrphan() { $('orphanRemoveOverlay').classList.add('hidden'); orphanRemoveId = null; }
  $('orCancel').addEventListener('click', closeRemoveOrphan);
  $('orphanRemoveOverlay').addEventListener('click', function (e) { if (e.target === $('orphanRemoveOverlay')) closeRemoveOrphan(); });
  $('orConfirm').addEventListener('click', function () {
    if (!orphanRemoveId) return;
    var id = orphanRemoveId;
    var item = D.getItem(id);
    closeRemoveOrphan();
    var res = D.removeOrphanItem(id);
    if (!res.ok) { toast(res.message || 'Could not remove that item'); return; }
    toast('Removed “' + (item ? orphanLabel(item) : id) + '” from this device');
    if (currentItemId === id) closeItem();
    renderOrphans();
    renderQueue();
    renderHome();
    refreshChrome();
  });

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
  initFolderStripScroll();
  renderHome();
  renderSync();
  refreshChrome();
  /* v37: the app opens on the folder jump list — the All dropdown
   * IS the home page (Matthew's ask). A sticker link (?item= /
   * ?shelf=) still wins: it opens its item/shelf instead. */
  var bootParams = new URLSearchParams(window.location.search);
  if (!bootParams.get('item') && !bootParams.get('shelf')) openFolderJump();
  // Sheet mode: pull the sheet's rows so the app opens on real data.
  D.refreshFromBackend().then(function (r) {
    if (r && r.ok) {
      syncLastRefresh = Date.now();   // the load pull counts as a refresh for the poll
      renderHome(); renderSync(); refreshChrome();
      if (currentShelf !== null && !$('shelfOverlay').classList.contains('hidden')) renderShelf();
      openFromUrl();   // a sticker link whose item only just arrived
    }
  });
  /* Flush anything left queued from a previous session shortly after
   * load — the manual Sync button is the fallback, not the routine. */
  scheduleAutoFlush(1500);
  fitSticky();
  openFromUrl();
})();
