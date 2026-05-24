import fs from "node:fs/promises";
import path from "node:path";

import MarkdownIt from "markdown-it";

import { DEFAULT_CATEGORY_ID, ENDPOINTS } from "./config.js";
import { JuejinImageUploader, uploadLocalMarkdownImages } from "./image-uploader.js";
import { extractArticleId } from "./utils.js";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false
});

export class ArticlePublisher {
  constructor({ client }) {
    this.client = client;
  }

  async getCategories() {
    const response = await this.client.get(ENDPOINTS.categories);
    return (response?.data || []).map((category) => ({
      categoryId: category.category_id,
      categoryName: category.category_name
    }));
  }

  async searchTags(categoryId = DEFAULT_CATEGORY_ID, keyword = "", limit = 50) {
    const response = await this.client.post(ENDPOINTS.categoryTags, {
      cate_id: categoryId,
      cursor: "0",
      limit
    });

    return (response?.data || [])
      .map((tag) => ({
        tagId: tag.tag_id || "",
        tagName: tag.tag_name || ""
      }))
      .filter((tag) => tag.tagId && tag.tagName)
      .filter((tag) => !keyword || tag.tagName.toLowerCase().includes(keyword.toLowerCase()));
  }

  async publishMarkdown({
    filePath = "",
    title = "",
    content = "",
    categoryId = DEFAULT_CATEGORY_ID,
    tagIds = [],
    briefContent = "",
    coverImage = "",
    saveDraftOnly = true,
    allowPublicPublish = false
  } = {}) {
    const article = filePath
      ? await readMarkdownFile(filePath, title)
      : {
          title,
          content
        };

    if (!article.title) {
      throw new Error("Article title is required.");
    }

    if (!article.content) {
      throw new Error("Article content is required.");
    }

    const imageResult = filePath
      ? await uploadLocalMarkdownImages(article.content, {
          baseDir: path.dirname(path.resolve(filePath)),
          uploader: new JuejinImageUploader({ client: this.client })
        })
      : {
          content: article.content,
          uploadedImages: []
        };

    const finalContent = imageResult.content;
    const summary = briefContent || deriveSummary(finalContent);
    const { markContent, htmlContent, pics } = prepareJuejinContent(finalContent);

    const publishPublicly = !saveDraftOnly && allowPublicPublish;
    if (!saveDraftOnly && !allowPublicPublish) {
      return {
        success: false,
        message: "Refusing to publish publicly without allowPublicPublish=true.",
        policy: "draft-only-by-default"
      };
    }

    const draftResponse = await this.client.post(ENDPOINTS.createDraft, {
      category_id: categoryId,
      tag_ids: tagIds,
      link_url: "",
      cover_image: coverImage,
      title: article.title,
      brief_content: summary,
      edit_type: 10,
      html_content: htmlContent,
      mark_content: markContent,
      theme_ids: [],
      pics
    });

    const draftId = draftResponse?.data?.id || "";
    if (!draftId) {
      return {
        success: false,
        message: "Failed to create draft.",
        raw: draftResponse
      };
    }

    if (!publishPublicly) {
      return {
        success: true,
        draftId,
        uploadedImages: imageResult.uploadedImages,
        message: `Draft created successfully: ${draftId}`
      };
    }

    const publishResponse = await this.client.post(ENDPOINTS.publishArticle, {
      draft_id: draftId,
      sync_to_org: false,
      column_ids: [],
      theme_ids: [],
      encrypted_word_count: 0,
      category_id: categoryId,
      tag_ids: tagIds,
      cover_image: coverImage,
      brief_content: summary
    });

    const articleId = publishResponse?.data?.article_id || "";
    return articleId
      ? {
          success: true,
          articleId,
          url: `https://juejin.cn/post/${articleId}`,
          uploadedImages: imageResult.uploadedImages,
          message: "Article published successfully."
        }
      : {
          success: false,
          message: "Publish failed.",
          raw: publishResponse
        };
  }

