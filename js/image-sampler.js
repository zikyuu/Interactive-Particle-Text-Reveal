// Image -> point cloud. Draws the upload onto an offscreen canvas
// (contain-fit, centered), grays it out, and keeps pixels on the dark
// side of `threshold` (or the light side, if `invert` is on).

import { TIER_GRID } from "./constants.js";

// Returns [{x, y, ch, tier}] — ch is always 0 (an image has no letters to
// group by, unlike text-sampler), tier is the same 0..8 coarse-to-fine
// bucket so the reveal still sketches in before sharpening.
export function sampleImagePoints(img, w, h, step, threshold, invert){
  var off = document.createElement("canvas");
  var octx = off.getContext("2d");
  off.width = w; off.height = h;

  var scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  var dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
  var dx = (w - dw) / 2, dy = (h - dh) / 2;
  octx.drawImage(img, dx, dy, dw, dh);

  var data = octx.getImageData(0, 0, w, h).data;
  var pts = [];
  for (var y = 0; y < h; y += step){
    for (var x = 0; x < w; x += step){
      var i = (y * w + x) * 4;
      var a = data[i + 3];
      if (a < 40) continue; // transparent / outside the drawn image

      var lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      var isDark = lum < threshold;
      var include = invert ? !isDark : isDark;
      if (include){
        var gx = Math.round(x / step), gy = Math.round(y / step);
        var tier = (gx % TIER_GRID) + (gy % TIER_GRID) * TIER_GRID;
        pts.push({ x: x, y: y, ch: 0, tier: tier });
      }
    }
  }
  return pts;
}
