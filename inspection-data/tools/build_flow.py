#!/usr/bin/env python3
"""Builds plan.js (window.PLAN) from the KNUCKLE (Sona) casting inspection flow chart.
Departments (sections of the chart) -> stages -> steps -> checks.  Values marked * in the chart are ranges recorded on the
heat-wise sheet (Knuckle & Main Body, heats H430/H447/H450): they are used as limits but flagged 'assumed' – confirm against the grade spec."""
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'plan.js')
REJ = ['Reject']
def R(id, step, fq, param, method, crit, lo, hi, unit, actions, **kw):
    d = dict(id=id, step=step, sample=fq, param=param, method=method, criteria=crit, kind='range', min=lo, max=hi, unit=unit, actions=actions, assumed=True)
    d.update(kw); return d
def MIN(id, step, fq, param, method, crit, lo, unit, actions, **kw): return dict(id=id, step=step, sample=fq, param=param, method=method, criteria=crit, kind='min', min=lo, unit=unit, actions=actions, **kw)
def SP(id, step, fq, param, method, crit, unit, actions, **kw): return dict(id=id, step=step, sample=fq, param=param, method=method, criteria=crit, kind='spec', unit=unit, actions=actions, **kw)
def YN(id, step, fq, param, method, crit, actions, **kw): return dict(id=id, step=step, sample=fq, param=param, method=method, criteria=crit, kind='yn', actions=actions, **kw)
def DIM(id, step, fq, param, method, crit, actions, **kw): return dict(id=id, step=step, sample=fq, param=param, method=method, criteria=crit, kind='dim', actions=actions, **kw)
def CH(id, step, fq, param, method, crit, actions, kind): return dict(id=id, step=step, sample=fq, param=param, method=method, criteria=crit, kind=kind, actions=actions)
def step(id, name, checks, **kw): return dict(id=id, name=name, checks=checks, optional=kw.get('optional', False), sampled=kw.get('sampled', False))
def stage(no, name, scope, dept, steps): return dict(no=no, name=name, scope=scope, section=dept, groups=[dict(name=None, steps=steps)], optional=False)

SAND_A = ['Re-calibrate dosing and retest', 'Reject sand batch']
MOULD_A = ['Rework mould', 'Reject mould']
st = []
st.append(stage(1, 'Sand plant & sand tests', 'log', 'Moulding', [
  step('1.1', 'Sand plant calibration (resin / catalyst dosing)', [
    R('1.1.1', '1.1', 'Start of each shift and after any dosing change', 'Mixed sand – resin', 'Dosing check', 'Mixed sand resin 1.8–2.0 %*', 1.8, 2.0, '%', SAND_A, freq='shift'),
    R('1.1.2', '1.1', 'Start of each shift and after any dosing change', 'Mixed sand – catalyst', 'Dosing check', 'Mixed sand catalyst 19–20 %*', 19, 20, '%', SAND_A, freq='shift'),
    R('1.1.3', '1.1', 'Start of each shift and after any dosing change', 'New sand – resin', 'Dosing check', 'New sand resin 1.8–1.9 %*', 1.8, 1.9, '%', SAND_A, freq='shift'),
    R('1.1.4', '1.1', 'Start of each shift and after any dosing change', 'New sand – catalyst', 'Dosing check', 'New sand catalyst 18–19 %*', 18, 19, '%', SAND_A, freq='shift')]),
  step('1.2', 'New sand check', [
    R('1.2.1', '1.2', 'Each lot received', 'Compressive strength (new sand)', 'Sand strength machine', 'Recorded 6.2–6.47*', 6.2, 6.47, 'kg/cm²', ['Reject lot / return to supplier'], freq='shift'),
    SP('1.2.2', '1.2', 'Each lot received', 'Fines, moisture, L.O.I', 'Sieve set, moisture analyser, muffle furnace', 'Within own sand specification', '%', ['Reject lot / return to supplier'], freq='shift')]),
  step('1.3', 'Mixed sand test', [
    R('1.3.1', '1.3', 'Each shift (and each new sand batch)', 'Fines', 'Sieve analysis', 'Fines 3.2–3.65*', 3.2, 3.65, '', SAND_A, freq='shift'),
    R('1.3.2', '1.3', 'Each shift (and each new sand batch)', 'Moisture', 'Moisture analyser', 'Moisture 0.34–0.41 %*', 0.34, 0.41, '%', SAND_A, freq='shift'),
    R('1.3.3', '1.3', 'Each shift (and each new sand batch)', 'Tensile strength', 'Sand strength machine', 'Tensile 6.57–6.9*', 6.57, 6.9, 'kg/cm²', SAND_A, freq='shift'),
    R('1.3.4', '1.3', 'Each shift (and each new sand batch)', 'Compressive strength', 'Sand strength machine', 'Compressive 4.97–5.75*', 4.97, 5.75, 'kg/cm²', SAND_A, freq='shift'),
    R('1.3.5', '1.3', 'Each shift (and each new sand batch)', 'Gas content', 'Gas tester', 'Gas 9.1–9.3*', 9.1, 9.3, 'cc/gm', SAND_A, freq='shift'),
    R('1.3.6', '1.3', 'Each shift (and each new sand batch)', 'L.O.I', 'Muffle furnace', 'L.O.I 2.7–3.7 %*', 2.7, 3.7, '%', SAND_A, freq='shift')]),
  step('1.4', 'Coating: paint Baumé', [
    R('1.4.1', '1.4', 'Each paint batch and each shift', 'Paint Baumé', 'Hydrometer', 'Recorded 55–56 °Bé*', 55, 56, '°Bé', ['Adjust paint and retest', 'Reject paint batch'], freq='shift'),
    YN('1.4.2', '1.4', 'Each paint batch and each shift', 'Paint fully dry before closing', 'Visual', 'Fully dry before closing', ['Dry further and recheck'], freq='shift')])]))
