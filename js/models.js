// Real furniture, lights and plants: CC0 models from Poly Haven (polyhaven.com), at 1K textures.
//
// Each model keeps its own UV-mapped textures but gets the same ink-aware treatment as the
// rest of the house: it is clipped by the plan cut, drawn as paper and ink in the drawing,
// and turns into its real materials when its room is revealed. Poly Haven models are modelled
// in metres at real-world size, which is the scene's unit, so most need no scaling.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FT, CEIL, F2, BASE_FLOOR } from './plan.js';
import { inkAware } from './materials.js';

// where everything goes. X, N in plan feet; y = floor (ft) the piece stands on, or `hang` = the
// ceiling (ft) it hangs from; yaw = degrees to turn it (0 = as modelled); s = extra scale.
const B = BASE_FLOOR;
export const PLACES = [
  // kitchen: blue-and-white ginger jars and vases, lemons in a wooden bowl, limes, a cutting board
  { id: 'antique_ceramic_vase_01', X: 48.65, N: 6.0, y: 3.17, s: 0.8 }, // on the island, with hydrangeas
  { id: 'antique_ceramic_vase_01', X: 54.85, N: 8.4, y: 3.17, s: 0.85 }, // by the sink, with hydrangeas
  { id: 'antique_ceramic_vase_01', X: 50.2, N: 14.5, y: 3.17, s: 0.5 }, // ginger jars beside the range
  { id: 'antique_ceramic_vase_01', X: 54.0, N: 14.45, y: 3.17, s: 0.5 },
  { id: 'wooden_bowl_01', X: 48.4, N: 8.5, y: 3.17, s: 1.1 },
  ...[[0, 0], [0.22, 0.05], [-0.18, 0.15], [0.05, -0.2], [0.02, 0.05, 0.16]].map(([dx, dn, up]) => ({ id: 'lemon', X: 48.4 + dx, N: 8.5 + dn, y: 3.27 + (up ?? 0), yaw: dx * 300 })),
  { id: 'wooden_bowl_01', X: 54.55, N: 11.9, y: 3.17 },
  ...[[0, 0], [0.18, 0.05], [-0.16, 0.12], [0.06, -0.17], [0.0, 0.04, 0.15]].map(([dx, dn, up]) => ({ id: 'food_lime_01', X: 54.55 + dx, N: 11.9 + dn, y: 3.27 + (up ?? 0), yaw: dn * 400 })),
  { id: 'wooden_cutting_board', X: 54.55, N: 1.7, y: 3.17, yaw: 90 },
  // the island stools
  ...[4.9, 6.73, 8.55].map((N) => ({ id: 'bar_chair_round_01', X: 45.55, N, y: 0, yaw: 90 })),
  // great room: wood-and-leather lounge chairs, side tables, a big leafy plant by the window
  { id: 'modern_arm_chair_01', X: 3.6, N: 3.4, y: 0, yaw: 90 },
  { id: 'modern_arm_chair_01', X: 13.4, N: 3.4, y: 0, yaw: -90 },
  { id: 'side_table_01', X: 3.4, N: 7.2, y: 0 },
  { id: 'side_table_01', X: 13.6, N: 7.2, y: 0 },
  { id: 'potted_plant_02', X: 1.7, N: 1.7, y: 0 },
  // foyer: a woven basket under the console, a white vase for the hydrangeas
  { id: 'wicker_basket_02', X: 29.3, N: 17.05, y: 0.58, s: 2.1 },
  { id: 'ceramic_vase_01', X: 29.35, N: 18.2, y: 2.76, s: 0.9 },
  // upstairs: a plant in the game room
  { id: 'potted_plant_02', X: 14.8, N: 1.6, y: F2 },
  // lower level: the daybed under the egress window, and a plant
  { id: 'vintage_day_bed', X: 52.95, N: 6.9, y: B, yaw: 90 },
  { id: 'potted_plant_02', X: 31.9, N: 1.6, y: B },
  // the deck: plants by the doors
  { id: 'potted_plant_02', X: 19.4, N: -1.2, y: -0.2 },
  { id: 'potted_plant_02', X: 46.8, N: -1.2, y: -0.2 },
];

