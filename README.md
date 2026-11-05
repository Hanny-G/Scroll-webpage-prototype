# The Plan Is the House

A scroll-driven 3D page built from sheet **A1.2, Proposed Main Floor Plan** (Residential New Construction, The Lake House).

It opens on what looks like a flat, printed floor plan. When you scroll:

1. The walls rise out of the drawing.
2. The roofs close and the camera comes down into the yard.
3. You climb the deck stair, enter through the foyer, look into the great room, and finish in the dining room and kitchen.

Each room stays a line drawing until the camera reaches it. Then the materials sweep in, lit by a low evening sun.

The plan is not an image. It is a real 3D model of the house, cut by a clipping plane 1.2 m (3'-11") above the floor and seen from about 3,000 ft up through a 2° lens. At that distance there's no visible perspective, so the model reads as ink on paper.

## Run it locally

You need any local web server, because browsers block modules and textures loaded from a double-clicked file.

```bash
cd plan-house
python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome, Edge, Safari or Firefox. It runs best on a laptop or desktop. The first load needs internet, because three.js, GSAP and Lenis load from the jsDelivr CDN.

If Python isn't installed, `npx serve .` works too.

## What I read from the plan

Measured from sheet A1.2 at 1/4" = 1'-0". All dimensions are in feet in `js/plan.js`.

| Room | Size on the drawing |
|---|---|
| Great room | 15'-8" × 21'-3¼", L-shaped stair up to the 2nd floor |
| Entry / foyer | 13'-5½" × 16'-0", framed openings on both sides |
| Dining area + kitchen | 25'-4" × 14'-6", island 6'-0" × 4'-0" |
| Mud room | 15'-8" × 6'-4" |
| Bedroom-01 | 12'-2" × 10'-0" |
| Bathroom-01 | 8'-10" × 11'-0" |
| Walk-in pantry | 8'-10" × 5'-0" |
| 2-car garage | 22'-0" × 23'-0", 16' overhead door |
| Composite deck | 48'-0" × 11'-10" plus grilling area, 9-riser stair to the yard |
| Overall | 55'-9¼" deep (house + garage), 67'-7¼" with the deck |

**Camera route:** sheet → walls rise → descent to the yard south of the deck → up the deck stair → through the sliding doors into the foyer → left into the great room → back through the foyer → dining → kitchen.

### Assumptions and simplifications

- **Ground floor only.** The second floor, basement and roof shapes aren't modelled; the house is capped with a flat roof slab. The ceiling height is assumed to be 9'-0".
- **Wall thicknesses** are measured from the drawing: about 6" exterior, about 4½" interior.
- **Window sizes** follow the plan widths. Sills (2'-6" standard, higher over counters) and heads (6'-8") are assumed, since the plan doesn't give them.
- **Grade:** the yard is set 5'-7" below the deck (nine risers), so the basement walks out under the deck.
- **North** is drawn as straight up the sheet. Use the site plan if you need true north.
- **Furniture, finishes and the kitchen layout** are invented placeholders. The drawing says "kitchen design by others."
- **Sliding doors:** the D1 doors at the deck are shown as sliders, and the foyer opening is left open so the camera can walk through.
- The source sheet is marked **DRAFT, not for construction**, and so is this page. It's a visualization, not a construction document.

## How it works (file by file)

| File | What it does |
|---|---|
| `js/plan.js` | **All the numbers.** Walls, openings, rooms, labels, door swings, deck, trees. Edit this to change the house. |
| `js/build.js` | Turns the numbers into geometry: every wall, tread and piece of furniture is a closed box. Boxes are merged by material, and their outlines become ink lines. |
| `js/materials.js` | The ink shader: one material blends "paper and ink" with "real material", room by room. It also handles the clipping plane (the cut), world-space textures and soft corner shading. |
| `js/sheet.js` | The drafting layer: room names, dimension strings, door swings, stair arrows, north arrow and drawing title, all lying flat in the 3D scene. |
| `js/rig.js` | The camera path as a function of scroll (0 → 1): lens, height, tilt, cut height, the walk keys and when each room reveals. |
| `js/main.js` | Renderer, lights, sky, the scroll wiring (Lenis + GSAP ScrollTrigger) and captions. |
| `css/style.css`, `index.html` | Page layout, headline, captions, title block, progress rail. |
| `tools/record.mjs` | Playwright recorder for screenshots and the demo video. |

### Things you might want to change

- **Room order or camera stops:** the `W` array in `js/rig.js`. Each row is `[scroll, X ft, N ft, turn°, tilt°]`. Turn: 0 = facing north, positive turns left.
- **When a room's materials appear:** the `o.foyer`, `o.great` and `o.kitchen` lines near the end of `js/rig.js`.
- **Materials:** `makeMaterials()` in `js/materials.js`, using the texture, tile size in metres and colour tint.
- **Light:** `sun` and `hemi` in `js/main.js`.
- **Captions:** the `<aside class="cap">` blocks in `index.html` and their timing (`cap(...)`) in `js/main.js`.
- **Scroll length:** `#track { height: 1700vh }` in `css/style.css`.

## Record the demo video yourself

```bash
npm i playwright && npx playwright install chromium
python3 -m http.server 8000 &                 # in the project folder
node tools/record.mjs shots 0 0.3 0.5 0.8 1  # stills into review/
node tools/record.mjs video                  # frames into review/frames/
ffmpeg -framerate 30 -i review/frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 demo.mp4
```

Add `?capture=1` to the URL to get the page in recording mode: no smooth scroll, and `window.__frame(s)` jumps to an exact scroll position.

## Credits

- [three.js](https://threejs.org) 0.170, [GSAP](https://gsap.com) 3.12.5 + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering) 1.1.14
- Textures: CC0 scans from [Poly Haven](https://polyhaven.com), downsized to 1K
- Fonts: Archivo (SIL OFL) and IBM Plex Mono (SIL OFL), bundled in `assets/fonts`
- Technique inspired by Samnang Aing's "Casa Serra" floor-plan demo. All code here was written from scratch for this plan.
