export function feedbackStatus(feedback) {
    return feedback.status || (feedback.isProcessed ? 'closed' : 'pending');
}

export function feedbackStatusLabel(feedback) {
    const labels = { pending: '待处理', processing: '处理中', waiting_user: '待补充', closed: '已办结' };
    return labels[feedbackStatus(feedback)] || '待处理';
}

export function feedbackDetailUrl(feedbackId) {
    return `/pages-tools/feedback-detail/feedback-detail?id=${encodeURIComponent(feedbackId)}`;
}
