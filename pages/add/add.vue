<template>
    <!-- pages/add/add.wxml -->
    <view class="container">
        <!-- 图片预览区域 -->
        <view v-if="imageList.length > 0" class="image-section">
            <scroll-view class="image-preview-scroll" :scroll-x="true" :show-scrollbar="false">
                <view class="image-preview-container">
                    <view class="image-preview-item" v-for="(item, index) in imageList" :key="index">
                        <image class="preview-image" :src="item.previewUrl" mode="aspectFill" @error="onImageError"></image>

                        <view class="image-remove-btn" @tap="removeImage" :data-index="index">×</view>
                    </view>
                    <view v-if="imageList.length < maxImageCount" class="add-image-btn" @tap="handleChooseImage">
                        <view class="add-icon">+</view>
                    </view>
                </view>
            </scroll-view>
        </view>

        <!-- 颜色选择弹层 -->
        <view v-if="showColorPicker" class="color-picker-mask" @tap="showColorPicker=false">
            <view class="color-picker" @tap.stop="noop">
                <view class="color-grid">
                    <view v-for="c in availableColors" :key="c" class="color-swatch" :style="{ backgroundColor: c }" @tap="chooseColor" :data-color="c">
                        <text v-if="selectedBackgroundColor === c" class="color-check">✓</text>
                    </view>
                </view>
                <view class="color-tip">仅影响“路”页卡片底色</view>
            </view>
        </view>

        <!-- 内容输入区域 -->
        <view class="content-section">
  
            <!-- 正文输入区域 -->
            <view class="content-input-wrapper" :data-highlight-mode="highlightModeEnabled">
                <textarea
                    class="content-textarea"
                    placeholder="此刻你想要分享..."
                    @input="onContentInput"
                    @tap="onTextareaTap"
                    maxlength="1500"
                    :value="content"
                    :show-confirm-bar="false"
                    :adjust-position="false"
                    @focus="onTextareaFocus"
                    @blur="onTextareaBlur"
                    @scroll="onTextareaScroll"
                ></textarea>
                <view v-if="content.length > 1400" class="char-count">{{ content.length }}/1500</view>

                <!-- 长按选择覆盖层 -->
                <view v-if="content.trim() && highlightModeEnabled"
                      class="highlight-select-overlay"
                      @touchstart="onOverlayTouchStart"
                      @touchend="onOverlayTouchEnd"
                      @touchmove="onOverlayTouchMove"
                      catchtouchmove="true">
                    <scroll-view class="overlay-scroll" :scroll-y="true" :scroll-top="overlayScrollTop">
                        <view class="overlay-content">
                            <view v-for="(line, i) in splitContentLines"
                                  :key="'overlay-line-' + i"
                                  :class="'overlay-line ' + (highlightSelectedLineIndices.includes(i) ? 'highlighted' : '')"
                                  :data-index="i"
                                  @touchstart="onLineTouchStart"
                                  @touchend="onLineTouchEnd">
                                <view class="overlay-line-content">{{ line || ' ' }}</view>
                            </view>
                        </view>
                    </scroll-view>
                </view>

                <!-- Right-side vertical toolbar (placeholders) -->
                <view class="side-toolbar">
                    <view class="side-tool-btn" @tap="handleChooseImage"><view class="side-tool-icon">IMG</view></view>
                      <view class="side-tool-btn" @tap="toggleTagSelector"><view class="side-tool-icon">#</view></view>
                    <view class="side-tool-btn" @tap="onSelectColor"><view class="side-tool-icon">色</view></view>
                    <view class="side-tool-btn" @tap="toggleHighlightMode"><view class="side-tool-icon">高</view></view>
                    <view class="side-tool-btn" @tap="switchMode"><view class="side-tool-icon">模</view></view>
                    <view class="side-tool-btn" @tap="goToPreview"><view class="side-tool-icon">➔</view></view>
                </view>

                <!-- 高光选择提示 -->
                <view v-if="showHighlightHint" class="highlight-hint">
                    <text class="hint-text">长按文字即可选择高光行</text>
                    <view class="hint-close" @tap="hideHighlightHint">×</view>
                </view>

                <!-- 旧的高光选择弹层（保留作为备用） -->
                <view v-if="highlightSelecting" class="highlight-overlay" catchtouchmove="true" @tap="noop">
                    <scroll-view class="highlight-scroll" :scroll-y="true">
                        <view v-for="(line, i) in splitContentLines" :key="i"
                              :class="'hl-line ' + (highlightSelectedLineIndices.includes(i) ? 'selected' : '')"
                              @tap.stop.prevent="toggleHighlightLine" :data-index="i">
                            <text class="hl-text">{{ line.length ? line : ' ' }}</text>
                        </view>
                    </scroll-view>
                    <view class="hl-actions">
                        <button class="hl-done" size="mini" @tap.stop.prevent="finishHighlight">完成</button>
                        <button class="hl-clear" size="mini" @tap.stop.prevent="clearHighlight">清除</button>
                    </view>
                </view>
            </view>
        </view>

        <!-- 模式选择器 -->
        <view v-if="showModeSelector" class="mode-selector">
            <view class="mode-title">选择发布模式</view>
            <view class="mode-grid">
                <view class="mode-item" @tap="selectPublishMode" :data-mode="'poem'" :data-original="true">
                    <view class="mode-icon">✨</view>
                    <view class="mode-text">原创诗歌</view>
                </view>
                <view class="mode-item" @tap="selectPublishMode" :data-mode="'poem'" :data-original="false">
                    <view class="mode-icon">📖</view>
                    <view class="mode-text">非原创诗歌</view>
                </view>
                <view class="mode-item" @tap="selectPublishMode" :data-mode="'normal'" :data-original="null">
                    <view class="mode-icon">📝</view>
                    <view class="mode-text">普通帖子</view>
                </view>
                <view class="mode-item" @tap="selectPublishMode" :data-mode="'discussion'" :data-original="null">
                    <view class="mode-icon">💬</view>
                    <view class="mode-text">讨论帖子</view>
                </view>
            </view>
        </view>

        <!-- 标签选择区域 -->
        <view v-if="showTagSelector" class="tag-section" :style="'bottom: 120rpx;'">
            <view class="tag-header">
                <text class="tag-title">添加标签</text>
                <text class="tag-count">{{ selectedTags.length }}/5</text>
                <text class="tag-toggle" @tap="toggleTagSelector">收起</text>
            </view>

            <!-- 已选标签显示 -->
            <view v-if="selectedTags.length > 0" class="selected-tags">
                <view class="selected-tag" v-for="(item, index) in selectedTags" :key="index">
                    <text>{{ item }}</text>

                    <text class="remove-tag" @tap="removeTag" :data-tag="item">×</text>
                </view>
            </view>

            <!-- 标签选择器 -->
            <view v-if="showTagSelector" class="tag-selector">
                <!-- 分类选择器 -->
                <view class="category-selector">
                    <scroll-view class="category-scroll" :scroll-x="true" :show-scrollbar="false">
                        <view class="category-list">
                            <view
                                :class="'category-item ' + (currentCategoryIndex === index ? 'active' : '')"
                                @tap="switchCategory"
                                :data-index="index"
                                v-for="(item, index) in tagCategories"
                                :key="index"
                            >
                                <text class="category-icon">{{ item.icon }}</text>

                                <text class="category-name">{{ item.name }}</text>
                            </view>
                        </view>
                    </scroll-view>
                </view>

                <!-- 当前分类的标签 -->
                <view class="current-category-tags">
                    <view
                        :class="'preset-tag ' + (selectedTags.includes(item) ? 'selected' : '')"
                        @tap="selectTag"
                        :data-tag="item"
                        v-for="(item, index) in tagCategories[currentCategoryIndex].tags"
                        :key="index"
                    >
                        {{ item }}
                    </view>
                </view>

                <!-- 自定义标签输入 -->
                <view class="custom-tag-input">
                    <input placeholder="输入自定义标签" :value="customTag" @input="onCustomTagInput" maxlength="10" />
                    <button size="mini" @tap="addCustomTag">添加</button>
                </view>

                <!-- 匹配的标签推荐 -->
                <view v-if="showMatchedTags && matchedTags.length > 0" class="matched-tags">
                    <view class="matched-tags-title">推荐标签：</view>
                    <view class="matched-tags-list">
                        <view class="matched-tag" @tap="selectMatchedTag" :data-tag="item" v-for="(item, index) in matchedTags" :key="index">
                            {{ item }}
                        </view>
                    </view>
                </view>
            </view>
        </view>
    </view>
    <!-- 这个 </view> 是用来闭合最外层的 <view class="container"> 的 -->
