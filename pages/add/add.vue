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
        <view v-if="showColorPicker" class="color-picker-mask" @tap="showColorPicker=false">
            <view class="color-picker" @tap.stop="noop">
                <!-- 色卡选择界面 -->
                <view v-if="colorPickerStep === 'palette'" class="color-palette-step">
                    <view class="color-picker-title">选择色卡</view>
                    <scroll-view class="palette-scroll" :scroll-y="true">
                        <view class="palette-grid">
                            <view 
                                v-for="(palette, index) in colorPalettes" 
                                :key="index" 
                                class="palette-card" 
                                :style="{ backgroundColor: palette.colors[0].backgroundColor }"
                                @tap="selectPalette"
                                :data-index="index"
                            >
                                <view class="palette-name" :style="{ color: palette.colors[0].textColor }">{{ palette.name }}</view>
                                <view class="palette-preview">
                                    <view 
                                        v-for="(color, colorIndex) in palette.colors.slice(0, 3)" 
                                        :key="colorIndex"
                                        class="mini-color"
                                        :style="{ backgroundColor: color.backgroundColor }"
                                    ></view>
                                </view>
                            </view>
                        </view>
                    </scroll-view>
                </view>

                <!-- 具体颜色选择界面 -->
                <view v-if="colorPickerStep === 'colors'" class="color-detail-step">
                    <view class="color-picker-header">
                        <view class="color-picker-title">{{ selectedPalette.name }}</view>
                        <view class="color-picker-back-btn" @tap="goBackToPalette">
                            <image class="color-picker-back-icon" src="/static/images/back_to_edit.png" mode="aspectFit"></image>
                        </view>
                    </view>
                    <scroll-view class="colors-scroll" :scroll-y="true">
                        <view class="colors-grid">
                            <view 
                                v-for="(color, index) in selectedPalette.colors" 
                                :key="index" 
                                class="color-option"
                                :style="{ backgroundColor: color.backgroundColor, color: color.textColor }"
                                @tap="chooseColor"
                                :data-color="color"
                            >
                                <text class="color-text">{{ getPoemLine(index) }}</text>
                                <text v-if="isColorSelected(color)" class="color-check">✓</text>
                            </view>
                        </view>
                    </scroll-view>
                </view>
            </view>
        </view>

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
                    <view v-if="highlightSelecting" class="highlight-selection-modal" 
                          @tap="closeHighlightModal"
                          @touchstart="onHighlightModalTouchStart"
                          @touchmove="onHighlightModalTouchMove"
                          @touchend="onHighlightModalTouchEnd">
                        <view class="highlight-modal-content" @tap.stop="noop" 
                              @touchstart.stop="onHighlightModalTouchStart"
                              @touchmove.stop="onHighlightModalTouchMove"
                              @touchend.stop="onHighlightModalTouchEnd">
                            <!-- 标题栏 -->
                            <view class="highlight-modal-header">
                                <text class="highlight-modal-title">选择高光句</text>
                                <view class="highlight-modal-close" @tap="closeHighlightModal">×</view>
                            </view>
                            
                            <!-- 内容选择区域 -->
                            <view class="highlight-content-wrapper">
                                <view class="highlight-content-display">
                                    <text class="highlight-content-line" v-for="(line, index) in splitContentLines"
                                          :key="'highlight-line-' + index"
                                          :class="{ 'selected-line': highlightSelectedLineIndices.includes(index) }"
                                          @tap.stop="toggleHighlightLine"
                                          :data-index="index">
                                        {{ line || '\u00A0' }}
                                    </text>
                                </view>
                            </view>
                            
                            <!-- 底部操作栏 -->
                            <view class="highlight-modal-actions">
                                <view class="highlight-action-btn primary" @tap.stop="finishHighlight" :class="{ 'disabled': highlightSelectedLineIndices.length === 0 }">
                                    <image class="highlight-action-icon" src="/static/images/confirm_selection.png" mode="aspectFill"></image>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>

                <!-- 右侧工具栏 -->
                <view class="side-toolbar">
                    <!-- 加标签按钮 -->
                    <view class="side-tool-btn" @tap.stop="toggleTagSelector">
                        <image class="side-tool-icon" src="/static/images/add_tag.png" mode="aspectFit"></image>
                    </view>
                    
                    <!-- 配图按钮 -->
                    <view class="side-tool-btn" @tap.stop="handleChooseImage">
                        <image class="side-tool-icon" src="/static/images/add_image.png" mode="aspectFit"></image>
                    </view>
                    
                    <!-- 切换发布模式按钮 -->
                    <view class="side-tool-btn mode-switch-btn" @tap.stop="switchMode">
                        <image class="side-tool-icon mode-switch-icon" src="/static/images/change.png" mode="aspectFit" alt="切换发布模式"></image>
                    </view>
                    
                    <!-- 选择高光句按钮 -->
                    <view class="side-tool-btn" @tap.stop="toggleHighlightMode">
                        <image class="side-tool-icon" src="/static/images/select_highlight.png" mode="aspectFit"></image>
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
        <view v-if="showModeSelector" class="mode-selector-mask" @tap="showModeSelector=false">
            <view class="mode-selector" @tap.stop="noop">
                <image class="mode-switch-modal-icon" src="/static/images/change.png" mode="aspectFit" alt="切换发布模式"></image>
                <view class="mode-title">选择发布模式</view>
                <view class="mode-list">
                    <view class="mode-option" @tap="selectPublishMode" :data-mode="'poem'" :data-original="true">
                        <view class="mode-text">原创诗歌</view>
                        <view v-if="publishMode === 'poem' && isOriginal" class="mode-check">✓</view>
                    </view>
                    <view class="mode-option" @tap="selectPublishMode" :data-mode="'poem'" :data-original="false">
                        <view class="mode-text">非原创诗歌</view>
                        <view v-if="publishMode === 'poem' && !isOriginal" class="mode-check">✓</view>
                    </view>
                    <view class="mode-option" @tap="selectPublishMode" :data-mode="'normal'" :data-original="null">
                        <view class="mode-text">普通帖子</view>
                        <view v-if="publishMode === 'normal'" class="mode-check">✓</view>
                    </view>
                    <view class="mode-option" @tap="selectPublishMode" :data-mode="'discussion'" :data-original="null">
                        <view class="mode-text">讨论帖子</view>
                        <view v-if="publishMode === 'discussion'" class="mode-check">✓</view>
                    </view>
                </view>
            </view>
        </view>

        <!-- 标签选择器 -->
        <view v-if="showTagSelector" class="tag-selector-mask" @tap="showTagSelector=false">
            <view class="tag-selector" @tap.stop="noop">
                <!-- 已选标签显示区域 -->
                <view v-if="selectedTags.length > 0" class="selected-tags-section">
                    <view class="selected-tags-title">已选标签：</view>
                    <view class="selected-tags-list">
                        <view 
                            class="selected-tag" 
                            v-for="(tag, index) in selectedTags" 
                            :key="index"
                            @tap.stop="removeTag"
                            :data-tag="tag"
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
                                @tap.stop="switchCategory"
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
                        @tap.stop="selectTag"
                        :data-tag="item"
                        v-for="(item, index) in tagCategories[currentCategoryIndex].tags"
                        :key="index"
                    >
                        {{ item }}
                    </view>
                </view>

                <!-- 自定义标签输入 -->
                <view class="custom-tag-input">
                    <input placeholder="输入自定义标签" :value="customTag" @input="onCustomTagInput" @tap.stop="noop" maxlength="10" />
                    <button size="mini" @tap.stop="addCustomTag">添加</button>
                </view>

                <!-- 匹配的标签推荐 -->
                <view v-if="showMatchedTags && matchedTags.length > 0" class="matched-tags">
                    <view class="matched-tags-title">推荐标签：</view>
                    <view class="matched-tags-list">
                        <view class="matched-tag" @tap.stop="selectMatchedTag" :data-tag="item" v-for="(item, index) in matchedTags" :key="index">
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
const { readFileAsBase64 } = require('../../utils/fileReader.js');
export default {
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
            
            // 诗歌句子数组
            poemLines: [
                '为什么到处都是冰凌',
                '因为此地是妆台',
                '玫瑰即花香',
                '塞尚的苹果我全都消受不来',
                '黄昏织满了红雀的翅膀',
                '她在那独自成婚',
                '我却不肯蓝',
                '石榴爆裂',
                '我敞开我的花衣',
                '时代的郁金香雷雨',
                '悲伤的童年的甜美',
                '它甜过草莓，甜过蜜',
                '星星或许会相视大笑',
                '膨胀的虱子',
                '我的河流和你的河流',
                '饭后的一场睡眠',
                '模糊而黯然神伤的镜子',
                '你如同忧郁这个字',
                '湖底其实无底',
                '眼下是春天',
                '梦像鸟儿一样飞了',
                '猫太咸了',
                '我安然而坐',
                '青苔说了另一半',
                '橄榄树林的一阵悲风',
                '影子不会死',
                '我不问皑皑白雪',
                '胭脂用尽时',
                '争渡，争渡',
                '昨日之日不可留',
                '飘飘何所似',
                '此闲行',
                '我做云',
                '恐美人之迟暮',
                '太阳天天新天天旧',
                '但岸陆表示怀疑',
                '通过我',
                '一毛税也不用交',
                '所有的城市都是船',
                '它荒草萋萋',
                '你不仅是安妮塔',
                '马蹄正在踢着石头',
                '做坏事像下雨',
                '这位死了的女士的眼睛对我诉说',
                '吻向虚空的齿列',
                '一场樱花人生',
                '感叹号太漫不经心',
                '祝太阳万岁',
                '只要你要',
                '你这只人类的小舟',
                '如果你吻我',
                '鸢尾花开遍窗前和心峦',
                '此身仍是草芥',
                '一朵百合的馨香将弥漫河畔',
                '这时天将大雪降在巴黎',
                '好等你醒来与我相识',
                '三等车厢的夏天',
                '修辞而已',
                '无性别的卵',
                '一个看不见的热吻',
                '一切被称作大地的',
                '在电梯里想着乡野',
                '生人即离别',
                '打开、关闭、打开',
                '因云和树的倒影不是云和树而受苦',
                '食盐戏法',
                '必要的真空',
                '我是一汪黑水',
                '地球颠倒两极',
                '请把世界装进一只牡蛎',
                '菩萨难写（许裕全）',
                '红藕香残玉簟秋',
                '轻解罗裳',
                '独上兰舟',
                '云中谁寄锦书来',
                '雁字回时',
                '月满西楼',
                '花自飘零水自流',
                '一种相思',
                '两处闲愁',
                '此情无计可消除',
                '才下眉头',
                '却上心头'
            ],
            
            // 色卡数据
            colorPalettes: [
                {
                    name: 'Darlington',
                    colors: [
                        { backgroundColor: '#ACCAB2', textColor: '#D44720' },
                        { backgroundColor: '#E9A752', textColor: '#78614D' },
                        { backgroundColor: '#D44720', textColor: '#F0E6D5' },
                        { backgroundColor: '#78614D', textColor: '#E9A752' }
                    ]
                },
                {
                    name: 'True Navy',
                    colors: [
                        { backgroundColor: '#28374D', textColor: '#DDE6ED' },
                        { backgroundColor: '#536D82', textColor: '#DDE6ED' },
                        { backgroundColor: '#9DB2BF', textColor: '#28374D' },
                        { backgroundColor: '#DDE6ED', textColor: '#28374D' }
                    ]
                },
                {
                    name: 'Inkwell',
                    colors: [
                        { backgroundColor: '#2C3639', textColor: '#DCD7C9' },
                        { backgroundColor: '#3F4E4F', textColor: '#DCD7C9' },
                        { backgroundColor: '#A27B5B', textColor: '#2C3639' },
                        { backgroundColor: '#DCD7C9', textColor: '#2C3639' }
                    ]
                },
                {
                    name: 'Olive',
                    colors: [
                        { backgroundColor: '#706134', textColor: '#FAE7C9' },
                        { backgroundColor: '#B0926A', textColor: '#706134' },
                        { backgroundColor: '#E1C78F', textColor: '#706134' },
                        { backgroundColor: '#FAE7C9', textColor: '#706134' }
                    ]
                },
                {
                    name: 'Red Chai',
                    colors: [
                        { backgroundColor: '#632626', textColor: '#DBCB96' },
                        { backgroundColor: '#9D5353', textColor: '#DBCB96' },
                        { backgroundColor: '#BF8B67', textColor: '#632626' },
                        { backgroundColor: '#DBCB96', textColor: '#632626' }
                    ]
                },
                {
                    name: 'Cotton',
                    colors: [
                        { backgroundColor: '#EDEBBD', textColor: '#1B1717' },
                        { backgroundColor: '#810100', textColor: '#EDEBBD' },
                        { backgroundColor: '#630000', textColor: '#EDEBBD' },
                        { backgroundColor: '#1B1717', textColor: '#EDEBBD' }
                    ]
                },
                {
                    name: '宣纸白鸢尾蓝',
                    colors: [
                        { backgroundColor: '#F9F2E0', textColor: '#1660AB' },
                        { backgroundColor: '#1660AB', textColor: '#F9F2E0' }
                    ]
                },
                {
                    name: 'Emerald Green',
                    colors: [
                        { backgroundColor: '#28413B', textColor: '#F8D794' },
                        { backgroundColor: '#809076', textColor: '#111A1B' },
                        { backgroundColor: '#F8D794', textColor: '#111A1B' },
                        { backgroundColor: '#B8682C', textColor: '#111A1B' },
                        { backgroundColor: '#111A1B', textColor: '#F8D794' }
                    ]
                },
                {
                    name: 'Space Cadet',
                    colors: [
                        { backgroundColor: '#25344F', textColor: '#D5B893' },
                        { backgroundColor: '#617891', textColor: '#D5B893' },
                        { backgroundColor: '#D5B893', textColor: '#25344F' },
                        { backgroundColor: '#6F4D38', textColor: '#D5B893' },
                        { backgroundColor: '#632024', textColor: '#D5B893' }
                    ]
                },
                {
                    name: 'Jasper Orange',
                    colors: [
                        { backgroundColor: '#E48F50', textColor: '#2D293B' },
                        { backgroundColor: '#753130', textColor: '#729BAE' },
                        { backgroundColor: '#2D293B', textColor: '#E48F50' },
                        { backgroundColor: '#60859E', textColor: '#2D293B' },
                        { backgroundColor: '#729BAE', textColor: '#2D293B' }
                    ]
                },
                {
                    name: 'Maastricht Blue',
                    colors: [
                        { backgroundColor: '#041A38', textColor: '#D8E7EE' },
                        { backgroundColor: '#4A9ACB', textColor: '#041A38' },
                        { backgroundColor: '#97D4F1', textColor: '#041A38' },
                        { backgroundColor: '#394C5C', textColor: '#D8E7EE' },
                        { backgroundColor: '#D8E7EE', textColor: '#041A38' }
                    ]
                },
                {
                    name: 'Dark Sienna',
                    colors: [
                        { backgroundColor: '#481718', textColor: '#93A292' },
                        { backgroundColor: '#CA5655', textColor: '#F3EBE0' },
                        { backgroundColor: '#93A292', textColor: '#481718' },
                        { backgroundColor: '#39703D', textColor: '#F3EBE0' },
                        { backgroundColor: '#75B974', textColor: '#481718' }
                    ]
                },
                {
                    name: 'Medium Carmine',
                    colors: [
                        { backgroundColor: '#AF3D41', textColor: '#EAC891' },
                        { backgroundColor: '#70A3AC', textColor: '#131A1F' },
                        { backgroundColor: '#5393A3', textColor: '#131A1F' },
                        { backgroundColor: '#17566F', textColor: '#EAC891' },
                        { backgroundColor: '#131A1F', textColor: '#AF3D41' }
                    ]
                },
                {
                    name: 'Hot Paprika',
                    colors: [
                        { backgroundColor: '#B53324', textColor: '#F5E2CE' },
                        { backgroundColor: '#E5A657', textColor: '#B53324' },
                        { backgroundColor: '#DFBC94', textColor: '#B53324' },
                        { backgroundColor: '#F5E2CE', textColor: '#B53324' }
                    ]
                },
                {
                    name: 'Terracota',
                    colors: [
                        { backgroundColor: '#D08224', textColor: '#EAC891' },
                        { backgroundColor: '#AE431E', textColor: '#EAC891' },
                        { backgroundColor: '#8A8635', textColor: '#EAC891' },
                        { backgroundColor: '#EAC891', textColor: '#AE431E' }
                    ]
                },
                {
                    name: 'Shell Beige',
                    colors: [
                        { backgroundColor: '#F4C9AC', textColor: '#756C4F' },
                        { backgroundColor: '#EF9E70', textColor: '#756C4F' },
                        { backgroundColor: '#AE6455', textColor: '#F4C9AC' },
                        { backgroundColor: '#756C4F', textColor: '#F4C9AC' }
                    ]
                },
                {
                    name: 'Lady Diana',
                    colors: [
                        { backgroundColor: '#EAD7E4', textColor: '#818B70' },
                        { backgroundColor: '#FCC5DB', textColor: '#818B70' },
                        { backgroundColor: '#FF8486', textColor: '#FFFFFF' },
                        { backgroundColor: '#818B70', textColor: '#EAD7E4' }
                    ]
                },
                {
                    name: 'Ocean Deep',
                    colors: [
                        { backgroundColor: '#4E635E', textColor: '#E2E0CB' },
                        { backgroundColor: '#E2E0CB', textColor: '#4E635E' },
                        { backgroundColor: '#A8B49E', textColor: '#4E635E' },
                        { backgroundColor: '#818C78', textColor: '#E2E0CB' }
                    ]
                },
                {
                    name: 'Almond',
                    colors: [
                        { backgroundColor: '#D6BD98', textColor: '#1A3636' },
                        { backgroundColor: '#677D6A', textColor: '#D6BD98' },
                        { backgroundColor: '#40534C', textColor: '#D6BD98' },
                        { backgroundColor: '#1A3636', textColor: '#D6BD98' }
                    ]
                }
            ],

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
        },
        placeholderText() {
            console.log('【Add】计算placeholderText:', {
                publishMode: this.publishMode,
                isOriginal: this.isOriginal
            });
            
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
                console.log('【Add】publishMode变化:', { oldVal, newVal, isOriginal: this.isOriginal });
                this.updatePlaceholder();
            },
            immediate: true
        },
        isOriginal: {
            handler(newVal, oldVal) {
                console.log('【Add】isOriginal变化:', { oldVal, newVal, publishMode: this.publishMode });
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
            console.log('【Add】更新placeholder:', {
                publishMode: this.publishMode,
                isOriginal: this.isOriginal
            });
            
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
            
            console.log('【Add】placeholder已更新为:', newPlaceholder);
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
                
                console.log('来源页面路由:', prevRoute);
                
                if (prevRoute === 'pages/poem-square/poem-square') {
                    // 从poem-square进入，设置为原创诗歌模式
                    this.setData({
                        publishMode: 'poem',
                        isOriginal: true,
                        maxImageCount: 1,
                        imageList: this.imageList.length > 1 ? [this.imageList[0]] : this.imageList // 限制图片数量
                    });
                    console.log('设置为原创诗歌模式');
                } else if (prevRoute === 'pages/mountain/mountain') {
                    // 从mountain进入，设置为非原创诗歌模式
                    this.setData({
                        publishMode: 'poem',
                        isOriginal: false,
                        maxImageCount: 1,
                        imageList: this.imageList.length > 1 ? [this.imageList[0]] : this.imageList // 限制图片数量
                    });
                    console.log('设置为非原创诗歌模式');
                }
                // 从其他页面进入时，保持草稿中的设置或默认设置
            }
        },


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

        // 加载帖子数据用于编辑
        loadPostForEdit: function (postId) {
            console.log('【Add】加载帖子用于编辑，postId:', postId);
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
            // 设置导航标志，防止递归调用
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

        // 选择色卡
        selectPalette: function (e) {
            const index = e.currentTarget.dataset.index;
            const palette = this.colorPalettes[index];
            this.setData({
                selectedPalette: palette,
                colorPickerStep: 'colors'
            });
        },

        // 返回色卡选择
        goBackToPalette: function () {
            this.setData({
                colorPickerStep: 'palette',
                selectedPalette: null
            });
        },

        // 获取诗歌句子
        getPoemLine: function(index) {
            // 使用全局文案索引，确保每个颜色组内的不同颜色显示不同文案
            const globalIndex = this.getGlobalTextIndex(index);
            return this.poemLines[globalIndex] || '示例文字';
        },

        // 获取全局文案索引
        getGlobalTextIndex: function(localIndex) {
            // 计算当前颜色组在全局色卡中的起始位置
            const currentPaletteIndex = this.getCurrentPaletteIndex();
            const colorsBeforeCurrent = this.getColorsCountBeforeCurrent();
            return (colorsBeforeCurrent + localIndex) % this.poemLines.length;
        },

        // 获取当前色卡在色卡数组中的索引
        getCurrentPaletteIndex: function() {
            if (!this.selectedPalette) return 0;
            return this.colorPalettes.findIndex(palette => palette.name === this.selectedPalette.name);
        },

        // 获取当前色卡之前所有色卡的颜色总数
        getColorsCountBeforeCurrent: function() {
            const currentIndex = this.getCurrentPaletteIndex();
            let count = 0;
            for (let i = 0; i < currentIndex; i++) {
                count += this.colorPalettes[i].colors.length;
            }
            return count;
        },

        // 检查颜色是否被选中
        isColorSelected: function (color) {
            return this.selectedColorCombination && 
                   this.selectedColorCombination.backgroundColor === color.backgroundColor &&
                   this.selectedColorCombination.textColor === color.textColor;
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
                highlightSelecting: !this.highlightSelecting
            });
        },

        // 关闭高光选择弹窗
        closeHighlightModal: function () {
            this.setData({
                highlightSelecting: false
            });
        },

        // 高光弹窗触摸事件处理
        onHighlightModalTouchStart: function (e) {
            console.log('高光弹窗触摸开始');
            const touch = e.touches[0];
            this.highlightModalTouchStartX = touch.pageX || touch.clientX;
            this.highlightModalTouchStartY = touch.pageY || touch.clientY;
            this.highlightModalTouchCurrentX = touch.pageX || touch.clientX;
            this.highlightModalTouchCurrentY = touch.pageY || touch.clientY;
            console.log('触摸开始位置:', this.highlightModalTouchStartX, this.highlightModalTouchStartY);
        },

        onHighlightModalTouchMove: function (e) {
            const touch = e.touches[0];
            this.highlightModalTouchCurrentX = touch.pageX || touch.clientX;
            this.highlightModalTouchCurrentY = touch.pageY || touch.clientY;
        },

        onHighlightModalTouchEnd: function (e) {
            console.log('高光弹窗触摸结束');
            const deltaX = this.highlightModalTouchCurrentX - this.highlightModalTouchStartX;
            const deltaY = Math.abs(this.highlightModalTouchCurrentY - this.highlightModalTouchStartY);
            
            console.log('滑动距离 - deltaX:', deltaX, 'deltaY:', deltaY);
            
            // 只有当水平滑动距离明显大于垂直滑动距离时，才认为是水平滑动
            // 这样可以避免垂直滑动（如下滑）意外触发退出
            if (Math.abs(deltaX) > deltaY && Math.abs(deltaX) > 30) {
                console.log('检测到水平滑动，退出高光选择');
                this.exitHighlightModalToEdit();
            }
        },

        // 退出高光弹窗到编辑界面
        exitHighlightModalToEdit: function () {
            this.setData({
                highlightSelecting: false
            });
            // 这里可以添加其他逻辑，比如保存当前选择的高光句等
            uni.showToast({ 
                title: '已退出高光选择', 
                icon: 'none',
                duration: 1000
            });
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
            this.setData({ 
                selectedBackgroundColor: color.backgroundColor,
                selectedTextColor: color.textColor,
                selectedColorCombination: color,
                showColorPicker: false,
                colorPickerStep: 'palette' // 重置步骤
            });
            uni.showToast({ title: '已设置颜色搭配', icon: 'success' });
        },

        noop() {},

        // 分类切换功能
        switchCategory: function (e) {
            const index = e.currentTarget.dataset.index;
            this.setData({
                currentCategoryIndex: index
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
            this.setData({ customTag: inputValue });
            // 实时搜索匹配标签
            this.searchMatchingTags(inputValue);
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


/* 模式选择器 */
/* 模式选择器遮罩 */
.mode-selector-mask {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(0,0,0,.35);
    z-index: 130;
    display: flex;
    align-items: flex-end;
}

.mode-selector {
    width: 100%;
    background: #fff;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
}

.mode-title {
    font-size: 30rpx;
    color: #333;
    text-align: center;
    margin-bottom: 24rpx;
    font-weight: 500;
}

.mode-list {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.mode-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24rpx 0;
    border-bottom: 1rpx solid #f0f0f0;
    transition: all 0.2s ease;
}

.mode-option:last-child {
    border-bottom: none;
}

.mode-option:active {
    background: #f8f9fa;
}

.mode-text {
    font-size: 28rpx;
    color: #333;
    flex: 1;
}

.mode-check {
    color: #1c9bd6;
    font-size: 28rpx;
    font-weight: bold;
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
    /* 确保遮罩层覆盖整个屏幕 */
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
}

.tag-selector {
    width: 100%;
    background: #fff;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 40rpx 20rpx calc(40rpx + env(safe-area-inset-bottom)); /* 减少左右padding，给更多显示空间 */
    min-height: 20vh;
    max-height: 85vh; /* 增加最大高度，给更多显示空间 */
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
    /* 确保内容可以滚动 */
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* 确保弹窗不会被截断 */
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
    /* 确保滚动区域能正常显示 */
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
}

.category-list {
    display: flex;
    gap: 15rpx;
    padding: 10rpx 5rpx; /* 减少左右padding，给更多显示空间 */
    /* 确保列表能正常滚动 */
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
    /* 移除min-width限制，让内容自然适应 */
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
    /* 确保标签区域可以正常显示 */
    max-height: 300rpx;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    /* 减少左右边距，给更多显示空间 */
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
    /* 移除min-width限制，让按钮根据内容自适应 */
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
    /* 确保推荐标签区域可以正常显示 */
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
    width: 90rpx; /* 调整按钮尺寸 */
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

.mode-switch-modal-icon {
    width: 72rpx;
    height: 72rpx;
    margin: 0 auto 20rpx;
    display: block;
}

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

/* 颜色选择弹层 */
.color-picker-mask { 
    position: fixed; 
    left: 0; 
    right: 0; 
    top: 0; 
    bottom: 0; 
    background: rgba(0,0,0,.35); 
    z-index: 130; 
    display: flex; 
    align-items: flex-end; 
}

.color-picker {
    width: 100%;
    background: #fff;
    border-top-left-radius: 24rpx;
    border-top-right-radius: 24rpx;
    padding: 24rpx 28rpx calc(24rpx + env(safe-area-inset-bottom));
    min-height: 50vh; /* 最小高度设为半屏 */
    max-height: 70vh; /* 限制最大高度为70%屏幕高度 */
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease;
}

.color-picker-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
    flex: 1;
    text-align: center;
}

.color-picker-header {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;
    position: relative;
}

.color-picker-back-btn {
    position: absolute;
    top: 0;
    right: 0;
    width: 80rpx;
    height: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border-radius: 50%;
    z-index: 10;
}

.color-picker-back-icon {
    width: 60rpx;
    height: 60rpx;
}


/* 色卡选择界面 */
.color-palette-step {
    display: flex;
    flex-direction: column;
    height: 100%;
}

.color-palette-step .color-picker-title {
    margin-bottom: 32rpx; /* 增加标题下方的间距 */
}

.palette-scroll {
    flex: 1;
    min-height: 800rpx;
    max-height: 1000rpx;
}

.palette-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    grid-gap: 20rpx;
    padding: 0 10rpx;
}

.palette-card {
    height: 120rpx;
    border-radius: 16rpx;
    padding: 16rpx;
    position: relative;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,.1);
    transition: transform 0.2s ease;
}

.palette-card:active {
    transform: scale(0.98);
}

.palette-name {
    font-size: 24rpx;
    font-weight: 600;
    margin-bottom: 8rpx;
    text-shadow: 0 1rpx 2rpx rgba(0,0,0,0.3);
}

.palette-preview {
    display: flex;
    gap: 8rpx;
}

.mini-color {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    border: 2rpx solid rgba(255,255,255,0.5);
}

/* 具体颜色选择界面 */
.colors-scroll {
    flex: 1;
    min-height: 800rpx;
    max-height: 1000rpx;
}

.colors-grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    grid-gap: 16rpx;
    padding: 0 10rpx;
}

