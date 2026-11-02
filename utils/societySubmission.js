import { societyRequest } from '@/api-cache/societies.js';
import { getCurrentUserId } from '@/utils/auth.js';

const KEY = 'society:pending-submission:v1:';
function key(actor) { return KEY + actor; }

async function attempt(callId, postId, actor, context) {
  try {
    await societyRequest('submitWork', { id: callId, postId }, context);
    if (actor !== getCurrentUserId()) throw new Error('账号已切换，请重新确认投稿');
    try { uni.removeStorageSync(key(actor)); } catch (_) {}
    return { attempted: true, submitted: true };
  } catch (error) {
    return { attempted: true, submitted: false, error };
  }
}

export async function submitPublishedPoemToSociety(callId, postId, context) {
  const actor = getCurrentUserId();
  if (!actor || !callId || !postId) return { attempted: true, submitted: false, error: new Error('已发表诗歌，但未取得投稿所需的账号或作品信息') };
  // Keep the original post ID for a safe retry. Re-publishing would duplicate the poem.
  try { uni.setStorageSync(key(actor), { callId, postId, actor }); } catch (_) {}
  return attempt(callId, postId, actor, context);
}

export async function retryPendingSocietySubmission(callId, context) {
  const actor = getCurrentUserId();
  if (!actor || !callId) return { attempted: false };
  let pending;
  try { pending = uni.getStorageSync(key(actor)); } catch (_) { return { attempted: false }; }
  if (!pending || pending.actor !== actor || pending.callId !== callId || !pending.postId) return { attempted: false };
  return attempt(callId, pending.postId, actor, context);
}
