// Canvas adaptation of layered noise / softened edge ideas in TornPaper.js:
// https://github.com/happy358/TornPaper (happy358, MIT).
// Independent pixel-mask implementation; no DOM/SVG filter dependency.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const smooth = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};

function hash(position, seed) {
  let n = Math.imul(position ^ seed, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 0x100000000;
}

function noise(position, seed) {
  const cell = Math.floor(position), t = smooth(0, 1, position - cell);
  return hash(cell, seed) * (1 - t) + hash(cell + 1, seed) * t;
}

// Process just four narrow, non-overlapping strips. This keeps native Canvas
// bridge transfers small even when the source is a large square photograph.
export function createTornPaper(width, height, seed) {
  const shortSide = Math.min(width, height);
  const depth = Math.min(shortSide * 0.16, clamp(shortSide * 0.065, 2.2, 11));
  const fiberScale = Math.min(1, shortSide / 24);
  const band = Math.ceil(depth * 1.6 + 5);
  const sideSeeds = [0x1a32, 0x34bf, 0x51d3, 0x7fa1].map(salt => (seed ^ salt) >>> 0);
  const profiles = [width, height, width, height].map((length, side) => {
    const values = new Float32Array(length), s = sideSeeds[side];
    for (let p = 0; p < length; p++) {
      // Broad, connected undulations plus much smaller irregular tears.
      values[p] = depth * (0.48 + 0.7 * noise(p / 47, s) + 0.3 * noise(p / 11, s ^ 521))
        + fiberScale * (noise(p / 2.3, s ^ 937) - 0.5) * 0.9;
    }
    return values;
  });
  const top = Math.min(band, Math.ceil(height / 2));
  const bottom = Math.min(band, height - top);
  const left = Math.min(band, Math.ceil(width / 2));
  const right = Math.min(band, width - left);
  const middle = height - top - bottom;
  const regions = [
    { x: 0, y: 0, width, height: top },
    { x: 0, y: height - bottom, width, height: bottom },
    { x: 0, y: top, width: left, height: middle },
    { x: width - right, y: top, width: right, height: middle }
  ].filter(region => region.width && region.height);

  function apply(data, region) {
    if (data.length !== region.width * region.height * 4) throw new Error('纸片像素尺寸不匹配，请重试');
    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        const distances = [y - profiles[0][x], width - 1 - x - profiles[1][y], height - 1 - y - profiles[2][x], x - profiles[3][y]];
        let side = 0;
        for (let i = 1; i < 4; i++) if (distances[i] < distances[side]) side = i;
        const distance = distances[side];
        if (distance > 3.2 * fiberScale) continue; // Leave paper and printed content untouched.
        const offset = ((y - region.y) * region.width + x - region.x) * 4;
        const along = side % 2 ? y : x, s = sideSeeds[side];
        const grain = noise((along + distance * 0.35) / 0.72, s ^ 2017);
        const reach = fiberScale * (0.8 + 1.8 * noise(along / 3.7, s ^ 1327));
        const body = smooth(-0.35 * fiberScale, 0.8 * fiberScale, distance);
        // Sparse, slightly slanted translucent fibers emerge from a solid edge.
        const fibers = Math.pow(grain, 3) * 0.8 * smooth(-reach, 0.3 * fiberScale, distance);
        const alpha = Math.max(body, fibers);
        data[offset + 3] = Math.round(data[offset + 3] * alpha);
        if (!data[offset + 3]) continue;
        // A thin, broken, lighter paper lip. No uniform white outline or shadow.
        const lipWidth = fiberScale * (0.8 + 1.5 * noise(along / 6, s ^ 3011));
        const lift = (1 - smooth(0, lipWidth, Math.max(0, distance))) * (0.08 + grain * 0.22);
        for (let channel = 0; channel < 3; channel++) {
          data[offset + channel] = Math.round(data[offset + channel] + (255 - data[offset + channel]) * lift);
        }
      }
    }
  }
  return { regions, apply };
}
