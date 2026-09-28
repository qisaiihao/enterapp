// Version names only. Android versionCode is a separate build counter.
export function isUpdateVersion(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) &&
    value.split('.').every(part => Number.isSafeInteger(Number(part)));
}

export function compareUpdateVersion(a, b) {
  if (!isUpdateVersion(a) || !isUpdateVersion(b)) throw new Error('版本号格式无效');
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}
