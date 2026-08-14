# Interactive Particle Text Reveal

A dust field that assembles into a name as the cursor sweeps across it — built with vanilla Canvas 2D, no dependencies.

**[Live demo](https://zikyuu.github.io/Interactive-Particle-Text-Reveal/)** · **[Approach A vs B + learning notes](https://zikyuu.github.io/Interactive-Particle-Text-Reveal/approaches.html)** · **[Studio — try your own text/image](https://zikyuu.github.io/Interactive-Particle-Text-Reveal/studio.html)**

> Note: the interactive version only runs on the links above (GitHub Pages) — GitHub sanitizes `<script>` tags out of rendered READMEs, so it can't run inline on this page.

## How it works

1. The name is drawn onto an offscreen `<canvas>` with `fillText()`, then read back with `getImageData()`. Any pixel with alpha above a threshold becomes a target point — that point cloud *is* the shape of the name. No coordinates are hand-plotted.
2. Each point gets one particle. Particles start scattered randomly and ease toward their assigned point (`x += (targetX - x) * 0.1`) once captured.
3. What decides *when* a particle gets captured, and *which* point it's assigned to, is where the two versions in this repo differ.

## Two approaches

This repo ships both, side by side, as a small case study in the same problem (see [`approaches.html`](https://zikyuu.github.io/Interactive-Particle-Text-Reveal/approaches.html) for live demos of each + a comparison table):

| | Approach A — gated by letter | Approach B — priority queue |
|---|---|---|
| Particle destination | assigned up front, at build time | assigned only at the moment of capture |
| What's catchable | only the current letter's particles | any nearby particle |
| Sweep efficiency | ~1/n of dust usable at a time (n = letters) | nearly all dust usable until the queue empties |
| Letter order | hard-guaranteed sequential | mostly sequential, soft overlap at letter boundaries |

**Approach A** tags every particle with its destination letter up front and only lets the *current* letter's particles react — simple to reason about, but most of the dust you sweep over at any given moment can't respond, which reads as unresponsive.

**Approach B** fixes that: particles are anonymous until capture. Every letter-slot the name needs is pre-sorted once into a priority queue (mostly by letter order, with jitter so adjacent letters blend instead of hard-cutting), and a captured particle just pops whatever's next off that queue. Nearly any dust you touch is useful, and swept areas visibly empty out. `index.html` runs this version; both live side by side in `approaches.html`.

## Studio

[`studio.html`](https://zikyuu.github.io/Interactive-Particle-Text-Reveal/studio.html) generalizes the effect into a small tool: type your own text or upload an image, tune density/particle size/scatter (and threshold, for images), pick a particle style (circle, cross-stitch, or star), and generate a sweep-to-reveal from it. Same underlying sampling technique as `index.html` — it just also accepts an uploaded image (grayscale + threshold instead of text alpha) in addition to typed text, and particle count is auto-capped so a large image doesn't tank performance.

Unlike `index.html`/`approaches.html` (each a single self-contained file), Studio is split into real ES modules under `js/`:

- `js/constants.js` — tunable numbers shared across modules
- `js/text-sampler.js` — text → point cloud
- `js/image-sampler.js` — uploaded image → point cloud
- `js/renderer.js` — pure drawing + particle-placement functions (no shared state)
- `js/studio.js` — app state, DOM wiring, and the capture/animation engine; imports the four above

Plain browser `import`/`export`, no bundler or build step — just more files instead of one big one.

## Using a custom font

No coordinate file needed — that's the point of sampling from canvas instead of hand-plotting points. `ctx.font` accepts any font the browser can render; swap the family name and the same `fillText` + `getImageData` pipeline picks up the new letterforms automatically.

The one gotcha: if a custom font hasn't finished loading when you sample, canvas silently falls back to the platform default — no error, just the wrong shape. Wait for it first:

```js
document.fonts.load('700 200px "MyDisplayFont"').then(function () {
  buildParticles(); // safe now — the font is actually loaded
});
```

Then point `ctx.font` at it, same as this repo's demos:

```js
octx.font = '700 ' + fontSize + 'px "MyDisplayFont"';
octx.fillText(NAME, startX, h / 2);
var pixels = octx.getImageData(0, 0, w, h).data; // unchanged from here on
```

## Running locally

No build step. Any static file server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

`index.html` and `approaches.html` also work opened directly as a `file://` URL (double-click). `studio.html` does not — browsers block ES module `import` over `file://` for security, so it needs an actual server (the command above is enough).

## Files

- `index.html` — the main demo (Approach B, priority queue)
- `approaches.html` — both approaches side by side, with code snippets and a comparison table
- `studio.html` + `js/` + `css/` — generate a reveal from your own text or image
