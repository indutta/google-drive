# DCL Quality Inspection – casting process

Offline-first web app that follows **each individual casting** (serial number) through the 10-stage inspection
flow in `source/INS_Inspection_Flow.xlsx` (Datre Corporation Limited). No build step, no server:
open `index.html` in a browser. Data is kept in the browser (localStorage); use **Settings → Backup** to move or save it.

## How it works
| Level | Stages recorded here | Why |
|---|---|---|
| Work order (job) | 1 Pattern & core box | done once per pattern; PO/QAP switches choose which of 7.x, 8.x, 9.1 apply |
| Sand & calibration log (date + shift) | 2 Sand, calibration, mix tests | shared by all moulds made that shift; due/overdue tracking (daily / weekly / 3-monthly) |
| Heat | 4 Melting & pouring, 8 Mechanical tests | chemistry, tapping/pouring temperature, tensile etc. shared by every casting of the heat |
| Casting (serial no.) | 3, 5, 6, 7, 9, 10 | per-casting traveller; stages unlock in order |

* Numeric limits from the sheet (e.g. fines ≤ 5 %, resin 1.8–2 %, viscosity 55–65 Baumé) are **auto-evaluated**; other checks use OK / Not OK, a dimension table (nominal ± tolerance), or a per-heat chemistry / mechanical spec.
* **Not OK** raises an NCR with the sheet's "If Not OK" action. Rework actions require re-inspection (history is kept; NCR auto-closes on an OK re-check). Reject actions scrap the casting; a failed final chemistry (4.2) rejects every casting of the heat after confirmation.
* A casting can be **released** only when all applicable stages are complete and no NCR is open. A printable **Inspection Report** (with Prepared / Issued / Approved blocks) is generated per casting.
* Dashboard: WIP by stage, NCRs by stage, first-time-OK rate, yield, overdue calibrations. Everything exports to CSV.

## Items the source sheet left open (flagged in the app, editable under *Inspection plan*)
* 7.4 Magnetic particle – acceptance & disposal "to be confirmed" (defaults Salvage / Reject).
* 9.1 After machining – acceptance "to be confirmed".
* 2.10.3 / 2.11.4 / 2.12.4 impact penetration are written "Mix 2.5/2.6/2.7 mm" – read as **maximum** penetration; confirm.
* Tapping / pouring limits, chemistry and mechanical limits are "per method plan / drawing", so they are entered per heat.

## Regenerating the plan
`python3 -I tools/build_plan.py` re-reads the spreadsheet and rewrites `plan.js` (requires `openpyxl`).

Try it quickly: **Dashboard → Load demo data**.

## Three ways to run it
1. **Claude Artifact (shared, by department)** – `artifact.html` published at https://claude.ai/artifact/KDeJTBu44Qyxwb4zzj4WyS. All users share one live database. On first open each person enters their name and picks a department; each department can record only its own stages (Pattern shop → 1, Sand lab & moulding → 2–3, Melting → 4, Fettling/HT → 5–6, NDT & lab → 7–8, Machining → 9, Quality → everything incl. release, reject, NCR closure, plan edits). Share the artifact as *Contributor* (can record) or *Viewer* (read-only). The department gate is a working rule inside the app, not a security boundary.
2. **Installable web app (PWA)** – host this folder on any HTTPS static host; Android Chrome → "Add to Home screen"; works offline; data stays on that phone.
3. **Single file** – `dcl-quality-inspection.html` can be sent by WhatsApp / e-mail and opened in Chrome on any phone, no Claude account needed; data stays on that phone (use Backup).

Regenerate `dcl-quality-inspection.html` and `artifact.html` with `python3 -I tools/bundle.py`.

## Dropdowns
Customer, part, grade, furnace, remarks, rejection reason, NCR closure note, release remarks and the "If Not OK" action all use dropdowns with **＋ Other (specify)…**. Anything typed there is saved and offered next time (shared by all departments in the Artifact). Remove a wrong entry under Settings → Dropdown lists.

## Approvals (every stage)
Each stage is signed three times: **Inspector → QC Manager → Factory Head**. Checks lock when the inspector signs; the QC Manager or Factory Head can *Return* the stage (with a reason) or later *Reopen* it. The next stage opens only after the Factory Head approves, and a casting can be released only when every applicable stage is fully approved. Each step must be a different person. Pick the QC Manager / Factory Head role on first open. The **Approvals** page and the dashboard list what is waiting for you.

## Customers and items
Dropdowns start with Escorts (Main Body, Knuckle), Tega (Tega Small Casting, Tega Big Casting), Thejo (Thejo Lifter Bar), Komatsu (Idler), plus BEML and Sona (items to be added). Choosing a customer shows that customer's items; a new item typed under *Other* is saved for that customer only.