.color-option {
    height: 100rpx;
    border-radius: 16rpx;
    padding: 20rpx;
    position: relative;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,.1);
    transition: transform 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.color-option:active {
    transform: scale(0.98);
}

.color-text {
    font-size: 28rpx;
    font-weight: 500;
}

.color-check { 
    position: absolute; 
    right: 20rpx; 
    top: 50%;
    transform: translateY(-50%);
    font-size: 32rpx; 
    font-weight: bold;
    text-shadow: 0 1rpx 2rpx rgba(0,0,0,.3); 
}

/* 高光选择全屏弹窗样式 */
.highlight-selection-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #fff;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    /* 考虑状态栏高度，确保内容在安全区域内，并增加额外边距 */
    padding-top: 60px; /* 增加默认状态栏高度，作为备用 */
    padding-top: calc(env(safe-area-inset-top) + 16px);
    padding-top: calc(constant(safe-area-inset-top) + 16px); /* iOS 11.0-11.2 兼容 */
}

.highlight-modal-content {
    width: 100%;
    height: 100%;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* 调整高度以适应顶部padding，增加额外边距 */
    height: calc(100% - 60px); /* 增加默认状态栏高度，作为备用 */
    height: calc(100% - env(safe-area-inset-top) - 16px);
    height: calc(100% - constant(safe-area-inset-top) - 16px); /* iOS 11.0-11.2 兼容 */
}

