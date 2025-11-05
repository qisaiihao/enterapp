<template>
    <view class="page-wrapper">
        <!-- index.wxml -->
        <view class="container">

            <!-- ҳ���л��� -->
        <page-tabs ref="pageTabs" :current-tab="currentTab" @tab-change="onTabChange"></page-tabs>

            <!-- �Ǽ������� isLoading Ϊ true ʱ��ʾ -->
            <view v-if="isLoading">
                <skeleton pageType="index" />
            </view>

            <!-- ��ʵ���ݣ��� isLoading Ϊ false ʱ��ʾ -->
            <view v-else class="square-mode-container">
                <!-- ʹ��swiperʵ�ֻ����л� -->
                <swiper 
                    class="page-swiper" 
                    :current="swiperCurrent" 
                    @change="onSwiperChange"
                    @touchstart="onSwiperTouchStart"
                    @touchend="onSwiperTouchEnd"
                    :duration="300"
                    :disable-touch="false"
                    :circular="false"
                    :indicator-dots="false"
                    :autoplay="false"
                    :skip-hidden-item-layout="true"
                    :easing-function="easeOutCubic"
                >
                    <!-- �㳡ҳ -->
                    <swiper-item>
                        <scroll-view 
                            scroll-y="true" 
                            class="swiper-page" 
                            @scroll="handleScroll"
                            refresher-enabled="true"
                            :refresher-triggered="isRefreshing"
                            :refresher-threshold="90"
                            refresher-background="#ffffff"
                            refresher-default-style="black"
                            refresher-background-style="#ffffff"
                            @refresherrefresh="onRefresherRefresh"
                        >
                            <view v-if="postList.length === 0 && !isLoading" class="empty-state">
                                <view class="empty-icon">??</view>
                                <view class="empty-text">��û������Ŷ��</view>
                                <view class="empty-subtext">����������һ�����Ӱɣ�</view>
                            </view>
                            <!-- ����������б�ѭ���ĸ���������һ��ID -->
                            <view id="post-list-container">
                                <!-- ��ҳ�����б� -->
                                <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in postList" :key="index">
                            <!-- ������Ϣ -->

                            <view class="author-info-outside">
                                <image
                                    class="author-avatar"
                                    :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                                    mode="aspectFill"
                                    @error="onAvatarError"
                                    @load="onAvatarLoad"
                                    :data-postindex="index"
                                    @tap.stop.prevent="navigateToUserProfile"
                                    :data-user-id="item._openid"
                                    :data-author-name="item.authorName"
                                    :data-is-anonymous="item.isAnonymous"
                                ></image>
                                <text class="author-name">{{ item.isAnonymous ? '�����û�' : item.authorName }}</text>
                            </view>

                            <!-- �ɵ������������ - ��ת������ҳ -->

                            <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                <view class="post-item">
                                    <view class="post-title">{{ item.title }}</view>

                                    <!-- ͼƬ��ʾ�߼� (���Ż���ʹ�� imageStyle ռλ) -->
                                    <view
                                        v-if="item.imageUrls && item.imageUrls.length > 0"
                                        class="image-container-wrapper"
                                        :style="item.imageStyle"
                                        @tap.stop.prevent="handlePreview"
                                        :data-src="item.imageUrls[0]"
                                        :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                    >
                                        <!-- ����ͼƬ -->
                                        <block v-if="item.imageUrls.length === 1">
                                            <image
                                                class="post-image"
                                                :src="item.imageUrls[0]"
                                                mode="aspectFill"
                                                :lazy-load="true"
                                                @error="onImageError"
                                                @tap.stop.prevent="handlePreview"
                                                :data-src="item.imageUrls[0]"
                                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                            />
                                        </block>

                                        <!-- ����ͼƬ -->
                                        <block v-else-if="item.imageUrls.length > 1">
                                            <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                                <block v-for="(img, index1) in item.imageUrls" :key="index1">
                                                    <swiper-item>
                                                        <image
                                                            class="post-image"
                                                            :src="img"
                                                            mode="aspectFill"
                                                            :lazy-load="true"
                                                            @error="onImageError"
                                                            @tap.stop.prevent="handlePreview"
                                                            :data-src="img"
                                                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                        />
                                                    </swiper-item>
                                                </block>
                                            </swiper>
                                        </block>
                                    </view>

                                    <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>

                                    <!-- ��ǩ��ʾ -->
                                    <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                        <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                    </view>
                                </view>
                            </navigator>

                            <!-- �����Ļ������� - ����������ҳ��ת -->

                            <view class="vote-section">
                                <view class="actions-left">
                                    <!-- ������գ����ֲ���ƽ�� -->
                                </view>
                                <view class="button-group">
                                    <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                        <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
                                        <text class="action-text">{{ item.commentCount || 0 }}</text>
                                    </view>
                                    <view
                                        class="like-icon-container"
                                        @tap.stop.prevent="onVote"
                                        :data-postid="item._id"
                                        :data-index="index"
                                        data-list-type="home"
                                    >
                                        <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                    </view>
                                    <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                        <text class="action-text">{{ item.votes || 0 }}</text>
                                    </view>
                                </view>
                            </view>
                        </view>
                            </view>
                            <!-- ��ҳ������ʾ -->
                            <view v-if="currentPage === 'home' && !hasMore && postList.length > 0" class="end-tip">
                                <text class="end-text">--- �����е��ߵ� ---</text>
                            </view>
                        </scroll-view>
                    </swiper-item>

                    <!-- ��עҳ -->
                    <swiper-item>
                        <scroll-view 
                            scroll-y="true" 
                            class="swiper-page" 
                            @scroll="handleScroll"
                            refresher-enabled="true"
                            :refresher-triggered="isRefreshing"
                            :refresher-threshold="90"
                            refresher-background="#ffffff"
                            refresher-default-style="black"
                            refresher-background-style="#ffffff"
                            @refresherrefresh="onRefresherRefresh"
                        >
                            <!-- ��עҳ�Ǽ������� followingIsLoading Ϊ true ʱ��ʾ -->
                            <view v-if="followingIsLoading">
                                <skeleton pageType="index" />
                            </view>
                            
                            <!-- ��ʵ���ݣ��� followingIsLoading Ϊ false ʱ��ʾ -->
                            <view v-else>
                            <view id="following-list-container">
                            <view v-if="followingPostList.length === 0" class="empty-state">
                                <view class="empty-icon">??</view>
                                <view class="empty-text">��ע���˻�û�з���</view>
                                <view class="empty-subtext">ȥ��ע������Ȥ���˰ɣ�</view>
                            </view>
                            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in followingPostList" :key="index">
                                <!-- ������Ϣ -->
                                <view class="author-info-outside">
                                    <image
                                        class="author-avatar"
                                        :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                                        mode="aspectFill"
                                        @error="onAvatarError"
                                        @load="onAvatarLoad"
                                        :data-postindex="index"
                                        @tap.stop.prevent="navigateToUserProfile"
                                        :data-user-id="item._openid"
                                        :data-author-name="item.authorName"
                                        :data-is-anonymous="item.isAnonymous"
                                    ></image>
                                    <text class="author-name">{{ item.isAnonymous ? '�����û�' : item.authorName }}</text>
                                </view>

                                <!-- �ɵ������������ - ��ת������ҳ -->
                                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                    <view class="post-item">
                                        <view class="post-title">{{ item.title }}</view>

                                        <!-- ͼƬ��ʾ�߼� -->
                                        <view
                                            v-if="item.imageUrls && item.imageUrls.length > 0"
                                            class="image-container-wrapper"
                                            :style="item.imageStyle"
                                            @tap.stop.prevent="handlePreview"
                                            :data-src="item.imageUrls[0]"
                                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                        >
                                            <!-- ����ͼƬ -->
                                            <block v-if="item.imageUrls.length === 1">
                                                <image
                                                    class="post-image"
                                                    :src="item.imageUrls[0]"
                                                    mode="aspectFill"
                                                    :lazy-load="true"
                                                    @error="onImageError"
                                                    @tap.stop.prevent="handlePreview"
                                                    :data-src="item.imageUrls[0]"
                                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                />
                                            </block>

                                            <!-- ����ͼƬ -->
                                            <block v-else-if="item.imageUrls.length > 1">
                                                <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                                    <block v-for="(img, imgIndex) in item.imageUrls" :key="imgIndex">
                                                        <swiper-item>
                                                            <image
                                                                class="post-image"
                                                                :src="img"
                                                                mode="aspectFill"
                                                                :lazy-load="true"
                                                                @error="onImageError"
                                                                @tap.stop.prevent="handlePreview"
                                                                :data-src="img"
                                                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                            />
                                                        </swiper-item>
                                                    </block>
                                                </swiper>
                                            </block>
                                        </view>

                                        <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>

                                        <!-- ��ǩ��ʾ -->
                                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                        </view>
                                    </view>
                                </navigator>

                                <!-- �����Ļ������� -->
                                <view class="vote-section">
                                    <view class="actions-left">
                                        <!-- ������գ����ֲ���ƽ�� -->
                                    </view>
                                    <view class="button-group">
                                        <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                            <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
                                            <text class="action-text">{{ item.commentCount || 0 }}</text>
                                        </view>
                                        <view
                                            class="like-icon-container"
                                            @tap.stop.prevent="onVote"
                                            :data-postid="item._id"
                                            :data-index="index"
                                            data-list-type="following"
                                        >
                                            <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                        </view>
                                        <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                            <text class="action-text">{{ item.votes || 0 }}</text>
                                        </view>
                                    </view>
                                </view>
                            </view>
                            </view>
                            </view>
                            <!-- ��עҳ������ʾ -->
                            <view v-if="currentPage === 'following' && !followingHasMore && followingPostList.length > 0" class="end-tip">
                                <text class="end-text">--- û�и����� ---</text>
                            </view>
                        </scroll-view>
                    </swiper-item>

                    <!-- ����ҳ -->
                    <swiper-item>
                        <scroll-view 
                            scroll-y="true" 
                            class="swiper-page" 
                            @scroll="handleScroll"
                            refresher-enabled="true"
                            :refresher-triggered="isRefreshing"
                            :refresher-threshold="90"
                            refresher-background="#ffffff"
                            refresher-default-style="black"
                            refresher-background-style="#ffffff"
                            @refresherrefresh="onRefresherRefresh"
                        >
                            <!-- ����ҳ�Ǽ������� discussionIsLoading Ϊ true ʱ��ʾ -->
                            <view v-if="discussionIsLoading">
                                <skeleton pageType="index" />
                            </view>
                            
                            <!-- ��ʵ���ݣ��� discussionIsLoading Ϊ false ʱ��ʾ -->
                            <view v-else>
                            <view id="discussion-list-container">
                            <view v-if="discussionPostList.length === 0" class="empty-state">
                                <view class="empty-icon">??</view>
                                <view class="empty-text">��������������</view>
                                <view class="empty-subtext">���������һ������ɣ�</view>
                            </view>
                            <view :class="'post-item-wrapper ' + (item.isOriginal ? 'original-post' : '')" v-for="(item, index) in discussionPostList" :key="index">
                                <!-- ������Ϣ -->
                                <view class="author-info-outside">
                                    <image
                                        class="author-avatar"
                                        :src="item.isAnonymous ? '/static/images/avatar.png' : (item.authorAvatar || '/static/images/avatar.png')"
                                        mode="aspectFill"
                                        @error="onAvatarError"
                                        @load="onAvatarLoad"
                                        :data-postindex="index"
                                        @tap.stop.prevent="navigateToUserProfile"
                                        :data-user-id="item._openid"
                                        :data-author-name="item.authorName"
                                        :data-is-anonymous="item.isAnonymous"
                                    ></image>
                                    <text class="author-name">{{ item.isAnonymous ? '�����û�' : item.authorName }}</text>
                                </view>

                                <!-- �ɵ������������ - ��ת������ҳ -->
                                <navigator class="post-content-navigator" :url="'/pages/post-detail/post-detail?id=' + item._id" hover-class="navigator-hover">
                                    <view class="post-item">
                                        <view class="post-title">{{ item.title }}</view>

                                        <!-- ͼƬ��ʾ�߼� -->
                                        <view
                                            v-if="item.imageUrls && item.imageUrls.length > 0"
                                            class="image-container-wrapper"
                                            :style="item.imageStyle"
                                            @tap.stop.prevent="handlePreview"
                                            :data-src="item.imageUrls[0]"
                                            :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                        >
                                            <!-- ����ͼƬ -->
                                            <block v-if="item.imageUrls.length === 1">
                                                <image
                                                    class="post-image"
                                                    :src="item.imageUrls[0]"
                                                    mode="aspectFill"
                                                    :lazy-load="true"
                                                    @error="onImageError"
                                                    @tap.stop.prevent="handlePreview"
                                                    :data-src="item.imageUrls[0]"
                                                    :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                />
                                            </block>

                                            <!-- ����ͼƬ -->
                                            <block v-else-if="item.imageUrls.length > 1">
                                                <swiper class="image-swiper" :indicator-dots="true" :circular="true">
                                                    <block v-for="(img, imgIndex) in item.imageUrls" :key="imgIndex">
                                                        <swiper-item>
                                                            <image
                                                                class="post-image"
                                                                :src="img"
                                                                mode="aspectFill"
                                                                :lazy-load="true"
                                                                @error="onImageError"
                                                                @tap.stop.prevent="handlePreview"
                                                                :data-src="img"
                                                                :data-original-image-urls="item.originalImageUrls || item.imageUrls"
                                                            />
                                                        </swiper-item>
                                                    </block>
                                                </swiper>
                                            </block>
                                        </view>

                                        <view class="post-content" v-if="item.content" style="white-space: pre-wrap">{{ item.content }}</view>

                                        <!-- ��ǩ��ʾ -->
                                        <view v-if="item.tags && item.tags.length > 0" class="post-tags">
                                            <text class="post-tag" @tap.stop.prevent="onTagClick" :data-tag="item" v-for="(item, index1) in item.tags" :key="index1">#{{ item }}</text>
                                        </view>
                                    </view>
                                </navigator>

                                <!-- �����Ļ������� -->
                                <view class="vote-section">
                                    <view class="actions-left">
                                        <!-- ������գ����ֲ���ƽ�� -->
                                    </view>
                                    <view class="button-group">
                                        <view class="comment-count" @tap.stop.prevent="onCommentClick" :data-postid="item._id">
                                            <image class="comment-icon" src="/static/images/comment.png" mode="aspectFit" />
                                            <text class="action-text">{{ item.commentCount || 0 }}</text>
                                        </view>
                                        <view
                                            class="like-icon-container"
                                            @tap.stop.prevent="onVote"
                                            :data-postid="item._id"
                                            :data-index="index"
                                            data-list-type="discussion"
                                        >
                                            <image class="like-icon" :src="item.likeIcon || '/static/images/seed.png'" mode="aspectFit" @error="onLikeIconError"></image>
                                        </view>
                                        <view :class="'vote-count ' + (item.isVoted ? 'voted' : '')">
                                            <text class="action-text">{{ item.votes || 0 }}</text>
                                        </view>
                                    </view>
                                </view>
                            </view>
                            </view>
                            </view>
                            <!-- ����ҳ������ʾ -->
                            <view v-if="currentPage === 'discussion' && !discussionHasMore && discussionPostList.length > 0" class="end-tip">
                                <text class="end-text">--- û�и��������� ---</text>
                            </view>
                        </scroll-view>
                    </swiper-item>
                </swiper>
            </view>

            <app-tab-bar ref="customTabBar" />

        </view>

    </view>
