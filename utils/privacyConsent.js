// 任一文件版本更新后，需要重新确认两份文件。
export const PRIVACY_POLICY_VERSION = '2026-10-14';
export const USER_AGREEMENT_VERSION = '1';
export const PRIVACY_CONSENT_VERSION = `${PRIVACY_POLICY_VERSION}:${USER_AGREEMENT_VERSION}`;
export const PRIVACY_CONSENT_STORAGE_KEY = 'privacyConsentVersion';
export const PRIVACY_POLICY_PATH = '/pages/privacy/privacy';
export const PRIVACY_CONSENT_ACCEPTED_EVENT = 'privacyConsentAccepted';

// 存储写入/读取异常时本次会话仍视为已同意，避免当场重复弹窗和门禁误拦。
let acceptedInSession = false;

export function hasAcceptedPrivacyConsent() {
    if (acceptedInSession) {
        return true;
    }
    try {
        return typeof uni !== 'undefined'
            && typeof uni.getStorageSync === 'function'
            && uni.getStorageSync(PRIVACY_CONSENT_STORAGE_KEY) === PRIVACY_CONSENT_VERSION;
    } catch (error) {
        return false;
    }
}

export function acceptPrivacyConsent() {
    const alreadyAccepted = hasAcceptedPrivacyConsent();
    acceptedInSession = true;
    try {
        if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
            uni.setStorageSync(PRIVACY_CONSENT_STORAGE_KEY, PRIVACY_CONSENT_VERSION);
        }
    } catch (error) {}
    if (!alreadyAccepted && typeof uni !== 'undefined' && typeof uni.$emit === 'function') {
        uni.$emit(PRIVACY_CONSENT_ACCEPTED_EVENT);
    }
}

// 已同意时立即执行，否则等同意事件；返回取消订阅函数。
export function runAfterPrivacyConsent(callback) {
    if (typeof callback !== 'function') {
        return () => {};
    }
    if (hasAcceptedPrivacyConsent()) {
        callback();
        return () => {};
    }
    if (typeof uni === 'undefined' || typeof uni.$on !== 'function') {
        return () => {};
    }
    const handler = () => callback();
    uni.$on(PRIVACY_CONSENT_ACCEPTED_EVENT, handler);
    return () => {
        if (typeof uni !== 'undefined' && typeof uni.$off === 'function') {
            uni.$off(PRIVACY_CONSENT_ACCEPTED_EVENT, handler);
        }
    };
}

export function openPrivacyPolicy() {
    if (typeof uni !== 'undefined' && typeof uni.navigateTo === 'function') {
        uni.navigateTo({ url: PRIVACY_POLICY_PATH });
    }
}

export function openUserAgreement() {
    if (typeof uni !== 'undefined' && typeof uni.navigateTo === 'function') {
        uni.navigateTo({ url: `${PRIVACY_POLICY_PATH}?document=agreement` });
    }
}

export default {
    PRIVACY_POLICY_VERSION,
    USER_AGREEMENT_VERSION,
    PRIVACY_CONSENT_VERSION,
    PRIVACY_CONSENT_STORAGE_KEY,
    PRIVACY_POLICY_PATH,
    PRIVACY_CONSENT_ACCEPTED_EVENT,
    hasAcceptedPrivacyConsent,
    acceptPrivacyConsent,
    runAfterPrivacyConsent,
    openPrivacyPolicy,
    openUserAgreement
};
