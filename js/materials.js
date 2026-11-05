// Every surface in the house has two looks, blended by one shader:
//
//   ink       flat paper, no light. With the black edge lines on top it reads
//             as a line drawing.
//   material  the real thing: textured, lit, shadowed.
//
// Which look a pixel gets depends on the room it faces and how far that
// room's sweep has travelled. The insides of solids (seen only through the
// cut) are always solid ink: that is what makes the cut walls of the plan black.

import * as THREE from 'three';
import { FT, PAPER, INK, WALK, HOUSE, CUT_PLAN, CEIL } from './plan.js';

// ---- the cut ---------------------------------------------------------------
// One clipping plane shared by everything. Keeps what is below `constant`.
export const CUT = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_PLAN * FT);

// ---- rooms and sweeps --------------------------------------------------------
const raw = (hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace); // keep sRGB numbers as they are
const IDLE = -1e4;
const SOFT = 1.4; // metres over which ink turns into material behind the front
const NR = WALK.length;
const NH = HOUSE.length;

// a box in plan feet [X0, N0, X1, N1] -> three.js metres (x0, z0, x1, z1)
const box3 = (b) => new THREE.Vector4(b[0] * FT, -b[3] * FT, b[2] * FT, -b[1] * FT);

const SW = WALK.map((r) => {
  if (!r.box) return { ox: 0, oz: 0, dx: 0, dz: -1, len: 1 };
  const [X0, N0, X1, N1] = r.box;
  const dx = r.dir[0], dz = -r.dir[1];
  const ox = (dx > 0 ? X0 : dx < 0 ? X1 : (X0 + X1) / 2) * FT;
  const oz = (dz < 0 ? -N0 : dz > 0 ? -N1 : -(N0 + N1) / 2) * FT;
  const len = (Math.abs(dx) * (X1 - X0) + Math.abs(dz) * (N1 - N0)) * FT;
  return { ox, oz, dx, dz, len };
});

export const U = {
  uPaper: { value: raw(PAPER) },
  uInkCol: { value: raw(INK) },
  uRoomBox: { value: WALK.map((r) => (r.box ? box3(r.box) : new THREE.Vector4())) },
  uRoomSweep: { value: SW.map((s) => new THREE.Vector4(s.ox, s.oz, s.dx, s.dz)) },
  uRoomFront: { value: WALK.map(() => IDLE) },
  uHouse: { value: HOUSE.map(box3) },
  uRoofY: { value: (CEIL + 0.3) * FT },
  uSoft: { value: SOFT },
  uInkTone: { value: 0.05 }, // a faint wash on upright faces so the drawing reads as solid
};

// t: 0 = line drawing, 1 = fully material.
// The outside sweeps north across the whole site: give it a start and an end in feet.
export const reveal = {};
export function setReveal(key, t, span) {
  const i = WALK.findIndex((r) => r.key === key);
  reveal[key] = t;
  if (i === 0) {
    const [n0, n1] = span;
    U.uRoomFront.value[0] = t <= 0 ? IDLE : (n0 + t * (n1 - n0)) * FT;
    return;
  }
  const s = SW[i];
  U.uRoomFront.value[i] = t <= 0 ? IDLE : -0.5 + t * (s.len + SOFT + 1.0);
}