</template>

<script>
import skeleton from '@/components/skeleton/skeleton';
import pageTabs from '@/components/page-tabs/page-tabs';
// #ifndef MP-WEIXIN
import AppTabBar from '@/custom-tab-bar/index.vue';
// #endif
// index.js
// �޸����Ƴ�ȫ�����ݿ�ʵ������Ϊ�ڷ����ж�̬��ȡ
  const PAGE_SIZE = 10;
  const DISCOVER_PAGE_SIZE = 5;
  const MAX_DISCOVER_EXCLUDE_IDS = 200;

// ǰ��Ƶ����������
const FRONTEND_RATE_LIMITS = {
  perMinute: 20,    // ÿ����20�Σ�����һ�£�
  minInterval: 3000 // ��С������3�룬���������������
};

// ǰ������ʱ���¼
let requestTimes = [];
let lastRequestTime = 0;

// ǰ��Ƶ�����Ƽ�麯��
function checkFrontendRateLimit() {
  const now = Date.now();

  // ��������1���ӵļ�¼
  requestTimes = requestTimes.filter(time => now - time < 60000);

  // �����Ӽ�����
  if (requestTimes.length >= FRONTEND_RATE_LIMITS.perMinute) {
    const waitTime = Math.ceil((requestTimes[0] + 60000 - now) / 1000);
    uni.showToast({
      title: `�������Ƶ������${waitTime}�������`,
      icon: 'none'
    });
    return false;
  }

  // �����С������
  if (now - lastRequestTime < FRONTEND_RATE_LIMITS.minInterval) {
    const waitTime = Math.ceil((FRONTEND_RATE_LIMITS.minInterval - (now - lastRequestTime)) / 1000);
    console.log(`?? [ǰ������] ���������̣���ȴ�${waitTime}��`);
    return false;
  }

  // ��¼��������ʱ��
  requestTimes.push(now);
  lastRequestTime = now;

  console.log(`? [ǰ������] Ƶ�ʼ��ͨ������ǰ�����������: ${requestTimes.length}`);
  return true;
}