  async updateMarkdown({
    articleIdOrUrl = "",
    filePath = "",
    title = "",
    content = "",
    briefContent = "",
    coverImage,
    saveDraftOnly = true,
    allowPublicPublish = false
  } = {}) {
    const articleId = extractArticleId(articleIdOrUrl);
    if (!articleId) {
      throw new Error(`Invalid article URL or ID: ${articleIdOrUrl}`);
    }

    const existing = await this.#getArticleDetail(articleId);
    const info = existing.article_info || {};
    const draftId = info.draft_id || "";
    if (!draftId) {
      throw new Error(`Article has no editable draft: ${articleId}`);
    }

    const article = filePath
      ? await readMarkdownFile(filePath, title)
      : {
          title: title || info.title || "",
          content
        };

    if (!article.title) {
      throw new Error("Article title is required.");
    }

    if (!article.content) {
      throw new Error("Article content is required.");
    }

    const imageResult = filePath
      ? await uploadLocalMarkdownImages(article.content, {
          baseDir: path.dirname(path.resolve(filePath)),
          uploader: new JuejinImageUploader({ client: this.client })
        })
      : {
          content: article.content,
          uploadedImages: []
        };

    const finalContent = imageResult.content;
    const summary = briefContent || info.brief_content || deriveSummary(finalContent);
    const finalCoverImage = coverImage === undefined ? info.cover_image || "" : coverImage;
    const themeIds = normalizeThemeIds(existing.theme_list || []);
    const { markContent, htmlContent, pics } = prepareJuejinContent(finalContent);

    const publishPublicly = !saveDraftOnly && allowPublicPublish;
    if (!saveDraftOnly && !allowPublicPublish) {
      return {
        success: false,
        message: "Refusing to update published article without allowPublicPublish=true.",
        policy: "draft-only-by-default"
      };
    }

    const tagIds = getArticleTagIds(existing);
    const updateResponse = await this.client.post(ENDPOINTS.updateDraft, {
      id: String(draftId),
      category_id: String(info.category_id || DEFAULT_CATEGORY_ID),
      tag_ids: tagIds,
      link_url: info.link_url || "",
      cover_image: finalCoverImage,
      is_gfw: info.is_gfw || 0,
      title: article.title,
      brief_content: summary,
      is_english: info.is_english || 0,
      is_original: info.is_original ?? 1,
      edit_type: 10,
      html_content: htmlContent,
      mark_content: markContent,
      theme_ids: themeIds,
      pics
    });

    if (updateResponse?.err_no !== 0) {
      return {
        success: false,
        message: "Failed to update draft.",
        raw: updateResponse
      };
    }

    if (!publishPublicly) {
      return {
        success: true,
        articleId,
        draftId,
        uploadedImages: imageResult.uploadedImages,
        message: `Draft updated successfully: ${draftId}`
      };
    }

    const publishResponse = await this.client.post(ENDPOINTS.publishArticle, {
      draft_id: String(draftId),
      sync_to_org: false,
      column_ids: [],
      theme_ids: themeIds,
      encrypted_word_count: 0,
      origin_word_count: markContent.length,
      category_id: String(info.category_id || DEFAULT_CATEGORY_ID),
      tag_ids: tagIds,
      cover_image: finalCoverImage,
      brief_content: summary
    });

    const updatedArticleId = publishResponse?.data?.article_id || "";
    return updatedArticleId
      ? {
          success: true,
          articleId: updatedArticleId,
          draftId,
          url: `https://juejin.cn/post/${updatedArticleId}`,
          uploadedImages: imageResult.uploadedImages,
          message: "Article updated successfully."
        }
      : {
          success: false,
          message: "Article update publish failed.",
          raw: publishResponse
        };
  }

  async #getArticleDetail(articleId) {
    const response = await this.client.post(ENDPOINTS.articleDetail, {
      article_id: articleId,
      client_type: 2608
    });

    if (response?.err_no !== 0 || !response?.data?.article_info) {
      throw new Error(`Failed to get article detail: ${response?.err_msg || articleId}`);
    }

    return response.data;
  }
}

export async function readMarkdownFile(filePath, explicitTitle = "") {
  const raw = await fs.readFile(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  const headingTitle = headingIndex >= 0 ? lines[headingIndex].replace(/^#\s+/, "").trim() : "";
  const content = headingIndex >= 0 ? lines.slice(headingIndex + 1).join("\n").trim() || raw : raw;

  return {
    title: explicitTitle || headingTitle,
    content
  };
}

function deriveSummary(markdownContent) {
  return markdownContent
    .replace(/[`*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function prepareJuejinContent(markdownContent) {
  return normalizeJuejinImageUrls({
    markContent: markdownContent,
    htmlContent: markdown.render(markdownContent)
  });
}

export function normalizeJuejinImageUrls({ markContent, htmlContent }) {
  const pics = [];
  const replacements = new Map();
  const imageUrlPattern = /https?:\/\/[^\s)"'<]+/g;
  for (const match of markContent.matchAll(imageUrlPattern)) {
    const url = match[0];
    const uri = toJuejinImageUri(url);
    if (!uri) {
      continue;
    }
    replacements.set(url, uri);
    if (!pics.some((pic) => pic.pic_uri === uri)) {
      pics.push({
        pic_url: url,
        pic_uri: uri
      });
    }
  }

  let normalizedMarkContent = markContent;
  let normalizedHtmlContent = htmlContent;
  for (const [url, uri] of replacements) {
    normalizedMarkContent = normalizedMarkContent.replaceAll(url, uri);
    normalizedHtmlContent = normalizedHtmlContent.replaceAll(url, uri);
  }

  return {
    markContent: normalizedMarkContent,
    htmlContent: normalizedHtmlContent,
    pics
  };
}

function toJuejinImageUri(imageUrl) {
  try {
    const parsed = new URL(imageUrl);
    if (!/juejin\.byteimg\.com$/.test(parsed.hostname) && !/juejin-sign\.byteimg\.com$/.test(parsed.hostname)) {
      return "";
    }
    const uri = parsed.pathname.split("~")[0].replace(/^\//, "");
    return uri.startsWith("tos-cn-i-k3u1fbpfcp/") ? uri : "";
  } catch {
    return "";
  }
}

function normalizeThemeIds(themeList) {
  return themeList
    .map((item) => item.theme_id || item.id || "")
    .filter(Boolean)
    .map(String);
}

function getArticleTagIds(articleDetail) {
  const tags = articleDetail.tags || [];
  const tagIds = tags.map((tag) => tag.tag_id || tag.id || "").filter(Boolean);
  if (tagIds.length) {
    return tagIds.map(String);
  }

  return (articleDetail.article_info?.tag_ids || []).map(String);
}
