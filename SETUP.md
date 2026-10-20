# SETUP — Going live with Electric Trailer

Going live takes about 10 minutes. There are **two ways** to connect a
live backend — pick one:

- **Option A (steps 2–4):** sync through the **AppSheet API**. Requires
  the AppSheet app to be deployed with API access on its plan.
- **Option B (right after step 1):** sync **directly to the Google
  Sheet** behind AppSheet, through a small script bridge. Skips
  AppSheet entirely — no API plan needed.

The app runs in **Demo mode** until a backend is connected — safe to
share the link and try everything before then. Steps 5 (columns) and 6
(NFC stickers) apply to both options.

---

## Step 1 — Turn on GitHub Pages

1. Open the repo: https://github.com/masstahl/electric-trailer
2. **Settings → Pages** (left sidebar, “Code and automation”).
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)** → **Save**.
5. Wait ~1 minute, refresh the Pages settings — it will show:
   **https://masstahl.github.io/electric-trailer/**
6. Open that link on your phone → browser menu → **Add to Home Screen**.
   It now behaves like an installed app and works offline.

## Option B — Connect the Google Sheet directly (no AppSheet)

The inventory data lives in a Google Sheet (AppSheet sits on top of
it). This option has the app talk to that sheet directly, through a
small **Apps Script bridge** installed in the sheet. No AppSheet API,
no deployment check, no plan requirement. If you use this option, skip
steps 2–4 and continue at step 5.

