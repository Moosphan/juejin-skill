import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { extractFromHtml } from "../src/core/downloader.js";

test("extractFromHtml reads title author and content", async () => {
  const html = await fs.readFile(path.join(process.cwd(), "test/fixtures/sample-juejin-page.html"), "utf8");
  const result = extractFromHtml(html);

  assert.equal(result.title, "测试文章");
  assert.equal(result.author, "测试作者");
  assert.match(result.contentHtml, /这里是一段正文/);
});
