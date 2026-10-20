# SETUP — Going live with Electric Trailer

Going live takes about 10 minutes. The inventory lives in a **Google
Sheet**; the app connects to it through a small **Apps Script bridge**
installed in the sheet itself — no server, no extra accounts. Follow
the four steps in order: publish the app, connect the Sheet, match
your columns, then do NFC stickers.

Connection details (the Sheet link, and a token if you use one) are
stored **only in each device's browser**. Nothing secret lives in this
repo or in the app code — which is why every phone connects once,
separately: a link pasted on one device does not appear on another.

---

## Step 1 — Publish the app (GitHub Pages)

The app is live at https://masstahl.github.io/electric-trailer/
(Settings → Pages → Deploy from branch `main`, folder `/ (root)`).

On a phone, open that link and **Add to Home Screen** — it installs
like a normal app and works offline.

Until the Sheet is connected (Step 2), the app runs on **local data
only and starts empty** — add items by hand, or just connect the
sheet first.

---

## Step 2 — Connect the Google Sheet (the live route)

The app talks straight to the spreadsheet through a small script that
lives *inside* the sheet (an Apps Script "bridge"), so live data
needs no other service. It takes about 5 minutes, needs to be done
once per spreadsheet, and then each phone pastes the resulting link
once.

> ⚠️ **Do this from a computer, in a desktop browser — not the
> phone.** Two hard limits: the Google Sheets **phone app has no Apps
> Script at all** (no Extensions → Apps Script menu — it simply isn't
> there), and the sheet must open with **Editor access**, not "View
> only" (Apps Script is hidden for viewers). On a computer with edit
> access, everything below is in the sheet's own menus.

1. Open your inventory **Google Sheet** (the spreadsheet behind the
   inventory). If you don't have Editor access, ask the owner to share
   it with you as an Editor first — or make your own copy (File → Make
   a copy) and work in the copy.
2. **Extensions → Apps Script.** A code editor opens with a stub
   `function myFunction()`. Delete the stub, then paste the **entire**
   contents of [`apps-script.gs`](apps-script.gs) from this repo.
   (Optional: set a `TOKEN` at the top — see "Token" below.) Save (💾).
3. **Deploy → New deployment → ⚙ → Web app**, with:
   - **Execute as:** Me
   - **Who has access:** Anyone
   Click **Deploy**.
4. Google asks you to authorize the script. Because this is your own
   unpublished script, Google shows its generic **"this app isn't
   verified"** warning — that screen is expected here:
   - Click **Advanced** at the bottom, then **Go to \<project name\>
     (unsafe)**.
   - On the permissions screen, click **Allow**.
   - ⚠️ Do this in a browser window signed into **only the sheet
     owner's Google account**. If several Google accounts are signed
     in, Google refuses with **"This app is blocked"** instead — open
     a private/incognito window, sign in with just the owner's
     account, and repeat Deploy there.
5. Copy the **Web app URL** — it ends in **`/exec`**. That is the
   **Sheet link** — the app will reject the spreadsheet's own link,
   so if it contains `docs.google.com/spreadsheets`, it's the wrong
   one; go back to Deploy and copy the Web app URL.
6. In the app: **Settings → Google Sheet** → paste the Sheet link
   (and the Token, if the script has one set) → **Connect**.
   A good connect **imports the sheet's rows immediately**, and Sync
   Health shows **Mode: Live · Google Sheet**. Repeat this paste on
   **each phone/tablet** that uses the app — links don't sync between
   devices.
7. **Sync now** on the Settings screen pushes queued changes back to
   the sheet (quantities, new items, folder assignments). In Sheet
   mode the app also **auto-syncs** when it comes back online or to
   the foreground. Edits in the sheet itself appear in the app the
   next time it opens or syncs.

**Updating the script later:** pasting new code into the editor does
**not** change the live Web app by itself — the deployment keeps
running the version it was created with. After changing the code:
**Deploy → Manage deployments → ✏️ Edit → Version: New version →
Deploy**. The `/exec` link stays the same.

