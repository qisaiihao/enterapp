// Match the App's light-mode PoemCard and utils/uiHelpers.js contrast rules.
// The website remains standalone; the App's theme/font modules are not imported.
const defaultBackgrounds = ["#a4c4bd", "#c9cfcf", "#906161", "#909388"];

function parseColor(value) {
  if (typeof value !== "string") return null;
  const color = value.trim();
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [0, 2, 4].map((offset) =>
      parseInt(raw.slice(offset, offset + 2), 16),
    );
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(",").map((part) => Number(part.trim()));
    if ([3, 4].includes(parts.length) && parts.every(Number.isFinite))
      return parts.slice(0, 3);
  }
  return null;
}

function luminance(channels) {
  const linear = channels.map((value) => {
    const normalized = Math.max(0, Math.min(255, value)) / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(first, second) {
  const a = luminance(first),
    b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function resolveCardColors(post) {
  const id = String(post._id || post.id || "");
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  // The App picks a random default when a legacy post has no stored background.
  // Use that same palette, stable per ID so pagination does not recolor cards.
  const backgroundColor = parseColor(post.backgroundColor)
    ? post.backgroundColor.trim()
    : defaultBackgrounds[hash % defaultBackgrounds.length];
  const preferred = parseColor(post.textColor) ? post.textColor.trim() : "#222";
  const background = parseColor(backgroundColor);
  if (contrast(parseColor(preferred), background) >= 4.5)
    return { backgroundColor, textColor: preferred };
  const dark = "#111A1B",
    light = "#F8F4EA";
  return {
    backgroundColor,
    textColor:
      contrast(parseColor(dark), background) >=
      contrast(parseColor(light), background)
        ? dark
        : light,
  };
}
