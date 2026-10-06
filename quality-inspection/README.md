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
