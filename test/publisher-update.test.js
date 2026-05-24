import assert from "node:assert/strict";
import test from "node:test";

import { ArticlePublisher, normalizeJuejinImageUrls } from "../src/core/publisher.js";

test("normalizeJuejinImageUrls converts Juejin CDN URLs into editor image URIs", () => {
  const result = normalizeJuejinImageUrls({
    markContent: "![图](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abc123~tplv-k3u1fbpfcp-watermark.image?)",
    htmlContent: '<p><img src="https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abc123~tplv-k3u1fbpfcp-watermark.image?" alt="图"></p>'
  });

  assert.equal(result.markContent, "![图](tos-cn-i-k3u1fbpfcp/abc123)");
  assert.equal(result.htmlContent, '<p><img src="tos-cn-i-k3u1fbpfcp/abc123" alt="图"></p>');
  assert.deepEqual(result.pics, [
    {
      pic_url: "https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abc123~tplv-k3u1fbpfcp-watermark.image?",
      pic_uri: "tos-cn-i-k3u1fbpfcp/abc123"
    }
  ]);
});

test("ArticlePublisher.updateMarkdown updates draft only by default", async () => {
  const posts = [];
  const client = {
    async post(url, body) {
      posts.push({ url, body });
      if (url.endsWith("/article/detail")) {
        return {
          err_no: 0,
          data: {
            article_info: {
              article_id: "7642924957018669097",
              draft_id: "draft-1",
              category_id: "6809637771511070734",
              tag_ids: [7467857238494020000],
              link_url: "",
              cover_image: "https://example.com/cover.png",
              is_gfw: 0,
              title: "旧标题",
              brief_content: "旧摘要",
              is_english: 0,
              is_original: 1
            },
            tags: [
              { tag_id: "7467857238494019610", tag_name: "AI编程" }
            ],
            theme_list: [
              { theme_id: "theme-1" }
            ]
          }
        };
      }
      if (url.endsWith("/article_draft/update")) {
        return {
          err_no: 0,
          data: { id: body.id }
        };
      }
      throw new Error(`Unexpected POST ${url}`);
    }
  };

  const publisher = new ArticlePublisher({ client });
  const result = await publisher.updateMarkdown({
    articleIdOrUrl: "https://juejin.cn/post/7642924957018669097",
    title: "新标题",
    content: "正文\n\n![图](https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abc123~tplv-k3u1fbpfcp-watermark.image?)"
  });

  assert.equal(result.success, true);
  assert.equal(result.draftId, "draft-1");
  assert.equal(posts.length, 2);
  assert.equal(posts[1].body.title, "新标题");
  assert.deepEqual(posts[1].body.tag_ids, ["7467857238494019610"]);
  assert.deepEqual(posts[1].body.theme_ids, ["theme-1"]);
  assert.deepEqual(posts[1].body.pics, [
    {
      pic_url: "https://p9-juejin.byteimg.com/tos-cn-i-k3u1fbpfcp/abc123~tplv-k3u1fbpfcp-watermark.image?",
      pic_uri: "tos-cn-i-k3u1fbpfcp/abc123"
    }
  ]);
  assert.match(posts[1].body.mark_content, /!\[图\]\(tos-cn-i-k3u1fbpfcp\/abc123\)/);
});

test("ArticlePublisher.updateMarkdown republishes when explicitly allowed", async () => {
  const posts = [];
  const client = {
    async post(url, body) {
      posts.push({ url, body });
      if (url.endsWith("/article/detail")) {
        return {
          err_no: 0,
          data: {
            article_info: {
              article_id: "7642924957018669097",
              draft_id: "draft-1",
              category_id: "6809637771511070734",
              tag_ids: [],
              title: "旧标题",
              brief_content: "旧摘要"
            },
            tags: []
          }
        };
      }
      if (url.endsWith("/article_draft/update")) {
        return {
          err_no: 0,
          data: { id: body.id }
        };
      }
      if (url.endsWith("/article/publish")) {
        return {
          err_no: 0,
          data: { article_id: "7642924957018669097" }
        };
      }
      throw new Error(`Unexpected POST ${url}`);
    }
  };

  const publisher = new ArticlePublisher({ client });
  const result = await publisher.updateMarkdown({
    articleIdOrUrl: "7642924957018669097",
    title: "新标题",
    content: "正文",
    saveDraftOnly: false,
    allowPublicPublish: true
  });

  assert.equal(result.success, true);
  assert.equal(result.articleId, "7642924957018669097");
  assert.equal(posts.length, 3);
  assert.equal(posts[2].body.draft_id, "draft-1");
});
