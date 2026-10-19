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
  var ICONS = ['📦', '🔌', '💡', '🛞', '⚙️', '🔗', '🔋', '☀️', '⚡', '🪝', '🧰', '🚨'];
  var currentItemId = null;
  var selectedBin = null;
  var selectedSupplier = null;
  var selectedIcon = ICONS[0];

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
    var totalValue = items.reduce(function (s, i) { return s + i.qty * i.cost; }, 0);
    var low = items.filter(function (i) { return i.qty <= 5; }).length;
    $('statItems').textContent = items.length;
    $('statUnits').textContent = totalUnits;
    $('statValue').textContent = money(totalValue).replace('.00', '');
    $('statLow').textContent = low;
    var filtered = items.filter(function (i) {
      if (!q) return true;
      return (i.name + ' ' + i.sku + ' ' + i.bin + ' ' + i.supplier).toLowerCase().indexOf(q) !== -1;
    });
    $('photoGrid').innerHTML = filtered.map(function (i) {
      return '<div class="photo-card" data-open="' + esc(i.id) + '" role="button" tabindex="0">' +
        '<span class="pc-icon">' + esc(i.icon) + '</span>' +
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
    $('dIcon').textContent = item.icon;
    $('dName').textContent = item.name;
    $('dMeta').textContent = item.sku + ' · Bin ' + item.bin + ' · ' + item.supplier;
    $('dQty').textContent = item.qty;
    $('dCost').textContent = money(item.cost) + ' each · ' + money(item.cost * item.qty) + ' on hand';
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
      $('dCost').textContent = money(item.cost) + ' each · ' + money(item.cost * item.qty) + ' on hand';
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

  /* Web NFC: read a sticker (Android Chrome) — falls back gracefully. */
  $('scanNfcBtn').addEventListener('click', function () {
    var msg = $('nfcMsg');
    if (!('NDEFReader' in window)) {
      msg.className = 'result';
      msg.textContent = 'Web NFC scanning needs Chrome on Android. On iPhone, close this and just tap the sticker to the top of the phone — it opens this item automatically.';
      return;
    }
    msg.textContent = 'Hold a sticker near the back of the phone…';
    try {
      var reader = new NDEFReader();
      reader.scan().then(function () {
        reader.onreading = function (ev) {
          var opened = false;
          for (var i = 0; i < ev.message.records.length && !opened; i++) {
            var rec = ev.message.records[i];
            if (rec.recordType === 'url' && rec.data) {
              try {
                var url = new TextDecoder().decode(rec.data);
                var m = url.match(/[?&]item=([^&]+)/);
                if (m) { openItem(decodeURIComponent(m[1])); opened = true; }
              } catch (e) { /* ignore undecodable record */ }
            }
          }
          if (!opened) {
            var rawId = ev.serialNumber ? ev.serialNumber.replace(/:/g, '') : '';
            var items = D.getItems();
            var byNfc = items.filter(function (it) { return it.nfcId && it.nfcId === rawId; })[0];
            if (byNfc) openItem(byNfc.id);
            else { msg.textContent = 'Sticker read, but it is not linked to an item yet. Open the item and use its sticker link.'; }
          }
        };
        reader.onreadingerror = function () { msg.textContent = 'Could not read that sticker — try again.'; };
      }).catch(function (err) { msg.textContent = 'NFC scan failed: ' + err.message; });
    } catch (e) {
      msg.textContent = 'NFC is not available on this device/browser.';
    }
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
    return '<button class="list-item" data-open="' + esc(i.id) + '"><span class="li-icon">' + esc(i.icon) + '</span>' +
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
      var value = mine.reduce(function (sum, i) { return sum + i.qty * i.cost; }, 0);
      return '<button class="list-item" data-supplier="' + esc(s.name) + '"><span class="li-icon">🏭</span>' +
        '<span class="li-main"><span class="li-name">' + esc(s.name) + '</span><br>' +
        '<span class="li-sub">' + mine.length + ' items · ' + money(value).replace('.00', '') + ' stock · lead ' + esc(s.leadTime) + '<br>' +
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
    $('iconPicker').innerHTML = ICONS.map(function (ic, idx) {
      return '<button type="button" class="icon-choice' + (idx === 0 ? ' sel' : '') + '" data-icon="' + ic + '">' + ic + '</button>';
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
    $('addSuccessText').textContent = item.icon + ' ' + item.name + ' — ' + item.qty + ' in Bin ' + item.bin + '. Stick an NFC sticker on the bin/item and write this link to it:';
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
        .then(function () { toast('Sticker written ✅ Hold it near the phone to test.'); })
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
      return '<div class="list-item queue-item' + (c.synced ? ' synced' : '') + '"><span class="li-icon">' + (c.synced ? '✅' : '⏳') + '</span>' +
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
  initAddForm();
  renderHome();
  renderSync();
  refreshChrome();
  openFromUrl();
})();
