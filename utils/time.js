const pad = (num, len = 2) => String(num).padStart(len, '0');

const formatDate = (input, pattern = 'yyyy-MM-dd HH:mm:ss') => {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    const map = {
        yyyy: String(d.getFullYear()),
        MM: pad(d.getMonth() + 1),
        dd: pad(d.getDate()),
        HH: pad(d.getHours()),
        mm: pad(d.getMinutes()),
        ss: pad(d.getSeconds())
    };
    return pattern.replace(/yyyy|MM|dd|HH|mm|ss/g, (t) => map[t]);
};

const formatRelativeTime = (input) => {
    const now = Date.now();
    const t = input instanceof Date ? input.getTime() : new Date(input).getTime();
    if (Number.isNaN(t)) return '';
    const diffMs = now - t;
    const absSec = Math.floor(Math.abs(diffMs) / 1000);
    const dir = diffMs >= 0 ? '前' : '后';
    if (absSec < 60) return `刚刚`;
    const mins = Math.floor(absSec / 60);
    if (mins < 60) return `${mins}分钟${dir}`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}小时${dir}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天${dir}`;
    return formatDate(t, 'yyyy-MM-dd');
};

const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diff = now.getTime() - past.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days >= 7) {
        const year = past.getFullYear();
        const month = ('0' + (past.getMonth() + 1)).slice(-2);
        const day = ('0' + past.getDate()).slice(-2);
        return `${year}-${month}-${day}`;
    } else if (days >= 1) {
        return `${days}天前`;
    } else if (hours >= 1) {
        return `${hours}小时前`;
    } else if (minutes >= 1) {
        return `${minutes}分钟前`;
    } else {
        return '刚刚';
    }
};

module.exports = {
    formatTimeAgo,
    formatRelativeTime,
    formatDate
};
