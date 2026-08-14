// App entry point: owns UI state, wires up the DOM, and orchestrates the
// sampler + renderer modules. Nothing sampling- or drawing-specific lives
// here — this file is the "glue," not the engine.

import { MAX_PARTICLES, TIER_COUNT, CAPTURE_R, NUDGE_R, PRIORITY_JITTER, PREVIEW_COUNT } from "./constants.js";
import { sampleTextPoints } from "./text-sampler.js";
import { sampleImagePoints } from "./image-sampler.js";
import { hexToRgb, themeColor, randomParticleSize, scatterHome, drawParticle, fitCanvas } from "./renderer.js";

// ---------------- state ----------------
var mode = "text";
var uploadedImg = null;
var particleStyle = "circle";
var density = 6;        // 1 (sparse) .. 10 (dense) — sample spacing
var particleSize = 2.5; // base radius in px — independent of density
var scatterPct = 100;   // 0 = uniform grid + uniform size, 100 = fully random
var threshold = 150;
var invert = false;
var shapeScale = 1;     // 0.1..1 — how much of the frame the shape fills
var posX = 0.5;         // 0..1 — horizontal position, 0.5 = centered
var posY = 0.5;         // 0..1 — vertical position, 0.5 = centered

var els = {};
["modeTextBtn","modeImageBtn","textField","textInput","imageField","dropzone",
 "dropzoneEmpty","dropzonePreviewImg","fileInput","densitySlider","densityVal",
 "sizeSlider","sizeVal","scatterSlider","scatterVal",
 "thresholdField","thresholdSlider","thresholdVal","invertCheck","generateBtn",
 "scaleSlider","scaleVal","posXSlider","posXVal","posYSlider","posYVal",
 "previewCanvas","previewCount","configStage","playStage","playCanvas","playPct",
 "rescatterBtn","backBtn"
].forEach(function(id){ els[id] = document.getElementById(id); });

// picks a step so the point count stays under MAX_PARTICLES, honoring
// the user's density preference as a starting point
function samplePoints(w, h){
  var baseStep = Math.max(2, Math.round(12 - density)); // density 10 -> step 2, density 1 -> step 11
  var step = baseStep;
  var offsetX = (posX - 0.5) * 2, offsetY = (posY - 0.5) * 2; // 0..1 -> -1..1
  var pts = [];
  for (var attempt = 0; attempt < 6; attempt++){
    pts = mode === "text"
      ? sampleTextPoints(els.textInput.value.toUpperCase(), w, h, step, shapeScale, offsetX, offsetY)
      : (uploadedImg ? sampleImagePoints(uploadedImg, w, h, step, threshold, invert, shapeScale, offsetX, offsetY) : []);
    if (pts.length <= MAX_PARTICLES || step > 40) break;
    step = Math.ceil(step * Math.sqrt(pts.length / MAX_PARTICLES));
  }
  return pts;
}

function priorityOf(pt){
  return (mode === "text" ? pt.ch : 0) + (pt.tier / TIER_COUNT) + (Math.random() - 0.5) * PRIORITY_JITTER;
}

// ================= CONFIG STAGE: live preview =================
var previewTimer = null;
function schedulePreview(){
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 120);
}
function renderPreview(){
  var dims = fitCanvas(els.previewCanvas);
  var pts = samplePoints(dims.w, dims.h);
  dims.ctx.clearRect(0, 0, dims.w, dims.h);
  var rgb = hexToRgb(themeColor("--ink-dim"));
  for (var i = 0; i < pts.length; i++){
    drawParticle(dims.ctx, particleStyle, pts[i].x, pts[i].y, randomParticleSize(particleSize, scatterPct), rgb, 0.75, particleSize);
  }
  els.previewCount.textContent = pts.length + " particles";
  els.generateBtn.disabled = pts.length === 0;
}

// ================= PLAY STAGE: the actual engine =================
var play = null; // holds all play-stage state, rebuilt each Generate

