<template>
    <view>
        <!-- components/portfolio-selector/portfolio-selector.wxml -->
        <view v-if="showClone" class="modal-overlay">
            <view class="modal-content">
                <view class="modal-header">
                    <view class="modal-title">选择作品集</view>
                    <view class="header-actions">
                        <view class="refresh-btn" @tap="loadPortfolios" :class="{ 'refreshing': isLoading }">⟳</view>
                        <view class="close-btn" @tap="hideModal">×</view>
                    </view>
                </view>

                <view class="modal-body">
                    <!-- 加载状态 -->
                    <view v-if="isLoading" class="loading-container">
                        <view class="loading-text">加载中...</view>
                    </view>

                    <!-- 作品集列表 -->
                    <view v-else-if="portfolios.length > 0" class="portfolios-list">
                        <view
                            :class="'portfolio-item ' + (selectedPortfolioId === item._id ? 'selected' : '')"
                            :data-portfolio-id="item._id"
                            @tap="selectPortfolio"
                            v-for="(item, index) in portfolios"
                            :key="index"
                        >
                            <view class="portfolio-icon">📚</view>

                            <view class="portfolio-info">
                                <view class="portfolio-name">{{ item.name }}</view>
                                <view class="portfolio-count">{{ item.itemCount }} 个作品</view>
                            </view>

                            <view v-if="selectedPortfolioId === item._id" class="selected-icon">✓</view>
                        </view>
                    </view>

                    <!-- 空状态 -->
                    <view v-else class="empty-state">
                        <view class="empty-icon">📚</view>
                        <view class="empty-text">还没有作品集</view>
                        <view class="empty-subtext">点击下方按钮创建一个作品集</view>
                    </view>
                </view>

                <view class="modal-footer">
                    <button class="modal-btn secondary-btn" @tap="createPortfolio">创建作品集</button>
                    <button class="modal-btn primary-btn" @tap="confirmAddToPortfolio" :disabled="!selectedPortfolioId">确认添加</button>
                </view>
            </view>
        </view>

        <!-- 创建作品集弹窗 -->
        <view v-if="showCreateModal" class="modal-overlay">
            <view class="modal-content create-modal">
                <view class="modal-header">
                    <view class="modal-title">创建作品集</view>
                    <view class="close-btn" @tap="hideCreateModal" @tap.stop.prevent="trueFun">×</view>
                </view>

                <view class="modal-body">
                    <input class="portfolio-name-input" placeholder="请输入作品集名称" :value="newPortfolioName" @input="onPortfolioNameInput" :focus="true" @tap.stop.prevent="trueFun" />
                </view>

                <view class="modal-footer">
                    <button class="modal-btn secondary-btn" @tap="hideCreateModal">取消</button>
                    <button class="modal-btn primary-btn" @tap="createNewPortfolio" :disabled="!newPortfolioName">创建</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
