// Android storage permission helper for APP-PLUS
// Provides a Promise-based API to request external storage/media image read permissions

function requestAndroidStoragePermission() {
    return new Promise((resolve) => {
        if (typeof plus === 'undefined' || !plus.android || !plus.android.requestPermissions) {
            // Not in APP-PLUS or API unavailable
            resolve(true);
            return;
        }

        // Android 13+ uses READ_MEDIA_IMAGES; older versions use READ_EXTERNAL_STORAGE
        const permissions = [
            'android.permission.READ_MEDIA_IMAGES',
            'android.permission.READ_EXTERNAL_STORAGE'
        ];

        try {
            plus.android.requestPermissions(
                permissions,
                function (result) {
                    // granted: array of granted permissions
                    const ok = Array.isArray(result.granted) && result.granted.length > 0;
                    if (!ok) {
                        uni.showModal({
                            title: '权限请求',
                            content: '需要读取存储权限以上传图片，请在系统设置中开启后重试。',
                            showCancel: false
                        });
                    }
                    resolve(ok);
                },
                function () {
                    uni.showModal({
                        title: '权限请求',
                        content: '请求存储权限失败，请在系统设置中开启后重试。',
                        showCancel: false
                    });
                    resolve(false);
                }
            );
        } catch (e) {
            // Fail open to avoid blocking other platforms
            resolve(true);
        }
    });
}

module.exports = {
    requestAndroidStoragePermission
};


