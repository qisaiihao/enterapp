function vibrateShortSafe() {
    try {
        if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
            uni.vibrateShort();
            return true;
        }
    } catch (error) {}

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
    vibrateShortSafe();
}

export function mediumImpact() {
    vibrateShortSafe();
}

export function heavyImpact() {
    vibrateLongSafe();
}

export function successNotification() {
    vibrateShortSafe();
    setTimeout(() => {
        vibrateShortSafe();
    }, 100);
}

export function selectionChanged() {
    vibrateShortSafe();
}

export default {
    lightImpact,
    mediumImpact,
    heavyImpact,
    successNotification,
    selectionChanged
};
