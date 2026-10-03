# Datre Maintenance Desk

A single-file maintenance app for the Falta foundry. It needs no ChatGPT/Claude
and no installation. Open `index.html` in Chrome on a phone or PC.

## What it does

| Tab | Use |
|---|---|
| **Today** | Running / breakdown / watch counts, PM progress, downtime this month, alerts with a ✓ Ack tick |
| **Machines** | Status board for 23 machines (Running / Watch / Under PM / Idle). Each machine has Mechanical and Electrical **predictive-action drop-downs**: pick a symptom to get the recommended action, its urgency and the spare to check |
| **Breakdowns** | Report a breakdown (machine stopped) or a defect (still running). Status flow: Reported → Attending → Waiting for spares → Under trial → Closed. Root cause is required to close. Downtime is clocked from start to back in service |
| **Job Card** | Daily job card per technician, built from the PM checklist (daily, weekly and monthly checks for their trade). Tick OK / NOT OK / N/A. NOT OK raises an alert and a one-tap breakdown. Submit + supervisor verify |
| **PM Plan** | Month chart: machine × day, with weekly/monthly due days and done / missed / NOT OK colouring. Compliance % |
| **Spares** | 13 critical spares against minimum stock (low-stock alerts) and the full stores list (454 items, ₹35 L) with issue/receipt entry |
| **Sourcing** | Indent → Quotation → PO approved → Dispatched → Received, with vendor, PO no., ETA and overdue alerts |
| **Downtime** | Monthly machine-downtime tracker for the FY (machine × month table, chart against the FY23–26 average, availability %), copy as CSV |
| **Daily Update** | Ready-made daily report. Copy it, share on WhatsApp or open it in email |
| **Setup** | Team names and trades, shift hours, email list, backup / restore |

## Where the data lives

- **Android phones (recommended for the shop floor):** deploy as a Google Apps Script
  web app backed by a Google Sheet. See [ANDROID-SETUP.md](ANDROID-SETUP.md).
  Works offline and syncs when the phone reconnects.
- **Claude artifact:** the published Claude artifact link. Everyone it is
  shared with (Contributor access) works on the same live records.
- **Standalone (`index.html`):** records are saved in that browser only. Use
  *Setup → Export backup* weekly and *Import backup* to move data between devices.

## Sources built in

- PM Checklist Critical Equipment (DCL/MAINT/ID/25-26)
- Predictive Maintenance Mech/Elect Dashboard (Aug-2026): health index, failure drivers, critical spares
- Stores closing list "MNT ITEMS" (Main Godown, 02-Oct-2026)
- Maintenance PO/WO approval mails, Sep-2026 (opening sourcing list)
- Open items from the PM checklist summary (26-Sep-2026): Roll Over seal leak, Reclamation Tower air leak,
  Shot Blast impellers, EOT 2 MT LT motor rewinding

Technician names in Setup are placeholders. Replace them with the real team.
