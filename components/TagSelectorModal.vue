<template>
    <!-- 标签选择器弹窗 -->
    <AppMotion :visible="show" ref="tagMotion" placement="sheet" @dismiss="$emit('close')" mask-class="tag-selector-mask" :mask-dark="isDark" close-on-mask>
        <view class="tag-selector app-motion-panel" @tap.stop>
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
    </AppMotion>
</template>

<script>
import AppMotion from '@/components/overlay/AppMotion.vue';
export default {
    components: { AppMotion },
    name: 'TagSelectorModal',
    emits: ['close', 'update'],
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
        },
        isDark: {
            type: Boolean,
            default: false
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


.tag-selector {
    width: 100%;
    background: var(--app-elevated-bg, #fff);
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 40rpx 20rpx calc(40rpx + env(safe-area-inset-bottom));
    min-height: 20vh;
    max-height: 85vh;
    display: flex;
    flex-direction: column;

    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
}

/* 已选标签显示区域样式 */
.selected-tags-section {
    margin-bottom: 20rpx;
    padding-bottom: 15rpx;
    border-bottom: 1px solid var(--app-border-color, #eee);
}

.selected-tags-title {
    font-size: 26rpx;
    color: var(--app-secondary-text, #666);
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
    background: var(--app-control-accent-bg, #333333);
    color: var(--app-control-accent-text, #ffffff);
    padding: 10rpx 18rpx;
    border-radius: 44rpx;
    font-size: 22rpx;
    position: relative;
    transition: all 0.3s ease;
    font-weight: 500;
    box-shadow: none;
    border-color: var(--app-control-accent-bg, #333333);
}

.selected-tag:active {
    background: var(--app-control-accent-bg, #333333);
    transform: none;
    opacity: 0.65;
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
    border-bottom: 1px solid var(--app-border-color, #eee);
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
    padding: 16rpx 20rpx;
    border-radius: 24rpx;
    background: var(--app-control-soft-bg, #f5f6f7);
    transition: all 0.3s ease;
    flex-shrink: 0;
    color: var(--app-link-color, #333333);
}

.category-item.active {
    background: var(--app-control-accent-bg, #333333);
    color: var(--app-control-accent-text, #ffffff);
    border-radius: 24rpx;
    font-weight: 500;
    box-shadow: none;
    border-color: var(--app-control-accent-bg, #333333);
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
    padding: 12rpx 20rpx;
    background: var(--app-control-soft-bg, #f5f6f7);
    border: 1rpx solid var(--app-control-border, #dddddd);
    border-radius: 32rpx;
    font-size: 24rpx;
    color: var(--app-link-color, #333333);
    transition: all 0.3s ease;
}

.preset-tag.selected {
    background: var(--app-control-accent-bg, #333333);
    color: var(--app-control-accent-text, #ffffff);
    border-color: var(--app-control-accent-bg, #333333);
    border-radius: 44rpx;
    font-weight: 500;
    box-shadow: none;
}

.custom-tag-input {
    display: flex;
    align-items: center;
    gap: 10rpx;
}

.custom-tag-input input {
    flex: 1;
    height: 72rpx;
    border: none;
    border-radius: 16rpx;
    padding: 0 15rpx;
    font-size: 26rpx;
    background: var(--app-control-soft-bg, #f5f6f7);
    color: var(--app-link-color, #333333);
    min-width: 0;
}

.custom-tag-input button {
    background: var(--app-control-accent-bg, #333333);
    color: var(--app-control-accent-text, #ffffff);
    border: none;
    border-radius: 44rpx;
    padding: 0 28rpx;
    height: 72rpx;
    font-size: 24rpx;
    flex-shrink: 0;
    font-weight: 500;
    box-shadow: none;
    border-color: var(--app-control-accent-bg, #333333);
    line-height: 72rpx;
}

/* 匹配标签推荐样式 */
.matched-tags {
    margin-top: 15rpx;
    padding: 15rpx;
    background: var(--app-subtle-surface-bg, #f8f9fa);
    border-radius: 8rpx;
    border: 1rpx solid var(--app-control-border, #dddddd);
}

.matched-tags-title {
    font-size: 24rpx;
    color: var(--app-secondary-text, #666);
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
    background: var(--app-control-soft-bg, #f5f6f7);
    color: var(--app-link-color, #333333);
    padding: 10rpx 18rpx;
    border-radius: 32rpx;
    font-size: 22rpx;
    border: 1rpx solid var(--app-control-border, #dddddd);
    transition: all 0.2s ease;
}

.matched-tag:active {
    background: var(--app-control-soft-bg, #f5f6f7);
    transform: none;
    opacity: 0.65;
}


.category-item:active, .preset-tag:active, .custom-tag-input button:active { opacity: 0.65; }
.custom-tag-input button::after { border: none; }
.category-name { color: inherit; }

</style>