// models that should not add ink outlines to the plan (too busy)
const NO_LINES = new Set(['potted_plant_02', 'potted_plant_04', 'ceramic_vase_01', 'wicker_basket_02', 'antique_ceramic_vase_01', 'lemon', 'food_lime_01', 'wooden_bowl_01', 'wooden_cutting_board']);

// Each model ships as one JSON file: its glTF description plus its geometry as base64 (some hosts,
// like claude.ai artifacts, won't serve .bin files). Here it is reassembled into a GLB in memory.
export function b64(str) {
  const bin = atob(str), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function packedGLB(url) {
  const { gltf, bin } = await (await fetch(url)).json();
  const data = b64(bin);
  gltf.buffers = [{ byteLength: data.length }];
  const enc = new TextEncoder();
  let json = enc.encode(JSON.stringify(gltf));
  const jl = Math.ceil(json.length / 4) * 4, bl = Math.ceil(data.length / 4) * 4;
  const glb = new Uint8Array(12 + 8 + jl + 8 + bl), v = new DataView(glb.buffer);
  v.setUint32(0, 0x46546c67, true); v.setUint32(4, 2, true); v.setUint32(8, glb.length, true);
  v.setUint32(12, jl, true); v.setUint32(16, 0x4e4f534a, true);
  glb.fill(0x20, 20, 20 + jl); glb.set(json, 20);
  v.setUint32(20 + jl, bl, true); v.setUint32(24 + jl, 0x004e4942, true);
  glb.set(data, 28 + jl);
  return glb.buffer;
}

export async function loadModels() {
  const loader = new GLTFLoader();
  const ids = [...new Set(PLACES.map((p) => p.id))];
  const src = {};
  await Promise.all(ids.map(async (id) => {
    const gltf = await loader.parseAsync(await packedGLB(`assets/models/${id}/${id}.json`), `assets/models/${id}/`);
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    // one ink-aware copy of each material, shared by every placement of the model
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const ink = mats.map((m) => {
        const c = m.clone();
        const glassy = c.transparent || (c.transmission ?? 0) > 0;
        if (glassy) { c.transparent = true; c.opacity = Math.min(c.opacity ?? 1, 0.55); c.depthWrite = false; }
        return inkAware(c, { backInk: false });
      });
      o.material = Array.isArray(o.material) ? ink : ink[0];
      o.castShadow = true;
      o.receiveShadow = true;
    });
    const box = new THREE.Box3().setFromObject(root);
    src[id] = { root, box };
  }));

  const group = new THREE.Group();
  const edges = [];
  const tmp = new THREE.Vector3();
  for (const p of PLACES) {
    const { root, box } = src[p.id];
    const inst = root.clone(true);
    const s = p.s ?? 1;
    inst.scale.set(s, s * (p.sy ?? 1), s);
    inst.rotation.y = ((p.yaw ?? 0) * Math.PI) / 180;
    // stand it on its floor (or hang it from its ceiling), centred on its plan spot
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const holder = new THREE.Group();
    inst.position.set(-c.x * s, 0, -c.z * s).applyAxisAngle(new THREE.Vector3(0, 1, 0), inst.rotation.y);
    inst.position.y = p.hang != null ? -box.max.y * s * (p.sy ?? 1) : -box.min.y * s * (p.sy ?? 1);
    holder.add(inst);
    holder.position.set(p.X * FT, (p.hang != null ? p.hang : p.y) * FT, -p.N * FT);
    group.add(holder);
    if (!NO_LINES.has(p.id)) {
      holder.updateMatrixWorld(true);
      inst.traverse((o) => {
        if (!o.isMesh) return;
        const e = new THREE.EdgesGeometry(o.geometry, 40);
        const a = e.attributes.position;
        for (let i = 0; i < a.count; i++) { tmp.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); edges.push(tmp.x, tmp.y, tmp.z); }
        e.dispose();
      });
    }
    void size;
  }
  return { group, edges };
}
