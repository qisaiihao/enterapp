const { getSystemInfoCompat } = require('../utils/system-info.js');

function _compressImage(img, canvas, fileLimit) {
    return Promise.resolve().then(() => {
        const systemInfo = getSystemInfoCompat();
        const pixelRatio = Number(systemInfo.pixelRatio || 1);
        const system = String(systemInfo.system || '');
        const isIOS = /(ios)/gi.test(system);

        fileLimit = fileLimit || 2097152;
        const baseSize = 1024;

        if (img.size > fileLimit) {
            return compressImg({
                src: img.path,
                size: img.size,
                canvas,
                baseSize,
                isIOS,
                pixelRatio
            }).then((response) => Promise.resolve(response));
        }

        return Promise.resolve(img.path);
    });
}

function compressImg({ src, size, canvas, baseSize, isIOS, pixelRatio }) {
    return new Promise((resolve) => {
        uni.getImageInfo({
            src
        })
            .then((res) => {
                const imgWidth = res.width;
                const imgHeight = res.height;

                if (imgWidth <= 4096 && imgHeight <= 4096) {
                    canvasToImage({
                        src,
                        size,
                        imgWidth,
                        imgHeight,
                        canvas,
                        baseSize,
                        isIOS,
                        pixelRatio
                    }).then((response) => {
                        resolve(response);
                    });
                } else {
                    compressImage(src, size, isIOS).then((response) => {
                        resolve(response);
                    });
                }
            })
            .catch(() => {
                compressImage(src, size, isIOS).then((response) => {
                    resolve(response);
                });
            });
    });
}

function compressImage(src, size, isIOS) {
    return new Promise((resolve) => {
        let quality = 100;
        if (isIOS) {
            quality = 0.08;
        } else {
            const temp = 25 - size / 1024 / 1024;
            quality = temp < 8 ? 8 : temp;
        }

        uni.compressImage({
            src,
            quality,
            success: (res) => {
                resolve(res.tempFilePath);
            },
            fail: () => {
                resolve(src);
            }
        });
    });
}

function canvasToImage({ src, size, imgWidth, imgHeight, canvas, baseSize, isIOS, pixelRatio }) {
    return new Promise((resolve) => {
        if (!canvas) {
            compressImage(src, size, isIOS).then((res) => {
                resolve(res);
            });
            return;
        }

        let canvasWidth = 0;
        let canvasHeight = 0;
        let quality = 1;

        if (imgWidth <= baseSize && imgHeight <= baseSize) {
            canvasWidth = imgWidth;
            canvasHeight = imgHeight;
            quality = 0.25;
        } else {
            if (pixelRatio > 2 && (imgWidth > baseSize || imgHeight > baseSize) && (imgWidth < baseSize || imgHeight < baseSize)) {
                canvasWidth = imgWidth;
                canvasHeight = imgHeight;
                quality = 0.25;
            } else {
                const compareFlag = pixelRatio > 2 ? imgWidth > imgHeight : imgWidth > imgHeight;
                canvasWidth = compareFlag ? parseInt(imgWidth / (imgHeight / baseSize), 10) : baseSize;
                canvasHeight = compareFlag ? baseSize : parseInt(imgHeight / (imgWidth / baseSize), 10);
                quality = 0.7;
            }
        }

        const pic = canvas.createImage();
        pic.src = src;
        pic.onerror = function () {
            compressImage(src, size, isIOS).then((response) => {
                resolve(response);
            });
        };
        pic.onload = function () {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            ctx.drawImage(pic, 0, 0, canvasWidth, canvasHeight);
            uni.canvasToTempFilePath({
                canvas,
                width: canvasWidth,
                height: canvasHeight,
                destHeight: canvasHeight,
                destWidth: canvasWidth,
                fileType: 'jpg',
                quality,
                success: (res) => {
                    resolve(res.tempFilePath);
                },
                fail: () => {
                    compressImage(src, size, isIOS).then((response) => {
                        resolve(response);
                    });
                }
            });
        };
    });
}

module.exports = {
    compressImage: _compressImage
};
