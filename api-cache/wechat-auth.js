import { callCloudAndGetResult } from './_shared/cloud-wrapper.js';

// Expected conflict responses are data for the confirmation UI, not generic errors.
export function bindWechatAccount(poemId, forceRebind, context) {
  return callCloudAndGetResult('bindWechatToAccount', { poemId, forceRebind: forceRebind === true }, {
    context, pageTag: 'wechat:bind', injectOpenId: false
  });
}
