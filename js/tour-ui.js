// The presentation's overlays: the printed sheet with Clayborn's title block, the level
// names during the plan sequence, the client-facing captions and the closing card.
//
// The sheet is drawn in HTML over the WebGL canvas and pinned to the plan: every frame
// its corners are projected through the real camera, so it zooms with the drawing.
//
// The Clayborn mark here is redrawn from the logo on the drawing set's title block.
// Swap in the official logo file when it's available (see LOGO below).

import * as THREE from 'three';
import { FT } from './plan.js';
import { SHEET, COPY, LEVELS } from './tour.js';

// Clayborn's mark: nested gables in Clayborn red, then the wordmark.
export const LOGO = `
<svg class="cb-mark" viewBox="0 0 120 88" aria-hidden="true">
  <path d="M6 86 V30 L40 8 H80 L114 30 V86" fill="none" stroke="currentColor" stroke-width="11" stroke-linejoin="miter"/>
  <path d="M27 86 V40 L49 26 H71 L93 40 V86" fill="none" stroke="currentColor" stroke-width="5"/>
  <path d="M43 86 V50 L55 42 H65 L77 50 V86" fill="none" stroke="currentColor" stroke-width="4"/>
</svg>`;
const WORDMARK = `<span class="cb-word">CLAYBORN</span>`;

export function buildTourUI() {
  document.documentElement.classList.add('tour');
  const root = document.createElement('div');
  root.id = 'tour';
  root.innerHTML = `
    <div id="t-sheet">
      <div class="t-border"></div>
      <aside class="t-block">
        <div class="t-logo">${LOGO}${WORDMARK}</div>
        <div class="t-project"><b>The Lake House</b><span>Residential New Construction</span><i>Private client</i></div>
        <div class="t-row"><span>Project No.</span><span>—</span></div>
        <div class="t-date">July 2026</div>
        <div class="t-rev"><span>Revisions</span>${'<i></i>'.repeat(8)}</div>
        <div class="t-notes"><span>Notes</span><p>Clayborn Engineering explicitly reserves all common law copyright and property rights in these plans.</p></div>
        <div class="t-ghost">${LOGO}</div>
        <div class="t-title"><span>Sheet Title</span><b>Proposed Main Floor Plan</b></div>
        <div class="t-num"><b>A1.2</b><span><i>Sheet No.</i><i>©2026</i></span></div>
      </aside>
    </div>
    <div id="t-level"><span class="t-lv-t"></span><span class="t-lv-d"></span></div>
    ${COPY.map((c, i) => `<section class="t-cap${c.side === 'right' ? ' right' : ''}" data-i="${i}"><p class="t-no">${c.no}</p><h2>${c.head}</h2><p class="t-sub">${c.sub}</p></section>`).join('')}
    <div id="t-end">
      <div class="t-end-in">
        <div class="t-logo big">${LOGO}${WORDMARK}</div>
        <h2>Bring your next project into focus.</h2>
        <p>From the first sketch to the sealed drawings, Clayborn designs and engineers homes that work as well as they look.</p>
        <a class="t-cta" href="#" onclick="return false">Talk to Clayborn about your project</a>
      </div>
    </div>
    <div id="t-dip"></div>
    <div id="t-progress"><i></i></div>
    <p id="t-cue">Scroll</p>`;
  document.body.appendChild(root);

  const sheet = root.querySelector('#t-sheet');
  const level = root.querySelector('#t-level');
  const lvT = level.querySelector('.t-lv-t'), lvD = level.querySelector('.t-lv-d');
  const caps = [...root.querySelectorAll('.t-cap')];
  const end = root.querySelector('#t-end');
  const bar = root.querySelector('#t-progress i');
  const cue = root.querySelector('#t-cue');
  const dip = root.querySelector('#t-dip');
  const v = new THREE.Vector3();
  const fade = (s, a, b, f = 0.01) => Math.min(1, Math.max(0, (s - a) / f)) * (1 - Math.min(1, Math.max(0, (s - b) / f)));

  function update(o, camera) {
    const s = o.s;
    // the sheet: project its corners through the camera
    if (o.sheet > 0.001) {
      const P = (X, N) => {
        v.set(X * FT, 0, -N * FT).project(camera);
        return [(v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight];
      };
      const [x0, y0] = P(SHEET.X0, SHEET.N1), [x1, y1] = P(SHEET.X1, SHEET.N0);
      const w = x1 - x0, h = y1 - y0;
      sheet.style.cssText = `left:${x0}px;top:${y0}px;width:${w}px;height:${h}px;opacity:${o.sheet};font-size:${w / 92}px;` +
        `--block:${((SHEET.X1 - SHEET.block) / (SHEET.X1 - SHEET.X0)) * 100}%`;
      sheet.style.display = '';
    } else sheet.style.display = 'none';
    // level names during the plan sequence
    let lv = null, lf = 0;
    for (const L of LEVELS) { const f = fade(s, L.at[0], L.at[1], 0.004); if (f > lf) { lf = f; lv = L; } }
    if (lv) { lvT.textContent = lv.t; lvD.textContent = lv.d; }
    level.style.opacity = lf;
    // captions
    caps.forEach((el, i) => {
      const [a, b] = COPY[i].at;
      const f = fade(s, a, b, 0.012);
      el.style.opacity = f;
      el.style.transform = `translateY(${(1 - f) * 18}px)`;
      el.style.visibility = f > 0.001 ? 'visible' : 'hidden';
    });
    // the close
    end.style.opacity = o.end;
    end.style.visibility = o.end > 0.001 ? 'visible' : 'hidden';
    end.style.pointerEvents = o.end > 0.5 ? 'auto' : 'none';
    dip.style.opacity = o.dip || 0;
    bar.style.transform = `scaleX(${s})`;
    cue.style.opacity = 1 - Math.min(1, s / 0.02);
  }
  return { update };
}