</template>

<script>
// pages/add/add.js
// 修复：移除全局数据库实例，改为在方法中动态获取
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
    data() {
        return {
            content: '',
            // 选择颜色
            selectedBackgroundColor: '#a4c4bd',
            availableColors: ['#a4c4bd','#c9cfcf','#906161','#909388'],
            showColorPicker: false,

            // 高光选择
            highlightSelecting: false,
            highlightSelectedLineIndices: [],
            highlightLines: [],
            // 高光句（兼容旧字段）
            highlightSentence: '',

            // 新的覆盖层相关状态
            overlayScrollTop: 0,
            textareaScrollTop: 0,
            showHighlightHint: false,
            highlightModeEnabled: false,
            longPressTimer: null,
            touchStartLine: null,
            imageList: [],

            // 图片列表，包含原图和压缩图信息
            maxImageCount: 9,

            // 最大图片数量
            publishMode: 'normal',

            // 'normal' | 'poem' | 'discussion' 普通模式 | 诗歌模式 | 讨论模式
            isOriginal: false,

            // 是否原创
            showModeSelector: false,

            // 是否显示模式选择器

            // 讨论模式相关
            isDiscussion: false,
            parentPostId: '',
            parentPostInfo: null,
            canPublish: false,

            // 是否可以发布
            selectedTags: [],

            // 选中的标签
            customTag: '',

            // 自定义标签输入
            showTagSelector: false,

            // 是否显示标签选择器
            currentCategoryIndex: 0,

            // 当前选中的分类索引
            allExistingTags: [],

            // 所有已有标签
            matchedTags: [],

            // 匹配的标签
            showMatchedTags: false,

            // 是否显示匹配的标签
            isPublished: false,

            // 是否已发布成功，用于避免发布后再次询问保存草稿
            isTemporaryHide: false,

            // 是否临时隐藏（如选择图片），用于避免触发草稿保存
            author: '',

            // 作者信息
            keyboardHeight: 0,

            // 键盘高度

            // 标签分类数据
            tagCategories: [
                {
                    name: '内容主题',
                    icon: '📝',
                    tags: [
                        '爱情',
                        '亲情',
                        '友情',
                        '乡愁',
                        '思念',
                        '孤独',
                        '咏物',
                        '山水',
                        '田园',
                        '季节',
                        '春天',
                        '夏日',
                        '秋风',
                        '冬雪',
                        '人生',
                        '理想',
                        '哲理',
                        '时间',
                        '青春',
                        '成长',
                        '生死',
                        '怀古',
                        '咏史',
                        '边塞',
                        '战争',
                        '爱国',
                        '城市',
                        '乡村',
                        '生活',
                        '旅行',
                        '饮食',
                        '劳动'
                    ]
                },
                {
                    name: '情感基调',
                    icon: '💭',
                    tags: [
                        '治愈',
                        '温暖',
                        '浪漫',
                        '唯美',
                        '悲伤',
                        '伤感',
                        '惆怅',
                        '寂寞',
                        '豪放',
                        '豁达',
                        '激昂',
                        '热血',
                        '婉约',
                        '细腻',
                        '清新',
                        '宁静',
                        '励志',
                        '鼓舞',
                        '坚定',
                        '充满希望',
                        '讽刺',
                        '批判',
                        '深沉',
                        '引人深思'
                    ]
                },
                {
                    name: '形式体裁',
                    icon: '📖',
                    tags: [
                        '古体诗',
                        '近体诗',
                        '五言',
                        '七言',
                        '绝句',
                        '律诗',
                        '词',
                        '曲',
                        '乐府',
                        '骚体',
                        '现代诗',
                        '自由诗',
                        '散文诗',
                        '十四行诗',
                        '叙事诗',
                        '俳句',
                        '短歌',
                        '史诗',
                        '长诗',
                        '短诗',
                        '微型诗',
                        '三行诗'
                    ]
                },
                {
                    name: '意象元素',
                    icon: '🌙',
                    tags: [
                        '月亮',
                        '星星',
                        '太阳',
                        '宇宙',
                        '银河',
                        '风',
                        '雨',
                        '雪',
                        '云',
                        '雾',
                        '河流',
                        '大海',
                        '山峰',
                        '森林',
                        '花',
                        '草',
                        '树',
                        '麦田',
                        '落叶',
                        '梅',
                        '兰',
                        '竹',
                        '菊',
                        '鸟',
                        '马',
                        '蝉',
                        '鱼',
                        '蝴蝶',
                        '酒',
                        '剑',
                        '琴',
                        '灯',
                        '船',
                        '镜子',
                        '红色',
                        '白色',
                        '蓝色',
                        '金色'
                    ]
                },
                {
                    name: '风格流派',
                    icon: '🎭',
                    tags: [
                        '唐诗',
                        '宋词',
                        '元曲',
                        '先秦',
                        '两汉',
                        '魏晋',
                        '建安风骨',
                        '朦胧诗',
                        '新月派',
                        '浪漫主义',
                        '现实主义',
                        '象征主义',
                        '现代主义',
                        '意象派',
                        '垮掉的一代',
                        '中文诗',
                        '英文诗',
                        '日文诗',
                        '法文诗',
                        '翻译诗',
                        '中国',
                        '英国',
                        '美国',
                        '日本',
                        '俄罗斯'
                    ]
                },
                {
                    name: '场景用途',
                    icon: '🎯',
                    tags: [
                        '晚安诗',
                        '早安问候',
                        '节日祝福',
                        '春节',
                        '中秋',
                        '情人节',
                        '毕业季',
                        '婚礼致辞',
                        '旅行途中',
                        '雨天读诗',
                        '写给孩子',
                        '致敬母亲',
                        '送给朋友',
                        '适合摘抄',
                        '可以用作签名'
                    ]
                }
            ],

            tags: []
        };
    },
    computed: {
        splitContentLines() {
            const raw = this.content || '';
            return raw.split(/\r?\n/);
        }
    },
    onLoad: function (options) {
        // 初始化颜色/高光编辑相关状态（向后兼容）
        this.setData({
            selectedBackgroundColor: this.selectedBackgroundColor || '#a4c4bd',
            availableColors: this.availableColors || ['#a4c4bd','#c9cfcf','#906161','#909388'],
            showColorPicker: false,
            highlightSentence: this.highlightSentence || ''
        });
        // 页面加载时获取所有已有标签
        this.loadAllExistingTags();

        // 检查是否是编辑草稿模式
        if (options.mode === 'edit') {
            this.loadEditingDraft();
        } else {
            // 加载草稿
            this.loadDraft();
        }

        // 确保页面不会滚动
        this.preventPageScroll();
    },
    onShow: function () {
        // 每次显示页面时都确保页面不会滚动
        this.preventPageScroll();
    },
    onUnload: function () {
        // 只有真正退出发布页时提示保存草稿（已发布的不提示）
        if ( !this.isPublished) {
            this.exitWithOptionalSave();
        }
    },
    onHide: function () {
        // 其它情况不再提示，仅重置临时隐藏标志
        this.setData({ isTemporaryHide: false });
    },
    // App/H5：拦截物理返回，优先弹出草稿提示
    onBackPress: function () {
        if (!this.isPublished && this.hasContent()) {

            this.exitWithOptionalSave();
        }
        return false;
    },
    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'add', context: this, requireAuth: true }, extraOptions));
        },

        // 加载所有已有标签
        loadAllExistingTags() {
            this.callCloudFunction('getAllTags')
                .then(res => {
                    if (res.result && res.result.success) {
                        this.allExistingTags = res.result.tags;
                    }
                })
                .catch(err => {
                    console.error('Failed to load all existing tags:', err);
                });
        },

        // 退出前提示是否保存草稿并自动返回
        exitWithOptionalSave: function () {
            if ( !this.hasContent()) { try { uni.navigateBack(); } catch (e) {} return; } 
            uni.showModal({
                title: '保存草稿',
                content: '检测到你有未完成的内容，是否保存为草稿？',
                confirmText: '保存',
                cancelText: '不保存',
                success: (res) => {
                    if (res.confirm) {
                        try {
                            const p = this.saveDraft && this.saveDraft();
                            if (p && typeof p.finally === 'function') {
                                p.finally(() => { try { uni.navigateBack(); } catch (e) {} });
                            } else {
                                setTimeout(() => { try { uni.navigateBack(); } catch (e) {} }, 500);
                            }
                        } catch (_) { try { uni.navigateBack(); } catch (e) {} }
                    } else {
                        try { this.clearDraft && this.clearDraft(); } catch (_) {}
                        try { uni.navigateBack(); } catch (e) {}
                    }
                }
            });
        },
        // 兼容性文件上传方法
        uploadFile(cloudPath, filePath) {
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                if (method === 'tcb') {
                    // H5和App环境：使用云函数上传，避免multipart/form-data格式问题
                    this.uploadFileViaCloudFunction(cloudPath, filePath).then(resolve).catch(reject);
                } else if (method === 'wx-cloud') {
                    // 小程序环境使用微信云开发
                    if (wx.cloud && wx.cloud.uploadFile) {
                        wx.cloud.uploadFile({
                            cloudPath: cloudPath,
                            filePath: filePath,
                            success: (res) => {
                                resolve(res);
                            },
                            fail: (err) => {
                                reject(err);
                            }
                        });
                    } else {
                        reject(new Error('微信云开发不可用'));
                    }
                } else {
                    reject(new Error(`不支持的云函数调用方式: ${method}`));
                }
            });
        },

        // 通过云函数上传文件（解决H5环境multipart/form-data问题）
        uploadFileViaCloudFunction(cloudPath, filePath, retryCount = 0) {
            return new Promise((resolve, reject) => {
                // 检查环境并使用相应的文件读取方式
                if (typeof window !== 'undefined' && typeof FileReader !== 'undefined') {
                    // H5环境：使用fetch获取blob，然后转换为base64
                    
                    fetch(filePath)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`HTTP error! status: ${response.status}`);
                            }
                            return response.blob();
                        })
                        .then(blob => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                const result = reader.result;
                                if (!result || typeof result !== 'string') {
                                    console.error('❌ [Add页面] FileReader结果无效:', result);
                                    reject(new Error('文件读取失败'));
                                    return;
                                }
                                const base64 = result.split(',')[1];
                                console.log(`🔍 [Add页面] 文件转换为base64完成，长度: ${base64.length}`);
                                // 检查base64大小，如果太大则进一步压缩
                                if (base64.length > 6 * 1024 * 1024) { // 6MB base64约等于4.5MB文件
                                    console.warn('⚠️ [Add页面] base64文件过大，尝试进一步压缩');
                                    // 可以在这里添加进一步的压缩逻辑
                                }
                                
                                this.callCloudFunction('upload', {
                                    cloudPath: cloudPath,
                                    fileContent: base64
                                }).then((uploadRes) => {
                                    console.log('上传云函数返回结果:', uploadRes);
                                    // 检查云函数返回格式并提取fileID
                                    if (uploadRes && uploadRes.result && uploadRes.result.success) {
                                        resolve({
                                            fileID: uploadRes.result.fileID,
                                            cloudPath: uploadRes.result.cloudPath
                                        });
                                    } else {
                                        reject(new Error('上传云函数返回格式错误'));
                                    }
                                }).catch((err) => {
                                    // 如果是网络错误且重试次数小于2，则重试
                                    if (retryCount < 2 && (err.errMsg === 'request:fail' || err.message?.includes('fail'))) {
                                        console.log(`🔄 [Add页面] 上传失败，准备重试 (${retryCount + 1}/2)`);
                                        setTimeout(() => {
                                            this.uploadFileViaCloudFunction(cloudPath, filePath, retryCount + 1)
                                                .then(resolve).catch(reject);
                                        }, 1000 * (retryCount + 1)); // 递增延迟
                                    } else {
                                        reject(err);
                                    }
                                });
                            };
                            reader.onerror = () => {
                                console.error('❌ [Add页面] FileReader读取失败');
                                reject(new Error('文件读取失败'));
                            };
                            reader.readAsDataURL(blob);
                        })
                        .catch(err => {
                            console.error('❌ [Add页面] 获取文件blob失败:', err);
                            reject(new Error('获取文件失败: ' + err.message));
                        });
                } else {
                    // App环境使用uni-app API
                    console.log('🔍 [Add页面] App环境使用uni-app API读取文件');
                    try {
                        const fs = uni.getFileSystemManager();
                        if (fs && fs.readFile) {
                            fs.readFile({
                                filePath: filePath,
                                encoding: 'base64',
                                success: (readRes) => {
                                    const base64 = readRes.data;
                                    console.log(`🔍 [Add页面] 文件读取完成，base64长度: ${base64.length}`);
                                    this.callCloudFunction('upload', {
                                        cloudPath: cloudPath,
                                        fileContent: base64
                                    }).then((uploadRes) => {
                                        console.log('App环境上传云函数返回结果:', uploadRes);
                                        // 检查云函数返回格式并提取fileID
                                        if (uploadRes && uploadRes.result && uploadRes.result.success) {
                                            resolve({
                                                fileID: uploadRes.result.fileID,
                                                cloudPath: uploadRes.result.cloudPath
                                            });
                                        } else {
                                            reject(new Error('上传云函数返回格式错误'));
                                        }
                                    }).catch(reject);
                                },
                                fail: (readErr) => {
                                    console.error('❌ [Add页面] 文件读取失败：', readErr);
                                    reject(new Error(`文件读取失败: ${readErr.errMsg || '未知错误'}`));
                                }
                            });
                        } else {
                            console.error('❌ [Add页面] getFileSystemManager不可用');
                            reject(new Error('文件系统API不可用'));
                        }
                    } catch (error) {
                        console.error('❌ [Add页面] 文件系统API调用失败:', error);
                        reject(new Error('文件系统API不可用'));
                    }
                }
            });
        },

        preventPageScroll: function () {
            // 尝试禁用页面滚动
            try {
                uni.pageScrollTo({
                    scrollTop: 0,
                    duration: 0
                });
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.log('preventPageScroll error:', e);
            }
        },

  
        onContentInput: function (event) {
            const { value, cursor } = event.detail;
            this.setData({
                content: value
            });
            this.checkCanPublish();
        },

        onContainerTap: function (event) {
            // 点击空白区域退出输入法，但不要立即隐藏，给textarea一点时间
            console.log('容器被点击，准备隐藏键盘');
            setTimeout(() => {
                uni.hideKeyboard();
            }, 100);
        },

        onTextareaTap: function (event) {
            // 确保输入框能正常获取焦点
            console.log('textarea被点击，应该获取焦点');
        },

        // 输入框获得焦点时触发，获取键盘高度
        onTextareaFocus: function (e) {
            console.log('textarea获得焦点，键盘高度:', e.detail.height);
            // 在开发者工具中，键盘高度可能为0，我们需要设置一个默认值
            let keyboardHeight = e.detail.height;

            // 如果键盘高度为0，可能是开发者工具的问题，设置一个合理的默认值
            if (!keyboardHeight || keyboardHeight === 0) {
                // 获取系统信息来设置合适的键盘高度
                const systemInfo = uni.getSystemInfoSync();
                console.log('系统信息:', systemInfo);
                // 根据屏幕高度设置键盘高度，通常是屏幕高度的1/3到1/2
                keyboardHeight = Math.min(systemInfo.windowHeight * 0.4, 300);
                console.log('使用默认键盘高度:', keyboardHeight);
            }
            this.setData({
                keyboardHeight: keyboardHeight
            });
        },

        // 输入框失去焦点时触发，重置键盘高度
        onTextareaBlur: function () {
            console.log('textarea失去焦点');
            this.setData({
                keyboardHeight: 0
            });
        },

  
        // 检查是否可以发布
        checkCanPublish: function () {
            const hasImages = this.imageList.length > 0;
            const hasContent = this.content && this.content.trim();
            let canPublish = hasImages || hasContent;

            // 如果是非原创诗歌，必须填写作者
            if (this.publishMode === 'poem' && !this.isOriginal) {
                const hasAuthor = this.author && this.author.trim();
                canPublish = canPublish && hasAuthor;
            }
            this.setData({
                canPublish: canPublish
            });
        },

        // 切换发布模式
        switchMode: function () {
            this.setData({
                showModeSelector: !this.showModeSelector,
                showTagSelector: false // 隐藏标签选择器
            });
        },

        // 选择发布模式
        selectPublishMode: function (e) {
            const mode = e.currentTarget.dataset.mode;
            const isOriginal = e.currentTarget.dataset.original;

            this.setData({
                publishMode: mode,
                isOriginal: isOriginal === null ? false : isOriginal,
                showModeSelector: false
            });

            // 根据模式设置图片限制
            if (mode === 'poem') {
                // 诗歌模式：最多1张图片
                this.setData({
                    maxImageCount: 1,
                    imageList: this.imageList.length > 1 ? [this.imageList[0]] : this.imageList
                });
            } else {
                // 普通帖子和讨论帖子：最多9张图片
                this.setData({
                    maxImageCount: 9
                });
            }

            this.checkCanPublish();
        },

        handleChooseImage: function () {
            const that = this;
            const remainingCount = this.maxImageCount - this.imageList.length;
            if (remainingCount <= 0) {
                uni.showToast({
                    title: '最多只能上传9张图片',
                    icon: 'none'
                });
                return;
            }

            // 设置临时隐藏标志，避免触发草稿保存
            this.setData({
                isTemporaryHide: true
            });
            uni.chooseImage({
                count: remainingCount,
                // 关键修改1：强制使用原图，把压缩控制权完全交给自己的代码
                sizeType: ['original'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    uni.showLoading({
                        title: '处理中...'
                    });

                    // 关键修改2：不再使用 res.tempFilePaths，而是使用包含size的 res.tempFiles
                    console.log('wx.chooseImage 返回的详细文件信息:', res.tempFiles);
                    const imagePromises = res.tempFiles.map((file) => {
                        // 现在 file 是一个对象，例如 {path: '...', size: 12345}
                        const tempFilePath = file.path;
                        const sizeInBytes = file.size;
                        console.log(`获取到图片 ${tempFilePath} 的原始大小:`, (sizeInBytes / 1024).toFixed(2), 'KB');
                        
                        // 检查文件大小限制（5MB）
                        if (sizeInBytes > 5 * 1024 * 1024) {
                            throw new Error(`图片文件过大 (${(sizeInBytes / 1024 / 1024).toFixed(2)}MB)，请选择小于5MB的图片`);
                        }
                        
                        const needCompression = sizeInBytes > 200000; // 降低压缩阈值从300KB到200KB
                        const imageInfo = {
                            originalPath: tempFilePath,
                            imageSize: sizeInBytes,
                            needCompression: needCompression,
                            previewUrl: tempFilePath,
                            compressedPath: tempFilePath,
                            originalUrl: '',
                            compressedUrl: ''
                        };
                        if (needCompression) {
                            // 如果需要压缩，调用返回Promise的压缩函数
                            return that.compressImage(imageInfo);
                        } else {
                            // 如果不需要压缩，直接用 Promise.resolve 包装后返回
                            return Promise.resolve(imageInfo);
                        }
                    });
                    Promise.all(imagePromises)
                        .then((newImages) => {
                            uni.hideLoading();
                            that.updateImageList(newImages);
                            that.checkCanPublish();
                        })
                        .catch((err) => {
                            uni.hideLoading();
                            console.error('图片处理失败:', err);
                            
                            // 显示更详细的错误信息
                            let errorMessage = '图片处理失败';
                            if (err.message && err.message.includes('图片文件过大')) {
                                errorMessage = err.message;
                            } else if (err.message) {
                                errorMessage = `图片处理失败: ${err.message}`;
                            }
                            
                            uni.showModal({
                                title: '错误',
                                content: errorMessage,
                                showCancel: false,
                                confirmText: '确定'
                            });
                        });
                },
                fail: (err) => {
                    console.log('选择图片取消或失败:', err);
                    // 重置临时隐藏标志
                    this.setData({
                        isTemporaryHide: false
                    });
                }
            });
        },

        compressImage: function (imageInfo) {
            return new Promise((resolve) => {
                // 检查运行环境
                const { getCurrentPlatform } = require('../../utils/platformDetector.js');
                const platform = getCurrentPlatform();
                
                if (platform === 'h5') {
                    // H5环境使用Canvas压缩
                    console.log('🔍 [Add页面] H5环境使用Canvas压缩图片');
                    this.compressImageWithCanvas(imageInfo).then(resolve).catch(() => {
                        // Canvas压缩失败，使用原图
                        console.log('Canvas压缩失败，使用原图');
                        imageInfo.compressedPath = imageInfo.originalPath;
                        imageInfo.previewUrl = imageInfo.originalPath;
                        resolve(imageInfo);
                    });
                } else {
                    // 小程序和App环境使用uni.compressImage
                    console.log('🔍 [Add页面] 小程序/App环境使用uni.compressImage');
                    uni.compressImage({
                        src: imageInfo.originalPath,
                        quality: 80,
                        success: (compressRes) => {
                            imageInfo.compressedPath = compressRes.tempFilePath;
                            imageInfo.previewUrl = compressRes.tempFilePath;
                            resolve(imageInfo);
                        },
                        fail: (err) => {
                            // 压缩失败，使用原图作为备用
                            console.log('压缩失败，使用原图:', err);
                            imageInfo.compressedPath = imageInfo.originalPath;
                            imageInfo.previewUrl = imageInfo.originalPath;
                            resolve(imageInfo);
                        }
                    });
                }
            });
        },

        // H5环境使用Canvas压缩图片
        compressImageWithCanvas: function (imageInfo) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                img.onload = () => {
                    try {
                        // 创建Canvas
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        
                        // 计算压缩后的尺寸 - 降低最大尺寸以减少文件大小
                        const maxWidth = 1200;  // 从1920降低到1200
                        const maxHeight = 1200; // 从1920降低到1200
                        let { width, height } = img;
                        
                        if (width > height) {
                            if (width > maxWidth) {
                                height = (height * maxWidth) / width;
                                width = maxWidth;
                            }
                        } else {
                            if (height > maxHeight) {
                                width = (width * maxHeight) / height;
                                height = maxHeight;
                            }
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        
                        // 绘制压缩后的图片
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // 转换为blob
                        canvas.toBlob((blob) => {
                            if (blob) {
                                const compressedUrl = URL.createObjectURL(blob);
                                imageInfo.compressedPath = compressedUrl;
                                imageInfo.previewUrl = compressedUrl;
                                console.log('✅ [Add页面] Canvas压缩成功，新尺寸:', width, 'x', height);
                                resolve(imageInfo);
                            } else {
                                reject(new Error('Canvas压缩失败'));
                            }
                        }, 'image/jpeg', 0.6); // 降低压缩质量从0.8到0.6
                        
                    } catch (error) {
                        console.error('Canvas压缩过程出错:', error);
                        reject(error);
                    }
                };
                
                img.onerror = () => {
                    reject(new Error('图片加载失败'));
                };
                
                img.src = imageInfo.originalPath;
            });
        },

        updateImageList: function (newImages) {
            const currentList = this.imageList;
            const updatedList = currentList.concat(newImages);
            this.setData({
                imageList: updatedList
            });
        },

        removeImage: function (e) {
            const index = e.currentTarget.dataset.index;
            const imageList = this.imageList;
            imageList.splice(index, 1);
            this.setData({
                imageList: imageList
            });
            this.checkCanPublish();
        },

        // 发布功能已移至预览页面
        submitPost: function () {
            // 直接跳转到预览页面进行发布
            this.goToPreview();
        },

        // 检查重复诗歌
        checkDuplicatePoem: function () {
            uni.showLoading({
                title: '检查中...'
            });
            this.callCloudFunction('checkDuplicatePoem', {
                title: this.title.trim(),
                author: this.author.trim(),
                isOriginal: this.isOriginal
            }).then((res) => {
                    uni.hideLoading();
                    console.log('重复检查结果:', res.result);
                    if (res.result.success) {
                        if (res.result.isDuplicate) {
                            // 发现重复，显示确认对话框
                            this.showDuplicateConfirmDialog(res.result.duplicateCount);
                        } else {
                            // 没有重复，直接发布
                            this.proceedWithPublish();
                        }
                    } else {
                        uni.showToast({
                            title: '检查失败，请重试',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('检查重复失败:', err);
                    uni.showToast({
                        title: '网络错误，请重试',
                        icon: 'none'
                    });
                });
        },

        // 显示重复确认对话框
        showDuplicateConfirmDialog: function (duplicateCount) {
            uni.showModal({
                title: '发现重复诗歌',
                content: `已有 ${duplicateCount} 篇相同的诗歌发布，是否继续发布？`,
                confirmText: '继续发布',
                cancelText: '取消发布',
                success: (res) => {
                    if (res.confirm) {
                        // 用户选择继续发布
                        this.proceedWithPublish();
                    } else {
                        // 用户选择取消发布
                        console.log('用户取消发布重复诗歌');
                    }
                }
            });
        },

        // 继续发布流程
        proceedWithPublish: function () {
            uni.showLoading({
                title: '发布中...'
            });
            if (this.imageList.length > 0) {
                this.uploadImagesAndSubmit();
            } else {
                this.submitTextOnly();
            }
        },

        uploadImagesAndSubmit: function () {
            const that = this;
            const timestamp = new Date().getTime();
            const imageList = this.imageList;
            console.log('开始上传图片:', imageList.length + '张');
            const uploadPromises = imageList.map((imageInfo, index) => {
                return new Promise((resolve, reject) => {
                    const imageTimestamp = timestamp + index;
                    const compressedCloudPath = `post_images/${imageTimestamp}_compressed.jpg`;
                    
                    // 使用兼容性上传方法
                    that.uploadFile(compressedCloudPath, imageInfo.compressedPath)
                        .then((compressedRes) => {
                            console.log('压缩图上传成功:', compressedRes);
                            console.log('压缩图fileID:', compressedRes.fileID);
                            console.log('压缩图fileID类型:', typeof compressedRes.fileID);
                            const compressedFileID = compressedRes.fileID;
                            if (imageInfo.needCompression) {
                                const originalCloudPath = `post_images/${imageTimestamp}_original.jpg`;
                                return that.uploadFile(originalCloudPath, imageInfo.originalPath)
                                    .then((originalRes) => {
                                        console.log('原图上传成功:', originalRes);
                                        console.log('原图fileID:', originalRes.fileID);
                                        console.log('原图fileID类型:', typeof originalRes.fileID);
                                        resolve({
                                            compressedUrl: compressedFileID,
                                            originalUrl: originalRes.fileID
                                        });
                                    });
                            } else {
                                resolve({
                                    compressedUrl: compressedFileID,
                                    originalUrl: compressedFileID
                                });
                            }
                        })
                        .catch(reject);
                });
            });
            Promise.all(uploadPromises)
                .then((uploadResults) => {
                    console.log('所有图片上传完成:', uploadResults);
                    return that.submitWithContentCheck(uploadResults);
                })
                .catch((err) => {
                    console.error('上传失败:', err);
                    that.publishFail(err);
                });
        },

        submitToDatabase: function (uploadResults) {
            console.log('提交到数据库:', {
                uploadResults: uploadResults,
                title: this.title,
                content: this.content,
                publishMode: this.publishMode,
                isOriginal: this.isOriginal
            });
            console.log('uploadResults详细信息:', uploadResults);
            console.log('uploadResults长度:', uploadResults.length);
            
            const imageUrls = uploadResults.map((result) => result.compressedUrl);
            const originalImageUrls = uploadResults.map((result) => result.originalUrl);
            
            console.log('处理后的图片URLs:', {
                imageUrls: imageUrls,
                originalImageUrls: originalImageUrls,
                imageUrlsType: imageUrls.map(url => typeof url),
                originalImageUrlsType: originalImageUrls.map(url => typeof url),
                imageUrlsValues: imageUrls.map(url => url ? url.substring(0, 50) + '...' : 'null/undefined')
            });

            // 确定作者信息
            let authorName = '';
            if (this.publishMode === 'poem') {
                if (this.isOriginal) {
                    // 原创诗歌：如果填写了作者就用填写的，否则使用用户昵称
                    const userInfo = uni.getStorageSync('userInfo');
                    const userNickName = userInfo ? userInfo.nickName : '匿名用户';
                    authorName = this.author && this.author.trim() ? this.author.trim() : userNickName;
                } else {
                    // 非原创诗歌：必须使用填写的作者
                    authorName = this.author && this.author.trim() ? this.author.trim() : '';
                }
            }
            
            // 准备提交数据
            const postData = {
                title: this.title,
                content: this.content,
                createTime: new Date(),
                votes: 0,
                // 新增诗歌相关字段
                isPoem: this.publishMode === 'poem',
                isOriginal: this.isOriginal,
                // 新增作者字段
                author: authorName,
                // 新增标签字段
                tags: this.selectedTags || [],
                backgroundColor: this.selectedBackgroundColor || '',
                highlightSentence: this.highlightSentence || ''
            };
            
            if (imageUrls.length > 0) {
                postData.imageUrl = imageUrls[0];
                postData.imageUrls = imageUrls;
                postData.originalImageUrl = originalImageUrls[0];
                postData.originalImageUrls = originalImageUrls;

                // 如果是诗歌模式，第一张图片作为背景图
                if (this.publishMode === 'poem' && imageUrls.length > 0) {
                    postData.poemBgImage = imageUrls[0];
                }
            }
            
            // 使用contentCheck云函数提交数据（现在已禁用审核，直接创建帖子）
            const fileIDs = imageUrls.filter(url => url); // 过滤掉null值
            const originalFileIDs = originalImageUrls.filter(url => url); // 过滤掉null值
            
            console.log('传递给云函数的参数:', {
                fileIDs: fileIDs,
                originalFileIDs: originalFileIDs,
                fileIDsLength: fileIDs.length,
                originalFileIDsLength: originalFileIDs.length
            });
            
            const auditParams = {
                title: this.title,
                content: this.content,
                fileIDs: fileIDs,
                originalFileIDs: originalFileIDs, // 添加原图URL数组
                publishMode: this.publishMode,
                isOriginal: this.isOriginal,
                author: this.author,
                tags: this.selectedTags || [],
                isDiscussion: this.isDiscussion || false,
                parentPostId: this.parentPostId || '',
            };
            
            return this.callCloudFunction('contentCheck', auditParams).then((res) => {
                console.log('数据库提交成功:', res);
                // 检查云函数返回的结果格式
                if (res && res.result && res.result.code === 0) {
                    // 云函数返回成功
                    this.publishSuccess({
                        _id: res.result.postId
                    });
                } else {
                    // 云函数返回失败
                    console.error('云函数返回失败:', res);
                    this.publishFail(new Error(res.result?.msg || '云函数返回失败'));
                }
            }).catch((err) => {
                console.error('数据库提交失败:', err);
                this.publishFail(err);
            });
        },

        submitTextOnly: function () {
            this.submitWithContentCheck([]);
        },

        // 新增：带内容审核的提交函数
        submitWithContentCheck: function (uploadResults) {
            const that = this;
            console.log('开始内容审核和提交:', {
                uploadResults: uploadResults,
                title: this.title,
                content: this.content,
                publishMode: this.publishMode,
                isOriginal: this.isOriginal,
                author: this.author,
                tags: this.selectedTags
            });

            // TODO: 暂时关闭内容审核，腾讯云内容审核服务未续费
            // 未来续费后可以重新启用以下代码
            console.log('⚠️ 内容审核已暂时关闭，直接发布内容');
            
            // 直接发布，跳过审核
            return that.submitToDatabase(uploadResults);

            /* 
            // 以下是原来的内容审核逻辑，暂时注释掉，未来续费后可以重新启用
            // 准备审核参数
            const fileIDs = uploadResults.map((result) => result.compressedUrl);
            const auditParams = {
                title: this.title,
                content: this.content,
                fileIDs: fileIDs,
                publishMode: this.publishMode,
                isOriginal: this.isOriginal,
                author: this.author,
                tags: this.selectedTags || []
            };

            // 调用内容审核云函数
            that.callCloudFunction('contentCheck', auditParams)
                .then((res) => {
                    console.log('内容审核结果:', res);
                    if (res.result.code === 0) {
                        // 审核通过，发布成功
                        that.publishSuccess({
                            _id: res.result.postId
                        });
                    } else {
                        // 审核不通过，显示错误信息
                        uni.hideLoading();
                        uni.showModal({
                            title: '发布失败',
                            content: res.result.msg || '内容审核不通过，请检查内容后重试',
                            showCancel: false
                        });
                    }
                })
                .catch((err) => {
                    console.error('内容审核失败:', err);
                    that.publishFail(err);
                });
            */
        },

        publishSuccess: function (res) {
            uni.hideLoading();
            uni.showToast({
                title: '发布成功！'
            });
            // 新增：设置各页面需要刷新标记
            try {
                uni.setStorageSync('shouldRefreshIndex', true);
                uni.setStorageSync('shouldRefreshProfile', true);
                uni.setStorageSync('shouldRefreshPoem', true);
                uni.setStorageSync('shouldRefreshMountain', true);
                const appInstance = getApp();
                const userId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                try { const { emitPostCreated } = require('@/utils/events.js'); emitPostCreated(userId); } catch (e) { if (userId && uni.$emit) { uni.$emit('post-created', { userId }); } }
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
            }
            // 设置发布成功标记，避免后续检查草稿
            this.setData({
                isPublished: true
            });
            // 发布成功后清除草稿
            this.clearDraft();
            uni.navigateBack({
                delta: 1
            });
        },

        publishFail: function (err) {
            uni.hideLoading();
            console.error('[发布流程] 失败：', err);
            
            // 显示更详细的错误信息
            let errorMessage = '发布失败';
            if (err && err.message) {
                errorMessage = `发布失败: ${err.message}`;
            } else if (err && err.errMsg) {
                errorMessage = `发布失败: ${err.errMsg}`;
            }
            
            uni.showModal({
                title: '发布失败',
                content: errorMessage,
                showCancel: false,
                confirmText: '确定'
            });
        },

        // 新增：图片加载失败反馈
        onImageError: function (e) {
            uni.showToast({
                title: '图片加载失败',
                icon: 'none'
            });
            console.error('图片加载失败', e);
        },

        // 标签相关功能
        toggleTagSelector: function () {
            this.setData({
                showTagSelector: !this.showTagSelector
            });
        },

        // 去预览：把当前编辑内容带到预览页，仅展示不提交
        goToPreview: function () {
            const previewPost = {
                _id: 'preview-temp-id',
                content: this.content || '',
                title: '', // 标题将在预览页面输入
                textColor: '#000000',
                backgroundColor: this.selectedBackgroundColor || '#ffffff',
                isExpanded: true,
                likeIcon: '/static/images/seed.png',
                imageUrls: (this.imageList || []).map(i => i.previewUrl),
                highlightLines: this.highlightLines || [],
                // 传递当前编辑的数据供预览页面使用
                editData: {
                    selectedBackgroundColor: this.selectedBackgroundColor,
                    imageList: this.imageList,
                    publishMode: this.publishMode,
                    isOriginal: this.isOriginal,
                    selectedTags: this.selectedTags,
                    author: this.author,
                    highlightLines: this.highlightLines,
                    highlightSelectedLineIndices: this.highlightSelectedLineIndices
                }
            };

            // 调试：输出预览数据
            console.log('【Add】准备跳转到预览，数据:', previewPost);
            console.log('【Add】publishMode:', this.publishMode);
            console.log('【Add】editData.publishMode:', previewPost.editData.publishMode);

            try { uni.setStorageSync('preview_post', previewPost); } catch (e) {}

            uni.navigateTo({
                url: '/pages/preview/preview',
                success: (res) => {
                    try { res.eventChannel.emit('preview-data', { post: previewPost }); } catch (e) {}
                }
            });
        },

        // 占位：选择颜色
        onSelectColor: function () {
            this.setData({ showColorPicker: !this.showColorPicker });
        },

        // 占位：高光开关（保留原来的弹窗模式作为备用）
        onToggleHighlight: function () {
            this.setData({ highlightSelecting: !this.highlightSelecting });
            if (this.highlightSelecting) {
                uni.showToast({ title: '点击要高亮的行', icon: 'none' });
            }
        },

        // 新的覆盖层相关方法
        toggleHighlightMode: function () {
            this.setData({
                highlightModeEnabled: !this.highlightModeEnabled,
                showHighlightHint: !this.highlightModeEnabled
            });
            if (this.highlightModeEnabled) {
                // 显示提示3秒后自动隐藏
                setTimeout(() => {
                    this.setData({ showHighlightHint: false });
                }, 3000);
            }
        },

        hideHighlightHint: function () {
            this.setData({ showHighlightHint: false });
        },

        // textarea滚动事件
        onTextareaScroll: function (e) {
            this.setData({
                textareaScrollTop: e.detail.scrollTop,
                overlayScrollTop: e.detail.scrollTop
            });
        },

        // 覆盖层触摸事件
        onOverlayTouchStart: function (e) {
            // 阻止事件冒泡，避免触发textarea的焦点
            e.preventDefault();
        },

        onOverlayTouchEnd: function (e) {
            e.preventDefault();
        },

        onOverlayTouchMove: function (e) {
            e.preventDefault();
        },

        // 行触摸事件
        onLineTouchStart: function (e) {
            e.preventDefault();
            e.stopPropagation();

            const index = Number(e.currentTarget.dataset.index);
            this.touchStartLine = index;

            // 清除之前的定时器
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
            }

            // 设置长按定时器（500ms）
            this.longPressTimer = setTimeout(() => {
                this.toggleLineHighlight(index);
                // 触觉反馈（如果支持）
                try {
                    uni.vibrateShort();
                } catch (e) {}
            }, 500);
        },

        onLineTouchEnd: function (e) {
            e.preventDefault();
            e.stopPropagation();

            // 清除长按定时器
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }

            this.touchStartLine = null;
        },

        // 切换行高亮
        toggleLineHighlight: function (lineIndex) {
            const arr = this.highlightSelectedLineIndices.slice();
            const pos = arr.indexOf(lineIndex);

            if (pos >= 0) {
                // 取消选中
                arr.splice(pos, 1);
            } else {
                // 检查是否超过限制
                if (arr.length >= 3) {
                    uni.showToast({
                        title: '最多只能选择三行高光',
                        icon: 'none'
                    });
                    return;
                }
                // 添加选中
                arr.push(lineIndex);
            }

            arr.sort((a, b) => a - b);
            this.setData({ highlightSelectedLineIndices: arr });

            // 更新高光行数据
            this.updateHighlightLines();
        },

        // 更新高光行数据
        updateHighlightLines: function () {
            const lines = (this.content || '').split(/\r?\n/);
            const picked = this.highlightSelectedLineIndices.map(i => lines[i] || '').filter(Boolean);
            this.setData({
                highlightLines: picked,
                highlightSentence: picked[0] || ''
            });
        },

        // 切换单行高亮（旧的方法，保留用于弹窗模式）
        toggleHighlightLine: function (e) {
            const idx = Number(e.currentTarget.dataset.index);
            const arr = this.highlightSelectedLineIndices.slice();
            const pos = arr.indexOf(idx);
            if (pos >= 0) {
                arr.splice(pos, 1);
            } else {
                // 限制最多选择三行
                if (arr.length >= 3) {
                    uni.showToast({
                        title: '最多只能选择三行高光',
                        icon: 'none'
                    });
                    return;
                }
                arr.push(idx);
            }
            arr.sort((a,b) => a - b);
            this.setData({ highlightSelectedLineIndices: arr });
        },

        // 完成选择，生成高光行数组
        finishHighlight: function () {
            const lines = (this.content || '').split(/\r?\n/);
            const picked = this.highlightSelectedLineIndices.map(i => lines[i] || '').filter(Boolean);
            this.setData({ highlightLines: picked, highlightSentence: picked[0] || '', highlightSelecting: false });
            uni.showToast({ title: '已设置高光', icon: 'success' });
        },

        // 清除选择
        clearHighlight: function () {
            this.setData({ highlightSelectedLineIndices: [], highlightLines: [], highlightSentence: '' });
        },

        // 选择颜色
        chooseColor: function (e) {
            const color = e.currentTarget.dataset.color;
            this.setData({ selectedBackgroundColor: color, showColorPicker: false });
            uni.showToast({ title: '已设置颜色', icon: 'success' });
        },

        noop() {},

        selectTag: function (e) {
            const tag = e.currentTarget.dataset.tag;
            const selectedTags = this.selectedTags;
            if (selectedTags.includes(tag)) {
                // 如果已选中，则取消选择
                const index = selectedTags.indexOf(tag);
                selectedTags.splice(index, 1);
            } else {
                // 如果未选中且未超过限制，则添加
                if (selectedTags.length < 5) {
                    selectedTags.push(tag);
                } else {
                    uni.showToast({
                        title: '最多选择5个标签',
                        icon: 'none'
                    });
                    return;
                }
            }
            this.setData({
                selectedTags: selectedTags
            });
        },

        onCustomTagInput: function (e) {
            const inputValue = e.detail.value;
            console.log('【标签输入】用户输入:', inputValue);
            this.setData({ customTag: inputValue });
            // 实时搜索匹配标签
            this.searchMatchingTags(inputValue);
        },

        addCustomTag: function () {
            const tag = this.customTag && this.customTag.trim();
            if (!tag) {
                uni.showToast({
                    title: '请输入标签内容',
                    icon: 'none'
                });
                return;
            }
            if (this.selectedTags.includes(tag)) {
                uni.showToast({
                    title: '标签已存在',
                    icon: 'none'
                });
                return;
            }
            if (this.selectedTags.length >= 5) {
                uni.showToast({
                    title: '最多选择5个标签',
                    icon: 'none'
                });
                return;
            }
            this.selectedTags.push(tag);
            this.setData({
                selectedTags: this.selectedTags,
                customTag: '',
                showMatchedTags: false,
                matchedTags: []
            });
        },

        // 保存草稿
        saveDraft: function () {
            return new Promise((resolve) => {
                const draftData = {
                    title: this.title,
                    content: this.content,
                    imageList: this.imageList,
                    publishMode: this.publishMode,
                    isOriginal: this.isOriginal,
                    selectedTags: this.selectedTags,
                    customTag: this.customTag,
                    author: this.author,
                    saveTime: new Date()
                };
                uni.showLoading({ title: "保存中..." });
                this.callCloudFunction("getMyProfileData", {
                    action: "saveDraft",
                    draftData: draftData
                }).then((res) => {
                    uni.hideLoading();
                    if (res.result && res.result.success) {
                        uni.showToast({ title: "草稿已保存", icon: "success" });
                        this.clearDraft();
                        resolve(true);
                    } else {
                        console.error("保存草稿失败:", res.result);
                        uni.showToast({ title: (res.result && res.result.message) ? res.result.message : "保存草稿失败", icon: "none" });
                        resolve(false);
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error("保存草稿失败:", err);
                    uni.showToast({ title: "网络错误，保存失败", icon: "none" });
                    resolve(false);
                });
            });
        },

        removeTag: function (e) {
            const tag = e.currentTarget.dataset.tag;
            const selectedTags = this.selectedTags.filter((t) => t !== tag);
            this.setData({
                selectedTags: selectedTags
            });
        },

        // 加载草稿
        loadDraft: function () {
            try {
                const draftData = uni.getStorageSync('publish_draft');
                if (draftData && draftData.saveTime) {
                    // 检查草稿是否过期（7天）
                    const now = new Date().getTime();
                    const draftAge = now - draftData.saveTime;
                    const sevenDays = 10080 * 60 * 1000;
                    if (draftAge < sevenDays) {
                        uni.showModal({
                            title: '恢复草稿',
                            content: '检测到您有未完成的草稿，是否恢复？',
                            confirmText: '恢复',
                            cancelText: '重新开始',
                            success: (res) => {
                                if (res.confirm) {
                                    this.setData({
                                        title: draftData.title || '',
                                        content: draftData.content || '',
                                        imageList: draftData.imageList || [],
                                        publishMode: draftData.publishMode || 'normal',
                                        isOriginal: draftData.isOriginal || false,
                                        selectedTags: draftData.selectedTags || [],
                                        customTag: draftData.customTag || '',
                                        author: draftData.author || '',
                                        maxImageCount: draftData.publishMode === 'poem' ? 1 : 9
                                    });
                                    this.checkCanPublish();
                                    uni.showToast({
                                        title: '草稿已恢复',
                                        icon: 'success'
                                    });
                                } else {
                                    this.clearDraft();
                                }
                            }
                        });
                    } else {
                        // 草稿过期，自动清除
                        this.clearDraft();
                    }
                }
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.error('加载草稿失败:', e);
            }
        },

        // 加载编辑中的草稿
        loadEditingDraft: function () {
            try {
                const draftData = uni.getStorageSync('editing_draft');
                if (draftData) {
                    this.setData({
                        title: draftData.title || '',
                        content: draftData.content || '',
                        imageList: draftData.imageList || [],
                        publishMode: draftData.publishMode || 'normal',
                        isOriginal: draftData.isOriginal || false,
                        selectedTags: draftData.selectedTags || [],
                        customTag: draftData.customTag || '',
                        author: draftData.author || '',
                        maxImageCount: draftData.publishMode === 'poem' ? 1 : 9
                    });
                    this.checkCanPublish();
                    uni.showToast({
                        title: '草稿已加载',
                        icon: 'success'
                    });
                    // 清除编辑草稿数据
                    uni.removeStorageSync('editing_draft');
                }
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.error('加载编辑草稿失败:', e);
                uni.showToast({
                    title: '加载草稿失败',
                    icon: 'none'
                });
            }
        },

        // 清除草稿
        clearDraft: function () {
            try {
                uni.removeStorageSync('publish_draft');
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
                console.error('清除草稿失败:', e);
            }
        }
    }
};
</script>
<style>
/* pages/add/add.wxss */
page {
    height: 100vh;
    overflow: hidden; /* 页面级别禁止滚动 */
}

