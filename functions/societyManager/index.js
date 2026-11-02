'use strict';
const cloud = require('wx-server-sdk');
const { resolveUser } = require('./lib/auth');
const publicApi = require('./lib/public');
const applications = require('./lib/applications');
const members = require('./lib/members');
const content = require('./lib/content');
const participation = require('./lib/participation');
const dashboard = require('./lib/dashboard');
const notices = require('./lib/notifications');
const settings = require('./lib/settings');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database({ throwOnNotFound: false });
const publicActions = new Set(['home', 'list', 'detail', 'profile', 'opportunity', 'publicMembers', 'memberDirectory', 'callList', 'societyWorks']);
const handlers = {
  ...Object.fromEntries(['changeContent', 'editContent', 'acceptHost', 'myWorks', 'publishWork'].map(action => [action, (user, event) => content[action](db, user, event)])),
  saveContent: (user, event) => content.saveContent(db, cloud, user, event),
  ...Object.fromEntries(['registration', 'registrations', 'submitWork', 'withdrawWork', 'submissions', 'reviewWork', 'myParticipation'].map(action => [action, (user, event) => participation[action](db, user, event)])),
  ...Object.fromEntries(['manageContent', 'statistics'].map(action => [action, (user, event) => dashboard[action](db, user, event)])),
  home: (user) => publicApi.home(db, user),
  callList: (user, event) => publicApi.publicCalls(db, event, user),
  list: (user, event) => publicApi.listSocieties(db, event, user),
  detail: (user, event) => publicApi.detail(db, user, event),
  societyWorks: (user, event) => publicApi.societyWorks(db, event, user),
  publicMembers: (user, event) => publicApi.memberList(db, event),
  memberDirectory: (user, event) => publicApi.memberDirectory(db, event),
  profile: (user, event) => publicApi.profile(db, user, event),
  opportunity: (user, event) => publicApi.opportunity(db, event, user),
  myApplication: (user) => applications.myApplication(db, user),
  submitApplication: (user, event) => applications.submitApplication(db, user, event),
  listApplications: (user, event) => applications.listApplications(db, cloud, user, event),
  reviewApplication: (user, event) => applications.reviewApplication(db, user, event),
  follow: (user, event) => members.follow(db, user, event),
  applyJoin: (user, event) => members.applyJoin(db, user, event),
  cancelJoin: (user, event) => members.cancelJoin(db, user, event),
  manage: (user, event) => members.manage(db, user, event),
  memberList: (user, event) => members.memberList(db, user, event),
  notifications: (user, event) => notices.notifications(db, user, event),
  unreadNotifications: (user) => notices.unreadCount(db, user),
  readNotification: (user, event) => notices.readNotification(db, user, event),
  updateSociety: (user, event) => settings.updateSociety(db, cloud, user, event),
  requestList: (user, event) => members.requestList(db, user, event),
  changeMember: (user, event) => members.changeMember(db, user, event),
  reviewJoin: (user, event) => members.reviewJoin(db, user, event),
  mine: (user) => members.mine(db, user)
};
exports.main = async (event = {}) => {
  try {
    if (!Object.prototype.hasOwnProperty.call(handlers, event.action)) return { success: false, code: 'INVALID_ACTION', message: '不支持的诗社操作' };
    const user = await resolveUser(db, event, cloud.getWXContext(), !publicActions.has(event.action));
    return { success: true, ...await handlers[event.action](user, event) };
  } catch (error) {
    // Never log passwords, session tokens, contact details, evidence URLs, or raw database errors.
    console.error('[societyManager]', event.action, error.code || 'SERVICE_ERROR');
    return { success: false, code: error.code || 'SERVICE_ERROR', message: error.code ? error.message : '诗社服务暂时不可用，请稍后重试' };
  }
};
