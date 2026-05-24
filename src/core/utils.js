import path from "node:path";

export function formatCount(value) {
  const numeric = Number(value || 0);
  if (numeric >= 10000) {
    return `${(numeric / 10000).toFixed(numeric >= 100000 ? 0 : 1)}w`;
  }
  return `${numeric}`;
}

export function truncate(text, length = 120) {
  if (!text) {
    return "";
  }
  return text.length > length ? `${text.slice(0, length - 1)}...` : text;
}

export function toDateString(unixSeconds) {
  const value = Number(unixSeconds || 0);
  if (!value) {
    return "";
  }
  return new Date(value * 1000).toISOString();
}

export function extractArticleId(value) {
  if (!value) {
    return "";
  }
  const match = `${value}`.match(/post\/(\d{10,})|^(\d{10,})$/);
  return match?.[1] || match?.[2] || "";
}

export function extractUserId(value) {
  if (!value) {
    return "";
  }
  const match = `${value}`.match(/user\/(\d{10,})|^(\d{10,})$/);
  return match?.[1] || match?.[2] || "";
}

export function sanitizeFilename(input) {
  return `${input || "untitled"}`
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function resolveOutputPath(baseDir, filename) {
  return path.join(baseDir, sanitizeFilename(filename));
}

export function summarizeArticle(article) {
  return {
    articleId: article.articleId,
    title: article.title,
    author: article.author,
    url: article.url,
    views: article.viewCount,
    likes: article.diggCount,
    comments: article.commentCount,
    tags: article.tags
  };
}