.container {
    background: #fff;
    height: 100vh; /* 改为固定高度，确保在iOS下正确计算 */
    display: flex;
    flex-direction: column;
    padding-right: 100rpx; /* reserve space for side toolbar */
    box-sizing: border-box; /* 确保padding计算在内 */
    overflow: hidden; /* 防止整个页面滚动 */
    position: relative; /* 确保定位上下文 */
}


/* 图片预览区域 */
.image-section {
    padding: 30rpx;
    background: #f8f9fa;
}

.image-preview-scroll {
    width: 100%;
    white-space: nowrap;
}

.image-preview-container {
    display: flex;
    gap: 20rpx;
    padding: 0 10rpx;
}

.image-preview-item {
    position: relative;
    width: 200rpx;
    height: 200rpx;
    border-radius: 12rpx;
    overflow: hidden;
    flex-shrink: 0;
}

.preview-image {
    width: 100%;
    height: 100%;
    border-radius: 12rpx;
}

.image-remove-btn {
    position: absolute;
    top: -8rpx;
    right: -8rpx;
    width: 40rpx;
    height: 40rpx;
    background: #ff4444;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24rpx;
    font-weight: bold;
    box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.2);
}

.add-image-btn {
    width: 200rpx;
    height: 200rpx;
    border: 2rpx dashed #ddd;
    border-radius: 12rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    transition: all 0.3s ease;
    flex-shrink: 0;
}

