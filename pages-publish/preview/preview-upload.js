import { uploadFileCompat, uploadViaCloudFunction } from '@/utils/upload-compat.js';

export function uploadPreviewFile(context, cloudPath, filePath) {
    return uploadFileCompat({
        cloudPath,
        filePath,
        context,
        pageTag: 'preview',
        requireAuth: true
    });
}

export function uploadPreviewFileViaCloudFunction(context, cloudPath, filePath) {
    return uploadViaCloudFunction({
        cloudPath,
        filePath,
        context,
        pageTag: 'preview',
        requireAuth: true,
        maxRetries: 2
    });
}
