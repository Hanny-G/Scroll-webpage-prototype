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
import { FT, PAPER, INK, WALK, HOUSE, CUT_PLAN, CEIL, F2 } from './plan.js';

// ---- the cut ---------------------------------------------------------------
// One clipping plane shared by everything. Keeps what is below `constant`.
export const CUT = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_PLAN * FT);
// A second cut for the low garage roof, so the roof-plan opening can slice the house down
// to its second floor while the garage roof below stays whole. Everywhere else it follows CUT.
export const CUTLOW = new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_PLAN * FT);

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
  uRoomTint: { value: WALK.map((r) => new THREE.Vector3(...(r.tint ?? [1, 1, 1]))) }, // a room's paint colour on its walls
  // each room's floor and ceiling (m): rooms are stacked, so a room is a box in plan AND a band in height
  uRoomY: { value: WALK.map((r) => new THREE.Vector2(((r.y ?? [0, CEIL])[0]) * FT, ((r.y ?? [0, CEIL])[1]) * FT)) },
  uHouse: { value: HOUSE.map(box3) },
  // how high each block's inside goes: the house has two storeys, the garage (last) only one
  uHouseTop: { value: HOUSE.map((h, i) => (i === HOUSE.length - 1 ? CEIL + 0.3 : F2 + 8 + 0.3) * FT) },
  uRoofY: { value: (F2 + 8 + 0.3) * FT }, // above the second-floor ceiling it is attic and roof: outside
  uSoft: { value: SOFT },
  uInkTone: { value: 0.05 }, // a faint wash on upright faces so the drawing reads as solid
};

