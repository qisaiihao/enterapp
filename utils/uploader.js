import { uploadFileCompat } from './upload-compat.js';

async function uploadFile(cloudPath, filePath, options = {}) {
    const result = await uploadFileCompat({
        cloudPath,
        filePath,
        context: options.context,
        pageTag: options.pageTag || 'uploader',
        requireAuth: typeof options.requireAuth === 'boolean' ? options.requireAuth : false,
        maxRetries: typeof options.maxRetries === 'number' ? options.maxRetries : 2
    });

    return result && result.fileID ? result.fileID : '';
}

const uploader = {
    uploadFile
};

export {
    uploadFile
};

export default uploader;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = uploader;
    module.exports.default = uploader;
}