**Token (security note):** the bridge ships with `const TOKEN = '';`
at the top of `apps-script.gs`. With it blank, **anyone who has the
`/exec` link can read and change the inventory through the bridge** —
the same trust model as a sheet shared by link, and the right fit
when the link stays among the people using the inventory. To require
a token instead, set `TOKEN` to a long random string in the script,
redeploy a **New version** (see above), and type the same token into
**Settings → Google Sheet → Token** on each device — the two must
match exactly, or the app answers "Bad token".

---

## Step 3 — Match your sheet's columns

The bridge maps columns **by header name** (trimmed,
case-insensitive), so column order doesn't matter and extra columns
are ignored. The inventory sheet's own headers are the ones the app
is built around:

| Column | Used for | Example |
|---|---|---|
| `Item ID` | Stable item id — rows are matched by this on every sync | `131` |
| `Description` | Display name (the human-readable name) | `3/4 PVC Coupling` |
| `Name` | Part code — shown as the small code line on the card, and written back when the app edits the row | `PVC CPL-3/4` |
| `Image` | Image URL for the item's photo (optional — see below) | (Drive link) |
| `Location` | Where it lives, free text — shown exactly as written (see "Locations" below) | `Shelf 59` |
| `Vendor` | Supplier name (free text, shown on the item) | `Amazon` |
| `Quantity` | Quantity on hand (numeric; blank reads as 0) | `14` |
| `Category` | Folder name (optional — blank rows land in Uncategorized, see below) | `Breakers & Panels` |

**Aliases:** older/generic headers are still understood, so a sheet
set up for an earlier version keeps working — `Id` (for `Item ID`),
`Qty` (for `Quantity`), `Bin` (for `Location`), `Supplier` (for
`Vendor`), `Photo` (for `Image`), plus optional `SKU` / `Part Number`,
`Level`, `Cost`, `Icon`, `NFC ID` and `Updated` columns (the bridge
stamps `Updated` on writes when the column exists).

A row with no `Description` uses its `Name` as the display name.
Edits made in the app write back to the same columns: quantity
changes post just `Quantity`; item edits post `Description`,
`Name`, `Quantity`, `Location`, `Vendor`, `Image`, `Category`,
`Icon` and `NFC ID` — and the bridge applies each by header name,
skipping any column the sheet doesn't have.

If your columns are named differently again, either rename the
headers in the sheet to match, or adjust the mapping in code: row
import and write-back translation both live in `sheets.js`
(`normalizeRow`, `pick()`, `toSheetFields`).

### Item photos

An **`Image`** column with an image URL renders that photo on the
item's card, detail sheet and bin rows (laid over the icon — if the
image fails to load, the icon simply shows through). Practical notes:

- Photos hotlinked from supplier websites may break over time
  (hotlink protection, moved images) — for photos that must last,
  upload them to Google Drive, set sharing to "anyone with the
  link", and use the Drive file link as the value.
- One photo per row. Leave the cell blank for icon-only items.

### Folders (categories)

The app's home screen organizes items into **folders**. A row's folder
comes from its **`Category`** value when the column exists. Rows with
no Category (or with the column missing entirely) open in an
**Uncategorized** system folder, and the app offers tools to file
them: **Auto-sort** (keyword suggestions you review and apply) and
**Sort mode** (tap a folder per item) on the folder home, plus a
folder picker on every item. Folder *names* live on each device (they
start from a built-in set: Wire & Cable, Conduit & Fittings, Breakers
& Panels, Boxes & Enclosures, Devices & Plates, Lighting, Fasteners &
Hardware, Tools & Supplies), so renaming a folder is a device-level
label; the Category values written back to the sheet are what the
sheet's other readers see. Renaming a folder in the app queues a
Category update for each of its items and pushes them on the next
sync. (Devices that still carry the older default folder names are
migrated to the electrician names automatically, once, on first
launch — items filed in them follow their folder.)

### Suppliers

The **Suppliers** tab starts empty. Add your own suppliers there
(name + optional note), and any supplier named in the sheet's
`Vendor` column — or typed in Quick Add — shows up in the tab too,
with live counts of that supplier's items. Hand-added entries can be
removed from the tab's Edit mode; items always keep their own
supplier name.

### Locations

