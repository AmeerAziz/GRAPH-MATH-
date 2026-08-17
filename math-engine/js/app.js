/**
 * app.js — Main application controller
 * Coordinates: input → classify → entity → grapher + DB + history
 */

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  let plotEntities = [];   // [{ eqId, type, entity, raw }]
  let eqCounter    = 0;
  let xMin         = -10;
  let xMax         =  10;

  const PALETTE = [
    '#00C8F0','#FF6B8A','#06D6A0','#FFD166','#A78BFA',
    '#FB923C','#7DF9FF','#F9C74F','#43AA8B','#FF4D6D'
  ];

  // ── DOM refs ───────────────────────────────────────────────────────────────
  let inputEl, typeBadge, eqIdDisplay, resultBox,
      historyList, activeEqsLabel, matrixOverlay,
      graphLoading, legendStrip;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    inputEl       = document.getElementById('eq-input');
    typeBadge     = document.getElementById('type-badge');
    eqIdDisplay   = document.getElementById('eq-id-display');
    resultBox     = document.getElementById('result-box');
    historyList   = document.getElementById('history-list');
    activeEqsLabel= document.getElementById('active-eqs-label');
    matrixOverlay = document.getElementById('matrix-overlay');
    graphLoading  = document.getElementById('graph-loading');
    legendStrip   = document.getElementById('legend-strip');

    // Init grapher
    Grapher.init(document.getElementById('graph-canvas'));

    // Build keypad
    buildKeypad('keypad', inputEl);

    // Input listeners
    inputEl.addEventListener('input',   updateTypeBadge);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') firePlot(false); });

    // Hint strip
    document.querySelectorAll('.hint').forEach(h => {
      h.addEventListener('click', () => {
        inputEl.value += h.dataset.insert;
        inputEl.focus();
        updateTypeBadge();
      });
    });

    // Buttons
    document.getElementById('btn-plot').addEventListener('click',           () => firePlot(false));
    document.getElementById('btn-add-overlay').addEventListener('click',    () => firePlot(true));
    document.getElementById('btn-clear').addEventListener('click',          clearAll);
    document.getElementById('btn-remove-last').addEventListener('click',    removeLast);
    document.getElementById('btn-apply-range').addEventListener('click',    applyRange);
    document.getElementById('btn-zoom-in').addEventListener('click',        () => { Grapher.zoomIn(); });
    document.getElementById('btn-zoom-out').addEventListener('click',       () => { Grapher.zoomOut(); });
    document.getElementById('btn-reset-view').addEventListener('click',     () => { Grapher.resetView(); });
    document.getElementById('btn-export-history').addEventListener('click', exportHistory);

    // Initial history load
    reloadHistory();
  }

  // ── Type badge ─────────────────────────────────────────────────────────────
  function updateTypeBadge() {
    const raw = inputEl.value.trim();
    if (!raw) { typeBadge.textContent = 'Explicit y = f(x)'; return; }
    const { type } = classify(raw);
    typeBadge.textContent = typeLabel(type, raw);

    // Color feedback
    const colors = {
      polar:       '#A78BFA',
      parametric:  '#FB923C',
      matrix:      '#06D6A0',
      implicit:    '#FFD166',
      explicit:    '#00C8F0',
    };
    typeBadge.style.color       = colors[type] || '#00C8F0';
    typeBadge.style.borderColor = (colors[type] || '#00C8F0').replace(')', ', 0.4)').replace('rgb', 'rgba');
  }

  // ── Next ID ────────────────────────────────────────────────────────────────
  function nextId() {
    eqCounter++;
    return `EQ-${String(eqCounter).padStart(4, '0')}`;
  }

  // ── Fire plot ──────────────────────────────────────────────────────────────
  function firePlot(overlay) {
    const raw = inputEl.value.trim();
    if (!raw) { showError('Enter an equation first.'); return; }

    if (!overlay) plotEntities = [];

    const { type, payload } = classify(raw);
    const eqId  = nextId();
    const entity = buildEntity(type, payload);

    showLoading(true);

    // Defer to allow UI to update before heavy computation
    setTimeout(() => {
      try {
        const summary = entity.getSummary();
        plotEntities.push({ eqId, type, entity, raw, payload });
        eqIdDisplay.textContent = eqId;
        setResult(summary);
        renderGraph();
        DB.log(eqId, raw, type, summary).then(reloadHistory);
      } catch (err) {
        showError(`Error: ${err.message}`);
      } finally {
        showLoading(false);
      }
    }, 20);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderGraph() {
    // Check if any matrix entity is present (last one wins for display)
    const lastEntry = plotEntities[plotEntities.length - 1];

    if (lastEntry && lastEntry.type === 'matrix') {
      matrixOverlay.classList.remove('hidden');
      matrixOverlay.innerHTML = lastEntry.entity.getMatrixHTML();
      // Still render any non-matrix entities behind
      const nonMatrix = plotEntities.filter(e => e.type !== 'matrix');
      Grapher.render(nonMatrix, xMin, xMax);
    } else {
      matrixOverlay.classList.add('hidden');
      Grapher.render(plotEntities, xMin, xMax);
    }

    updateActiveLabel();
    updateLegend();
  }

  function updateActiveLabel() {
    if (plotEntities.length === 0) {
      activeEqsLabel.textContent = 'No equations plotted';
    } else {
      activeEqsLabel.textContent = 'Active: ' + plotEntities.map(e => e.eqId).join(', ');
    }
  }

  function updateLegend() {
    legendStrip.innerHTML = '';
    plotEntities.forEach(({ eqId, raw, entity }, i) => {
      const color = PALETTE[i % PALETTE.length];
      const item  = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <div class="legend-dot" style="background:${color}"></div>
        <span style="color:${color};font-size:9px">${eqId}</span>
        <span style="color:#4A6A80;margin-left:2px">${truncate(raw, 28)}</span>
      `;
      legendStrip.appendChild(item);
    });
  }

  // ── Clear / Remove ─────────────────────────────────────────────────────────
  function clearAll() {
    plotEntities = [];
    matrixOverlay.classList.add('hidden');
    Grapher.clear();
    updateActiveLabel();
    updateLegend();
    setResult('');
    eqIdDisplay.textContent = 'EQ-0000';
  }

  function removeLast() {
    if (plotEntities.length === 0) return;
    plotEntities.pop();
    renderGraph();
    if (plotEntities.length === 0) {
      matrixOverlay.classList.add('hidden');
      setResult('');
      eqIdDisplay.textContent = 'EQ-0000';
    }
  }

  // ── Range ─────────────────────────────────────────────────────────────────
  function applyRange() {
    const mn = parseFloat(document.getElementById('x-min').value);
    const mx = parseFloat(document.getElementById('x-max').value);
    if (isNaN(mn) || isNaN(mx) || mn >= mx) {
      showError('X range: min must be less than max.');
      return;
    }
    xMin = mn;
    xMax = mx;
    Grapher.setXRange(xMin, xMax);
    if (plotEntities.length > 0) renderGraph();
  }

  // ── History ────────────────────────────────────────────────────────────────
  async function reloadHistory() {
    const rows = await DB.fetchHistory(40);
    historyList.innerHTML = '';
    rows.forEach(row => {
      const li = document.createElement('li');
      li.className = 'history-item';
      li.innerHTML = `
        <span class="h-id">${row.equation_id}</span>
        <span class="h-type">${row.expr_type.slice(0, 6)}</span>
        <span class="h-expr">${escapeHtml(row.expression)}</span>
      `;
      li.addEventListener('click', () => {
        inputEl.value = row.expression;
        updateTypeBadge();
        inputEl.focus();
      });
      historyList.appendChild(li);
    });
  }

  async function exportHistory() {
    const csv  = await DB.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `math_engine_log_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function setResult(text) {
    if (!text) {
      resultBox.innerHTML = '<span class="result-placeholder">Plot an equation to see derivative &amp; integral</span>';
    } else {
      resultBox.textContent = text;
    }
  }

  function showLoading(on) {
    graphLoading.classList.toggle('hidden', !on);
  }

  function showError(msg) {
    resultBox.textContent = '⚠ ' + msg;
    resultBox.style.color = '#EF4565';
    setTimeout(() => { resultBox.style.color = ''; }, 2000);
  }

  function truncate(str, n) {
    return str.length > n ? str.slice(0, n) + '…' : str;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init };
})();

// ── Boot ───────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
