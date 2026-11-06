// The drafting layers for the roof-plan opening.
//
//   roof    sheets A3.1 + A3.2: slope labels and arrows on every roof plane, the
//           window well, overall dimensions and the drawing title. It floats flat
//           just above the ridges, so from straight overhead it lies on the roofs.
//   upper   sheet A1.3: the second-floor room names, lying on the second floor and
//           cut away by the same plane as the walls, plus the drawing title.

import * as THREE from 'three';
import { FT, INK, ACCENT, F2, LABELS_UP, LABELS_BASE, BASE_FLOOR } from './plan.js';
import { CUT } from './materials.js';

const MONO = '"Plex Mono", ui-monospace, Menlo, monospace';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
const PXM = 150;
const YR = 33.5; // the roof layer, ft (the highest ridge is 31'-8")

const ROOF_LABELS = [
  // 12/12 gables over the west and east blocks: two labels on each plane
  ...[22, 7].flatMap((N) => [
    { t: '12/12', X: 4.2, N, dir: [-1, 0] }, { t: '12/12', X: 12.4, N, dir: [1, 0] },
    { t: '12/12', X: 36.2, N, dir: [-1, 0] }, { t: '12/12', X: 49.8, N, dir: [1, 0] },
  ]),
  { t: '8/12', X: 23.2, N: 17.4, dir: [0, 1] }, { t: '8/12', X: 23.2, N: 10.6, dir: [0, -1] }, // the middle
  { t: '3/12', X: 8.5, N: -5.6, dir: [0, -1] }, { t: '3/12', X: 35.0, N: -5.6, dir: [0, -1] }, // the porch
  { t: '4/12', X: 50.0, N: -15.6, dir: [-1, 0] }, { t: '4/12', X: 54.4, N: -15.6, dir: [1, 0] }, // the grilling area
  { t: '8/12', X: 5.6, N: 44.0, dir: [-1, 0] }, { t: '8/12', X: 17.4, N: 44.0, dir: [1, 0] }, // the garage
];

