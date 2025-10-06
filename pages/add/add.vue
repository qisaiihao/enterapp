<template>
    <!-- pages/add/add.wxml -->
    <view class="container" :style="'padding-bottom: calc(120rpx + ' + keyboardHeight + 'px);'">
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

        <!-- 内容输入区域 -->
        <view class="content-section">
            <!-- 标题输入框 -->
            <view class="title-input-wrapper">
                <input class="title-input" placeholder="标题" @input="onTitleInput" maxlength="50" :value="title" />
            </view>

            <!-- 作者输入区域（诗歌模式显示） -->
            <view v-if="publishMode === 'poem'" class="author-input-wrapper">
                <input
                    class="author-input"
                    :placeholder="isOriginal ? '作者（可选，不填默认使用您的昵称）' : '作者（必填）'"
                    @input="onAuthorInput"
                    maxlength="20"
                    :value="author"
                />
            </view>

            <!-- 正文输入区域 -->
            <view class="content-input-wrapper">
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
                ></textarea>
                <view v-if="content.length > 1400" class="char-count">{{ content.length }}/1500</view>
            </view>
        </view>

        <!-- 写诗子菜单 -->
        <view v-if="showPoemSubmenu" class="poem-submenu">
            <view class="submenu-item" @tap="selectPoemMode" :data-original="true">
                <view class="submenu-icon">✨</view>
                <view class="submenu-text">原创</view>
            </view>
            <view class="submenu-item" @tap="selectPoemMode" :data-original="false">
                <view class="submenu-icon">📖</view>
                <view class="submenu-text">非原创</view>
            </view>
        </view>

        <!-- 底部工具栏 -->
        <view class="toolbar" :style="'bottom: ' + keyboardHeight + 'px;'">
            <view class="toolbar-item" @tap="handleChooseImage">
                <view class="toolbar-icon">📷</view>
                <view class="toolbar-text">图片</view>
            </view>
            <view class="toolbar-item" @tap="toggleTagSelector">
                <view class="toolbar-icon">#</view>
                <view class="toolbar-text">标签</view>
            </view>
            <view class="toolbar-item" @tap="switchMode">
                <view class="toolbar-icon">{{ publishMode === 'normal' ? '📝' : '🎭' }}</view>
                <view class="toolbar-text">{{ publishMode === 'normal' ? '写诗' : '普通' }}</view>
            </view>
            <view :class="'publish-btn ' + (canPublish ? 'active' : '')" @tap="submitPost">发布</view>
        </view>

        <!-- 标签选择区域 -->
        <view v-if="showTagSelector" class="tag-section" :style="'bottom: calc(120rpx + ' + keyboardHeight + 'px);'">
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
export default {
    data() {
        return {
            title: '',
            content: '',
            imageList: [],

            // 图片列表，包含原图和压缩图信息
            maxImageCount: 9,

            // 最大图片数量
            publishMode: 'normal',

            // 'normal' | 'poem' 普通模式 | 诗歌模式
            isOriginal: false,

            // 是否原创
            showPoemSubmenu: false,

            // 是否显示写诗子菜单
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
    onLoad: function (options) {
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
        // 页面卸载时检查是否需要保存草稿（如果已发布成功则不检查）
        if (!this.isPublished) {
            this.checkAndSaveDraft();
        }
    },
    onHide: function () {
        // 页面隐藏时检查是否需要保存草稿（如果已发布成功或临时隐藏则不检查）
        if (!this.isPublished && !this.isTemporaryHide) {
            this.checkAndSaveDraft();
        }
        // 重置临时隐藏标志
        this.setData({
            isTemporaryHide: false
        });
    },
    methods: {
        // 兼容性云函数调用方法
        callCloudFunction(name, data = {}) {
            return new Promise((resolve, reject) => {
                // 使用新的平台检测工具
                const { getCurrentPlatform, getCloudFunctionMethod } = require('../../utils/platformDetector.js');
                
                const platform = getCurrentPlatform();
                const method = getCloudFunctionMethod();
                
                if (method === 'tcb') {
                    // 使用TCB调用云函数（H5和App环境）
                    const app = getApp();
                    if (app && app.$tcb && app.$tcb.callFunction) {
                        app.$tcb.callFunction({
                            name: name,
                            data: data
                        }).then(resolve).catch(reject);
                    } else {
                        reject(new Error('TCB实例不可用'));
                    }
                } else if (method === 'wx-cloud') {
                    // 使用微信云开发调用云函数（小程序环境）
                    if (wx.cloud && wx.cloud.callFunction) {
                        wx.cloud.callFunction({
                            name: name,
                            data: data,
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
                                const base64 = reader.result.split(',')[1];
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

        onTitleInput: function (event) {
            this.setData({
                title: event.detail.value
            });
            this.checkCanPublish();
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

        onAuthorInput: function (event) {
            this.setData({
                author: event.detail.value
            });
            this.checkCanPublish();
        },

        // 检查是否可以发布
        checkCanPublish: function () {
            const hasImages = this.imageList.length > 0;
            const hasTitle = this.title && this.title.trim();
            const hasContent = this.content && this.content.trim();
            let canPublish = hasImages || (hasTitle && hasContent);

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
            if (this.publishMode === 'normal') {
                if (this.showPoemSubmenu) {
                    // 如果子菜单已显示，再次点击写诗按钮则收起子菜单
                    this.setData({
                        showPoemSubmenu: false
                    });
                } else {
                    // 从普通模式切换到写诗模式，显示子菜单
                    this.setData({
                        showPoemSubmenu: true,
                        showTagSelector: false // 隐藏标签选择器
                    });
                }
            } else {
                // 从写诗模式切换回普通模式
                this.setData({
                    publishMode: 'normal',
                    isOriginal: false,
                    showPoemSubmenu: false,
                    // 切换到普通模式时重置图片限制
                    maxImageCount: 9
                });
                this.checkCanPublish();
            }
        },

        // 选择写诗模式（原创/非原创）
        selectPoemMode: function (e) {
            const isOriginal = e.currentTarget.dataset.original === 'true';
            this.setData({
                publishMode: 'poem',
                isOriginal: isOriginal,
                showPoemSubmenu: false,
                // 切换到诗歌模式时重置图片
                imageList: this.imageList.length > 1 ? [] : this.imageList,
                maxImageCount: 1
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

        submitPost: function () {
            if (!this.canPublish) {
                uni.showToast({
                    title: '请至少上传图片或输入内容',
                    icon: 'none'
                });
                return;
            }
            const hasTitle = this.title && this.title.trim();
            const hasContent = this.content && this.content.trim();
            if (hasTitle && !hasContent) {
                uni.showToast({
                    title: '请输入正文内容',
                    icon: 'none'
                });
                return;
            }

            // 如果是非原创诗歌，必须填写作者
            if (this.publishMode === 'poem' && !this.isOriginal) {
                const hasAuthor = this.author && this.author.trim();
                if (!hasAuthor) {
                    uni.showToast({
                        title: '非原创诗歌必须填写作者',
                        icon: 'none'
                    });
                    return;
                }
            }
            console.log('提交帖子:', {
                imageList: this.imageList,
                title: this.title,
                content: this.content
            });

            // 如果是非原创诗歌，先检查重复
            if (this.publishMode === 'poem' && !this.isOriginal) {
                this.checkDuplicatePoem();
            } else {
                // 直接发布
                uni.showLoading({
                    title: '发布中...'
                });
                if (this.imageList.length > 0) {
                    this.uploadImagesAndSubmit();
                } else {
                    this.submitTextOnly();
                }
            }
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
                tags: this.selectedTags || []
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
                tags: this.selectedTags || []
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
            this.setData({
                customTag: inputValue
            });

            // 防抖处理，避免频繁搜索
            if (this.searchTimer) {
                clearTimeout(this.searchTimer);
            }
            this.searchTimer = setTimeout(() => {
                console.log('【标签搜索】开始搜索匹配标签:', inputValue);
                this.searchMatchingTags(inputValue);
            }, 300); // 300ms防抖
        },

        addCustomTag: function () {
            const customTag = this.customTag.trim();
            if (!customTag) {
                uni.showToast({
                    title: '请输入标签',
                    icon: 'none'
                });
                return;
            }
            if (this.selectedTags.includes(customTag)) {
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
            const selectedTags = [...this.selectedTags, customTag];
            this.setData({
                selectedTags: selectedTags,
                customTag: ''
            });
        },

        removeTag: function (e) {
            const tag = e.currentTarget.dataset.tag;
            const selectedTags = this.selectedTags.filter((t) => t !== tag);
            this.setData({
                selectedTags: selectedTags
            });
        },

        // 分类切换功能
        switchCategory: function (e) {
            const index = e.currentTarget.dataset.index;
            this.setData({
                currentCategoryIndex: index
            });
        },

        // 获取当前分类的标签
        getCurrentCategoryTags: function () {
            return this.tagCategories[this.currentCategoryIndex].tags;
        },

        // 加载所有已有标签
        loadAllExistingTags: function () {
            console.log('【标签加载】开始加载所有已有标签...');
            this.callCloudFunction('getAllTags', {}).then((res) => {
                    console.log('【标签加载】云函数返回结果:', res);
                    if (res.result && res.result.success) {
                        this.setData({
                            allExistingTags: res.result.tags
                        });
                        console.log('【标签加载】已加载所有标签:', res.result.tags.length, '个标签:', res.result.tags);
                    } else {
                        console.error('【标签加载】云函数返回失败:', res.result);
                    }
                }).catch((err) => {
                    console.error('【标签加载】获取标签失败:', err);
                });
        },

        // 搜索匹配的标签
        searchMatchingTags: function (inputValue) {
            console.log('【标签搜索】搜索参数:', {
                inputValue: inputValue,
                inputLength: inputValue ? inputValue.length : 0,
                allExistingTags: this.allExistingTags,
                selectedTags: this.selectedTags
            });
            if (!inputValue || inputValue.length < 2) {
                console.log('【标签搜索】输入长度不足，清空匹配结果');
                this.setData({
                    matchedTags: [],
                    showMatchedTags: false
                });
                return;
            }
            const allTags = this.allExistingTags;
            console.log('【标签搜索】开始匹配，总标签数:', allTags.length);
            const matched = allTags
                .filter((tag) => {
                    const isMatch = tag.toLowerCase().includes(inputValue.toLowerCase());
                    const notSelected = !this.selectedTags.includes(tag);
                    console.log(`【标签搜索】检查标签"${tag}": 匹配=${isMatch}, 未选中=${notSelected}`);
                    return isMatch && notSelected;
                })
                .slice(0, 5); // 最多显示5个匹配结果

            console.log('【标签搜索】匹配结果:', matched);
            this.setData({
                matchedTags: matched,
                showMatchedTags: matched.length > 0
            });
            console.log('【标签搜索】设置状态:', {
                matchedTags: matched,
                showMatchedTags: matched.length > 0
            });
        },

        // 选择匹配的标签
        selectMatchedTag: function (e) {
            const tag = e.currentTarget.dataset.tag;
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
            const selectedTags = [...this.selectedTags, tag];
            this.setData({
                selectedTags: selectedTags,
                customTag: '',
                showMatchedTags: false,
                matchedTags: []
            });
        },

        // 检查是否有内容需要保存草稿
        hasContent: function () {
            const hasTitle = this.title && this.title.trim();
            const hasContent = this.content && this.content.trim();
            const hasImages = this.imageList.length > 0;
            const hasTags = this.selectedTags.length > 0;
            return hasTitle || hasContent || hasImages || hasTags;
        },

        // 检查并保存草稿
        checkAndSaveDraft: function () {
            if (this.hasContent()) {
                uni.showModal({
                    title: '保存草稿',
                    content: '检测到您有未完成的内容，是否保存为草稿？',
                    confirmText: '保存',
                    cancelText: '不保存',
                    success: (res) => {
                        if (res.confirm) {
                            this.saveDraft();
                        } else {
                            this.clearDraft();
                        }
                    }
                });
            }
        },

        // 保存草稿
        saveDraft: function () {
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
            uni.showLoading({
                title: '保存中...'
            });
            this.callCloudFunction('getMyProfileData', {
                    action: 'saveDraft',
                    draftData: draftData
                }).then((res) => {
                    uni.hideLoading();
                    if (res.result && res.result.success) {
                        uni.showToast({
                            title: '草稿已保存',
                            icon: 'success'
                        });
                        // 清除本地草稿
                        this.clearDraft();
                    } else {
                        console.error('保存草稿失败:', res.result);
                        uni.showToast({
                            title: res.result?.message || '保存草稿失败',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('保存草稿失败:', err);
                    uni.showToast({
                        title: '网络错误，保存失败',
                        icon: 'none'
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
    padding-bottom: 120rpx; /* 为底部工具栏留出空间，避免内容被遮挡 */
    box-sizing: border-box; /* 确保padding计算在内 */
    overflow: hidden; /* 防止整个页面滚动 */
    position: relative; /* 确保定位上下文 */
    transition: padding-bottom 0.3s ease-out; /* 为 padding 变化添加过渡 */
}

/* 发布按钮样式 */
.publish-btn {
    background: #e0e0e0;
    color: #999;
    padding: 16rpx 32rpx;
    border-radius: 50rpx;
    font-size: 28rpx;
    transition: all 0.3s ease;
    margin-left: auto;
}

.publish-btn.active {
    background: #9ed7ee;
    color: #fff;
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

.title-input-wrapper {
    margin-bottom: 30rpx;
}

.title-input {
    width: 100%;
    height: 80rpx;
    border: none;
    border-bottom: 1rpx solid #f0f0f0;
    font-size: 32rpx;
    padding: 0;
    background: transparent;
}

.title-input:focus {
    border-bottom-color: rgb(40, 151, 173);
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
    padding: 0;
    background: transparent;
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
    border-radius: 0;
    outline: none;
    /* 确保滚动行为 */
    -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
    position: relative; /* 确保定位上下文 */
}

.char-count {
    position: absolute;
    bottom: 10rpx; /* 移到textarea外面，给文字留出空间 */
    right: 0;
    font-size: 24rpx;
    color: #666;
    background: #fdfdfd;
    padding: 8rpx 12rpx;
    border-radius: 6rpx;
    box-shadow: none;
    pointer-events: none; /* 防止遮挡textarea的点击 */
}

/* 作者输入区域样式 */
.author-input-wrapper {
    margin-bottom: 30rpx;
}

.author-input {
    width: 100%;
    height: 80rpx;
    border: none;
    border-bottom: 1rpx solid #f0f0f0;
    font-size: 32rpx;
    padding: 0;
    background: transparent;
}

.author-input:focus {
    border-bottom-color: #9ed7ee;
}

/* 写诗子菜单 */
.poem-submenu {
    position: fixed;
    bottom: 120rpx;
    left: 50%;
    transform: translateX(-50%);
    background: #fff;
    border-radius: 12rpx;
    padding: 20rpx;
    display: flex;
    gap: 40rpx;
    z-index: 99;
    box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.1);
    animation: slideUp 0.3s ease;
    border: 1rpx solid #f0f0f0;
    margin-left: -98rpx; /* 向左偏移，对齐写诗按钮 */
}

.submenu-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10rpx;
    transition: all 0.3s ease;
}

.submenu-item:active {
    transform: scale(0.95);
}

.submenu-icon {
    font-size: 40rpx;
    margin-bottom: 8rpx;
}

.submenu-text {
    font-size: 22rpx;
    color: #666;
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

/* 底部工具栏 */
.toolbar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #fff;
    border-top: 1rpx solid #f0f0f0;
    padding: 20rpx 30rpx;
    display: flex;
    align-items: center;
    gap: 40rpx;
    z-index: 100;
    transition: bottom 0.3s ease-out; /* 为位置变化添加过渡 */
}

.toolbar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10rpx;
    transition: all 0.3s ease;
}

.toolbar-item:active {
    transform: scale(0.95);
}

.toolbar-icon {
    font-size: 40rpx;
    margin-bottom: 8rpx;
}

.toolbar-text {
    font-size: 22rpx;
    color: #666;
}

/* 标签选择区域样式 */
.tag-section {
    position: fixed; /* 确保标签选择器是基于窗口定位的 */
    bottom: 120rpx; /* 初始位置在工具栏上方 */
    left: 0;
    right: 0;
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
</style>
