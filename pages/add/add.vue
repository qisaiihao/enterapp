<template>
    <!-- pages/add/add.wxml -->
    <view class="container" @tap="onPageTap">
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
        <ColorPickerModal
            :show="showColorPicker"
            :colorPalettes="colorPalettes"
            :poemLines="poemLines"
            :selectedColorCombination="selectedColorCombination"
            @close="showColorPicker = false"
            @select="onColorSelect"
        />

        <!-- 内容输入区域 -->
        <view class="content-section">
                <!-- 主输入区域 -->
                <view class="main-input-area" @tap.stop="noop">
                    <!-- 正文输入区域 -->
                    <view class="content-input-wrapper" :data-highlight-mode="highlightModeEnabled">
                        <textarea
                            class="content-textarea"
                            :placeholder="currentPlaceholder"
                            @input="onContentInput"
                            @tap.stop="onTextareaTap"
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
                                      :style="'top: ' + (i * 48) + 'rpx;'"
                                      :data-index="i"
                                      @touchstart="onLineTouchStart"
                                      @touchend="onLineTouchEnd">
                                    <view class="overlay-line-content">{{ line || ' ' }}</view>
                                </view>
                            </view>
                        </scroll-view>
                    </view>

                    <!-- 高光选择提示 -->
                    <view v-if="showHighlightHint" class="highlight-hint">
                        <text class="hint-text">点击文字即可选择高光行</text>
                    </view>

                    <!-- 高光选择全屏弹窗 -->
                    <HighlightSelectorModal
                        :show="highlightSelecting"
                        :contentLines="splitContentLines"
                        :selectedLineIndices="highlightSelectedLineIndices"
                        @close="highlightSelecting = false"
                        @update="onHighlightUpdate"
                        @confirm="onHighlightConfirm"
                    />
                </view>

                <!-- 右侧工具栏 -->
                <view class="side-toolbar">
                    <!-- 加标签按钮 -->
                    <view class="side-tool-btn" @tap.stop="toggleTagSelector">
                        <image class="side-tool-icon" src="/static/images/newicons/tag.png" mode="aspectFit"></image>
                    </view>
                    
                    <!-- 配图按钮 -->
                    <view class="side-tool-btn" @tap.stop="handleChooseImage">
                        <image class="side-tool-icon" src="/static/images/newicons/image.png" mode="aspectFit"></image>
                    </view>
                    
                    <!-- 切换发布模式按钮 -->
                    <view class="side-tool-btn mode-switch-btn" @tap.stop="switchMode">
                        <image class="side-tool-icon mode-switch-icon" src="/static/images/newicons/switch_publish.png" mode="aspectFit" alt="切换发布模式"></image>
                    </view>
                    
                    <!-- 选择高光句按钮（仅诗歌模式显示） -->
                    <view v-if="publishMode === 'poem'" class="side-tool-btn" @tap.stop="toggleHighlightMode">
                        <image class="side-tool-icon" src="/static/images/newicons/highlight.png" mode="aspectFit"></image>
                    </view>
                    
                    <!-- 选择颜色按钮 -->
                    <view class="side-tool-btn" @tap.stop="onSelectColor">
                        <image class="side-tool-icon" src="/static/images/select_color.png" mode="aspectFit"></image>
                    </view>
                </view>
            </view>

            <!-- 左下角返回按钮 -->
            <view class="back-btn" @tap.stop="goBack">
                <image class="back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
            </view>

            <!-- 右下角浮动操作按钮 -->
            <view class="floating-action-btn" @tap.stop="goToPreview">
                <image class="fab-icon" src="/static/images/enter_key.png" mode="aspectFit"></image>
            </view>
        </view>

        <!-- 模式选择器 -->
        <ModeSelectorModal
            :show="showModeSelector"
            :publishMode="publishMode"
            :isOriginal="isOriginal"
            @close="showModeSelector = false"
            @select="onModeSelect"
        />

        <!-- 标签选择器 -->
        <TagSelectorModal
            :show="showTagSelector"
            :tagCategories="tagCategories"
            :selectedTags="selectedTags"
            :allExistingTags="allExistingTags"
            @close="showTagSelector = false"
            @update="onTagsUpdate"
        />
    </view>
    <!-- 这个 </view> 是用来闭合最外层的 <view class="container"> 的 -->
</template>

<script>
// pages/add/add.js
// 修复：移除全局数据库实例，改为在方法中动态获取
const { cloudCall } = require('../../utils/cloudCall.js');
const { readFileAsBase64 } = require('../../utils/fileReader.js');

// 导入重构后的API和工具函数
const { getAllTags } = require('../../api-cache/tags.js');
const { getPostDetail, updatePostContent } = require('../../api-cache/post.js');
const { checkDuplicatePoem, contentAudit, uploadFile, saveDraft } = require('../../api-cache/publish.js');
const { validatePublishData, canPublish, generateDraftData, generatePublishData, processUploadResults } = require('../../utils/publishUtils.js');

// 导入静态配置数据
import { colorPalettes } from '../../utils/colorPalettes.js';
import { tagCategories } from '../../utils/tagCategories.js';
import { poemLines } from '../../utils/poemLines.js';

