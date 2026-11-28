const POEM_WIDGET_SOURCES = [
  { value: 'today', label: '当日新诗' },
  { value: 'original', label: '原创诗随机' },
  { value: 'repost', label: '非原创诗随机' },
  { value: 'popular', label: '高赞诗随机' }
];

const DEFAULT_WIDGET_OPTIONS = {
  source: 'original',
  palette: 'poem',
  backgroundColor: '#F5EFE5',
  textColor: '#302820'
};

function normalizeWidgetColor(value) {
  const hex = typeof value === 'string' ? value.trim().replace(/^#/, '').toUpperCase() : '';
  if (/^[0-9A-F]{3}$/.test(hex)) return '#' + [...hex].map(char => char + char).join('');
  return /^[0-9A-F]{6}$/.test(hex) ? '#' + hex : '';
}

function normalizeWidgetSettings(settings = {}) {
  const normalize = options => ({
    source: POEM_WIDGET_SOURCES.some(source => source.value === options.source) ? options.source : DEFAULT_WIDGET_OPTIONS.source,
    palette: options.palette === 'custom' ? 'custom' : DEFAULT_WIDGET_OPTIONS.palette,
    backgroundColor: normalizeWidgetColor(options.backgroundColor) || DEFAULT_WIDGET_OPTIONS.backgroundColor,
    textColor: normalizeWidgetColor(options.textColor) || DEFAULT_WIDGET_OPTIONS.textColor
  });
  return { compact: normalize(settings?.compact || {}), wide: normalize(settings?.wide || {}) };
}

function getPoemWidgetNextToken(path) {
  if (typeof path !== 'string') return '';
  const match = /^poementer:\/\/poem-widget\/next\?token=([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i.exec(path);
  return match ? match[1] : '';
}

function getPoemWidgetPostId(path) {
  if (typeof path !== 'string') return '';
  const match = /^(?:poementer:\/\/)?poem-widget\/detail\?id=([^&#\s]+)$/i.exec(path);
  if (!match) return '';
  try {
    const id = decodeURIComponent(match[1]);
    return id.trim() && !/[\x00-\x1f\x7f]/.test(id) ? id : '';
  } catch (_) {
    return '';
  }
}

export { POEM_WIDGET_SOURCES, DEFAULT_WIDGET_OPTIONS, normalizeWidgetColor, normalizeWidgetSettings, getPoemWidgetNextToken, getPoemWidgetPostId };
