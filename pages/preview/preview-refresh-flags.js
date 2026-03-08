import { setFeedRefreshFlags } from '@/utils/refresh-flags.js';

export function markPreviewPublished() {
    setFeedRefreshFlags();
}