const imageOptimizer = require('../../utils/imageOptimizer');
const likeIcon = require('../../utils/likeIcon');
const { togglePostLike } = require('../../utils/likeService.js');
const avatarCache = require('../../utils/avatarCache');
const followCache = require('../../utils/followCache');
import { getUnreadCount } from '@/api-cache/unread.js';
import { getDiscoverFeed, invalidateDiscover } from '@/api-cache/discover.js';
import { getHomePosts, invalidateHomePosts } from '@/api-cache/home-posts.js';
import { hydrateTempUrls, warmTempUrlsFromPosts } from '@/_utils/hydrate-temp-urls';
const { previewImage } = require('../../utils/imagePreview.js');
const { normalizePostList } = require('../../utils/postNormalizer.js');
const { cloudCall } = require('../../utils/cloudCall.js');
const postGalleryMixin = require('../../mixins/postGallery.js');
export default {
    components: {
        skeleton,
        pageTabs,
        // #ifndef MP-WEIXIN
        AppTabBar
        // #endif
    },
    mixins: [postGalleryMixin],
    data() {
        return {
            postList: [],
            votingInProgress: {},
            page: 0,
            hasMore: true,
            isLoading: false,
            openid: '', // ���� openid �ֶ�
            isRefreshing: false, // ����ˢ��״̬

            // �ָ����ϰ汾�ĳ�ʼֵ
            isLoadingMore: false,

            // ������ר�����ڿ��Ƶײ�"������"UI��״̬
            swiperHeights: {},

            imageClampHeights: {},

            // ��������ͼ�ݸ�ͼǯ�Ƹ߶�
            displayMode: 'square',

            // ��ҳֻ����㳡ģʽ
            imageCache: {},

            // ͼƬ����
            visiblePosts: new Set(),

            // �ɼ�������ID����
  
            // --- ҳ���л���� ---
            currentTab: 'square', // 'square', 'discover', 'discussion'
            currentPage: 'home',

            // 'home' �� 'discover'

            // swiper��ǰҳ������ (0: �㳡, 1: ��ע, 2: ����)
            swiperCurrent: 0,

            // ����ҳ������ݣ�����������ʾ��ڣ�
            discoverPostList: [],
            discoverPage: 0,
            discoverHasMore: true,
            discoverShownPostIds: [],
            discoverRefreshTime: 0,
            discoverIsLoading: false,
            discoverIsLoadingMore: false,

            // ����ҳ�������
            discussionPostList: [],
            discussionPage: 0,
            discussionHasMore: true,
            discussionIsLoading: false,
            discussionIsLoadingMore: false,

            // ��עҳ�������
            followingPostList: [],
            followingPage: 0,
            followingHasMore: true,
            followingIsLoading: false,
            followingIsLoadingMore: false,

            selected: 0,
            img: '',
            // ��ȫ����߶�
            safeAreaTop: 0,
            // swiper�л�������ʱ��
            swiperChangeTimer: null,
            // swiper����״̬
            swiperTouchStartX: null,
            swiperTouchStartTime: null,
            // swiper��������
            easeOutCubic: 'cubic-bezier(0.33, 1, 0.68, 1)'
        };
    },
    onLoad: function (options) {
        // ���ԣ���鰲ȫ����߶�
        this.debugSafeArea();
        
        // ��ҳֻ����㳡ģʽ
        this.setData({
            displayMode: 'square'
        });
        this.pageLoadStartTime = Date.now();

        // ��ʼ�� openid
        this.initOpenid();

        // �ȴ���¼��ɣ�openid ��������������ȡ��������
        this.waitForLoginThenInit();

        // ����ȫ�ֵ��ޱ����������ҳ�Ļ���ͬ��
        try { uni.$on && uni.$on('like-changed', this.syncLikeStatusFromCache); } catch (_) {}
        // �����������������ȷ���¶�Ӧ��Ƭ�����ۼ���
        try { uni.$on && uni.$on('comment-count-changed', (e) => { try { this.updatePostCommentCount(e.postId, e.commentCount); } catch (_) {} }); } catch (_) {}
    },
    onShow: function () {
        // #ifndef MP-WEIXIN
        try { uni.hideTabBar({ animation: false }); } catch (e) {}
        try { this.$refs.customTabBar && this.$refs.customTabBar.syncSelected && this.$refs.customTabBar.syncSelected(); } catch (e) {}
        // #endif
        // TabBar ״̬���£�ʹ�ü����Դ���
        const { updateTabBarStatus } = require('../../utils/tabBarCompatibility.js');
        updateTabBarStatus(this, 0);

        // ����Ƿ���Ҫˢ�£��������Ӻ�
        try {
            const shouldRefresh = uni.getStorageSync('shouldRefreshIndex');
            if (shouldRefresh) {
                console.log('��index����⵽������ǣ�ˢ������');
                uni.removeStorageSync('shouldRefreshIndex');
                this.refreshIndexData();
            }
        } catch (e) {
            console.error('���ˢ�±��ʧ��:', e);
        }

        // ͬ������״̬���ӻ����л�ȡ���µĵ���״̬
        this.syncLikeStatusFromCache();

            },
    onUnload: function () {
        try { uni.$off && this.syncLikeStatusFromCache && uni.$off('like-changed', this.syncLikeStatusFromCache); } catch (_) {}
        try { uni.$off && uni.$off('comment-count-changed'); } catch (_) {}
        // ����swiper�л�������ʱ��
        if (this.swiperChangeTimer) {
            clearTimeout(this.swiperChangeTimer);
            this.swiperChangeTimer = null;
        }
    },
    // �Ƴ������ onReachBottom�������� onPageScroll ��ͻ
    /*
onReachBottom: function () {
  console.log('����ҳ��onReachBottom����������Ҫ�����߼���onPageScroll');
  if (!this.data.hasMore || this.data.isLoading) {
    return;
  }
  this.getPostList();
},
*/

    methods: {
        // ����scroll-view������ˢ���¼�
        onRefresherRefresh: function() {
            this.isRefreshing = true;

            if (this.currentPage === 'home') {
                // ��ҳˢ�� - ������沢ǿ�Ƶ����ƺ���
                // �����ҳ����
                try {
                    const { invalidateHomePosts } = require('../../api-cache/home-posts.js');
                    invalidateHomePosts({});
                } catch (e) {
                    console.error('? [��ҳ] �����ҳ����ʧ��:', e);
                }
                // ������б������������ֱ����ȡ������һ�����滻
                this.reloadHomePostsForRefresh(() => {
                    // ʹ�� setTimeout ȷ�������ݸ��º���ֹͣˢ�£���ҳ������ȷ��λ
                    setTimeout(() => {
                        this.isRefreshing = false;
                    }, 100);
                });
            } else if (this.currentPage === 'discover') {
                // ����ҳˢ�� - ���»�ȡ�Ƽ�
                this.refreshDiscoverPosts();
                // ʹ�� setTimeout ȷ�������ݸ��º���ֹͣˢ��
                setTimeout(() => {
                    this.isRefreshing = false;
                }, 100);
            } else if (this.currentPage === 'following') {
                // ��עҳˢ��
                this.refreshFollowingPosts(() => {
                    // ʹ�� setTimeout ȷ�������ݸ��º���ֹͣˢ��
                    setTimeout(() => {
                        this.isRefreshing = false;
                    }, 100);
                });
            } else if (this.currentPage === 'discussion') {
                // ����ҳˢ��
                this.refreshDiscussionPosts(() => {
                    // ʹ�� setTimeout ȷ�������ݸ��º���ֹͣˢ��
                    setTimeout(() => {
                        this.isRefreshing = false;
                    }, 100);
                });
            }
        },

        // ͨ������ˢ��������ҳ�������ݣ��������б�ֱ�������ݾ���
        reloadHomePostsForRefresh: function (cb) {
            const startPage = 0;
            getHomePosts({ page: startPage, pageSize: PAGE_SIZE, context: this, forceRefresh: true })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    let posts = normalizePostList(postsRaw).map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);
                    this.setData({
                        postList: posts,
                        page: 1,
                        hasMore: posts.length === PAGE_SIZE
                    });
                    try {
                        this.preloadUserData && this.preloadUserData(posts);
                    } catch (_) {}
                })
                .catch((err) => {
                    console.error('����ҳ��reloadHomePostsForRefresh ʧ��:', err);
                    uni.showToast({ title: 'ˢ��ʧ��', icon: 'none' });
                })
                .finally(() => {
                    if (typeof cb === 'function') cb();
                });
        },

        // ���������¼����� onPageScroll Ǩ�ƹ�����
        handleScroll: function (e) {
            if (this.scrollTimer) {
                clearTimeout(this.scrollTimer);
            }
            // ���ӷ���ʱ�䵽300ms������Ƶ������
            this.scrollTimer = setTimeout(() => {
                const isHome = this.currentPage === 'home';
                const isDiscover = this.currentPage === 'discover';
                const isFollowing = this.currentPage === 'following';
                const isDiscussion = this.currentPage === 'discussion';
                if (!isHome && !isDiscover && !isFollowing && !isDiscussion) {
                    return;
                }

                let hasMore, loadingFlag;
                if (isHome) {
                    hasMore = this.hasMore;
                    loadingFlag = this.isLoading || this.isLoadingMore;
                } else if (isDiscover) {
                    hasMore = this.discoverHasMore;
                    loadingFlag = this.discoverIsLoading || this.discoverIsLoadingMore;
                } else if (isFollowing) {
                    hasMore = this.followingHasMore;
                    loadingFlag = this.followingIsLoading || this.followingIsLoadingMore;
                } else if (isDiscussion) {
                    hasMore = this.discussionHasMore;
                    loadingFlag = this.discussionIsLoading || this.discussionIsLoadingMore;
                }

                if (!hasMore || loadingFlag) {
                    return;
                }
                
                try {
                    const info = uni.getSystemInfoSync();
                    const winH = info.windowHeight;
                    
                    let containerId = '';
                    if (isHome) {
                        containerId = '#post-list-container';
                    } else if (isFollowing) {
                        containerId = '#following-list-container';
                    } else if (isDiscussion) {
                        containerId = '#discussion-list-container';
                    }
                    
                    if (!containerId) {
                        return;
                    }
                    
                    uni.createSelectorQuery()
                        .in(this)
                        .select(containerId)
                        .boundingClientRect((rect) => {
                            if (!rect || !rect.height) {
                                return;
                            }
                            
                            const rectBottom = rect.top + rect.height;
                            let distanceToBottom = rectBottom - winH;
                            
                            if (distanceToBottom < 0) {
                                distanceToBottom = 0;
                            }
                            
                            const preloadThreshold = winH * 2;

                            if (distanceToBottom < preloadThreshold) {
                                if (isHome) {
                                    this.getPostList();
                                } else if (isFollowing) {
                                    this.loadFollowingPosts();
                                } else if (isDiscussion) {
                                    this.loadDiscussionPosts();
                                }
                            }
                        })
                        .exec();
                } catch (err) {
                    console.error('����ҳ���������ʧ��:', err);
                }
            }, 300); // ���ӷ���ʱ�䵽300ms
        },

        // ��������ͷ�����¼��ĺ���
        handleAnonymousAvatarClick(e) {
            if (e && e.preventDefault) {
                e.preventDefault();
            }
            if (e && e.stopPropagation) {
                e.stopPropagation();
            }
            // ��ʾ��ʾ��Ϣ
            uni.showToast({
                title: '�����û��޷��鿴��ҳ',
                icon: 'none'
            });
        },

        // ���԰�ȫ����
        debugSafeArea() {
            try {
                // ��ȡϵͳ��Ϣ
                const systemInfo = uni.getSystemInfoSync();

                // ��̬���ð�ȫ���� - ʹ��uni-app���ݷ�ʽ
                if (systemInfo.statusBarHeight) {
                    const safeAreaTop = systemInfo.statusBarHeight;

                    // ��uni-app�У����ǿ���ͨ������ҳ����������̬������ʽ
                    this.setData({
                        safeAreaTop: safeAreaTop
                    });

                    // ��������CSS����������֧�ֵĻ����У�
                    try {
                        if (typeof document !== 'undefined' && document.documentElement) {
                            document.documentElement.style.setProperty('--safe-area-inset-top', safeAreaTop + 'px');
                        }
                    } catch (cssError) {
                        // CSS��������ʧ�ܣ�ʹ�����ݰ󶨷�ʽ
                    }
                }
            } catch (error) {
                console.error('��index����ȫ�������ʧ��:', error);
            }
        },

        // swiper������ʼ�¼�
        onSwiperTouchStart(e) {
            this.swiperTouchStartX = e.touches[0].clientX;
            this.swiperTouchStartTime = Date.now();
        },

        // swiper���������¼�
        onSwiperTouchEnd(e) {
            if (!this.swiperTouchStartX) return;
            
            const touchEndX = e.changedTouches[0].clientX;
            const deltaX = touchEndX - this.swiperTouchStartX;
            const deltaTime = Date.now() - this.swiperTouchStartTime;
            
            // ���ô���״̬
            this.swiperTouchStartX = null;
            this.swiperTouchStartTime = null;
            
            // �����������̫С��ʱ��̫�̣�������
            if (Math.abs(deltaX) < 30 || deltaTime < 50) {
                return;
            }
            
            // ���߽�����
            const currentIndex = this.swiperCurrent;
            const isLeftSwipe = deltaX < 0; // ���󻬶�
            const isRightSwipe = deltaX > 0; // ���һ���
            
            // �߽��� - ���ϸ������
            if (isLeftSwipe && currentIndex >= 2) {
                // �Ѿ������ұߣ���ֹ�������󻬶�
                // ǿ�ƻص���ǰҳ��
                this.setData({
                    swiperCurrent: 2
                });
                return;
            }

            if (isRightSwipe && currentIndex <= 0) {
                // �Ѿ�������ߣ���ֹ�������һ���
                // ǿ�ƻص���ǰҳ��
                this.setData({
                    swiperCurrent: 0
                });
                return;
            }
        },

        // swiper�л�����
        onSwiperChange(e) {
            const current = e.detail.current;
            
            // ����������������ٻ���ʱ��״̬��һ��
            if (this.swiperChangeTimer) {
                clearTimeout(this.swiperChangeTimer);
            }
            
            this.swiperChangeTimer = setTimeout(() => {
                this.setData({
                    swiperCurrent: current
                });

                // ����swiper����ӳ�䵽ҳ�����ͺͱ�ǩ
                let pageType, tabValue;
                switch(current) {
                    case 0:
                        pageType = 'home';
                        tabValue = 'square';
                        break;
                    case 1:
                        pageType = 'following';
                        tabValue = 'following';
                        break;
                    case 2:
                        pageType = 'discussion';
                        tabValue = 'discussion';
                        break;
                }

                this.setData({
                    currentPage: pageType,
                    currentTab: tabValue
                });

                // ���ҳ�滹û�����ݣ���������
                if (pageType === 'following' && this.followingPostList.length === 0) {
                    this.loadFollowingPosts();
                } else if (pageType === 'discussion' && this.discussionPostList.length === 0) {
                    this.loadDiscussionPosts();
                }
                
                // �л�����עҳʱ������ͬ������״̬���ο��㳡ҳʵ�֣�
                if (pageType === 'following') {
                    try {
                        this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                    } catch (e) {
                        console.warn('ͬ����עҳ����״̬ʧ��:', e);
                    }
                }
            }, 10); // 10ms�����ӳ�
        },

        // ��ǩ�л�����
        onTabChange(tabValue) {
            
            // ���ݱ�ǩֵӳ�䵽swiper����
            let swiperIndex;
            switch(tabValue) {
                case 'square':
                    swiperIndex = 0;
                    break;
                case 'following':
                    swiperIndex = 1;
                    break;
                case 'discussion':
                    swiperIndex = 2;
                    break;
            }

            this.setData({
                currentTab: tabValue,
                swiperCurrent: swiperIndex
            });

            // ���ݱ�ǩҳӳ�䵽�ڲ�ҳ��
            switch(tabValue) {
                case 'square':
                    this.setData({
                        currentPage: 'home'
                    });
                    break;
                case 'following':
                    this.setData({
                        currentPage: 'following'
                    });
                    // �����עҳ��û�����ݣ����ع�עҳ����
                    if (this.followingPostList.length === 0) {
                        this.loadFollowingPosts();
                    } else {
                        // ����������ݣ�����ͬ������״̬���ο��㳡ҳʵ�֣�
                        try {
                            this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                        } catch (e) {
                            console.warn('ͬ����עҳ����״̬ʧ��:', e);
                        }
                    }
                    break;
                case 'discussion':
                    this.setData({
                        currentPage: 'discussion'
                    });
                    // �������ҳ��û�����ݣ���������ҳ����
                    if (this.discussionPostList.length === 0) {
                        this.loadDiscussionPosts();
                    }
                    break;
            }
        },

        // �ȴ���¼����ٳ�ʼ����ҳ���ݣ����� isVoted �������
        waitForLoginThenInit: function () {
            const MAX_WAIT_MS = 5000; // ���ȴ� 5s
            const CHECK_INTERVAL_MS = 100;
            const start = Date.now();
            const checkAndGo = () => {
                try {
                    const appInstance = getApp();
                    const loginDone = appInstance && appInstance.globalData && appInstance.globalData._loginProcessCompleted;
                    const openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
                    if (loginDone && openid) {
                        console.log('?? [��ҳ] ��⵽��¼������ѻ�ȡ openid����ʼ��ȡ����');
                        this.getIndexData();
                        return;
                    }
                } catch (e) {
                    console.log('?? [��ҳ] ��¼����쳣�����Լ����ȴ���', e);
                }
                if (Date.now() - start >= MAX_WAIT_MS) {
                    console.log('?? [��ҳ] ��¼�ȴ���ʱ������ֱ����ȡ����');
                    this.getIndexData();
                    return;
                }
                setTimeout(checkAndGo, CHECK_INTERVAL_MS);
            };
            checkAndGo();
        },
        getIndexData: function () {
            // ֱ���� CacheManager ��ҳ��װ
            this.setData({ isLoading: true, postList: [], page: 0, hasMore: true });
            getHomePosts({ page: 0, pageSize: PAGE_SIZE, context: this })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    let posts = normalizePostList(postsRaw).map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);
                    this.setData({
                        postList: posts,
                        page: 1,
                        isLoading: false,
                        hasMore: posts.length === PAGE_SIZE
                    });
                    const self = this;
                    setTimeout(() => {
                        if (self.preloadUserData && typeof self.preloadUserData === 'function') {
                            self.preloadUserData(posts);
                        }
                    }, 500);
                })
                .catch((err) => {
                    console.error('����ҳ��getIndexData�������װ��ʧ��:', err);
                    this.setData({ isLoading: false });
                    uni.showToast({ title: '�������', icon: 'none' });
                });
        },

        refreshData: function () {
            this.setData(
                {
                    postList: [],
                    swiperHeights: {},
                    imageClampHeights: {},
                    page: 0,
                    hasMore: true
                },
                () => {
                    this.getPostList();
                }
            );
        },

        // catch:tap ����ͼƬԤ��������ֹ��ת
        handlePreview: function (event) {
            console.log('��ͼƬԤ����handlePreview�¼�����');
            const dataset = event && event.currentTarget ? event.currentTarget.dataset : {};
            console.log('��ͼƬԤ����event.currentTarget.dataset:', dataset);
            const result = previewImage(event);
            if (!result) {
                console.error('��ͼƬԤ����Ԥ������������', dataset);
            }
            return result;
        },

        onVote: function (event) {
            // ע�⣺С�����в���Ҫ�ֶ�stopPropagation����Ϊʹ����catch:tap��
            
            const postId = event.currentTarget.dataset.postid;
            const index = event.currentTarget.dataset.index;
            let listType = event.currentTarget.dataset.listType;
          if (!listType) {
              if (this.currentPage === 'discover') {
                  listType = 'discover';
              } else if (this.currentPage === 'following') {
                  listType = 'following';
              } else if (this.currentPage === 'discussion') {
                  listType = 'discussion';
              } else {
                  listType = 'home';
              }
          }

          const listKey = listType === 'discover' ? 'discoverPostList' :
                         listType === 'following' ? 'followingPostList' :
                         listType === 'discussion' ? 'discussionPostList' : 'postList';
          const pageTag = listType === 'discover' ? 'discover' :
                         listType === 'following' ? 'following' :
                         listType === 'discussion' ? 'discussion' : 'index';
            let list = this[listKey] || [];
            let targetIndex = index;
            if (!list[targetIndex] || list[targetIndex]._id !== postId) {
                targetIndex = list.findIndex((p) => p._id === postId);
            }
            if (targetIndex < 0) {
                console.warn('�����ޡ�δ�ҵ���Ӧ�����ӣ�postId:', postId, 'listType:', listType);
                return;
            }
            
            if (this.votingInProgress[postId]) {
                console.log('�����ޡ�����ͶƱ�У�����');
                return;
            }
            this.setData({
                [`votingInProgress.${postId}`]: true
            });
            const originalItem = list[targetIndex] || {};
            const originalVotes = Number(originalItem.votes) || 0;
            const originalIsVoted = !!originalItem.isVoted;
            console.log('�����ޡ�ԭʼ״̬ - votes:', originalVotes, 'isVoted:', originalIsVoted);

            // ��������UI���ṩ��ʱ����
            const optimisticVotes = originalIsVoted ? Math.max(0, originalVotes - 1) : originalVotes + 1;
            const optimisticItem = {
                ...originalItem,
                votes: optimisticVotes,
                isVoted: !originalIsVoted,
                likeIcon: likeIcon.getLikeIcon(optimisticVotes, !originalIsVoted)
            };
            const optimisticList = list.slice();
            optimisticList[targetIndex] = optimisticItem;
            this.setData({
                [listKey]: optimisticList
            });

            togglePostLike(postId, {
                pageTag,
                context: this,
                currentVotes: originalVotes,
                currentIsLiked: originalIsVoted,
                requireAuth: true
            }).then((result) => {
                console.log('�����ޡ����񷵻ؽ��:', result);
                if (result.success) {
                    const currentList = this[listKey] || [];
                    const currentIndex = currentList.findIndex((p) => p._id === postId);
                    if (currentIndex > -1) {
                        const updatedItem = {
                            ...currentList[currentIndex],
                            votes: result.votes,
                            isVoted: result.isLiked,
                            likeIcon: result.likeIcon
                        };
                        const newList = currentList.slice();
                        newList[currentIndex] = updatedItem;
                        this.setData({
                            [listKey]: newList
                        });
                    }
                    console.log('�����ޡ�������óɹ���������ͬ��');
                    return;
                }

                const rollback = result.rollback || {
                    votes: originalVotes,
                    isLiked: originalIsVoted,
                    likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                };
                console.warn('�����ޡ����񷵻�ʧ�ܣ��ع�UI');
                const currentList = this[listKey] || [];
                const currentIndex = currentList.findIndex((p) => p._id === postId);
                if (currentIndex > -1) {
                    const rollbackItem = {
                        ...currentList[currentIndex],
                        votes: rollback.votes,
                        isVoted: rollback.isLiked,
                        likeIcon: rollback.likeIcon
                    };
                    const newList = currentList.slice();
                    newList[currentIndex] = rollbackItem;
                    this.setData({
                        [listKey]: newList
                    });
                }
            }).catch((err) => {
                console.error('�����ޡ����� likeService ʧ��:', err);
                const currentList = this[listKey] || [];
                const currentIndex = currentList.findIndex((p) => p._id === postId);
                if (currentIndex > -1) {
                    const fallbackItem = {
                        ...currentList[currentIndex],
                        votes: originalVotes,
                        isVoted: originalIsVoted,
                        likeIcon: likeIcon.getLikeIcon(originalVotes, originalIsVoted)
                    };
                    const newList = currentList.slice();
                    newList[currentIndex] = fallbackItem;
                    this.setData({
                        [listKey]: newList
                    });
                }
            }).finally(() => {
                console.log('�����ޡ�����������');
                this.setData({
                    [`votingInProgress.${postId}`]: false
                });
            });
        },

        updatePostCommentCount: function (postId, newCommentCount) {
            const postList = this.postList;
            const postIndex = postList.findIndex((p) => p._id === postId);
            if (postIndex > -1) {
                this.setData({
                    [`postList[${postIndex}].commentCount`]: newCommentCount
                });
            }
        },

        onImageError: function (e) {
            console.error('ͼƬ����ʧ��', e.detail);
        },

        onAvatarError: function (e) {
            console.error('ͷ�����ʧ��', e.detail);
        },

        onAvatarLoad: function (e) {
            // ͷ����سɹ�������Ҫ���⴦��
            console.log('ͷ����سɹ�', e.detail);
        },

        onLikeIconError: function (e) {
            console.error('����ͼ�����ʧ��', e.detail, 'ͼ��·��:', e.currentTarget.dataset.src);
        },

        // ͼƬԤ����
        preloadImages: function (posts) {
            const imageUrls = posts
                .filter((post) => post.imageUrls && post.imageUrls.length > 0)
                .map((post) => post.imageUrls[0])
                .slice(0, 3); // ֻԤ����ǰ3��ͼƬ

            if (imageUrls.length > 0) {
                imageOptimizer.preloadImages(imageUrls, (url, success) => {
                    if (success) {
                        console.log('ͼƬԤ���سɹ�:', url);
                    }
                });
            }
        },

        // Ԥ�����û����ݣ�ͷ��͹�ע״̬��
        preloadUserData: function (posts) {
            if (!posts || posts.length === 0) {
                return;
            }
            const currentUserId = this.getCurrentUserId();
            if (!currentUserId) {
                return;
            }

            // Ԥ����ͷ��
            avatarCache.preloadAvatarsFromPosts(posts);

            // Ԥ���ع�ע״̬
            followCache.preloadFollowStatusFromPosts(posts, currentUserId);
        },

        // ��ʼ�� openid
        initOpenid: function () {
            const appInstance = getApp();
            const openid = appInstance && appInstance.globalData && appInstance.globalData.openid;
            if (openid) {
                this.setData({ openid });
            } else {
                // �ӱ��ش洢��ȡ
                const storedOpenid = uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
                if (storedOpenid) {
                    this.setData({ openid: storedOpenid });
                }
            }
        },

        // ��ȡ��ǰ�û�ID
        getCurrentUserId: function () {
            return this.openid || uni.getStorageSync('openid') || uni.getStorageSync('userOpenId');
        },

        // ��������ת���û�������ҳ
        navigateToUserProfile: function (e) {
            try {
                console.log('��ͷ�������¼�����', e);

                // ����ȫ��dataset��ȡ��ʽ
                const currentTarget = e.currentTarget || e.target || {};
                const dataset = currentTarget.dataset || {};
                console.log('��ͷ������dataset:', dataset);

                const userId = dataset.userId || dataset.userid || dataset.user || '';
                const authorName = dataset.authorName || 'δ֪�û�';
                const isAnonymous = dataset.isAnonymous || false;

                console.log('��ͷ��������ȡ����Ϣ:', { userId, authorName, isAnonymous });

                // ����Ƿ�Ϊ��������
                if (isAnonymous || (authorName === '�����û�' && userId.includes('anonymous'))) {
                    console.log('��ͷ�������������ӣ�����ת');
                    uni.showToast({
                        title: '�����û��޷��鿴��ҳ',
                        icon: 'none'
                    });
                    return;
                }

                if (!userId) {
                    console.error('��ͷ������userIdΪ�գ�dataset����:', dataset);
                    uni.showToast({
                        title: '�û���Ϣ��ȡʧ��',
                        icon: 'none'
                    });
                    return;
                }

                const currentUserOpenid = this.openid || this.getCurrentUserId();
                console.log('��ͷ��������ǰ�û�ID:', currentUserOpenid);

                // ����Ƿ��������Լ���ͷ��
                if (userId === currentUserOpenid) {
                    console.log('��ͷ��������������Լ�ͷ���л����ҵ�ҳ��');
                    uni.switchTab({
                        url: '/pages/profile/profile',
                        fail: function (err) {
                            console.error('��ͷ�������л����ҵ�ҳ��ʧ��:', err);
                            uni.showToast({
                                title: 'ҳ����תʧ��',
                                icon: 'none'
                            });
                        }
                    });
                } else {
                    console.log('��ͷ�����������������ͷ����ת���û���ҳ');
                    uni.navigateTo({
                        url: `/pages/user-profile/user-profile?userId=${encodeURIComponent(userId)}`,
                        success: function () {
                            console.log('��ͷ��������ת�ɹ�');
                        },
                        fail: function (err) {
                            console.error('��ͷ��������תʧ��:', err);
                            uni.showToast({
                                title: '��תʧ��',
                                icon: 'none'
                            });
                        }
                    });
                }
            } catch (err) {
                console.error('��ͷ����������ִ�г���:', err);
                uni.showToast({
                    title: '��ת�쳣',
                    icon: 'none'
                });
            }
        },

        // �Ż� getPostList ���������Ǻ���
        getPostList: function (cb) {
            console.log('?? [��ҳ] getPostList ��ʼ����');
            console.log('?? [��ҳ] ��ǰ״̬:', {
                isLoading: this.isLoading,
                isLoadingMore: this.isLoadingMore,
                hasMore: this.hasMore,
                page: this.page,
                postListLength: this.postList.length
            });

            // ��ǰ��Ƶ�����Ƽ�顿
            if (!checkFrontendRateLimit()) {
                console.log('?? [��ҳ] getPostList��ǰ����������');
                if (typeof cb === 'function') {
                    cb();
                }
                return;
            }

            // ���޸���ͬʱ��� isLoading �� isLoadingMore��ȷ��ֻ��һ�������ڽ���
            if (this.isLoading || this.isLoadingMore || !this.hasMore) {
                console.log('����ҳ��getPostList����ֹ�����ڼ����л�û�и�������');
                if (typeof cb === 'function') {
                    cb();
                }
                return;
            }
            const skip = this.page * PAGE_SIZE;
            const isFirstLoad = this.page === 0;
            
            console.log('?? [��ҳ] �������:', {
                skip,
                page: this.page,
                isFirstLoad,
                PAGE_SIZE
            });

            // ���ݼ����������ò�ͬ��״̬
            if (isFirstLoad) {
                // �״μ��أ���ʾ�Ǽ���
                this.setData({
                    isLoading: true
                });
            } else {
                // �������ظ��ࣺ��ʾ�ײ�������ʾ
                this.setData({
                    isLoadingMore: true
                });
            }
            const apiStartTime = Date.now();
            // ʹ�û����װ����ҳ��ҳ���ݣ�SWR + TTL
            getHomePosts({ page: this.page, pageSize: PAGE_SIZE, context: this })
                .then(async (list) => {
                    const postsRaw = Array.isArray(list) ? list : [];
                    console.log('? [��ҳ] ��ȡ�����������������װ��:', postsRaw.length);

                    let posts = normalizePostList(postsRaw).map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));

                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);

                    const self = this;
                    setTimeout(() => {
                        if (self.preloadUserData && typeof self.preloadUserData === 'function') {
                            self.preloadUserData(posts);
                        }
                    }, 500);

                    const newPostsCount = posts.length;
                    // ���޸����״μ���ʱӦ��ֱ���滻�б��������Ǻϲ������������ظ�
                    const currentPostList = this.postList;
                    const newPostList = isFirstLoad ? posts : currentPostList.concat(posts);
                    const updateData = {
                        postList: newPostList,
                        page: this.page + 1,
                        hasMore: newPostsCount === PAGE_SIZE
                    };
                    console.log('? [��ҳ] �������ݣ������װ��:', {
                        isFirstLoad,
                        newPostListLength: newPostList.length,
                        currentPostListLength: currentPostList.length,
                        currentPage: this.page,
                        newPage: this.page + 1,
                        hasMore: updateData.hasMore,
                        newPostsCount
                    });
                    this.setData(updateData);
                    if (isFirstLoad) {
                        this.preloadImages(posts);
                    }
                })
                .catch((err) => {
                    console.error('����ҳ��getPostList�������װ��ʧ��:', err);
                    if (isFirstLoad) {
                        uni.showToast({ title: '�������', icon: 'none' });
                    }
                })
                .finally(() => {
                    if (isFirstLoad) {
                        this.setData({ isLoading: false });
                    } else {
                        this.setData({ isLoadingMore: false });
                    }
                    if (typeof cb === 'function') cb();
                });
            return;
        },

        // ģʽ�л�����ͨ���ײ�tabBarʵ�֣�������Ҫ�ֶ��л�

        // ͬ������״̬���ӻ����л�ȡ���µĵ���״̬
                // ?????????????????��?????��?????? + ???��???��?UI
        syncLikeStatusFromCache: function () {
            try {
                const allPostIds = [];
                const collectIds = (list) => {
                    if (!Array.isArray(list)) return;
                    list.forEach((p) => { if (p && p._id) allPostIds.push(p._id); });
                };
                collectIds(this.postList);
                collectIds(this.discoverPostList);
                collectIds(this.discussionPostList);
                collectIds(this.followingPostList);

                if (allPostIds.length === 0) return;

                const likeSync = require('../../utils/likeStatusSync.js');
                try { likeSync.syncLikeStatusForPosts(allPostIds); } catch (_) {}
                const getLatestLikeStatus = likeSync.getLatestLikeStatus;
                const updates = {};

                const patchList = (key) => {
                    const list = this[key];
                    if (!Array.isArray(list) || list.length === 0) return;
                    let changed = false;
                    const next = list.slice();
                    for (let i = 0; i < next.length; i += 1) {
                        const p = next[i];
                        if (!p || !p._id) continue;
                        const s = getLatestLikeStatus(p._id);
                        if (s && (((Number(p.votes) || 0) !== s.votes) || (!!p.isVoted !== !!s.isVoted))) {
                            p.votes = s.votes;
                            p.isVoted = s.isVoted;
                            const likeIcon = require('../../utils/likeIcon');
                            p.likeIcon = likeIcon.getLikeIcon(s.votes, s.isVoted);
                            changed = true;
                        }
                    }
                    if (changed) updates[key] = next;
                };

                patchList('postList');
                patchList('discoverPostList');
                patchList('discussionPostList');
                patchList('followingPostList');

                if (Object.keys(updates).length > 0) {
                    this.setData(updates);
                }
            } catch (err) {
                console.error('???????????????????:', err);
            }
        },

        // ��ǩ�������
        onTagClick: function (e) {
            const tag = e.currentTarget.dataset.tag;
            console.log('�����ǩ:', tag);

            // ��ת����ǩɸѡҳ��
            uni.navigateTo({
                url: `/pages/tag-filter/tag-filter?tag=${encodeURIComponent(tag)}`,
                success: () => {
                    console.log('��ת����ǩɸѡҳ��ɹ�');
                },
                fail: (err) => {
                    console.error('��ת����ǩɸѡҳ��ʧ��:', err);
                    uni.showToast({
                        title: '��תʧ��',
                        icon: 'none'
                    });
                }
            });
        },

        // ���۵������
        onCommentClick: function (e) {
            const postId = e.currentTarget.dataset.postid;
            console.log('������ۣ���ת������ҳ:', postId);
            uni.navigateTo({
                url: `/pages/post-detail/post-detail?id=${postId}`,
                success: () => {
                    console.log('��ת������ҳ�ɹ�');
                },
                fail: (err) => {
                    console.error('��ת������ҳʧ��:', err);
                    uni.showToast({
                        title: '��תʧ��',
                        icon: 'none'
                    });
                }
            });
        },


        // �л�����עҳ
        switchToFollowing: function () {
            if (this.currentPage === 'following') {
                console.log('�Ѿ��ڹ�עҳ�������л�');
                return;
            }
            console.log('�л�����עҳ');
            this.setData({
                currentPage: 'following',
                currentTab: 'following',
                swiperCurrent: 1  // ��עҳ��Ӧswiper����1
            });

            // �����עҳ��û�����ݣ����ع�עҳ����
            if (this.followingPostList.length === 0) {
                console.log('��ʼ���ع�עҳ����');
                this.loadFollowingPosts();
            } else {
                console.log('��עҳ�������ݣ�ֱ���л�');
            }
        },

        // �л�����ҳ
        switchToHome: function () {
            if (this.currentPage === 'home') {
                console.log('�Ѿ�����ҳ�������л�');
                return;
            }
            console.log('�л�����ҳ');
            this.setData({
                currentPage: 'home',
                currentTab: 'square',
                swiperCurrent: 0  // ��ҳ��Ӧswiper����0
            });
        },

        // �л�������ҳ
        switchToDiscussion: function () {
            if (this.currentPage === 'discussion') {
                console.log('�Ѿ�������ҳ�������л�');
                return;
            }
            console.log('�л�������ҳ');
            this.setData({
                currentPage: 'discussion',
                currentTab: 'discussion',
                swiperCurrent: 2  // ����ҳ��Ӧswiper����2
            });

            // �������ҳ��û�����ݣ���������ҳ����
            if (this.discussionPostList.length === 0) {
                console.log('��ʼ��������ҳ����');
                this.loadDiscussionPosts();
            } else {
                console.log('����ҳ�������ݣ�ֱ���л�');
            }
        },

        // ���ط���ҳ���� - ʹ���Ƽ��㷨
        loadDiscoverPosts: function () {
            console.log('��ʼ���ط���ҳ�Ƽ�����');

            // ����ҳֻʹ���Ƽ��㷨�����ټ��ظ���
            this.loadRecommendationPosts();
        },

        // �����Ƽ����ӣ��״μ��أ��߻����װ��
        loadRecommendationPosts: async function () {
            if (this.discoverIsLoading || this.discoverIsLoadingMore) {
                console.log('����ҳ���ڼ����У������ظ�����');
                return;
            }

            if (!this.discoverHasMore && this.discoverPage > 0) {
                console.log('����ҳ���޸����Ƽ�����������');
                return;
            }

            const isInitialLoad = this.discoverPage === 0 && this.discoverPostList.length === 0;
            this.setData({
                discoverIsLoading: isInitialLoad,
                discoverIsLoadingMore: !isInitialLoad
            });

            try {
                const currentExcludeIds = Array.from(new Set(Array.isArray(this.discoverShownPostIds) ? this.discoverShownPostIds : []));
                const excludeSet = new Set(currentExcludeIds);
                const page = this.discoverPage;

                const result = await getDiscoverFeed({
                    excludePostIds: currentExcludeIds,
                    page,
                    pageSize: DISCOVER_PAGE_SIZE,
                    context: this
                });

                const rawPosts = Array.isArray(result?.posts) ? result.posts : [];
                console.log('��ȡ�Ƽ����ݽ������ҳ��: page=', page, '����=', rawPosts.length, 'hasMore=', result?.hasMore);

                let normalizedPosts = normalizePostList(rawPosts).map((post) => ({
                    ...post,
                    likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                }));

                // ˫�ر���ȥ��
                normalizedPosts = normalizedPosts.filter((post) => post && post._id && !excludeSet.has(post._id));

                // �� cloud:// ӳ��Ϊ�ɷ��� URL����Ԥ��
                normalizedPosts = await hydrateTempUrls(normalizedPosts);
                warmTempUrlsFromPosts(normalizedPosts);

                if (!normalizedPosts.length) {
                    console.log('�����µ��Ƽ�����');
                    const hasMoreFromServer = !!(result && result.hasMore);
                    this.setData({
                        discoverPostList: page === 0 ? [] : this.discoverPostList,
                        discoverHasMore: hasMoreFromServer,
                        discoverRefreshTime: Date.now(),
                        discoverIsLoading: false,
                        discoverIsLoadingMore: false,
                        discoverPage: hasMoreFromServer ? page + 1 : page
                    });
                    if (hasMoreFromServer) {
                        console.log('��������ʾ���и��࣬�������Ի�ȡ��һҳ');
                        this.loadRecommendationPosts();
                    } else {
                        const toastTitle = isInitialLoad ? '��ʱû���µ��Ƽ�' : 'û�и����Ƽ���';
                        uni.showToast({
                            title: toastTitle,
                            icon: 'none'
                        });
                    }
                    return;
                }

                const currentList = Array.isArray(this.discoverPostList) ? this.discoverPostList.slice() : [];
                // ������ҳ���ݣ������ظ�
                const combined = page === 0 ? normalizedPosts : (() => {
                    const existingIds = new Set(currentList.map(p => p._id));
                    const uniqueNewList = normalizedPosts.filter(p => p && p._id && !existingIds.has(p._id));
                    return currentList.concat(uniqueNewList);
                })();

                // ��¼����ʾ������ID������������
                const newShownIds = normalizedPosts.map((post) => post._id).filter(Boolean);
                const mergedSet = new Set(currentExcludeIds);
                newShownIds.forEach((id) => mergedSet.add(id));
                const updatedShownIds = Array.from(mergedSet).slice(-MAX_DISCOVER_EXCLUDE_IDS);

                const hasMoreFromServer = !!(result && result.hasMore);
                const hasMore = (normalizedPosts.length >= DISCOVER_PAGE_SIZE) || hasMoreFromServer;

                this.setData({
                    discoverPostList: combined,
                    discoverPage: page + 1,
                    discoverHasMore: (normalizedPosts.length >= DISCOVER_PAGE_SIZE) || hasMore,
                    discoverShownPostIds: updatedShownIds,
                    discoverRefreshTime: Date.now()
                });
                console.log('����ҳ�Ƽ�����������ɣ���������:', normalizedPosts.length, '�ۼ�:', combined.length, 'hasMore:', hasMore);
            } catch (err) {
                console.error('�Ƽ���������ʧ�ܣ���ҳ��:', err);
                uni.showToast({
                    title: '�Ƽ�����ʧ��',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    discoverIsLoading: false,
                    discoverIsLoadingMore: false
                });
            }
        },

        // ˢ�·���ҳ�Ƽ�
        refreshDiscoverPosts: function () {
            console.log('ˢ�·���ҳ�Ƽ�');

            // �������棬���ⷵ�ؾ�����
            try {
                invalidateDiscover();
            } catch (e) {
                console.warn('��������ҳ����ʧ��:', e);
            }

            // ����״̬����������չʾ����ID�������ظ��Ƽ�
            this.setData({
                discoverPostList: [],
                discoverPage: 0,
                discoverHasMore: true,
                discoverRefreshTime: Date.now(),
                discoverIsLoading: false,
                discoverIsLoadingMore: false
            });

            // ���¼����Ƽ�
            this.loadRecommendationPosts();
        },

        // ��������ҳ����
        loadDiscussionPosts: function (callback) {
            console.log('��ʼ��������ҳ����');

            if (this.discussionIsLoading || this.discussionIsLoadingMore) {
                console.log('����ҳ���ڼ����У������ظ�����');
                return;
            }

            if (!this.discussionHasMore && this.discussionPage > 0) {
                console.log('����ҳ���޸������ݣ���������');
                return;
            }

            const isInitialLoad = this.discussionPage === 0 && this.discussionPostList.length === 0;
            this.setData({
                discussionIsLoading: isInitialLoad,
                discussionIsLoadingMore: !isInitialLoad
            });

            const skip = this.discussionPage * PAGE_SIZE;

            this.callCloudFunction('getDiscussionPosts', {
                skip: skip,
                limit: PAGE_SIZE
            }, { requireAuth: false }).then(async (res) => {
                if (res.result && res.result.success && res.result.posts) {
                    let posts = res.result.posts.map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));

                    // �� cloud:// ӳ��Ϊ�ɷ��� URL����Ԥ��
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);

                    // ������ҳ���ݣ������ظ�
                    const currentList = this.discussionPage === 0 ? [] : this.discussionPostList;
                    const existingIds = new Set(currentList.map(p => p._id));
                    const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                    const newList = currentList.concat(uniqueNewList);

                    this.setData({
                        discussionPostList: newList,
                        discussionPage: this.discussionPage + 1,
                        discussionHasMore: posts.length === PAGE_SIZE,
                        discussionIsLoading: false,
                        discussionIsLoadingMore: false
                    });

                    console.log('����ҳ���ݼ�����ɣ���������:', posts.length, '�ۼ�:', newList.length);

                    // Ԥ�����û�����
                    if (isInitialLoad) {
                        setTimeout(() => {
                            if (this.preloadUserData && typeof this.preloadUserData === 'function') {
                                this.preloadUserData(posts);
                            }
                        }, 500);
                    }

                    // ���ûص�����������ˢ�����֪ͨ��
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                } else {
                    this.setData({
                        discussionIsLoading: false,
                        discussionIsLoadingMore: false,
                        discussionHasMore: false
                    });
                    if (isInitialLoad) {
                        uni.showToast({
                            title: '������������',
                            icon: 'none'
                        });
                    }
                    // ���ûص�����������ˢ�����֪ͨ��
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }
            }).catch((err) => {
                console.error('��������ҳ����ʧ��:', err);
                this.setData({
                    discussionIsLoading: false,
                    discussionIsLoadingMore: false
                });
                uni.showToast({
                    title: '����ʧ��',
                    icon: 'none'
                });
                // ���ûص�����������ˢ�����֪ͨ��
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
        },

        // ģ������ҳ����
        getMockDiscussionPosts: function () {
            return [
                {
                    _id: 'discussion_1',
                    _openid: 'user_1',
                    title: '��Ҿ����ִ�ʫ��Ӧ����η�չ��',
                    content: '��������ܶ��ִ�ʫ��Ʒ���о������졣��������Ҷ��ִ�ʫ��δ����չ�Ŀ�����',
                    authorName: 'ʫ��С��',
                    authorAvatar: '/static/images/avatar.png',
                    votes: 15,
                    commentCount: 8,
                    isVoted: false,
                    tags: ['ʫ������', '�ִ�ʫ'],
                    imageUrls: [],
                    createdAt: new Date().toISOString()
                },
                {
                    _id: 'discussion_2',
                    _openid: 'user_2',
                    title: '����һ����ϲ���Ĺ�ʫ',
                    content: '����ض�����׵ġ������ơ���ÿ�ζ������µĸ��򡣴����ϲ�����׹�ʫ�أ�',
                    authorName: '�ŷ簮����',
                    authorAvatar: '/static/images/avatar.png',
                    votes: 23,
                    commentCount: 12,
                    isVoted: true,
                    tags: ['��ʫ', '���', '����'],
                    imageUrls: [],
                    createdAt: new Date().toISOString()
                },
                {
                    _id: 'discussion_3',
                    _openid: 'user_3',
                    title: 'д����пݽ���ô�죿',
                    content: '���һ��ʱ�����Ǹо�д������������к���ݽ��ˡ������ʲô�õĽ�����',
                    authorName: 'д������',
                    authorAvatar: '/static/images/avatar.png',
                    votes: 8,
                    commentCount: 6,
                    isVoted: false,
                    tags: ['д��', '���', '����'],
                    imageUrls: [],
                    createdAt: new Date().toISOString()
                }
            ];
        },

        // ˢ������ҳ����
        refreshDiscussionPosts: function (callback) {
            console.log('ˢ������ҳ����');
            this.setData({
                discussionPostList: [],
                discussionPage: 0,
                discussionHasMore: true,
                discussionIsLoading: false,
                discussionIsLoadingMore: false
            });
            this.loadDiscussionPosts(callback);
        },

        // ˢ�¹㳡ҳ���ݣ��������Ӻ���ã�
        refreshIndexData: function () {
            console.log('��index����ʼˢ�¹㳡ҳ����');

            // �����ҳ����
            try {
                invalidateHomePosts({});
                console.log('? [index] �������ҳ����');
            } catch (e) {
                console.error('? [index] �����ҳ����ʧ��:', e);
            }

            // ����״̬
            this.setData({
                postList: [],
                page: 0,
                hasMore: true,
                isLoading: false
            });

            // ���¼�������
            this.getIndexData();
        },

        // ͳһ�ƺ������÷���
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'index', context: this }, extraOptions));
        },

        // �պ�����������ֹ�������ӵ�ͷ�����¼�
        noop() {},

        // ���ع�עҳ����
        loadFollowingPosts: function (callback) {
            console.log('��ʼ���ع�עҳ����');

            if (this.followingIsLoading || this.followingIsLoadingMore) {
                console.log('��עҳ���ڼ����У������ظ�����');
                return;
            }

            if (!this.followingHasMore && this.followingPage > 0) {
                console.log('��עҳ���޸������ݣ���������');
                return;
            }

            const isInitialLoad = this.followingPage === 0 && this.followingPostList.length === 0;
            this.setData({
                followingIsLoading: isInitialLoad,
                followingIsLoadingMore: !isInitialLoad
            });

            const skip = this.followingPage * PAGE_SIZE;

            this.callCloudFunction('getFollowingPosts', {
                skip: skip,
                limit: PAGE_SIZE
            }, { requireAuth: true }).then(async (res) => {
                if (res.result && res.result.success && res.result.posts) {
                    let posts = res.result.posts.map((post) => ({
                        ...post,
                        likeIcon: likeIcon.getLikeIcon(post.votes || 0, post.isVoted || false)
                    }));

                    // �� cloud:// ӳ��Ϊ�ɷ��� URL����Ԥ��
                    posts = await hydrateTempUrls(posts);
                    warmTempUrlsFromPosts(posts);

                    // ������ҳ���ݣ������ظ�
                    const currentList = this.followingPage === 0 ? [] : this.followingPostList;
                    const existingIds = new Set(currentList.map(p => p._id));
                    const uniqueNewList = posts.filter(p => p && p._id && !existingIds.has(p._id));
                    const newList = currentList.concat(uniqueNewList);

                    this.setData({
                        followingPostList: newList,
                        followingPage: this.followingPage + 1,
                        followingHasMore: posts.length === PAGE_SIZE,
                        followingIsLoading: false,
                        followingIsLoadingMore: false
                    });

                    console.log('��עҳ���ݼ�����ɣ���������:', posts.length, '�ۼ�:', newList.length);

                    // ���ݼ�����ɺ�ͬ������״̬���ο��㳡ҳʵ�֣�
                    try {
                        this.syncLikeStatusFromCache && this.syncLikeStatusFromCache();
                    } catch (e) {
                        console.warn('��עҳ���ݼ��غ�ͬ������״̬ʧ��:', e);
                    }

                    // Ԥ�����û�����
                    if (isInitialLoad) {
                        setTimeout(() => {
                            if (this.preloadUserData && typeof this.preloadUserData === 'function') {
                                this.preloadUserData(posts);
                            }
                        }, 500);
                    }

                    // ���ûص�����������ˢ�����֪ͨ��
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                } else {
                    this.setData({
                        followingIsLoading: false,
                        followingIsLoadingMore: false,
                        followingHasMore: false
                    });
                    if (isInitialLoad) {
                        uni.showToast({
                            title: '���޹�ע���˷���',
                            icon: 'none'
                        });
                    }
                    // ���ûص�����������ˢ�����֪ͨ��
                    if (callback && typeof callback === 'function') {
                        callback();
                    }
                }
            }).catch((err) => {
                console.error('���ع�עҳ����ʧ��:', err);
                this.setData({
                    followingIsLoading: false,
                    followingIsLoadingMore: false
                });
                uni.showToast({
                    title: '����ʧ��',
                    icon: 'none'
                });
                // ���ûص�����������ˢ�����֪ͨ��
                if (callback && typeof callback === 'function') {
                    callback();
                }
            });
        },

        // ˢ�¹�עҳ����
        refreshFollowingPosts: function (callback) {
            console.log('ˢ�¹�עҳ����');
            this.setData({
                followingPostList: [],
                followingPage: 0,
                followingHasMore: true,
                followingIsLoading: false,
                followingIsLoadingMore: false
            });
            this.loadFollowingPosts(callback);
        },


    }
};
</script>
<style>
/* index.wxss */

