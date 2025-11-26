export async function fetchPortfolioFolders(callCloudFn) {
    if (typeof callCloudFn !== 'function') {
        throw new Error('callCloudFn is required to fetch portfolio folders');
    }

    const res = await callCloudFn('getPortfolioFolders', {});
    if (!res || !res.result || !res.result.success) {
        const error = new Error('获取作品集失败');
        error.payload = res && res.result;
        throw error;
    }
    return res.result.folders || [];
}