// 导入拆分的组件
import ModeSelectorModal from '../../components/ModeSelectorModal.vue';
import ColorPickerModal from '../../components/ColorPickerModal.vue';
import TagSelectorModal from '../../components/TagSelectorModal.vue';
import HighlightSelectorModal from '../../components/HighlightSelectorModal.vue';

export default {
    components: {
        ModeSelectorModal,
        ColorPickerModal,
        TagSelectorModal,
        HighlightSelectorModal
    },
    data() {
        return {
            content: '',
            title: '', // 标题（在预览页面编辑）
            // 选择颜色
            selectedBackgroundColor: '#a4c4bd',
            selectedTextColor: '#333333',
            selectedColorCombination: null,
            showColorPicker: false,
            colorPickerStep: 'palette', // 'palette' 或 'colors'
            selectedPalette: null,
            
            // 诗歌句子数组（从配置文件导入）
            poemLines: poemLines,
            
            // 色卡数据（从配置文件导入）
            colorPalettes: colorPalettes,

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
            // 高光弹窗触摸相关变量
            highlightModalTouchStartX: 0,
            highlightModalTouchStartY: 0,
            highlightModalTouchCurrentX: 0,
            highlightModalTouchCurrentY: 0,
            imageList: [],

            // 图片列表，包含原图和压缩图信息
            maxImageCount: 9,

            // 最大图片数量
            publishMode: 'normal',

            // 'normal' | 'poem' | 'discussion' 普通模式 | 诗歌模式 | 讨论模式
            isOriginal: false,
            
            // 当前placeholder文字
            currentPlaceholder: '此刻你想要分享...\n分享诗歌请在右边切换发布模式',

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

            // 是否正在导航，用于防止onBackPress递归调用
            isNavigating: false,

            // 是否临时隐藏（如选择图片），用于避免触发草稿保存
            author: '',

            // 作者信息
            keyboardHeight: 0,

            // 键盘高度
            // 编辑模式相关
            isEditMode: false,
            editingPostId: '',
            editingPost: null,

            // 标签分类数据（从配置文件导入）
            tagCategories: tagCategories,

            tags: []
        };
    },
    computed: {
        splitContentLines() {
            const raw = this.content || '';
            return raw.split(/\r?\n/);
        },
        placeholderText() {
            if (this.publishMode === 'normal') {
                return '此刻你想要分享...\n分享诗歌请在右边切换发布模式';
            } else if (this.publishMode === 'poem' && this.isOriginal) {
                return '在这里写下你的原创诗歌~';
            } else if (this.publishMode === 'poem' && !this.isOriginal) {
                return '在这里分享你喜欢的诗歌~';
            } else if (this.publishMode === 'discussion') {
                return '在这里说说你想要讨论的吧~';
            }
            return '此刻你想要分享...';
        }
    },
    watch: {
        publishMode: {
            handler(newVal, oldVal) {
                this.updatePlaceholder();
            },
            immediate: true
        },
        isOriginal: {
            handler(newVal, oldVal) {
                this.updatePlaceholder();
            },
            immediate: true
        }
    },
    onLoad: function (options) {
        // 初始化颜色/高光编辑相关状态（向后兼容）
        this.setData({
            selectedBackgroundColor: this.selectedBackgroundColor || '#a4c4bd',
            selectedTextColor: this.selectedTextColor || '#333333',
            selectedColorCombination: this.selectedColorCombination || { backgroundColor: '#a4c4bd', textColor: '#333333' },
            showColorPicker: false,
            colorPickerStep: 'palette',
            selectedPalette: null,
            highlightSentence: this.highlightSentence || ''
        });
        // 页面加载时获取所有已有标签
        this.loadAllExistingTags();

        // 检查是否是编辑帖子模式（从个人主页进入）
        if (options.mode === 'edit' && options.postId) {
            this.setData({
                isEditMode: true,
                editingPostId: options.postId
            });
            this.loadPostForEdit(options.postId);
        } 
        // 检查是否是编辑草稿模式
        else if (options.mode === 'edit') {
            this.loadEditingDraft();
        } else {
            // 加载草稿
            this.loadDraft();
        }

        // 检查来源页面并设置默认发布模式（在草稿加载后执行，优先级更高）
        this.setDefaultPublishMode();

        // 确保页面不会滚动
        this.preventPageScroll();
    },
    
    onShow: function () {
        // 每次显示页面时都确保页面不会滚动
        this.preventPageScroll();
    },
    onUnload: function () {
        // 只有真正退出发布页时提示保存草稿（已发布的不提示）
        if (!this.isPublished && this.hasContent()) {
            // 在onUnload中不调用exitWithOptionalSave，避免无限递归
            // 直接清除草稿即可
            try {
                this.clearDraft && this.clearDraft();
            } catch (e) {
                console.error('清除草稿失败:', e);
            }
        }
    },
    onHide: function () {
        // 其它情况不再提示，仅重置临时隐藏标志
        this.setData({ isTemporaryHide: false });
    },
    // App/H5：拦截物理返回，优先弹出草稿提示
    onBackPress: function () {
        if (this.isNavigating) {
            return false; // 如果正在导航，允许默认返回行为
        }
        if (!this.isPublished && this.hasContent()) {
            this.exitWithOptionalSave();
            return true; // 阻止默认返回行为，因为我们会在exitWithOptionalSave中处理
        }
        return false; // 允许默认返回行为
    },
    methods: {
        // 更新placeholder文字
        updatePlaceholder() {
            let newPlaceholder = '';
            if (this.publishMode === 'normal') {
                newPlaceholder = '此刻你想要分享...\n分享诗歌请在右边切换发布模式';
            } else if (this.publishMode === 'poem' && this.isOriginal) {
                newPlaceholder = '在这里写下你的原创诗歌~';
            } else if (this.publishMode === 'poem' && !this.isOriginal) {
                newPlaceholder = '在这里分享你喜欢的诗歌~';
            } else if (this.publishMode === 'discussion') {
                newPlaceholder = '在这里说说你想要讨论的吧~';
            } else {
                newPlaceholder = '此刻你想要分享...';
            }
            
            this.setData({
                currentPlaceholder: newPlaceholder
            });
        },

        // 页面点击事件 - 点击外部区域退出键盘
        onPageTap() {
            uni.hideKeyboard();
        },

        // 空函数，用于阻止事件冒泡
        noop() {},

        // 检查是否有内容
        hasContent() {
            const hasImages = this.imageList && this.imageList.length > 0;
            const hasContent = this.content && this.content.trim();
            return hasImages || hasContent;
        },

        // 根据来源页面设置默认发布模式
        setDefaultPublishMode: function() {
            const pages = getCurrentPages();
            if (pages.length > 1) {
                const prevPage = pages[pages.length - 2];
                const prevRoute = prevPage.route;
                
                if (prevRoute === 'pages/poem-square/poem-square') {
                    // 从poem-square进入，设置为原创诗歌模式
                    this.setData({
                        publishMode: 'poem',
                        isOriginal: true,
                        maxImageCount: 1,
                        imageList: this.imageList.length > 1 ? [this.imageList[0]] : this.imageList // 限制图片数量
                    });
                } else if (prevRoute === 'pages/mountain/mountain') {
                    // 从mountain进入，设置为非原创诗歌模式
                    this.setData({
                        publishMode: 'poem',
                        isOriginal: false,
                        maxImageCount: 1,
                        imageList: this.imageList.length > 1 ? [this.imageList[0]] : this.imageList // 限制图片数量
                    });
                }
                // 从其他页面进入时，保持草稿中的设置或默认设置
            }
        },


        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'add', context: this, requireAuth: true }, extraOptions));
        },

        // 加载所有已有标签
        async loadAllExistingTags() {
            try {
                const tags = await getAllTags(this);
                this.allExistingTags = tags;
            } catch (err) {
                console.error('Failed to load all existing tags:', err);
            }
        },
        // 加载帖子数据用于编辑
        loadPostForEdit: function (postId) {
            uni.showLoading({ title: '加载中...' });
            
            this.callCloudFunction('getPostDetail', { postId: postId }, { injectOpenId: false })
                .then(async (res) => {
                    if (res.result && res.result.post) {
                        const post = res.result.post;
                        console.log('【Add】加载到的帖子数据:', post);
                        
                        // 处理图片：将fileID转换为本地预览URL
                        const imageList = [];
                        if (post.imageUrls && post.imageUrls.length > 0) {
                            try {
                                // 在转换之前保存原始的fileID（如果存在）
                                const originalImageUrls = post.imageUrls.map(url => 
                                    typeof url === 'string' && url.startsWith('cloud://') ? url : null
                                );
                                const originalOriginalImageUrls = post.originalImageUrls ? 
                                    post.originalImageUrls.map(url => 
                                        typeof url === 'string' && url.startsWith('cloud://') ? url : null
                                    ) : null;
                                
                                // 使用hydrate-temp-urls工具将fileID转换为临时URL（用于预览）
                                const { hydrateTempUrls } = require('@/_utils/hydrate-temp-urls');
                                await hydrateTempUrls([post]);
                                
                                // 将图片URL添加到imageList（编辑模式下保存原始fileID用于提交）
                                for (let i = 0; i < post.imageUrls.length; i++) {
                                    // 优先使用原始fileID，如果没有则使用转换后的URL
                                    const originalFileID = originalImageUrls[i];
                                    const originalOriginalFileID = originalOriginalImageUrls && originalOriginalImageUrls[i];
                                    
                                    imageList.push({
                                        previewUrl: post.imageUrls[i], // 用于预览的临时URL
                                        compressedPath: originalFileID || post.imageUrls[i], // 编辑模式下使用原始fileID
                                        originalPath: originalOriginalFileID || (post.originalImageUrls && post.originalImageUrls[i]) || post.imageUrls[i],
                                        needCompression: false, // 编辑模式下不需要压缩
                                        isFromEdit: true, // 标记来自编辑模式
                                        originalFileID: originalFileID, // 保存原始fileID
                                        originalOriginalFileID: originalOriginalFileID // 保存原始原图fileID
                                    });
                                }
                            } catch (err) {
                                console.error('【Add】处理图片URL失败:', err);
                            }
                        }
                        
                        // 处理高光句
                        let highlightLines = [];
                        let highlightSelectedLineIndices = [];
                        if (post.highlightLines && Array.isArray(post.highlightLines) && post.highlightLines.length > 0) {
                            highlightLines = post.highlightLines;
                            // 如果content存在，尝试找到高光行的索引
                            if (post.content) {
                                const lines = post.content.split(/\r?\n/);
                                highlightSelectedLineIndices = highlightLines.map(hl => {
                                    const index = lines.findIndex(line => line.trim() === hl.trim());
                                    return index >= 0 ? index : -1;
                                }).filter(idx => idx >= 0);
                            }
                        } else if (post.highlightSentence) {
                            // 兼容旧版本的高光句字段
                            highlightLines = [post.highlightSentence];
                            if (post.content) {
                                const lines = post.content.split(/\r?\n/);
                                const index = lines.findIndex(line => line.trim() === post.highlightSentence.trim());
                                if (index >= 0) {
                                    highlightSelectedLineIndices = [index];
                                }
                            }
                        }
                        
                        // 设置编辑数据
                        this.setData({
                            content: post.content || '',
                            title: post.title || '',
                            author: post.author || '',
                            selectedTags: post.tags || [],
                            selectedBackgroundColor: post.backgroundColor || '#a4c4bd',
                            selectedTextColor: post.textColor || '#333333',
                            selectedColorCombination: post.backgroundColor && post.textColor ? {
                                backgroundColor: post.backgroundColor,
                                textColor: post.textColor
                            } : { backgroundColor: '#a4c4bd', textColor: '#333333' },
                            highlightLines: highlightLines,
                            highlightSelectedLineIndices: highlightSelectedLineIndices,
                            highlightSentence: highlightLines[0] || '',
                            imageList: imageList,
                            publishMode: post.isPoem ? 'poem' : (post.isDiscussion ? 'discussion' : 'normal'),
                            isOriginal: post.isOriginal || false,
                            maxImageCount: post.isPoem ? 1 : 9,
                            editingPost: post
                        });
                        
                        // 更新发布模式相关的placeholder
                        this.updatePlaceholder();
                        
                        // 检查是否可以发布
                        this.checkCanPublish();
                        
                        uni.hideLoading();
                    } else {
                        uni.hideLoading();
                        uni.showToast({
                            title: '加载帖子失败',
                            icon: 'none'
                        });
                        setTimeout(() => {
                            uni.navigateBack();
                        }, 1500);
                    }
                })
                .catch((err) => {
                    console.error('【Add】加载帖子失败:', err);
                    uni.hideLoading();
                    uni.showToast({
                        title: '加载失败',
                        icon: 'none'
                    });
                    setTimeout(() => {
                        uni.navigateBack();
                    }, 1500);
                });
        },

        // 退出前提示是否保存草稿并自动返回
        exitWithOptionalSave: function () {
            if ( !this.hasContent()) { 
                this.setData({ isNavigating: true });
                try { uni.navigateBack(); } catch (e) {} 
                return; 
            } 
            uni.showModal({
                title: '保存草稿',
                content: '检测到你有未完成的内容，是否保存为草稿？',
                confirmText: '保存',
                cancelText: '不保存',
                success: (res) => {
                    this.setData({ isNavigating: true });
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
            return readFileAsBase64(filePath)
                .then((base64) => {
                    if (!base64) {
                        throw new Error('文件读取失败');
                    }
                    console.log(`?? [Add页面] 文件读取完成，base64长度: ${base64.length}`);
                    if (base64.length > 6 * 1024 * 1024) {
                        console.warn('?? [Add页面] base64文件较大，注意上传耗时');
                    }
                    return this.callCloudFunction('upload', {
                        cloudPath,
                        fileContent: base64
                    });
                })
                .then((uploadRes) => {
                    console.log('云函数返回结果:', uploadRes);
                    if (uploadRes && uploadRes.result && uploadRes.result.success) {
                        return {
                            fileID: uploadRes.result.fileID,
                            cloudPath: uploadRes.result.cloudPath
                        };
                    }
                    throw new Error('上传云函数返回格式异常');
                })
                .catch((err) => {
                    const message = (err && err.errMsg) || (err && err.message) || '';
                    const shouldRetry = retryCount < 2 && (message.includes('request:fail') || message.includes('timeout'));
                    if (shouldRetry) {
                        console.log(`?? [Add页面] 上传失败，准备重试 (${retryCount + 1}/2)`, err);
                        return new Promise((resolve, reject) => {
                            setTimeout(() => {
                                this.uploadFileViaCloudFunction(cloudPath, filePath, retryCount + 1)
                                    .then(resolve)
                                    .catch(reject);
                            }, 1000 * (retryCount + 1));
                        });
                    }
                    throw err;
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
            const publishData = {
                content: this.content,
                images: this.imageList,
                publishMode: this.publishMode,
                isOriginal: this.isOriginal,
                author: this.author
            };

            const canPublishValue = canPublish(publishData);
            this.setData({
                canPublish: canPublishValue
            });
        },

        // 切换发布模式
        switchMode: function () {
            this.setData({
                showModeSelector: !this.showModeSelector,
                showTagSelector: false // 隐藏标签选择器
            });
        },

        // 选择发布模式（组件事件处理）
        onModeSelect: function ({ mode, isOriginal }) {
            // 设置讨论模式标志
            const isDiscussion = mode === 'discussion';

            this.setData({
                publishMode: mode,
                isOriginal: isOriginal === null ? false : isOriginal,
                isDiscussion: isDiscussion,
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

            console.log('【Add】选择发布模式:', {
                mode: mode,
                isOriginal: isOriginal,
                isDiscussion: isDiscussion
            });

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
                sizeType: ['compressed'],
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
                    // 如果是编辑模式且图片来自编辑（不需要重新上传），使用原始fileID
                    if (that.isEditMode && imageInfo.isFromEdit) {
                        // 优先使用保存的原始fileID，如果没有则使用compressedPath/originalPath
                        resolve({
                            compressedUrl: imageInfo.originalFileID || imageInfo.compressedPath,
                            originalUrl: imageInfo.originalOriginalFileID || imageInfo.originalPath
                        });
                        return;
                    }
                    
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
                isOriginal: this.isOriginal,
                isEditMode: this.isEditMode
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

            // 检查编辑模式状态
            console.log('【Add】编辑模式检查:', {
                isEditMode: this.isEditMode,
                editingPostId: this.editingPostId,
                editingPost: this.editingPost,
                shouldUpdate: this.isEditMode && this.editingPostId
            });

            // 如果是编辑模式，调用更新接口
            if (this.isEditMode && this.editingPostId) {
                console.log('【Add】进入编辑模式，准备更新帖子');
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
                
                // 准备更新数据
                const updateData = {
                    title: this.title,
                    content: this.content,
                    tags: this.selectedTags || [],
                    backgroundColor: this.selectedBackgroundColor || '',
                    textColor: this.selectedTextColor || '#000000',
                    highlightSentence: this.highlightLines && this.highlightLines.length > 0 ? this.highlightLines[0] : '',
                    highlightLines: this.highlightLines || [],
                    author: authorName,
                    isAnonymous: this.editingPost && this.editingPost.isAnonymous || false,
                    anonymousAuthorName: this.editingPost && this.editingPost.anonymousAuthorName || '',
                    isDiscussion: this.publishMode === 'discussion' || false
                };
                
                // 处理图片
                if (imageUrls.length > 0) {
                    updateData.fileIDs = imageUrls;
                    updateData.originalFileIDs = originalImageUrls.length > 0 ? originalImageUrls : imageUrls;
                } else {
                    // 如果没有图片，清空图片字段
                    updateData.fileIDs = [];
                    updateData.originalFileIDs = [];
                }
                
                console.log('【Add】编辑模式：准备更新帖子，数据:', {
                    postId: this.editingPostId,
                    updateData: updateData,
                    imageUrls: imageUrls,
                    originalImageUrls: originalImageUrls
                });
                
                // 调用更新接口
                return this.callCloudFunction('updatePostContent', {
                    postId: this.editingPostId,
                    data: updateData
                }).then((res) => {
                    console.log('更新帖子成功:', res);
                    if (res && res.result && res.result.success) {
                        this.publishSuccess({
                            _id: this.editingPostId
                        });
                    } else {
                        console.error('更新失败:', res);
                        this.publishFail(new Error(res.result?.message || '更新失败'));
                    }
                }).catch((err) => {
                    console.error('更新帖子失败:', err);
                    this.publishFail(err);
                });
            }
            
            // 如果不是编辑模式，或者编辑模式检查失败，则创建新帖子
            console.log('【Add】非编辑模式，准备创建新帖子');
            
            // 原有的创建帖子逻辑
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
                textColor: this.selectedTextColor || '#000000',
                highlightSentence: this.highlightLines && this.highlightLines.length > 0 ? this.highlightLines[0] : (this.highlightSentence || ''),
                highlightLines: this.highlightLines || []
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
                // 添加颜色信息
                backgroundColor: this.selectedBackgroundColor || '',
                textColor: this.selectedTextColor || '#000000',
                // 添加高光信息
                highlightSentence: this.highlightLines && this.highlightLines.length > 0 ? this.highlightLines[0] : (this.highlightSentence || ''),
                highlightLines: this.highlightLines || []
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
                tags: this.selectedTags || [],
                // 添加颜色信息
                backgroundColor: this.selectedBackgroundColor || '',
                textColor: this.selectedTextColor || '#000000',
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
            const successMessage = this.isEditMode ? '编辑成功！' : '发布成功！';
            uni.showToast({
                title: successMessage
            });
            // 新增：设置各页面需要刷新标记
            try {
                uni.setStorageSync('shouldRefreshIndex', true);
                uni.setStorageSync('shouldRefreshProfile', true);
                uni.setStorageSync('shouldRefreshPoem', true);
                uni.setStorageSync('shouldRefreshMountain', true);
                const appInstance = getApp();
                const userId = appInstance && appInstance.globalData && appInstance.globalData.openid;
                if (this.isEditMode) {
                    // 编辑模式：发送帖子更新事件
                    try { const { emitPostUpdated } = require('@/utils/events.js'); emitPostUpdated(res._id); } catch (e) { if (uni.$emit) { uni.$emit('post-updated', { postId: res._id }); } }
                } else {
                    // 创建模式：发送帖子创建事件
                    try { const { emitPostCreated } = require('@/utils/events.js'); emitPostCreated(userId); } catch (e) { if (userId && uni.$emit) { uni.$emit('post-created', { userId }); } }
                }
            } catch (e) {
                console.log('CatchClause', e);
                console.log('CatchClause', e);
            }
            // 设置发布成功标记，避免后续检查草稿
            this.setData({
                isPublished: true
            });
            // 发布成功后清除草稿（编辑模式也清除）
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

        goBack: function () {
            // 如果正在导航中，直接返回
            if (this.isNavigating) {
                return;
            }
            
            // 如果有内容且未发布，提示保存草稿
            if (!this.isPublished && this.hasContent()) {
                this.exitWithOptionalSave();
                return;
            }
            
            // 没有内容，直接返回
            this.setData({ isNavigating: true });
            
            // 获取页面栈
            const pages = getCurrentPages();
            console.log('当前页面栈长度:', pages.length);
            
            if (pages.length > 1) {
                // 有上一页，正常返回
                uni.navigateBack({
                    delta: 1,
                    fail: () => {
                        console.log('navigateBack失败，尝试switchTab');
                        // 如果返回失败，尝试跳转到首页
                        uni.switchTab({
                            url: '/pages/index/index'
                        });
                    }
                });
            } else {
                // 没有上一页，跳转到首页
                console.log('没有上一页，跳转到首页');
                uni.switchTab({
                    url: '/pages/index/index'
                });
            }
        },

        // 去预览：把当前编辑内容带到预览页，仅展示不提交
        goToPreview: function () {
            const previewPost = {
                _id: 'preview-temp-id',
                content: this.content || '',
                title: this.title || '', // 标题（编辑模式下已有值，新建模式下在预览页面输入）
                textColor: this.selectedTextColor || '#000000',
                backgroundColor: this.selectedBackgroundColor || '#ffffff',
                isExpanded: true,
                likeIcon: '/static/images/seed.png',
                imageUrls: (this.imageList || []).map(i => i.previewUrl),
                highlightLines: this.highlightLines || [],
                // 传递当前编辑的数据供预览页面使用
                editData: {
                    selectedBackgroundColor: this.selectedBackgroundColor,
                    selectedTextColor: this.selectedTextColor,
                    selectedColorCombination: this.selectedColorCombination,
                    imageList: this.imageList,
                    publishMode: this.publishMode,
                    isOriginal: this.isOriginal,
                    selectedTags: this.selectedTags,
                    author: this.author,
                    highlightLines: this.highlightLines,
                    highlightSelectedLineIndices: this.highlightSelectedLineIndices,
                    isEditMode: this.isEditMode, // 传递编辑模式标记
                    editingPostId: this.editingPostId // 传递编辑的帖子ID
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

        // 选择颜色
        onSelectColor: function () {
            this.setData({ 
                showColorPicker: !this.showColorPicker,
                colorPickerStep: 'palette' // 重置到色卡选择步骤
            });
        },

        /* 颜色选择相关方法已移至 ColorPickerModal.vue 组件 */

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
                highlightSelecting: !this.highlightSelecting
            });
        },

        // 高光选择更新（组件事件处理）
        onHighlightUpdate: function (indices) {
            this.setData({ highlightSelectedLineIndices: indices });
        },

        // 高光选择确认（组件事件处理）
        onHighlightConfirm: function (indices) {
            const lines = (this.content || '').split(/\r?\n/);
            const picked = indices.map(i => lines[i] || '').filter(Boolean);
            this.setData({ 
                highlightLines: picked, 
                highlightSentence: picked[0] || '', 
                highlightSelecting: false,
                highlightSelectedLineIndices: indices
            });
            uni.showToast({ title: '已设置高光', icon: 'success' });
        },

        /* 高光弹窗相关方法已移至 HighlightSelectorModal.vue 组件 */

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
        },

        onLineTouchEnd: function (e) {
            e.preventDefault();
            e.stopPropagation();

            const index = Number(e.currentTarget.dataset.index);
            if (this.touchStartLine === index) {
                // 单击直接选择
                this.toggleLineHighlight(index);
                // 触觉反馈（如果支持）
                try {
                    uni.vibrateShort();
                } catch (e) {}
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

        /* toggleHighlightLine 和 finishHighlight 已移至 HighlightSelectorModal.vue 组件 */

        // 清除选择
        clearHighlight: function () {
            this.setData({ highlightSelectedLineIndices: [], highlightLines: [], highlightSentence: '' });
        },

        // 选择颜色（组件事件处理）
        onColorSelect: function (color) {
            this.setData({ 
                selectedBackgroundColor: color.backgroundColor,
                selectedTextColor: color.textColor,
                selectedColorCombination: color,
                showColorPicker: false
            });
            uni.showToast({ title: '已设置颜色搭配', icon: 'success' });
        },

        noop() {},

        // 标签更新（组件事件处理）
        onTagsUpdate: function (tags) {
            this.setData({ selectedTags: tags });
        },

        /* 标签选择相关方法已移至 TagSelectorModal.vue 组件 */

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
                    selectedBackgroundColor: this.selectedBackgroundColor,
                    selectedTextColor: this.selectedTextColor,
                    selectedColorCombination: this.selectedColorCombination,
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
                                        selectedBackgroundColor: draftData.selectedBackgroundColor || '#a4c4bd',
                                        selectedTextColor: draftData.selectedTextColor || '#333333',
                                        selectedColorCombination: draftData.selectedColorCombination || { backgroundColor: '#a4c4bd', textColor: '#333333' },
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
                        selectedBackgroundColor: draftData.selectedBackgroundColor || '#a4c4bd',
                        selectedTextColor: draftData.selectedTextColor || '#333333',
                        selectedColorCombination: draftData.selectedColorCombination || { backgroundColor: '#a4c4bd', textColor: '#333333' },
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
    padding: 100rpx 0 0 0; /* 与preview页面保持一致的顶部边距 */
    padding-right: 0; /* 移除右边距，让工具栏紧贴右边缘 */
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
    padding-bottom: 30rpx;
    background: #fff;
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: visible; /* 改为visible，允许浮动按钮显示 */
    position: relative;
}

/* 主输入区域 - 响应式布局 */
.main-input-area {
    flex: 1;
    display: flex;
    position: relative;
    min-height: 0;
    overflow: visible; /* 改为visible，允许浮动按钮显示 */
    padding: 0 30rpx 0 30rpx; /* 只保留左边距，右边距为0 */
}

.content-input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-right: 70rpx; /* 移除右边距 */
    min-height: 0;
    overflow: hidden;
    /* 移除固定宽度，让输入框自适应 */
}

.content-textarea {
    flex: 1;
    width: 100%;
    height: 100%;
    border: none;
    font-size: 32rpx; /* 对应16px */
    line-height: 1.5; /* 对应19px行高 */
    padding: 60rpx; /* 对应30px内边距 */
    background: #E8E8E8;
    resize: none;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-appearance: none;
    appearance: none;
    -webkit-box-sizing: border-box;
    box-sizing: border-box;
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
    border-radius: 20rpx; /* 对应10px圆角 */
    outline: none;
    -webkit-overflow-scrolling: touch;
    position: relative;
    color: #989090; /* 使用CSS中定义的文字颜色 */
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 300;
    /* 精确尺寸：314px宽，383px高 */
    min-height: 766rpx; /* 对应383px */
    max-height: 766rpx;
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


/* 模式选择器样式已移至 ModeSelectorModal.vue 组件 */

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
    padding: 10rpx 0rpx;
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

/* 标签选择弹层样式已移至 TagSelectorModal.vue 组件 */

/* ====== 右侧工具栏样式 ====== */
.side-toolbar {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 90rpx; /* 调整工具栏宽度与按钮宽度一致 */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0; /* 移除间距，让图标紧密排列 */
    z-index: 10;
    padding: 20rpx 0;
    background: transparent;
}


.side-tool-btn {
    width: 90rpx;
    height: 90rpx;
    border: none; /* 移除边框 */
    background: transparent; /* 移除背景 */
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: none; /* 移除阴影 */
    transition: all 0.2s ease;
    flex-shrink: 0;
    margin-bottom: 20rpx; /* 调整间距 */
    margin-right: 0rpx; /* 向右移动 */
}

.side-tool-btn:active { 
    transform: scale(0.95);
}


.mode-switch-btn {
    position: relative;
}

.mode-switch-icon {
    width: 110rpx;
    height: 110rpx;
    padding: 12rpx;
    border-radius: 50%;
    background: transparent;
    box-shadow: none;
}

/* .mode-switch-modal-icon 已移至 ModeSelectorModal.vue 组件 */

.side-tool-icon { 
    width: 75rpx; /* 调整图标尺寸到75rpx */
    height: 75rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30rpx;
    color: #333;
}

/* 左下角返回按钮 */
.back-btn {
    position: fixed;
    bottom: 100rpx;
    left: 30rpx;
    width: 100rpx;
    height: 100rpx;
    background: transparent;
    border: none;
    display: block;
    z-index: 10;
    transition: all 0.2s ease;
    box-sizing: border-box;
}

.back-btn:active {
    transform: scale(0.95);
}

.back-icon {
    width: 100px;
    height: 100px;
    display: block;
    object-fit: contain;
}

/* 浮动操作按钮 */
.floating-action-btn {
    position: fixed; /* 改为fixed定位，相对于视口定位 */
    bottom: 30rpx; /* 调整位置 */
    right: 50rpx; /* 调整位置 */
    width: 200rpx;
    height: 200rpx;
    background: transparent;
    border: none;
    display: block;
    z-index: 10;
    transition: all 0.2s ease;
    box-sizing: border-box;
}

.floating-action-btn:active {
    transform: scale(0.95);
}

.fab-icon {
    width: 200rpx;
    height: 200rpx;
    display: block;
    object-fit: contain;
    object-position: center;
    border: none;
    box-sizing: border-box;
}

/* 让正文为右侧工具栏预留空间及计数避让 */
.content-input-wrapper { 
    padding-right: 0rpx; /* 减少右边距，让输入框更宽 */
}

.char-count { 
    right: 130rpx; /* 调整字符计数位置 */
}

/* 颜色选择弹层样式已移至 ColorPickerModal.vue 组件 */

/* 高光选择全屏弹窗样式已移至 HighlightSelectorModal.vue 组件 */

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
    overflow: hidden;
    /* 确保不超出输入框边界 */
    max-width: 100%;
    max-height: 100%;
    box-sizing: border-box;
}

.overlay-scroll {
    height: 100%;
    width: 100%;
    overflow-y: auto;
    /* 匹配textarea的滚动行为 */
}

.overlay-content {
    height: 100%;
    width: 100%;
    /* 移除所有可能导致额外空间的样式 */
    font-size: 0; /* 隐藏字体，不占用空间 */
    line-height: 0;
    color: transparent;
    box-sizing: border-box;
    border-radius: 20rpx;
    /* 确保不超出父容器 */
    max-width: 100%;
    max-height: 100%;
    overflow: hidden;
    position: relative; /* 为绝对定位的子元素提供定位上下文 */
}

.overlay-line {
    margin: 0;
    position: absolute; /* 绝对定位，通过style属性设置top */
    left: 0;
    right: 0;
    height: 48rpx; /* 固定行高：32rpx字体 + 1.5行高 */
    transition: background-color 0.2s ease;
    padding: 20rpx; /* 减少padding，避免超出边界 */
    line-height: 1.5;
    font-size: 32rpx; /* 与输入框保持相同的字体大小 */
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 300;
    box-sizing: border-box;
    pointer-events: none; /* 防止干扰滚动 */
    /* 确保不超出父容器 */
    max-width: 100%;
    overflow: hidden;
}

.overlay-line.highlighted {
    background-color: rgba(158, 215, 238, 0.2);
    border-radius: 8rpx;
}

.overlay-line-content {
    color: #666; /* 半透明颜色，让用户能看到下面的文字 */
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 300;
    font-size: 32rpx; /* 与输入框保持相同的字体大小 */
    line-height: 1.5;
    margin: 0;
    padding: 0;
    display: block;
    /* 确保文字不超出边界 */
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 高光选择提示 */
.highlight-hint {
    position: fixed;
    bottom: 100rpx;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(128, 128, 128, 0.6);
    color: white;
    padding: 12rpx 24rpx;
    border-radius: 20rpx;
    z-index: 1000;
    text-align: center;
    white-space: nowrap;
}

.hint-text {
    font-size: 24rpx;
    line-height: 1.2;
}


/* 调整textarea的z-index，确保在覆盖层下方 */
.content-textarea {
    z-index: 0;
}

/* 当高光模式启用时，textarea的样式调整 */
.content-input-wrapper {
    position: relative;
}

/* 响应式设计 - 小屏幕适配 */
@media screen and (max-width: 750rpx) {
    .content-textarea {
        font-size: 28rpx;
        padding: 20rpx;
        min-height: 180rpx;
    }
    
    .side-toolbar {
        width: 70rpx;
        gap: 15rpx;
    }
    
    .side-tool-btn {
        width: 70rpx;
        height: 70rpx;
    }
    
    .mode-switch-icon {
        width: 70rpx;
        height: 70rpx;
    }
    
    .side-tool-icon {
        font-size: 18rpx;
    }
    
    .floating-action-btn {
        width: 200rpx;
        height: 200rpx;
        bottom: 30rpx;
        right: 50rpx;
    }
    
    .fab-icon {
        font-size: 20rpx;
    }
}

/* 响应式设计 - 大屏幕适配 */
@media screen and (min-width: 1200rpx) {
    .content-textarea {
        font-size: 32rpx;
        padding: 30rpx;
        min-height: 250rpx;
    }
    
    .side-toolbar {
        width: 90rpx;
        gap: 25rpx;
    }
    
    .side-tool-btn {
        width: 80rpx;
        height: 80rpx;
    }
    
    .mode-switch-icon {
        width: 90rpx;
        height: 90rpx;
    }
    
    .side-tool-icon {
        font-size: 22rpx;
    }
    
    .floating-action-btn {
        width: 200rpx;
        height: 200rpx;
    }
    
    .fab-icon {
        font-size: 26rpx;
    }
}

/* 响应式设计 - 超小屏幕适配 */
@media screen and (max-width: 600rpx) {
    .main-input-area {
        flex-direction: column;
    }
    
    .side-toolbar {
        position: relative;
        width: 100%;
        height: auto;
        flex-direction: row;
        justify-content: space-around;
        padding: 20rpx 0;
        gap: 10rpx;
    }
    
    .content-input-wrapper {
        margin-right: 0;
        margin-bottom: 20rpx;
    }
    
    .floating-action-btn {
        position: fixed;
        bottom: 30rpx;
        right: 50rpx;
        width: 200rpx;
        height: 200rpx;
    }
}

</style>







