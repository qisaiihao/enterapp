<template>
  <view>
    <block v-if="displayUsers.length > 0">
      <view class="list">
        <view class="user-item" v-for="(item, index) in displayUsers" :key="item._openid || index">
          <view class="user-info" @tap="onUserTap(item, index)">
            <image
              class="avatar"
              :src="item.avatarUrl || defaultAvatar"
              mode="aspectFill"
              @error="onAvatarError(item, index)"
            ></image>
            <view class="info-text">
              <text class="name">{{ item.nickName || '微信用户' }}</text>
              <text class="bio">{{ item.bio || defaultBio }}</text>
            </view>
          </view>
          <button
            class="action-btn"
            :class="item._resolvedActionClass"
            size="mini"
            @tap.stop.prevent="onActionTap(item, index)"
            :loading="pendingOpenid === item._openid"
            :disabled="pendingOpenid === item._openid"
          >
            {{ item._resolvedActionText }}
          </button>
        </view>
      </view>
    </block>
    <view v-else class="empty">
      <text>{{ emptyText }}</text>
    </view>
  </view>
</template>

<script>
export default {
  props: {
    users: {
      type: Array,
      default: () => []
    },
    pendingOpenid: {
      type: String,
      default: ''
    },
    defaultAvatar: {
      type: String,
      default: '/images/avatar.png'
    },
    defaultBio: {
      type: String,
      default: '这个用户还没有留下简介~'
    },
    emptyText: {
      type: String,
      default: '暂无数据'
    },
    actionText: {
      type: String,
      default: '操作'
    },
    actionClass: {
      type: String,
      default: ''
    },
    actionTextFn: {
      type: Function,
      default: null
    },
    actionClassFn: {
      type: Function,
      default: null
    }
  },
  computed: {
    displayUsers() {
      const list = Array.isArray(this.users) ? this.users : [];
      return list.map((item) => {
        const source = item && typeof item === 'object' ? item : {};
        return Object.assign({}, source, {
          _resolvedActionText: this.resolveActionText(source),
          _resolvedActionClass: this.resolveActionClass(source)
        });
      });
    }
  },
  methods: {
    resolveActionText(item) {
      if (typeof this.actionTextFn === 'function') {
        return this.actionTextFn(item);
      }
      return this.actionText;
    },
    resolveActionClass(item) {
      if (typeof this.actionClassFn === 'function') {
        return this.actionClassFn(item);
      }
      return this.actionClass;
    },
    getSourceItem(index, fallback) {
      const sourceList = Array.isArray(this.users) ? this.users : [];
      return sourceList[index] || fallback;
    },
    onUserTap(item, index) {
      const sourceItem = this.getSourceItem(index, item);
      this.$emit('user-tap', {
        item: sourceItem,
        index,
        openid: sourceItem && sourceItem._openid
      });
    },
    onActionTap(item, index) {
      const sourceItem = this.getSourceItem(index, item);
      this.$emit('action-tap', {
        item: sourceItem,
        index,
        openid: sourceItem && sourceItem._openid
      });
    },
    onAvatarError(item, index) {
      const sourceItem = this.getSourceItem(index, item);
      this.$emit('avatar-error', {
        item: sourceItem,
        index,
        openid: sourceItem && sourceItem._openid
      });
    }
  }
};
</script>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
}

.user-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.user-info {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  margin-right: 20rpx;
  background-color: #f0f0f0;
}

.info-text {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  overflow: hidden;
}

.name {
  font-size: 30rpx;
  color: #333;
  font-weight: 600;
}

.bio {
  font-size: 26rpx;
  color: #999;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400rpx;
}

.action-btn {
  margin-left: 20rpx;
  border: none;
  border-radius: 8rpx;
  padding: 0 24rpx;
  height: 60rpx !important;
  line-height: 60rpx !important;
  font-size: 26rpx;
}

.action-btn::after {
  border: none;
}

.action-btn[disabled] {
  opacity: 0.6;
}

.follow-btn {
  background-color: #f5f5f5;
  color: #333;
}

.unfollow-btn {
  background-color: #d9d9d9;
  color: #fff;
}

.unblock-btn {
  background-color: #f5f5f5;
  color: #333;
}

.empty {
  margin-top: 200rpx;
  text-align: center;
  color: #999;
  font-size: 28rpx;
}
</style>