st.append(stage(2, 'Mould & core', 'casting', 'Moulding', [
  step('2.1', 'Mould and core making', [
    DIM('2.1.1', '2.1', 'First-off + every 10th mould; 100 % for critical dimensions', 'Mould and core dimensions / fit', 'Gauges, measuring instruments', 'Dimension and core fit within drawing tolerance', MOULD_A)], sampled=True),
  step('2.2', 'Mould hardness (scratch)', [
    R('2.2.1', '2.2', 'Every mould before closing', 'Mould hardness (scratch)', 'Scratch hardness tester', 'Recorded 57–60*', 57, 60, 'scratch hardness', MOULD_A)])]))
st.append(stage(3, 'Melting & pouring', 'heat', 'Melting & pouring', [
  step('3.1', 'Charge check', [YN('3.1.1', '3.1', 'Every heat (100 %)', 'Grade and weight as per charge chart', 'Weighing, visual', 'Grade and weight as charge chart; no wet or oily scrap', ['Correct the charge', 'Reject heat'])]),
  step('3.2', 'Melt log', [
    SP('3.2.1', '3.2', 'Every heat (100 %)', 'Tap temperature', 'Immersion thermocouple', 'As per melt practice', '°C', ['Correct melt and re-record', 'Reject heat']),
    YN('3.2.2', '3.2', 'Every heat (100 %)', 'Deoxidation (Al) as per melt practice', 'Melt log', 'Deoxidation as per melt practice', ['Correct melt and re-record']),
    YN('3.2.3', '3.2', 'Every heat (100 %)', 'Melt log record kept', 'Melt log', 'Record kept', ['Complete the record'])]),
  step('3.3', 'Ladle sample: spectro chemistry', [
    CH('3.3.1', '3.3', 'Every heat (100 %); re-sample after any correction', 'Chemical composition', 'Optical emission spectrometer', 'Knuckle recorded*: C 0.29–0.31, Si 0.43–0.62, Mn 1.16–1.50, P 0.022–0.031, S 0.010–0.020, Cr 0.03–0.30, Mo 0.12–0.13, Ni 0.18–0.23, Al 0.031–0.048, Sn 0.003–0.004 (confirm vs grade spec)', ['Correct melt (alloy adjust) and re-sample', 'Hold heat', 'Reject heat'], 'chem')]),
  step('3.4', 'Pouring', [
    SP('3.4.1', '3.4', 'Every heat (100 %)', 'Pouring temperature', 'Immersion thermocouple', 'Within process window', '°C', ['Hold ladle and re-check', 'Reject mould']),
    SP('3.4.2', '3.4', 'Every heat (100 %)', 'Pouring time', 'Stop watch', 'Within process window', 's', ['Record and review', 'Reject mould']),
    YN('3.4.3', '3.4', 'Every heat (100 %)', 'Heat code on every mould', 'Visual', 'Heat code marked on every mould', ['Mark and verify'])]),
  step('3.5', 'Shake-out time from pouring', [
    R('3.5.1', '3.5', 'Every heat (100 %)', 'Shake-out time from pouring', 'Clock record', 'Recorded 28–30 h*; not before minimum time', 28, 30, 'h', ['Review with process owner', 'Reject heat'])])]))
