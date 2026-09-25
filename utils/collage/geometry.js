export const BOARD = { width: 900, height: 1200 };
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function randomEdgeSeed(previous = 0) {
  const seed = Math.floor(Math.random() * 0x100000000) >>> 0;
  return seed === previous ? (seed + 1) >>> 0 : seed;
}

export function bounds(points) {
  if (!Array.isArray(points) || points.length < 4 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const x = Math.min(...points.map(p => p.x));
  const y = Math.min(...points.map(p => p.y));
  const width = Math.max(...points.map(p => p.x)) - x;
  const height = Math.max(...points.map(p => p.y)) - y;
  return width > 0 && height > 0 ? { x, y, width, height } : null;
}

export function fitSize(width, height, maxSide = 2560) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// EXIF orientations that display the bitmap rotated by 90 or 270 degrees.
const quarterTurnOrientations = ['left', 'left-mirrored', 'right', 'right-mirrored'];

export function orientedSize(width, height, orientation) {
  return quarterTurnOrientations.includes(orientation) ? { width: height, height: width } : { width, height };
}

export function clipRect(rect, width, height, padding = 0) {
  const x = clamp(Math.floor(rect.x - padding), 0, width - 1);
  const y = clamp(Math.floor(rect.y - padding), 0, height - 1);
  const right = clamp(Math.ceil(rect.x + rect.width + padding), x + 1, width);
  const bottom = clamp(Math.ceil(rect.y + rect.height + padding), y + 1, height);
  return { x, y, width: right - x, height: bottom - y };
}

// OCR coordinates are always expressed in the normalized source image, never the preview.
export function selectionRect(line, start, end) {
  const selected = line.chars.slice(Math.min(start, end), Math.max(start, end) + 1);
  if (!selected.length || selected.some(char => !bounds(char.polygon))) return null;
  return bounds(selected.flatMap(char => char.polygon));
}

export function dragRect(a, b, width, height) {
  return clipRect({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }, width, height);
}

// Deterministic contours keep the saved PNG, preview and export identical.
export function edgePath(width, height, style, seed = 1) {
  if (style === 'straight') return [[0, 0], [width, 0], [width, height], [0, height]];
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const depth = Math.min(width, height) * (style === 'torn' ? 0.055 : 0.035);
  const corners = [[0, 0], [width, 0], [width, height], [0, height]];
  const points = [];
  for (let side = 0; side < 4; side++) {
    const a = corners[side], b = corners[(side + 1) % 4];
    const steps = style === 'torn' ? Math.max(4, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12)) : 3;
    for (let step = 0; step < steps; step++) {
      const t = step / steps, inset = Math.min(1, depth) + random() * Math.max(0, depth - 1);
      let x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      if (side === 0) y += inset;
      if (side === 1) x -= inset;
      if (side === 2) y -= inset;
      if (side === 3) x += inset;
      points.push([x, y]);
    }
  }
  return points;
}