.add-image-btn:active {
    background: #f5f5f5;
    border-color: #9ed7ee;
}

.add-icon {
    font-size: 60rpx;
    color: #999;
}

/* 内容输入区域 */
.content-section {
    padding: 30rpx;
    padding-bottom: 30rpx; /* 进一步减少底部间距，让输入框更接近底部工具栏 */
    background: #fff;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* 关键：允许flex子元素收缩 */
    overflow: hidden; /* 防止内容溢出 */
    position: relative; /* 确保定位上下文 */
}

.content-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-bottom: 0rpx; /* 最小化底部间距，让输入框更接近底边栏 */
    min-height: 0; /* 关键：允许flex子元素收缩 */
    overflow: hidden; /* 防止内容溢出 */
}

.content-textarea {
    flex: 1;
    width: 100%;
    height: 100%; /* 固定高度，填充父容器 */
    border: none;
    font-size: 30rpx;
    line-height: 1.6;
    padding: 24rpx;
    background: #f8f9fa;
    resize: none;
    overflow-y: auto; /* 允许垂直滚动 */
    overflow-x: hidden; /* 禁止水平滚动 */
    -webkit-appearance: none;
    appearance: none;
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    /* 确保在iOS上正确显示 */
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
    /* 防止iOS上的默认样式干扰 */
    border-radius: 12rpx;
    outline: none;
    /* 确保滚动行为 */
    -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
    position: relative; /* 确保定位上下文 */
}

