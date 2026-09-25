import { uid } from './geometry.js';
import { createCollageLogger } from './debug.js';

const log = createCollageLogger('storage');
const objectUrls = new Map();
let database;
function openDatabase() {
  if (!database) database = new Promise((resolve, reject) => {
    const request = indexedDB.open('poementer-collage-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本机素材库，请检查浏览器存储设置'));
  });
  return database;
}
async function fileTransaction(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('files', mode);
    const request = action(tx.objectStore('files'));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(new Error('素材保存失败，本机存储空间可能不足'));
    tx.onabort = () => reject(new Error('素材存储操作已中止'));
  });
}

export function workspaceKey() {
  const account = uni.getStorageSync('userOpenId') || uni.getStorageSync('openid') || 'guest';
  return `collage-workspace-v1:${account}`;
}
export function emptyWorkspace() {
  return { version: 1, sources: [], materials: [], items: [], background: '#f5f0e6', backgroundImage: null };
}
export function loadWorkspace(key) {
  let value;
  try {
    value = uni.getStorageSync(key);
  } catch (error) {
    log.error('读取草稿失败', { key, error });
    return emptyWorkspace();
  }
  if (value && value.version === 1) {
    log.debug('读取草稿', { key, sources: value.sources?.length || 0, materials: value.materials?.length || 0, items: value.items?.length || 0 });
    return value;
  }
  if (value) log.warn('草稿版本不兼容，已忽略', { key, version: value.version });
  else log.debug('没有本机草稿，使用空工作区', { key });
  return emptyWorkspace();
}
export function saveWorkspace(key, workspace) {
  // Never store temporary paths / blob URLs in metadata.
  try {
    uni.setStorageSync(key, JSON.parse(JSON.stringify(workspace)));
    log.debug('保存草稿', { key, sources: workspace.sources?.length || 0, materials: workspace.materials?.length || 0, items: workspace.items?.length || 0 });
  } catch (error) {
    log.error('保存草稿失败', { key, error });
    throw error;
  }
}
export async function persistFile(path) {
  // #ifdef H5
  const response = await fetch(path);
  if (!response.ok) throw new Error('读取图片失败');
  const blob = await response.blob();
  const key = `idb:${uid()}`;
  await fileTransaction('readwrite', store => store.put(blob, key));
  log.debug('保存文件到 IndexedDB', { key, bytes: blob.size });
  return key;
  // #endif
  // #ifndef H5
  return new Promise((resolve, reject) => uni.saveFile({
    tempFilePath: path,
    success: res => { log.debug('保存文件到本机', { path: res.savedFilePath }); resolve(res.savedFilePath); },
    fail: error => { log.error('保存文件失败', { path, error }); reject(new Error('保存图片失败，请检查本机存储空间')); }
  }));
  // #endif
}
export async function resolveFile(ref) {
  // #ifdef H5
  if (ref.startsWith('idb:')) {
    if (objectUrls.has(ref)) return objectUrls.get(ref);
    const blob = await fileTransaction('readonly', store => store.get(ref));
    if (!blob) {
      log.error('素材文件已丢失', { ref });
      throw new Error('素材文件已丢失，请重新导入图片');
    }
    const url = URL.createObjectURL(blob);
    objectUrls.set(ref, url);
    return url;
  }
  // #endif
  return ref;
}
export async function removeFile(ref) {
  // #ifdef H5
  if (ref.startsWith('idb:')) {
    if (objectUrls.has(ref)) URL.revokeObjectURL(objectUrls.get(ref));
    objectUrls.delete(ref);
    await fileTransaction('readwrite', store => store.delete(ref));
    log.debug('删除 IndexedDB 文件', { ref });
    return;
  }
  // #endif
  // #ifndef H5
  await new Promise(resolve => uni.removeSavedFile({
    filePath: ref,
    complete: res => { log.debug('删除本机文件', { ref, errMsg: res?.errMsg }); resolve(); }
  }));
  // #endif
}
export function releaseFiles() {
  // #ifdef H5
  objectUrls.forEach(url => URL.revokeObjectURL(url));
  objectUrls.clear();
  // #endif
}
