import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";
import TurndownService from "turndown";
import { load } from "cheerio";

import { ENDPOINTS, JUEJIN_ORIGIN } from "./config.js";
import { ensureDir } from "./fs.js";
import { extractArticleId, extractUserId, sanitizeFilename, toDateString } from "./utils.js";

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced"
});

export class ArticleDownloader {
  constructor({ client, browserFactory = chromium } = {}) {
    this.client = client;
    this.browserFactory = browserFactory;
  }

  async getArticleDetail(urlOrId) {
    const articleId = extractArticleId(urlOrId);
    if (!articleId) {
      return null;
    }
    return this.#fetchArticleDetail(articleId);
  }

  async downloadArticle(urlOrId, { outputDir = "./output", downloadImages = false } = {}) {
    const articleId = extractArticleId(urlOrId);
    if (!articleId) {
      return {
        success: false,
        message: `Invalid article URL or ID: ${urlOrId}`
      };
    }

    const detail = await this.#fetchArticleDetail(articleId);
    if (detail) {
      return this.#saveFromApi(detail, articleId, outputDir, downloadImages);
    }

    return this.#saveFromPage(articleId, outputDir, downloadImages);
  }

  async downloadUserArticles(userIdOrUrl, { outputDir = "./output", maxCount = 100, downloadImages = false } = {}) {
    const userId = extractUserId(userIdOrUrl);
    if (!userId) {
      return [{
        success: false,
        message: `Invalid user URL or ID: ${userIdOrUrl}`
      }];
    }

    const articles = await this.#fetchUserArticleList(userId, maxCount);
    const userDir = path.join(outputDir, `user_${userId}`);
    await ensureDir(userDir);

    const results = [];
    for (const article of articles) {
      results.push(await this.downloadArticle(article.articleId, {
        outputDir: userDir,
        downloadImages
      }));
    }
    return results;
  }