const DECL = /* glsl */ `
#define NR ${NR}
#define NH ${NH}
varying vec3 vWp;
varying vec3 vWn;
uniform vec3 uPaper;
uniform vec3 uInkCol;
uniform vec4 uRoomBox[NR];
uniform vec4 uRoomSweep[NR];
uniform float uRoomFront[NR];
uniform vec4 uHouse[NH];
uniform float uRoofY;
uniform float uSoft;
uniform float uInkTone;

bool inBox(vec3 q, vec4 b) { return q.x > b.x && q.x < b.z && q.z > b.y && q.z < b.w; }

// 0 = outside, 1.. = a walk room, -1 = inside the house but never revealed
int roomOf(vec3 q) {
  if (q.y > uRoofY) return 0;
  for (int i = 1; i < NR; i++) if (inBox(q, uRoomBox[i])) return i;
  for (int j = 0; j < NH; j++) if (inBox(q, uHouse[j])) return -1;
  return 0;
}
// 1 = line drawing, 0 = material
float inkOf(vec3 q, int r) {
  if (r < 0) return 1.0;
  float f = uRoomFront[0];
  float d = -q.z; // outside: distance north
  for (int i = 1; i < NR; i++) {
    if (i == r) {
      vec4 s = uRoomSweep[i];
      d = dot(q.xz - s.xy, s.zw);
      f = uRoomFront[i];
    }
  }
  float soft = r == 0 ? uSoft * 3.0 : uSoft;
  return smoothstep(f - soft, f, d);
}
// A cheap stand-in for bounced light: surfaces darken a little where they come
// close to the walls, floor and ceiling of the room they belong to.
float roomAO(vec3 p, vec3 nn, int r) {
  if (r < 1) return 1.0;
  vec4 b = uRoomBox[r];
  float R = 0.85, occ = 0.0;
  occ += (1.0 - abs(nn.x)) * (exp(-max(p.x - b.x - 0.08, 0.0) / R) + exp(-max(b.z - 0.08 - p.x, 0.0) / R));
  occ += (1.0 - abs(nn.z)) * (exp(-max(p.z - b.y - 0.08, 0.0) / R) + exp(-max(b.w - 0.08 - p.z, 0.0) / R));
  occ += (1.0 - abs(nn.y)) * (exp(-max(p.y, 0.0) / R) + exp(-max(uRoofY - 0.09 - p.y, 0.0) / R));
  return clamp(1.0 - 0.2 * occ, 0.5, 1.0);
}
`;

const VERT_DECL = /* glsl */ `
varying vec3 vWp;
varying vec3 vWn;
`;
const VERT_MAIN = /* glsl */ `
vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
vWn = normalize(mat3(modelMatrix) * objectNormal);
`;

// texture in world space: no UV seams between boxes, every plank the same size
const MAPFRAG = /* glsl */ `
#ifdef INK_MAP
{
  vec3 nnM = normalize(vWn);
  vec3 an = abs(nnM);
  vec2 wuv = an.y > 0.5 ? vec2(vWp.x, vWp.z) : (an.x > an.z ? vec2(vWp.z, vWp.y) : vec2(vWp.x, vWp.y));
  if (uRot > 0.5) wuv = wuv.yx;
  vec3 qM = vWp + nnM * (gl_FrontFacing ? 1.0 : -1.0) * 0.03;
  bool outside = uHasOut > 0.5 && roomOf(qM) == 0;
  vec3 tc = outside ? texture2D(uOutMap, wuv / uOutScale).rgb : texture2D(uMap, wuv / uScale).rgb;
  vec3 tint = outside ? uOutTint : uTint;
  float l = dot(tc, vec3(0.2126, 0.7152, 0.0722));
  tc = mix(vec3(l), tc, outside ? uOutSat : uSat);
  diffuseColor.rgb = tc * tint;
}
#else
#include <map_fragment>
#endif
`;

// pixels that are pure drawing skip the lighting entirely
const EARLY = /* glsl */ `
{
  vec3 nnE = normalize(vWn) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 qE = vWp + nnE * 0.03;
  if (inkOf(qE, roomOf(qE)) > 0.999) {
    if (uGlass > 0.5) discard;
    if (uBackInk > 0.5 && !gl_FrontFacing) gl_FragColor = vec4(uInkCol, 1.0);
    else gl_FragColor = vec4(uPaper * (1.0 - uInkTone * (abs(nnE.x) + 0.55 * abs(nnE.z))), 1.0);
    return;
  }
}
`;

