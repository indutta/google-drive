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
Dropdowns start with Escorts (Main Body, Knuckle), Tega (Tega Small Casting, Tega Big Casting), Thejo (Thejo Lifter Bar), Komatsu (17M Idler, 195 Idler, 21 N Idler, 154 Idler), plus BEML and Sona (items to be added). Choosing a customer shows that customer's items; a new item typed under *Other* is saved for that customer only.

## Charge mix
The **Charge mix** page implements the calculation in the six sheets of *QC n Design / Charge Calculation* (Tega T1, Thejo CrMo, Escorts M201, HT Bar, Vedanta 4%Ni, BEML Idler), which are loaded as recipes:
* contribution = Wt × analysis ÷ 100; total % = Σ(Wt × analysis) ÷ ΣWt, plus lining pick-up (Si); expected composition = total × (1 − element loss %);
* charge kg for each material = Wt ÷ Σ(non-return Wt) × (LM − foundry return); foundry return is fixed at its own kg;
* cost block: cost of charge − value of returns (100 − yield kg) → cost per kg → after rejection → less material cost of rejected → plus lining & other cost = final Rs/kg. These reproduce the sheets (e.g. Tega T1: 152.25 Rs/kg).
Edit any target, analysis, rate, weight or loss and the results update as you type. *Copy as new grade* starts a new recipe from the current one; *Save recipe* shares it with all departments; *Use for a heat* stores the charge on the heat and can set the target limits as the heat's chemistry specification (checks 4.1 / 4.2). The bottom table shows the charge mix of every grade.
Notes on the source sheets: Tega T1 uses no Mo from SS430 (as the sheet does); the HT Bar sheet's C-after-loss shows 0.02, which looks like a formula slip – the app gives 2.29; HT Bar kg are scaled to 3000 kg of other materials + 1000 kg foundry return as in the sheet.

## Melting log (Furnace Log Sheet DCL/FR/04 Re/05)
The **Melting log** page mirrors the paper Furnace Log Sheet: heat / furnace / grade / date / heat on lining & patching; spec min–max and Bath 1–3 / Ladle Final chemistry (out-of-spec readings turn red); power-on, tapped and auto heat time; input charges with MRN; foundry return; ferro alloys with up to three additions each (auto totals); LM distribution with auto total LM, total charges, melting loss kg and %; meter readings with auto kWh and kWh/tonne; ladle no., life, preheating, L.D.O./HSD, witness; tapping / pouring temperature; mould pouring allocation; fluxes, consumables, refractory; remarks and pouring time; three signatures (Shift Engineer, Melting Shop Incharge, Plant Metallurgist). Choice fields (furnace, grade, scrap type, ladle no., witness, product code, remarks) are dropdowns with *Other (specify)…* that learn new values. Grade specs are remembered per grade.
**Post to inspection…** records stage-4 checks from the log: 4.1 (last bath – if it was low and the ladle-final readings are within spec after the ferro addition, the correction is re-checked and the NCR closes), 4.2 (ladle final), 4.3 tapping and 4.4 pouring temperature. *Download sheet* saves a printable copy. Only the Melting department (and Quality) can edit the log.

## Moulding log (Molding Daily Plan)
The **Moulding log** page mirrors the mailed *Molding Daily Plan* sheet: date, item name, heat-wise quantities (H/T No – Qty) with automatic item and heat totals, and sand / resin / catalyst / water calibration for P1–P3. Item names reuse the dropdown shared with the furnace log; heat numbers come from the heat list (typed heats such as H370 match H-370). Each heat line shows whether the furnace log of that heat recorded those boxes (“poured n”). Resin is converted to % of sand weight and catalyst to % of resin weight (using the resin / catalyst density entered on the page – **confirm them from your data sheets**; starter values 1.15 and 1.2 kg/l) and compared with the plan limits 1.8–2 % and 18–21 %. **Post calibration…** records resin (2.4), catalyst (2.5) and P1/P2 sand (2.6 / 2.7) in the sand & calibration log of that date and shift; P3 sand and water have no check in the plan. *Download sheet* saves a printable copy. Planning, Sand / Moulding and Quality can edit.

## Raw materials (incoming inspection register)
The **Raw materials** page records every incoming lot against its **MRN**: receipt (date, material, supplier, PO, challan, vehicle, supplier lot, TC/COA no., qty, rate), chemical analysis with spec min/max (remembered per material) for the supplier certificate and Datre's own lab (lab overrides the TC), visual / document checks, and the decision (Pending, Accepted, Accepted under deviation, Hold, Rejected – taken by Quality / QC Manager). A suggested decision is shown from the analysis and checks. Material, supplier, checks and remarks are dropdowns with *Other (specify)…* that learn new values (starter suppliers come from the recent purchase orders: Rama Ferro Alloys & Finance, DRK Ispat, Mill Stores Trading Company, Access Metals Industries).
**Synergy with production**
* The Furnace Log Sheet's MRN fields suggest the registered MRNs; a rejected, held or unregistered MRN raises a banner on the log and in *Post to inspection*.
* Each lot shows where it was used (heat, kg) and its remaining balance; each heat shows a **Raw material traceability** card (MRN, supplier, kg charged, inspection decision).
* Charge mix → **Update analysis from received lots** loads the analysis and MRN of the latest accepted lot into the recipe's materials.
* The register page summarises supplier performance (accept / reject %, rejected kg) and the mean ± standard deviation of accepted-lot analysis per material, and exports to CSV – the base data for later output analysis (analysis → heat → casting results).
