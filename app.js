/* app.js — Electric Trailer inventory PWA.
 * Screens (bottom tabs):
 *   Home      #08 Photo-First Grid (+ item detail #02 NFC Tap-to-Open)
 *   Map       #03 Warehouse / Bin Map
 *   Suppliers #19 Supplier Hub
 *   Add       #22 Quick Add New Item
 *   Queue     #16 Offline-First Field Mode (sync queue)
 *   Sync      #24 AppSheet Sync Health & Settings
 * Data + AppSheet API live in appsheet.js (window.ETData).
 */
(function () {
  'use strict';
  var D = window.ETData;
  var $ = function (id) { return document.getElementById(id); };
  var AISLES = ['A', 'B', 'C', 'D'];
  var BINS = [];
  AISLES.forEach(function (a) { for (var i = 1; i <= 6; i++) BINS.push(a + i); });
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
  var currentItemId = null;
  var selectedBin = null;
  var currentBin = null;
  var selectedSupplier = null;
  var selectedIcon = ICON_KEYS[0];
  var lowFilter = false;

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
    mb.textContent = live ? 'Live · AppSheet' : 'Demo mode';
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
    if ($('view-sync').classList.contains('active')) renderQueue();
  }

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
      t.classList.toggle('active', t.getAttribute('data-view') === name);
    });
    if (name === 'home') renderHome();
    if (name === 'map') renderMap();
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
    var filtered = items.filter(function (i) {
      if (lowFilter && i.qty > 5) return false;
      if (!q) return true;
      return (i.name + ' ' + i.sku + ' ' + i.bin + ' ' + i.supplier).toLowerCase().indexOf(q) !== -1;
    });
    if (lowFilter) filtered = filtered.slice().sort(function (a, b) { return a.qty - b.qty; });  // worst first: 0s, then 1–2, then 3–5
    $('photoGrid').innerHTML = filtered.map(function (i) {
      var st = statusOf(i.qty);
      var pill = st === 'ok'
        ? '<span class="qty-pill qty-slot" aria-hidden="true">' + qtyLabel(i.qty) + '</span>'
        : '<span class="qty-pill ' + qtyClass(i.qty) + '">' + qtyLabel(i.qty) + '</span>';
      return '<div class="photo-card st-' + st + '" data-card="' + esc(i.id) + '" role="button" tabindex="0" aria-label="' + esc(i.name) + ', ' + qtyLabel(i.qty) + '">' +
        '<span class="pc-icon">' + iconFor(i) + '</span>' +
        '<div class="pc-name">' + esc(i.name) + '</div>' +
        '<div class="pc-bin">Bin ' + esc(i.bin) + ' · ' + esc(i.sku) + '</div>' +
        pill +
        '<div class="stepper-strip">' +
          '<button type="button" data-dec="' + esc(i.id) + '" aria-label="Remove one from ' + esc(i.name) + '">−</button>' +
          '<span class="ss-qty">' + i.qty + '</span>' +
          '<button type="button" data-inc="' + esc(i.id) + '" aria-label="Add one to ' + esc(i.name) + '">+</button>' +
        '</div></div>';
    }).join('');
    $('gridEmpty').textContent = lowFilter && !q ? 'Nothing is low right now.' : 'No items match your search.';
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
    refreshChrome();
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
    $('dIcon').innerHTML = iconFor(item);
    $('dName').textContent = item.name;
    $('dMeta').textContent = item.sku + ' · Bin ' + item.bin + ' · ' + item.supplier;
    $('dBinChip').textContent = 'BIN ' + item.bin;
    $('dCost').textContent = money(item.cost) + ' each';
    $('dStickerLink').value = D.stickerUrl(item.id);
    $('qtyEditor').classList.add('hidden');
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
    $('dQtyState').textContent = qtyStateWord(item.qty);
    var pill = $('dStatus');
    pill.className = 'qty-pill ' + qtyClass(item.qty);
    pill.textContent = qtyLabel(item.qty);
    $('dCost').textContent = money(item.cost) + ' each';
    $('dUpdated').textContent = 'Last updated ' + fmtTime(item.updated) + (navigator.onLine ? '' : ' · queued (offline)');
  }
  function closeItem() { $('itemOverlay').classList.add('hidden'); $('qtyEditor').classList.add('hidden'); currentItemId = null; renderHome(); }
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
  /* Exact count: tap the giant numeral, type the number, Set. */
  $('dQtyBtn').addEventListener('click', function () {
    if (!currentItemId) return;
    var item = D.getItem(currentItemId);
    $('qtySetInput').value = item ? item.qty : 0;
    $('qtyEditor').classList.remove('hidden');
    $('qtySetInput').focus(); $('qtySetInput').select();
  });
  $('qtySetBtn').addEventListener('click', function () {
    if (!currentItemId) return;
    setQtyWithUndo(currentItemId, parseInt($('qtySetInput').value, 10) || 0);
    $('qtyEditor').classList.add('hidden');
  });
  $('qtySetCancel').addEventListener('click', function () { $('qtyEditor').classList.add('hidden'); });

  function copyText(inputEl, msg) {
    inputEl.select(); inputEl.setSelectionRange(0, 9999);
    var done = function () { toast(msg || 'Copied'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inputEl.value).then(done, function () { document.execCommand('copy'); done(); });
    } else { document.execCommand('copy'); done(); }
  }
  $('dCopyBtn').addEventListener('click', function () { copyText($('dStickerLink'), 'Sticker link copied'); });

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
    var dev = $('nfcDeviceStatus');
    if (dev) dev.textContent = NFC_SUPPORTED
      ? 'NFC Live available in this browser'
      : 'NFC Live not available in this browser — stickers open items via their URL instead';
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
    var byBin = {};
    items.forEach(function (i) { (byBin[i.bin] = byBin[i.bin] || []).push(i); });
    $('binMap').innerHTML = AISLES.map(function (a) {
      var cells = '';
      for (var n = 1; n <= 6; n++) {
        var bin = a + n;
        var list = byBin[bin] || [];
        var total = list.reduce(function (s, i) { return s + i.qty; }, 0);
        var cls, label;
        if (!list.length) { cls = 'bin-empty'; label = '·'; }
        else {
          var worst = worstStatus(list);
          cls = 'bin-' + worst;
          label = (worst === 'out' ? '✕ ' : (worst === 'ok' ? '' : '▲ ')) + total;
        }
        cells += '<button class="bin-cell ' + cls + (selectedBin === bin ? ' sel' : '') + '" data-bin="' + bin + '">' +
          '<strong>' + bin + '</strong><small>' + label + '</small></button>';
      }
      return '<div><div class="aisle-label">AISLE ' + a + '</div><div class="bin-row">' + cells + '</div></div>';
    }).join('');
    $('binMap').querySelectorAll('[data-bin]').forEach(function (c) {
      c.addEventListener('click', function () { openBinSheet(c.getAttribute('data-bin')); });
    });
  }
  function itemRow(i) {
    return '<button class="list-item" data-open="' + esc(i.id) + '"><span class="li-icon">' + iconFor(i) + '</span>' +
      '<span class="li-main"><span class="li-name">' + esc(i.name) + '</span><br><span class="li-sub">Bin ' + esc(i.bin) + ' · ' + esc(i.sku) + ' · ' + money(i.cost) + '</span></span>' +
      '<span class="li-qty ' + qtyClass(i.qty) + '">' + i.qty + '</span></button>';
  }

  /* ---------- Bin Sheet: a bin's contents as a sheet over the map ---------- */
  function openBinSheet(bin) {
    currentBin = bin; selectedBin = bin;
    renderMap();
    renderBinSheetItems();
    $('binOverlay').classList.remove('hidden');
  }
  function closeBinSheet() { $('binOverlay').classList.add('hidden'); currentBin = null; }
  function renderBinSheetItems() {
    if (!currentBin) return;
    var list = D.getItems().filter(function (i) { return i.bin === currentBin; });
    var total = list.reduce(function (s, i) { return s + i.qty; }, 0);
    $('bTitle').textContent = 'BIN ' + currentBin;
    var worst = list.length ? worstStatus(list) : 'ok';
    var statusHtml = !list.length ? 'Empty bin'
      : '<span class="qty-pill ' + ('qty-' + worst) + '">' + (worst === 'ok' ? 'STOCKED' : qtyLabel(list.reduce(function (m, i) { return STATUS_RANK[statusOf(i.qty)] < STATUS_RANK[statusOf(m.qty)] ? i : m; }).qty)) + '</span>';
    $('bMeta').innerHTML = list.length + ' item(s) · ' + total + ' units &nbsp;' + statusHtml;
    $('binItems').innerHTML = list.length ? list.map(function (i) {
      return '<div class="list-item row-item"><span class="li-icon">' + iconFor(i) + '</span>' +
        '<button type="button" class="li-main row-open" data-open="' + esc(i.id) + '"><span class="li-name">' + esc(i.name) + '</span><br>' +
        '<span class="li-sub">' + esc(i.sku) + ' · ' + esc(i.supplier) + '</span></button>' +
        '<span class="row-stepper">' +
          '<button type="button" data-bdec="' + esc(i.id) + '" aria-label="Remove one from ' + esc(i.name) + '">−</button>' +
          '<b>' + i.qty + '</b>' +
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
  }
  $('closeBin').addEventListener('click', closeBinSheet);
  $('binOverlay').addEventListener('click', function (e) { if (e.target === $('binOverlay')) closeBinSheet(); });
  $('binAddBtn').addEventListener('click', function () {
    var bin = currentBin;
    closeBinSheet();
    openAddForBin(bin);
  });
  $('binCountBtn').addEventListener('click', function () { startCount(currentBin); });

  /* ---------- Count Mode: walk a bin item by item, then apply ---------- */
  var countSession = null;
  function startCount(bin) {
    if (!bin) return;
    var list = D.getItems().filter(function (i) { return i.bin === bin; });
    if (!list.length) { toast('Bin ' + bin + ' is empty — nothing to count'); return; }
    countSession = {
      bin: bin,
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
    $('cProgress').textContent = (countSession.idx + 1) + ' of ' + countSession.entries.length + ' · Bin ' + countSession.bin;
    $('cHero').innerHTML = iconFor(item);
    $('cName').textContent = item.name;
    $('cMeta').textContent = 'Bin ' + item.bin + ' · system qty ' + en.system;
    $('cQty').textContent = en.counted;
    $('cBack').textContent = countSession.idx === 0 ? 'Cancel' : 'Back';
    $('cNext').textContent = countSession.idx === countSession.entries.length - 1 ? 'Finish' : 'Next';
  }
  function closeCount() { $('countOverlay').classList.add('hidden'); countSession = null; }
  $('cPlus').addEventListener('click', function () {
    if (!countSession) return;
    var en = countSession.entries[countSession.idx];
    en.counted++; $('cQty').textContent = en.counted;
  });
  $('cMinus').addEventListener('click', function () {
    if (!countSession) return;
    var en = countSession.entries[countSession.idx];
    en.counted = Math.max(0, en.counted - 1); $('cQty').textContent = en.counted;
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
  function bindItemRows(container) {
    container.querySelectorAll('[data-open]').forEach(function (el) {
      el.addEventListener('click', function () { openItem(el.getAttribute('data-open')); });
    });
  }

  /* ---------- #19 Supplier Hub ---------- */
  function renderSuppliers() {
    var items = D.getItems();
    $('supplierList').innerHTML = D.getSuppliers().map(function (s) {
      var mine = items.filter(function (i) { return i.supplier === s.name; });
      return '<button class="list-item" data-supplier="' + esc(s.name) + '"><span class="li-icon">' + svgIcon('factory') + '</span>' +
        '<span class="li-main"><span class="li-name">' + esc(s.name) + '</span><br>' +
        '<span class="li-sub">' + mine.length + ' items · lead ' + esc(s.leadTime) + '<br>' +
        esc(s.contact) + ' · ' + esc(s.phone) + ' · ' + esc(s.email) + '</span></span></button>';
    }).join('');
    $('supplierList').querySelectorAll('[data-supplier]').forEach(function (el) {
      el.addEventListener('click', function () { selectedSupplier = el.getAttribute('data-supplier'); renderSuppliers(); });
    });
    if (selectedSupplier) {
      var mine2 = items.filter(function (i) { return i.supplier === selectedSupplier; });
      $('supplierItemsTitle').textContent = selectedSupplier + ' — items';
      $('supplierItems').innerHTML = mine2.length ? mine2.map(itemRow).join('') : '<p class="muted">No items from this supplier yet.</p>';
      bindItemRows($('supplierItems'));
    } else {
      $('supplierItemsTitle').textContent = '';
      $('supplierItems').innerHTML = '';
    }
  }

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
    if (/brake|controller/.test(n)) return 'controller';
    if (n.indexOf(' tire') !== -1 || n.indexOf(' tyre') !== -1) return 'tire';
    if (n.indexOf('light') !== -1 || n.indexOf('lamp') !== -1) return 'light';
    if (n.indexOf('battery') !== -1) return 'battery';
    if (n.indexOf('coupler') !== -1 || n.indexOf('hitch') !== -1) return 'link';
    if (n.indexOf('axle') !== -1) return 'axle';
    if (n.indexOf('hub') !== -1) return 'hub';
    if (n.indexOf('jack') !== -1) return 'jack';
    if (n.indexOf('chain') !== -1) return 'chain';
    if (n.indexOf('solar') !== -1) return 'solar';
    if (n.indexOf('plug') !== -1 || n.indexOf('harness') !== -1) return 'plug';
    if (n.indexOf('spring') !== -1) return 'spring';
    if (n.indexOf('fender') !== -1) return 'fender';
    return null;
  }
  function initAddForm() {
    $('addBin').innerHTML = BINS.map(function (b) { return '<option>' + b + '</option>'; }).join('');
    $('addSupplier').innerHTML = D.getSuppliers().map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('');
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
  }
  function normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function doAdd(data) {
    var item = D.addItem(data);
    pendingAdd = null;
    $('addDupWarn').classList.add('hidden');
    $('addForm').classList.add('hidden');
    $('addSuccess').classList.remove('hidden');
    $('addSuccessText').textContent = item.name + ' — ' + item.qty + ' in Bin ' + item.bin + '. Stick an NFC sticker on the bin/item and write this link to it:';
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
      qty: $('addQty').value, cost: $('addCost').value,
      bin: $('addBin').value, supplier: $('addSupplier').value, icon: selectedIcon
    };
    if (!data.name) return;
    /* Duplicate-name check: offer "Receive this instead" rather than
     * silently creating a twin of an item that already exists. */
    var dup = D.getItems().filter(function (i) { return normName(i.name) === normName(data.name); })[0];
    if (dup) {
      pendingAdd = { data: data, dup: dup };
      $('dupText').textContent = '“' + dup.name + '” already exists — Bin ' + dup.bin + ', ' + dup.qty + ' in stock. Receive against that item instead of adding a duplicate?';
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
  function openAddForBin(bin) {
    showView('add');
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    if (bin) $('addBin').value = bin;
    $('addName').focus();
  }
  $('addCopyBtn').addEventListener('click', function () { copyText($('addStickerLink'), 'Sticker link copied'); });
  $('addAnotherBtn').addEventListener('click', function () {
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    $('addForm').reset(); $('addQty').value = 1;
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
   * foreground, quietly push the queue if we're connected to AppSheet. */
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

  /* ---------- #24 Sync Health & Settings ---------- */
  function renderSync() {
    var s = D.getSettings();
    $('setAppId').value = s.appId;
    $('setTable').value = s.table;
    if (document.activeElement !== $('setAccessKey') && s.accessKey) $('setAccessKey').value = s.accessKey;
    $('healthMode').textContent = D.isLive() ? 'Live · AppSheet API' : 'Demo (local data)';
    $('healthRows').textContent = D.getItems().length;
    $('healthQueue').textContent = D.getQueue().filter(function (c) { return !c.synced; }).length + ' pending';
    $('healthLastSync').textContent = fmtTime(D.getMeta().lastSync);
    $('healthError').textContent = D.getMeta().lastError || 'none';
    refreshChrome();
  }
  $('settingsForm').addEventListener('submit', function (e) {
    e.preventDefault();
    D.saveSettings({ appId: $('setAppId').value, table: $('setTable').value, accessKey: $('setAccessKey').value });
    toast('Settings saved on this device');
    renderSync();
  });
  $('testConnBtn').addEventListener('click', function () {
    D.saveSettings({ appId: $('setAppId').value, table: $('setTable').value, accessKey: $('setAccessKey').value });
    var out = $('testResult');
    out.textContent = 'Testing…'; out.className = 'result';
    D.testConnection().then(function (r) {
      out.textContent = r.message; out.className = 'result ' + (r.ok ? 'ok' : 'err');
      renderSync();
    });
  });
  $('resetDemoBtn').addEventListener('click', function () {
    if (confirm('Reset all local data back to the demo inventory?')) {
      D.resetDemo(); selectedBin = null; selectedSupplier = null;
      renderHome(); renderSync(); toast('Demo data reset');
    }
  });

  /* ---------- init ---------- */
  initTheme();
  initNfcLive();
  initAddForm();
  renderHome();
  renderSync();
  refreshChrome();
  fitSticky();
  openFromUrl();
})();
