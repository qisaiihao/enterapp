const { createHash } = require('crypto');

const REASONS = {
  harm: [
    '我不喜欢', '色情低俗', '散布政治谣言', '煽动群体对立或引战', '涉嫌诈骗',
    '引导到其他平台', '违反法律法规', '侮辱攻击或引导网暴', 'AI造假',
    '虚假营销、假货', '宣传不良价值观或行为', '饭圈乱象',
    '危害未成年人健康', '不实信息、谣言', '其他问题'
  ],
  rights: [
    '抄袭搬运我的作品', '侵犯著作权', '侵犯肖像权', '泄露隐私',
    '侵犯名誉权', '冒充我的身份', '侵犯商标或专利', '其他侵权'
  ]
};

function validateSubmission(event) {
  const postId = typeof event.postId === 'string' ? event.postId.trim() : '';
  const category = event.category;
  const reason = event.reason;
  const description = typeof event.description === 'string' ? event.description.trim() : '';
  const evidenceImages = event.evidenceImages == null ? [] : event.evidenceImages;
  const requestId = event.requestId;
  if (!postId || postId.length > 128) throw new Error('帖子无效');
  if (!REASONS[category] || !REASONS[category].includes(reason)) throw new Error('请选择有效的举报原因');
  if (description.length > 500) throw new Error('补充说明最多500字');
  if ((reason === '其他问题' || reason === '其他侵权') && !description) throw new Error('请补充说明具体问题');
  if (!Array.isArray(evidenceImages) || evidenceImages.length > 3 ||
      evidenceImages.some(id => typeof id !== 'string' || !id.startsWith('cloud://') || id.length > 1000) ||
      (category !== 'rights' && evidenceImages.length)) throw new Error('证据图片无效');
  if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)) throw new Error('提交标识无效');
  return { postId, category, reason, description, evidenceImages, requestId };
}

async function readDoc(ref) {
  try { return (await ref.get()).data || null; }
  catch (error) {
    if (/document.*(does not exist|not exist)|record not found/i.test(String(error.errMsg || error.message || error))) return null;
    throw error;
  }
}

function messageId(reportId, recipient, kind) {
  return createHash('sha256').update(`${reportId}:notify:${kind}:${recipient}`).digest('hex');
}

async function submitPostReport(db, event, openid, getAdminUsers = async () => []) {
  const data = validateSubmission(event);
  if (data.evidenceImages.some(id => !id.includes(`/post-reports/${openid}/`))) {
    throw new Error('证据图片与当前用户不匹配');
  }
  const reportId = createHash('sha256').update(`${openid}:${data.requestId}`).digest('hex');
  const reportRef = db.collection('post_reports').doc(reportId);
  const existing = await readDoc(reportRef);
  if (existing) return { success: true, reportId, alreadySubmitted: true };

  const post = await readDoc(db.collection('posts').doc(data.postId));
  if (!post || post.isDeleted) throw new Error('帖子已不存在');
  const duplicate = await db.collection('post_reports').where({
    reporterOpenid: openid, postId: data.postId, status: 'pending'
  }).limit(1).get();
  if (duplicate.data && duplicate.data.length) throw new Error('你已举报过该帖子，正在等待处理');
  const userResult = await db.collection('users').where({ _openid: openid }).limit(1).get();
  const user = userResult.data && userResult.data[0] || {};
  const adminUsers = await getAdminUsers();
  const adminOpenids = [...new Set((adminUsers || []).map(item => item && item._openid).filter(Boolean))];
  const images = Array.isArray(post.imageUrls) ? post.imageUrls : (post.imageUrl ? [post.imageUrl] : []);
  const now = new Date();
  const reportData = {
    postId: data.postId,
    category: data.category,
    reason: data.reason,
    description: data.description,
    evidenceImages: data.evidenceImages,
    reporterOpenid: openid,
    reporterName: user.nickName || '用户',
    postSnapshot: {
      title: String(post.title || '').slice(0, 200),
      content: String(post.content || '').slice(0, 4000),
      authorName: String(post.authorName || '').slice(0, 100),
      imageUrls: images.slice(0, 9)
    },
    status: 'pending',
    createTime: now
  };
  await db.runTransaction(async transaction => {
    const transactionalReport = transaction.collection('post_reports').doc(reportId);
    if (await readDoc(transactionalReport)) return;
    await transactionalReport.set({ data: reportData });
    for (const adminOpenid of adminOpenids) {
      await transaction.collection('messages').doc(messageId(reportId, adminOpenid, 'new')).set({ data: {
        fromUserId: openid,
        fromUserName: user.nickName || '用户',
        fromUserAvatar: user.avatarUrl || '',
        toUserId: adminOpenid,
        type: 'post_report_new',
        reportId,
        postTitle: reportData.postSnapshot.title,
        reportReason: data.reason,
        content: `${user.nickName || '用户'}提交了新的举报`,
        isRead: false,
        createTime: now
      } });
    }
  });
  return { success: true, reportId };
}

