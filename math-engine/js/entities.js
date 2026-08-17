/**
 * entities.js — Math entity classes
 * Each entity exposes:
 *   .getSummary()  → string for result box
 *   .getPlotData(xMin, xMax) → array of { xs, ys, label, color } OR null for matrix
 *   .getMatrixHTML() → HTML string (Matrix only) or null
 */

const PALETTE = [
  '#00C8F0','#FF6B8A','#06D6A0','#FFD166','#A78BFA',
  '#FB923C','#7DF9FF','#F9C74F','#43AA8B','#FF4D6D'
];

// ── helpers ──────────────────────────────────────────────────────────────────
function prepExpr(str) {
  let s = str.trim();
  // Pipe-style absolute value: |x| -> abs(x), innermost pairs first
  while (/\|([^|]*)\|/.test(s)) {
    s = s.replace(/\|([^|]*)\|/g, 'abs($1)');
  }
  return s;
}

function safeEval(expr, scope = {}) {
  try { return math.evaluate(prepExpr(expr), scope); }
  catch { return NaN; }
}

function filterDiscontinuities(ys, threshold = 5) {
  const result = [...ys];
  for (let i = 1; i < result.length; i++) {
    if (isFinite(result[i]) && isFinite(result[i - 1])) {
      const jump = Math.abs(result[i] - result[i - 1]);
      const scale = Math.max(Math.abs(result[i]), Math.abs(result[i - 1]), 1);
      if (jump > scale * threshold && jump > 1) {
        result[i] = NaN;
      }
    }
  }
  return result;
}

function linspace(a, b, n = 1200) {
  const arr = [];
  const step = (b - a) / (n - 1);
  for (let i = 0; i < n; i++) arr.push(a + i * step);
  return arr;
}

// ── ExplicitEntity ────────────────────────────────────────────────────────────
class ExplicitEntity {
  constructor(raw) { this.raw = raw; }

  getPlotData(xMin, xMax) {
    const formulas = this.raw.split(';').map(f => f.trim()).filter(Boolean);
    const xs = linspace(xMin, xMax, 1200);
    return formulas.map((formula, i) => {
      let clean = formula.replace(/^\s*y\s*=\s*/i, '').trim();
      try {
        const ys = xs.map(x => {
          const v = safeEval(clean, { x });
          return isFinite(v) ? v : NaN;
        });
        return { xs, ys: filterDiscontinuities(ys), label: formula, color: PALETTE[i % PALETTE.length] };
      } catch {
        return { xs, ys: xs.map(() => NaN), label: formula, color: PALETTE[i % PALETTE.length] };
      }
    });
  }

  getSummary() {
    const formulas = this.raw.split(';').map(f => f.trim()).filter(Boolean);
    const parts = formulas.map(f => {
      let clean = f.replace(/^\s*y\s*=\s*/i, '').trim();
      try {
        const expr     = math.parse(prepExpr(clean));
        const derivNode = math.derivative(expr, 'x');
        const d = derivNode.toString();
        // Integral: attempt numeric notation
        return `f(x) = ${clean}\nf'(x) = ${d}\n∫f dx  ≈ (numeric, see graph)`;
      } catch {
        return `${clean} — parse error`;
      }
    });
    return parts.join('\n\n');
  }

  getMatrixHTML() { return null; }
}

// ── MatrixEntity ──────────────────────────────────────────────────────────────
class MatrixEntity {
  constructor(raw) { this.raw = raw; }

  _parseMatrix() {
    // Parse [[a,b],[c,d]] safely
    const data = JSON.parse(this.raw.replace(/\s+/g, ''));
    return math.matrix(data);
  }

  getPlotData() { return null; }

  getSummary() {
    try {
      const M    = this._parseMatrix();
      const det  = math.det(M);
      const rank = math.rank ? math.rank(M) : '—';
      const tr   = math.trace(M);
      return `Det = ${math.format(det, { precision: 6 })}\nTrace = ${math.format(tr, { precision: 6 })}`;
    } catch (e) {
      return `Matrix error: ${e.message}`;
    }
  }

