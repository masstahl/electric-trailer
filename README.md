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
  in the Sync tab (stored only on that device, never in this repo).

> ⚠️ **Current AppSheet status:** the linked AppSheet app
> (`bd77482b-d437-4804-a3ef-fc2815feff2e`) is in **test mode and blocked**
> (“plan upgrade needed”), so its real tables cannot be read yet. Live sync
> will fail until a deployment check is run in AppSheet and
> the account plan enables the API. Step-by-step fix: **SETUP.md**.

## Appearance

7 switchable looks, applied instantly and saved per device. Switch in the
**Sync** tab → **Appearance**:

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

## The 7 screens

Bottom tab bar: **Home · Map · Suppliers · Add · Queue · Sync**

| # | Screen | What it does |
|---|--------|--------------|
| 08 | **Photo-First Grid** (Home) | Big photo/icon cards instead of spreadsheet rows. Name, bin, and a color-coded quantity pill (green OK, amber ≤5, red ≤2 / out). Live search filters instantly. Tap a card to open the item. |
| 02 | **NFC Tap-to-Open Item Card** | Item detail with giant + / − buttons (gloved-hands friendly, plus ±5), qty, bin, supplier, cost, SKU. “Scan NFC” uses Web NFC where available; sticker taps via `?item=<id>` open the item directly. Includes a copyable sticker link. |
| 03 | **Warehouse / Bin Map** | Aisles A–D × bins 1–6 as a visual grid. Each bin shows item count and total units, colored by stock level. Tap a bin to list its items. |
| 16 | **Offline-First Field Mode** (Queue tab) | Online/offline status, a pending-changes queue in localStorage, and “Sync now”. Every edit made offline queues instead of failing and flushes through the data layer when back online. |
| 19 | **Supplier Hub** | Supplier cards with item count, lead time, and contact. Tap a supplier to list its items. |
| 22 | **Quick Add New Item** | Fast form (name, qty, bin, supplier, cost, photo-icon picker). On save it shows the new item's NFC sticker link, a copy button, a Web NFC “write to sticker” button where supported, and iPhone NFC Tools instructions. |
| 24 | **AppSheet Sync Health & Settings** | Demo/Live mode, last sync, row count, pending queue count, last error, and the AppSheet connection settings with a real “Test connection” (AppSheet `Find` action). |

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

Expected table columns (rename/map in AppSheet — see SETUP.md):
`Id, Name, SKU, Qty, Bin, Supplier, Cost` (plus optional `Icon`, `NFC ID`).

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
   live. The “Scan NFC sticker” button in an item card also turns NFC
   Live on.
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
├── appsheet.js           # Data layer: demo data, localStorage, queue, AppSheet API
├── sw.js                 # Service worker — caches the app shell for offline use
├── manifest.webmanifest  # PWA manifest (installable, “Add to Home Screen”)
├── README.md             # This file
└── SETUP.md              # Step-by-step setup for going live
```

## Quick start

1. Enable GitHub Pages (SETUP.md, step 1) and open the site on a phone.
2. “Add to Home Screen” to install it like an app.
3. Try it in Demo mode: search, tap an item, + / − the quantity, go
   offline (airplane mode) and watch changes land in the Queue tab.
4. When AppSheet is unblocked and deployed, follow SETUP.md to go live.
