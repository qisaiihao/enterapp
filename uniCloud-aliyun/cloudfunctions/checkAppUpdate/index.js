'use strict';
const { checkUpdate } = require('app-update');

exports.main = (event, context) => checkUpdate(event, context, uniCloud);
