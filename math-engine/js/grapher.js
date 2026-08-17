/**
 * grapher.js — Canvas-based graphing engine using Chart.js
 * Handles multi-equation overlay, implicit curve rendering via custom plugin
 */

const Grapher = (() => {
  let chartInstance = null;
  let canvas        = null;
  let ctx           = null;

  // Current view bounds
  let viewXMin = -10, viewXMax = 10;
  let viewYMin = -10, viewYMax = 10;

  // Stored implicit segment sets (drawn by custom plugin)
  let implicitSegments = [];

  // ── Chart.js custom plugin for axes + implicit curves ──────────────────────
  const axesPlugin = {
    id: 'mathAxes',
    afterDraw(chart) {
      const { ctx: c, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart;
      c.save();

      // Draw x and y axis lines
      const zeroX = x.getPixelForValue(0);
      const zeroY = y.getPixelForValue(0);

      c.strokeStyle = '#3A5A7C';
      c.lineWidth = 1.5;

      // Y-axis
      if (zeroX >= left && zeroX <= right) {
        c.beginPath();
        c.moveTo(zeroX, top);
        c.lineTo(zeroX, bottom);
        c.stroke();
      }

      // X-axis
      if (zeroY >= top && zeroY <= bottom) {
        c.beginPath();
        c.moveTo(left, zeroY);
        c.lineTo(right, zeroY);
        c.stroke();
      }

      // ── Draw implicit curve segments ──
      implicitSegments.forEach(({ xs, ys, color }) => {
        c.strokeStyle = color;
        c.lineWidth = 2.2;
        c.beginPath();
        let drawing = false;
        for (let i = 0; i < xs.length; i++) {
          if (isNaN(xs[i]) || isNaN(ys[i])) {
            drawing = false;
            continue;
          }
          const px = x.getPixelForValue(xs[i]);
          const py = y.getPixelForValue(ys[i]);
          if (!drawing) { c.moveTo(px, py); drawing = true; }
          else            c.lineTo(px, py);
        }
        c.stroke();
      });

      c.restore();
    }
  };

  function buildChartData(plotDataSets) {
    implicitSegments = [];
    const datasets = [];

    plotDataSets.forEach(({ xs, ys, label, color, isImplicit }) => {
      if (isImplicit) {
        // Stored for custom plugin rendering
        implicitSegments.push({ xs, ys, color });
        // Phantom dataset to get it into the legend
        datasets.push({
          label,
          data: [],
          borderColor: color,
          borderWidth: 2,
          pointRadius: 0,
        });
        return;
      }

      // Chart.js expects { x, y } pairs; NaN values break the line
      const data = [];
      for (let i = 0; i < xs.length; i++) {
        data.push({ x: xs[i], y: isFinite(ys[i]) ? ys[i] : null });
      }

      datasets.push({
        label,
        data,
        borderColor: color,
        borderWidth: 2.2,
        pointRadius: 0,
        spanGaps: false,
        tension: 0,
        parsing: false,
      });
    });

    return { datasets };
  }

  function init(canvasEl) {
    canvas = canvasEl;
    ctx    = canvas.getContext('2d');
    Chart.register(axesPlugin);
    _createChart([]);
  }

  function _createChart(plotDataSets) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    const data = buildChartData(plotDataSets);

    chartInstance = new Chart(ctx, {
      type: 'line',
      data,
      options: {
        animation: { duration: 180 },
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false },
        plugins: {
          legend: {
            display: false,   // we render our own legend strip
          },
          tooltip: {
            enabled: true,
            backgroundColor: '#0B1526',
            borderColor: '#1A3A58',
            borderWidth: 1,
            titleColor: '#A8BFCF',
            bodyColor: '#00C8F0',
            titleFont: { family: 'JetBrains Mono', size: 10 },
            bodyFont:  { family: 'JetBrains Mono', size: 11 },
            callbacks: {
              title: items => `x = ${items[0].parsed.x.toFixed(4)}`,
              label: item  => `${item.dataset.label}: y = ${item.parsed.y !== null ? item.parsed.y.toFixed(4) : 'undef'}`,
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            min: viewXMin,
            max: viewXMax,
            grid: { color: '#1A3A58', lineWidth: 0.8 },
            ticks: { color: '#4A6A80', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 12 },
            border: { color: '#1A3A58' },
          },
          y: {
            type: 'linear',
            min: viewYMin,
            max: viewYMax,
            grid: { color: '#1A3A58', lineWidth: 0.8 },
            ticks: { color: '#4A6A80', font: { family: 'JetBrains Mono', size: 9 }, maxTicksLimit: 10 },
            border: { color: '#1A3A58' },
          }
        }
      },
      plugins: [axesPlugin],
    });
  }

  function render(allEntities, xMin, xMax) {
    viewXMin = xMin;
    viewXMax = xMax;

    const allPlotData = [];
    allEntities.forEach(({ entity }) => {
      const pd = entity.getPlotData(xMin, xMax);
      if (pd) {
        pd.forEach(d => {
          // tag implicit for custom plugin
          const isImplicit = entity instanceof ImplicitEntity;
          allPlotData.push({ ...d, isImplicit });
        });
      }
    });

    // Auto-scale Y
    let yMin = Infinity, yMax = -Infinity;
    allPlotData.forEach(({ ys }) => {
      ys.forEach(v => {
        if (isFinite(v)) { if (v < yMin) yMin = v; if (v > yMax) yMax = v; }
      });
    });

    if (isFinite(yMin) && isFinite(yMax) && yMin !== yMax) {
      const pad = (yMax - yMin) * 0.12;
      viewYMin = yMin - pad;
      viewYMax = yMax + pad;
    } else {
      viewYMin = -10;
      viewYMax =  10;
    }

    _createChart(allPlotData);
  }

  function clear() {
    implicitSegments = [];
    _createChart([]);
  }

  function zoomIn()    { _zoom(0.65); }
  function zoomOut()   { _zoom(1.5); }
  function resetView() { viewXMin = -10; viewXMax = 10; viewYMin = -10; viewYMax = 10; _applyView(); }

  function _zoom(factor) {
    const cx = (viewXMin + viewXMax) / 2;
    const cy = (viewYMin + viewYMax) / 2;
    const hw = (viewXMax - viewXMin) / 2 * factor;
    const hh = (viewYMax - viewYMin) / 2 * factor;
    viewXMin = cx - hw; viewXMax = cx + hw;
    viewYMin = cy - hh; viewYMax = cy + hh;
    _applyView();
  }

  function _applyView() {
    if (!chartInstance) return;
    chartInstance.options.scales.x.min = viewXMin;
    chartInstance.options.scales.x.max = viewXMax;
    chartInstance.options.scales.y.min = viewYMin;
    chartInstance.options.scales.y.max = viewYMax;
    chartInstance.update('none');
  }

  function setXRange(xMin, xMax) {
    viewXMin = xMin;
    viewXMax = xMax;
  }
  

  return { init, render, clear, zoomIn, zoomOut, resetView, setXRange };
})();
