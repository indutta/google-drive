# Inspection Data (Datre)

A simple phone-first app for inspection and test data: the 10-stage casting inspection flow with approvals, plus test records.
Rebuilt from "Daily Production & Inspection" – production planning (daily plan, PPC/WIP, melting/moulding plans, charge mix, raw materials, maintenance) is not part of this app.

**Five tabs:** Today · Castings · Tests · Approvals · More (Work orders, Heats, Sand & calibration logs, NCRs, Inspection plan, Settings & backup).

- **Castings** – open a casting to follow the 10 stages; each stage has inspector → QC Manager → Factory Head approval. Release / reject, PDF inspection report.
- **Tests** (one page, tabs): Sand · Chemistry (per heat, limits from the heat Specification flag red) · Heat treatment (shake-out, normalising, quenching, tempering with hardness) · Dimensions (auto OK / Not OK) · Physical (UTS, YS, %E, %RA, impact, hardness at each heat-treatment stage) · Procedures (how each test is done, by department).
- **+ New entry** – one button for work order, tests, logs and heats.

## Build
`python3 tools/bundle.py` writes `inspection-data.html` (standalone, works offline on any Android phone), `artifact.html` (Claude Artifact) and `gas/app.html` (Google Sheet / Apps Script version, see `gas/SETUP.md`). Inspection plan comes from `source/INS_Inspection_Flow.xlsx` via `tools/build_plan.py`.