st.append(stage(4, 'Cut-off, grinding & shot blasting', 'casting', 'Fettling', [
  step('4.1', 'Cut risers / gates, grind, shot blast', [YN('4.1.1', '4.1', 'Every casting', 'Gouges, undercuts, riser stubs', 'Visual', 'No gouges or undercuts; riser stubs within drawing', ['Re-grind and re-inspect', 'Reject casting'])]),
  step('4.2', 'Visual and dimensional check', [
    YN('4.2.1', '4.2', 'Visual 100 %', 'Cracks, cold shut, shrinkage, sand inclusion', 'Visual', 'No cracks, cold shut, shrinkage or sand inclusion', ['Repair (weld) and re-inspect', 'Reject casting']),
    DIM('4.2.2', '4.2', 'First-off + 1 in 10 (100 % critical features)', 'Dimensions', 'Gauges, measuring instruments', 'Dimensions within tolerance', ['Rework and re-measure', 'Reject casting'])])]))
HT_A = ['Re-normalise / re-temper (max 2 times) and retest', 'Reject']
st.append(stage(5, 'Heat treatment', 'heat', 'Heat treatment', [
  step('5.1', 'Furnace load check', [YN('5.1.1', '5.1', 'Every load', 'Heat code, quantity and load chart; thermocouple and calibration valid', 'Load chart, calibration certificate', 'Heat code, qty and load chart match; thermocouple and calibration valid', ['Correct the load and recheck'])]),
  step('5.2', 'Normalising', [
    R('5.2.1', '5.2', 'Every load; chart review each cycle', 'Normalising temperature', 'Furnace chart', 'Knuckle cycle*: 920 °C ±10 °C', 910, 930, '°C', HT_A),
    SP('5.2.2', '5.2', 'Every load; chart review each cycle', 'Ramp', 'Furnace chart', 'Knuckle cycle*: 100 °C/h', '°C/h', HT_A),
    MIN('5.2.3', '5.2', 'Every load; chart review each cycle', 'Soaking time', 'Furnace chart', 'Knuckle cycle*: soak 4 h', 4, 'h', HT_A, assumed=True)]),
  step('5.3', 'Hardness after normalising', [SP('5.3.1', '5.3', '1 test piece per heat per load (min)', 'Hardness after normalising', 'Brinell hardness tester', 'Not recorded for these heats; HB check per grade spec', 'HB', HT_A)]),
  step('5.4', 'Quenching', [
    SP('5.4.1', '5.4', 'Every load', 'Water temperature before dipping', 'Thermometer', 'Per sheet columns (not recorded for these heats)', '°C', HT_A),
    SP('5.4.2', '5.4', 'Every load', 'Furnace temperature', 'Furnace chart', 'Per approved cycle', '°C', HT_A),
    SP('5.4.3', '5.4', 'Every load', 'Material temperature', 'Pyrometer', 'Per approved cycle', '°C', HT_A),
    SP('5.4.4', '5.4', 'Every load', 'Immersion time', 'Stop watch', 'Per approved cycle', 'min', HT_A),
    SP('5.4.5', '5.4', 'Every load', 'Agitators running (no.) and RPM', 'Visual / tachometer', 'Per approved cycle', 'RPM', HT_A),
    SP('5.4.6', '5.4', 'Every load', 'Water temperature after dipping', 'Thermometer', 'Per sheet columns', '°C', HT_A)]),
  step('5.5', 'Hardness after quenching', [SP('5.5.1', '5.5', '1 test piece per heat per load (min)', 'Hardness after quenching', 'Brinell hardness tester', 'Per grade / customer spec', 'HB', HT_A)]),
  step('5.6', 'Tempering', [
    SP('5.6.1', '5.6', 'Every load; chart review each cycle', 'Tempering temperature', 'Furnace chart', 'Per approved cycle', '°C', HT_A),
    SP('5.6.2', '5.6', 'Every load; chart review each cycle', 'Ramp', 'Furnace chart', 'Per approved cycle', '°C/h', HT_A),
    SP('5.6.3', '5.6', 'Every load; chart review each cycle', 'Soaking time', 'Furnace chart', 'Per approved cycle', 'h', HT_A)]),
  step('5.7', 'Hardness after tempering', [SP('5.7.1', '5.7', '1 test piece per heat per load (min); more on large loads', 'Hardness after tempering', 'Brinell hardness tester', 'Per drawing / customer spec', 'HB', HT_A)])]))
