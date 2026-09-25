export function ocrRegionKey(rect) {
  return rect ? `${rect.x}-${rect.y}-${rect.width}-${rect.height}` : 'full';
}

// The OCR upload is an unscaled crop. Convert every original-image polygon
// from that upload back into the parent page's coordinate system.
export function placeRegionOcr(data, rect, source) {
  const translate = points => points ? points.map(point => ({ x: point.x + rect.x, y: point.y + rect.y })) : null;
  return {
    ...data, width: source.width, height: source.height, region: { ...rect },
    lines: data.lines.map(line => ({
      ...line, polygon: translate(line.polygon),
      chars: line.chars.map(char => ({ ...char, polygon: translate(char.polygon) }))
    }))
  };
}