/* 当高光模式启用时，隐藏textarea的文字内容 */
.content-input-wrapper[data-highlight-mode="true"] .content-textarea {
    color: transparent;
}

.char-count {
    position: absolute;
    bottom: 10rpx; /* 移到textarea外面，给文字留出空间 */
    right: 110rpx; /* leave space for side toolbar */
    font-size: 24rpx;
    color: #666;
    background: #fdfdfd;
    padding: 8rpx 12rpx;
    border-radius: 6rpx;
    box-shadow: none;
    pointer-events: none; /* 防止遮挡textarea的点击 */
}


/* 模式选择器 */
.mode-selector {
    position: fixed;
    bottom: 120rpx;
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    border-radius: 16rpx;
    padding: 24rpx;
    z-index: 99;
    box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.15);
    animation: slideUp 0.3s ease;
    border: 1rpx solid #f0f0f0;
    margin-left: -98rpx; /* 向左偏移，对齐模按钮 */
    min-width: 320rpx;
}

.mode-title {
    text-align: center;
    font-size: 28rpx;
    font-weight: 500;
    color: #333;
    margin-bottom: 20rpx;
    padding-bottom: 16rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.mode-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16rpx;
}

.mode-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20rpx 16rpx;
    border-radius: 12rpx;
    background: #f8f9fa;
    transition: all 0.3s ease;
    border: 1rpx solid transparent;
}

