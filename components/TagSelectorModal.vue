<template>
    <!-- 标签选择器弹窗 -->
    <view v-if="show" class="tag-selector-mask" @tap="$emit('close')">
        <view class="tag-selector" @tap.stop>
            <!-- 已选标签显示区域 -->
            <view v-if="selectedTags.length > 0" class="selected-tags-section">
                <view class="selected-tags-title">已选标签：</view>
                <view class="selected-tags-list">
                    <view 
                        class="selected-tag" 
                        v-for="(tag, index) in selectedTags" 
                        :key="index"
                        @tap.stop="onRemoveTag(tag)"
                    >
                        {{ tag }}
                        <text class="remove-icon">×</text>
                    </view>
                </view>
            </view>

            <!-- 分类选择器 -->
            <view class="category-selector">
                <scroll-view class="category-scroll" :scroll-x="true" :show-scrollbar="false">
                    <view class="category-list">
                        <view
                            :class="'category-item ' + (currentCategoryIndex === index ? 'active' : '')"
                            @tap.stop="onSwitchCategory(index)"
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
                    @tap.stop="onSelectTag(item)"
                    v-for="(item, index) in currentCategoryTags"
                    :key="index"
                >
                    {{ item }}
                </view>
            </view>

            <!-- 自定义标签输入 -->
            <view class="custom-tag-input">
                <input 
                    placeholder="输入自定义标签" 
                    :value="customTag" 
                    @input="onCustomTagInput" 
                    @tap.stop 
                    maxlength="10" 
                />
                <button size="mini" @tap.stop="onAddCustomTag">添加</button>
            </view>

            <!-- 匹配的标签推荐 -->
            <view v-if="showMatchedTags && matchedTags.length > 0" class="matched-tags">
                <view class="matched-tags-title">推荐标签：</view>
                <view class="matched-tags-list">
                    <view 
                        class="matched-tag" 
                        @tap.stop="onSelectMatchedTag(item)" 
                        v-for="(item, index) in matchedTags" 
                        :key="index"
                    >
                        {{ item }}
                    </view>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
export default {
    name: 'TagSelectorModal',
    props: {
        show: {
            type: Boolean,
            default: false
        },
        tagCategories: {
            type: Array,
            default: () => []
        },
        selectedTags: {
            type: Array,
            default: () => []
        },
        allExistingTags: {
            type: Array,
            default: () => []
        }
    },
    data() {
        return {
            currentCategoryIndex: 0,
            customTag: '',
            matchedTags: [],
            showMatchedTags: false
        };
    },
    computed: {
        currentCategoryTags() {
            if (this.tagCategories.length > 0 && this.tagCategories[this.currentCategoryIndex]) {
                return this.tagCategories[this.currentCategoryIndex].tags;
            }
            return [];
        }
    },
    watch: {
        // 当弹窗关闭时重置部分状态
        show(val) {
            if (!val) {
                this.customTag = '';
                this.matchedTags = [];
                this.showMatchedTags = false;
            }
        }
    },
    methods: {
        // 切换分类
        onSwitchCategory(index) {
            this.currentCategoryIndex = index;
        },

        // 选择/取消选择标签
        onSelectTag(tag) {
            const tags = [...this.selectedTags];
            const index = tags.indexOf(tag);
            
            if (index > -1) {
                // 取消选择
                tags.splice(index, 1);
            } else {
                // 添加选择
                if (tags.length >= 5) {
                    uni.showToast({ title: '最多选择5个标签', icon: 'none' });
                    return;
                }
                tags.push(tag);
            }
            
            this.$emit('update', tags);
        },

        // 移除已选标签
        onRemoveTag(tag) {
            const tags = this.selectedTags.filter(t => t !== tag);
            this.$emit('update', tags);
        },

        // 自定义标签输入
        onCustomTagInput(e) {
            const inputValue = e.detail.value;
            this.customTag = inputValue;
            this.searchMatchingTags(inputValue);
        },

        // 搜索匹配的标签
        searchMatchingTags(inputValue) {
            if (!inputValue || inputValue.length < 2) {
                this.matchedTags = [];
                this.showMatchedTags = false;
                return;
            }
            
            const matched = this.allExistingTags
                .filter(tag => {
                    const isMatch = tag.toLowerCase().includes(inputValue.toLowerCase());
                    const notSelected = !this.selectedTags.includes(tag);
                    return isMatch && notSelected;
                })
                .slice(0, 5);

            this.matchedTags = matched;
            this.showMatchedTags = matched.length > 0;
        },

        // 选择匹配的推荐标签
        onSelectMatchedTag(tag) {
            if (this.selectedTags.includes(tag)) {
                uni.showToast({ title: '标签已存在', icon: 'none' });
                return;
            }
            if (this.selectedTags.length >= 5) {
                uni.showToast({ title: '最多选择5个标签', icon: 'none' });
                return;
            }
            
            const tags = [...this.selectedTags, tag];
            this.$emit('update', tags);
            this.customTag = '';
            this.matchedTags = [];
            this.showMatchedTags = false;
        },

        // 添加自定义标签
        onAddCustomTag() {
            const tag = this.customTag && this.customTag.trim();
            if (!tag) {
                uni.showToast({ title: '请输入标签内容', icon: 'none' });
                return;
            }
            if (this.selectedTags.includes(tag)) {
                uni.showToast({ title: '标签已存在', icon: 'none' });
                return;
            }
            if (this.selectedTags.length >= 5) {
                uni.showToast({ title: '最多选择5个标签', icon: 'none' });
                return;
            }
            
            const tags = [...this.selectedTags, tag];
            this.$emit('update', tags);
            this.customTag = '';
            this.matchedTags = [];
            this.showMatchedTags = false;
        }
    }
};
</script>

<style scoped>
/* 标签选择弹层 */
.tag-selector-mask {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(0,0,0,.35);
    z-index: 130;
    display: flex;
    align-items: flex-end;
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
}

.tag-selector {
    width: 100%;
    background: #fff;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 40rpx 20rpx calc(40rpx + env(safe-area-inset-bottom));
    min-height: 20vh;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
}

/* 已选标签显示区域样式 */
.selected-tags-section {
    margin-bottom: 20rpx;
    padding-bottom: 15rpx;
    border-bottom: 1px solid #eee;
}

.selected-tags-title {
    font-size: 26rpx;
    color: #666;
    margin-bottom: 10rpx;
    font-weight: 500;
}

.selected-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8rpx;
}

.selected-tag {
    display: flex;
    align-items: center;
    background: #9ed7ee;
    color: white;
    padding: 6rpx 12rpx;
    border-radius: 16rpx;
    font-size: 22rpx;
    position: relative;
    transition: all 0.3s ease;
}

.selected-tag:active {
    background: #7bc4d4;
    transform: scale(0.95);
}

.remove-icon {
    margin-left: 6rpx;
    font-size: 20rpx;
    font-weight: bold;
    opacity: 0.8;
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
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.category-list {
    display: flex;
    gap: 15rpx;
    padding: 10rpx 5rpx;
    min-width: max-content;
}

.category-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 15rpx 12rpx;
    border-radius: 12rpx;
    background: #f5f5f5;
    transition: all 0.3s ease;
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
    max-height: 300rpx;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    margin-left: -5rpx;
    margin-right: -5rpx;
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
    flex-shrink: 0;
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
    max-height: 200rpx;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
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

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(100%);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