  getMatrixHTML() {
    try {
      const M    = this._parseMatrix();
      const data = M.toArray();
      const rows = data.length;
      const cols = data[0].length;
      const det  = math.det(M);
      const tr   = math.trace(M);
      let invHTML = '';
      try {
        const inv  = math.inv(M);
        const invArr = inv.toArray();
        invHTML = `<div class="matrix-row"><span class="matrix-key">Inverse</span><span class="matrix-val">${
          invArr.map(r => '[' + r.map(v => math.format(v, {precision:4})).join(', ') + ']').join(' ')
        }</span></div>`;
      } catch { invHTML = `<div class="matrix-row"><span class="matrix-key">Inverse</span><span class="matrix-val" style="color:var(--red)">Singular (no inverse)</span></div>`; }

      // Eigenvalues
      let eigenHTML = '';
      try {
        const eig = math.eigs(M);
        const vals = eig.values.toArray ? eig.values.toArray() : eig.values;
        const vecs = eig.eigenvectors || [];
        eigenHTML = `<div class="matrix-row"><span class="matrix-key">Eigenvalues</span><span class="matrix-ev">${
          vals.map(v => math.format(v, {precision:4})).join(',  ')
        }</span></div>`;
        vecs.forEach((ev, idx) => {
          if (ev && ev.vector) {
            const vec = ev.vector.toArray ? ev.vector.toArray() : ev.vector;
            eigenHTML += `<div class="matrix-row" style="padding-left:16px"><span class="matrix-key" style="min-width:76px">λ=${math.format(vals[idx],{precision:3})} →</span><span class="matrix-ev">[${vec.map(v=>math.format(v,{precision:3})).join(', ')}]</span></div>`;
          }
        });
      } catch { eigenHTML = `<div class="matrix-row"><span class="matrix-key">Eigenvalues</span><span class="matrix-val" style="color:var(--text-dim)">Unavailable</span></div>`; }

      return `
        <div class="matrix-card">
          <div class="matrix-title">Matrix Analysis — ${rows}×${cols}</div>
          <div class="matrix-row"><span class="matrix-key">Input</span><span class="matrix-val">${data.map(r=>'['+r.join(', ')+']').join('  ')}</span></div>
          <div class="matrix-row"><span class="matrix-key">Determinant</span><span class="matrix-val">${math.format(det,{precision:8})}</span></div>
          <div class="matrix-row"><span class="matrix-key">Trace</span><span class="matrix-val">${math.format(tr,{precision:8})}</span></div>
          <div class="matrix-row"><span class="matrix-key">Shape</span><span class="matrix-val">${rows} × ${cols}</span></div>
          ${invHTML}
          ${eigenHTML}
        </div>`;
    } catch (e) {
      return `<div class="matrix-card" style="color:var(--red)">Matrix parse error: ${e.message}</div>`;
    }
  }
}

// ── ImplicitEntity ────────────────────────────────────────────────────────────
class ImplicitEntity {
  constructor(raw) { this.raw = raw; }