.mode-item:active {
    transform: scale(0.95);
    background: #e9ecef;
}

.mode-item:hover {
    border-color: #9ed7ee;
    background: #f0f8ff;
}

.mode-icon {
    font-size: 36rpx;
    margin-bottom: 8rpx;
}

.mode-text {
    font-size: 24rpx;
    color: #666;
    text-align: center;
    line-height: 1.2;
}

@keyframes slideUp {
    from {
        transform: translateX(-50%) translateY(100%);
        opacity: 0;
    }
    to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
}


/* 标签选择区域样式 */
.tag-section {
    position: fixed; /* 确保标签选择器是基于窗口定位的 */
    bottom: 120rpx; /* 初始位置在工具栏上方 */
    left: 0;
    right: 100rpx; /* 为右侧工具栏预留空间 */
    background: #f8f9fa;
    border-radius: 12rpx;
    padding: 20rpx;
    z-index: 90; /* z-index 比工具栏低，但比内容高 */
    transition: bottom 0.3s ease-out; /* 为位置变化添加过渡 */
}

.tag-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10rpx 0;
    border-bottom: 1px solid #eee;
    margin-bottom: 20rpx;
}

.tag-title {
    font-size: 30rpx;
    font-weight: bold;
    color: #333;
}

.tag-count {
    font-size: 24rpx;
    color: #999;
}

