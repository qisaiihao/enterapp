import { cloudCall } from '@/utils/cloudCall.js';
import { unwrapResult } from './_shared/cloud-wrapper.js';
import { getCurrentUserId } from '@/utils/auth.js';
import { requireLogin } from '@/utils/authHelper.js';
import fileUrlCache from '@/cache/core/file-url.js';
import { hydrateTempUrls } from '@/cache/core/hydrate.js';

let loginPrompt = null;
function promptLogin() {
  if (!loginPrompt) {
    loginPrompt = requireLogin({ content: '需要登录后才能使用诗社功能' }).then(
      result => { loginPrompt = null; return result; },
      error => { loginPrompt = null; throw error; }
    );
  }
  return loginPrompt;
}

async function hydrate(result) {
  const entries = [result.society, ...(result.societies || []), result.profile, ...(result.members || []), ...(result.managers || []), ...(result.applications || []), ...(result.requests || []), ...(result.hosts || []), ...(result.records || [])].filter(Boolean);
  const ids = [...new Set(entries.map(row => row.avatarUrl).filter(url => typeof url === 'string' && url.startsWith('cloud://')))];
  if (ids.length) {
    const urls = await fileUrlCache.getTempUrls(ids);
    entries.forEach(row => { if (urls[row.avatarUrl]) { row.avatarFileId = row.avatarUrl; row.avatarUrl = urls[row.avatarUrl]; } });
  }
  const media = [...(result.events || []), ...(result.calls || []), ...(result.records || []), ...(result.item ? [result.item, ...(result.item.guests || [])] : [])];
  const mediaIds = [...new Set(media.flatMap(row => [row.coverImage, row.avatarUrl]).filter(url => typeof url === 'string' && url.startsWith('cloud://')))];
  if (mediaIds.length) { const urls = await fileUrlCache.getTempUrls(mediaIds); media.forEach(row => { for (const key of ['coverImage', 'avatarUrl']) if (urls[row[key]]) { row[key + 'FileId'] = row[key]; row[key] = urls[row[key]]; } }); }
  const notices = (result.notifications || []).filter(row => typeof row.societyAvatar === 'string' && row.societyAvatar.startsWith('cloud://'));
  const noticeAvatars = [...new Set(notices.map(row => row.societyAvatar))];
  if (noticeAvatars.length) {
    const urls = await fileUrlCache.getTempUrls(noticeAvatars);
    notices.forEach(row => { if (urls[row.societyAvatar]) { row.societyAvatarFileId = row.societyAvatar; row.societyAvatar = urls[row.societyAvatar]; } });
  }
  await hydrateTempUrls(result.works || []);
  await hydrateTempUrls(result.events || []);
  await hydrateTempUrls(result.calls || []);
  if (result.item) {
    await hydrateTempUrls([result.item]);
    const avatar = result.item.societyAvatar;
    if (typeof avatar === 'string' && avatar.startsWith('cloud://')) {
      const urls = await fileUrlCache.getTempUrls([avatar]);
      result.item.societyAvatar = urls[avatar] || avatar;
    }
  }
  return result;
}

// Personal data is deliberately not persisted in the shared list cache.
export async function societyRequest(action, payload = {}, context) {
  const actor = getCurrentUserId();
  let response;
  try {
    response = await cloudCall('societyManager', { ...payload, action },
      { context, pageTag: `societies:${action}`, requireAuth: false, timeoutMs: action === 'saveContent' ? 310000 : undefined, silent: true });
  } catch (cause) {
    // Keep the transport failure distinguishable from a service-side rejection.
    // Never surface SDK messages, which may include request details.
    const code = /^[A-Z][A-Z0-9_]{1,47}$/.test(cause?.code || '') ? cause.code : 'CLOUD_CALL_FAILED';
    const failure = new Error(`诗社服务调用失败（${code}）`);
    failure.code = code;
    throw failure;
  }
  if (actor !== getCurrentUserId()) throw new Error('账号已切换，请刷新页面');
  try { const result = await hydrate(unwrapResult(response, '诗社服务暂时不可用，请稍后重试')); if (actor !== getCurrentUserId()) throw new Error('账号已切换，请刷新页面'); return result; }
  catch (error) {
    error.code = error.result?.code || error.code;
    if (error.code === 'AUTH_REQUIRED') promptLogin().catch(() => {});
    if (error.code === 'SERVICE_ERROR') error.message = `诗社服务处理失败（${error.code}）`;
    throw error;
  }
}

export async function societyFileUrls(fileIds = []) { return fileUrlCache.getTempUrls(fileIds); }
