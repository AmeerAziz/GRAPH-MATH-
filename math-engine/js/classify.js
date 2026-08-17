/**
 * classify.js — Determine equation type from raw string
 * Returns { type, payload } where type is one of:
 *   'explicit' | 'matrix' | 'implicit' | 'polar' | 'parametric'
 */

function classify(raw) {
  const s   = raw.trim();
  const low = s.toLowerCase();

  if (low.startsWith('polar:')) {
    return { type: 'polar', payload: s.slice(6).trim() };
  }

  if (low.startsWith('param:')) {
    return { type: 'parametric', payload: s.slice(6).trim() };
  }

  if (s.startsWith('[[') && s.endsWith(']]')) {
    return { type: 'matrix', payload: s };
  }

  // Implicit: contains '=' with both x and y NOT starting with y=
  if (s.includes('=') && /[yY]/.test(s) && /[xX]/.test(s) && !low.startsWith('y=') && !low.startsWith('y =')) {
    return { type: 'implicit', payload: s };
  }

  return { type: 'explicit', payload: s };
}

function typeLabel(type, raw) {
  switch (type) {
    case 'polar':      return 'Polar  r = f(θ)';
    case 'parametric': return 'Parametric  x=f(t); y=g(t)';
    case 'matrix':     return 'Matrix  [[…],[…]]';
    case 'implicit':   return 'Implicit  f(x,y) = g(x,y)';
    default:
      if (raw.includes(';')) return 'Multi-plot  f(x); g(x); …';
      return 'Explicit  y = f(x)';
  }
}
