function resolveOpenId({ event, context, wxContext, preferEvent = true } = {}) {
  const eventOpenid = event && event.openid;
  const ctxOpenid = context && context.OPENID;
  const wxOpenid = wxContext && (wxContext.OPENID || (wxContext.claims && wxContext.claims.openid));

  if (preferEvent) {
    return eventOpenid || ctxOpenid || wxOpenid || '';
  }
  return wxOpenid || eventOpenid || ctxOpenid || '';
}

function buildNoOpenIdResponse(message = 'Unable to resolve user openid. Please sign in again.') {
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
