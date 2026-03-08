function resolveOpenId({ event, context, wxContext, preferEvent = true } = {}) {
  const eventOpenid = event && event.openid;
  const ctxOpenid = context && context.OPENID;
  const wxOpenid = wxContext && (wxContext.OPENID || (wxContext.claims && wxContext.claims.openid));

  if (preferEvent) {
    return eventOpenid || ctxOpenid || wxOpenid || '';
  }
  return wxOpenid || eventOpenid || ctxOpenid || '';
}

function buildNoOpenIdResponse(message = '无法获取用户 openid，请重新登录') {
  return {
    success: false,
    message,
    code: 'NO_OPENID'
  };
}

module.exports = {
  resolveOpenId,
  buildNoOpenIdResponse
};