/* ҳ���װ�� - ȷ������ҳ�治�Ử�� */
.page-wrapper {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
}

.container {
    /* ����paddingΪ�л������ռ� */
    /* App�ˣ�188rpx���л���������+ 88rpx��״̬���� */
    /* #ifdef APP-PLUS */
    padding-top: 276rpx;
    /* #endif */
    /* H5�ˣ�188rpx���л�����������״̬���� */
    /* #ifdef H5 */
    padding-top: 188rpx;
    /* #endif */
    padding-bottom: 100rpx; /* Ϊ�ײ�tabBar�����ռ� */
    background-color: #ffffff;
    min-height: 100vh;
    position: relative;
    /* ��ֹ������������ */
    overflow: hidden;
    /* ���ù��Ȼ��� */
    overscroll-behavior: none;
    /* ȷ����������������� */
    height: 100vh;
    box-sizing: border-box;
}


/* ��ʫģʽ���� */
.poem-mode-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    z-index: 100;
    overflow: hidden;
}

/* ����ָʾ�� */
.swipe-indicator {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    color: rgba(255, 255, 255, 0.8);
    font-size: 28rpx;
    padding: 20rpx 30rpx;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 50rpx;
    backdrop-filter: blur(10rpx);
}

.swipe-indicator.left {
    left: 30rpx;
}

