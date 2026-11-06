export function getCreationFields(source = {}) {
    return {
        creationDate: typeof source.creationDate === 'string' ? source.creationDate : '',
        creationLocation: typeof source.creationLocation === 'string' ? source.creationLocation.trim() : '',
        showCreationDate: source.showCreationDate === true,
        showCreationLocation: source.showCreationLocation === true
    };
}

export function getCreationLabel(post = {}) {
    if (!post.isOriginal || !(post.isPoem || post.isSeries || post.publishMode === 'poem')) return '';
    const fields = getCreationFields(post);
    const date = fields.showCreationDate
        ? fields.creationDate.trim().replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$1.$2.$3')
        : '';
    const location = fields.showCreationLocation ? fields.creationLocation : '';
    return [date, location].filter(Boolean).join(' · ');
}
