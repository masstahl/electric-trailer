# Electric Trailer — Inventory PWA

Job-site electrical parts inventory, kept in a trailer: wire, breakers,
conduit, devices, boxes, lighting — the parts an electrician needs on
site, tracked from a phone. It is a fast, phone-first front-end over a
**Google Sheet**: the inventory lives in the spreadsheet and syncs to
the app through a small **Apps Script bridge** installed in the sheet
itself (see [`apps-script.gs`](apps-script.gs)). No server, no build
step — the app itself is static files on GitHub Pages.

**Live app:** https://masstahl.github.io/electric-trailer/

> **Connection status:** the live route is the Google Sheet bridge.
> Each phone connects once (Settings → Google Sheet → paste the Web app
> link → Connect); until then the app runs on local data only and
> starts empty. See **SETUP.md** for the one-time sheet setup.

On opening, the app lands on a **Categories home**: inventory folders
as tinted red-glass tiles on black glass. Folders are **renameable**
(long-press a folder, or use the Edit pill) — renaming a folder moves
its items with it. A **red glass + button** in the lower right opens a
small menu: **New Folder** or **New Item**. Items whose folder was
removed land in a system **Uncategorized** folder (never deleted),
shown only while it holds something.

The warehouse itself is modeled as **4 long shelves (A–D)**, each with
**Levels 1–4** (1 = floor, 4 = top) and **Positions 1–6** along the
shelf. Every item therefore has a full address — *Shelf · Level ·
Position*, written `B · L4 · P5` — and the Map screen draws each shelf
as an **elevation** (levels stacked vertically) so a phone shows
exactly where on the shelf a part lives. Opening an item and tapping
**Show on shelf** jumps to the map, scrolls that cell into view, and
**blinks** it.

Shelf/bin changes made in the app — including folder assignments,
which sync to a **Category** column — are written back to the sheet
through the bridge, so edits made on any connected device land in the
same spreadsheet.

---

## The 7 selected concepts

From the 25-concept mockup gallery, these were chosen and all are built:

| # | Concept | What shipped |
|---|---------|--------------|
| 02 | NFC Tap-to-Open | Item detail card per item; NFC sticker (or `?item=<id>` link) opens straight to it. **NFC Live** (Android Chrome, Web NFC): optional continuous scanning while the app is open — toggle in the header chip; pauses in the background, resumes on first touch. iPhones use the sticker URL (Safari has no Web NFC). |
| 03 | Warehouse / Bin Map | **Shelf elevation map**: 4 shelves × 4 levels × 6 positions; each cell shows a status glyph colored by its lowest-stock item, tap a cell for that spot's contents, plus a Count Mode for stocktakes. **Blink-on-search**: an item opened from search (or its "Show on shelf" button) pulses its map cell 3× and keeps a ring + caption until dismissed. |
| 08 | Photo-First Grid | **Categories home**: renameable red-glass folders on tinted black glass (tap to drill into that folder's photo grid, with an "All Items" escape row) + red glass **+** button (New Folder / New Item). White unclipped photo plates, icon fallback, quantity stepper + status pill on every card, tap-to-edit quantity keypad. Search and the LOW filter stay global across folders. |
| 16 | Offline-First Field Mode | Every quantity change is saved locally first and lands in a **sync queue** (Settings tab, with a pending-count badge on the tab). Works fully offline; auto-syncs when back online / app foregrounded (in Sheet mode). |
| 19 | Supplier Hub | A Suppliers tab that starts **empty** — no demo suppliers. Add your own (name + optional note), and any supplier named on an item (sheet import or Quick Add) appears here too, tagged "from items", with live item/unit counts. Tap a supplier to drill into its items with inline steppers. Removing a hand-added entry never touches items — a name items still carry stays on as a derived row. |
| 22 | Quick Add | Form for a new item: real part number / SKU field (pre-filled from a name duplicate check), **part-number lookup buttons** (Google / Google Images / Amazon, new tab), name, quantity, shelf + position **and level**, folder picker, supplier (free text, with suggestions from the Suppliers hub), cost, icon picker with auto-suggest from the name ("breaker" → panel icon, "outlet" → plug…), optional NFC tag id, and a **Write to NFC sticker** button on Android. |
| 24 | Sync Health | Settings screen: backend mode, row counts, pending queue count, last sync time, last error — plus the Google Sheet connection card. |

Layout follows the **SPEC PLATE** design system: safety orange marks
OUT/CRITICAL stock (brand red is for fills and identity only, never
stock status), status always carries a word label alongside color,
photos sit on white unclipped plates, and every quantity change raises
a 6-second **UNDO** toast. Quantity changes made close together stack
into **one** queued sync entry per item, and undoing back to the
original count removes the entry entirely — the sheet never sees
no-op writes.

A **Sorting Kit** helps file sheet rows that arrive with no category:
an **Auto-sort** banner on the folder home opens a review list that
proposes a folder per unfiled item from ordered keyword/phrase rules
over its name + part number (electrician vocabulary — "wire nut" →
Fasteners & Hardware, "smoke detector" → Lighting, "Romex" → Wire &
Cable), each row editable before one batch **Apply** (with batch
UNDO); **Sort mode** files one item at a time by tapping a folder
icon; and the item sheet carries a **folder rail** for one-tap moves.

Icons are a single **angular geometric set** drawn as inline SVG
(straight segments, clipped corners, `currentColor` so every theme
tints them) — items store an icon *key* (`bolt`, `battery`, `box`…),
and the picker offers the full key set. There are no emoji anywhere in
the app UI.

## Screens

Five tabs in the floating glass dock — **Home · Map · Suppliers ·
Add · Settings** — plus the item detail as a bottom sheet over Home,
and the bin sheet over the Map.

## Local mode vs Live mode

- **Local (default):** items live only in this device's browser
  storage. A fresh install starts **empty** — add items by hand or
  connect the sheet. Changes queue and "sync" locally; nothing leaves
  the device.
- **Live (Google Sheet):** Settings → Google Sheet → paste the Web app
  link from the sheet's Apps Script deployment → **Connect**. The app
  imports the sheet's rows (the sheet is the source of truth; pending
  local changes are protected), and **Sync now** pushes queued changes
  back through the bridge. The link (and token, if the script has one
  set) is stored **only in that device's browser** — each device
  connects once, separately.

