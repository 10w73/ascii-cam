/**
 * Unit tests for the grid dimension / aspect-ratio math.
 *
 * The core contract:
 *   Given a video of size videoW × videoH, a container of wrapW × wrapH,
 *   a number of columns (cols), and a glyph aspect ratio (GLYPH_RATIO = glyphW / fontSize),
 *   compute rows, fontSize, glyphW so that:
 *
 *   1. The rendered ASCII art pixel rectangle (cols*glyphW × rows*fontSize)
 *      has the SAME aspect ratio as the video (within rounding tolerance).
 *   2. The rendered rectangle fits inside the container (fitW <= wrapW, fitH <= wrapH).
 *   3. The rendered rectangle is as large as possible (fills at least one dimension).
 *   4. Changing cols (detail) does NOT change the rendered pixel size — only the
 *      number of characters and their font size.
 */

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

// --- Pure function extracted from ascii-cam.html logic ---
function computeGrid({ cols, videoW, videoH, wrapW, wrapH, GLYPH_RATIO, DPR = 2 }) {
  // Step 1: figure out how many rows preserve the video aspect ratio
  // The rendered pixel size is: W = cols * glyphW,  H = rows * fontSize
  // where glyphW = fontSize * GLYPH_RATIO
  // So:  W = cols * fontSize * GLYPH_RATIO
  //      H = rows * fontSize
  // Aspect = W / H = (cols * GLYPH_RATIO) / rows
  // We want Aspect == videoW / videoH
  // => rows = cols * GLYPH_RATIO * videoH / videoW
  const rows = Math.round(cols * GLYPH_RATIO * videoH / videoW);

  // Step 2: fit into container
  // If we fill width:  fontSize = wrapW / (cols * GLYPH_RATIO)
  //                     fitH = rows * fontSize
  // If fitH > wrapH, fill height instead: fontSize = wrapH / rows
  let fontSize = wrapW / (cols * GLYPH_RATIO);
  let glyphW = fontSize * GLYPH_RATIO;
  let fitW = cols * glyphW;
  let fitH = rows * fontSize;

  if (fitH > wrapH) {
    fontSize = wrapH / rows;
    glyphW = fontSize * GLYPH_RATIO;
    fitW = cols * glyphW;
    fitH = rows * fontSize;
  }

  return { cols, rows, fontSize, glyphW, fitW, fitH, DPR };
}

// Helper: aspect ratio tolerance (rounding + monospace quantization)
function assertAspectRatio(result, videoW, videoH, tolerance = 0.05) {
  const renderedAspect = result.fitW / result.fitH;
  const videoAspect = videoW / videoH;
  const err = Math.abs(renderedAspect - videoAspect) / videoAspect;
  assert.ok(
    err < tolerance,
    `Aspect ratio error ${(err * 100).toFixed(2)}% exceeds ${tolerance * 100}%: ` +
    `rendered=${renderedAspect.toFixed(4)}, video=${videoAspect.toFixed(4)}, ` +
    `fitW=${result.fitW.toFixed(1)}, fitH=${result.fitH.toFixed(1)}`
  );
}

function assertFitsContainer(result, wrapW, wrapH) {
  assert.ok(result.fitW <= wrapW + 1, `fitW ${result.fitW} exceeds wrapW ${wrapW}`);
  assert.ok(result.fitH <= wrapH + 1, `fitH ${result.fitH} exceeds wrapH ${wrapH}`);
}

function assertFillsOneDimension(result, wrapW, wrapH, tolerance = 2) {
  const fillsW = Math.abs(result.fitW - wrapW) < tolerance;
  const fillsH = Math.abs(result.fitH - wrapH) < tolerance;
  assert.ok(fillsW || fillsH,
    `Should fill at least one dimension: fitW=${result.fitW.toFixed(1)} vs wrapW=${wrapW}, ` +
    `fitH=${result.fitH.toFixed(1)} vs wrapH=${wrapH}`
  );
}

const GLYPH_RATIO = 0.6; // typical monospace ratio

