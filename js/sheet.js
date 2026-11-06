// Everything a drafter adds to a plan that is not the building: room names,
// dimension strings, door swings, stair arrows, the north arrow and the drawing
// title. It all lies flat on the floor, the deck or the yard of the 3D model,
// so it is still in place when the camera comes down.

import * as THREE from 'three';
import { FT, INK, ACCENT, LABELS, SWINGS, LAWN, DECK, PROJECT } from './plan.js';

const MONO = '"Plex Mono", ui-monospace, Menlo, monospace';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
const PXM = 150; // canvas pixels per metre

export function buildSheet({ planesFor, anisotropy = 8 }) {
  const group = new THREE.Group();
  const lines = { ink: [], out: [] }; // floor lines inside the house, and on the deck / yard
  const labels = []; // { mesh, room }

  const seg = (set, X0, N0, X1, N1, y) => lines[set].push(X0 * FT, y * FT, -N0 * FT, X1 * FT, y * FT, -N1 * FT);

  // ---- text ---------------------------------------------------------------
  function text(rows, { room, X, N, y, rot = 0, align = 'center', color = INK, plan = false }) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const specs = rows.map((r) => {
      const px = r.size * FT * PXM; // size: cap height-ish in feet
      return { ...r, px, font: `${r.weight ?? 500} ${px}px ${r.font ?? MONO}`, lead: px * (r.lead ?? 1.35) };
    });
    let w = 0, h = 0;
    for (const s of specs) {
      g.font = s.font;
      if ('letterSpacing' in g) g.letterSpacing = (s.track ?? 0.08) * s.px + 'px';
      s.w = g.measureText(s.t).width;
      w = Math.max(w, s.w);
      h += s.lead;
    }
    const pad = 12;
    c.width = Math.ceil(w + pad * 2);
    c.height = Math.ceil(h + pad * 2);
    let yy = pad;
    for (const s of specs) {
      g.font = s.font;
      if ('letterSpacing' in g) g.letterSpacing = (s.track ?? 0.08) * s.px + 'px';
      g.fillStyle = s.color ?? color;
      g.globalAlpha = s.alpha ?? 1;
      g.textBaseline = 'middle';
      const tx = align === 'center' ? (c.width - s.w) / 2 : pad;
      g.fillText(s.t, tx, yy + s.lead / 2);
      yy += s.lead;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    mat.clippingPlanes = planesFor();
    const geo = new THREE.PlaneGeometry(c.width / PXM, c.height / PXM);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(-Math.PI / 2, 0, rot);
    const ox = align === 'left' ? c.width / PXM / 2 : 0;
    m.position.set(X * FT + ox, y * FT, -N * FT);
    m.renderOrder = 3;
    group.add(m);
    labels.push({ mesh: m, room, plan });
    return m;
  }

  // ---- room names ----------------------------------------------------------------
  for (const L of LABELS) {
    const y = L.room === 'out' ? DECK + 0.03 : 0.03;
    const yy = L.t === 'COVERED DECK' ? DECK + 0.03 : y;
    text(
      [
        { t: L.t, size: L.small ? 0.62 : 0.85, weight: 600, font: SANS, track: 0.06, color: ACCENT },
        { t: L.d, size: L.small ? 0.48 : 0.6, weight: 500, alpha: 0.8, track: 0.03, color: ACCENT },
      ],
      { room: L.room, X: L.X, N: L.N, y: yy }
    );
  }

  // stair notes
  text([{ t: 'UP TO 2ND FLOOR', size: 0.42, weight: 500 }], { room: 'great', X: 8.0, N: 20.5, y: 0.03 });
  text([{ t: 'UP', size: 0.42, weight: 500 }], { room: 'none', X: 32.8, N: 9.9, y: 0.03 });
  text([{ t: 'DN', size: 0.42, weight: 500 }], { room: 'none', X: 36.6, N: 9.9, y: 0.03 });
  // stair arrows
  const arrowPath = (set, pts, y) => {
    for (let i = 1; i < pts.length; i++) seg(set, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], y);
    const [a, b] = [pts[pts.length - 2], pts[pts.length - 1]];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (const s of [-1, 1]) seg(set, b[0], b[1], b[0] - Math.cos(ang + s * 0.45) * 0.8, b[1] - Math.sin(ang + s * 0.45) * 0.8, y);
  };
  arrowPath('ink', [[10.8, 23.36], [2.23, 23.36], [2.23, 14.0]], 0.03);
  arrowPath('ink', [[32.8, 11.4], [32.8, 19.5], [36.6, 19.5], [36.6, 16.5]], 0.03); // up, landing, back over
  arrowPath('ink', [[36.6, 11.4], [36.6, 15.6]], 0.03); // down to the basement, heading north

  // ---- door swings -----------------------------------------------------------------
  for (const s of SWINGS) {
    const a0 = (s.closed * Math.PI) / 180, a1 = (s.open * Math.PI) / 180;
    let d = a1 - a0;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const p = a0 + (d * i) / n, q = a0 + (d * (i + 1)) / n;
      if (i % 2 === 0) seg('ink', s.X + Math.cos(p) * s.r, s.N + Math.sin(p) * s.r, s.X + Math.cos(q) * s.r, s.N + Math.sin(q) * s.r, 0.03);
    }
  }

  // ---- dimension strings (on the yard) -------------------------------------------------
  const yD = 0.5; // above the ground everywhere round the house (it slopes from -0'-4" down to the lake)
  function dimH(X0, X1, N, label, side = 1) {
    seg('out', X0 - 0.6, N, X1 + 0.6, N, yD);
    for (const X of [X0, X1]) {
      seg('out', X, N - 0.8, X, N + 0.8, yD);
      seg('out', X - 0.45, N - 0.45, X + 0.45, N + 0.45, yD);
    }
    text([{ t: label, size: 0.62, weight: 500, track: 0.02 }], { room: 'out', X: (X0 + X1) / 2, N: N + side * 0.9, y: yD, plan: true });
  }
  function dimV(N0, N1, X, label, side = 1) {
    seg('out', X, N0 - 0.6, X, N1 + 0.6, yD);
    for (const N of [N0, N1]) {
      seg('out', X - 0.8, N, X + 0.8, N, yD);
      seg('out', X - 0.45, N - 0.45, X + 0.45, N + 0.45, yD);
    }
    text([{ t: label, size: 0.62, weight: 500, track: 0.02 }], { room: 'out', X: X + side * 0.9, N: (N0 + N1) / 2, y: yD, rot: Math.PI / 2, plan: true });
  }
  dimH(0, 23.0, 59.0, "23'-0\"");
  dimH(29.75, 56.1, 35.4, "26'-4\"");
  dimH(0, 48.3, -24.0, "48'-0\"", -1);
  dimH(48.3, 55.8, -24.0, "8'-1½\"", -1);
  dimV(0, 55.75, -4.0, "55'-9¼\"", -1);
  dimV(-11.83, 55.75, -7.5, "67'-7¼\"", -1);
  dimV(0, 32.25, 59.5, "32'-4\"");
  dimV(-17.83, 32.25, 63.0, "50'-2\"");

  // (no north arrow: Clayborn's sheet A1.2 doesn't carry one)

  // ---- drawing title, like the one on the sheet --------------------------------------
  const tX = 2, tN = -30.5;
  for (let i = 0; i < 40; i++) {
    const p = (i / 40) * Math.PI * 2, q = ((i + 1) / 40) * Math.PI * 2;
    seg('out', tX + Math.cos(p) * 1.6, tN + Math.sin(p) * 1.6, tX + Math.cos(q) * 1.6, tN + Math.sin(q) * 1.6, yD);
  }
  text([{ t: '1', size: 1.2, weight: 500, color: ACCENT }], { room: 'out', X: tX, N: tN, y: yD, plan: true });
  text(
    [
      { t: PROJECT.drawing.toUpperCase(), size: 1.25, weight: 600, font: SANS, color: ACCENT, track: 0.02 },
      { t: 'SCALE: ' + PROJECT.scale, size: 0.6, weight: 500, alpha: 0.75 },
    ],
    { room: 'out', X: 4.2, N: tN - 0.2, y: yD, align: 'left', plan: true }
  );
  seg('out', 4.4, tN - 0.6, 38.5, tN - 0.6, yD);

  // ---- line sets ---------------------------------------------------------------------------
  const mk = (arr, mat) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const l = new THREE.LineSegments(g, mat);
    l.renderOrder = 2;
    group.add(l);
    return l;
  };
  return { group, labels, mk, lines };
}