const INKMIX = /* glsl */ `
{
  vec3 nnI = normalize(vWn) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 qI = vWp + nnI * 0.03;
  int rI = roomOf(qI);
  float ink = inkOf(qI, rI);
  gl_FragColor.rgb *= roomAO(vWp, nnI, rI);
  if (uGlass > 0.5) {
    gl_FragColor.a *= (1.0 - ink);
  } else if (uBackInk > 0.5 && !gl_FrontFacing) {
    gl_FragColor.rgb = uInkCol;
  } else {
    vec3 wash = uPaper * (1.0 - uInkTone * (abs(nnI.x) + 0.55 * abs(nnI.z)));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, wash, ink);
  }
}
#include <dithering_fragment>
`;

// Turns a MeshStandardMaterial into an ink-aware one.
export function inkAware(material, o = {}) {
  const { backInk = true, glass = false, map = null, scale = 1, rot = false, tint = [1, 1, 1], sat = 1, out = null } = o;
  material.side = glass ? THREE.FrontSide : THREE.DoubleSide;
  material.clippingPlanes = [CUT];
  if (backInk && !glass) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -2;
  }
  const own = {
    uBackInk: { value: backInk ? 1 : 0 },
    uGlass: { value: glass ? 1 : 0 },
    uMap: { value: map },
    uScale: { value: scale },
    uRot: { value: rot ? 1 : 0 },
    uTint: { value: new THREE.Vector3(...tint) },
    uSat: { value: sat },
    uHasOut: { value: out ? 1 : 0 },
    uOutMap: { value: out ? out.map : map },
    uOutScale: { value: out ? out.scale : 1 },
    uOutTint: { value: new THREE.Vector3(...(out ? out.tint : [1, 1, 1])) },
    uOutSat: { value: out ? out.sat ?? 1 : 1 },
  };
  if (map) material.defines = { ...(material.defines || {}), INK_MAP: '' };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL +
        'uniform float uBackInk; uniform float uGlass; uniform sampler2D uMap; uniform float uScale; uniform float uRot; uniform vec3 uTint; uniform float uSat;\n' +
        'uniform float uHasOut; uniform sampler2D uOutMap; uniform float uOutScale; uniform vec3 uOutTint; uniform float uOutSat;\n')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + EARLY)
      .replace('#include <map_fragment>', MAPFRAG)
      .replace('#include <dithering_fragment>', INKMIX);
  };
  material.customProgramCacheKey = () => 'ink' + (map ? 'm' : '') + (glass ? 'g' : '') + (backInk ? 'b' : '');
  return material;
}

// Lines that belong to a room fade out once its materials have swept in.
export function inkLines(opacity = 1, { clip = true, keep = 0 } = {}) {
  const m = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity, depthWrite: false, toneMapped: false });
  if (clip) m.clippingPlanes = [CUT];
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, { uKeep: { value: keep } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL + 'uniform float uKeep;\n')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n{ float k = inkOf(vWp, roomOf(vWp)); gl_FragColor.a *= max(k, uKeep); }');
  };
  m.customProgramCacheKey = () => 'inkline' + keep;
  return m;
}

