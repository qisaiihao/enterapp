/**
 * 触觉反馈工具
 * 让用户在关键交互时获得触觉反馈，提升操作确认感
 */

/**
 * 轻触反馈 - 用于普通按钮点击、Tab切换
 */
export function lightImpact() {
    // #ifdef APP-PLUS
    try {
        plus.device.vibrate(15);
    } catch (e) {}
    // #endif
    
    // #ifdef MP-WEIXIN
    try {
        wx.vibrateShort({ type: 'light' });
    } catch (e) {}
    // #endif
}

/**
 * 中等反馈 - 用于点赞、收藏等操作
 */
export function mediumImpact() {
    // #ifdef APP-PLUS
    try {
        plus.device.vibrate(25);
    } catch (e) {}
    // #endif
    
    // #ifdef MP-WEIXIN
    try {
        wx.vibrateShort({ type: 'medium' });
    } catch (e) {}
    // #endif
}

/**
 * 重触反馈 - 用于删除、重要确认等操作
 */
export function heavyImpact() {
    // #ifdef APP-PLUS
    try {
        plus.device.vibrate(40);
    } catch (e) {}
    // #endif
    
    // #ifdef MP-WEIXIN
    try {
        wx.vibrateShort({ type: 'heavy' });
    } catch (e) {}
    // #endif
}

/**
 * 成功反馈 - 用于操作成功提示
 */
export function successNotification() {
    // #ifdef APP-PLUS
    try {
        // 模式：短-停-短
        plus.device.vibrate(15);
        setTimeout(() => plus.device.vibrate(15), 100);
    } catch (e) {}
    // #endif
    
    // #ifdef MP-WEIXIN
    try {
        wx.vibrateShort({ type: 'light' });
    } catch (e) {}
    // #endif
}

/**
 * 选择变化反馈 - 用于选择器滚动
 */
export function selectionChanged() {
    // #ifdef APP-PLUS
    try {
        plus.device.vibrate(10);
    } catch (e) {}
    // #endif
    
    // #ifdef MP-WEIXIN
    try {
        wx.vibrateShort({ type: 'light' });
    } catch (e) {}
    // #endif
}

export default {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successNotification,
    selectionChanged
};
