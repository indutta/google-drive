# Inspection Data (Datre)

Phone-first inspection app built on the **KNUCKLE (Sona) casting inspection flow chart**. Production planning is not part of it.

**Tabs:** Today · Flow · Castings · Approvals · More.

**Flow** follows the chart, section by section, with each test in sequence, its frequency (green) and acceptance (red):
1. Moulding – sand plant calibration, new sand check, mixed sand test, paint Baumé (per shift log); mould & core, mould hardness (per casting) – gate *Moulding OK?*
2. Melting & pouring – charge check, melt log, ladle spectro chemistry, pouring, shake-out (per heat) – gate *Chemistry in spec?*
3. Fettling – cut-off / grinding / shot blast, visual & dimensional (per casting)
4. Heat treatment – furnace load check, normalising, hardness, quenching, tempering (per heat/load) – gate *Hardness in spec?*
5. Mechanical tests – tensile, impact (per heat) – gate *Tests pass?*
6. Finished casting – final visual & dimensions, MPT, RT/UT (per casting) – gate *All OK?* → ACCEPTED, release

Values marked * in the chart are ranges recorded on the Sona heat-wise sheet (heats H430, H447, H450); they are used as limits and flagged "criteria assumed – confirm". A failed check raises an NCR with the actions from the chart (rework / reject).
Approvals (Inspector → QC Manager → Factory Head) apply to each stage; release / reject by QA.

**Settings → Enter Sona knuckle data** enters the sheet's values for the three heats as real records.

## Build
`python3 -I tools/build_flow.py` writes `plan.js` from the flow data; `python3 tools/bundle.py` writes `inspection-data.html`, `artifact.html` and `gas/app.html` (Google Sheet version, see `gas/SETUP.md`).
