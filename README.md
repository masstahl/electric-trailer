# Electric Trailer — Inventory

A fast, good-looking front-end for an inventory sheet that lives in
**AppSheet / Google Sheets**. Instead of replacing AppSheet, this app keeps
it as the backend (the source of truth) and puts a fast, phone-first
Progressive Web App (PWA) in front of it — hosted free from this GitHub
repo with GitHub Pages. NFC stickers on bins and items let you tap a
sticker with a phone and land directly on that item.

**Live site (after Pages is enabled — see SETUP.md):**
https://masstahl.github.io/electric-trailer/

- No build step, no framework. Plain HTML/CSS/JS.
- No external assets (system fonts), service-worker cached — it opens
  instantly and works offline.
- Ships in **Demo mode** with sample trailer-parts data so it can be tried
  immediately; switch to **Live mode** by entering an AppSheet Access Key
  in the Settings tab (stored only on that device, never in this repo).

> ⚠️ **Current AppSheet status:** the linked AppSheet app
> (`bd77482b-d437-4804-a3ef-fc2815feff2e`) is in **test mode and blocked**
> (“plan upgrade needed”), so its real tables cannot be read yet. Live sync
> will fail until a deployment check is run in AppSheet and
> the account plan enables the API. Step-by-step fix: **SETUP.md**.

## Appearance

7 switchable looks, applied instantly and saved per device. Switch in the
**Settings** tab → **Appearance** (Milwaukee Red and Hi-Vis Safety are
grouped first as the working modes; the rest sit under “More looks”):

