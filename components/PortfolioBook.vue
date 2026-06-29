<template>
    <view :class="containerClass" :style="containerInlineStyle" @tap="navigateToPortfolio">
        <view class="books-shelf">
            <!-- 动态显示作品集书籍 -->
            <view
                v-for="(portfolio, index) in portfolioListWithStyles"
                :key="portfolio._id"
                :class="'book book-' + (index % 12 + 1)"
                @tap.stop="openPortfolio(portfolio)"
            >
                <view class="book-spine" :style="portfolio.heightStyle">
                    <view class="spine-content">
                        <text
                            v-for="(char, charIndex) in portfolio.nameChars"
                            :key="charIndex"
                            class="spine-text"
                        >{{ char }}</text>
                    </view>
                </view>
            </view>

            <!-- 动态横线 -->
            <view
                v-if="portfolioList.length > 0"
                class="shelf-line"
                :style="{ width: shelfLineWidth }"
            ></view>

            <!-- 加载中状态 -->
            <view v-if="isLoading && portfolioList.length === 0" class="empty-portfolio">
                <text class="empty-text">作品集加载中...</text>
            </view>

            <!-- 如果没有作品集，显示空状态 -->
            <view v-else-if="!isLoading && portfolioList.length === 0" class="empty-portfolio">
                <text class="empty-text">{{ emptyText }}</text>
            </view>
        </view>
    </view>
</template>

<script>
import { calcBookHeight as calcBookHeightUtil, calcShelfLineWidth } from '@/utils/bookLayout.js';

export default {
    name: 'PortfolioBook',
    emits: ['navigate-to-portfolio', 'open-portfolio'],
    props: {
        portfolioList: {
            type: Array,
            default: () => []
        },
        // 加载状态
        isLoading: {
            type: Boolean,
            default: false
        },
        // 可选的标题配置
        emptyText: {
            type: String,
            default: '暂无作品集'
        },
        variant: {
            type: String,
            default: 'card'
        },
        interactive: {
            type: Boolean,
            default: true
        },
        maxVisible: {
            type: Number,
            default: 0
        }
    },
    computed: {
        containerClass() {
            return [
                'books-container',
                this.variant === 'inline' ? 'books-container-inline' : '',
                this.variant === 'compact-inline' ? 'books-container-inline books-container-compact-inline' : '',
                this.variant === 'cover-stack' ? 'books-container-cover-stack' : ''
            ];
        },

        // 为小程序端预处理作品集列表，添加样式和字符数组
        portfolioListWithStyles() {
            return this.portfolioList.map((portfolio, index) => {
                const spineName = portfolio.spineName || portfolio.name || '';
                const isCompact = this.variant === 'compact-inline';
                const compactHeights = [126, 120, 132, 116, 122, 120];
                return {
                    ...portfolio,
                    heightStyle: isCompact ? `height: ${compactHeights[index % compactHeights.length]}rpx;` : calcBookHeightUtil(spineName),
                    nameChars: spineName.split('').slice(0, isCompact ? 3 : 7)
                };
            });
        },
        
        // 计算书架线宽度
        shelfLineWidth() {
            const bookWidth = this.variant === 'compact-inline' ? 84 : (this.variant === 'inline' ? 54 : 72);
            const extraWidth = this.variant === 'compact-inline' ? 20 : 50;
            return calcShelfLineWidth(this.portfolioList.length, bookWidth, extraWidth);
        },

        containerInlineStyle() {
            const count = Number(this.maxVisible) || 0;
            if (this.variant !== 'inline' && this.variant !== 'compact-inline') {
                return {};
            }
            const bookWidth = this.variant === 'compact-inline' ? 84 : 54;
            const extraWidth = this.variant === 'compact-inline' ? 20 : 50;
            const style = {};
            if (count > 0) {
                const visibleCount = Math.max(1, count);
                style.width = `${visibleCount * bookWidth + extraWidth}rpx`;
                style.maxWidth = '100%';
            }
            return style;
        }
    },
    methods: {
        // 导航到作品集页面
        navigateToPortfolio() {
            if (!this.interactive) {
                return;
            }

            this.$emit('navigate-to-portfolio');
        },

        // 打开作品集
        openPortfolio(portfolio) {
            if (!this.interactive) {
                return;
            }

            this.$emit('open-portfolio', {
                folderId: portfolio && portfolio._id ? portfolio._id : '',
                folderName: portfolio && portfolio.name ? portfolio.name : ''
            });
        }
    }
};
</script>

