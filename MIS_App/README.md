# Datre MIS (Android app)

An installable web app (PWA) for the Datre MIS dashboard. It runs full screen from the phone's home screen and works offline once opened.

## Install on an Android phone
1. Put this folder on any HTTPS web host (GitHub Pages, Netlify, an office web server). Chrome only offers "Install app" over HTTPS.
2. Open `index.html` in Chrome on the phone.
3. Tap the menu (three dots), then **Install app** (or **Add to Home screen**).

For a quick look without hosting, open `Datre_MIS_standalone.html` (one file, no install, no offline mode).

## What is inside
- Home: headline figures vs last year, net sales and PBT by month
- Trends: contribution to PBT bridge, production and despatch
- Customers: contribution by customer and by month
- P&L: full month-by-month MIS
- Checks: cost sheet cross-check and items to confirm with HO Accounts
- Filters: Period, Customer, From and To month (all dropdowns). Choices are remembered on the phone.

## Updating each month
The figures are in `data.js` (a snapshot of the September 2026 MIS). Replace it with a new export from the MIS workbook, then raise the version in `sw.js` (`datre-mis-v2` to `v3`) so phones pick up the change.

## Native APK
Not built: the build environment has no Android SDK. This folder can be wrapped as an APK (for example with Bubblewrap/TWA) once it is hosted over HTTPS.
