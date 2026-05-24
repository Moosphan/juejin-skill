import test from "node:test";
import assert from "node:assert/strict";

import { HotArticleService } from "../src/core/hot.js";
import { ArticlePublisher } from "../src/core/publisher.js";

test("HotArticleService.getTags parses recommend_tag_list payload", async () => {
  const client = {
    async post() {
      return {
        data: [
          {
            tag_id: "7467857238494019610",
            tag_name: "AI编程",
            post_article_count: 10161,
            concern_user_count: 27530
          },
          {
            tag_id: "",
            tag_name: ""
          }
        ]
      };
    }
  };

  const service = new HotArticleService({ client });
  const tags = await service.getTags("6809637771511070734");

  assert.deepEqual(tags, [
    {
      tagId: "7467857238494019610",
      tagName: "AI编程",
      postArticleCount: 10161,
      concernCount: 27530
    }
  ]);
});

test("ArticlePublisher.searchTags filters recommend_tag_list payload by keyword", async () => {
  const client = {
    async post() {
      return {
        data: [
          { tag_id: "1", tag_name: "AI编程" },
          { tag_id: "2", tag_name: "Agent" },
          { tag_id: "", tag_name: "" }
        ]
      };
    }
  };

  const publisher = new ArticlePublisher({ client });
  const tags = await publisher.searchTags("6809637771511070734", "AI");

  assert.deepEqual(tags, [
    { tagId: "1", tagName: "AI编程" }
  ]);
});