describe('Grid math: 16:9 video (1280x720)', () => {
  const videoW = 1280, videoH = 720;

  it('Desktop wide container (900x600): aspect preserved, fills container', () => {
    const r = computeGrid({ cols: 160, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    assertAspectRatio(r, videoW, videoH);
    assertFitsContainer(r, 900, 600);
    assertFillsOneDimension(r, 900, 600);
  });

  it('Desktop tall container (800x800): aspect preserved', () => {
    const r = computeGrid({ cols: 160, videoW, videoH, wrapW: 800, wrapH: 800, GLYPH_RATIO });
    assertAspectRatio(r, videoW, videoH);
    assertFitsContainer(r, 800, 800);
    assertFillsOneDimension(r, 800, 800);
  });

  it('Mobile portrait (390x500): aspect preserved, fits', () => {
    const r = computeGrid({ cols: 160, videoW, videoH, wrapW: 390, wrapH: 500, GLYPH_RATIO });
    assertAspectRatio(r, videoW, videoH);
    assertFitsContainer(r, 390, 500);
    assertFillsOneDimension(r, 390, 500);
  });

  it('Mobile landscape (750x300): aspect preserved, fits', () => {
    const r = computeGrid({ cols: 160, videoW, videoH, wrapW: 750, wrapH: 300, GLYPH_RATIO });
    assertAspectRatio(r, videoW, videoH);
    assertFitsContainer(r, 750, 300);
    assertFillsOneDimension(r, 750, 300);
  });

  it('Changing detail (cols) does NOT change fitW/fitH', () => {
    const r1 = computeGrid({ cols: 100, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    const r2 = computeGrid({ cols: 200, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    const r3 = computeGrid({ cols: 300, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    // All should fill the same dimension to the same size (within rounding)
    assert.ok(Math.abs(r1.fitW - r2.fitW) < 3, `fitW changed: ${r1.fitW} vs ${r2.fitW}`);
    assert.ok(Math.abs(r2.fitW - r3.fitW) < 3, `fitW changed: ${r2.fitW} vs ${r3.fitW}`);
    assert.ok(Math.abs(r1.fitH - r2.fitH) < 3, `fitH changed: ${r1.fitH} vs ${r2.fitH}`);
  });

  it('Higher detail = more cols and rows, smaller font', () => {
    const r1 = computeGrid({ cols: 100, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    const r2 = computeGrid({ cols: 200, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    assert.ok(r2.cols > r1.cols);
    assert.ok(r2.rows > r1.rows);
    assert.ok(r2.fontSize < r1.fontSize, `Higher detail should have smaller font: ${r2.fontSize} vs ${r1.fontSize}`);
  });
});

describe('Grid math: 4:3 video (640x480)', () => {
  const videoW = 640, videoH = 480;

  it('Desktop (900x600): aspect preserved', () => {
    const r = computeGrid({ cols: 160, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    assertAspectRatio(r, videoW, videoH);
    assertFitsContainer(r, 900, 600);
    assertFillsOneDimension(r, 900, 600);
  });
});

describe('Grid math: square video (640x640)', () => {
  const videoW = 640, videoH = 640;

  it('Desktop (900x600): aspect preserved, height-constrained', () => {
    const r = computeGrid({ cols: 160, videoW, videoH, wrapW: 900, wrapH: 600, GLYPH_RATIO });
    assertAspectRatio(r, videoW, videoH);
    assertFitsContainer(r, 900, 600);
    assertFillsOneDimension(r, 900, 600);
  });
});

describe('Grid math: rows formula correctness', () => {
  it('rows = cols * GLYPH_RATIO * videoH / videoW gives correct aspect', () => {
    // For 16:9 video, cols=160, GLYPH_RATIO=0.6:
    // rows = 160 * 0.6 * 720 / 1280 = 54
    // Rendered: W = 160 * fontSize * 0.6, H = 54 * fontSize
    // Aspect = (160 * 0.6) / 54 = 96 / 54 = 1.778 = 16/9 ✓
    const cols = 160, videoW = 1280, videoH = 720;
    const rows = Math.round(cols * GLYPH_RATIO * videoH / videoW);
    const renderedAspect = (cols * GLYPH_RATIO) / rows;
    const videoAspect = videoW / videoH;
    assert.ok(Math.abs(renderedAspect - videoAspect) < 0.02,
      `Formula gives aspect ${renderedAspect.toFixed(4)}, expected ${videoAspect.toFixed(4)}`);
    assert.equal(rows, 54, `Expected 54 rows, got ${rows}`);
  });

  it('OLD BUGGY formula: cols / videoAspect / GLYPH_RATIO gives WRONG aspect', () => {
    // This is the formula currently in the code
    const cols = 160, videoW = 1280, videoH = 720;
    const BUGGY_rows = Math.round(cols / (videoW / videoH) / GLYPH_RATIO);
    // BUGGY_rows = 160 / 1.778 / 0.6 = 150
    // Rendered: W = 160 * fontSize * 0.6 = 96 * fontSize
    //           H = 150 * fontSize
    // Aspect = 96 / 150 = 0.64 — nearly square, NOT 16:9!
    const renderedAspect = (cols * GLYPH_RATIO) / BUGGY_rows;
    const videoAspect = videoW / videoH;
    const err = Math.abs(renderedAspect - videoAspect) / videoAspect;
    assert.ok(err > 0.3, `Buggy formula should have >30% error but got ${(err*100).toFixed(1)}%`);
  });
});
