const IOS_IMPACT_STYLE = {
    light: 0,
    medium: 1,
    heavy: 2
};

function isIOSApp() {
    // #ifdef APP-PLUS
    try {
        return plus.os.name === 'iOS';
    } catch (error) {}
    // #endif
    return false;
}

function iosImpact(style) {
    // #ifdef APP-PLUS
    if (!isIOSApp() || !plus.ios) return false;
    try {
        const UIImpactFeedbackGenerator = plus.ios.importClass('UIImpactFeedbackGenerator');
        const generator = UIImpactFeedbackGenerator.alloc().initWithStyle(style);
        if (!generator) return false;
        generator.prepare();
        generator.impactOccurred();
        plus.ios.deleteObject(generator);
        return true;
    } catch (error) {
        return false;
    }
    // #endif
    return false;
}

function iosSelection() {
    // #ifdef APP-PLUS
    if (!isIOSApp() || !plus.ios) return false;
    try {
        const UISelectionFeedbackGenerator = plus.ios.importClass('UISelectionFeedbackGenerator');
        const generator = UISelectionFeedbackGenerator.alloc().init();
        if (!generator) return false;
        generator.prepare();
        generator.selectionChanged();
        plus.ios.deleteObject(generator);
        return true;
    } catch (error) {
        return false;
    }
    // #endif
    return false;
}

function iosNotification(type) {
    // #ifdef APP-PLUS
    if (!isIOSApp() || !plus.ios) return false;
    try {
        const UINotificationFeedbackGenerator = plus.ios.importClass('UINotificationFeedbackGenerator');
        const generator = UINotificationFeedbackGenerator.alloc().init();
        if (!generator) return false;
        generator.prepare();
        generator.notificationOccurred(type);
        plus.ios.deleteObject(generator);
        return true;
    } catch (error) {
        return false;
    }
    // #endif
    return false;
}

function uniVibrateShort(type) {
    if (typeof uni === 'undefined' || typeof uni.vibrateShort !== 'function') return false;

    // #ifdef MP
    if (type) {
        try {
            uni.vibrateShort({ type });
            return true;
        } catch (error) {}
    }
    // #endif

    try {
        uni.vibrateShort();
        return true;
    } catch (error) {}

    return false;
}

function vibrateShortSafe(type) {
    // #ifdef APP-HARMONY
    // 鸿蒙端暂不支持振动API，直接跳过
    return false;
    // #endif

    // #ifdef APP-PLUS
    // iOS 使用 Taptic Engine 轻触反馈；不可用时静默跳过，避免退回剧烈振动
    if (isIOSApp()) {
        return iosImpact(IOS_IMPACT_STYLE[type] ?? IOS_IMPACT_STYLE.light);
    }
    // #endif

    if (uniVibrateShort(type)) return true;

    // #ifdef APP-PLUS
    try {
        plus.device.vibrate(15);
        return true;
    } catch (error) {}
    // #endif

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(15);
        return true;
    }

    return false;
}

function vibrateLongSafe() {
    // #ifdef APP-HARMONY
    // 鸿蒙端暂不支持振动API，直接跳过
    return false;
    // #endif

    try {
        if (typeof uni !== 'undefined' && typeof uni.vibrateLong === 'function') {
            uni.vibrateLong();
            return true;
        }
    } catch (error) {}

    // #ifdef APP-PLUS
    try {
        plus.device.vibrate(40);
        return true;
    } catch (error) {}
    // #endif

    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(40);
        return true;
    }

    return false;
}

export function lightImpact() {
    vibrateShortSafe('light');
}

export function mediumImpact() {
    vibrateShortSafe('medium');
}

export function heavyImpact() {
    // #ifdef APP-PLUS
    if (isIOSApp()) {
        if (iosImpact(IOS_IMPACT_STYLE.heavy)) return;
    }
    // #endif
    vibrateLongSafe();
}

export function successNotification() {
    // #ifdef APP-PLUS
    if (isIOSApp()) {
        if (iosNotification(0)) return;
        return;
    }
    // #endif
    vibrateShortSafe('light');
    setTimeout(() => {
        vibrateShortSafe('light');
    }, 100);
}

export function selectionChanged() {
    // #ifdef APP-PLUS
    if (isIOSApp()) {
        if (iosSelection()) return;
        return;
    }
    // #endif
    vibrateShortSafe('light');
}

export default {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successNotification,
    selectionChanged
};
