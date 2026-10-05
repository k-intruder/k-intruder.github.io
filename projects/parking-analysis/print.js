/*
 * Print / PDF support shared by the parking analysis overview and reports.
 *
 * - Any element with [data-print] triggers printing. If the report has its own
 *   #printBtn (7·8월: optional detail table), that button is used instead so its
 *   print options keep working.
 * - Plotly charts are drawn for the screen width; before printing they are
 *   shrunk to fit an A4 portrait page and restored afterwards.
 * - window.ReportPrint.before / .after accept extra hooks (e.g. switching theme).
 */
(function () {
  const PRINT_WIDTH = 680; // A4 portrait minus ~10mm margins, in CSS px
  const PRINT_MAX_HEIGHT = 290;
  const hooks = {before: [], after: []};
  let resized = [];

  function plots() {
    return window.Plotly ? Array.from(document.querySelectorAll('.js-plotly-plot')) : [];
  }

  function fitForPrint() {
    resized = [];
    plots().forEach((el) => {
      const {width, height} = el.getBoundingClientRect();
      if (!width) return;
      resized.push(el);
      try {
        Plotly.relayout(el, {width: Math.min(width, PRINT_WIDTH), height: Math.min(height, PRINT_MAX_HEIGHT), autosize: false});
      } catch (e) { /* skip */ }
    });
  }

  function restoreAfterPrint() {
    resized.forEach((el) => {
      try {
        Plotly.relayout(el, {width: null, height: null, autosize: true}).then(() => Plotly.Plots.resize(el));
      } catch (e) { /* skip */ }
    });
    resized = [];
  }

  function run(list) {
    list.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  }

  window.addEventListener('beforeprint', () => { run(hooks.before); fitForPrint(); });
  window.addEventListener('afterprint', () => { run(hooks.after); restoreAfterPrint(); });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-print]');
    if (!trigger) return;
    const own = document.getElementById('printBtn');
    if (own && own !== trigger) {
      own.click();
    } else {
      window.print();
    }
  });

  const style = document.createElement('style');
  style.textContent = `
    @media print {
      .report-nav, [data-print] { display: none !important; }
      .js-plotly-plot, .card, .panel, .chart-card, .kpi { break-inside: avoid; page-break-inside: avoid; }
      .chart, .chart.short, .chart.tall { height: auto !important; }
      .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 8px !important; }
      .kpi { padding: 10px 12px !important; }
      h2, h3, .section-title, .section-head { break-after: avoid; page-break-after: avoid; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }`;
  document.head.append(style);

  window.ReportPrint = hooks;
})();
