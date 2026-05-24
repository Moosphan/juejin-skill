import fs from "node:fs/promises";

import MarkdownIt from "markdown-it";

import { DEFAULT_CATEGORY_ID, ENDPOINTS } from "./config.js";

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
        tagId: tag.tag_id,
        tagName: tag.tag_name
      }))
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

    const summary = briefContent || deriveSummary(article.content);
    const htmlContent = markdown.render(article.content);

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
      mark_content: article.content,
      theme_ids: []
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
          message: "Article published successfully."
        }
      : {
          success: false,
          message: "Publish failed.",
          raw: publishResponse
        };
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