.swipe-indicator.right {
    right: 30rpx;
}

/* ��������ָʾ�� */
.post-indicator {
    position: absolute;
    bottom: 60rpx;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.9);
    font-size: 24rpx;
    padding: 12rpx 24rpx;
    background: rgba(0, 0, 0, 0.4);
    border-radius: 30rpx;
    backdrop-filter: blur(10rpx);
}

/* �б�ģʽ���� */
.list-mode-container,
.list-content {
    display: block;
}

/* �㳡ģʽ���� */
.square-mode-container {
    display: block;
    padding-top: 20rpx; /* ��������������padding����Ϊscroll-view���ݻᵥ������ */
    height: 100%;
    overflow: hidden;
}

/* ���������ϱ߾࣬���ⱻ�л����ڵ� */
#post-list-container,
#following-list-container,
#discussion-list-container {
    padding-top: 0; /* �Ƴ�padding-top����Ϊswiper�Ѿ����л����·� */
    box-sizing: border-box;
}

/* Ϊ��״̬����Ҳ�����ϱ߾� */
.swiper-page .empty-state {
    /* App�ˣ���Ҫ�����ϱ߾� */
    /* #ifdef APP-PLUS */
    margin-top: 160rpx;
    /* #endif */
    /* H5�ˣ��ϱ߾���Ը�С */
    /* #ifdef H5 */
    margin-top: 100rpx;
    /* #endif */
}

