/* Heat-treatment record per casting (from the internal inspection report) + testing-procedure reference by department. */
(function () {
  'use strict';
  const QI = window.QI;
  /* Fields in the order of the internal inspection sheet */
  QI.HT_FIELDS = {
    norm: [['temp', 'Temp. (°C)'], ['ram', 'Ram / Hrs'], ['soak', 'Soaking time'], ['hard', 'Hardness after normalising (HB)']],
    quench: [['furnace', 'Furnace no.'], ['waterBefore', 'Water temp. before dipping (°C)'], ['furnaceTemp', 'Furnace temp. (°C)'], ['matTemp', 'Material temp. (°C)'], ['immersion', 'Immersion time'], ['agitators', 'No. of agitators running'], ['rpm', 'RPM of agitator'], ['agitWhen', 'Agitator running before / after immersion'], ['agitTime', 'Agitator running time'], ['waterAfter', 'Water temp. after dipping (°C)'], ['hard', 'Hardness after quenching (HB)']],
    temper: [['temp', 'Temp. (°C)'], ['ram', 'Ram / Hrs'], ['soak', 'Soaking time'], ['hard', 'Hardness after tempering (HB)']]
  };
  QI.htRec = (c) => c.htRec || null;
  QI.htRecSave = (c, rec, copyToHeat) => {
    if (!QI.can('ht')) return { error: 'Your department cannot record heat treatment.' };
    rec.by = rec.by || ''; rec.ts = Date.now();
    c.htRec = rec;
    if (copyToHeat && c.heatNo) {
      QI.S().castings.forEach((o) => {
        if (o === c || o.heatNo !== c.heatNo || o.status !== 'active') return;
        const r = JSON.parse(JSON.stringify(o.htRec || {}));
        ['norm', 'quench', 'temper'].forEach((k) => { r[k] = Object.assign({}, rec[k], { hard: (r[k] || {}).hard || '' }); });
        r.shakeout = rec.shakeout; r.ts = rec.ts; r.by = rec.by; o.htRec = r;
      });
    }
    QI.save(); return { ok: true };
  };

  /* ---- testing procedures by department (reference summary – limits come from the inspection plan / customer spec) ---- */
  QI.TESTS = [
    { dept: 'sand', name: 'Sand lab & moulding', items: [
      { t: 'Sand grain fineness & fines', std: 'AFS sieve analysis', how: 'Dry a 50 g sample, shake through the sieve set for the fixed time, weigh each sieve and calculate GFN and % fines.', freq: 'Per shift (new & mixed sand)', rec: 'Sand test report – fines' },
      { t: 'Moisture', std: 'Moisture analyser / oven drying', how: 'Weigh 50 g sand, dry to constant weight, moisture % = weight loss ÷ original weight.', freq: 'Per shift', rec: 'Sand test report – moisture' },
      { t: 'Compressive / tensile strength', std: 'Universal sand strength machine', how: 'Ram three standard 50 × 50 mm specimens, test to failure, report the average. Resin sand: cure for the stated time first.', freq: 'Per shift', rec: 'Sand test report – C./T. strength' },
      { t: 'Resin & catalyst %', std: 'Dosing check', how: 'Collect the dosed quantity for the timed run and weigh it against the sand delivered; compare with the set % of the sand weight.', freq: 'Start of shift & after setting change', rec: 'Sand calibration report' },
      { t: 'Loss on ignition (L.O.I) & gas content', std: 'Muffle furnace / gas evolution test', how: 'L.O.I: heat a dried sample at the set temperature and weigh the loss. Gas: heat in the gas tester and read the volume.', freq: 'Weekly or per batch', rec: 'Sand test report – L.O.I / gas' },
      { t: 'Mould hardness', std: 'Scratch hardness tester', how: 'Press the tester on the mould face at several points (cope, drag, pattern depth) and take the readings.', freq: 'Every mould', rec: 'Mould hardness' },
      { t: 'Paint (coating) Baumé', std: 'Hydrometer', how: 'Float the hydrometer in a measuring cylinder of the stirred paint and read °Bé at the meniscus.', freq: 'Each paint batch', rec: 'Paint test' }] },
    { dept: 'melt', name: 'Melting & pouring', items: [
      { t: 'Ladle / furnace sample chemistry', std: 'Optical emission spectrometer (OES)', how: 'Cast the sample, grind the face, burn at the set points and compare C, Si, Mn, P, S, Cr, Mo, Ni, Al, Cu, Ti with the grade. Correct the bath before tapping.', freq: 'Every heat, before tap', rec: 'Ladle sample report' },
      { t: 'Tapping & pouring temperature', std: 'Immersion thermocouple', how: 'Dip the calibrated thermocouple in the ladle; record at tap and at pouring against the heat window.', freq: 'Every heat', rec: 'Melting log' },
      { t: 'Charge verification', std: 'Weighing & lot check', how: 'Weigh each charge item against the approved charge mix and note the raw-material lot.', freq: 'Every heat', rec: 'Charge mix / melting log' },
      { t: 'Test coupon / keel block', std: 'Cast with the heat', how: 'Pour the coupon from the same ladle, mark with the heat code and send it with the castings through the same heat treatment.', freq: 'Every heat (as per customer)', rec: 'Heat record' }] },
    { dept: 'fettle', name: 'Fettling & heat treatment', items: [
      { t: 'Shake-out time from pouring', std: 'Clock record', how: 'Note the hours from pouring to shake-out; do not shake out before the set minimum.', freq: 'Every mould', rec: 'Heat treatment record' },
      { t: 'Normalising / tempering cycle', std: 'Furnace chart & thermocouple', how: 'Record furnace no., temperature, ramp (hours) and soaking time against the approved cycle; keep the furnace chart.', freq: 'Every charge', rec: 'Heat treatment record' },
      { t: 'Water quenching', std: 'Quench tank record', how: 'Record water temp. before and after dipping, furnace and material temperature, immersion time, agitators running, RPM and when agitation ran.', freq: 'Every charge', rec: 'Heat treatment record' },
      { t: 'Hardness after each treatment', std: 'Brinell hardness (HB)', how: 'Grind a flat spot, test at the marked location and record HB after normalising, after quenching and after tempering.', freq: 'Every casting / sample', rec: 'Heat treatment record' }] },
    { dept: 'lab', name: 'Metallurgical & physical lab', items: [
      { t: 'Tensile test (UTS, YS, %E, %RA)', std: 'ISO 6892-1 / ASTM A370', how: 'Machine the specimen from the coupon, measure the gauge dimensions, pull to fracture and record UTS, YS, elongation and reduction of area.', freq: 'Per heat / treatment lot', rec: 'Physical test report' },
      { t: 'Impact test (Charpy)', std: 'ISO 148-1 / ASTM A370', how: 'Notched specimen at the specified temperature, strike on the pendulum and record absorbed energy (J); usually the average of three.', freq: 'Per heat / treatment lot', rec: 'Impact' },
      { t: 'Hardness (Brinell)', std: 'ISO 6506 / ASTM E10', how: 'Prepare the surface, apply the set load and ball, measure the indentation and read HB.', freq: 'As per plan', rec: 'Hardness record' },
      { t: 'Microstructure', std: 'Metallography', how: 'Cut, mount, polish, etch and examine against the customer standard.', freq: 'When specified', rec: 'Lab report' }] },
    { dept: 'qa', name: 'NDT & final inspection', items: [
      { t: 'Visual & dimensional', std: 'Drawing / template / CMM', how: 'Check surface condition and each drawing dimension with the approved gauges or template; record the readings.', freq: 'Every casting', rec: 'Inspection report' },
      { t: 'Magnetic particle testing (MPT)', std: 'ASTM E709', how: 'Clean, magnetise, apply the particles, inspect under light and compare indications with the acceptance class.', freq: 'As per plan / customer', rec: 'Final MPT inspection' },
      { t: 'Dye penetrant testing (DPT)', std: 'ASTM E165', how: 'Clean, apply penetrant, wait the dwell time, remove excess, apply developer and inspect.', freq: 'Non-magnetic grades / as per plan', rec: 'Final inspection' },
      { t: 'Ultrasonic testing (UT)', std: 'ASTM A609', how: 'Calibrate on the reference block, scan the casting with couplant and record indications against the quality level.', freq: 'As per plan / customer', rec: 'Final UT inspection' },
      { t: 'Radiographic testing (RT)', std: 'ASTM E446 / E186 / E280', how: 'Place the film or detector and penetrameter, expose, and read the image against the reference radiographs.', freq: 'As per plan / customer', rec: 'Final RT inspection' }] },
  ];
  /* department id -> test group shown first */
  QI.TEST_HOME = { planning: 'qa', pattern: 'qa', sand: 'sand', melt: 'melt', fettle: 'fettle', lab: 'lab', mach: 'qa', qa: 'qa', qcm: 'qa', head: 'qa', mgmt: 'qa' };
})();
