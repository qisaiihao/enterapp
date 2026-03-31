const DATA_URL_PREFIX_PATTERN = /^data:.*?,/i;

function stripDataUrlPrefix(value) {
    if (typeof value !== 'string') {
        return '';
    }
    if (DATA_URL_PREFIX_PATTERN.test(value)) {
        return value.replace(DATA_URL_PREFIX_PATTERN, '');
    }
    return value;
}

function isH5() {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function readViaFetch(filePath) {
    return fetch(filePath).then((response) => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        return response.blob();
    }).then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(stripDataUrlPrefix(reader.result || ''));
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(blob);
    }));
}

function readViaPlus(filePath) {
    return new Promise((resolve, reject) => {
        if (typeof plus === 'undefined' || !plus.io || !plus.io.resolveLocalFileSystemURL) {
            reject(new Error('文件系统API不可用'));
            return;
        }
        plus.io.resolveLocalFileSystemURL(filePath, (entry) => {
            entry.file((file) => {
                const reader = new plus.io.FileReader();
                reader.onload = (evt) => {
                    const result = (evt && evt.target && evt.target.result) || reader.result || '';
                    const base64 = stripDataUrlPrefix(result);
                    if (!base64) {
                        reject(new Error('文件读取失败'));
                        return;
                    }
                    resolve(base64);
                };
                reader.onerror = (err) => {
                    const message = err && err.message ? err.message : '未知错误';
                    reject(new Error(`文件读取失败: ${message}`));
                };
                try {
                    reader.readAsDataURL(file);
                } catch (readError) {
                    const message = readError && readError.message ? readError.message : '未知错误';
                    reject(new Error(`文件读取失败: ${message}`));
                }
            }, (error) => {
                const message = error && error.message ? error.message : '无法访问文件';
                reject(new Error(`无法访问文件: ${message}`));
            });
        }, (error) => {
            const message = error && error.message ? error.message : '路径解析失败';
            reject(new Error(`解析文件路径失败: ${message}`));
        });
    });
}

function readViaUniFs(filePath) {
    return new Promise((resolve, reject) => {
        if (typeof uni === 'undefined' || typeof uni.getFileSystemManager !== 'function') {
            reject(new Error('文件系统API不可用'));
            return;
        }
        let fs;
        try {
            fs = uni.getFileSystemManager();
        } catch (error) {
            const message = error && error.message ? error.message : '文件系统API调用失败';
            reject(new Error(`文件系统API调用失败: ${message}`));
            return;
        }
        if (!fs || typeof fs.readFile !== 'function') {
            reject(new Error('文件系统API不可用'));
            return;
        }
        fs.readFile({
            filePath,
            encoding: 'base64',
            success: (res) => {
                if (!res || !res.data) {
                    reject(new Error('文件读取失败'));
                    return;
                }
                resolve(res.data);
            },
            fail: (err) => {
                const message = err && err.errMsg ? err.errMsg : '未知错误';
                reject(new Error(`文件读取失败: ${message}`));
            }
        });
    });
}

async function readFileAsBase64(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('文件路径无效');
    }

    if (filePath.startsWith('data:')) {
        const base64 = stripDataUrlPrefix(filePath);
        if (!base64) {
            throw new Error('文件读取失败');
        }
        return base64;
    }

    if (isH5()) {
        return readViaFetch(filePath);
    }

    if (typeof plus !== 'undefined') {
        try {
            return await readViaPlus(filePath);
        } catch (error) {
            // 如果 plus 方案失败，尝试使用 FS 方案兜底
            return readViaUniFs(filePath);
        }
    }

    return readViaUniFs(filePath);
}

const fileReader = {
    readFileAsBase64
};

export {
    readFileAsBase64
};

export default fileReader;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = fileReader;
    module.exports.default = fileReader;
}
