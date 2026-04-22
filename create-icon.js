const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const YELLOW = '#FFD600';

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Black background
ctx.fillStyle = '#000000';
ctx.fillRect(0, 0, SIZE, SIZE);

// --- Draw an eighth note (♪) centered, ~700px tall ---
// The note is drawn with:
//   - A filled oval note head (tilted ellipse) at bottom center
//   - A vertical stem going up from the right side of the head
//   - A curved flag at the top of the stem

ctx.fillStyle = YELLOW;
ctx.strokeStyle = YELLOW;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// Dimensions scaled to fit nicely in 1024x1024
// Center of the overall note glyph
const cx = SIZE / 2 + 30; // shift slightly right so glyph looks centered visually
const cy = SIZE / 2 + 60; // shift slightly down

// Note head: tilted ellipse
const headW = 180;  // semi-major axis (horizontal)
const headH = 130;  // semi-minor axis (vertical)
const headX = cx;   // center of head
const headY = cy + 200; // bottom area
const headTilt = -Math.PI / 6; // tilt -30 degrees (like a real music note)

ctx.save();
ctx.translate(headX, headY);
ctx.rotate(headTilt);
ctx.beginPath();
ctx.ellipse(0, 0, headW, headH, 0, 0, Math.PI * 2);
ctx.fill();
ctx.restore();

// Stem: vertical line from right edge of head going up
const stemX = headX + headW * Math.cos(headTilt) - headH * Math.sin(headTilt) * 0.5;
// Simplified: place stem at right side of head
const stemStartX = headX + 115;
const stemStartY = headY - 30;
const stemEndX = stemStartX;
const stemEndY = headY - 580; // tall stem

const stemThickness = 52;
ctx.lineWidth = stemThickness;
ctx.beginPath();
ctx.moveTo(stemStartX, stemStartY);
ctx.lineTo(stemEndX, stemEndY);
ctx.stroke();

// Flag: a curved swoosh from the top of the stem
// Starts at stem top, curves right and down
const flagStartX = stemEndX;
const flagStartY = stemEndY;

ctx.lineWidth = 46;
ctx.beginPath();
ctx.moveTo(flagStartX, flagStartY);
// Control points for a nice curved flag
ctx.bezierCurveTo(
  flagStartX + 220, flagStartY + 30,   // cp1: out to the right
  flagStartX + 260, flagStartY + 180,  // cp2: curving down
  flagStartX + 100, flagStartY + 320   // end: back left and further down
);
ctx.stroke();

// Save to file
const buildDir = path.join(__dirname, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const outPath = path.join(buildDir, 'icon.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outPath, buffer);

const stats = fs.statSync(outPath);
console.log(`Icon saved to: ${outPath}`);
console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