  async #fetchArticleDetail(articleId) {
    try {
      const response = await this.client.post(ENDPOINTS.articleDetail, {
        article_id: articleId
      });
      return response?.err_no === 0 ? response.data : null;
    } catch {
      return null;
    }
  }

  async #fetchUserArticleList(userId, maxCount) {
    let cursor = "0";
    const articles = [];

    while (articles.length < maxCount) {
      const response = await this.client.post(ENDPOINTS.articleList, {
        user_id: userId,
        sort_type: 2,
        cursor,
        limit: Math.min(20, maxCount - articles.length)
      });

      const items = response?.data || [];
      if (!items.length) {
        break;
      }

      items.forEach((item) => {
        const info = item.article_info || {};
        if (info.article_id) {
          articles.push({
            articleId: info.article_id,
            title: info.title || "Untitled"
          });
        }
      });

      if (!response?.has_more) {
        break;
      }
      cursor = response?.cursor || "0";
    }

    return articles.slice(0, maxCount);
  }

  async #saveFromApi(detail, articleId, outputDir, downloadImages) {
    const info = detail.article_info || {};
    const author = detail.author_user_info || {};
    const title = info.title || "Untitled";
    let markdownContent = info.mark_content || "";

    if (!markdownContent && info.content) {
      markdownContent = turndown.turndown(info.content);
    }

    if (!markdownContent) {
      return {
        success: false,
        message: "Article has no downloadable content."
      };
    }

    return this.#writeMarkdown({
      title,
      markdownContent: cleanDownloadedMarkdown(markdownContent),
      articleId,
      author: author.user_name || "Unknown",
      createdAt: toDateString(info.ctime),
      tags: (detail.tags || []).map((tag) => tag.tag_name).filter(Boolean),
      outputDir,
      downloadImages
    });
  }

  async #saveFromPage(articleId, outputDir, downloadImages) {
    const browser = await this.browserFactory.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${JUEJIN_ORIGIN}/post/${articleId}`, {
        waitUntil: "domcontentloaded",
        timeout: 120000
      });
      await page.waitForTimeout(2000);
      const html = await page.content();
      const parsed = extractFromHtml(html);
      if (!parsed.contentHtml) {
        return {
          success: false,
          message: "Failed to extract article body from page."
        };
      }

      return this.#writeMarkdown({
        title: parsed.title || "Untitled",
        markdownContent: cleanDownloadedMarkdown(turndown.turndown(parsed.contentHtml)),
        articleId,
        author: parsed.author || "Unknown",
        createdAt: "",
        tags: [],
        outputDir,
        downloadImages
      });
    } finally {
      await browser.close();
    }
  }

  async #writeMarkdown({
    title,
    markdownContent,
    articleId,
    author,
    createdAt,
    tags,
    outputDir,
    downloadImages
  }) {
    await ensureDir(outputDir);
    let finalMarkdown = [
      `# ${title}`,
      "",
      `> Author: ${author}`,
      createdAt ? `> Published: ${createdAt}` : "",
      `> Source: ${JUEJIN_ORIGIN}/post/${articleId}`,
      tags.length ? `> Tags: ${tags.join(", ")}` : "",
      "",
      "---",
      "",
      markdownContent.trim()
    ].filter(Boolean).join("\n");

    if (downloadImages) {
      finalMarkdown = await this.#downloadImages(finalMarkdown, outputDir, articleId);
    }

    const filePath = path.join(outputDir, `${sanitizeFilename(title)}.md`);
    await fs.writeFile(filePath, finalMarkdown, "utf8");
    return {
      success: true,
      title,
      filePath
    };
  }

  async #downloadImages(markdownContent, outputDir, articleId) {
    const imageDir = path.join(outputDir, "images", articleId);
    await ensureDir(imageDir);

    const matches = [...markdownContent.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^\)]+)\)/g)];
    let nextContent = markdownContent;

    for (const [index, match] of matches.entries()) {
      const [, altText, imageUrl] = match;
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          continue;
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const extension = guessImageExtension(imageUrl, response.headers.get("content-type"));
        const filename = `img_${index + 1}${extension}`;
        const localFile = path.join(imageDir, filename);
        const relativeFile = path.join("images", articleId, filename);
        await fs.writeFile(localFile, buffer);
        nextContent = nextContent.replace(match[0], `![${altText}](${relativeFile})`);
      } catch {
        // Keep the remote URL untouched when image download fails.
      }
    }

    return nextContent;
  }
}

export function extractFromHtml(html) {
  const $ = load(html);
  const title = $("h1.article-title").first().text().trim() || $("title").first().text().replace(/\s*-\s*掘金$/, "").trim();
  const author = $("a.username").first().text().trim() || $("[data-author-name]").attr("data-author-name") || "";
  const contentHtml = $("div.article-viewer").first().html() || $("article").first().html() || $("div.article-content").first().html() || "";

  return {
    title,
    author,
    contentHtml
  };
}

function guessImageExtension(imageUrl, contentType = "") {
  const lowerUrl = imageUrl.toLowerCase().split("?")[0];
  for (const extension of [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]) {
    if (lowerUrl.endsWith(extension)) {
      return extension;
    }
  }

  if (contentType.includes("jpeg")) {
    return ".jpg";
  }
  if (contentType.includes("gif")) {
    return ".gif";
  }
  if (contentType.includes("webp")) {
    return ".webp";
  }
  if (contentType.includes("svg")) {
    return ".svg";
  }
  return ".png";
}

function cleanDownloadedMarkdown(markdownContent) {
  let next = `${markdownContent || ""}`.trim();

  next = next.replace(/^(?:\.markdown-body[^\n]*|\.hljs-[^\n]*|@media[^\n]*|\.[a-z0-9_-]+[^\n]*\{[^\n]*\})\n*/gimu, "");
  next = next.replace(/^(javascript|typescript|css|html)\s*\n复制代码\s*\n*/gimu, "");
  next = next.replace(/\n(复制代码)\n/g, "\n");
  next = next.replace(/``([^`]+)``/g, "`$1`");
  next = next.replace(/\n{4,}/g, "\n\n\n");

  return next.trim();
}
