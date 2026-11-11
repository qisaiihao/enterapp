'use strict';
module.exports = function isReleasePath(value) {
  if (typeof value !== 'string') return false;
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch (_) {}
  return decoded.replace(/\\/g, '/').split('/').includes('app-updates');
};
