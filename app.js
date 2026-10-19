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
  var selectedSupplier = null;
  var selectedIcon = ICON_KEYS[0];

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '$' + Number(n || 0).toFixed(2); }
  function qtyClass(q) { return q <= 0 ? 'qty-out' : (q <= 2 ? 'qty-out' : (q <= 5 ? 'qty-low' : 'qty-ok')); }
  function qtyLabel(q) { return q <= 0 ? 'OUT OF STOCK' : q + ' in stock'; }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.add('hidden'); }, 2600);
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
    workshop:  { themeColor: '#1b4332' }
  };
  function savedTheme() {
    var t = 'electric';
    try { t = localStorage.getItem('et-theme') || 'electric'; } catch (e) { /* storage blocked */ }
    return THEMES[t] ? t : 'electric';
  }
  function markThemeCards(name) {
    document.querySelectorAll('[data-theme-pick]').forEach(function (card) {
      var on = card.getAttribute('data-theme-pick') === name;
      card.classList.toggle('sel', on);
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function applyTheme(name, save) {
    if (!THEMES[name]) name = 'electric';
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
    if (name === 'queue') renderQueue();
    if (name === 'sync') renderSync();
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
    var filtered = items.filter(function (i) {
      if (!q) return true;
      return (i.name + ' ' + i.sku + ' ' + i.bin + ' ' + i.supplier).toLowerCase().indexOf(q) !== -1;
    });
    $('photoGrid').innerHTML = filtered.map(function (i) {
      return '<div class="photo-card" data-open="' + esc(i.id) + '" role="button" tabindex="0">' +
        '<span class="pc-icon">' + iconFor(i) + '</span>' +
        '<div class="pc-name">' + esc(i.name) + '</div>' +
        '<div class="pc-bin">Bin ' + esc(i.bin) + ' · ' + esc(i.sku) + '</div>' +
        '<span class="qty-pill ' + qtyClass(i.qty) + '">' + qtyLabel(i.qty) + '</span></div>';
    }).join('');
    $('gridEmpty').classList.toggle('hidden', filtered.length > 0);
    $('photoGrid').querySelectorAll('[data-open]').forEach(function (card) {
      card.addEventListener('click', function () { openItem(card.getAttribute('data-open')); });
    });
    refreshChrome();
  }
  $('searchInput').addEventListener('input', renderHome);

  /* ---------- #02 NFC Tap-to-Open Item Card ---------- */
  function openItem(id) {
    var item = D.getItem(id);
    if (!item) { toast('Item not found: ' + id); return; }
    currentItemId = id;
    $('dIcon').innerHTML = iconFor(item);
    $('dName').textContent = item.name;
    $('dMeta').textContent = item.sku + ' · Bin ' + item.bin + ' · ' + item.supplier;
    $('dQty').textContent = item.qty;
    $('dCost').textContent = money(item.cost) + ' each';
    $('dUpdated').textContent = 'Last updated ' + fmtTime(item.updated);
    $('dStickerLink').value = D.stickerUrl(item.id);
    $('nfcMsg').textContent = ''; $('nfcMsg').className = 'result';
    $('itemOverlay').classList.remove('hidden');
  }
  function closeItem() { $('itemOverlay').classList.add('hidden'); currentItemId = null; renderHome(); }
  $('closeDetail').addEventListener('click', closeItem);
  $('itemOverlay').addEventListener('click', function (e) { if (e.target === $('itemOverlay')) closeItem(); });

  function bump(delta) {
    if (!currentItemId) return;
    var item = D.updateQty(currentItemId, delta);
    if (item) {
      $('dQty').textContent = item.qty;
      $('dCost').textContent = money(item.cost) + ' each';
      $('dUpdated').textContent = 'Last updated ' + fmtTime(item.updated) + (navigator.onLine ? '' : ' · queued (offline)');
      toast(item.name + ' → ' + item.qty + (navigator.onLine ? '' : ' (queued)'));
      refreshChrome();
    }
  }
  $('qtyPlus').addEventListener('click', function () { bump(1); });
  $('qtyMinus').addEventListener('click', function () { bump(-1); });
  $('qtyPlus5').addEventListener('click', function () { bump(5); });
  $('qtyMinus5').addEventListener('click', function () { bump(-5); });

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
    openItem(item.id);
    toast('NFC · ' + item.name);
    return 'opened';
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
      nfcLiveActive = true; nfcLivePaused = false; renderNfcChip();
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
    renderNfcChip();
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
      nfcLiveActive = false; nfcLivePaused = true; renderNfcChip();
    } else {
      // Try an immediate restart; if Chrome refuses without a gesture,
      // the next touch anywhere re-arms it.
      startNfcLive().then(function (ok) { if (!ok) armNfcOnFirstTouch(); });
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

  /* Item detail: the old one-shot Scan button now just turns NFC Live on —
   * the same shared handleTag() opens whatever sticker is presented. */
  $('scanNfcBtn').addEventListener('click', function () {
    var msg = $('nfcMsg');
    if (!NFC_SUPPORTED) {
      msg.className = 'result';
      msg.textContent = 'Web NFC scanning needs Chrome on Android. On iPhone, close this and just tap the sticker to the top of the phone — it opens this item automatically.';
      return;
    }
    msg.textContent = 'Turning NFC Live on — hold any sticker near the back of the phone…';
    startNfcLive().then(function (ok) {
      msg.textContent = ok
        ? 'NFC Live is on — every sticker tap now opens its item while the app is open.'
        : 'NFC could not start yet. Tap the NFC chip in the header, allow the permission, then tap a sticker.';
    });
  });

  /* Sticker taps: ?item=<id> opens that item directly on load. */
  function openFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('item');
    if (id) openItem(id);
  }

  /* ---------- #03 Warehouse / Bin Map ---------- */
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
        var cls = list.length === 0 || total === 0 ? 'bin-out' : (total <= 5 ? 'bin-low' : 'bin-ok');
        cells += '<button class="bin-cell ' + cls + (selectedBin === bin ? ' sel' : '') + '" data-bin="' + bin + '">' +
          '<strong>' + bin + '</strong><small>' + list.length + ' items · ' + total + ' units</small></button>';
      }
      return '<div><div class="aisle-label">AISLE ' + a + '</div><div class="bin-row">' + cells + '</div></div>';
    }).join('');
    $('binMap').querySelectorAll('[data-bin]').forEach(function (c) {
      c.addEventListener('click', function () { selectedBin = c.getAttribute('data-bin'); renderMap(); });
    });
    if (selectedBin) {
      var inBin = (byBin[selectedBin] || []);
      $('binListTitle').textContent = 'Bin ' + selectedBin + ' — ' + inBin.length + ' item(s)';
      $('binList').innerHTML = inBin.length ? inBin.map(itemRow).join('') : '<p class="muted">Nothing stored in this bin yet.</p>';
      bindItemRows($('binList'));
    } else {
      $('binListTitle').textContent = 'Select a bin';
      $('binList').innerHTML = '';
    }
  }
  function itemRow(i) {
    return '<button class="list-item" data-open="' + esc(i.id) + '"><span class="li-icon">' + iconFor(i) + '</span>' +
      '<span class="li-main"><span class="li-name">' + esc(i.name) + '</span><br><span class="li-sub">Bin ' + esc(i.bin) + ' · ' + esc(i.sku) + ' · ' + money(i.cost) + '</span></span>' +
      '<span class="li-qty">' + i.qty + '</span></button>';
  }
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
  function initAddForm() {
    $('addBin').innerHTML = BINS.map(function (b) { return '<option>' + b + '</option>'; }).join('');
    $('addSupplier').innerHTML = D.getSuppliers().map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('');
    $('iconPicker').innerHTML = ICON_KEYS.map(function (key, idx) {
      return '<button type="button" class="icon-choice' + (idx === 0 ? ' sel' : '') + '" data-icon="' + key + '" aria-label="' + key + '">' + svgIcon(key) + '</button>';
    }).join('');
    $('iconPicker').querySelectorAll('[data-icon]').forEach(function (b) {
      b.addEventListener('click', function () {
        selectedIcon = b.getAttribute('data-icon');
        $('iconPicker').querySelectorAll('.icon-choice').forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
      });
    });
  }
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var item = D.addItem({
      name: $('addName').value.trim(),
      qty: $('addQty').value, cost: $('addCost').value,
      bin: $('addBin').value, supplier: $('addSupplier').value, icon: selectedIcon
    });
    $('addForm').classList.add('hidden');
    $('addSuccess').classList.remove('hidden');
    $('addSuccessText').textContent = item.name + ' — ' + item.qty + ' in Bin ' + item.bin + '. Stick an NFC sticker on the bin/item and write this link to it:';
    $('addStickerLink').value = D.stickerUrl(item.id);
    $('addWriteNfcBtn').classList.toggle('hidden', !('NDEFReader' in window));
    $('addWriteNfcBtn').onclick = function () { writeSticker(D.stickerUrl(item.id)); };
    refreshChrome();
    toast('Added ' + item.name);
  });
  $('addCopyBtn').addEventListener('click', function () { copyText($('addStickerLink'), 'Sticker link copied'); });
  $('addAnotherBtn').addEventListener('click', function () {
    $('addSuccess').classList.add('hidden');
    $('addForm').classList.remove('hidden');
    $('addForm').reset(); $('addQty').value = 1;
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
  window.addEventListener('online', function () { refreshChrome(); renderQueue(); toast('Back online'); });
  window.addEventListener('offline', function () { refreshChrome(); renderQueue(); toast('Offline — changes will queue'); });

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
  openFromUrl();
})();
