'use strict';
const { hash, error, text, id, page, read, list, pick, membershipId, platformAdmin } = require('./common');
const applicationId = user => hash('application', user._id);
const uploadPrefix = user => `societies/${hash('files', user._id).slice(0, 32)}`;
const { send } = require('./notifications');

function validateForm(form, user) {
  if (!form || typeof form !== 'object') throw error('请填写申请资料');
  const out = {};
  for (const [key, label, max, min] of [
    ['region', '所在地区', 40, 1], ['school', '学校名称', 60, 2], ['name', '诗社名称', 40, 2],
    ['contactName', '负责人', 30, 1], ['phone', '联系电话', 20, 5], ['description', '诗社简介', 1000, 10], ['motto', '诗社口号', 60, 0]
  ]) out[key] = text(form[key] || '', max, min, label);
  if (form.recruitment !== undefined && form.recruitment !== '' && !['open', 'school'].includes(form.recruitment)) throw error('请选择有效的成员招募范围');
  out.recruitment = ['open', 'school'].includes(form.recruitment) ? form.recruitment : 'open';
  if (!/^[+\d][\d\s()-]{4,19}$/.test(out.phone)) throw error('请填写有效联系电话');
  out.foundedAt = text(form.foundedAt || '', 10, 0, '成立日期');
  if (out.foundedAt && (!/^\d{4}-\d{2}-\d{2}$/.test(out.foundedAt) || !Number.isFinite(Date.parse(out.foundedAt)) || new Date(out.foundedAt).toISOString().slice(0, 10) !== out.foundedAt || new Date(out.foundedAt) > new Date())) throw error('请填写有效的成立日期');
  const prefix = uploadPrefix(user);
  const file = (value, kind) => {
    if (typeof value !== 'string' || value.length > 1000 || !value.startsWith('cloud://') || !value.includes(`/${prefix}/${kind}/`) || !/\.(png|jpe?g|webp)$/i.test(value)) throw error('请重新上传有效的材料或头像');
    return value;
  };
  if (!Array.isArray(form.proofFiles) || form.proofFiles.length < 1 || form.proofFiles.length > 3) throw error('请上传1—3张证明材料');
  out.proofFiles = [...new Set(form.proofFiles.map(value => file(value, 'proof')))];
  out.avatarUrl = file(form.avatarUrl, 'avatar');
  if (form.agreed !== true) throw error('请确认申请资料真实有效');
  out.agreed = true;
  return out;
}