.highlight-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 30rpx 40rpx;
    border-bottom: 1rpx solid #f0f0f0;
    background: #fff;
}

.highlight-modal-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #333;
}

.highlight-modal-close {
    width: 60rpx;
    height: 60rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40rpx;
    color: #999;
    border-radius: 50%;
    background: #f5f5f5;
}

.highlight-content-wrapper {
    flex: 1;
    padding: 40rpx;
    overflow-y: auto;
    background: #fff;
}

.highlight-content-display {
    display: flex;
    flex-direction: column;
}

.highlight-content-line {
    display: block;
    margin-bottom: 16rpx;
    padding: 12rpx 16rpx;
    border-radius: 8rpx;
    line-height: 1.8;
    font-size: 36rpx;
    white-space: pre-wrap;
    word-break: break-word;
    color: #999;
    transition: all 0.2s ease;
}

.highlight-content-line.selected-line {
    color: #000;
    font-weight: 500;
}

.highlight-modal-actions {
    position: fixed;
    bottom: 60rpx;
    right: 30rpx;
    z-index: 1001;
}

.highlight-action-btn {
    width: 140rpx;
    height: 140rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.highlight-action-btn.primary {
    background: transparent;
}

.highlight-action-btn.primary.disabled {
    opacity: 0.5;
}

.highlight-action-btn:active {
    transform: scale(0.95);
}

.highlight-action-text {
    font-size: 28rpx;
    font-weight: 500;
}

.highlight-action-icon {
    width: 120rpx;
    height: 120rpx;
}

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
        width: 50rpx;
        height: 50rpx;
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
        width: 70rpx;
        height: 70rpx;
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