/* �������������װ����ʽ */
.post-item-wrapper {
    background: #fff;
    margin-bottom: 20rpx;
    padding: 0;
    box-shadow: none;
    border-radius: 0;
    border-bottom: 1rpx solid #f0f0f0;
}

/* ԭ������������ʽ */
.post-item-wrapper.original-post {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0) 90%, rgba(235, 200, 141, 0.05) 95%, rgba(235, 200, 141, 0.08) 100%);
    border-left: 3rpx solid #ebc88d;
    position: relative;
}

/* ԭ�����ӹ�ӰЧ�����Ƴ� */

/* ���������ݵ�������ʽ */
.post-content-navigator {
    display: block;
    background: transparent;
}

/* ���������������Ч�� */
.navigator-hover {
    background-color: rgba(0, 0, 0, 0.02);
}

/* ���������ް�ť������ʽ */
.like-icon-container {
    padding: 10rpx;
    border-radius: 50%;
    transition: all 0.2s ease;
}

/* ���������ް�ť���Ч�� */
.like-icon-container:active {
    transform: scale(0.9);
    background-color: rgba(255, 107, 107, 0.1);
}

/* ����������ͼ����ʽ */
.like-icon {
    width: 40rpx;
    height: 40rpx;
    transition: all 0.2s ease;
}

