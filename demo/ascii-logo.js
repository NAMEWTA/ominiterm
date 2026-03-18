// demo/ascii-logo.js

const RAMP = " .:-=+*#%@$";

/**
 * Sample an OffscreenCanvas and return an array of strings (one per row).
 * Each character maps to the brightness of the corresponding cell.
 */
// Wave distortion parameters
const WAVE_AMP_X = 1.8;     // horizontal wave amplitude (in cells)
const WAVE_AMP_Y = 0.8;     // vertical wave amplitude (in cells)
const WAVE_FREQ_X = 0.15;   // horizontal wave frequency (per row)
const WAVE_FREQ_Y = 0.12;   // vertical wave frequency (per col)
const WAVE_SPEED_X = 0.0015; // horizontal wave speed
const WAVE_SPEED_Y = 0.001;  // vertical wave speed

function canvasToAscii(ctx, canvasWidth, canvasHeight, cols, rows, time) {
  const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
  const { data } = imageData;
  const cellW = canvasWidth / cols;
  const cellH = canvasHeight / rows;
  const lines = [];

  for (let row = 0; row < rows; row++) {
    let line = "";
    // Horizontal wave: each row shifts left/right with a sine wave
    const waveX = Math.sin(time * WAVE_SPEED_X + row * WAVE_FREQ_X) * WAVE_AMP_X * cellW;

    for (let col = 0; col < cols; col++) {
      // Vertical wave: each column shifts up/down
      const waveY = Math.sin(time * WAVE_SPEED_Y + col * WAVE_FREQ_Y) * WAVE_AMP_Y * cellH;

      const px = Math.floor(col * cellW + cellW / 2 + waveX);
      const py = Math.floor(row * cellH + cellH / 2 + waveY);

      // Clamp to canvas bounds
      if (px < 0 || px >= canvasWidth || py < 0 || py >= canvasHeight) {
        line += " ";
        continue;
      }

      const i = (py * canvasWidth + px) * 4;
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3 / 255;
      line += RAMP[Math.floor(brightness * (RAMP.length - 1))];
    }
    lines.push(line);
  }
  return lines;
}

/**
 * Draw the termcanvas logo onto the given 2D context.
 * All coordinates are normalized to [0, 1] range, scaled to canvas size.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 * @param {object} eye - { state, openAmount, pupilX, pupilY } for eye rendering
 */
