// Everything about how a particle looks and where it starts. Pure
// functions only — no shared mutable state, so every value the caller
// needs (particleSize, scatterPct, ...) is passed in explicitly.

export function hexToRgb(hex){
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(function(c){ return c + c; }).join("");
  var n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function themeColor(name){
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function randomIn(w, h){
  return { x: Math.random() * w, y: Math.random() * h };
}

// Most particles small, a few notably larger — a starfield/constellation
// distribution rather than a narrow uniform range. At scatterPct = 0 every
// particle gets exactly `baseSize` (perfectly uniform); it blends toward
// the full skewed distribution as scatterPct rises to 100.
export function randomParticleSize(baseSize, scatterPct){
  var f = scatterPct / 100;
  if (f <= 0) return baseSize;
  var t = Math.pow(Math.random(), 3); // skewed toward 0 = mostly small
  var skewed = baseSize * (0.4 + t * 2.2);
  return baseSize + (skewed - baseSize) * f;
}

// Evenly-spaced grid slot for particle `index` of `total`, sized to fill
// w x h roughly proportionally.
export function gridPosition(index, total, w, h){
  var cols = Math.max(1, Math.round(Math.sqrt(Math.max(1, total) * w / h)));
  var rows = Math.max(1, Math.ceil(Math.max(1, total) / cols));
  var col = index % cols, row = Math.floor(index / cols);
  return { x: (col + 0.5) * (w / cols), y: (row + 0.5) * (h / rows) };
}

// Blends between that uniform grid slot (scatterPct = 0) and a fully
// independent random point (scatterPct = 100) — this is what "Scatter"
// controls: how orderly vs. chaotic the field looks before any capture.
export function scatterHome(index, total, w, h, scatterPct){
  var grid = gridPosition(index, total, w, h);
  var f = scatterPct / 100;
  if (f <= 0) return grid;
  var rnd = randomIn(w, h);
  return { x: grid.x + (rnd.x - grid.x) * f, y: grid.y + (rnd.y - grid.y) * f };
}

// Draws one particle in the chosen style. `baseSize` is only needed for
// the star style, to decide which stars are "notably larger than usual"
// and earn a glow halo.
export function drawParticle(ctx, style, x, y, r, fillRgb, alpha, baseSize){
  ctx.fillStyle = "rgba(" + fillRgb[0] + "," + fillRgb[1] + "," + fillRgb[2] + "," + alpha.toFixed(3) + ")";

  if (style === "circle"){
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    return;
  }

  if (style === "cross"){
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = Math.max(1, r * 0.55);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
    ctx.stroke();
    return;
  }

  if (style === "star"){
    // constellation look: only the notably-larger stars (a minority,
    // thanks to randomParticleSize's skew) get a soft glow halo — the
    // many small ones stay plain so it doesn't look uniform
    if (baseSize && r > baseSize * 1.35){
      var glowR = r * 3.4;
      var grad = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      grad.addColorStop(0, "rgba(" + fillRgb[0] + "," + fillRgb[1] + "," + fillRgb[2] + "," + (alpha * 0.5).toFixed(3) + ")");
      grad.addColorStop(1, "rgba(" + fillRgb[0] + "," + fillRgb[1] + "," + fillRgb[2] + ",0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(" + fillRgb[0] + "," + fillRgb[1] + "," + fillRgb[2] + "," + alpha.toFixed(3) + ")";
    }
    var points = 5, outer = r * 1.4, inner = outer * 0.45;
    ctx.beginPath();
    for (var i = 0; i < points * 2; i++){
      var rad = i % 2 === 0 ? outer : inner;
      var ang = (Math.PI / points) * i - Math.PI / 2;
      var px = x + Math.cos(ang) * rad, py = y + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
}

// Sizes a canvas to its parent container at the current DPR (capped at 2x)
// and returns a ready-to-draw 2d context plus the CSS-pixel dimensions.
export function fitCanvas(canvas){
  var rect = canvas.parentElement.getBoundingClientRect();
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + "px"; canvas.style.height = h + "px";
  var ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx: ctx, w: w, h: h };
}
