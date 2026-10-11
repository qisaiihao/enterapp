// Copy into each cloud function package with scripts/sync-moderation-gate.cjs.
async function moderateBeforeWrite(cloud, content) {
  try {
    const response = await cloud.callFunction({ name: 'contentCheck', data: { type: 'batch', ...content } });
    const audit = response && (response.result || response);
    if (audit && audit.success === true && audit.passed === true) return null;
    return {
      success: false,
      code: (audit && audit.code) || 'MODERATION_UNAVAILABLE',
      message: (audit && audit.message) || '内容审核暂时不可用，请稍后重试'
    };
  } catch (error) {
    console.error('[moderation] cloud function unavailable:', error.code || error.message);
    return { success: false, code: 'MODERATION_UNAVAILABLE', message: '内容审核暂时不可用，请稍后重试' };
  }
}

module.exports = { moderateBeforeWrite };
