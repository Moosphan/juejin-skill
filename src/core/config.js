export const JUEJIN_ORIGIN = "https://juejin.cn";
export const JUEJIN_API_ORIGIN = "https://api.juejin.cn";

export const ENDPOINTS = {
  categories: `${JUEJIN_API_ORIGIN}/tag_api/v1/query_category_briefs`,
  categoryTags: `${JUEJIN_API_ORIGIN}/recommend_api/v1/tag/recommend_tag_list`,
  recommendAll: `${JUEJIN_API_ORIGIN}/recommend_api/v1/article/recommend_all_feed`,
  recommendCategory: `${JUEJIN_API_ORIGIN}/recommend_api/v1/article/recommend_cate_feed`,
  articleDetail: `${JUEJIN_API_ORIGIN}/content_api/v1/article/detail`,
  articleList: `${JUEJIN_API_ORIGIN}/content_api/v1/article/query_list`,
  createDraft: `${JUEJIN_API_ORIGIN}/content_api/v1/article_draft/create`,
  publishArticle: `${JUEJIN_API_ORIGIN}/content_api/v1/article/publish`,
  imagexToken: `${JUEJIN_API_ORIGIN}/imagex/gen_token?client=web`,
  imagexUrl: `${JUEJIN_API_ORIGIN}/imagex/get_img_url`,
  currentUser: `${JUEJIN_API_ORIGIN}/user_api/v1/user/get`
};

export const DEFAULT_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "content-type": "application/json",
  "origin": JUEJIN_ORIGIN,
  "referer": `${JUEJIN_ORIGIN}/`,
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
};

export const DEFAULT_COOKIE_PATH = "~/.juejin-skill/session.json";

export const SORT_TYPES = {
  hot: 200,
  latest: 300,
  threeDays: 3,
  sevenDays: 7,
  thirtyDays: 30,
  history: 1
};

export const DEFAULT_CATEGORY_ID = "6809637767543259144";
