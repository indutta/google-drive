# Plant Pulse — CEO mobile app (Android)

A phone-first app that shows, on one screen, how six plant areas are doing right now:
**Melting, Moulding, Heat Treatment, Quality Inspection, Maintenance, Raw Material Purchase.**

- Home: overall status, a "Needs your attention" list (worst first), and one tile per area.
- Tap an area for its KPIs against target, a 7-day trend, and the latest updates.
- Status uses an icon and a word as well as a colour. Light and dark themes. Works offline with the last saved data.
- It is a Progressive Web App, so it installs on Android like a normal app. No app store needed.

## Install on the CEO's Android phone
1. Host this folder over HTTPS (GitHub Pages, Netlify, or any web server). To try it locally: `python3 -m http.server 8000 --directory ceo-app`.
2. Open the address in Chrome on the phone.
3. Chrome menu (⋮) → **Add to Home screen** / **Install app**.

## The data
The numbers in `data.json` are **sample data**, and the app says so in a banner. They are not live plant readings.
To go live, serve a JSON feed with the same shape as `data.json` (from your ERP, MES, or a Google Sheet turned into JSON) and set
`"sample": false`. Paste its address in the app under **Settings → Data source address**, or change `DEFAULT_URL` in `index.html`.
The feed must allow cross-origin requests (CORS) if it lives on another domain. The app refreshes every 60 seconds while open.

Each area needs: `id`, `name`, `icon`, `status` (`good|warning|serious|critical`), `headline`, `kpis[]`, `trend`, `items[]`.
