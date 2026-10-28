const DRAFT_KEYS = ['publish_working_draft_v1', 'publish_draft', 'editing_draft', 'preview_post'];

export function createPublishDraftSessionId() {
    return `publish-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// 发布回调可能晚于原编辑页卸载；只清理这次编辑的快照，保留后来新建的草稿。
// 无会话标识的旧版草稿仍随发布完成清理。
export function clearPublishDraftStorage(sessionId = '', revision = Infinity) {
    for (const key of DRAFT_KEYS) {
        try {
            if (sessionId) {
                const draft = uni.getStorageSync(key);
                const data = draft && (draft.editData || draft);
                const storedSessionId = data && data.draftSessionId;
                if (storedSessionId && storedSessionId !== sessionId) continue;
                if (storedSessionId && Number(data.draftRevision || 0) > revision) continue;
            }
            uni.removeStorageSync(key);
        } catch (error) {
            console.error('清除发布草稿失败:', key, error);
        }
    }
}
