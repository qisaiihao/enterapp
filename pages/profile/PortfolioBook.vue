<template>
    <view class="books-container" @tap="navigateToPortfolio">
        <view class="books-shelf">
            <!-- 动态显示作品集书籍 -->
            <view
                v-for="(portfolio, index) in portfolioList"
                :key="portfolio._id"
                :class="'book book-' + (index % 12 + 1)"
                @tap.stop="openPortfolio(portfolio)"
            >
                <view class="book-spine" :style="calcBookHeight(portfolio.name)">
                    <view class="spine-content">
                        <text
                            v-for="(char, charIndex) in portfolio.name.split('').slice(0, 7)"
                            :key="charIndex"
                            class="spine-text"
                        >{{ char }}</text>
                    </view>
                </view>
            </view>

            <!-- 动态黑色横线 -->
            <view
                v-if="portfolioList.length > 0"
                class="shelf-line"
                :style="{ width: calcShelfLineWidth(portfolioList.length) }"
            ></view>

            <!-- 如果没有作品集，显示空状态 -->
            <view v-if="portfolioList.length === 0" class="empty-portfolio">
                <text class="empty-text">暂无作品集</text>
            </view>
        </view>
    </view>
</template>

<script>
import { calcBookHeight as calcBookHeightUtil, calcShelfLineWidth } from '@/utils/bookLayout.js';

export default {
    name: 'PortfolioBook',
    props: {
        portfolioList: {
            type: Array,
            default: () => []
        }
    },
    methods: {
        // 计算书籍高度
        calcBookHeight(name) {
            return calcBookHeightUtil(name);
        },

        
        // 计算书架线宽度
        calcShelfLineWidth(count) {
            return calcShelfLineWidth(count);
        },

        // 导航到作品集页面
        navigateToPortfolio() {
            this.$emit('navigate-to-portfolio');
        },

        // 打开作品集
        openPortfolio(portfolio) {
            this.$emit('open-portfolio', portfolio);
        }
    }
};
</script>

<style scoped>
/* 书籍样式作品集 */
.books-container {
    padding: 40rpx 30rpx 0 30rpx;
    background: #fff;
    margin: 0 30rpx 30rpx 30rpx;
    border-radius: 16rpx;
    box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.05);
}

.books-shelf {
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 0;
    position: relative;
    padding-bottom: 12rpx;
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

.book {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: transform 0.2s ease;
    position: relative;
    margin-bottom: 0;
}

.book:active {
    transform: scale(0.95);
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

.empty-portfolio {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200rpx;
}

.empty-text {
    font-size: 28rpx;
    color: #999;
}
</style>