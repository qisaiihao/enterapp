import { callCloudAndUnwrap, callActionAndUnwrap } from './_shared/cloud-wrapper.js';

export function getContactConfig(context) {
  return callCloudAndUnwrap('getContactConfig', {}, {
    context, requireAuth: false, pageTag: 'contact'
  }, '联系方式加载失败');
}

export function saveContactConfig(payload, context) {
  return callActionAndUnwrap({
    functionName: 'adminManager', action: 'updateContactConfig', payload,
    context, requireAuth: true, pageTag: 'contact-management', fallbackMessage: '保存失败'
  });
}
