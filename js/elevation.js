// The drafting layer for the elevation opening: sheet A2.1, "Proposed Front
// Elevation". It hangs on a vertical sheet just north of the garage, facing the
// street, so the real model behind it reads as the drawing: datum lines and
// their labels, the dimension chain, the ground cut away below grade with the
// basement dashed in, the retaining wall and the drawing title.
//
// Looking south at the house, east is on the viewer's LEFT. So in this file a
// bigger X is further left on the drawing.

import * as THREE from 'three';
import { FT, INK, ACCENT, F2, CEIL } from './plan.js';

const MONO = '"Plex Mono", ui-monospace, Menlo, monospace';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
const PXM = 150; // canvas pixels per metre
const NL = 59; // the sheet sits at N = 59 ft, between the garage and the street
const GREY = '#8f8f8f';

// levels from A2.1, in feet above the main floor finish
export const LEVELS = [
  { h: 31.75, t: 'TOP OF ROOF' },
  { h: 24.5, t: 'MIDDLE OF TRUSS' },
  { h: F2 + 8, t: 'SECOND FLOOR CEILING LINE' },
  { h: F2, t: 'SECOND FLOOR FINISH' },
  { h: CEIL, t: 'MAIN FLOOR CEILING LINE' },
  { h: 1.8, t: 'TOP OF REVERSE BRICK DROP' },
  { h: 1.1, t: 'TOP OF SOIL (PROPOSED GRADE)' },
  { h: 0, t: 'MAIN FLOOR FINISH' },
  { h: -9.17, t: 'BASEMENT FLOOR FINISH' },
];