function buildPlay(){
  var dims = fitCanvas(els.playCanvas);
  var pts = samplePoints(dims.w, dims.h);
  pts.forEach(function(p){ p.priority = priorityOf(p); });
  pts.sort(function(a, b){ return a.priority - b.priority; });

  var particles = [];
  for (var i = 0; i < pts.length; i++){
    var home = scatterHome(i, pts.length, dims.w, dims.h, scatterPct);
    particles.push({
      x: home.x, y: home.y, homeX: home.x, homeY: home.y, tx: null, ty: null,
      captured: false, isAmbient: false,
      size: randomParticleSize(particleSize, scatterPct), phase: Math.random() * Math.PI * 2,
      speed: 0.15 + Math.random() * 0.25, driftR: 8 + Math.random() * 14
    });
  }
  var ambientCount = Math.min(180, Math.round(pts.length * 0.3));
  for (var a = 0; a < ambientCount; a++){
    var h2 = scatterHome(a, ambientCount, dims.w, dims.h, scatterPct);
    particles.push({
      x: h2.x, y: h2.y, homeX: h2.x, homeY: h2.y, tx: null, ty: null,
      captured: false, isAmbient: true,
      size: 0.7 + Math.random() * 1.0, phase: Math.random() * Math.PI * 2,
      speed: 0.1 + Math.random() * 0.2, driftR: 14 + Math.random() * 26
    });
  }

  play = {
    dims: dims, slots: pts, nextSlotIndex: 0, particles: particles,
    mouse: { x: -9999, y: -9999, active: false, lastX: 0, lastY: 0 },
    raf: null
  };
  updatePlayPct();
}

function updatePlayPct(){
  var total = play.slots.length || 1;
  els.playPct.textContent = Math.round((play.nextSlotIndex / total) * 100) + "%";
}

function captureNear(x, y){
  if (play.nextSlotIndex >= play.slots.length) return;
  var any = false;
  for (var i = 0; i < play.particles.length; i++){
    if (play.nextSlotIndex >= play.slots.length) break;
    var p = play.particles[i];
    if (p.isAmbient || p.captured) continue;
    var dx = p.x - x, dy = p.y - y;
    if (dx * dx + dy * dy <= CAPTURE_R * CAPTURE_R){
      var slot = play.slots[play.nextSlotIndex++];
      p.tx = slot.x; p.ty = slot.y; p.captured = true; any = true;
    }
  }
  if (any) updatePlayPct();
}
function captureAlong(x0, y0, x1, y1){
  var dx = x1 - x0, dy = y1 - y0, dist = Math.sqrt(dx * dx + dy * dy);
  var steps = Math.max(1, Math.ceil(dist / (CAPTURE_R * 0.6)));
  for (var s = 1; s <= steps; s++){ var f = s / steps; captureNear(x0 + dx * f, y0 + dy * f); }
}

