const LEADING_POEM_SPACE_RE = /^[\t \u00A0\u1680\u180E\u2000-\u200D\u2028\u2029\u202F\u205F\u2060\u3000\uFEFF]+/;

function normalizePoemDisplayLine(line = '') {
  return String(line || '').replace(LEADING_POEM_SPACE_RE, '');
}

function trimLeadingBlankLines(lines = []) {
  const normalizedLines = Array.isArray(lines) ? lines.slice() : [];
  while (normalizedLines.length > 0 && !normalizedLines[0]) {
    normalizedLines.shift();
  }
  return normalizedLines;
}

function normalizePoemDisplayText(text = '') {
  const normalizedLines = String(text || '')
    .split(/\r?\n/)
    .map(normalizePoemDisplayLine)
  return trimLeadingBlankLines(normalizedLines).join('\n');
}

function normalizePoemDisplayLines(lines = []) {
  if (!Array.isArray(lines)) return [];
  return lines
    .map(normalizePoemDisplayLine)
    .filter(line => (line || '').trim().length > 0);
}

function normalizeSeriesBlocksForDisplay(blocks = []) {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((block = {}, index) => ({
      ...block,
      id: block.id || `series-display-${index}`,
      subtitle: String(block.subtitle || block.subTitle || ''),
      content: normalizePoemDisplayText(block.content || ''),
      highlightSentence: normalizePoemDisplayLine(block.highlightSentence || ''),
      highlightLines: normalizePoemDisplayLines(block.highlightLines || [])
    }))
    .filter(block => block.content.trim() || block.subtitle.trim());
}

function attachPoemDisplayFields(item = {}) {
  const rawSeries = Array.isArray(item.seriesPoems) && item.seriesPoems.length > 0
    ? item.seriesPoems
    : item.seriesBlocks;
  const displaySeriesPoems = normalizeSeriesBlocksForDisplay(rawSeries);

  return {
    ...item,
    displayContent: normalizePoemDisplayText(item.content || ''),
    displayHighlightLines: normalizePoemDisplayLines(item.highlightLines || []),
    displaySeriesPoems
  };
}

module.exports = {
  normalizePoemDisplayLine,
  normalizePoemDisplayText,
  normalizePoemDisplayLines,
  normalizeSeriesBlocksForDisplay,
  attachPoemDisplayFields
};
