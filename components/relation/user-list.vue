<template>
  <view>
    <block v-if="displayUsers.length > 0">
      <view class="list">
        <view class="user-item" v-for="(item, index) in displayUsers" :key="item._renderKey">
          <view class="user-info" @tap="onUserTap(index)">
            <image
              class="avatar"
              :src="resolveItemAvatar(item)"
              mode="aspectFill"
              @error="onAvatarError(index)"
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
            @tap.stop.prevent="onActionTap(index)"
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
import { resolveUserAvatar } from '@/utils/defaultAvatar.js';

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
    }
  },
  computed: {
    displayUsers() {
      const list = Array.isArray(this.users) ? this.users : [];
      return list.map((item, index) => {
        const source = item && typeof item === 'object' ? item : {};
        return Object.assign({}, source, {
          _renderKey: source._openid || `user-${index}`,
          _resolvedActionText: this.resolveActionText(source),
          _resolvedActionClass: this.resolveActionClass(source)
        });
      });
    }
  },
  methods: {
    resolveItemAvatar(item) {
      const avatarUrl = item && item.avatarUrl ? item.avatarUrl : this.defaultAvatar;
      return resolveUserAvatar(avatarUrl, item && (item._openid || item.userId || item.poemId || item.nickName));
    },
    resolveActionText(item) {
      if (item && Object.prototype.hasOwnProperty.call(item, '_resolvedActionText')) {
        return item._resolvedActionText;
      }
      if (item && Object.prototype.hasOwnProperty.call(item, 'actionText')) {
        return item.actionText;
      }
      return this.actionText;
    },
    resolveActionClass(item) {
      if (item && Object.prototype.hasOwnProperty.call(item, '_resolvedActionClass')) {
        return item._resolvedActionClass;
      }
      if (item && Object.prototype.hasOwnProperty.call(item, 'actionClass')) {
        return item.actionClass;
      }
      return this.actionClass;
    },
    getSourceItem(index) {
      const sourceList = Array.isArray(this.users) ? this.users : [];
      return sourceList[index] || null;
    },
    onUserTap(index) {
      const sourceItem = this.getSourceItem(index);
      this.$emit('user-tap', {
        item: sourceItem,
        index,
        openid: sourceItem && sourceItem._openid
      });
    },
    onActionTap(index) {
      const sourceItem = this.getSourceItem(index);
      this.$emit('action-tap', {
        item: sourceItem,
        index,
        openid: sourceItem && sourceItem._openid
      });
    },
    onAvatarError(index) {
      const sourceItem = this.getSourceItem(index);
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