.author-info {
    display: flex;
    align-items: center;
    margin-bottom: 15rpx;
}

.author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
}

.author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

/* ������ͼƬ����ռλ��ʽ */
.image-container-wrapper {
    position: relative;
    width: 100%;
    background-color: #f0f0f0; /* ռλʱ�ı���ɫ������Ҫ */
    overflow: hidden;
    border-radius: 8px; /* ���ԼӸ�Բ�ǣ���ռλ����ÿ� */
    margin: 20rpx 0; /* ͼƬ���·����ݵļ�� */
}

/* ��������ͼƬ��Swiper�������ռλ���� */
.image-container-wrapper .post-image,
.image-container-wrapper .image-swiper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

/* ��ͼ���� */
.multi-image-container {
    width: 100%;
    position: relative;
}

/* ��ͼ���� */
.single-image-container {
    width: 100%;
    position: relative;
}

/* ����ͼƬ��swiper��ʽ */
.image-swiper {
    width: 100%;
    background-color: #fff;
    /* �߶��� style �󶨶�̬���� */
}

.swiper-item {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.post-image {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
}

.post-image:active {
    transform: scale(1.05);
}

.post-image.single-image {
    width: 100%;
    height: auto;
    display: block;
    background-color: #f5f5f5;
}

/* ͼƬ����ָʾ�� */
.image-count-indicator {
    position: absolute;
    top: 20rpx;
    right: 20rpx;
    background-color: rgba(0, 0, 0, 0.6);
    color: white;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
    z-index: 10;
    backdrop-filter: blur(10rpx);
}

/* ��Ƭ����ʽ */
.post-item-wrapper {
    margin-bottom: 20rpx;
}

/* �ⲿ������Ϣ��ʽ */
.author-info-outside {
    display: flex;
    align-items: center;
    padding: 20rpx 40rpx 10rpx 40rpx;
    background: #fff;
}

.author-info-outside .author-avatar {
    width: 60rpx;
    height: 60rpx;
    border-radius: 50%;
    margin-right: 15rpx;
    background-color: #f5f5f5;
    cursor: pointer;
}

.author-info-outside .author-name {
    font-size: 28rpx;
    color: #333;
    font-weight: 500;
}

.post-item {
    width: 100%;
    background: #fff;
    box-shadow: none;
    box-sizing: border-box;
    padding: 20rpx 40rpx 30rpx 40rpx;
}

/* ������ʱ����ʽ - ������Ƭ��С */
.post-card-active {
    transform: scale(0.98);
}

.post-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #333333;
    margin-bottom: 15rpx;
    line-height: 1.4;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* ʫ��������ʽ */
.poem-author {
    font-size: 32rpx;
    color: #000;
    text-align: center;
    margin: 5rpx 0 15rpx 0;
    letter-spacing: 2rpx;
}

.post-content {
    font-size: 28rpx;
    color: #666666;
    line-height: 1.6;
    margin-top: 15rpx;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
}


.vote-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    /* ����һ�㣺�ս������ݵĴ�ֱ��� */
    margin-top: -8rpx;
    padding: 10rpx 60rpx 15rpx 60rpx;
}