<style scoped>
/* 书籍样式作品集 */
.books-container {
    padding: 40rpx 30rpx 0 30rpx;
    background: var(--app-surface-bg, #fff);
    margin: 0 30rpx 30rpx 30rpx;
    border-radius: 16rpx;
    box-shadow: var(--app-surface-shadow, 0 4rpx 12rpx rgba(0, 0, 0, 0.05));
    border: var(--app-surface-border-line, none);
}

.books-container-inline {
    padding: 0;
    margin: 0;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
    border: none;
    overflow-x: auto;
    overflow-y: hidden;
    margin-left: auto;
}

.books-container-inline::-webkit-scrollbar {
    display: none;
}

.books-container-cover-stack {
    width: 560rpx;
    height: 620rpx;
    padding: 0;
    margin: 0 auto;
    background: transparent;
    border-radius: 0;
    box-shadow: none;
    border: none;
    overflow: visible;
}

.books-shelf {
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 0;
    position: relative;
    padding-bottom: 12rpx;
}

.books-container-inline .books-shelf {
    min-height: 172rpx;
    width: max-content;
    min-width: 100%;
}

.books-container-compact-inline .books-shelf {
    min-height: 158rpx;
    padding-bottom: 8rpx;
}

.books-container-cover-stack .books-shelf {
    width: 100%;
    height: 100%;
    display: block;
    padding-bottom: 0;
    position: relative;
}

.shelf-line {
    position: absolute;
    bottom: 0;
    right: 0;
    height: 12rpx;
    background: #5b3e24;
    border-radius: 2rpx;
    z-index: 1;
}

.books-container-inline .shelf-line {
    height: 8rpx;
    background: #8d7354;
}

.books-container-compact-inline .shelf-line {
    height: 7rpx;
}

.books-container-cover-stack .shelf-line {
    display: none;
}

.book {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s ease;
    position: relative;
    margin-bottom: 0;
}

.books-container-inline .book {
    cursor: default;
    flex: 0 0 auto;
}

.books-container-cover-stack .book {
    position: absolute;
    right: 16rpx;
    bottom: 0;
    width: 484rpx;
    height: 536rpx;
    cursor: default;
}

.book:active {
    transform: scale(0.95);
}

.books-container-inline .book:active {
    transform: none;
}

.books-container-cover-stack .book:active {
    transform: none;
}

.book-spine {
    width: 72rpx;
    border-radius: 20rpx 20rpx 0 0;
    position: relative;
    box-shadow: 2rpx 2rpx 8rpx rgba(0, 0, 0, 0.2);
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 12rpx 0;
    box-sizing: border-box;
}

.books-container-inline .book-spine {
    width: 54rpx;
    border-radius: 14rpx 14rpx 0 0;
    padding: 10rpx 0;
}

.books-container-compact-inline .book-spine {
    width: 84rpx;
    min-height: 116rpx;
    border-radius: 12rpx 12rpx 0 0;
    padding: 8rpx 0;
    box-shadow: 1rpx 2rpx 6rpx rgba(0, 0, 0, 0.16);
}

.books-container-cover-stack .book-spine {
    width: 484rpx;
    height: 536rpx !important;
    padding: 0;
    border-radius: 14rpx;
    box-shadow: none;
    border: 10rpx solid transparent;
}

.books-container-cover-stack .book-1 {
    right: 76rpx;
    bottom: 0;
    z-index: 5;
}

.books-container-cover-stack .book-2 {
    right: 44rpx;
    bottom: 22rpx;
    z-index: 4;
}

.books-container-cover-stack .book-3 {
    right: 22rpx;
    bottom: 44rpx;
    z-index: 3;
}

.books-container-cover-stack .book-4 {
    right: 0;
    bottom: 66rpx;
    z-index: 2;
}

.books-container-cover-stack .book-1 .book-spine {
    background: #00070a;
    border-color: #00070a;
}

.books-container-cover-stack .book-2 .book-spine {
    background: #f5dfba;
    border-color: #f5dfba;
}

.books-container-cover-stack .book-3 .book-spine {
    background: #71805c;
    border-color: #71805c;
}

.books-container-cover-stack .book-4 .book-spine {
    background: #7d2f2a;
    border-color: #bfe9ee;
}

.book-1 .book-spine {
    background: #809076;
}

.book-2 .book-spine {
    background: #f9d794;
}

.book-2 .spine-text {
    color: #333;
}

.book-3 .book-spine {
    background: #2b4139;
}

.book-4 .book-spine {
    background: #d4a574;
}

.book-5 .book-spine {
    background: #8b7d6b;
}

.book-6 .book-spine {
    background: #a4c4bd;
}

.book-7 .book-spine {
    background: #c9cfcf;
}

.book-8 .book-spine {
    background: #906161;
}

.book-9 .book-spine {
    background: #909388;
}

.book-10 .book-spine {
    background: #b8a082;
}

.book-11 .book-spine {
    background: #7a8471;
}

.book-12 .book-spine {
    background: #9b8b7a;
}

/* 为浅色背景的书脊设置深色文字 */
.book-2 .spine-text,
.book-4 .spine-text,
.book-6 .spine-text,
.book-7 .spine-text,
.book-9 .spine-text,
.book-10 .spine-text,
.book-11 .spine-text,
.book-12 .spine-text {
    color: #333;
}

.spine-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.spine-text {
    font-size: 26rpx;
    color: #fff;
    writing-mode: vertical-rl;
    line-height: 1.6;
    letter-spacing: 4rpx;
    text-align: center;
}

.books-container-inline .spine-text {
    font-size: 22rpx;
    line-height: 1.35;
    letter-spacing: 2rpx;
}

.books-container-compact-inline .spine-text {
    font-size: 16rpx;
    line-height: 1.28;
    letter-spacing: 0;
}

.books-container-cover-stack .spine-content {
    display: none;
}

.empty-portfolio {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200rpx;
}

.empty-text {
    font-size: 28rpx;
    color: var(--app-surface-meta-color, #999);
}

[data-app-theme="dark"] .books-container {
    background: #0f1115;
}
</style>