export function buildUpper({ anisotropy = 8 } = {}) {
  const roof = { group: new THREE.Group(), mats: [] };
  const upper = { group: new THREE.Group(), mats: [] };
  const lower = { group: new THREE.Group(), mats: [] };

  function text(layer, rows, { X, N, y, align = 'center', color = ACCENT, clip = false }) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const specs = rows.map((r) => {
      const px = r.size * FT * PXM;
      return { ...r, px, font: `${r.weight ?? 500} ${px}px ${r.font ?? MONO}`, lead: px * (r.lead ?? 1.25) };
    });
    let w = 0, h = 0;
    for (const s of specs) {
      g.font = s.font;
      if ('letterSpacing' in g) g.letterSpacing = (s.track ?? 0.08) * s.px + 'px';
      s.w = g.measureText(s.t).width;
      w = Math.max(w, s.w);
      h += s.lead;
    }
    const pad = 10;
    c.width = Math.ceil(w + pad * 2);
    c.height = Math.ceil(h + pad * 2);
    let yy = pad;
    for (const s of specs) {
      g.font = s.font;
      if ('letterSpacing' in g) g.letterSpacing = (s.track ?? 0.08) * s.px + 'px';
      g.fillStyle = s.color ?? color;
      g.globalAlpha = s.alpha ?? 1;
      g.textBaseline = 'middle';
      g.fillText(s.t, align === 'center' ? (c.width - s.w) / 2 : pad, yy + s.lead / 2);
      yy += s.lead;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    if (clip) mat.clippingPlanes = [CUT];
    layer.mats.push([mat, 1]);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(c.width / PXM, c.height / PXM), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(X * FT + (align === 'left' ? c.width / PXM / 2 : 0), y * FT, -N * FT);
    m.renderOrder = 8;
    layer.group.add(m);
    return m;
  }

  function lines(layer, arr, color, opacity, clip = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false });
    if (clip) mat.clippingPlanes = [CUT];
    layer.mats.push([mat, opacity]);
    const l = new THREE.LineSegments(g, mat);
    l.renderOrder = 8;
    layer.group.add(l);
  }
  const P = (X, N, y) => [X * FT, y * FT, -N * FT];

  // ---- the roof plan --------------------------------------------------------------
  const red = [], ink = [];
  const seg = (arr, X0, N0, X1, N1, y = YR) => arr.push(...P(X0, N0, y), ...P(X1, N1, y));
  const arrow = (X, N, [dx, dn], len = 2.4) => {
    const x0 = X - (dx * len) / 2, n0 = N - (dn * len) / 2, x1 = X + (dx * len) / 2, n1 = N + (dn * len) / 2;
    seg(red, x0, n0, x1, n1);
    const a = Math.atan2(dn, dx);
    for (const s of [-1, 1]) seg(red, x1, n1, x1 - Math.cos(a + s * 0.5) * 0.75, n1 - Math.sin(a + s * 0.5) * 0.75);
  };
  for (const L of ROOF_LABELS) {
    text(roof, [{ t: L.t, size: 0.72 }, { t: 'SLOPE', size: 0.62 }], { X: L.X, N: L.N + 0.95, y: YR });
    arrow(L.X, L.N - 0.9, L.dir);
  }
  // the window well in the porch roof, in front of the foyer
  const [w0, w1] = [19.2, 27.2];
  seg(ink, w0, 0, w1, 0); seg(ink, w0, 5, w1, 5); seg(ink, w0, 0, w0, 5); seg(ink, w1, 0, w1, 5);
  seg(ink, w0, 0, w1, 5); seg(ink, w0, 5, w1, 0);
  text(roof, [{ t: 'WINDOW', size: 0.55 }, { t: 'WELL', size: 0.55 }], { X: 23.2, N: 2.5, y: YR, color: ACCENT });
  // overall dimensions, south of the deck and down the west side
  const yD = YR, nD = -23.5;
  const dimH = (X0, X1, t) => {
    seg(red, X0 - 0.5, nD, X1 + 0.5, nD);
    for (const X of [X0, X1]) { seg(red, X, nD - 0.7, X, nD + 0.7); seg(red, X - 0.4, nD - 0.4, X + 0.4, nD + 0.4); }
    text(roof, [{ t, size: 0.62, track: 0.02 }], { X: (X0 + X1) / 2, N: nD + 0.9, y: yD });
  };
  dimH(0, 16.67, "16'-8\"");
  dimH(16.67, 29.8, "13'-1½\"");
  dimH(29.8, 56.13, "26'-4\"");
  {
    const xD = -5.5;
    seg(red, xD, -0.5, xD, 32.83);
    for (const N of [0, 32.33]) { seg(red, xD - 0.7, N, xD + 0.7, N); seg(red, xD - 0.4, N - 0.4, xD + 0.4, N + 0.4); }
    const m = text(roof, [{ t: "32'-4\"", size: 0.62, track: 0.02 }], { X: xD - 0.9, N: 16.2, y: yD });
    m.rotation.z = Math.PI / 2;
  }
  // the title, where the floor plan's title sits
  const tX = 2, tN = -30.5;
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, b = ((i + 1) / 40) * Math.PI * 2;
    seg(red, tX + Math.cos(a) * 1.6, tN + Math.sin(a) * 1.6, tX + Math.cos(b) * 1.6, tN + Math.sin(b) * 1.6);
  }
  text(roof, [{ t: '1', size: 1.2 }], { X: tX, N: tN, y: YR });
  text(roof, [
    { t: 'PROPOSED ROOF PLAN', size: 1.25, weight: 600, font: SANS, track: 0.02 },
    { t: 'SCALE: 1/4" = 1\'-0"  ·  A3.1 + A3.2', size: 0.6, color: INK, alpha: 0.75 },
  ], { X: 4.2, N: tN - 0.2, y: YR, align: 'left' });
  seg(red, 4.4, tN - 0.6, 38.5, tN - 0.6);
  lines(roof, red, ACCENT, 0.9);
  lines(roof, ink, INK, 0.7);

  // ---- the second floor -----------------------------------------------------------
  const yU = F2 + 0.03;
  for (const L of LABELS_UP) text(upper, [{ t: L.t, size: L.small ? 0.62 : 0.85, weight: 600, font: SANS, track: 0.06 }], { X: L.X, N: L.N, y: yU, color: ACCENT, clip: true });
  // the lower level's room names, on the basement floor
  for (const L of LABELS_BASE) text(lower, [{ t: L.t, size: L.small ? 0.62 : 0.85, weight: 600, font: SANS, track: 0.06 }], { X: L.X, N: L.N, y: BASE_FLOOR + 0.03, color: ACCENT, clip: true });
  text(upper, [{ t: 'UP / DN', size: 0.42 }], { X: 8.0, N: 20.6, y: yU, color: INK, clip: true });
  const ured = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, b = ((i + 1) / 40) * Math.PI * 2;
    ured.push(...P(tX + Math.cos(a) * 1.6, tN + Math.sin(a) * 1.6, yU), ...P(tX + Math.cos(b) * 1.6, tN + Math.sin(b) * 1.6, yU));
  }
  ured.push(...P(4.4, tN - 0.6, yU), ...P(38.5, tN - 0.6, yU));
  text(upper, [{ t: '1', size: 1.2 }], { X: tX, N: tN, y: yU, clip: true });
  text(upper, [
    { t: 'PROPOSED SECOND FLOOR PLAN', size: 1.25, weight: 600, font: SANS, track: 0.02 },
    { t: 'SCALE: 1/4" = 1\'-0"  ·  A1.3', size: 0.6, color: INK, alpha: 0.75 },
  ], { X: 4.2, N: tN - 0.2, y: yU, align: 'left', clip: true });
  lines(upper, ured, ACCENT, 0.9, true);

  const fade = (layer) => (f) => {
    layer.group.visible = f > 0.001;
    for (const [m, o] of layer.mats) m.opacity = o * f;
  };
  const group = new THREE.Group();
  group.add(roof.group, upper.group, lower.group);
  return { group, setRoof: fade(roof), setUpper: fade(upper), setLower: fade(lower) };
}