.vote-count,
.comment-count {
    display: flex;
    align-items: center;
    font-size: 28rpx;
    color: #999;
    margin-left: 10rpx;
    transition: color 0.2s ease;
}

.comment-icon {
    width: 40rpx;
    height: 40rpx;
    margin-right: 8rpx;
}

.vote-count {
    margin-left: 10rpx;
}

/* .vote-count.voted {
    color: #ff4757;
} */

.actions-left {
    display: flex;
    align-items: center;
}

.action-emoji {
    font-size: 28rpx;
    margin-right: 8rpx;
}

.action-text {
    font-size: 28rpx;
    color: inherit;
}

.button-group {
    display: flex;
    align-items: center;
}

.like-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8rpx;
    border-radius: 8rpx;
    margin-left: 20rpx;
    transition: all 0.2s ease;
}

.like-icon-container:active {
    transform: scale(0.95);
}

.like-icon {
    width: 48rpx;
    height: 48rpx;
}

/* ��״̬��ʽ */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    text-align: center;
}

.empty-icon {
    font-size: 120rpx;
    margin-bottom: 30rpx;
    opacity: 0.6;
}

.empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 15rpx;
}

.empty-subtext {
    font-size: 28rpx;
    color: #999;
}

/* ���ظ�����ʽ */
.loading-more {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 40rpx;
}

.loading-text {
    font-size: 28rpx;
    color: #999;
}

/* �ײ�����״̬��ʽ */
.loading-footer {
    text-align: center;
    padding: 20rpx 0;
    color: #999;
    font-size: 14px;
}


/* ��ǩ��ʽ */
.post-tags {
    margin-top: 30rpx;
    margin-bottom: 10rpx;
    line-height: 1.5;
}

.post-tag {
    color: #24375f;
    font-size: 26rpx;
    margin-right: 10rpx;
    transition: all 0.2s ease;
    cursor: pointer;
}

.post-tag:active {
    color: #1a2a4a;
    opacity: 0.8;
}

/* �ײ�������ʾ��ʽ */
.end-tip {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40rpx 20rpx;
    color: #999;
}

.end-text {
    font-size: 28rpx;
    color: #999;
    text-align: center;
}

/* swiperҳ���л���ʽ */
.page-swiper {
    /* �߶ȼ��㣺100vh - �л����߶� - �ײ�tabBar�߶� */
    /* App�ˣ�276rpx���л���+״̬���� */
    /* #ifdef APP-PLUS */
    height: calc(100vh - 276rpx - 100rpx);
    /* #endif */
    /* H5�ˣ�188rpx���л�������״̬���� */
    /* #ifdef H5 */
    height: calc(100vh - 188rpx - 100rpx);
    /* #endif */
    width: 100%;
    /* ���ƻ����߽� */
    overflow: hidden;
    /* ���ù��Ȼ��� */
    overscroll-behavior: none;
    /* ȷ�����л����·� */
    position: relative;
    z-index: 999;
}

.swiper-page {
    height: 100%;
    /* scroll-view ���Զ���������������Ҫ overflow-y: auto */
    position: relative;
    /* ����z-index��ȷ�����л����·� */
    z-index: 999;
}

/* ȷ�� scroll-view �ĵ�һ����Ԫ�����ϱ߾࣬������ˢ��ԲȦ��ʾ���л����·� */
.swiper-page > view:first-child {
    /* App�ˣ���Ҫ�����ϱ߾� */
    /* #ifdef APP-PLUS */
    margin-top: 60rpx;
    /* #endif */
    /* H5�ˣ��ϱ߾���Ը�С */
    /* #ifdef H5 */
    margin-top: 20rpx;
    /* #endif */
}

.refresh-text {
    font-size: 24rpx;
    color: #ffc107;
    font-weight: 500;
}

/* ����ˢ��תȦȦ��ʽ�Զ��� - ��� index ҳ�� */
/* ���Ե�����ɫ��λ�õȣ�����С�Ͷ��������� */
.swiper-page .uni-pull-refresh-spinner,
.swiper-page .wx-pull-refresh-spinner {
    /* ��ɫ������ƽ̨֧�֣�- ��ɫ */
    color: #999999 !important;
    border-color: #999999 !important;
    /* λ��ƫ�ƣ������Ҫ�� */
    /* top: 20rpx; */
}

/* ����ˢ��������ʽ */
.swiper-page .uni-pull-refresh,
.swiper-page .wx-pull-refresh {
    /* ���Ե���������͸���ȵ� */
    background: transparent;
}
</style>
