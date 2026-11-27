# One link for every phone — no Claude account, no sign-in

The app opens from a Google link and saves every entry to a Google Sheet owned by Datre.
You do this once (about 10 minutes). Everyone else only opens the link.

## You need
- A Google account for the company (the owner of the sheet).
- Two files: `Code.gs` and `app.html` (sent with this guide).

## Steps
1. **Sheet.** Go to sheets.google.com → Blank → name it *Inspection Data data*.
2. **Script.** In that sheet: Extensions → Apps Script. Delete the sample code, paste all of `Code.gs`, click Save.
3. **App file.** Open drive.google.com → New → File upload → choose `app.html`. Right-click the uploaded file → Share → *Copy link*. The link looks like `https://drive.google.com/file/d/`**`1AbC…xyz`**`/view`. Copy the long part in bold.
4. **Link the two.** Back in Apps Script, at the top of the code put that text between the quotes of `var APP_FILE_ID = '';` and Save.
5. **Publish.** Deploy → New deployment → gear icon → *Web app*.
   - Execute as: **Me**
   - Who has access: **Anyone**
   
   Click Deploy. Google asks you to authorise: choose your account → *Advanced* → *Go to … (unsafe)* → Allow. (It is your own script; the warning appears for every new script.)
6. **Copy the Web app URL** (starts with `https://script.google.com/macros/s/`). That is the link for everyone.

## For the members
Open the link in Chrome on Android → ⋮ menu → *Add to Home screen*. First time: type your name and choose your department. No sign-in.

## Updating the app later
In Drive, right-click `app.html` → *Manage versions* → *Upload new version* (the file id stays the same). Phones get the new version when they reopen the link. No re-deploy needed.

## Good to know
- Data is in the `db` sheet of your spreadsheet. Do not edit it by hand. Make a copy of the file now and then as a backup.
- Anyone who has the link can open the app and enter data, so share it only with your team.
- The first phone to open the app loads the starting data (PPC figures as on 12.11.26). Later PPC reports are added by uploading the PDF in the app.
- Phones need internet to share data. If the connection drops while saving, the app shows "Not saved"; enter it again when the signal is back.