.tag-toggle {
    font-size: 26rpx;
    color: #9ed7ee;
}

.selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
    margin-bottom: 20rpx;
}

.selected-tag {
    display: flex;
    align-items: center;
    background: #9ed7ee;
    color: white;
    padding: 8rpx 16rpx;
    border-radius: 20rpx;
    font-size: 24rpx;
}

.remove-tag {
    margin-left: 8rpx;
    font-size: 20rpx;
    font-weight: bold;
    cursor: pointer;
}

.tag-selector {
    animation: slideDown 0.3s ease;
}

/* 分类选择器样式 */
.category-selector {
    margin-bottom: 20rpx;
    border-bottom: 1px solid #eee;
    padding-bottom: 15rpx;
}

.category-scroll {
    width: 100%;
    white-space: nowrap;
}

.category-list {
    display: flex;
    gap: 15rpx;
    padding: 0 10rpx;
}

.category-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10rpx 15rpx;
    border-radius: 12rpx;
    background: #f5f5f5;
    transition: all 0.3s ease;
    min-width: 80rpx;
    flex-shrink: 0;
}

.category-item.active {
    background: #9ed7ee;
    color: white;
}

.category-icon {
    font-size: 24rpx;
    margin-bottom: 5rpx;
}

.category-name {
    font-size: 20rpx;
    text-align: center;
    line-height: 1.2;
}

