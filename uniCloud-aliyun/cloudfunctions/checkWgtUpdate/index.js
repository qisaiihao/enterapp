'use strict';
const { checkUpdate } = require('app-update');

// The old fallback only understands WGT. Never send resources without knowing
// the native version. The preceding uni-upgrade-center call delivers the APK.
exports.main = (event, context) => checkUpdate(event, context, uniCloud, 'legacy-wgt');