  getPlotData(xMin, xMax) {
    // Build a sampled grid and return contour approximation as a polyline set
    const N  = 300;
    const xs = linspace(xMin, xMax, N);
    const ys = linspace(xMin, xMax, N);

    let lhs, rhs;
    if (this.raw.includes('=')) {
      [lhs, rhs] = this.raw.split('=').map(s => prepExpr(s.trim()));
    } else {
      lhs = prepExpr(this.raw);
      rhs = '0';
    }

    // Z[i][j] = f(xs[j], ys[i]) - rhs
    const Z = ys.map(y =>
      xs.map(x => {
        const l = safeEval(lhs, { x, y });
        const r = safeEval(rhs, { x, y });
        if (!isFinite(l) || !isFinite(r)) return NaN;
        return l - r;
      })
    );

    // Marching-squares light: collect sign-change segments
    const segments = [];
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; j < N - 1; j++) {
        const pts = [
          { x: xs[j],   y: ys[i],   v: Z[i][j]   },
          { x: xs[j+1], y: ys[i],   v: Z[i][j+1] },
          { x: xs[j+1], y: ys[i+1], v: Z[i+1][j+1] },
          { x: xs[j],   y: ys[i+1], v: Z[i+1][j]   },
        ];
        const edges = [[0,1],[1,2],[2,3],[3,0]];
        const crosses = [];
        edges.forEach(([a,b]) => {
          if (isFinite(pts[a].v) && isFinite(pts[b].v) && pts[a].v * pts[b].v < 0) {
            const t = pts[a].v / (pts[a].v - pts[b].v);
            crosses.push({ x: pts[a].x + t*(pts[b].x - pts[a].x), y: pts[a].y + t*(pts[b].y - pts[a].y) });
          }
        });
        if (crosses.length === 2) {
          segments.push(crosses);
        }
      }
    }

    // Convert segments to interleaved NaN-separated polyline
    const pxs = [], pys = [];
    segments.forEach(([p, q]) => {
      pxs.push(p.x, q.x, NaN);
      pys.push(p.y, q.y, NaN);
    });

    return [{ xs: pxs, ys: pys, label: `Implicit: ${this.raw}`, color: PALETTE[2] }];
  }

  getSummary() { return `Implicit curve:\n${this.raw}`; }
  getMatrixHTML() { return null; }
}

// ── PolarEntity ───────────────────────────────────────────────────────────────
class PolarEntity {
  constructor(raw) { this.raw = raw; }

  getPlotData() {
    const N = 2000;
    const thetas = linspace(0, 4 * Math.PI, N);
    const exprStr = prepExpr(this.raw.trim());

    const xs = [], ys = [];
    thetas.forEach(theta => {
      const r = safeEval(exprStr, { theta });
      if (isFinite(r)) {
        xs.push(r * Math.cos(theta));
        ys.push(r * Math.sin(theta));
      } else {
        xs.push(NaN);
        ys.push(NaN);
      }
    });

    return [{ xs, ys, label: `Polar: r = ${exprStr}`, color: PALETTE[4] }];
  }

  getSummary() { return `Polar equation:\nr = ${this.raw}`; }
  getMatrixHTML() { return null; }
}

// ── ParametricEntity ──────────────────────────────────────────────────────────
class ParametricEntity {
  constructor(raw) { this.raw = raw; }

  getPlotData() {
    const parts = this.raw.split(';').map(p => p.trim());
    if (parts.length < 2) return [{ xs: [], ys: [], label: 'Need x=f(t); y=g(t)', color: PALETTE[5] }];

    const N  = 2000;
    const ts = linspace(-4 * Math.PI, 4 * Math.PI, N);
    const xs = [], ys = [];

    ts.forEach(t => {
      const x = safeEval(parts[0], { t });
      const y = safeEval(parts[1], { t });
      xs.push(isFinite(x) ? x : NaN);
      ys.push(isFinite(y) ? y : NaN);
    });

    return [{ xs, ys, label: `Param: (${parts[0]}, ${parts[1]})`, color: PALETTE[5] }];
  }

  getSummary() { return `Parametric:\n${this.raw}`; }
  getMatrixHTML() { return null; }
}

// ── Factory ───────────────────────────────────────────────────────────────────
function buildEntity(type, payload) {
  switch (type) {
    case 'polar':       return new PolarEntity(payload);
    case 'parametric':  return new ParametricEntity(payload);
    case 'matrix':      return new MatrixEntity(payload);
    case 'implicit':    return new ImplicitEntity(payload);
    default:            return new ExplicitEntity(payload);
  }
}
