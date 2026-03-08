function createDraftHandlers({ db }) {
  async function saveDraft(openid, draftData) {
    try {
      if (!draftData) {
        return {
          success: false,
          message: '草稿数据不能为空'
        };
      }

      const result = await db.collection('drafts').add({
        data: {
          _openid: openid,
          ...draftData,
          createTime: new Date(),
          updateTime: new Date()
        }
      });

      return {
        success: true,
        draftId: result._id,
        message: '草稿保存成功'
      };
    } catch (error) {
      console.error('保存草稿失败:', error);
      return {
        success: false,
        message: '保存草稿失败',
        error: error.message
      };
    }
  }

  async function getDrafts(openid) {
    try {
      const result = await db.collection('drafts')
        .where({
          _openid: openid
        })
        .orderBy('updateTime', 'desc')
        .get();

      return {
        success: true,
        drafts: result.data
      };
    } catch (error) {
      console.error('获取草稿列表失败:', error);
      return {
        success: false,
        message: '获取草稿列表失败',
        error: error.message
      };
    }
  }

  async function deleteDraft(openid, draftId) {
    try {
      if (!draftId) {
        return {
          success: false,
          message: '草稿ID不能为空'
        };
      }

      const result = await db.collection('drafts')
        .where({
          _openid: openid,
          _id: draftId
        })
        .remove();

      if (result.stats.removed === 0) {
        return {
          success: false,
          message: '草稿不存在或无权限删除'
        };
      }

      return {
        success: true,
        message: '草稿删除成功'
      };
    } catch (error) {
      console.error('删除草稿失败:', error);
      return {
        success: false,
        message: '删除草稿失败',
        error: error.message
      };
    }
  }

  return {
    saveDraft,
    getDrafts,
    deleteDraft
  };
}

module.exports = {
  createDraftHandlers
};
