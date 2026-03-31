// 搜索高亮工具
class SearchHighlighter {
  // 高亮文本中的关键词
  static highlightText(text, keywords, maxLength = 200) {
    if (!text || !keywords || keywords.length === 0) {
      return text;
    }

    let highlightedText = text;
    
    // 如果文本太长，截取并添加省略号
    if (text.length > maxLength) {
      // 尝试在关键词附近截取
      let bestIndex = 0;
      let minDistance = Infinity;
      
      keywords.forEach(keyword => {
        const index = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (index !== -1) {
          const distance = Math.abs(index - maxLength / 2);
          if (distance < minDistance) {
            minDistance = distance;
            bestIndex = Math.max(0, index - maxLength / 2);
          }
        }
      });
      
      const start = Math.max(0, bestIndex);
      const end = Math.min(text.length, start + maxLength);
      highlightedText = text.substring(start, end);
      
      if (start > 0) highlightedText = '...' + highlightedText;
      if (end < text.length) highlightedText = highlightedText + '...';
    }

    // 高亮关键词
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="search-highlight">$1</mark>');
    });

    return highlightedText;
  }

  // 高亮标题
  static highlightTitle(title, keywords) {
    if (!title || !keywords || keywords.length === 0) {
      return title;
    }

    let highlightedTitle = title;
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      highlightedTitle = highlightedTitle.replace(regex, '<mark class="search-highlight">$1</mark>');
    });

    return highlightedTitle;
  }

  // 高亮标签
  static highlightTags(tags, keywords) {
    if (!tags || !Array.isArray(tags) || !keywords || keywords.length === 0) {
      return tags;
    }

    return tags.map(tag => {
      let highlightedTag = tag;
      keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedTag = highlightedTag.replace(regex, '<mark class="search-highlight">$1</mark>');
      });
      return highlightedTag;
    });
  }

  // 提取关键词
  static extractKeywords(searchText) {
    if (!searchText) return [];
    return searchText.trim().split(/\s+/).filter(k => k.length > 0);
  }
}

export { SearchHighlighter };

export default SearchHighlighter;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchHighlighter;
  module.exports.default = SearchHighlighter;
}
