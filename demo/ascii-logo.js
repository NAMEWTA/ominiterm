// demo/ascii-logo.js

const RAMP = " .:-=+*#%@$";

/**
 * Sample an OffscreenCanvas and return an array of strings (one per row).
 * Each character maps to the brightness of the corresponding cell.
 */
function canvasToAscii(ctx, canvasWidth, canvasHeight, cols, rows) {
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const { data } = imageData;
  const cellW = canvasWidth / cols;
  const cellH = canvasHeight / rows;
  const lines = [];

  for (let row = 0; row < rows; row++) {
    let line = "";
    for (let col = 0; col < cols; col++) {
      // Sample center of each cell
      const px = Math.floor(col * cellW + cellW / 2);
      const py = Math.floor(row * cellH + cellH / 2);
      const i = (py * canvasWidth + px) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      line += RAMP[Math.floor(brightness * (RAMP.length - 1))];
    }
    lines.push(line);
  }
  return lines;
}