async function listPostReports(db, event) {
  const status = ['pending', 'handled', 'dismissed', 'all'].includes(event.status) ? event.status : 'pending';
  const skip = Math.max(0, Math.floor(Number(event.skip) || 0));
  const limit = Math.min(30, Math.max(1, Math.floor(Number(event.limit) || 20)));
  let query = db.collection('post_reports');
  if (status === 'pending') query = query.where({ status: db.command.in(['pending', 'processing']) });
  else if (status !== 'all') query = query.where({ status });
  const result = await query.orderBy('createTime', 'desc').skip(skip).limit(limit + 1).get();
  return { success: true, reports: (result.data || []).slice(0, limit), hasMore: (result.data || []).length > limit };
}

async function getPostReport(db, event) {
  const reportId = typeof event.reportId === 'string' ? event.reportId.trim() : '';
  if (!/^[a-f0-9]{64}$/.test(reportId)) throw new Error('举报标识无效');
  const report = await readDoc(db.collection('post_reports').doc(reportId));
  if (!report) throw new Error('举报不存在');
  return { success: true, report };
}

async function resolvePostReport(db, event, openid, deletePost) {
  const reportId = typeof event.reportId === 'string' ? event.reportId.trim() : '';
  const decision = event.decision;
  if (!/^[a-f0-9]{64}$/.test(reportId) || !['delete', 'dismiss'].includes(decision)) throw new Error('处理参数无效');
  const ref = db.collection('post_reports').doc(reportId);
  const report = await readDoc(ref);
  if (!report) throw new Error('举报不存在');
  const staleProcessing = report.status === 'processing' &&
    Date.now() - new Date(report.processingAt).getTime() > 2 * 60 * 1000;
  if (report.status !== 'pending' && !staleProcessing) throw new Error('该举报正在处理或已处理，请刷新列表');
  if (staleProcessing && report.processingDecision && report.processingDecision !== decision) {
    throw new Error('该举报已有处理操作，只能重试原操作');
  }

  const claim = await db.collection('post_reports').where({ _id: reportId, status: report.status })
    .update({ data: { status: 'processing', processingBy: openid, processingAt: new Date(), processingDecision: decision } });
  if (!claim.stats || claim.stats.updated !== 1) throw new Error('该举报已由其他管理员处理');
  let postDeleted = false;
  try {
    if (decision === 'delete') {
      const deletion = await deletePost({ postId: report.postId });
      if (!deletion.success) throw new Error(deletion.error || '删帖失败');
      postDeleted = true;
    }
    const adminResult = await db.collection('users').where({ _openid: openid }).limit(1).get();
    const admin = adminResult.data && adminResult.data[0] || {};
    const now = new Date();
    await db.runTransaction(async transaction => {
      const transactionalReport = transaction.collection('post_reports').doc(reportId);
      const latest = await readDoc(transactionalReport);
      if (!latest || latest.status !== 'processing' || latest.processingBy !== openid || latest.processingDecision !== decision) {
        throw new Error('举报状态已变化，请刷新列表');
      }
      await transactionalReport.update({ data: {
        status: decision === 'delete' ? 'handled' : 'dismissed',
        decision,
        handledBy: openid,
        handledAt: now
      } });
      await transaction.collection('messages').doc(messageId(reportId, latest.reporterOpenid, 'result')).set({ data: {
        fromUserId: openid,
        fromUserName: admin.nickName || '管理员',
        fromUserAvatar: admin.avatarUrl || '',
        toUserId: latest.reporterOpenid,
        type: decision === 'delete' ? 'post_report_handled' : 'post_report_dismissed',
        reportId,
        postTitle: latest.postSnapshot && latest.postSnapshot.title || '',
        reportReason: latest.reason,
        content: decision === 'delete' ? `${admin.nickName || '管理员'}处理了您的举报` : `${admin.nickName || '管理员'}没有通过您的举报`,
        isRead: false,
        createTime: now
      } });
    });
    return { success: true, status: decision === 'delete' ? 'handled' : 'dismissed' };
  } catch (error) {
    // 删帖失败可重新受理；删帖已成功而写回失败时保留 processing，避免重复操作。
    if (!postDeleted) {
      try { await ref.update({ data: { status: 'pending', processingDecision: '' } }); } catch (_) {}
    }
    throw error;
  }
}

module.exports = { REASONS, validateSubmission, submitPostReport, listPostReports, getPostReport, resolvePostReport };