// ---- textures ----------------------------------------------------------------
const loader = new THREE.TextureLoader();
const pending = [];
function tex(name) {
  const t = loader.load(`assets/textures/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  pending.push(new Promise((res) => {
    t.onUpdate = res;
    setTimeout(res, 15000);
  }));
  return t;
}
export const texturesReady = async (renderer) => {
  // force an upload so we know they are on the GPU
  await new Promise((r) => setTimeout(r, 0));
  for (const t of Object.values(T)) renderer.initTexture(t);
};

const T = {};
export function makeMaterials() {
  ['oak', 'walnut', 'marble', 'plaster', 'siding', 'grass', 'concrete', 'linen', 'rug', 'leather', 'bark', 'stone'].forEach((n) => (T[n] = tex(n)));
  const std = (p) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.045, ...p });
  const M = {};
  // walls: plaster inside, dark board siding on any face that looks outside
  M.wall = inkAware(std({ roughness: 0.92 }), { map: T.plaster, scale: 2.4, tint: [1.22, 1.2, 1.16], sat: 0.25, out: { map: T.concrete, scale: 2.6, tint: [1.62, 1.58, 1.5], sat: 0.12 } });
  M.oak = inkAware(std({ roughness: 0.55 }), { map: T.oak, scale: 2.2, rot: true, tint: [1.15, 1.08, 1.0], sat: 0.85, backInk: false });
  M.deck = inkAware(std({ roughness: 0.7 }), { map: T.oak, scale: 1.7, rot: false, tint: [0.92, 0.86, 0.8], sat: 0.45, backInk: false });
  M.walnut = inkAware(std({ roughness: 0.5 }), { map: T.walnut, scale: 1.2, tint: [0.78, 0.6, 0.46], sat: 1.4 });
  M.marble = inkAware(std({ roughness: 0.18 }), { map: T.marble, scale: 1.4, tint: [1.4, 1.4, 1.38], sat: 0.25 });
  M.cabinet = inkAware(std({ roughness: 0.6, color: '#3d4a3f' }), {}); // deep green kitchen cabinets
  M.fabric = inkAware(std({ roughness: 0.95 }), { map: T.linen, scale: 0.9, tint: [0.86, 0.8, 0.72], sat: 0.0 });
  M.rug = inkAware(std({ roughness: 1 }), { map: T.rug, scale: 1.0, tint: [1.4, 1.32, 1.2], sat: 0.2, backInk: false });
  M.leather = inkAware(std({ roughness: 0.55 }), { map: T.leather, scale: 0.8, tint: [1.6, 1.5, 1.4], sat: 0.9 });
  M.concrete = inkAware(std({ roughness: 0.9 }), { map: T.concrete, scale: 3.0, tint: [1.25, 1.25, 1.25], sat: 0.3, backInk: false });
  M.stone = inkAware(std({ roughness: 0.9 }), { map: T.stone, scale: 2.4, tint: [1.1, 1.08, 1.05], sat: 0.6, backInk: false });
  M.grass = inkAware(std({ roughness: 1, envMapIntensity: 0.35 }), { map: T.grass, scale: 3.5, tint: [0.62, 0.86, 0.42], sat: 0.0, backInk: false });
  // trees are drawn whole, like the tree symbols on a site plan: the cut does not touch them
  M.bark = inkAware(std({ roughness: 1 }), { map: T.bark, scale: 1.2, tint: [0.9, 0.85, 0.8], backInk: false });
  M.leaf = inkAware(std({ roughness: 0.9, color: '#5c7a3a', flatShading: true, envMapIntensity: 0.4 }), { backInk: false });
  M.leaf2 = inkAware(std({ roughness: 0.9, color: '#6f8a3e', flatShading: true, envMapIntensity: 0.4 }), { backInk: false });
  for (const k of ['bark', 'leaf', 'leaf2']) M[k].clippingPlanes = [];
  M.roof = inkAware(std({ roughness: 0.7, color: '#2b2d31' }), {});
  M.ceiling = inkAware(std({ roughness: 0.95, color: '#f1eee8' }), {});
  M.white = inkAware(std({ roughness: 0.6, color: '#eceae4' }), {});
  M.black = inkAware(std({ roughness: 0.4, metalness: 0.6, color: '#1b1b1d' }), {});
  M.brass = inkAware(std({ roughness: 0.3, metalness: 1, color: '#b08a4a' }), {});
  M.lamp = inkAware(std({ color: '#fff4e0', emissive: '#ffdca8', emissiveIntensity: 1.1 }), {});
  M.garage = inkAware(std({ roughness: 0.5, color: '#2f3135' }), {});
  M.car = inkAware(std({ roughness: 0.3, metalness: 0.4, color: '#8d9298' }), { backInk: false });
  M.glass = inkAware(new THREE.MeshStandardMaterial({ color: '#cfdde0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.4 }), { glass: true, backInk: false });
  M.floorPaper = inkAware(std({ roughness: 1 }), { backInk: false }); // the sheet the plan is printed on, far out
  return M;
}
