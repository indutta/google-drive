/* DCL – customer PDF reports: casting inspection report and work-order summary.
   Built in the phone's browser with jsPDF (loaded from cdnjs the first time a report is made). */
(function () {
  'use strict';
  const QI = window.QI;
  const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
  const JSPDF = CDN + 'jspdf/2.5.1/jspdf.umd.min.js', AUTOTABLE = CDN + 'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
  const loadScript = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('Could not load the PDF maker. Check the internet connection and try again.')); document.head.appendChild(s); });
  async function lib() {
    if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript(JSPDF);
    const J = window.jspdf.jsPDF;
    if (!J.API.autoTable) await loadScript(AUTOTABLE);
    return J;
  }
  /* the standard PDF fonts cannot draw every symbol: replace the few the app uses */
  const t = (s) => String(s == null ? '' : s).replace(/[≤]/g, '<=').replace(/[≥]/g, '>=').replace(/[→]/g, '->').replace(/[✓✔]/g, 'OK').replace(/[₹]/g, 'Rs ').replace(/[−]/g, '-')
    .replace(/[‐‑‒]/g, '-').replace(/[  ]/g, ' ').replace(/[^\x00-\xff–—‘’“”•…]/g, '?');
  const fd = (ts) => ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const fdt = (ts) => ts ? new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const crit = (ch) => (ch.min != null || ch.max != null) ? QI.limText(ch.min, ch.max, ch.unit) : (ch.criteria || '');
  const INK = [22, 32, 43], MUT = [91, 104, 120], LINE = [200, 208, 216], SOFT = [236, 240, 244], BAD = [184, 50, 42], OK = [47, 125, 79];

  function frame(doc, title, rightLines) {
    const W = doc.internal.pageSize.getWidth();
    const logo = window.DCL_LOGO;
    if (logo && /^data:image\/(jpeg|png)/.test(logo)) { try { doc.addImage(logo, /png/.test(logo.slice(0, 30)) ? 'PNG' : 'JPEG', 14, 9, 17, 17); } catch (e) {} }
    const x = logo ? 34 : 14;
    doc.setTextColor(...INK); doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('DATRE CORPORATION LIMITED', x, 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT); doc.text('FIGC, Sec III, Falta, 24 Parganas (S), West Bengal 743504', x, 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...INK); doc.text(t(title), x, 26);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...INK);
    (rightLines || []).forEach((l, i) => doc.text(t(l), W - 14, 15 + i * 5, { align: 'right' }));
    doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.line(14, 29, W - 14, 29);
    return 33;
  }
  function footers(doc, label) {
    const n = doc.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUT); doc.setDrawColor(...LINE); doc.setLineWidth(0.2); doc.line(14, H - 12, W - 14, H - 12);
      doc.text(t(label), 14, H - 8); doc.text(`Page ${i} of ${n}`, W - 14, H - 8, { align: 'right' }); }
  }
  const kv = (doc, y, pairs) => {          // [[label, value, label, value], ...]
    doc.autoTable({ startY: y, body: pairs.map((r) => r.map(t)), theme: 'grid', styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.2, textColor: INK },
      columnStyles: { 0: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 30 }, 2: { fontStyle: 'bold', fillColor: SOFT, cellWidth: 30 } }, margin: { left: 14, right: 14 } });
    return doc.lastAutoTable.finalY + 4;
  };
  const sign = (doc, y, boxes) => {          // [[role, name, date], ...]
    const H = doc.internal.pageSize.getHeight(); if (y > H - 45) { doc.addPage(); y = 20; }
    doc.autoTable({ startY: y, head: [boxes.map((b) => b[0])], body: [boxes.map((b) => t((b[1] || '') + (b[2] ? '\n' + b[2] : '')))], theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, minCellHeight: 18, lineColor: LINE, lineWidth: 0.2, textColor: INK, valign: 'bottom' }, headStyles: { fillColor: SOFT, textColor: INK, fontStyle: 'bold' }, margin: { left: 14, right: 14 } });
    return doc.lastAutoTable.finalY + 4;
  };
  const statusCell = (data) => { if (data.section === 'body' && data.column.index === 4) { const v = data.cell.raw; if (v === 'NOT OK') { data.cell.styles.textColor = BAD; data.cell.styles.fontStyle = 'bold'; } else if (v === 'OK') data.cell.styles.textColor = OK; } };

  /* ---- one casting ---- */
  async function casting(id) {
    const c = QI.casting(id); if (!c) throw new Error('Casting not found');
    const J = await lib(); const doc = new J({ unit: 'mm', format: 'a4' });
    const j = QI.job(c.jobNo) || {}, h = c.heatNo ? QI.heat(c.heatNo) : null, st = QI.castingState(c), tr = QI.castingStages(c);
    let y = frame(doc, 'Casting Inspection Report', [c.id, st.label]);
    y = kv(doc, y, [['Work order', j.no, 'Customer / PO', (j.customer || '') + ' / ' + (j.po || '')], ['Part', j.part, 'Drawing / Pattern', (j.drawing || '') + ' / ' + (j.pattern || '')],
      ['Material grade', j.grade, 'Heat no.', (c.heatNo || '-') + (h && h.date ? ' (' + h.date + ')' : '')], ['Sand log', c.logId || '-', 'Report date', fd(Date.now())]]);
    const rows = [];
    tr.stages.forEach((x) => {
      const done = x.items.filter((i) => i.owner); if (!done.length) return;
      const ap = (x.approval && x.approval.steps) || {};
      rows.push([{ content: t(`Stage ${x.stage.no} - ${x.stage.name}    Inspector: ${ap.inspector ? ap.inspector.by + ', ' + fd(ap.inspector.ts) : '-'}   QC Manager: ${ap.qc ? ap.qc.by + ', ' + fd(ap.qc.ts) : '-'}   Factory Head: ${ap.head ? ap.head.by + ', ' + fd(ap.head.ts) : '-'}`), colSpan: 6, styles: { fillColor: SOFT, fontStyle: 'bold', fontSize: 8 } }]);
      x.items.forEach((i) => {
        const a = i.owner ? QI.last(i.scope, i.owner, i.check.id) : null, ch = QI.eff(i.check.id);
        rows.push([ch.id, t(ch.param + '\n' + QI.steps[ch.step].name), t(crit(ch)), t(a ? (a.summary || '') + (a.detail ? '\n' + a.detail : '') : ''), a ? (a.result === 'ok' ? 'OK' : 'NOT OK') : i.required ? 'Pending' : '-', t(a ? a.by + '\n' + fdt(a.ts) : '')]);
      });
    });
    doc.autoTable({ startY: y, head: [['Check', 'Parameter', 'Acceptance', 'Result / reading', 'Status', 'Inspected by']], body: rows, theme: 'grid', showHead: 'everyPage',
      styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: LINE, lineWidth: 0.2, textColor: INK, overflow: 'linebreak' }, headStyles: { fillColor: INK, textColor: 255 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 40 }, 2: { cellWidth: 32 }, 3: { cellWidth: 40 }, 4: { cellWidth: 16 }, 5: { cellWidth: 'auto' } }, didParseCell: statusCell, margin: { left: 14, right: 14 } });
    y = doc.lastAutoTable.finalY + 5;
    const ncrs = QI.S().ncrs.filter((n) => n.castings.includes(c.id));
    doc.setFontSize(9); doc.setTextColor(...INK);
    const lines = [];
    if (ncrs.length) lines.push(`Non-conformances raised: ${ncrs.length} (closed: ${ncrs.filter((n) => n.status === 'closed').length}).`);
    if (c.status === 'released') lines.push(`RELEASED for dispatch by ${c.release.by} on ${fdt(c.release.ts)}.${c.release.remarks ? ' ' + c.release.remarks : ''}`);
    else if (c.status === 'rejected') lines.push(`REJECTED: ${c.reject.reason} (${c.reject.action}).`);
    else lines.push('Status: in process - this report is not a release certificate.');
    lines.forEach((l) => { const w = doc.splitTextToSize(t(l), 182); if (y > 270) { doc.addPage(); y = 20; } doc.text(w, 14, y); y += w.length * 4.5; });
    const last = tr.stages.slice().reverse().find((x) => x.approval && x.approval.steps && Object.keys(x.approval.steps).length);
    const ap = last ? last.approval.steps : {};
    sign(doc, y + 2, [['Inspector', ap.inspector && ap.inspector.by, ap.inspector && fd(ap.inspector.ts)], ['QC Manager', ap.qc && ap.qc.by, ap.qc && fd(ap.qc.ts)], ['Factory Head', ap.head && ap.head.by, ap.head && fd(ap.head.ts)]]);
    footers(doc, `Inspection report ${c.id} - ${j.customer || ''} - generated ${fdt(Date.now())}`);
    return doc.output('blob');
  }

  /* ---- one work order: all castings and the heat results ---- */
  async function job(no) {
    const j = QI.job(no); if (!j) throw new Error('Work order not found');
    const J = await lib(); const doc = new J({ unit: 'mm', format: 'a4' });
    const cs = QI.jobCastings(no), heats = [];
    cs.forEach((c) => { if (c.heatNo && !heats.includes(c.heatNo)) heats.push(c.heatNo); });
    const rel = cs.filter((c) => c.status === 'released').length, rej = cs.filter((c) => c.status === 'rejected').length;
    let y = frame(doc, 'Inspection Summary', [j.no, fd(Date.now())]);
    y = kv(doc, y, [['Customer', j.customer, 'PO / order no.', j.po], ['Part', j.part, 'Drawing / Pattern', (j.drawing || '') + ' / ' + (j.pattern || '')], ['Material grade', j.grade, 'Order qty', j.qty || '-'],
      ['Castings made', String(cs.length), 'Released / Rejected', rel + ' / ' + rej]]);
    doc.autoTable({ startY: y, head: [['Serial no.', 'Heat', 'Current position', 'Status', 'Released on']],
      body: cs.map((c) => { const s = QI.castingState(c); return [c.id, c.heatNo || '-', t(s.label), c.status === 'released' ? 'Released' : c.status === 'rejected' ? 'Rejected' : 'In process', c.status === 'released' ? fd(c.release.ts) : '-']; }),
      theme: 'grid', styles: { fontSize: 8, cellPadding: 1.6, lineColor: LINE, lineWidth: 0.2, textColor: INK }, headStyles: { fillColor: INK, textColor: 255 }, margin: { left: 14, right: 14 },
      didParseCell: (d) => { if (d.section === 'body' && d.column.index === 3) { if (d.cell.raw === 'Rejected') d.cell.styles.textColor = BAD; if (d.cell.raw === 'Released') d.cell.styles.textColor = OK; } } });
    y = doc.lastAutoTable.finalY + 6;
    if (heats.length) {
      const hrows = [];
      heats.forEach((hn) => {
        const hh = QI.heat(hn) || {};
        [['4.2.1', 'Final chemistry'], ['4.3.1', 'Tapping temperature'], ['4.4.1', 'Pouring temperature'], ['8.1.1', 'Mechanical (tensile / impact)'], ['8.3.1', 'Hardness']].forEach(([id, lab]) => {
          const a = QI.last('heat', hn, id); if (!a) return;
          hrows.push([hn + (hh.date ? '\n' + hh.date : ''), lab, t((a.summary || '') + (a.detail ? '\n' + a.detail : '')), a.result === 'ok' ? 'OK' : 'NOT OK', t(a.by + '\n' + fd(a.ts))]);
        });
      });
      if (hrows.length) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...INK); if (y > 255) { doc.addPage(); y = 20; } doc.text('Heat results (chemistry, temperatures, mechanical)', 14, y); y += 2;
        doc.autoTable({ startY: y, head: [['Heat', 'Test', 'Result', 'Status', 'By / date']], body: hrows, theme: 'grid', styles: { fontSize: 7.5, cellPadding: 1.5, lineColor: LINE, lineWidth: 0.2, textColor: INK },
          headStyles: { fillColor: INK, textColor: 255 }, columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 38 }, 3: { cellWidth: 16 }, 4: { cellWidth: 30 } },
          didParseCell: (d) => { if (d.section === 'body' && d.column.index === 3) { if (d.cell.raw === 'NOT OK') { d.cell.styles.textColor = BAD; d.cell.styles.fontStyle = 'bold'; } else d.cell.styles.textColor = OK; } }, margin: { left: 14, right: 14 } });
        y = doc.lastAutoTable.finalY + 6;
      }
    }
    sign(doc, y, [['Prepared by', '', ''], ['Issued by', '', ''], ['Approved by', '', '']]);
    footers(doc, `Inspection summary ${j.no} - ${j.customer || ''} - generated ${fdt(Date.now())}`);
    return doc.output('blob');
  }
  window.PDFREPORT = { casting, job, t };
})();
