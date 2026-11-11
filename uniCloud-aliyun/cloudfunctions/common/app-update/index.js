'use strict';
const policy = require('./policy');
const { fromCloudBase } = require('./bridge');

// Keep the uniCloud database and upgrade-center management actions available.
// A healthy CloudBase update wins; errors/no update fall back to existing records.
async function checkUpdate(event, context, cloud, mode = 'current') {
  const remote = await fromCloudBase(event, context, cloud, mode);
  if (remote) return remote;
  return policy.checkUpdate(event, context, cloud, mode);
}
module.exports = { ...policy, checkUpdate };