> **Before you start — this step needs a computer (steps 1–4).**
> Installing the bridge happens in the sheet's **Apps Script** editor,
> which Google only provides in a **desktop browser**, and only to
> people with **Editor** access to the sheet:
>
> - The Google Sheets **phone/tablet app does not have Apps Script at
>   all** — no menu, regardless of your permissions. Use a computer
>   (an iPad in Safari can work via **aA → Request Desktop Website**).
> - If the sheet opens as **“View only”**, you don't have Editor
>   access yet: ask the sheet's owner to share it to you as **Editor**,
>   or have the owner (or any Editor) do steps 1–4 and just hand you
>   the Web app link from step 4 — that's all the app needs.
> - Open the spreadsheet itself from Drive / sheets.google.com. The
>   preview inside AppSheet never shows the Extensions menu.
> - The menu lives in the top row: File · Edit · View · Insert ·
>   Format · Data · Tools · **Extensions** · Help. (On an older UI
>   it's **Tools → Script editor** — same destination.)

1. Open the inventory **Google Sheet** in a desktop browser.
2. **Extensions → Apps Script.** Delete any default code in the editor,
   then paste in the whole contents of **`apps-script.gs`** from this
   repo. Nothing in the code needs editing — unless the inventory tab
   is not the first tab in the sheet, in which case set **`SHEET_NAME`**
   near the top to that tab's exact name. Save the project.
3. **Deploy → New deployment.** Type: **Web app**.
   - **Execute as:** Me
   - **Who has access:** Anyone
   Click **Deploy**, approve the authorization prompts (the script
   needs permission to read/write its own spreadsheet — see the next
   section if Google warns you), and copy the **Web app URL** — it
   ends in `/exec`.
4. In the app on your phone: **Settings → Backend → Google Sheet**.
   Paste the link into **Sheet link**.
5. Tap **Connect**. Success reports how many rows the sheet returned —
   those rows are imported and the header badge switches to
   “Live · Google Sheet”. Quantity edits and new items now write
   straight back to the sheet.
6. Repeat steps 4–5 on each phone that needs live access (the link is
   saved per-device by design). Anyone who has the link can connect a
   device the same way.

### When Google says “this app isn't verified” / “isn't safe”

During step 3, Google shows a warning like **“Google hasn't verified
this app”** or **“this app may be unsafe.”** This is expected: Google
shows it for *every* personal Apps Script that hasn't gone through
Google's review process, which is normal for a script you just pasted
into your own sheet. It appears only during this one-time
authorization, not when using the app afterwards. To continue:

1. On the warning screen, click **Advanced** (bottom left).
2. Click **“Go to <your project name>”** (the link that appears).
3. Click **Allow**.

If instead you see **“This app is blocked”** and there is no Advanced
link, the browser is usually signed into several Google accounts at
once and Google refuses to authorize. Sign out of the other accounts
— or open a private/incognito window, sign in with only the sheet
owner's account, and redo the Deploy step there.

**About the link:** with no token (the default), anyone who has the
Web app link can read **and write** this inventory through the bridge.
That's fine as long as the link stays among the people using it —
treat it like a house key, not a public web page. The bridge script
runs as the sheet owner's Google account and only ever touches its
own spreadsheet. If the link ever needs to stop working, delete the
deployment (Apps Script → Deploy → Manage deployments) or re-deploy
for a fresh link. A shared-secret token is available if that ever
changes: set `TOKEN` in `apps-script.gs`, re-deploy, and add the same
value as `token` in the app's saved sheet config on each device — the
bridge then rejects requests that don't carry it.

Expected sheet columns are the same as step 5 (including the optional
**`Photo`** column — an image URL per item; the app shows it on the
item's plate when present, and falls back to the item's icon if the
image can't load).

**Folders (Categories home):** the app opens on a folders screen driven
by the optional **`Category`** column (step 5). Renaming a folder in
the app rewrites the `Category` value on every row in that folder —
the bridge applies it like any other field edit. Without a `Category`
column, the app derives each item's folder from its `Icon` and keeps
renames on the device only.

## Step 2 — Unblock and deploy the AppSheet app ⚠️ REQUIRED for Option A

The AppSheet app is currently **blocked in test mode (“plan upgrade
needed”)** — while it is, its API cannot be used at all, by any app.

App: https://www.appsheet.com/start/bd77482b-d437-4804-a3ef-fc2815feff2e
App ID: `bd77482b-d437-4804-a3ef-fc2815feff2e`

1. Sign in to https://www.appsheet.com with an account that can edit the app.
2. Open the app → **Manage → Deploy → Deployment Check → Run deployment
   check**, and fix anything it flags.
3. Deploy the app (Manage → Deploy). If it still says a plan upgrade is
   needed, the AppSheet account needs a plan that includes deployed apps
   and API access — that's an AppSheet account decision, not something the
   front-end can work around.
4. Leave the underlying Google Sheet as-is; it stays the source of truth.

## Step 3 — Get the AppSheet API Access Key

1. In AppSheet: **Manage → Integrations**.
2. Open **“IN: from cloud services to your app” → AppSheet API**.
3. Make sure the API is **enabled** for the app, and copy the
   **Application Access Key** (create one if none exists).
4. ⚠️ Treat the key like a password: **never** put it in GitHub, a text
   message thread you don't control, or a shared note. You will paste it
   only into the app on your own phone (step 4) — it is stored only in
   that phone's browser storage.

## Step 4 — Connect the app on your phone

1. Open Electric Trailer → **Sync** tab.
2. Check the fields:
   - **AppSheet App ID:** `bd77482b-d437-4804-a3ef-fc2815feff2e` (pre-filled)
   - **Table name:** `Inventory` by default — change it to the exact name
     of your inventory table in AppSheet if it's different.
   - **Access Key:** paste the key from step 3.
3. Tap **Save settings**, then **Test connection**.
   - Success: it reports how many rows AppSheet returned. You're live —
     the header badge switches to “Live · AppSheet”.
   - Failure: the message includes AppSheet's actual response. If it says
     the app is not deployed / plan upgrade needed, repeat step 2. If it
     says the table wasn't found, fix the table name (case-sensitive).
4. Repeat on each phone that needs live access (keys are per-device by
   design, so a lost phone doesn't mean changing the code or the repo).

The Categories (folders) home screen works the same with this option:
the optional **`Category`** column (step 5) names each item's folder,
and renaming a folder in the app sends an edit for every item in it,
so the new name lands in AppSheet too.

## Step 5 — Match your table's columns

The front-end expects these columns (names are what it sends/expects —
rename your AppSheet columns to match, or adjust the
mapping in `appsheet.js`):

| Column   | Type    | Notes                                  |
|----------|---------|----------------------------------------|
| `Id`     | Text (key) | Stable item id, e.g. `brake-controller` — also used in NFC sticker links |
| `Name`   | Text    | Display name                           |
| `SKU`    | Text    |                                        |
| `Qty`    | Number  | On-hand quantity                       |
| `Bin`    | Text    | e.g. `A1`…`D6` — shelf + position; drives the Shelf Map |
| `Level`  | Number  | `1`–`4` — shelf level (`1` = floor, `4` = top); with `Bin` it shows as e.g. `B · L4 · P5` |
| `Supplier` | Text  | Must match the supplier name           |
| `Cost`   | Decimal / Price | Per-unit cost                  |
| `Icon`   | Text (optional) | Angular icon key, e.g. `bolt` — one of: `box`, `controller`, `plug`, `light`, `bolt`, `battery`, `solar`, `tire`, `axle`, `hub`, `link`, `chain`, `hook`, `kit`, `spring`, `diamond`, `fender`, `jack`, `alert`. Legacy emoji values still render (mapped automatically) |
| `NFC ID` | Text (optional) | Physical sticker serial, if you track them |
| `Photo`  | Text (optional) | Image URL for the item — shown on the item's plate (grid card, item sheet, bin rows, count mode) when present; the icon shows if the image is empty or fails to load |
| `Category` | Text (optional) | Folder name for the Categories home screen, e.g. `Electrical`. Renaming a folder in the app rewrites this value on every item in the folder; removing a folder moves its items to `Uncategorized`. Without this column, the app derives folders from `Icon` and keeps renames on-device |

If your real columns have different names, either rename them in the
Sheet/AppSheet (simplest) or edit the `row` object in `flushQueue()` and
the demo data shape in `appsheet.js`.

## Step 6 — NFC stickers

See the **NFC sticker guide in README.md**. Short version: NTAG213/216
stickers, one per item/bin, each written with
`https://masstahl.github.io/electric-trailer/?item=ITEM_ID`.

**NFC Live (Android Chrome):** tap the **NFC chip in the app header** once
to turn on always-on listening while the app is open — after that, tapping
any sticker opens its item with no other presses. It pauses when the app
is backgrounded and resumes on the first touch after reopening (tap the
chip if it shows “Paused”). On iPhone there is no in-app listening (a
Safari limitation) — stickers open items directly through their URL
instead. Stickers are always written as URLs because the URL works on
both platforms, and the Android listener reads the URL records too.

## Troubleshooting

- **“Test connection” fails with a plan/deployment error** → step 2 isn't
  finished; no front-end setting can bypass it. (Or switch to Option B
  and connect the Google Sheet directly.)
- **Sheet mode says “Bad token”** → only possible when the optional
  `TOKEN` is set in `apps-script.gs`: the `token` in the app's saved
  sheet config must match it exactly, and the script must have been
  (re)deployed after the token was set.
- **Connect fails / the link opens a Google sign-in page** → the
  deployment's **Who has access** isn't set to **Anyone**. In Apps
  Script: Deploy → Manage deployments → edit → set it to **Anyone**
  and save (redeploy if asked).
- **App opens but shows demo items** → no Access Key saved on this device
  yet (Demo mode). Keys don't sync between phones on purpose.
- **Changes made offline didn't appear in AppSheet** → open the **Queue**
  tab and tap **Sync now** while online; the Settings tab shows the last
  error if AppSheet rejected anything.
- **NFC chip shows "Paused" on Android** → tap the chip (or tap anywhere in the app) to resume listening; NFC Live needs one tap to (re)start after the app is reopened.
- **Sticker tap opens the site but not the item** → the sticker URL must
  end with `?item=ITEM_ID` using the item's exact Id (copy it from the
  item card — don't type it by hand).
- **Start over locally** → Settings tab → **Reset demo data** (device only;
  doesn't touch AppSheet).