| Theme | Feel |
|---|---|
| **Midnight Industrial** | Dark slate header, amber accent — the original look |
| **Clean Warehouse** | Light theme, white cards, grey-blue background, royal blue accent |
| **Electric** | Very dark navy, electric blue + violet accents, subtle glows, gradient header |
| **Milwaukee Red** (default) | Milwaukee red (#DB011C) + black tool-case body, red gradient header, white type |
| **Hi-Vis Safety** | Black, safety yellow, extra-bold type, highest contrast, thicker borders |
| **Paper Minimal** | Warm off-white, cream cards, charcoal text, flat — no shadows, muted terracotta accent |
| **Workshop Green** | Deep green + cream, warm cards |

**Icons:** all iconography is a Cybertruck-style angular system — flat
geometric inline-SVG line icons built from straight segments with clipped /
chamfered corners, stroked in `currentColor` so every theme tints them. No
emoji anywhere in the UI. Items store an icon **key** (e.g. `bolt`, `tire`,
`battery`, `box`); older inventories saved with emoji values are mapped to
the matching key automatically at render time, so nothing needs migrating.

## Design — SPEC PLATE

Locations are Shelf × Level × Position: the sheet's `Bin` column carries
shelf + position (`B5`); a `Level` column (1 = floor … 4 = top) carries the
height. One notation everywhere — short `B · L4 · P5`, long
`Shelf B · Level 4 · Position 5`. Blink-on-search: the located cell pulses
3× in the accent color, then a solid ring and a caption hold it until
dismissed; reduced-motion devices get the solid outline immediately.

The current design pass ("SPEC PLATE") follows one rule: **one job per
color, always paired with a word.**

- **Brand red (#DB011C) is for fills and brand only** — header, the Add
  disc, one primary call-to-action per screen. It is never a status.
- **Status scale:** 0 = **OUT** and 1–2 = **CRITICAL** use safety orange
  (#FF5A00); 3–5 = **LOW** uses amber; 6+ = **OK** stays quiet (no pill).
  Quantity steppers are neutral charcoal everywhere — the numeral and the
  status word carry the state, not the buttons.
- **Smoked glass:** the floating dock and the Home stat/filter bar are the
  only glass surfaces, tinted ~88% (blur 30px + sheen kept) so labels stay
  readable over scrolling photos. After hands-on testing, the dock is
  sized at 4/5 (21px icons, .75rem labels, 26px corners) — its tint is
  unchanged. Home cards are slightly shorter, and tapping a quantity
  numeral opens a shared numeric-keypad editor.
- Search + stat bar form one sticky glass block; tapping **low / out**
  filters the grid to low stock, worst first.
- Every quantity change — card steppers, item sheet, bin sheet, Count
  Mode — offers a 6-second **UNDO**. Repeat edits to one item coalesce
  into a single queued change (and vanish if the count returns to where
  it started); the queue also auto-flushes when the app reconnects or
  returns to the foreground in Live mode.

## The screens

Bottom dock (5 tabs): **Home · Map · Suppliers · Add · Settings**, plus
item / bin / count sheets that open over the current tab.

| # | Screen | What it does |
|---|--------|--------------|
| 08 | **Photo-First Grid** (Home) | Big photo/icon cards instead of spreadsheet rows — 3 across, photo on an unclipped white plate, location code (`B · L4 · P5`), status pill with a word (OUT / CRITICAL · n / LOW · n), and an inline − qty + stepper strip on every card. Live search; tap **low / out** in the glass stat bar to filter to low stock. Tap a card to open the item. |
| 02 | **NFC Tap-to-Open Item Card** | Item sheet leading with a big white photo plate, a loud location chip (`B · L4 · P5`), a **Show on shelf** button (jumps to the Shelf Map and blinks the item's cell), and a sticky Done footer. Giant neutral + / − steppers; ±5 is **hold-to-apply** (400ms) so a gloved slip can't 5× an edit; tap the quantity numeral for an exact-count entry. Sticker taps via `?item=<id>` — or NFC Live — open the item directly. Includes a copyable sticker link. |
| 03 | **Warehouse / Shelf Map** | Concept D elevation: each shelf drawn as a long elevation — levels 4 (top) → 1 (floor) × positions 1–6. Each cell shows its position and total units, colored by its **worst** item (with a ▲/✕ glyph, never color alone). Tap a cell to open its location sheet: items with inline steppers, **Count this location** (Count Mode), and **Add item here** (shelf, position and level pre-filled). **Show on shelf** from any item jumps here and blinks that item's cell. |
| 16 | **Offline-First Field Mode** (Settings → Sync Queue) | Online/offline status, a pending-changes queue in localStorage, and “Sync now”. Every edit made offline queues instead of failing; qty edits coalesce per item, and the queue auto-flushes on reconnect/foreground when connected to a live backend. |
| 19 | **Supplier Hub** | Supplier cards with item count, lead time, and contact. Tap a supplier to list its items. |
| 22 | **Quick Add New Item** | Fast form (name, qty, bin, supplier, cost, photo-icon picker). The icon auto-assigns from the name (tire, light, battery, axle…) unless a category is picked manually. A duplicate name offers **“Receive this instead”** instead of creating a twin. On save it shows the new item's NFC sticker link, a copy button, a Web NFC “write to sticker” button where supported, and iPhone NFC Tools instructions. |
| 24 | **AppSheet Sync Health & Settings** | Demo/Live mode, last sync, row count, pending queue count, last error, and the AppSheet connection settings with a real “Test connection” (AppSheet `Find` action). |
| — | **Count Mode** | From a bin sheet: walk the bin one item at a time with a giant quantity and − / +. Counts that differ from the system by >20% or >10 units get a variance review before anything is applied. |

## Demo mode vs Live mode

- **Demo mode (default):** 18 sample trailer-parts items and 5 suppliers
  are stored in the phone/browser's `localStorage`. Everything works,
  including offline queueing; “Sync now” marks queued changes synced
  locally with timestamps.
- **Live mode:** open the **Sync** tab, confirm the App ID and table name,
  paste the AppSheet **Access Key**, save, then **Test connection**. The
  key is stored **only in that device's localStorage** — never in code,
  never in this repo. In Live mode the sync queue flushes to the AppSheet
  API (`Add`/`Edit` actions) and connection tests run a real `Find`.
- **Google Sheet mode (alternative):** in **Settings → Backend**, choose
  **Google Sheet** to sync straight to the backend spreadsheet through a
  small Apps Script bridge (`apps-script.gs`) — rows are pulled into the
  app and queued edits write back to the sheet, with no AppSheet API
  access needed. Setup: **SETUP.md, Option B**.

Expected table columns (rename/map in AppSheet — see SETUP.md):
`Id, Name, SKU, Qty, Bin, Level, Supplier, Cost` (plus optional `Icon`, `NFC ID`, `Photo`).

## NFC sticker guide

1. **Buy stickers:** NTAG213 or NTAG216 stickers (NTAG215 also fine).
   Avoid MIFARE Classic. A roll of 50 NTAG213s is inexpensive.
2. **One sticker per item type or per bin.** Each sticker stores one URL:
   `https://masstahl.github.io/electric-trailer/?item=ITEM_ID`
   (open the item in the app → the detail card shows its exact link).
3. **Write the URL:**
   - **Android (Chrome):** open the item → “Write to sticker (Web NFC)” in
     Quick Add, or use NFC Tools → Write → URL.
   - **iPhone:** use the free **NFC Tools** app → Write → Add a record →
     URL/URI → paste the link → Write → hold the sticker to the top edge
     of the phone.
4. **Use it:** tap the phone to the sticker. iPhone and Android both open
   the link with no app install, and the item card opens ready to + / −.
5. **NFC Live (Android Chrome):** with the app open, tap the **NFC chip in
   the header** once to turn on always-on listening (“NFC · Live”, with a
   pulsing dot). From then on, every sticker tap opens its item without
   pressing anything else — the warehouse flow: app open, walk, tap, see
   the item. It pauses while the app is in the background and resumes on
   the first touch after the app is reopened (if the chip shows
   “Paused — tap”, tap it). Turn it off by tapping the chip while it is
   live. While NFC Live is on, a screen Wake Lock is held so the scanner
   doesn't die when the phone would otherwise sleep mid-session.
   **iPhone:** there is no in-app listening — Safari does not support Web
   NFC. That is fine: iOS itself reads the sticker's URL in the
   background and opens the item directly, no listening needed. This is
   why stickers are always written as URLs — the URL works on both
   platforms, and the Android listener reads those URL records too.
5. Stickers are just URLs — if the site address ever changes, re-write the
   stickers (or put a redirect at the old address).

## Repo structure

```
electric-trailer/
├── index.html            # All 6 tab views + item detail overlay
├── styles.css            # Mobile-first styling, bottom tab bar
├── app.js                # Screen logic, NFC, queue UI
├── appsheet.js           # Data layer: demo data, localStorage, queue, backend dispatch
├── sheets.js             # Google Sheet provider (Apps Script bridge)
├── apps-script.gs        # Bridge script to paste into the sheet (SETUP Option B)
├── sw.js                 # Service worker — caches the app shell for offline use
├── manifest.webmanifest  # PWA manifest (installable, “Add to Home Screen”)
├── README.md             # This file
└── SETUP.md              # Step-by-step setup for going live
```

## Quick start

1. Enable GitHub Pages (SETUP.md, step 1) and open the site on a phone.
2. “Add to Home Screen” to install it like an app.
3. Try it in Demo mode: search, tap an item, + / − the quantity, go
   offline (airplane mode) and watch changes land in Settings → Sync Queue.
4. When AppSheet is unblocked and deployed, follow SETUP.md to go live.
