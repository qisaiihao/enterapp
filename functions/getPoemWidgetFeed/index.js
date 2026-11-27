'use strict';

const cloud = require('wx-server-sdk');
const { createPostsDatabase } = require('./_lib/posts');
const { handle } = require('./feed');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = createPostsDatabase(cloud.database(), { publicOnly: true });

exports.main = (event) => handle(db, event);
