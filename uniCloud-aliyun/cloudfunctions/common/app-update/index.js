'use strict';
const policy = require('./policy');
const { fromCloudBase } = require('./bridge');

// Keep the uniCloud database and upgrade-center management actions available.
// A healthy CloudBase update wins; errors/no update fall back to existing records.
async function checkUpdate(event, context, cloud, mode = 'current') {
  // Mark every uniCloud-originated check so unicloud_only releases stay eligible
  // both when bridged to CloudBase and when falling back to uniCloud records.
  const request = { ...event, via: 'unicloud' };
  const remote = await fromCloudBase(request, context, cloud, mode);
  if (remote) return remote;
  return policy.checkUpdate(request, context, cloud, mode);
}
module.exports = { ...policy, checkUpdate };
