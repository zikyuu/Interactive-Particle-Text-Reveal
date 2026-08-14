// Text -> point cloud. Draws the string onto an offscreen canvas and reads
// back which pixels are "ink" — no coordinates are ever hand-plotted.

import { TIER_GRID } from "./constants.js";

function charIndexForX(x, bounds){
  for (var i = 0; i < bounds.length; i++){
    if (x >= bounds[i].start && x < bounds[i].end) return bounds[i].index;
  }
  return x < bounds[0].start ? 0 : bounds[bounds.length - 1].index;
}

// Returns [{x, y, ch, tier}] — ch is which character a point belongs to
// (used to order the reveal roughly letter-by-letter), tier is a 0..8
// coarse-to-fine bucket (used so a letter sketches in before it sharpens).
export function sampleTextPoints(text, w, h, step){
  var off = document.createElement("canvas");
  var octx = off.getContext("2d");
  off.width = w; off.height = h;

  var safe = text.length ? text : " ";
  var fontSize = Math.min((w * 0.84) / (safe.length * 0.62), h * 0.6);
  octx.font = "700 " + fontSize + "px Georgia, 'Times New Roman', serif";
  octx.textAlign = "left"; octx.textBaseline = "middle";

  var totalWidth = octx.measureText(safe).width;
  var startX = (w - totalWidth) / 2;
  var bounds = []; var cursorX = startX;
  for (var ci = 0; ci < safe.length; ci++){
    var cw = octx.measureText(safe[ci]).width;
    bounds.push({ start: cursorX, end: cursorX + cw, index: ci });
    cursorX += cw;
  }

  octx.fillStyle = "#fff";
  octx.fillText(safe, startX, h / 2);

  var img = octx.getImageData(0, 0, w, h).data;
  var pts = [];
  for (var y = 0; y < h; y += step){
    for (var x = 0; x < w; x += step){
      if (img[(y * w + x) * 4 + 3] > 140){
        var gx = Math.round(x / step), gy = Math.round(y / step);
        var tier = (gx % TIER_GRID) + (gy % TIER_GRID) * TIER_GRID;
        pts.push({ x: x, y: y, ch: charIndexForX(x, bounds), tier: tier });
      }
    }
  }
  return pts;
}