// t: 0 = line drawing, 1 = fully material.
// The outside sweeps north across the whole site: give it a start and an end in feet.
export const reveal = {};
export function setReveal(key, t, span) {
  reveal[key] = t;
  WALK.forEach((r, i) => {
    if (r.key !== key) return;
    if (i === 0) {
      const [n0, n1] = span;
      U.uRoomFront.value[0] = t <= 0 ? IDLE : (n0 + t * (n1 - n0)) * FT;
      return;
    }
    const s = SW[i];
    U.uRoomFront.value[i] = t <= 0 ? IDLE : -0.5 + t * (s.len + SOFT + 1.0);
  });
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
uniform vec3 uRoomTint[NR];
uniform vec2 uRoomY[NR];
uniform vec4 uHouse[NH];
uniform float uHouseTop[NH];
uniform float uRoofY;
uniform float uSoft;
uniform float uInkTone;

bool inBox(vec3 q, vec4 b) { return q.x > b.x && q.x < b.z && q.z > b.y && q.z < b.w; }

// 0 = outside, 1.. = a walk room, -1 = inside the house but never revealed
int roomOf(vec3 q) {
  if (q.y > uRoofY) return 0;
  for (int i = 1; i < NR; i++) if (inBox(q, uRoomBox[i]) && q.y > uRoomY[i].x - 0.27 && q.y < uRoomY[i].y + 0.09) return i;
  for (int j = 0; j < NH; j++) if (inBox(q, uHouse[j])) return q.y > uHouseTop[j] ? 0 : -1;
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
  occ += (1.0 - abs(nn.y)) * (exp(-max(p.y - uRoomY[r].x, 0.0) / R) + exp(-max(uRoomY[r].y - 0.01 - p.y, 0.0) / R));
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
  #ifdef INK_PLACE
  vec2 suv = (vec2(vWp.x, vWp.z) - uPlace.xy) / uPlace.zw; // one copy, stretched over the object
  vec4 tx4 = texture2D(uMap, suv);
  #else
  vec4 tx4 = texture2D(uMap, wuv / uScale);
  #endif
  #ifdef INK_CUTOUT
  if (tx4.a < 0.5) discard;
  #endif
  vec3 tc = outside ? texture2D(uOutMap, wuv / uOutScale).rgb : tx4.rgb;
  vec3 tint = outside ? uOutTint : uTint;
  if (!outside && uPaint > 0.5) { int rT = roomOf(qM); if (rT > 0) tint *= uRoomTint[rT]; }
  float l = dot(tc, vec3(0.2126, 0.7152, 0.0722));
  tc = mix(vec3(l), tc, outside ? uOutSat : uSat);
  // board-and-batten siding: a 2" batten every 16", picked out by its two shadow lines
  if (outside && uOutBatten > 0.5 && an.y < 0.5) {
    float u = an.x > an.z ? vWp.z : vWp.x;
    float d = abs(fract(u / 0.4064) - 0.5) * 0.4064;
    float edge = smoothstep(0.019, 0.024, d) * (1.0 - smoothstep(0.028, 0.034, d));
    tc *= (d < 0.025 ? 1.06 : 1.0) * (1.0 - 0.28 * edge);
  }
  diffuseColor.rgb = tc * tint;
}
#else
#include <map_fragment>
#endif
`;

// the normal map, projected the same way as the colour: tangent frame from the dominant axis
const NORFRAG = /* glsl */ `
#ifdef INK_NOR
{
  vec3 nW = normalize(vWn) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 aN = abs(nW);
  vec2 uvN; vec3 tW, bW;
  if (aN.y > 0.5) { uvN = vec2(vWp.x, vWp.z); tW = vec3(1.0, 0.0, 0.0); bW = vec3(0.0, 0.0, 1.0); }
  else if (aN.x > aN.z) { uvN = vec2(vWp.z, vWp.y); tW = vec3(0.0, 0.0, 1.0); bW = vec3(0.0, 1.0, 0.0); }
  else { uvN = vec2(vWp.x, vWp.y); tW = vec3(1.0, 0.0, 0.0); bW = vec3(0.0, 1.0, 0.0); }
  if (uRot > 0.5) { uvN = uvN.yx; vec3 t = tW; tW = bW; bW = t; }
  vec3 tn = texture2D(uNor, uvN / uScale).xyz * 2.0 - 1.0;
  tn.xy *= uNorK;
  vec3 nWorld = normalize(tW * tn.x + bW * tn.y + nW * max(tn.z, 0.05));
  normal = normalize((viewMatrix * vec4(nWorld, 0.0)).xyz);
}
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
    else gl_FragColor = vec4(uPaper * (1.0 - uTone * uInkTone * (abs(nnE.x) + 0.55 * abs(nnE.z))), 1.0);
    // the battens of the siding, drawn in thin ink on outside walls, as on the elevations
    if (uOutBatten > 0.5 && gl_FrontFacing && abs(nnE.y) < 0.5 && roomOf(qE) == 0) {
      float u = abs(nnE.x) > abs(nnE.z) ? vWp.z : vWp.x;
      float d = abs(fract(u / 0.4064) - 0.5) * 0.4064;
      float line = 1.0 - smoothstep(0.0, fwidth(u) * 1.3, abs(d - 0.0254));
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uInkCol, line * 0.32);
    }
    // standing seams on the roofs, running down the slope, as on the roof plans
    if (uSeams > 0.5 && gl_FrontFacing && nnE.y > 0.15 && length(nnE.xz) > 0.05) {
      vec2 dn = normalize(nnE.xz);
      float u = dot(vWp.xz, vec2(-dn.y, dn.x));
      float d = abs(fract(u / 0.4064 + 0.5) - 0.5) * 0.4064;
      float line = 1.0 - smoothstep(0.0, fwidth(u) * 1.2, d);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uInkCol, line * 0.4);
    }
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
    if (uSeams > 0.5 && gl_FrontFacing && nnI.y > 0.15 && length(nnI.xz) > 0.05) {
      vec2 dn = normalize(nnI.xz);
      float u = dot(vWp.xz, vec2(-dn.y, dn.x));
      float d = abs(fract(u / 0.4064 + 0.5) - 0.5) * 0.4064;
      gl_FragColor.rgb *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, max(fwidth(u) * 1.2, 0.006), d));
    }
    gl_FragColor.rgb = mix(gl_FragColor.rgb, wash, ink);
  }
}
#include <dithering_fragment>
`;

// Turns a MeshStandardMaterial into an ink-aware one.
export function inkAware(material, o = {}) {
  const { backInk = true, glass = false, map = null, scale = 1, rot = false, tint = [1, 1, 1], sat = 1, out = null, seams = false, clip = CUT, tone = 1, paint = false, nor = null, norK = 1, place = null, cutout = false } = o;
  material.side = glass ? THREE.FrontSide : THREE.DoubleSide;
  material.clippingPlanes = [clip];
  if (backInk && !glass) {
    // a constant nudge only: a slope-scaled factor pulls faces seen edge-on from overhead
    // (every wall, in a roof plan) far forward, right through the roofs above them
    material.polygonOffset = true;
    material.polygonOffsetFactor = 0;
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
    uOutBatten: { value: out && out.batten ? 1 : 0 },
    uSeams: { value: seams ? 1 : 0 },
    uTone: { value: tone },
    uPaint: { value: paint ? 1 : 0 },
    uNor: { value: nor },
    uNorK: { value: norK },
    uPlace: { value: new THREE.Vector4(...(place ?? [0, 0, 1, 1])) },
  };
  if (map) material.defines = { ...(material.defines || {}), INK_MAP: '' };
  if (map && nor) material.defines.INK_NOR = '';
  if (map && place) material.defines.INK_PLACE = '';
  if (map && cutout) material.defines.INK_CUTOUT = '';
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U, own);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_DECL)
      .replace('#include <project_vertex>', '#include <project_vertex>\n' + VERT_MAIN);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DECL +
        'uniform float uBackInk; uniform float uGlass; uniform sampler2D uMap; uniform float uScale; uniform float uRot; uniform vec3 uTint; uniform float uSat;\n' +
        'uniform float uHasOut; uniform sampler2D uOutMap; uniform float uOutScale; uniform vec3 uOutTint; uniform float uOutSat; uniform float uOutBatten; uniform float uSeams; uniform float uTone; uniform float uPaint; uniform sampler2D uNor; uniform float uNorK; uniform vec4 uPlace;\n')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + EARLY)
      .replace('#include <map_fragment>', MAPFRAG)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + NORFRAG)
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
function tex(name, { linear = false } = {}) {
  const t = loader.load(name.includes('/') ? name : `assets/textures/${name}.jpg`);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
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
  // high-resolution surfaces from Poly Haven (CC0)
  const ph = (id, kind) => tex(`assets/tex/${id}_${kind}_1k.jpg`, { linear: kind !== 'diff' });
  T.floor = ph('laminate_floor_02', 'diff'); T.floorN = ph('laminate_floor_02', 'nor');
  T.marble2 = ph('marble_01', 'diff'); T.marble2N = ph('marble_01', 'nor');
  T.lawn = ph('leafy_grass', 'diff'); T.lawnN = ph('leafy_grass', 'nor');
  T.hessian = ph('hessian_230', 'diff'); T.hessianN = ph('hessian_230', 'nor');
  T.sand = ph('large_sandstone_blocks', 'diff'); T.sandN = ph('large_sandstone_blocks', 'nor');
  const std = (p) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.045, ...p });
  const M = {};
  // walls: plaster inside, white board-and-batten siding (A2.x) on any face that looks outside
  const wallLook = { map: T.plaster, scale: 2.4, tint: [1.5, 1.48, 1.43], sat: 0.15, out: { map: T.plaster, scale: 3.2, tint: [1.72, 1.7, 1.66], sat: 0.06, batten: true } };
  M.wall = inkAware(std({ roughness: 0.92 }), { ...wallLook, paint: true });
  // big solids that a moving cut can pass through: their insides read as paper, not as a black poché
  // the basement's 14" concrete walls: plaster inside, parged concrete outside
  M.basewall = inkAware(std({ roughness: 0.92 }), { ...wallLook, out: { map: T.concrete, scale: 3.0, tint: [1.35, 1.34, 1.3], sat: 0.2 } });
  // the lake: dark, still, catching the sky
  M.water = inkAware(std({ color: '#4f6d78', roughness: 0.08, metalness: 0.0, envMapIntensity: 1.6 }), { backInk: false });
  M.band = inkAware(std({ roughness: 0.92 }), { ...wallLook, backInk: false }); // the floor between storeys
  M.attic = inkAware(std({ roughness: 0.92 }), { ...wallLook, backInk: false }); // the solid attics under the gables
  M.atticLow = inkAware(std({ roughness: 0.92 }), { ...wallLook, backInk: false, clip: CUTLOW }); // the garage attic
  M.oak = inkAware(std({ roughness: 0.42 }), { map: T.floor, nor: T.floorN, norK: 0.8, scale: 1.7, rot: true, tint: [1.22, 1.12, 0.98], sat: 0.8, backInk: false });
  M.deck = inkAware(std({ roughness: 0.7 }), { map: T.oak, scale: 1.7, rot: false, tint: [0.92, 0.86, 0.8], sat: 0.45, backInk: false });
  M.walnut = inkAware(std({ roughness: 0.5 }), { map: T.walnut, scale: 1.2, tint: [0.78, 0.6, 0.46], sat: 1.4 });
  M.marble = inkAware(std({ roughness: 0.15 }), { map: T.marble2, nor: T.marble2N, norK: 0.4, scale: 1.2, tint: [1.12, 1.12, 1.1], sat: 0.5 });
  M.cabinet = inkAware(std({ roughness: 0.6, color: '#3d4a3f' }), {}); // deep green kitchen cabinets
  M.fabric = inkAware(std({ roughness: 0.95 }), { map: T.hessian, nor: T.hessianN, norK: 0.7, scale: 0.35, tint: [1.45, 1.4, 1.32], sat: 0.15 });
  M.rug = inkAware(std({ roughness: 1 }), { map: T.rug, scale: 1.0, tint: [1.4, 1.32, 1.2], sat: 0.2, backInk: false });
  M.leather = inkAware(std({ roughness: 0.55 }), { map: T.leather, scale: 0.8, tint: [1.6, 1.5, 1.4], sat: 0.9 });
  M.concrete = inkAware(std({ roughness: 0.9 }), { map: T.concrete, scale: 3.0, tint: [1.25, 1.25, 1.25], sat: 0.3, backInk: false });
  M.stone = inkAware(std({ roughness: 0.9 }), { map: T.sand, nor: T.sandN, norK: 1.0, scale: 2.2, tint: [1.15, 1.12, 1.06], sat: 0.6, backInk: false });
  M.grass = inkAware(std({ roughness: 1, envMapIntensity: 0.35 }), { map: T.lawn, nor: T.lawnN, norK: 0.8, scale: 2.4, tint: [0.62, 1.0, 0.5], sat: 1.1, backInk: false, tone: 0 });
  M.linen = inkAware(std({ roughness: 0.95 }), { map: T.linen, scale: 0.7, tint: [1.55, 1.5, 1.42], sat: 0.0 }); // a warm white duvet
  M.throw = inkAware(std({ roughness: 0.95 }), { map: T.rug, scale: 0.8, tint: [1.5, 1.1, 0.8], sat: 0.6 }); // a rust wool throw
  // trees are drawn whole, like the tree symbols on a site plan: the cut does not touch them
  M.bark = inkAware(std({ roughness: 1 }), { map: T.bark, scale: 1.2, tint: [0.9, 0.85, 0.8], backInk: false });
  M.leaf = inkAware(std({ roughness: 0.95, color: '#4a6a31', envMapIntensity: 0.3, vertexColors: true }), { backInk: false });
  M.leaf2 = inkAware(std({ roughness: 0.95, color: '#5c7d3a', envMapIntensity: 0.3, vertexColors: true }), { backInk: false });
  for (const k of ['bark', 'leaf', 'leaf2']) M[k].clippingPlanes = [];
  M.roof = inkAware(std({ roughness: 0.6, metalness: 0.12, color: '#4a4e55' }), { seams: true }); // charcoal standing-seam metal
  M.roofLow = inkAware(std({ roughness: 0.6, metalness: 0.12, color: '#4a4e55' }), { seams: true, clip: CUTLOW }); // the garage roof
  // ceilings: a touch of their own light, so the evening sky's warm ground bounce doesn't turn them brown
  M.ceiling = inkAware(std({ roughness: 0.95, color: '#f4f2ee', envMapIntensity: 0.02, emissive: '#f2efe8', emissiveIntensity: 0.22 }), {});
  M.white = inkAware(std({ roughness: 0.6, color: '#eceae4' }), {});
  M.whiteLow = inkAware(std({ roughness: 0.6, color: '#eceae4' }), { clip: CUTLOW }); // garage soffit and fascia
  M.black = inkAware(std({ roughness: 0.4, metalness: 0.6, color: '#1b1b1d' }), {});
  M.brass = inkAware(std({ roughness: 0.3, metalness: 1, color: '#b08a4a' }), {});
  M.lamp = inkAware(std({ color: '#fff4e0', emissive: '#ffdca8', emissiveIntensity: 1.1 }), {});
  M.garage = inkAware(std({ roughness: 0.5, color: '#3a3d43' }), { backInk: false });
  M.car = inkAware(std({ roughness: 0.3, metalness: 0.4, color: '#8d9298' }), { backInk: false });
  M.glass = inkAware(new THREE.MeshStandardMaterial({ color: '#cfdde0', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.4 }), { glass: true, backInk: false });
  M.floorPaper = inkAware(std({ roughness: 1 }), { backInk: false }); // the sheet the plan is printed on, far out
  // ---- the foyer (reference: coastal entry) --------------------------------------------
  M.trim = inkAware(std({ roughness: 0.45, color: '#f4f1ea' }), {}); // satin white mouldings, casings, coffers
  M.driftwood = inkAware(std({ roughness: 0.7 }), { map: T.oak, scale: 1.4, tint: [1.45, 1.36, 1.22], sat: 0.25 }); // limed, weathered oak
  M.seaglass = inkAware(std({ color: '#a7dccd', roughness: 0.2, metalness: 0.0, emissive: '#5f9e8c', emissiveIntensity: 0.55, envMapIntensity: 0.9 }), { backInk: false });
  M.ceramic = inkAware(std({ color: '#5fb3a6', roughness: 0.18, envMapIntensity: 0.9 }), {}); // the glazed lamp base
  M.shade = inkAware(std({ color: '#fbf7ee', emissive: '#ffe9c4', emissiveIntensity: 0.55, roughness: 0.9 }), {}); // a lit linen drum shade
  M.wicker = inkAware(std({ roughness: 0.9 }), { map: T.rug, scale: 0.25, tint: [1.25, 0.98, 0.7], sat: 0.7 });
  M.rugblue = inkAware(std({ roughness: 1 }), { map: canvasTex(drawRug, 512), scale: 0.95, backInk: false });
  M.stripe = inkAware(std({ roughness: 0.95 }), { map: canvasTex(drawStripe, 256), scale: 0.42 });
  // a mirror can't truly reflect here, so it reads as a soft silvered glass catching the room's light
  M.mirror = inkAware(std({ color: '#c3ccd0', roughness: 0.12, metalness: 0.55, envMapIntensity: 1.4, emissive: '#7e8c92', emissiveIntensity: 0.45 }), {});
  M.gilt = inkAware(std({ color: '#c09a55', roughness: 0.35, metalness: 0.85, envMapIntensity: 1.1 }), {});
  M.flowers = inkAware(std({ color: '#f6f3e8', roughness: 0.9, flatShading: true }), {});
  M.leafy = inkAware(std({ color: '#6d8f55', roughness: 0.9, flatShading: true }), {});
  // ---- the kitchen and dining room (references: coastal white kitchen, blue dining room) ----
  M.shaker = inkAware(std({ roughness: 0.4, color: '#f7f6f2' }), {}); // white shaker cabinetry
  M.steel = inkAware(std({ roughness: 0.3, metalness: 0.85, color: '#c8ccce', envMapIntensity: 1.2 }), {}); // stainless appliances
  M.nickel = inkAware(std({ roughness: 0.25, metalness: 1.0, color: '#b9bcbd', envMapIntensity: 1.2 }), {});
  M.marbleg = inkAware(std({ roughness: 0.14, envMapIntensity: 0.8 }), { map: canvasTex(drawMarble, 1024), scale: 1.6 }); // grey veined marble
  M.subway = inkAware(std({ roughness: 0.2, envMapIntensity: 0.6 }), { map: canvasTex(drawSubway, 256), scale: 0.3 }); // white subway tile
  M.cream = inkAware(std({ roughness: 0.55, color: '#efe9dc' }), {}); // painted chair frames
  M.fret = inkAware(std({ roughness: 0.55, side: THREE.DoubleSide }), { map: canvasTex(drawFret, 256), scale: 0.36, cutout: true, backInk: false });
  M.blueseat = inkAware(std({ roughness: 0.95 }), { map: T.hessian, nor: T.hessianN, norK: 0.6, scale: 0.3, tint: [0.42, 0.62, 1.15], sat: 0.0 });
  M.bluepat = inkAware(std({ roughness: 0.9 }), { map: canvasTex(drawBluePattern, 256), scale: 0.42 });
  M.capiz = inkAware(std({ color: '#f7f2e8', roughness: 0.3, emissive: '#ffe8c4', emissiveIntensity: 0.5, envMapIntensity: 0.9 }), { backInk: false });
  M.hydblue = inkAware(std({ color: '#8fb0e6', roughness: 0.9, flatShading: true }), {});
  M.china = inkAware(std({ color: '#f4f3ef', roughness: 0.15, envMapIntensity: 0.8 }), {});
  M.pewter = inkAware(std({ color: '#8f9396', roughness: 0.35, metalness: 0.9, envMapIntensity: 1.1 }), {});
  // the dining rug: one copy over the whole rug, with its border (plan feet -> metres)
  M.rugdin = inkAware(std({ roughness: 1 }), { map: canvasTex(drawDiningRug, 1024, false), place: [32.2 * 0.3048, -10.2 * 0.3048, 11.5 * 0.3048, 9.6 * 0.3048], backInk: false });
  // the painting over the console: uses the box's own UVs, so the whole picture shows on its face
  M.painting = new THREE.MeshStandardMaterial({ map: canvasTex(drawSea, 512, false), roughness: 0.85 });
  M.painting.clippingPlanes = [CUT];
  return M;
}

// textures painted in code (no extra downloads)
function canvasTex(draw, n, repeat = true) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
// a soft blue-on-cream all-over rug pattern: lattice, medallions and small flowers
function drawRug(g, n) {
  g.fillStyle = '#ece6d8'; g.fillRect(0, 0, n, n);
  const blue = '#6f8fb0', pale = '#a9bccf', q = n / 4;
  g.lineWidth = n / 90;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * q + q / 2, y = j * q + q / 2;
    g.strokeStyle = pale; g.beginPath(); g.moveTo(x, y - q / 2); g.lineTo(x + q / 2, y); g.lineTo(x, y + q / 2); g.lineTo(x - q / 2, y); g.closePath(); g.stroke();
    g.fillStyle = (i + j) % 2 ? blue : pale;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * q * 0.16, y + Math.sin(a) * q * 0.16, q * 0.09, q * 0.04, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#4f6f92'; g.beginPath(); g.arc(x, y, q * 0.06, 0, Math.PI * 2); g.fill();
    g.fillStyle = pale; g.beginPath(); g.arc(i * q, j * q, q * 0.05, 0, Math.PI * 2); g.fill();
  }
  // a little speckle so it reads as woven
  for (let k = 0; k < 4000; k++) { g.fillStyle = 'rgba(80,90,110,' + (Math.random() * 0.08).toFixed(3) + ')'; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
}
// grey marble with soft veining (for the kitchen counters)
function drawMarble(g, n) {
  g.fillStyle = '#e4e5e6'; g.fillRect(0, 0, n, n);
  for (let k = 0; k < 2500; k++) { const v = 200 + Math.random() * 40; g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 3) + ',0.25)'; g.fillRect(Math.random() * n, Math.random() * n, 6, 6); }
  for (let k = 0; k < 26; k++) {
    g.strokeStyle = 'rgba(105,110,116,' + (0.12 + Math.random() * 0.3).toFixed(2) + ')';
    g.lineWidth = 0.6 + Math.random() * 3.2;
    g.beginPath();
    let x = Math.random() * n, y = Math.random() * n;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { const nx = x + (Math.random() - 0.3) * n * 0.35, ny = y + (Math.random() - 0.5) * n * 0.35; g.quadraticCurveTo((x + nx) / 2 + (Math.random() - 0.5) * 60, (y + ny) / 2 + (Math.random() - 0.5) * 60, nx, ny); x = nx; y = ny; }
    g.stroke();
  }
}
// 3 x 6 white subway tile, running bond
function drawSubway(g, n) {
  g.fillStyle = '#d9d5cd'; g.fillRect(0, 0, n, n);
  const h = n / 4, w = n / 2, gr = 3;
  for (let r = 0; r < 4; r++) for (let c = -1; c < 3; c++) {
    const x = c * w + (r % 2) * (w / 2);
    const grd = g.createLinearGradient(0, r * h, 0, r * h + h);
    grd.addColorStop(0, '#fbfaf7'); grd.addColorStop(1, '#efede8');
    g.fillStyle = grd; g.fillRect(x + gr / 2, r * h + gr / 2, w - gr, h - gr);
  }
}
// cream fretwork: an interlocking lattice, transparent between the bars
function drawFret(g, n) {
  g.clearRect(0, 0, n, n);
  g.strokeStyle = '#efe9dc'; g.lineWidth = n * 0.07; g.lineCap = 'square';
  const q = n / 2;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const x = i * q, y = j * q;
    g.beginPath(); g.moveTo(x, y + q / 2); g.lineTo(x + q / 2, y); g.lineTo(x + q, y + q / 2); g.lineTo(x + q / 2, y + q); g.closePath(); g.stroke();
    g.beginPath(); g.arc(x + q / 2, y + q / 2, q * 0.18, 0, Math.PI * 2); g.stroke();
  }
  g.strokeRect(0, 0, n, n);
}
// navy and cream: a medallion stripe for the host chairs
function drawBluePattern(g, n) {
  g.fillStyle = '#2f5d93'; g.fillRect(0, 0, n, n);
  g.fillStyle = '#efe7d6'; g.fillRect(n * 0.3, 0, n * 0.4, n);
  g.fillStyle = '#2f5d93';
  for (let y = 0; y < n; y += n / 4) for (const x of [n * 0.4, n * 0.6]) { g.beginPath(); g.arc(x, y + n / 8, n * 0.06, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#efe7d6';
  for (let y = 0; y < n; y += n / 4) for (const x of [n * 0.13, n * 0.87]) { g.beginPath(); g.arc(x, y + n / 8, n * 0.035, 0, Math.PI * 2); g.fill(); }
}
// the dining rug: cream field, blue all-over pattern, a deep blue border
function drawDiningRug(g, n) {
  g.fillStyle = '#ece4d2'; g.fillRect(0, 0, n, n);
  const b = n * 0.07;
  g.fillStyle = '#2f5a8e'; g.fillRect(0, 0, n, n);
  g.fillStyle = '#ece4d2'; g.fillRect(b * 0.35, b * 0.35, n - b * 0.7, n - b * 0.7);
  g.fillStyle = '#3b6aa3'; g.fillRect(b, b, n - 2 * b, n - 2 * b);
  g.fillStyle = '#ece4d2'; g.fillRect(b * 1.25, b * 1.25, n - 2.5 * b, n - 2.5 * b);
  const q = n / 12;
  for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
    const x = i * q + q / 2, y = j * q + q / 2;
    if (x < b * 1.6 || y < b * 1.6 || x > n - b * 1.6 || y > n - b * 1.6) continue;
    g.fillStyle = (i + j) % 2 ? '#3b6aa3' : '#7f9fc6';
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(a) * q * 0.2, y + Math.sin(a) * q * 0.2, q * 0.12, q * 0.05, a, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2f5a8e'; g.beginPath(); g.arc(x, y, q * 0.07, 0, Math.PI * 2); g.fill();
  }
  for (let k = 0; k < 9000; k++) { g.fillStyle = 'rgba(70,80,100,' + (Math.random() * 0.07).toFixed(3) + ')'; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); }
}
// a ticking-stripe linen for the cushion
function drawStripe(g, n) {
  g.fillStyle = '#f1ece1'; g.fillRect(0, 0, n, n);
  g.fillStyle = '#7f9bb6';
  for (let x = 0; x < n; x += n / 4) { g.fillRect(x + n * 0.05, 0, n * 0.03, n); g.fillRect(x + n * 0.1, 0, n * 0.012, n); }
}
// a calm coastal painting: sky, horizon, water, sand
function drawSea(g, n) {
  const sky = g.createLinearGradient(0, 0, 0, n * 0.52);
  sky.addColorStop(0, '#dfe8ea'); sky.addColorStop(1, '#f2eadb');
  g.fillStyle = sky; g.fillRect(0, 0, n, n * 0.52);
  const sea = g.createLinearGradient(0, n * 0.5, 0, n * 0.8);
  sea.addColorStop(0, '#6f9fb0'); sea.addColorStop(1, '#a9cfcf');
  g.fillStyle = sea; g.fillRect(0, n * 0.5, n, n * 0.3);
  g.fillStyle = '#e8dcc2'; g.fillRect(0, n * 0.8, n, n * 0.2);
  for (let k = 0; k < 220; k++) {
    g.strokeStyle = 'rgba(255,255,255,' + (0.15 + Math.random() * 0.3).toFixed(3) + ')'; g.lineWidth = 1 + Math.random() * 3;
    const y = n * (0.52 + Math.random() * 0.3), x = Math.random() * n;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 20 + Math.random() * 60, y + (Math.random() - 0.5) * 3); g.stroke();
  }
}
