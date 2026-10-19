# SETUP — Going live with Electric Trailer

Going live takes about 10 minutes once AppSheet is unblocked.
Work through the steps in order.

The app runs in **Demo mode** until step 4 is done — safe to share the
link and try everything before then.

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

## Step 2 — Unblock and deploy the AppSheet app ⚠️ REQUIRED

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
| `Bin`    | Text    | e.g. `A1`…`D6` — drives the Bin Map    |
| `Supplier` | Text  | Must match the supplier name           |
| `Cost`   | Decimal / Price | Per-unit cost                  |
| `Icon`   | Text (optional) | Angular icon key, e.g. `bolt` — one of: `box`, `controller`, `plug`, `light`, `bolt`, `battery`, `solar`, `tire`, `axle`, `hub`, `link`, `chain`, `hook`, `kit`, `spring`, `diamond`, `fender`, `jack`, `alert`. Legacy emoji values still render (mapped automatically) |
| `NFC ID` | Text (optional) | Physical sticker serial, if you track them |

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
  finished; no front-end setting can bypass it.
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