## Themes

Seven looks in Settings → Appearance: **Milwaukee Red** (default —
red + black tool-case), Midnight Industrial, Clean Warehouse,
Electric, Hi-Vis Safety, Paper Minimal, Workshop Green. The choice
persists per device.

## Repo structure

| File | What it is |
|------|------------|
| `index.html` | The whole UI: all tab views + overlays (item sheet, bin sheet, count mode, qty editor), theme bootstrap |
| `styles.css` | Themes (CSS variables) + all layout: stat glass bar, floating glass dock, photo grid, shelf elevation map, sheets |
| `app.js` | Screen logic: folders home, search, map + blink-on-search, item/bin sheets, count mode, sync queue UI, NFC Live, Quick Add, settings |
| `appsheet.js` | Data layer (`window.ETData`): localStorage, sync queue + coalescing, folder model, backend dispatch. (Name kept from the app's first backend; the AppSheet API provider inside is dormant — the Sheet bridge is the live route.) |
| `sheets.js` | Google Sheet provider (`window.ETSheets`): bridge fetch/flush, row normalization |
| `apps-script.gs` | The Apps Script bridge to paste into the inventory Google Sheet (see SETUP.md) |
| `sw.js` | Service worker: caches the app shell for offline use (bump the cache name on every release) |
| `manifest.webmanifest` | PWA manifest (installable, standalone) |
| `SETUP.md` | One-time setup: publish the app, install the Sheet bridge, column reference, NFC stickers, troubleshooting |

## Quick start

1. Open https://masstahl.github.io/electric-trailer/ (or serve this
   folder with any static server).
2. Add to Home Screen for the full app feel.
3. Try it: add an item from the **+** tab, tap +/− on its card, watch
   the Settings tab badge count the queued change.
4. Follow **SETUP.md** to connect the Google Sheet for live data.

## Design

A professional design panel (brand, UX, visual, warehouse-ops and
accessibility reviewers) converged on one system — **SPEC PLATE** —
drawing on Milwaukee PACKOUT / DeWalt ToughSystem / Klein trade-tool
language rather than software-SaaS styling:

- **One job per color:** brand red (#DB011C) is identity and fills
  only. Stock status is **safety orange #FF5A00 = OUT/CRITICAL**,
  **amber = LOW**, green = OK — and color never works alone: every
  status carries a word label (OUT / CRITICAL / LOW / OK).
- **Thresholds:** qty 0 = OUT · 1–2 = CRITICAL · 3–5 = LOW · 6+ = OK.
- **Smoked glass** (~88% tint) on the dock and the home stat bar, so
  white text stays readable over any photo.
- **Glove-first controls:** 44px minimum touch targets, inline
  steppers everywhere a quantity appears, hold a stepper for ±5,
  tap the number for the numeric keypad.
- **Photos on white plates**, never clipped by the angular card cut;
  icon shows through automatically when a photo fails to load.
- The item sheet leads with a photo hero and a big **BIN chip** with
  the full `Shelf · Level · Position` address, and a sticky red
  **DONE** footer.