MECH_A = ['Retest with 2 more bars (both must pass)', 'Re-heat-treat', 'Reject heat']
st.append(stage(6, 'Mechanical tests', 'heat', 'Mechanical tests', [
  step('6.1', 'Tensile: UTS, YS, %E, %RA', [CH('6.1.1', '6.1', '1 test bar per heat per HT load', 'UTS, YS, %E, %RA', 'Universal testing machine', 'All values at or above grade spec minimum (not recorded)', MECH_A, 'mech')]),
  step('6.2', 'Impact test', [SP('6.2.1', '6.2', '3 specimens per heat per HT load', 'Impact energy (average)', 'Charpy impact tester', 'Average at or above spec; no single value below 70 % of spec (typical)', 'J', MECH_A)])]))
FIN_A = ['Repair (weld), re-heat-treat and re-inspect', 'Scrap']
st.append(stage(7, 'Finished casting', 'casting', 'Finished casting', [
  step('7.1', 'Final visual and dimensions', [
    YN('7.1.1', '7.1', 'Visual 100 %', 'Final visual inspection', 'Visual', 'Within drawing and surface standard', FIN_A),
    DIM('7.1.2', '7.1', 'Dimensions per sampling plan (100 % critical)', 'Final dimensions', 'Gauges, measuring instruments', 'Within drawing tolerance', FIN_A)]),
  step('7.2', 'MPT (surface)', [YN('7.2.1', '7.2', '100 % critical areas; others per customer plan', 'Magnetic particle testing', 'MPT (ASTM E709)', 'No linear indications beyond customer acceptance level', FIN_A)], optional=True),
  step('7.3', 'RT / UT (internal)', [YN('7.3.1', '7.3', 'Per customer plan; 100 % on critical zones', 'Radiographic / ultrasonic testing', 'RT / UT', 'Within agreed severity level; none in critical zones', FIN_A)], optional=True)]))
for s in st:
    for g in s['groups']:
        for sp in g['steps']:
            for c in sp['checks']:
                c['actions'] = [a[:1].upper() + a[1:] for a in c['actions']]; c['action'] = ' / '.join(c['actions'])
GATES = {2: ('Moulding OK?', 'Rework or reject the mould, retest and record, fix the cause'),
         3: ('Chemistry in spec?', 'Correct melt (alloy adjust) and re-sample, or hold / reject the heat'),
         5: ('Hardness in spec?', 'Re-normalise / re-temper (max 2 times), then retest – else reject'),
         6: ('Tests pass?', 'Retest with 2 more bars (both must pass) – else re-heat-treat or reject the heat'),
         7: ('All OK?', 'Repair (weld), then re-heat-treat and re-inspect – or scrap. If OK: ACCEPTED – stamp, record, release; update the heat-wise knuckle sheet')}
for s_ in st:
    if s_['no'] in GATES: s_['gate'] = dict(question=GATES[s_['no']][0], no=GATES[s_['no']][1])
plan = dict(company='DATRE CORPORATION LIMITED', title='Knuckle (Sona) Casting Inspection Flow', stages=st)
open(OUT, 'w').write('/* Generated by tools/build_flow.py from the KNUCKLE casting inspection flow chart - do not edit by hand */\nwindow.PLAN = ' + json.dumps(plan, ensure_ascii=False, indent=1) + ';\n')
print(len(st), 'stages', sum(len(sp['checks']) for s in st for g in s['groups'] for sp in g['steps']), 'checks')