// components/portfolio-selector/portfolio-selector.js
const { cloudCall } = require('../../utils/cloudCall.js');
export default {
    data() {
        return {
            portfolios: [],
            isLoading: true,
            selectedPortfolioId: '',
            showCreateModal: false,
            newPortfolioName: '',
            showClone: false
        };
    },

    props: {
        show: {
            type: Boolean,
            default: false
        },
        postId: {
            type: String,
            default: ''
        }
    },

    watch: {
        show: {
            handler: function (newVal, oldVal) {
                console.log('【portfolio-selector】show变化:', { newVal, oldVal });
                this.showClone = newVal;
                if (newVal && !oldVal) { // 从false变为true时
                    console.log('【portfolio-selector】弹窗显示，开始加载作品集');
                    setTimeout(() => {
                        if (this.showClone) {
                            this.loadPortfolios();
                        }
                    }, 100); // 延迟一点时间确保DOM渲染完成
                }
            },
            immediate: true
        }
    },

    methods: {
        // 统一云函数调用方法
        callCloudFunction(name, data = {}, extraOptions = {}) {
            return cloudCall(name, data, Object.assign({ pageTag: 'portfolio-selector', context: this, requireAuth: true }, extraOptions));
        },

        // 加载作品集列表
        loadPortfolios: function () {
            console.log('开始加载作品集列表...');
            this.setData({
                isLoading: true
            });
            this.callCloudFunction('getPortfolioFolders').then((res) => {
                    console.log('portfolio-selector获取作品集:', res);
                    if (res.result && res.result.success) {
                        const portfolios = res.result.folders || [];
                        console.log('获取到作品集数量:', portfolios.length);

                        // 如果当前选中的作品集不存在了，清空选择
                        const currentSelectedId = this.selectedPortfolioId;
                        if (currentSelectedId && !portfolios.some((p) => p._id === currentSelectedId)) {
                            console.log('清空失效的选中状态');
                            this.setData({
                                selectedPortfolioId: ''
                            });
                        }
                        this.setData({
                            portfolios: portfolios,
                            isLoading: false
                        });
                    } else {
                        console.error('获取作品集失败，返回结果:', res);
                        uni.showToast({
                            title: res.result?.message || '加载失败',
                            icon: 'none'
                        });
                        this.setData({
                            isLoading: false,
                            portfolios: [],
                            selectedPortfolioId: '' // 加载失败时清空选择
                        });
                    }
                }).catch((err) => {
                    console.error('获取作品集失败:', err);
                    console.error('错误详情:', err.errMsg || err.message);

                    // 如果获取失败，尝试重新加载一次
                    setTimeout(() => {
                        if (this.showClone) { // 如果弹窗还在显示中
                            console.log('重新尝试加载作品集...');
                            this.loadPortfolios();
                        }
                    }, 1000);

                    this.setData({
                        isLoading: false,
                        portfolios: [],
                        selectedPortfolioId: '' // 网络错误时清空选择
                    });
                });
        },

        // 选择作品集
        selectPortfolio: function (e) {
            const portfolioId = e.currentTarget.dataset.portfolioId;
            this.setData({
                selectedPortfolioId: portfolioId
            });
        },

        // 确认添加到作品集
        confirmAddToPortfolio: function () {
            const selectedPortfolioId = this.selectedPortfolioId;
            const postId = this.postId;
            console.log('确认添加到作品集，postId:', postId, 'folderId:', selectedPortfolioId);
            if (!selectedPortfolioId) {
                uni.showToast({
                    title: '请选择作品集',
                    icon: 'none'
                });
                return;
            }
            if (!postId) {
                console.error('postId 为空，无法添加到作品集');
                uni.showToast({
                    title: '参数错误：帖子ID为空',
                    icon: 'none'
                });
                return;
            }
            uni.showLoading({
                title: '添加中...'
            });
            this.callCloudFunction('addToPortfolio', {
                postId: postId,
                folderId: selectedPortfolioId
            }).then((res) => {
                    uni.hideLoading();
                    console.log('确认添加到作品集返回结果:', res);
                    if (res && res.result) {
                        if (res.result.success) {
                            uni.showToast({
                                title: '添加成功'
                            });
                            console.log('添加成功，开始关闭弹窗');

                            // 确保状态正确重置
                            this.setData({
                                selectedPortfolioId: ''
                            });

                            // 延迟关闭，确保用户能看到成功提示
                            setTimeout(() => {
                                this.hideModal();
                            }, 1500);

                            // 触发成功事件
                            this.$emit('portfolioSuccess');
                        } else {
                            console.error('添加到作品集业务失败:', res.result);
                            uni.showToast({
                                title: res.result.message || '添加失败',
                                icon: 'none'
                            });
                        }
                    } else {
                        console.error('添加到作品集返回格式异常:', res);
                        uni.showToast({
                            title: '添加失败：返回格式错误',
                            icon: 'none'
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('添加到作品集云函数调用失败:', err);
                    uni.showToast({
                        title: '网络错误：' + (err.errMsg || '未知错误'),
                        icon: 'none'
                    });
                });
        },

        // 显示创建作品集弹窗
        createPortfolio: function () {
            this.setData({
                showCreateModal: true,
                newPortfolioName: ''
            });
        },

        // 隐藏创建作品集弹窗
        hideCreateModal: function () {
            this.setData({
                showCreateModal: false,
                newPortfolioName: ''
            });
        },

        // 输入作品集名称
        onPortfolioNameInput: function (e) {
            const value = e.detail.value;
            this.setData({
                newPortfolioName: value
            });
        },

        // 创建作品集
        createNewPortfolio: function () {
            const portfolioName = this.newPortfolioName.trim();
            if (!portfolioName) {
                uni.showToast({
                    title: '请输入作品集名称',
                    icon: 'none'
                });
                return;
            }

            // 实时更新按钮状态
            this.setData({
                newPortfolioName: portfolioName
            });
            console.log('组件开始创建作品集，名称:', portfolioName);
            uni.showLoading({
                title: '创建中...'
            });
            this.callCloudFunction('createPortfolioFolder', {
                folderName: portfolioName
            }).then((res) => {
                    uni.hideLoading();
                    console.log('组件创建作品集返回结果:', res);

                    // 更详细的返回结果检查
                    if (res && res.result) {
                        if (res.result.success) {
                            uni.showToast({
                                title: '创建成功',
                                duration: 2000
                            });
                            this.setData({
                                showCreateModal: false
                            });
                            // 延迟重新加载，确保状态同步
                            setTimeout(() => {
                                this.loadPortfolios();
                            }, 300);
                        } else {
                            console.error('组件创建作品集业务失败:', res.result);
                            uni.showToast({
                                title: res.result.message || '创建失败',
                                icon: 'none',
                                duration: 3000
                            });
                        }
                    } else {
                        console.error('组件创建作品集返回格式异常:', res);
                        uni.showToast({
                            title: '创建失败：返回格式错误',
                            icon: 'none',
                            duration: 3000
                        });
                    }
                }).catch((err) => {
                    uni.hideLoading();
                    console.error('组件创建作品集云函数调用失败:', err);
                    uni.showToast({
                        title: '创建失败: ' + (err.errMsg || '网络错误'),
                        icon: 'none',
                        duration: 3000
                    });
                });
        },

        // 隐藏弹窗
        hideModal: function () {
            console.log('=== 点击关闭按钮，开始隐藏弹窗 ===');
            console.log('当前状态：', {
                show: this.show,
                showCreateModal: this.showCreateModal,
                selectedPortfolioId: this.selectedPortfolioId
            });
            this.setData({
                selectedPortfolioId: '',
                showClone: false,
                showCreateModal: false,
                // 确保创建弹窗也关闭
                newPortfolioName: '' // 清空输入框
            });

            console.log('=== 弹窗已隐藏，状态已重置 ===');
            this.$emit('hide');
        },

        trueFun() {
            console.log('占位：函数 true 未声明');
        }
    },

    created: function () {},

    mounted: function () {
        console.log('【portfolio-selector】组件mounted');
        if (this.show) {
            console.log('【portfolio-selector】mounted时show为true，开始加载作品集');
            this.loadPortfolios();
        }
    }
};
</script>
<style>
/* components/portfolio-selector/portfolio-selector.wxss */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: white;
    border-radius: 16rpx;
    margin: 40rpx;
    width: calc(100% - 80rpx);
    max-width: 600rpx;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
}

.modal-title {
    font-size: 36rpx;
    font-weight: 500;
    color: #333;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 20rpx;
}

.refresh-btn {
    font-size: 36rpx;
    color: #9ed7ee;
    padding: 8rpx;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
}

.refresh-btn:active {
    transform: scale(0.9);
    opacity: 0.7;
}

.refresh-btn.refreshing {
    animation: rotate 1s linear infinite;
}

@keyframes rotate {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

.close-btn {
    font-size: 48rpx;
    color: #999;
    line-height: 1;
    position: relative;
    z-index: 1001;
}

.modal-body {
    flex: 1;
    padding: 20rpx 0;
    max-height: 60vh;
    overflow-y: auto;
}

.loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200rpx;
}

.loading-text {
    color: #999;
    font-size: 28rpx;
}

.portfolios-list {
    padding: 0 40rpx;
}

.portfolio-item {
    display: flex;
    align-items: center;
    padding: 24rpx 0;
    border-bottom: 1rpx solid #f8f8f8;
}

.portfolio-item:last-child {
    border-bottom: none;
}

.portfolio-item.selected {
    background: rgba(158, 215, 238, 0.1);
    border-radius: 8rpx;
    padding: 24rpx 20rpx;
    margin: 0 -20rpx;
}

.portfolio-icon {
    font-size: 40rpx;
    margin-right: 20rpx;
}

.portfolio-info {
    flex: 1;
}

.portfolio-name {
    font-size: 30rpx;
    color: #333;
    font-weight: 500;
    margin-bottom: 4rpx;
}

.portfolio-count {
    font-size: 24rpx;
    color: #999;
}

.selected-icon {
    font-size: 32rpx;
    color: #9ed7ee;
    font-weight: bold;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200rpx;
    padding: 40rpx;
}

.empty-icon {
    font-size: 60rpx;
    margin-bottom: 16rpx;
    opacity: 0.5;
}

.empty-text {
    font-size: 28rpx;
    color: #666;
    margin-bottom: 8rpx;
}

.empty-subtext {
    font-size: 24rpx;
    color: #999;
}

.modal-footer {
    display: flex;
    gap: 20rpx;
    padding: 30rpx 40rpx;
    border-top: 1rpx solid #f0f0f0;
}

.modal-btn {
    flex: 1;
    height: 80rpx;
    border-radius: 8rpx;
    font-size: 28rpx;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1001;
}

.secondary-btn {
    background: #f5f5f5;
    color: #666;
}

.primary-btn {
    background: #9ed7ee;
    color: white;
}

.primary-btn:disabled {
    background: #ccc;
    color: #999;
}

/* 创建作品集弹窗样式 */
.create-modal .modal-body {
    padding: 40rpx;
}

.portfolio-name-input {
    width: 100%;
    height: 80rpx;
    padding: 0 20rpx;
    border: 2rpx solid #e0e0e0;
    border-radius: 8rpx;
    font-size: 30rpx;
    box-sizing: border-box;
}

.portfolio-name-input:focus {
    border-color: #9ed7ee;
}
</style>