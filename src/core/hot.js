import { DEFAULT_CATEGORY_ID, ENDPOINTS, SORT_TYPES } from "./config.js";
import { formatCount, toDateString, truncate } from "./utils.js";

export class HotArticleService {
  constructor({ client }) {
    this.client = client;
  }

  async getCategories() {
    const response = await this.client.get(ENDPOINTS.categories);
    return (response?.data || []).map((category) => ({
      categoryId: category.category_id,
      categoryName: category.category_name,
      categoryUrl: category.category_url,
      rank: category.rank
    }));
  }

  async getTags(categoryId = DEFAULT_CATEGORY_ID, { cursor = "0", limit = 30 } = {}) {
    const response = await this.client.post(ENDPOINTS.categoryTags, {
      cate_id: categoryId,
      cursor,
      limit
    });

    return (response?.data || []).map((tag) => ({
      tagId: tag.tag_id,
      tagName: tag.tag_name,
      postArticleCount: tag.post_article_count,
      concernCount: tag.concern_num
    }));
  }

  async getHotArticles({
    categoryId = "",
    sortType = SORT_TYPES.hot,
    cursor = "0",
    limit = 20
  } = {}) {
    const endpoint = categoryId ? ENDPOINTS.recommendCategory : ENDPOINTS.recommendAll;
    const payload = categoryId
      ? { cate_id: categoryId, sort_type: sortType, cursor, limit }
      : { id_type: 2, client_type: 2608, sort_type: sortType, cursor, limit };

    const response = await this.client.post(endpoint, payload);
    return (response?.data || [])
      .map((item) => item.item_info || item)
      .filter((item) => item?.article_info)
      .map((item) => normalizeArticle(item));
  }
}

export function normalizeArticle(item) {
  const info = item.article_info || {};
  const author = item.author_user_info || {};
  const tags = item.tags || [];
  const articleId = info.article_id || "";

  return {
    articleId,
    title: info.title || "",
    url: articleId ? `https://juejin.cn/post/${articleId}` : "",
    author: author.user_name || "",
    authorId: author.user_id || "",
    viewCount: info.view_count || 0,
    diggCount: info.digg_count || 0,
    commentCount: info.comment_count || 0,
    collectCount: info.collect_count || 0,
    briefContent: truncate(info.brief_content || "", 120),
    coverImage: info.cover_image || "",
    createdAt: toDateString(info.ctime),
    tags: tags.map((tag) => tag.tag_name).filter(Boolean),
    categoryName: info?.category?.category_name || ""
  };
}

export function formatRankingTable(articles, top = 10) {
  const lines = [
    "| # | Title | Author | Views | Likes | Comments |",
    "|---|---|---|---:|---:|---:|"
  ];

  articles.slice(0, top).forEach((article, index) => {
    const title = truncate(article.title, 50);
    lines.push(`| ${index + 1} | [${title}](${article.url}) | ${article.author} | ${formatCount(article.viewCount)} | ${formatCount(article.diggCount)} | ${formatCount(article.commentCount)} |`);
  });

  return lines.join("\n");
}
