# Put the Maintenance Desk on Android phones

One-time setup takes about 10 minutes on a PC. After that each technician only
opens a link in Chrome and adds it to the home screen. It opens full screen like
an app. Every phone shares the same records, stored in a Google Sheet you own.

## A. One-time setup (maintenance manager or IT, on a PC)

1. Go to **sheets.new** while signed in with your `@datre.com` account. Name the
   sheet **Datre Maintenance Desk**.
2. In the sheet: **Extensions → Apps Script**.
3. In the editor, replace everything in `Code.gs` with the contents of
   [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
4. Click **＋ (Add a file) → HTML**, name it exactly **Index** and replace its
   contents with [`google-apps-script/Index.html`](google-apps-script/Index.html).
5. Click **Save** (disk icon).
6. Click **Deploy → New deployment → ⚙ Select type → Web app**.
   - Description: `Maintenance Desk`
   - Execute as: **Me**
   - Who has access: **Anyone within Datre Corporation Limited**
     (or **Anyone** if technicians do not have `@datre.com` Google accounts)
7. Click **Deploy**, approve the permission prompt (Advanced → Go to project → Allow),
   and copy the **Web app URL** (ends in `/exec`).
8. Send that URL to the team on WhatsApp.

The first time the link opens, it loads the open items from the PM checklist
and the September PO/WO list into the sheet.

## B. On each Android phone (30 seconds)

1. Tap the link. It opens in **Chrome**. Sign in with the Google account if asked.
2. Chrome menu **⋮ → Add to Home screen → Add**.
3. Open it from the new home-screen icon. At the top right, pick your own name.

That's it. The badge at the top shows **Google Sheet · synced hh:mm**. If the phone
loses network in the shop, it shows **Offline · n to send**. Keep working; entries
are sent automatically when the phone reconnects.

## C. In the Google Sheet

- **Data** tab: raw records used by the app. Do not edit by hand.
- Menu **Maintenance Desk → Refresh report tabs** builds readable **Breakdowns**,
  **Sourcing** and **Downtime** tabs (machine × month). Use **Turn on hourly
  report refresh** to keep them updated automatically. Download as Excel from
  File → Download.

## Updating the app later

Paste the new `Index.html` into the Apps Script editor, then
**Deploy → Manage deployments → ✏ Edit → Version: New version → Deploy**.
The link stays the same, and phones pick up the change the next time they open it.

## Other ways to open it

| Option | Shared data? | Needs |
|---|---|---|
| Google Apps Script link (above) | Yes, Google Sheet | Google account (Workspace or Gmail) |
| Claude artifact link | Yes, live | claude.ai access shared by the owner |
| `index.html` file copied to the phone | No, this phone only | Nothing. Open with Chrome via the Files app |

## QR poster for the shop floor

Open [`qr-poster.html`](qr-poster.html) in Chrome on a PC, paste the `/exec` link
and click **Download poster** (or **Print poster**). It makes an A4 poster with a
large QR code and first-time steps in English and Bengali. The QR code is made
inside the page; the link is not sent anywhere.
