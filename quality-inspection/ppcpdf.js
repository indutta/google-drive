/* DCL – reads a PDF in the browser and returns the position of every word on its first pages (input for ppcparse.js).
   Uses pdf.js, loaded from cdnjs the first time a PDF is uploaded (internet needed for that one step). */
(function () {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  let loading = null;
  function loadLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (loading) return loading;
    loading = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => { if (!window.pdfjsLib) return no(new Error('pdf.js did not start')); window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; ok(window.pdfjsLib); };
      s.onerror = () => { loading = null; no(new Error('Could not load the PDF reader. Check the internet connection and try again.')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  /* one pdf.js text item can hold several words: split it and spread the words over the item's width */
  function wordsOf(item, height) {
    const str = item.str; if (!str || !str.trim()) return [];
    const x0 = item.transform[4], w = item.width || 0, top = height - item.transform[5] - (item.height || Math.abs(item.transform[3]) || 0);
    const out = []; const re = /\S+/g; let m;
    while ((m = re.exec(str))) out.push({ x: x0 + w * (m.index / str.length), y: top, w: w * (m[0].length / str.length), s: m[0] });
    return out;
  }
  async function read(buffer, maxPages) {
    const lib = await loadLib();
    const pdf = await lib.getDocument({ data: buffer }).promise;
    const pages = [];
    for (let n = 1; n <= Math.min(pdf.numPages, maxPages || 4); n++) {
      const page = await pdf.getPage(n); const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent(); const items = [];
      tc.items.forEach((it) => wordsOf(it, vp.height).forEach((w) => items.push(w)));
      pages.push(items);
    }
    return pages;
  }
  window.PPCPDF = { read, wordsOf };
})();
