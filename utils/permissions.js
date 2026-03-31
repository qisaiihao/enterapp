import { getCurrentPlatform } from './platformDetector.js';

function requestAndroidStoragePermission() {
    return new Promise((resolve) => {
        if (getCurrentPlatform() === 'app-harmony') {
            resolve(true);
            return;
        }

        if (typeof plus === 'undefined' || !plus.android || !plus.android.requestPermissions) {
            resolve(true);
            return;
        }

        const permissions = [
            'android.permission.READ_MEDIA_IMAGES',
            'android.permission.READ_EXTERNAL_STORAGE'
        ];

        try {
            plus.android.requestPermissions(
                permissions,
                (result) => {
                    const ok = Array.isArray(result.granted) && result.granted.length > 0;
                    if (!ok && typeof uni !== 'undefined' && typeof uni.showModal === 'function') {
                        uni.showModal({
                            title: '权限请求',
                            content: '需要读取存储权限以上传图片，请在系统设置中开启后重试。',
                            showCancel: false
                        });
                    }
                    resolve(ok);
                },
                () => {
                    if (typeof uni !== 'undefined' && typeof uni.showModal === 'function') {
                        uni.showModal({
                            title: '权限请求',
                            content: '请求存储权限失败，请在系统设置中开启后重试。',
                            showCancel: false
                        });
                    }
                    resolve(false);
                }
            );
        } catch (error) {
            resolve(true);
        }
    });
}

const permissions = {
    requestAndroidStoragePermission
};

export {
    requestAndroidStoragePermission
};

export default permissions;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = permissions;
    module.exports.default = permissions;
}