function stepPlay(t){
  if (!play) return;
  var ctx = play.dims.ctx;
  ctx.clearRect(0, 0, play.dims.w, play.dims.h);
  var dustRgb = hexToRgb(themeColor("--dust"));
  var accentRgb = hexToRgb(themeColor("--accent"));
  var accentSoftRgb = hexToRgb(themeColor("--accent-soft"));

  var previewEnd = Math.min(play.slots.length, play.nextSlotIndex + PREVIEW_COUNT);
  for (var s = play.nextSlotIndex; s < previewEnd; s++){
    var slot = play.slots[s];
    var ptw = Math.sin(t * 0.0015 + s) * 0.25 + 0.75;
    drawParticle(ctx, particleStyle, slot.x, slot.y, 1.2, accentSoftRgb, 0.16 * ptw, particleSize);
  }

  for (var i = 0; i < play.particles.length; i++){
    var p = play.particles[i];
    if (p.captured){
      p.x += (p.tx - p.x) * 0.10; p.y += (p.ty - p.y) * 0.10;
    } else {
      var wx = p.homeX + Math.cos(t * 0.0004 * p.speed + p.phase) * p.driftR;
      var wy = p.homeY + Math.sin(t * 0.0005 * p.speed + p.phase * 1.3) * p.driftR;
      p.x += (wx - p.x) * 0.03; p.y += (wy - p.y) * 0.03;
      if (play.mouse.active){
        var ndx = p.x - play.mouse.x, ndy = p.y - play.mouse.y, nd = Math.sqrt(ndx * ndx + ndy * ndy);
        if (nd < NUDGE_R && nd > 0.01){ var f = (1 - nd / NUDGE_R) * 2.8; p.x += (ndx / nd) * f; p.y += (ndy / nd) * f; }
      }
    }
    var tw = Math.sin(t * 0.002 * p.speed + p.phase) * 0.3 + 0.7;
    var rgb = p.captured ? accentRgb : dustRgb;
    var alpha = (p.captured ? 0.9 : (p.isAmbient ? 0.32 : 0.5)) * tw;
    drawParticle(ctx, particleStyle, p.x, p.y, p.size, rgb, alpha, particleSize);
  }
  play.raf = requestAnimationFrame(stepPlay);
}

function setPlayMouse(x, y){
  var m = play.mouse;
  if (m.active) captureAlong(m.lastX, m.lastY, x, y);
  else captureNear(x, y);
  m.x = x; m.y = y; m.active = true; m.lastX = x; m.lastY = y;
}
els.playCanvas.addEventListener("mousemove", function(e){
  var r = els.playCanvas.getBoundingClientRect();
  setPlayMouse(e.clientX - r.left, e.clientY - r.top);
});
els.playCanvas.addEventListener("mouseleave", function(){ if (play) play.mouse.active = false; });
els.playCanvas.addEventListener("touchmove", function(e){
  if (e.touches && e.touches.length){
    var r = els.playCanvas.getBoundingClientRect();
    setPlayMouse(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top);
  }
  e.preventDefault();
}, { passive: false });
els.playCanvas.addEventListener("touchend", function(){ if (play) play.mouse.active = false; });

els.rescatterBtn.addEventListener("click", function(){
  if (!play) return;
  var shapeCount = play.slots.length; // only shape particles are ever captured
  play.particles.forEach(function(p, idx){
    if (p.captured){
      var h = scatterHome(idx, shapeCount, play.dims.w, play.dims.h, scatterPct);
      p.homeX = h.x; p.homeY = h.y;
    }
    p.captured = false; p.tx = null; p.ty = null;
  });
  play.nextSlotIndex = 0;
  updatePlayPct();
});

els.backBtn.addEventListener("click", function(){
  if (play && play.raf) cancelAnimationFrame(play.raf);
  play = null;
  els.playStage.classList.remove("active");
  els.configStage.classList.remove("hidden");
  renderPreview();
});

els.generateBtn.addEventListener("click", function(){
  els.configStage.classList.add("hidden");
  els.playStage.classList.add("active");
  buildPlay();
  if (play.raf) cancelAnimationFrame(play.raf);
  play.raf = requestAnimationFrame(stepPlay);
});

// ================= config-stage wiring =================
function setMode(next){
  mode = next;
  els.modeTextBtn.classList.toggle("active", mode === "text");
  els.modeImageBtn.classList.toggle("active", mode === "image");
  els.textField.style.display = mode === "text" ? "" : "none";
  els.imageField.style.display = mode === "image" ? "" : "none";
  els.thresholdField.style.display = mode === "image" ? "" : "none";
  schedulePreview();
}
els.modeTextBtn.addEventListener("click", function(){ setMode("text"); });
els.modeImageBtn.addEventListener("click", function(){ setMode("image"); });

els.textInput.addEventListener("input", schedulePreview);