async function myApplication(db, user) {
  return { application: await read(db, 'society_applications', applicationId(user)), uploadPrefix: uploadPrefix(user) };
}
async function submitApplication(db, user, event) {
  const form = validateForm(event.form, user);
  if (user.postingBanned === true) throw error('账号已被限制发布内容', 'FORBIDDEN');
  const appId = applicationId(user);
  const payloadHash = hash(form);
  return db.runTransaction(async tx => {
    const previous = await read(tx, 'society_applications', appId);
    if (previous?.status === 'approved') throw error('你的诗社已开通，请前往诗社主页');
    if (previous?.status === 'pending') {
      if (previous.payloadHash === payloadHash) return { applicationId: appId, alreadySubmitted: true };
      throw error('已有审核中的申请，请等待审核结果');
    }
    const revision = (previous?.revision || 0) + 1;
    await tx.collection('society_applications').doc(appId).set({ data: {
      ...form, userDocId: user._id, applicantId: user._openid, status: 'pending', revision, payloadHash,
      createdAt: previous?.createdAt || new Date(), submittedAt: new Date(), reviewNote: '', societyId: ''
    } });
    return { applicationId: appId, revision };
  });
}
async function listApplications(db, cloud, user, event) {
  await platformAdmin(db, user);
  const status = ['pending', 'approved', 'rejected'].includes(event.status) ? event.status : 'pending';
  const pagination = page(event);
  const applications = await list(db, 'society_applications', { status }, { ...pagination, order: 'submittedAt' });
  const files = [...new Set(applications.flatMap(row => [...row.proofFiles, row.avatarUrl]))];
  let urls = {};
  if (files.length) {
    const response = await cloud.getTempFileURL({ fileList: files });
    urls = Object.fromEntries((response.fileList || []).filter(row => row.tempFileURL).map(row => [row.fileID, row.tempFileURL]));
  }
  return { applications: applications.map(row => ({ ...row, avatarDisplay: urls[row.avatarUrl] || '', proofUrls: row.proofFiles.map(file => urls[file]).filter(Boolean) })), hasMore: applications.length === pagination.limit };
}
async function reviewApplication(db, user, event) {
  await platformAdmin(db, user);
  const appId = id(event.applicationId);
  if (!['approved', 'rejected'].includes(event.decision)) throw error('请选择有效审核结果');
  const note = text(event.note || '', 300, event.decision === 'rejected' ? 1 : 0, '审核意见');
  return db.runTransaction(async tx => {
    const application = await read(tx, 'society_applications', appId);
    const currentAdmin = await read(tx, 'users', user._id);
    await platformAdmin(tx, currentAdmin || {});
    if (!application) throw error('申请不存在', 'NOT_FOUND');
    if (application.revision !== event.revision) throw error('申请已更新，请刷新后审核', 'STALE_REVIEW');
    if (application.status !== 'pending') {
      if (application.status === event.decision) return { societyId: application.societyId, alreadyReviewed: true };
      throw error('申请已被处理，请刷新列表', 'STALE_REVIEW');
    }
    const societyId = hash('society', appId);
    const nameKey = hash('name', application.school.replace(/\s/g, '').toLowerCase(), application.name.replace(/\s/g, '').toLowerCase());
    const reserved = event.decision === 'approved' ? await read(tx, 'society_names', nameKey) : null;
    const applicant = await read(tx, 'users', application.userDocId);
    if (!applicant || applicant._openid !== application.applicantId || applicant.postingBanned === true) throw error('申请人账号已变化，请核实后处理');
    if (reserved && reserved.societyId !== societyId) throw error('该学校已有同名诗社，请核实后处理');
    const now = new Date();
    if (event.decision === 'approved') {
      await tx.collection('societies').doc(societyId).set({ data: {
        ...pick(application, ['name', 'school', 'region', 'motto', 'description', 'avatarUrl', 'foundedAt', 'recruitment']),
        ownerId: applicant._openid, status: 'active', applicationId: appId,
        memberCount: 1, workCount: 0, eventCount: 0, callCount: 0, createdAt: now, updatedAt: now
      } });
      await tx.collection('society_names').doc(nameKey).set({ data: { societyId } });
      await tx.collection('society_members').doc(membershipId(societyId, applicant._openid)).set({ data: {
        societyId, userId: applicant._openid, userDocId: applicant._id, role: 'owner', status: 'active', joinedAt: now, createdAt: now
      } });
      await tx.collection('society_follows').doc(hash('follow', societyId, applicant._openid)).set({ data: {
        societyId, userId: applicant._openid, following: true, createdAt: now
      } });
    }
    await tx.collection('society_applications').doc(appId).update({ data: {
      status: event.decision, reviewNote: note, reviewedBy: user._openid, reviewedAt: now, societyId: event.decision === 'approved' ? societyId : ''
    } });
    await tx.collection('society_audit_logs').doc(hash('application-review', appId, application.revision)).set({ data: {
      kind: 'application', targetId: appId, revision: application.revision, decision: event.decision, note, operatorId: user._openid, createdAt: now
    } });
    await send(tx, { userId: application.applicantId, societyId: event.decision === 'approved' ? societyId : '', category: 'application', title: event.decision === 'approved' ? '诗社入驻已通过' : '诗社入驻需修改', body: note, targetId: event.decision === 'approved' ? societyId : '', targetKind: event.decision === 'approved' ? 'society' : 'apply' }, `application:${appId}:${application.revision}`);
    return { societyId: event.decision === 'approved' ? societyId : '' };
  });
}
module.exports = { myApplication, submitApplication, listApplications, reviewApplication, validateForm, uploadPrefix };