The `Location` column is **free text** and the app shows it exactly
as written — `Shelf 59`, `EC42`, `Shelf 58 Kit_5`. One special case:
a value that is exactly a shelf letter **A–D** plus a position
**1–6** (like `B5`) is treated as a coded bin on the app's shelf map,
and displayed in the app's notation — short `B · L4 · P5`, long
`Shelf B · Level 4 · Position 5` — together with the item's level
(the `Level` column, 1 = floor … 4 = top, blank = 2). The Map screen
draws each shelf A–D as an elevation, levels stacked L4 (top) down
to L1. Free-text locations don't land in those cells; they stay
fully searchable and show verbatim on the item's card and sheet.

### Icon keys for the `Icon` column

Items store an icon *key* from the app's angular set: `box`,
`controller`, `plug`, `light`, `bolt`, `battery`, `solar`, `tire`,
`axle`, `hub`, `link`, `chain`, `hook`, `kit`, `spring`, `diamond`,
`hex`. Blank or unknown values fall back to `box`. (Legacy rows with
old emoji values in this column still render — the app maps them to
keys automatically.)

---

## Step 4 — NFC stickers (tap-to-open)

Works on iPhone and Android with ordinary NFC tags — no special app
needed, because the tag stores a plain URL.

**Tag choice:** NTAG213 (cheap, plenty for a URL) or NTAG216 (longer
URLs / bigger custom text). Stickers or cards both fine.

**Writing a tag:**

- **Android:** in the app, open **Quick Add**, fill in the item, then
  use **Write to NFC sticker** and hold the phone against the tag.
  (Or use any NFC writer app to write the URL below.)
- **iPhone:** install the free "NFC Tools" app (or similar). Write a
  URL record:
  `https://masstahl.github.io/electric-trailer/?item=<id>`
  where `<id>` is the item's Id in the sheet (e.g.
  `?item=breaker-20a`). Names for new items are turned into an id from
  the name when added (e.g. `20a-breaker`).

Then stick the tag on the item's bin. Tapping it with any phone opens
the app straight to that item.

---

## Troubleshooting

- **Settings says "Demo (local data)"** → no Sheet link saved in
  *this* browser yet (links are per-device). Step 2, item 6.
- **Connect says the link is wrong** → you pasted the spreadsheet's
  own link. The Sheet link is the **Web app URL** from Deploy and
  ends in `/exec` (Step 2, item 5).
- **"Google Sheet is not connected" when syncing** → same as above:
  the link isn't saved on this device, or storage was cleared.
- **"Bad token"** → the script has a TOKEN set but the app's Token
  field is blank or different (or the script was edited without
  redeploying a New version, so the live bridge still runs the old
  code). Make the two match, redeploy, reconnect.
- **App opens empty, or shows only items added by hand** → this
  device hasn't connected to the sheet yet (see above), or the
  import found no data rows — check the sheet has rows under the
  header row.
- **Items on the shelf map sit at the wrong height** → the `Level`
  column is blank for those rows (blank = level 2). Fill in 1–4 in
  the sheet, or set the level in Quick Add when adding.
- **Changes made in the app didn't appear in the sheet** → in Sheet
  mode changes push on **Sync now** (Settings), or automatically when
  the app comes back online / to the foreground. A change whose row
  can't be found in the sheet (for example a row with a blank
  `Item ID`) is reported honestly and stays queued — give the row a
  real `Item ID`
  in the sheet.
- **Deploy blocked: "Google hasn't verified this app" / "This app is
  blocked"** → that's the authorization step (Step 2, item 4):
  **Advanced → Go to project → Allow**, in a window signed into only
  the sheet owner's account.
- **No Extensions → Apps Script menu** → you're in the Sheets phone
  app or a "View only" copy. Use a desktop browser with Editor
  access (see the callout in Step 2).
- **NFC tap does nothing** → make sure the tag actually has the URL
  written (read it with NFC Tools to check), the phone has NFC on,
  and the tag is NTAG (MIFARE Classic tags don't work with iPhones).
- **App looks stale after an update** → the service worker caches the
  app shell; close and reopen the app (or remove and re-add the home
  screen icon) to pick up the new version.
- **Start over on one device** → clear the site's data in that
  browser (removes the link, token, local items and queue on that
  device only). The sheet itself is untouched.