function drawLogo(ctx, w, h, eye) {
  ctx.clearRect(0, 0, w, h);

  // Logo proportions from SVG (1024x1024 viewbox):
  // Outer rect: x=72 y=72 w=880 h=880 rx=224
  // Frame path: outer M208,188 H816 V872 H208 Z  inner M316,296 H708 V764 H316 Z
  // Cursor rect: x=461 y=376 w=102 h=308

  const scale = (v) => v / 1024;
  const sx = (v) => scale(v) * w;
  const sy = (v) => scale(v) * h;

  // 1. Outer rounded rect (light background)
  const outerX = sx(72), outerY = sy(72), outerW = sx(880), outerH = sy(880);
  const radius = sx(224);
  ctx.fillStyle = "#1a1a1a"; // subtle outline of the icon shape
  roundRect(ctx, outerX, outerY, outerW, outerH, radius);
  ctx.fill();

  // 2. Terminal frame (bright = will become dense characters)
  ctx.fillStyle = "#e0e0e0";
  ctx.fillRect(sx(208), sy(188), sx(608), sy(684));

  // 3. Screen interior (dark = will become spaces)
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(sx(316), sy(296), sx(392), sy(468));

  // 4. Cursor / Eye
  drawCursorOrEye(ctx, w, h, eye);
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draw the cursor (vertical bar) or eye depending on state.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - canvas width
 * @param {number} h - canvas height
 * @param {object} eye - { state, openAmount, pupilX, pupilY, blinkVisible }
 *   - state: "idle" | "awakening" | "tracking" | "sleeping"
 *   - openAmount: 0 (closed/cursor) to 1 (fully open eye), used during transitions
 *   - pupilX, pupilY: normalized pupil offset [-1, 1]
 *   - blinkVisible: boolean, whether cursor is visible during blink cycle
 */
function drawCursorOrEye(ctx, w, h, eye) {
  const sx = (v) => (v / 1024) * w;
  const sy = (v) => (v / 1024) * h;

  // Center of the cursor area from SVG: x=461+51=512, y=376+154=530
  const cx = sx(512);
  const cy = sy(530);

  // Cursor dimensions from SVG: w=102, h=308
  const cursorHalfW = sx(51);
  const cursorHalfH = sy(154);

  if (eye.state === "idle" && !eye.blinkVisible) {
    return; // cursor blink off phase
  }

  const t = eye.openAmount; // 0 = cursor bar, 1 = fully open eye

  // Interpolate from cursor bar to eye ellipse
  const eyeRadiusX = cursorHalfW + t * (sx(120) - cursorHalfW); // widen
  const eyeRadiusY = cursorHalfH + t * (sy(100) - cursorHalfH); // shorten to ellipse

  // Draw eye/cursor shape
  ctx.fillStyle = "#e0e0e0";
  ctx.beginPath();
  ctx.ellipse(cx, cy, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw pupil when eye is opening
  if (t > 0.1) {
    const pupilRadius = sx(40) * t;
    const maxOffset = sx(50);
    const px = cx + eye.pupilX * maxOffset * t;
    const py = cy + eye.pupilY * maxOffset * t;

    ctx.fillStyle = "#0a0a0a";
    ctx.beginPath();
    ctx.arc(px, py, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

class AnimationLoop {
  #raf = null;
  #callback;

  constructor(callback) {
    this.#callback = callback;
  }

  start() {
    if (this.#raf != null) return;
    const loop = (time) => {
      this.#callback(time);
      this.#raf = requestAnimationFrame(loop);
    };
    this.#raf = requestAnimationFrame(loop);
  }

  stop() {
    if (this.#raf != null) {
      cancelAnimationFrame(this.#raf);
      this.#raf = null;
    }
  }
}

/**
 * State machine for eye animation.
 * States: idle → awakening → tracking → sleeping → idle
 */
function createEyeState() {
  return {
    state: "idle",          // "idle" | "awakening" | "tracking" | "sleeping"
    openAmount: 0,          // 0 = cursor, 1 = fully open eye
    pupilX: 0,              // [-1, 1] horizontal pupil offset
    pupilY: 0,              // [-1, 1] vertical pupil offset
    blinkVisible: true,     // cursor blink toggle
    blinkTimer: 0,          // ms since last blink toggle
    idleTimer: 0,           // ms since last mouse move (for sleep trigger)
    targetPupilX: 0,        // target pupil position (from mouse)
    targetPupilY: 0,
    lastTime: 0,
  };
}

const BLINK_INTERVAL = 530;    // ms between cursor blink toggles
const AWAKEN_DURATION = 500;   // ms for cursor → eye transition
const SLEEP_DURATION = 500;    // ms for eye → cursor transition
const SLEEP_AFTER = 3000;      // ms of no mouse movement before sleeping
const PUPIL_LERP = 0.08;       // smoothing factor for pupil follow

function updateEyeState(eye, time) {
  const dt = eye.lastTime === 0 ? 16 : time - eye.lastTime;
  eye.lastTime = time;

  switch (eye.state) {
    case "idle":
      eye.blinkTimer += dt;
      if (eye.blinkTimer >= BLINK_INTERVAL) {
        eye.blinkVisible = !eye.blinkVisible;
        eye.blinkTimer = 0;
      }
      eye.openAmount = 0;
      break;

    case "awakening":
      eye.openAmount = Math.min(1, eye.openAmount + dt / AWAKEN_DURATION);
      eye.blinkVisible = true;
      // Lerp pupil toward target during awakening
      eye.pupilX += (eye.targetPupilX - eye.pupilX) * PUPIL_LERP;
      eye.pupilY += (eye.targetPupilY - eye.pupilY) * PUPIL_LERP;
      if (eye.openAmount >= 1) {
        eye.state = "tracking";
        eye.idleTimer = 0;
      }
      break;

    case "tracking":
      eye.openAmount = 1;
      eye.pupilX += (eye.targetPupilX - eye.pupilX) * PUPIL_LERP;
      eye.pupilY += (eye.targetPupilY - eye.pupilY) * PUPIL_LERP;
      eye.idleTimer += dt;
      if (eye.idleTimer >= SLEEP_AFTER) {
        eye.state = "sleeping";
      }
      break;

    case "sleeping":
      eye.openAmount = Math.max(0, eye.openAmount - dt / SLEEP_DURATION);
      eye.pupilX += (0 - eye.pupilX) * PUPIL_LERP;
      eye.pupilY += (0 - eye.pupilY) * PUPIL_LERP;
      if (eye.openAmount <= 0) {
        eye.state = "idle";
        eye.blinkTimer = 0;
        eye.blinkVisible = true;
      }
      break;
  }
}

function setupMouseTracking(eye, preElement) {
  document.addEventListener("mousemove", (e) => {
    // Compute pupil target from mouse position relative to page center
    const rect = preElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const maxDist = Math.max(rect.width, rect.height);

    // Normalize and clamp to [-1, 1]
    eye.targetPupilX = Math.max(-1, Math.min(1, dx / maxDist * 2));
    eye.targetPupilY = Math.max(-1, Math.min(1, dy / maxDist * 2));

    // Wake up if idle or sleeping
    if (eye.state === "idle" || eye.state === "sleeping") {
      eye.state = "awakening";
    }

    // Reset idle timer if tracking
    if (eye.state === "tracking") {
      eye.idleTimer = 0;
    }
  });
}

function init() {
  const COLS = 80;
  const ROWS = 40;

  // Canvas at 4x resolution for smoother sampling
  const canvas = new OffscreenCanvas(COLS * 4, ROWS * 4);
  const ctx = canvas.getContext("2d");

  const pre = document.createElement("pre");
  document.getElementById("root").appendChild(pre);

  const eye = createEyeState();
  setupMouseTracking(eye, pre);

  // Respect prefers-reduced-motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    drawLogo(ctx, canvas.width, canvas.height, eye);
    const lines = canvasToAscii(ctx, canvas.width, canvas.height, COLS, ROWS, 0);
    pre.textContent = lines.join("\n");
    return;
  }

  const loop = new AnimationLoop((time) => {
    updateEyeState(eye, time);
    drawLogo(ctx, canvas.width, canvas.height, eye);
    const lines = canvasToAscii(ctx, canvas.width, canvas.height, COLS, ROWS, time);
    pre.textContent = lines.join("\n");
  });

  // Pause on blur, resume on focus
  window.addEventListener("blur", () => loop.stop());
  window.addEventListener("focus", () => loop.start());
  if (document.visibilityState === "visible") loop.start();
}

init();