function updateDensityLabel(){ els.densityVal.textContent = density; }
els.densitySlider.addEventListener("input", function(){
  density = parseInt(els.densitySlider.value, 10);
  updateDensityLabel(); schedulePreview();
});

function updateSizeLabel(){ els.sizeVal.textContent = particleSize.toFixed(2).replace(/\.?0+$/, "") || particleSize; }
els.sizeSlider.addEventListener("input", function(){
  particleSize = parseFloat(els.sizeSlider.value);
  updateSizeLabel(); schedulePreview();
});

function updateScatterLabel(){ els.scatterVal.textContent = scatterPct + "%"; }
els.scatterSlider.addEventListener("input", function(){
  scatterPct = parseInt(els.scatterSlider.value, 10);
  updateScatterLabel(); schedulePreview(); // scatter also drives size uniformity,
                                            // which the preview does show
});

function updateScaleLabel(){ els.scaleVal.textContent = Math.round(shapeScale * 100) + "%"; }
els.scaleSlider.addEventListener("input", function(){
  shapeScale = parseInt(els.scaleSlider.value, 10) / 100;
  updateScaleLabel(); schedulePreview();
});

function updatePosXLabel(){ els.posXVal.textContent = posX === 0.5 ? "Centered" : Math.round(posX * 100) + "%"; }
els.posXSlider.addEventListener("input", function(){
  posX = parseInt(els.posXSlider.value, 10) / 100;
  updatePosXLabel(); schedulePreview();
});

function updatePosYLabel(){ els.posYVal.textContent = posY === 0.5 ? "Centered" : Math.round(posY * 100) + "%"; }
els.posYSlider.addEventListener("input", function(){
  posY = parseInt(els.posYSlider.value, 10) / 100;
  updatePosYLabel(); schedulePreview();
});

function updateThresholdLabel(){ els.thresholdVal.textContent = threshold; }
els.thresholdSlider.addEventListener("input", function(){
  threshold = parseInt(els.thresholdSlider.value, 10);
  updateThresholdLabel(); schedulePreview();
});
els.invertCheck.addEventListener("change", function(){
  invert = els.invertCheck.checked; schedulePreview();
});

document.querySelectorAll(".style-btn").forEach(function(btn){
  btn.addEventListener("click", function(){
    document.querySelectorAll(".style-btn").forEach(function(b){ b.classList.remove("active"); });
    btn.classList.add("active");
    particleStyle = btn.getAttribute("data-style");
    schedulePreview();
  });
});

function handleFile(file){
  if (!file || file.type.indexOf("image/") !== 0) return;
  var url = URL.createObjectURL(file);
  var img = new Image();
  img.onload = function(){
    uploadedImg = img;
    els.dropzoneEmpty.style.display = "none";
    els.dropzonePreviewImg.src = url;
    els.dropzonePreviewImg.style.display = "block";
    schedulePreview();
  };
  img.src = url;
}
els.dropzone.addEventListener("click", function(){ els.fileInput.click(); });
els.fileInput.addEventListener("change", function(e){
  if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
});
["dragenter", "dragover"].forEach(function(evt){
  els.dropzone.addEventListener(evt, function(e){
    e.preventDefault(); els.dropzone.classList.add("drag-over");
  });
});
["dragleave", "drop"].forEach(function(evt){
  els.dropzone.addEventListener(evt, function(e){
    e.preventDefault(); els.dropzone.classList.remove("drag-over");
  });
});
els.dropzone.addEventListener("drop", function(e){
  if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

window.addEventListener("resize", function(){
  if (els.playStage.classList.contains("active")) return; // don't disturb an in-progress reveal
  schedulePreview();
});

// ---- init ----
updateDensityLabel(); updateSizeLabel(); updateScatterLabel();
updateScaleLabel(); updatePosXLabel(); updatePosYLabel(); updateThresholdLabel();
renderPreview();
