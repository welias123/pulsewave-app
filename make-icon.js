// Run: node make-icon.js
// Generates build/icon.png — yellow Apple-Music-style icon (1024x1024)
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const c = createCanvas(SIZE, SIZE);
const ctx = c.getContext('2d');

// ── Rounded rectangle helper ─────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Background: yellow → amber gradient ────────────────────────────────────
const grad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
grad.addColorStop(0, '#FFD600');
grad.addColorStop(1, '#FF9900');
roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.22);
ctx.fillStyle = grad;
ctx.fill();

// ── Draw the music note as one unified path ──────────────────────────────────
ctx.fillStyle = '#FFFFFF';
ctx.shadowColor = 'rgba(0,0,0,0.15)';
ctx.shadowBlur = 20;

// Key measurements (all relative to SIZE)
const noteOffsetX = SIZE * 0.16;  // shift left so it's centered
const stemW    = SIZE * 0.055;
const beamH    = SIZE * 0.055;
const beamTop  = SIZE * 0.265;
const stemBot1 = SIZE * 0.695;   // bottom of left stem
const stemBot2 = SIZE * 0.620;   // bottom of right stem (shorter — slant)
const leftX    = SIZE * 0.295 + noteOffsetX;
const rightX   = SIZE * 0.530 + noteOffsetX;
const headW    = SIZE * 0.165;
const headH    = SIZE * 0.128;

// Draw beam (horizontal bar connecting both stems at the top)
ctx.fillRect(leftX, beamTop, rightX - leftX + stemW, beamH);

// Left stem
ctx.fillRect(leftX, beamTop, stemW, stemBot1 - beamTop);

// Right stem
ctx.fillRect(rightX, beamTop, stemW, stemBot2 - beamTop);

// Left note head (oval, slightly rotated)
ctx.save();
ctx.translate(leftX + stemW * 0.5, stemBot1);
ctx.rotate(-0.30);
ctx.beginPath();
ctx.ellipse(0, 0, headW / 2, headH / 2, 0, 0, Math.PI * 2);
ctx.fill();
ctx.restore();

// Right note head
ctx.save();
ctx.translate(rightX + stemW * 0.5, stemBot2);
ctx.rotate(-0.30);
ctx.beginPath();
ctx.ellipse(0, 0, headW / 2, headH / 2, 0, 0, Math.PI * 2);
ctx.fill();
ctx.restore();

// ── Save ─────────────────────────────────────────────────────────────────────
const outPath = path.join(__dirname, 'build', 'icon.png');
const buf = c.toBuffer('image/png');
fs.writeFileSync(outPath, buf);
console.log(`✅ Icon saved to ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
