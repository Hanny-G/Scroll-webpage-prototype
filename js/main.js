// Main: renderer, scene, one draw(s) function, and the scroll that drives it.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FT, PAPER, LAWN } from './plan.js';
import { CUT, U, setReveal, reveal, makeMaterials, inkLines, texturesReady } from './materials.js';
import { buildHouse } from './build.js';
import { buildSheet } from './sheet.js';
import { makeRig } from './rig.js';

const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
const errors = [];
window.addEventListener('error', (e) => errors.push(String(e.message)));

// ---------------------------------------------------------------------------
// renderer and scene
// ---------------------------------------------------------------------------
const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (e) {
  document.getElementById('nogl').hidden = false;
  throw e;
}
renderer.setPixelRatio(params.has('pr') ? +params.get('pr') : Math.min(window.devicePixelRatio || 1, 2));
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setClearColor(new THREE.Color(PAPER), 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(new THREE.Color('#e9e4da'), 4000, 9000);
const camera = new THREE.PerspectiveCamera(2, 1, 1, 2000);
camera.rotation.order = 'YXZ';

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.12; // a little studio fill; the sun and sky do the real work

// light: late afternoon sun, low in the south-west, so it rakes across the
// deck and in through the south windows
const sun = new THREE.DirectionalLight('#ffd4a0', 6.2);
const centre = new THREE.Vector3(26 * FT, 0, -12 * FT);
sun.position.copy(centre).add(new THREE.Vector3(-0.5, 0.34, 0.8).normalize().multiplyScalar(60));
sun.target.position.copy(centre);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 140 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight('#dfe7f2', '#9a8468', 0.75);
scene.add(hemi);
// warm lamps inside, so the rooms glow against the dusk
const lamps = [
  [23.2, 5.6, 13.0, 5],
  [8.5, 7.5, 5.0, 7],
  [38.0, 6.0, 5.4, 6],
  [48.3, 6.0, 6.6, 6],
].map(([X, y, N, i]) => {
  const l = new THREE.PointLight('#ffcf96', i, 0, 2);
  l.position.set(X * FT, y * FT, -N * FT);
  scene.add(l);
  return l;
});

// a sky dome that is paper until the camera comes down
const skyMat = new THREE.ShaderMaterial({
  uniforms: { uSky: { value: 0 }, uPaper: U.uPaper },
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform float uSky; uniform vec3 uPaper; varying vec3 vD;
    void main(){
      float h = clamp(vD.y, -0.2, 1.0);
      vec3 zen = vec3(0.36, 0.52, 0.72), hor = vec3(0.96, 0.80, 0.62), gnd = vec3(0.55, 0.52, 0.45);
      vec3 c = h > 0.0 ? mix(hor, zen, pow(h, 0.55)) : mix(hor, gnd, clamp(-h * 5.0, 0.0, 1.0));
      vec3 sunDir = normalize(vec3(-0.5, 0.34, 0.8));
      c += vec3(1.0, 0.7, 0.4) * pow(max(dot(normalize(vD), sunDir), 0.0), 18.0) * 0.6;
      gl_FragColor = vec4(mix(uPaper, c, uSky), 1.0);
      #include <colorspace_fragment>
    }`,
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
sky.renderOrder = -10;
sky.frustumCulled = false;
scene.add(sky);

// ---------------------------------------------------------------------------
// the house and the sheet
// ---------------------------------------------------------------------------
const M = makeMaterials();
const house = buildHouse(M);
scene.add(house.group);

// the yard: paper while it is a drawing, grass once the outside sweeps in
const yard = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), M.grass);
yard.rotation.x = -Math.PI / 2;
yard.position.set(26 * FT, LAWN * FT - 0.005, -12 * FT);
yard.receiveShadow = true;
scene.add(yard);

const lineMat = inkLines(0.92);
const lineMatOut = inkLines(0.85, { clip: false });
const sheet = buildSheet({ planesFor: () => [CUT], anisotropy: renderer.capabilities.getMaxAnisotropy() });
scene.add(sheet.group);
sheet.mk([...house.edges, ...sheet.lines.ink], lineMat);
sheet.mk([...sheet.lines.out], lineMatOut);
sheet.mk(house.treeEdges, inkLines(0.55, { clip: false }));
const cableMat = new THREE.LineBasicMaterial({ color: '#2a2a2c', transparent: true, opacity: 0.75 });
sheet.mk(house.cables, cableMat);

// ---------------------------------------------------------------------------
// one frame
// ---------------------------------------------------------------------------
let rig = makeRig(innerWidth / innerHeight);
const hud = { lens: document.getElementById('hud-lens'), height: document.getElementById('hud-height'), cut: document.getElementById('hud-cut') };
const rail = [...document.querySelectorAll('#rail span')];
const grain = document.getElementById('grain');
const railEl = document.getElementById('rail');
let last = null;
let shadowsDirty = true;

function draw(s) {
  const o = rig.at(s);
  last = o;
  camera.position.set(o.x, o.y, o.z);
  camera.rotation.set(o.pitch, o.yaw, 0);
  camera.fov = o.fov;
  camera.near = o.near;
  camera.far = o.far;
  camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  CUT.constant = o.cut;
  scene.fog.near = o.fogNear;
  scene.fog.far = o.fogFar;
  skyMat.uniforms.uSky.value = o.sky;
  setReveal('out', o.out, [-60, 70]);
  setReveal('foyer', o.foyer);
  setReveal('great', o.great);
  setReveal('kitchen', o.kitchen);
  for (const l of sheet.labels) {
    const r = l.room === 'none' ? 0 : reveal[l.room] ?? 0;
    l.mesh.material.opacity = 1 - Math.min(1, r * 1.6);
    l.mesh.visible = l.mesh.material.opacity > 0.01;
  }
  // shadows only matter once something is lit: refresh them when the cut moves
  const lit = o.out > 0 || o.foyer > 0;
  const key = lit ? 'lit' + o.cut.toFixed(2) : 'ink';
  if (key !== shadowsDirty) {
    renderer.shadowMap.needsUpdate = true;
    shadowsDirty = key;
  }
  renderer.render(scene, camera);

  hud.lens.textContent = o.fov.toFixed(1) + '°';
  const ft = o.y / FT - LAWN;
  hud.height.textContent = ft > 100 ? Math.round(ft).toLocaleString('en-US') + ' ft' : ft.toFixed(1) + ' ft';
  hud.cut.textContent = o.cut > 10 ? 'open' : '+' + (o.cut / FT).toFixed(2) + ' ft';
  let on = rail[0];
  for (const r of rail) if (s >= +r.dataset.at) on = r;
  for (const r of rail) r.classList.toggle('on', r === on);
  grain.style.opacity = (0.55 * (1 - o.out)).toFixed(3);
  railEl.style.opacity = Math.min(1, Math.max(0, (s - 0.035) / 0.02)).toFixed(2);
}

function layout() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  rig = makeRig(camera.aspect);
}

// ---------------------------------------------------------------------------
// scroll: Lenis smooths the wheel, ScrollTrigger maps the page to s = 0..1,
// and a GSAP timeline carries s plus the captions
// ---------------------------------------------------------------------------
const proxy = { s: 0 };
const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
tl.to(proxy, { s: 1, duration: 1 }, 0);
tl.to('#hero, #titleblock', { autoAlpha: 0, y: -24, duration: 0.03 }, 0.03);
const cap = (sel, a, b) => {
  tl.fromTo(sel, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.025 }, a);
  if (b) tl.to(sel, { autoAlpha: 0, y: -14, duration: 0.025 }, b);
};
cap('#cap-cut', 0.08, 0.26);
cap('#cap-down', 0.33, 0.46);
cap('#cap-deck', 0.53, 0.66);
cap('#cap-foyer', 0.71, 0.762);
cap('#cap-great', 0.795, 0.875);
cap('#cap-kitchen', 0.915, null);

let drawn = -1;
function tick() {
  if (proxy.s !== drawn) {
    drawn = proxy.s;
    draw(drawn);
  }
}

async function boot() {
  await Promise.race([
    Promise.all(['500 20px "Plex Mono"', '400 20px "Plex Mono"', '600 40px "Archivo"'].map((f) => document.fonts.load(f))),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  layout();
  await texturesReady(renderer);
  renderer.compile(scene, camera);
  draw(0);

  if (CAPTURE) {
    document.documentElement.classList.add('capture');
    // the recorder asks for one exact scroll position at a time
    window.__frame = (s) =>
      new Promise((res) => {
        tl.progress(s);
        draw(proxy.s);
        requestAnimationFrame(() => requestAnimationFrame(() => res(true)));
      });
  } else {
    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    window.__lenis = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    ScrollTrigger.create({ trigger: '#track', start: 'top top', end: 'bottom bottom', scrub: 0.8, animation: tl });
    gsap.ticker.add(tick);
    // the page opens: the lines of the headline rise out of their masks
    gsap.from('#hero h1 .l > span', { yPercent: 108, duration: 1.3, ease: 'expo.out', stagger: 0.12, delay: 0.25 });
    gsap.from('#hero .eyebrow, #hero .lede, #hero .cue, #bar, #titleblock', { autoAlpha: 0, y: 12, duration: 1, ease: 'power2.out', stagger: 0.08, delay: 0.6 });
  }
  window.addEventListener('resize', () => {
    layout();
    drawn = -1;
    shadowsDirty = true;
    draw(proxy.s);
  });
  window.__state = () => ({ ...last, errors, calls: renderer.info.render.calls, tris: renderer.info.render.triangles });
  document.getElementById('loading').classList.add('done');
  window.__ready = true;
}

boot().catch((e) => {
  errors.push(String(e && e.stack ? e.stack : e));
  console.error(e);
  document.querySelector('#loading span').textContent = 'Something went wrong drawing the plan.';
});
