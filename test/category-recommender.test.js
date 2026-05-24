import test from "node:test";
import assert from "node:assert/strict";

import { recommendCategories } from "../src/core/category-recommender.js";

test("recommendCategories prefers AI for rag article content", () => {
  const result = recommendCategories({
    title: "用 RAG 和向量数据库搭建企业知识库问答系统",
    content: "本文介绍 Embedding、向量数据库、大模型与 Agent 编排。",
    categories: [
      { categoryId: "1", categoryName: "前端", categoryUrl: "frontend" },
      { categoryId: "2", categoryName: "后端", categoryUrl: "backend" },
      { categoryId: "3", categoryName: "人工智能", categoryUrl: "ai" }
    ]
  });

  assert.equal(result.recommended?.categoryName, "人工智能");
  assert.equal(result.recommended?.confidence, "high");
});