/* 当前分类标签样式 */
.current-category-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10rpx;
    margin-bottom: 20rpx;
}

.preset-tag {
    padding: 8rpx 16rpx;
    background: white;
    border: 1px solid #ddd;
    border-radius: 20rpx;
    font-size: 24rpx;
    color: #666;
    transition: all 0.3s ease;
}

.preset-tag.selected {
    background: #9ed7ee;
    color: white;
    border-color: #9ed7ee;
}

.custom-tag-input {
    display: flex;
    align-items: center;
    gap: 10rpx;
}

.custom-tag-input input {
    flex: 1;
    height: 60rpx;
    border: 1px solid #ddd;
    border-radius: 8rpx;
    padding: 0 15rpx;
    font-size: 26rpx;
}

.custom-tag-input button {
    background: #9ed7ee;
    color: white;
    border: none;
    border-radius: 8rpx;
    padding: 0 20rpx;
    height: 60rpx;
    font-size: 24rpx;
}

/* 匹配标签推荐样式 */
.matched-tags {
    margin-top: 15rpx;
    padding: 15rpx;
    background: #f8f9fa;
    border-radius: 8rpx;
    border: 1px solid #e9ecef;
}

.matched-tags-title {
    font-size: 24rpx;
    color: #666;
    margin-bottom: 10rpx;
}

.matched-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;
}

.matched-tag {
    background: #e3f2fd;
    color: #1976d2;
    padding: 6rpx 12rpx;
    border-radius: 12rpx;
    font-size: 22rpx;
    border: 1px solid #bbdefb;
    transition: all 0.2s ease;
}

.matched-tag:active {
    background: #bbdefb;
    transform: scale(0.95);
}

@keyframes slideDown {
    from {
        opacity: 0;
        transform: translateY(-10rpx);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* ====== 新增：右侧工具栏样式 ====== */
.side-toolbar {
    position: fixed;
    top: 120rpx;
    right: 0;
    bottom: 120rpx;
    width: 100rpx;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 22rpx;
    z-index: 10;
    padding: 40rpx 0 8rpx 0;
    background: #fff;
    border-left: 1rpx solid #f0f0f0;
}

.side-tool-btn {
    width: 72rpx;
    height: 72rpx;
    border-radius: 12rpx;
    border: 1rpx solid #e5e5e5;
    background: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2rpx 8rpx rgba(0,0,0,.04);
}

.side-tool-btn:active { transform: scale(0.96); }

.side-tool-icon { font-size: 24rpx; color: #333; }

/* 让正文为右侧工具栏预留空间及计数避让 */
.content-input-wrapper { padding-right: 20rpx; }
.char-count { right: 130rpx; }

/* 颜色选择弹层 */
.color-picker-mask { position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0,0,0,.35); z-index: 130; display: flex; align-items: flex-end; }
.color-picker { width: 100%; background: #fff; border-top-left-radius: 24rpx; border-top-right-radius: 24rpx; padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom)); }
.color-grid { display: grid; grid-template-columns: repeat(4, 1fr); grid-gap: 24rpx; }
.color-swatch { height: 88rpx; border-radius: 16rpx; position: relative; box-shadow: 0 4rpx 12rpx rgba(0,0,0,.08); }
.color-check { position: absolute; right: 12rpx; top: 8rpx; color: #fff; font-size: 28rpx; text-shadow: 0 1rpx 2rpx rgba(0,0,0,.3); }
.color-tip { margin-top: 14rpx; color: #999; font-size: 24rpx; text-align: center; }

/* 高光选择 - 全屏覆盖样式 */
.highlight-overlay { position: fixed; left: 0; right: 0; top: 0; bottom: 0; background: rgba(0,0,0,.6); z-index: 1000; display: flex; align-items: stretch; justify-content: stretch; }
.hl-panel { background: #fff; width: 100%; height: 100%; display: flex; flex-direction: column; }
.hl-header { display: flex; align-items: center; justify-content: space-between; padding: 20rpx 28rpx; border-bottom: 1rpx solid #eee; position: sticky; top: 0; background: #fff; z-index: 1; }
.hl-title { font-size: 30rpx; color: #333; }
.highlight-scroll { flex: 1; padding: 16rpx 24rpx 40rpx; }
.hl-line { padding: 14rpx 18rpx; border-radius: 10rpx; margin: 8rpx 0; background: #f6f7f9; }
.hl-line.selected { font-weight: 700; background: #e8f2ff; }
.hl-text { white-space: pre-wrap; word-break: break-word; font-size: 30rpx; color: #333; }
.hl-done { background: #1c9bd6; color: #fff; padding: 0 20rpx; }
.hl-clear { background: #eee; color: #333; padding: 0 20rpx; }

/* 高光选择覆盖层样式 */
.highlight-overlay {
    border: none;
}

.hl-done {
    background: #9ed7ee;
    color: #fff;
}

.hl-clear {
    background: #666;
    color: #fff;
}

/* 新的覆盖层样式 */
.highlight-select-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
    pointer-events: auto;
}

.overlay-scroll {
    height: 100%;
    width: 100%;
}

.overlay-content {
    padding: 24rpx;
    font-size: 30rpx;
    line-height: 1.6;
    color: transparent; /* 透明文字，只用于布局 */
}

.overlay-line {
    min-height: 48rpx;
    margin: 0;
    position: relative;
    transition: background-color 0.2s ease;
}

.overlay-line.highlighted {
    background-color: rgba(158, 215, 238, 0.2);
    border-radius: 8rpx;
}

.overlay-line-content {
    color: #666; /* 半透明颜色，让用户能看到下面的文字 */
    white-space: pre-wrap;
    word-break: break-word;
    font-family: inherit;
}

/* 高光选择提示 */
.highlight-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20rpx 30rpx;
    border-radius: 12rpx;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.hint-text {
    font-size: 28rpx;
}

.hint-close {
    width: 40rpx;
    height: 40rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 32rpx;
    opacity: 0.7;
    touch-action: none;
}

/* 调整textarea的z-index，确保在覆盖层下方 */
.content-textarea {
    z-index: 0;
}

/* 当高光模式启用时，textarea的样式调整 */
.content-input-wrapper {
    position: relative;
}

</style>