export function buildElevation({ anisotropy = 8 } = {}) {
  const group = new THREE.Group();
  const mats = []; // everything that fades out together
  const P = (X, h, dn = 0) => [X * FT, h * FT, -(NL + dn) * FT];
  const ink = [], red = [], soft = [];
  const seg = (arr, X0, h0, X1, h1, dn = 0) => arr.push(...P(X0, h0, dn), ...P(X1, h1, dn));
  const dashed = (arr, X0, X1, h, on = 1.1, off = 0.6) => {
    for (let x = X0; x > X1; x -= on + off) seg(arr, x, h, Math.max(X1, x - on), h);
  };

  // ---- text, standing up and facing the street ------------------------------------
  function text(rows, { X, h, align = 'left', color = INK }) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const specs = rows.map((r) => {
      const px = r.size * FT * PXM;
      return { ...r, px, font: `${r.weight ?? 500} ${px}px ${r.font ?? MONO}`, lead: px * (r.lead ?? 1.3) };
    });
    let w = 0, ht = 0;
    for (const s of specs) {
      g.font = s.font;
      if ('letterSpacing' in g) g.letterSpacing = (s.track ?? 0.06) * s.px + 'px';
      s.w = g.measureText(s.t).width;
      w = Math.max(w, s.w);
      ht += s.lead;
    }
    const pad = 8;
    c.width = Math.ceil(w + pad * 2);
    c.height = Math.ceil(ht + pad * 2);
    let yy = pad;
    for (const s of specs) {
      g.font = s.font;
      if ('letterSpacing' in g) g.letterSpacing = (s.track ?? 0.06) * s.px + 'px';
      g.fillStyle = s.color ?? color;
      g.textBaseline = 'middle';
      g.fillText(s.t, align === 'center' ? (c.width - s.w) / 2 : pad, yy + s.lead / 2);
      yy += s.lead;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false });
    mats.push([mat, 1]);
    const wM = c.width / PXM, hM = c.height / PXM;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), mat);
    m.rotation.y = Math.PI; // face north, reading left to right for someone looking south
    // left-aligned text starts at X and reads towards smaller X (the viewer's right)
    const cx = align === 'center' ? X * FT : X * FT - wM / 2;
    m.position.set(cx, h * FT + hM / 2 - pad / PXM, -NL * FT + 0.01);
    m.renderOrder = 6;
    group.add(m);
    return m;
  }

  // ---- the ground, cut away below grade ---------------------------------------------
  // grade: soil up to the reverse brick drop along the east block, about level with the
  // floor along the middle and the garage
  const gnd = new THREE.Shape();
  const G = (X, h) => new THREE.Vector2(-X * FT, h * FT); // shape space: x = -X so it faces north after the flip below
  const ground = [[86, -13], [-12, -13], [-12, -0.3], [29.8, -0.3], [29.8, 1.1], [86, 1.1]];
  ground.forEach(([X, h], i) => (i ? gnd.lineTo(...G(X, h).toArray()) : gnd.moveTo(...G(X, h).toArray())));
  // drawn over anything in front of the sheet (the yard plane seen edge-on), like the poché on the drawing
  const gm = new THREE.MeshBasicMaterial({ color: GREY, transparent: true, depthTest: false, depthWrite: true, toneMapped: false, fog: false, side: THREE.DoubleSide });
  mats.push([gm, 1]);
  const gmesh = new THREE.Mesh(new THREE.ShapeGeometry(gnd), gm);
  gmesh.rotation.y = Math.PI;
  gmesh.position.z = -NL * FT;
  gmesh.renderOrder = 5;
  group.add(gmesh);
  for (let i = 0; i < ground.length - 1; i++) if (ground[i + 1][1] > -12) seg(ink, ground[i][0], ground[i][1], ground[i + 1][0], ground[i + 1][1], -0.02);

  // the basement under the east block, dashed into the ground
  const bx0 = 29.8, bx1 = 56.13, bh = -9.17;
  for (const [a, b] of [[bx1, bx0]]) { dashed(soft, a, b, bh); dashed(soft, a, b, 0); }
  for (const X of [bx0, bx1]) for (let h = 0; h > bh; h -= 1.7) seg(soft, X, h, X, Math.max(bh, h - 1.1), -0.02);
  // the retaining wall off the east end, hatched
  const rw = [57.0, 65.0, -10.6, 1.0];
  seg(ink, rw[0], rw[2], rw[1], rw[2], -0.02); seg(ink, rw[0], rw[3], rw[1], rw[3], -0.02);
  seg(ink, rw[0], rw[2], rw[0], rw[3], -0.02); seg(ink, rw[1], rw[2], rw[1], rw[3], -0.02);
  for (let k = rw[2]; k < rw[3] + (rw[1] - rw[0]); k += 0.9) {
    const h0 = Math.max(rw[2], k - (rw[1] - rw[0])), h1 = Math.min(rw[3], k);
    seg(soft, rw[0] + (k - h1), h1, rw[0] + (k - h0), h0, -0.02);
  }
  text([{ t: 'RETAINING WALL', size: 0.78, color: ACCENT }], { X: 64.5, h: 2.4 });

  // ---- datum lines and their labels ------------------------------------------------
  const XL = 80, XR = -8; // datum lines run from the label column across the house
  for (const L of LEVELS) {
    dashed(soft, XL, XR, L.h);
    // the red marker triangle and the label
    const t = 0.55;
    red.push(...P(XL - 0.2, L.h + t * 0.9), ...P(XL - 0.2 - t, L.h + t * 0.9));
    red.push(...P(XL - 0.2 - t, L.h + t * 0.9), ...P(XL - 0.2 - t / 2, L.h + 0.05));
    red.push(...P(XL - 0.2 - t / 2, L.h + 0.05), ...P(XL - 0.2, L.h + t * 0.9));
    text([{ t: L.t, size: 0.78, color: ACCENT }], { X: XL - 1.2, h: L.h + 0.05 });
  }

  // ---- the dimension chain on the far left ------------------------------------------
  const XD = 83.5, XT = 86.0;
  const ticks = [31.75, F2 + 8, F2, CEIL, 0, -9.17];
  seg(red, XD, -9.17 - 0.6, XD, 31.75 + 0.6);
  seg(red, XT, -9.17 - 0.6, XT, 31.75 + 0.6);
  for (const h of ticks) { seg(red, XD - 0.6, h, XD + 0.6, h); seg(red, XD - 0.4, h - 0.4, XD + 0.4, h + 0.4); }
  for (const h of [-9.17, 31.75]) { seg(red, XT - 0.6, h, XT + 0.6, h); seg(red, XT - 0.4, h - 0.4, XT + 0.4, h + 0.4); }
  const dim = (t, X, h) => {
    const m = text([{ t, size: 0.75, color: ACCENT, track: 0.02 }], { X, h, align: 'center' });
    m.rotation.z = -Math.PI / 2; // read bottom to top, like the drawing (the sheet is flipped to face north)
    return m;
  };
  dim("14'-7\"", XD + 0.7, (F2 + 8 + 31.75) / 2);
  dim("8'-0\"", XD + 0.7, (F2 + F2 + 8) / 2);
  dim("8'-0\"", XD + 0.7, CEIL / 2);
  dim("8'-0\"", XD + 0.7, -9.17 / 2);
  dim("41'-2\"", XT + 0.7, 11.3);

  // ---- the drawing title -------------------------------------------------------------
  const cX = 47.5, cH = -16.2, r = 1.7;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, b = ((i + 1) / 48) * Math.PI * 2;
    red.push(...P(cX + Math.cos(a) * r, cH + Math.sin(a) * r), ...P(cX + Math.cos(b) * r, cH + Math.sin(b) * r));
  }
  text([{ t: '2', size: 1.3, color: ACCENT, weight: 500 }], { X: cX, h: cH - 0.95, align: 'center' });
  text([{ t: 'PROPOSED FRONT ELEVATION', size: 1.45, color: ACCENT, weight: 600, font: SANS, track: 0.02 }], { X: cX - 2.6, h: cH - 0.2 });
  text([{ t: 'SCALE: 1/4"=1\'-0"', size: 0.62, color: INK, weight: 500 }], { X: cX - 2.7, h: cH - 1.6 });
  seg(red, cX - 2.6, cH - 0.35, cX - 33.5, cH - 0.35);

  // ---- line sets ---------------------------------------------------------------------
  const mk = (arr, color, opacity) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false, fog: false });
    mats.push([m, opacity]);
    const l = new THREE.LineSegments(g, m);
    l.renderOrder = 7;
    group.add(l);
  };
  mk(ink, INK, 0.9);
  mk(red, ACCENT, 0.9);
  mk(soft, INK, 0.38);

  // 1 = the drawing, 0 = gone
  function setFade(f) {
    group.visible = f > 0.001;
    for (const [m, o] of mats) m.opacity = o * f;
  }
  return { group, setFade };
}
