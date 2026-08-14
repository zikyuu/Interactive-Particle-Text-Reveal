// Text -> point cloud. Draws the string onto an offscreen canvas and reads
// back which pixels are "ink" — no coordinates are ever hand-plotted.

import { TIER_GRID } from "./constants.js";

function charIndexForX(x, bounds){
  for (var i = 0; i < bounds.length; i++){
    if (x >= bounds[i].start && x < bounds[i].end) return bounds[i].index;
  }
  return x < bounds[0].start ? 0 : bounds[bounds.length - 1].index;
}

// scale: 0..1, how much of the frame the text should occupy (1 = as big as
// fits). offsetX/offsetY: -1..1, position within whatever margin scale left
// behind (0 = centered, -1/1 = pushed to the near edge of that margin).
//
// Returns [{x, y, ch, tier}] — ch is which character a point belongs to
// (used to order the reveal roughly letter-by-letter), tier is a 0..8
// coarse-to-fine bucket (used so a letter sketches in before it sharpens).
export function sampleTextPoints(text, w, h, step, scale, offsetX, offsetY){
  scale = scale == null ? 1 : scale;
  offsetX = offsetX || 0;
  offsetY = offsetY || 0;

  var off = document.createElement("canvas");
  var octx = off.getContext("2d");
  off.width = w; off.height = h;

  var safe = text.length ? text : " ";
  var fontSize = Math.min((w * 0.84) / (safe.length * 0.62), h * 0.6);
  octx.font = "700 " + fontSize + "px Georgia, 'Times New Roman', serif";
  octx.textAlign = "left"; octx.textBaseline = "middle";

  // The estimate above assumes an average glyph width, which undershoots
  // for wide-letter strings (e.g. "WAYNE") — measure the actual rendered
  // width and rescale to fit, so text never clips off the canvas edge.
  var maxWidth = w * 0.86;
  var measuredWidth = octx.measureText(safe).width;
  if (measuredWidth > maxWidth){
    fontSize *= maxWidth / measuredWidth;
  }
  fontSize *= scale;
  octx.font = "700 " + fontSize + "px Georgia, 'Times New Roman', serif";

  var totalWidth = octx.measureText(safe).width;
  var marginX = (w - totalWidth) / 2;
  var startX = marginX + offsetX * marginX;
  var marginY = (h - fontSize) / 2;
  var centerY = h / 2 + offsetY * marginY * 0.9;

  var bounds = []; var cursorX = startX;
  for (var ci = 0; ci < safe.length; ci++){
    var cw = octx.measureText(safe[ci]).width;
    bounds.push({ start: cursorX, end: cursorX + cw, index: ci });
    cursorX += cw;
  }

  octx.fillStyle = "#fff";
  octx.fillText(safe, startX, centerY);

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
