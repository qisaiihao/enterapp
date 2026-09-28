'use strict';
// Retain this endpoint for installed old apps; management actions stay intact.
const { checkUpdate } = require('app-update');

module.exports = (event, context) => checkUpdate(event, context, uniCloud, 'legacy');
