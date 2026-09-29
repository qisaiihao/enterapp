// Retired after the minimum supported client moved to 1.7.0.
// Never migrate ownership IDs from a client-supplied oldOpenid / public Poem ID.
exports.main = async () => ({
  success: false,
  code: 'LEGACY_BINDING_DISABLED',
  message: '此绑定方式已停用，请使用 1.7.0 及以上版本重新登录并绑定微信'
});
