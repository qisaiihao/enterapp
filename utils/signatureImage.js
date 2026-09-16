import { removeSignatureBackground } from './signatureMatting.js';

const WORK_SIDE = 1024;
const OUTPUT_SIDE = 600;

function signatureSize(width, height, maxSide) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        throw new Error('无法获取签名图片尺寸');
    }
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function callCanvasApi(name, options, context) {
    return new Promise((resolve, reject) => uni[name]({ ...options, success: resolve, fail: reject }, context));
}

function checkCurrent(isCurrent) {
    if (!isCurrent()) throw new Error('签名处理已取消');
}

async function processSignatureFile(filePath, { context, removeBackground = true, isCurrent = () => true } = {}) {
    checkCurrent(isCurrent);
    const browser = typeof document !== 'undefined' && typeof Image !== 'undefined';
    const miniProgram = typeof wx !== 'undefined' && typeof wx.getAccountInfoSync === 'function';
    let canvas = null, ctx = null, img = null, info;
    if (browser || miniProgram) {
        if (browser) {
            canvas = document.createElement('canvas');
        } else {
            canvas = await new Promise((resolve, reject) => {
                uni.createSelectorQuery().in(context).select('#signatureCanvas').fields({ node: true, size: true }).exec(res => {
                    const node = res && res[0] && res[0].node;
                    if (node) resolve(node);
                    else reject(new Error('无法获取签名画布'));
                });
            });
        }
        checkCurrent(isCurrent);
        ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('无法读取签名画布');
        img = browser ? new Image() : canvas.createImage();
        if (browser && /^https?:/i.test(filePath)) img.crossOrigin = 'anonymous';
        info = await new Promise((resolve, reject) => {
            img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
            img.onerror = () => reject(new Error('签名图片加载失败'));
            img.src = filePath;
        });
    } else {
        info = await callCanvasApi('getImageInfo', { src: filePath }, context);
    }
    checkCurrent(isCurrent);
    const work = signatureSize(info.width, info.height, removeBackground ? WORK_SIDE : OUTPUT_SIDE);
    const output = signatureSize(work.width, work.height, OUTPUT_SIDE);
    let imageData;
    if (canvas) {
        canvas.width = work.width;
        canvas.height = work.height;
        ctx.clearRect(0, 0, work.width, work.height);
        ctx.drawImage(img, 0, 0, work.width, work.height);
        if (removeBackground) imageData = ctx.getImageData(0, 0, work.width, work.height);
    } else {
        // App 使用传统 canvas API，不能通过 fields({node:true}) 获取小程序 2D 节点。
        context.setData({ signatureCanvasWidth: work.width, signatureCanvasHeight: work.height });
        await context.$nextTick();
        checkCurrent(isCurrent);
        ctx = uni.createCanvasContext('signatureCanvas', context);
        ctx.clearRect(0, 0, work.width, work.height);
        ctx.drawImage(info.path || filePath, 0, 0, work.width, work.height);
        await new Promise(resolve => ctx.draw(false, resolve));
        checkCurrent(isCurrent);
        if (removeBackground) {
            const pixels = await callCanvasApi('canvasGetImageData', { canvasId: 'signatureCanvas', x: 0, y: 0, ...work }, context);
            imageData = { data: pixels.data, ...work };
        }
    }
    checkCurrent(isCurrent);
    const result = removeBackground ? removeSignatureBackground(imageData) : { changed: false, reason: 'disabled' };
    if (result.reason === 'empty') throw new Error('未识别到签名笔画');
    if (result.changed) {
        if (canvas) ctx.putImageData(imageData, 0, 0);
        else await callCanvasApi('canvasPutImageData', { canvasId: 'signatureCanvas', x: 0, y: 0, ...work, data: imageData.data }, context);
    }
    checkCurrent(isCurrent);
    if (browser) {
        const exported = document.createElement('canvas');
        exported.width = output.width;
        exported.height = output.height;
        const exportContext = exported.getContext('2d');
        exportContext.drawImage(canvas, 0, 0, output.width, output.height);
        // data URL 不持有需要手动 revoke 的 Blob URL，上传和分享也能直接读取。
        return { filePath: exported.toDataURL('image/png'), ...result };
    }
    const exported = await callCanvasApi('canvasToTempFilePath', {
        ...(canvas ? { canvas } : { canvasId: 'signatureCanvas' }),
        x: 0, y: 0, ...work, destWidth: output.width, destHeight: output.height, fileType: 'png', quality: 1
    }, context);
    if (!exported.tempFilePath) throw new Error('签名导出失败');
    checkCurrent(isCurrent);
    return { filePath: exported.tempFilePath, ...result };
}

export { processSignatureFile, signatureSize };
