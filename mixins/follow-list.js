import { getFollowingList, getFollowerList } from '../api-cache/relation.js';

function createListState() {
    return { status: 'idle', page: 0, hasMore: true };
}

export default {
    data() {
        return {
            followings: [],
            followers: [],
            followListState: {
                following: createListState(),
                followers: createListState()
            },
            PAGE_SIZE: 20
        };
    },
    computed: {
        currentListState() {
            return this.followListState[this.currentTab];
        }
    },
    onLoad() {
        this.loadFollowList(true);
    },
    async onPullDownRefresh() {
        try {
            await this.loadFollowList(true);
        } finally {
            uni.stopPullDownRefresh();
        }
    },
    onReachBottom() {
        if (this.currentListState.hasMore) {
            this.loadFollowList();
        }
    },
    methods: {
        switchTab(tab) {
            if (this.currentTab === tab) {
                return;
            }
            this.currentTab = tab;
            this.loadFollowList(true);
        },
        retryFollowList() {
            this.loadFollowList(true);
        },
        async loadFollowList(reset = false, tab = this.currentTab) {
            const state = this.followListState[tab];
            if (state.status === 'loading') {
                return;
            }

            const isFollowingTab = tab === 'following';
            const listKey = isFollowingTab ? 'followings' : 'followers';
            const fetchList = isFollowingTab ? getFollowingList : getFollowerList;
            const page = reset ? 0 : state.page;
            state.status = 'loading';
            try {
                if (reset && !isFollowingTab) {
                    this.markFollowNotificationsRead?.();
                }
                const result = await fetchList({ page, pageSize: this.PAGE_SIZE, context: this });
                this[listKey] = reset ? result.list : this[listKey].concat(result.list);
                state.page = page + 1;
                state.hasMore = result.hasMore;
                state.status = 'loaded';
            } catch (err) {
                state.status = 'error';
                console.error(isFollowingTab ? '获取关注列表失败:' : '获取粉丝列表失败:', err);
                if (tab === this.currentTab) {
                    uni.showToast({ title: err.message || '加载失败', icon: 'none' });
                }
            }
        }
    }
};
