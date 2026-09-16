import { resolveCardColors } from "./cardColors.js";

export function asDate(value) {
  if (!value) return null;
  if (typeof value === "object" && !(value instanceof Date)) {
    value =
      value.$date ??
      (value.seconds != null
        ? value.seconds * 1000
        : value._seconds != null
          ? value._seconds * 1000
          : NaN);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// One calendar definition everywhere: the App's China timezone, independent of the browser.
export function dayKey(value) {
  const date = asDate(value);
  return date
    ? new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10)
    : "";
}

export function formatDate(value) {
  return dayKey(value).replaceAll("-", ".") || "日期未记录";
}

export function normalizePoem(raw) {
  const blocks =
    (raw.seriesPoems?.length ? raw.seriesPoems : raw.seriesBlocks) || [];
  const series = blocks.map((b, i) => ({
    id: b.id || String(i),
    subtitle: String(b.subtitle || b.subTitle || ""),
    content: String(b.content || "").replace(/\r\n/g, "\n"),
  }));
  const content = String(raw.content || "").replace(/\r\n/g, "\n");
  const fullText = series.length
    ? series
        .map((b) => [b.subtitle, b.content].filter(Boolean).join("\n"))
        .join("\n\n")
    : content;
  const id = String(raw._id || raw.id || "");
  return {
    id,
    title: String(raw.title || "无题"),
    content,
    series,
    fullText,
    excerpt: String(
      raw.highlightSentence || raw.highlightLines?.join("\n") || fullText,
    ).trim(),
    author: raw.isAnonymous
      ? "匿名诗人"
      : String(
          (!raw.isOriginal && raw.author) ||
            raw.authorName ||
            raw.authorNameSnapshot ||
            "未署名",
        ),
    date: asDate(raw.createTime)?.toISOString() || "",
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t) => typeof t === "string").slice(0, 8)
      : [],
    original: raw.isOriginal === true,
    authorSignature:
      !raw.isAnonymous &&
      typeof raw.authorSignature === "string" &&
      /^https:\/\//i.test(raw.authorSignature.trim())
        ? raw.authorSignature.trim()
        : "",
    ...resolveCardColors(raw),
    images: (Array.isArray(raw.imageUrls)
      ? raw.imageUrls
      : [raw.imageUrl]
    ).filter((u) => typeof u === "string" && /^https:\/\//.test(u)),
  };
}

export function calendarDays(year, counts = {}, now = new Date()) {
  const start = new Date(Date.UTC(year, 0, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const days = Math.round((end - start) / 86400000);
  const today = dayKey(now);
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => {
    const date = new Date(start.getTime() + (i - offset) * 86400000);
    const key = date.toISOString().slice(0, 10);
    const outside = i < offset || i >= offset + days;
    const count = Math.max(0, Number(counts[key]) || 0);
    return {
      key,
      count,
      outside,
      future: key > today,
      level: count === 0 ? 0 : Math.min(count, 4),
      month: date.getUTCDate() <= 7 && !outside ? date.getUTCMonth() + 1 : 0,
    };
  });
}

export function summarizeDays(counts) {
  const keys = Object.keys(counts)
    .filter((k) => counts[k] > 0)
    .sort();
  let longest = 0,
    streak = 0,
    previous = null;
  for (const key of keys) {
    const time = Date.parse(`${key}T00:00:00Z`);
    streak = previous != null && time - previous === 86400000 ? streak + 1 : 1;
    longest = Math.max(longest, streak);
    previous = time;
  }
  return {
    total: keys.reduce((sum, k) => sum + Number(counts[k]), 0),
    days: keys.length,
    longest,
  };
}
