# The Plan Is the House

A scroll-driven 3D page built from the permit set for **Residential New Construction, The Lake House** (Clayborn Engineering, issued July 3, 2026). The main reference is sheet **A1.2, Proposed Main Floor Plan**. The second floor, elevations, roof plans and foundation plan in the same set fill in the outside of the house.

It opens on what looks like a flat, printed floor plan. When you scroll:

1. The walls rise out of the drawing.
2. The second floor and the roofs close over and the camera comes down into the yard.
3. You climb the deck stair under the covered porch and walk the main floor. There are four route options, A to D (see "Route options" below).

Each room stays a line drawing until the camera reaches it. Then the materials sweep in, lit by a low evening sun.

The plan is not an image. It is a real 3D model of the house, cut by a clipping plane 1.2 m (3'-11") above the floor and seen from about 3,000 ft up through a 2° lens. At that distance there's no visible perspective, so the model reads as ink on paper.

## Run it locally

You need any local web server, because browsers block modules and textures loaded from a double-clicked file.

```bash
cd Scroll-webpage-prototype
python3 -m http.server 8000
```

Then open http://localhost:8000 in Chrome, Edge, Safari or Firefox. It runs best on a laptop or desktop. The first load needs internet, because three.js, GSAP and Lenis load from the jsDelivr CDN.

If Python isn't installed, `npx serve .` works too.

## What I read from the drawings

All dimensions are in feet in `js/plan.js`. The wall positions were read from the PDF's own vector geometry, not measured off a picture, so they match the drawing to a fraction of an inch.

| Room (A1.2, main floor) | Size on the drawing |
|---|---|
| Great room | 15'-9" × 21'-3¾", L-shaped stair up to the 2nd floor, W1 · D1 · W1 to the deck |
| Entry / foyer | 13'-6" × 16'-0½", 5'-0" framed openings to both sides, W2 · D1 · W2 (full-height W2 lights) |
| Dining area + kitchen | 25'-5" × 14'-7", island table 6'-0" × 4'-0" with a 12" overhang |
| Stair (east) | 9 risers up to a landing, then back south over the stair down to the basement |
| Mud room | 15'-8½" × 6'-4½", 36" pocket dog door at the stair |
| Bedroom-01 / closet | 12'-3" × 10'-1" / 3'-6½" × 4'-7" (D7 barn door) |
| Bathroom-01 | 8'-10½" × 11'-0½", 3'-0" × 5'-0" shower behind a half wall |
| Walk-in pantry | 8'-10½" × 5'-0" (D4 barn door) |
| 2-car garage | 22'-1" × 23'-1", 16'-0" × 7'-0" overhead door (D9) |
| Composite deck | 48'-0" × 11'-10" plus the 7'-5½" × 6'-0" grilling area, 9-riser stair to the yard |
| Overall | 55'-9" deep (house + garage), 67'-7¼" with the deck, 56'-1½" wide |

| From the rest of the set | What it adds |
|---|---|
| A1.3 second floor | Same footprint as the main floor. The outside walls and their windows (W1, W3, W4, W4a, EWO) are modelled |
| A2.1–A2.4 elevations | 8'-0" main-floor ceiling, 1'-2" floor structure, 8'-0" second floor, board-and-batten siding |
| A3.1 main roof plan | 3/12 porch roof over the whole deck with an open light well in front of the foyer, a 4/12 gable over the grilling area, an 8/12 gable over the garage |
| A3.2 second roof plan | 12/12 gables (ridges north-south) over the west and east blocks, an 8/12 roof over the middle running into both in valleys, 1'-4" overhangs |
| S1.1 foundation | Basement under the kitchen block only, with the walk-out W1 · D1 · W1 under the deck. Crawl spaces under the rest |
| Door / window schedules | D1 6'-0" × 6'-8" glass sliders, W1 2'-6" × 4'-3", W2 2'-4" × 6'-8", W5 2'-6" × 3'-8", EWO 3'-0" × 5'-2" |

### Assumptions and simplifications

- **The walk-through stays on the main floor.** The second floor is built from the outside only: its walls, windows, floor and ceiling. The rooms upstairs aren't modelled.
- **Grade is flat.** The yard sits 5'-7" below the deck (nine risers) all the way round. The real lot slopes down from the street to the south.
- **Heads** are 6'-8" throughout. Sills come from the window heights in the schedule (W1 2'-5", W5 3'-0", EWO 1'-6", W2 almost at the floor).
- **Roof heights** follow the 8'-0" + 1'-2" + 8'-0" storey heights and the pitches on the roof plans. The porch roof meets the house about 10'-4" above the main floor.
- **North** is drawn as straight up the sheet. Use the site plan if you need true north.
- **Furniture, finishes and the kitchen layout** are placeholders. The drawing says "kitchen design by others."
- **Sliding doors:** each D1 slider is shown with one leaf parked behind the other, so half the door stands open and the camera walks through the gap.
- It's a visualization, not a construction document.

## Route options

The walk after the deck stair has four variations in `js/routes.js`. Pick one with `?route=a`, `b`, `c` or `d` (A is the default):

- **A · Foyer first:** foyer → great room → back through the foyer → dining → kitchen.
- **B · Kitchen first:** east along the deck → in through the dining slider → kitchen → foyer → ends in the great room facing the evening sun.
- **C · Great room first:** west along the deck → in through the great-room slider → foyer → dining → kitchen.
- **D · Foyer panorama:** stop in the middle of the foyer, look left into the great room, sweep right to the dining room, then walk on to the kitchen.

## How it works (file by file)

| File | What it does |
|---|---|
| `js/plan.js` | **All the numbers.** Walls (both floors), openings, roofs, rooms, labels, door swings, deck, trees. Edit this to change the house. |
| `js/build.js` | Turns the numbers into geometry: every wall, tread and piece of furniture is a closed box. Boxes are merged by material, and their outlines become ink lines. |
| `js/materials.js` | The ink shader: one material blends "paper and ink" with "real material", room by room. It also handles the clipping plane (the cut), world-space textures and soft corner shading. |
| `js/sheet.js` | The drafting layer: room names, dimension strings, door swings, stair arrows, north arrow and drawing title, all lying flat in the 3D scene. |
| `js/rig.js` | The camera as a function of scroll (0 → 1): lens, height, tilt, cut height, the descent, and the walk from the chosen route. |
| `js/routes.js` | The four walk-through variations: camera keys, when each room reveals, caption timing and the rail. |
| `js/main.js` | Renderer, lights, sky, the scroll wiring (Lenis + GSAP ScrollTrigger) and captions. |
| `css/style.css`, `index.html` | Page layout, headline, captions, title block, progress rail. |
| `tools/record.mjs` | Playwright recorder for screenshots and the demo video. |

### Things you might want to change

- **Room order or camera stops:** the `walk` array of a route in `js/routes.js`. Each row is `[scroll, X ft, N ft, turn°, tilt°]`. Turn: 0 = facing north, positive turns left.
- **When a room's materials appear:** the route's `reveal` entry in `js/routes.js`.
- **Materials:** `makeMaterials()` in `js/materials.js`, using the texture, tile size in metres and colour tint.
- **Light:** `sun` and `hemi` in `js/main.js`.
- **Captions:** the `<aside class="cap">` blocks in `index.html`, and their timing (`caps`) in each route in `js/routes.js`.
- **Scroll length:** `#track { height: 1700vh }` in `css/style.css`.

## Record the demo video yourself

```bash
npm i playwright && npx playwright install chromium
python3 -m http.server 8000 &                 # in the project folder
node tools/record.mjs shots 0 0.3 0.5 0.8 1  # stills into review/
ROUTE=b GPU=1 node tools/record.mjs video    # frames into review/frames/ (ROUTE picks the walk, GPU=1 uses the graphics card)
ffmpeg -framerate 30 -i review/frames/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 18 demo.mp4
```

Add `?capture=1` to the URL to get the page in recording mode: no smooth scroll, and `window.__frame(s)` jumps to an exact scroll position.

## Credits

- [three.js](https://threejs.org) 0.170, [GSAP](https://gsap.com) 3.12.5 + ScrollTrigger, [Lenis](https://lenis.darkroom.engineering) 1.1.14
- Textures: CC0 scans from [Poly Haven](https://polyhaven.com), downsized to 1K
- Fonts: Archivo (SIL OFL) and IBM Plex Mono (SIL OFL), bundled in `assets/fonts`
- Technique inspired by Samnang Aing's "Casa Serra" floor-plan demo. All code here was written from scratch for this plan.
