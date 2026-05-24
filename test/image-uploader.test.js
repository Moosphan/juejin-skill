import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  findMarkdownImageLinks,
  isLocalImageReference,
  replaceMarkdownImageUrls,
  resolveLocalImagePath,
  signImagexRequest,
  uploadLocalMarkdownImages
} from "../src/core/image-uploader.js";

test("findMarkdownImageLinks extracts local and remote markdown images", () => {
  const links = findMarkdownImageLinks([
    "![local](./images/a.png)",
    "![remote](https://example.com/b.png)",
    "![absolute](/tmp/c.webp \"cover\")"
  ].join("\n"));

  assert.deepEqual(links.map((link) => link.url), [
    "./images/a.png",
    "https://example.com/b.png",
    "/tmp/c.webp"
  ]);
});

test("isLocalImageReference skips remote and data images", () => {
  assert.equal(isLocalImageReference("./a.png"), true);
  assert.equal(isLocalImageReference("/tmp/a.png"), true);
  assert.equal(isLocalImageReference("https://example.com/a.png"), false);
  assert.equal(isLocalImageReference("//example.com/a.png"), false);
  assert.equal(isLocalImageReference("data:image/png;base64,abc"), false);
});

test("uploadLocalMarkdownImages uploads each unique local image and rewrites markdown", async () => {
  const baseDir = path.join(process.cwd(), "test/fixtures");
  const uploaded = [];
  const uploader = {
    async uploadLocalImage(filePath) {
      uploaded.push(filePath);
      return `https://juejin.example/${path.basename(filePath)}`;
    }
  };
  const markdown = [
    "![one](./a.png)",
    "![two](./a.png)",
    "![remote](https://example.com/remote.png)"
  ].join("\n");

  const result = await uploadLocalMarkdownImages(markdown, {
    baseDir,
    uploader
  });

  assert.deepEqual(uploaded, [
    path.join(baseDir, "a.png")
  ]);
  assert.match(result.content, /!\[one\]\(https:\/\/juejin\.example\/a\.png\)/);
  assert.match(result.content, /!\[two\]\(https:\/\/juejin\.example\/a\.png\)/);
  assert.match(result.content, /!\[remote\]\(https:\/\/example\.com\/remote\.png\)/);
  assert.deepEqual(result.uploadedImages, [
    {
      filePath: path.join(baseDir, "a.png"),
      url: "https://juejin.example/a.png"
    }
  ]);
});

test("replaceMarkdownImageUrls preserves optional image title", () => {
  const markdown = '![cover](./cover.png "封面")';
  const result = replaceMarkdownImageUrls(markdown, new Map([
    ["./cover.png", "https://juejin.example/cover.png"]
  ]));

  assert.equal(result, '![cover](https://juejin.example/cover.png "封面")');
});

test("resolveLocalImagePath decodes urls and strips query/hash", () => {
  const baseDir = path.join(process.cwd(), "test/fixtures");
  const result = resolveLocalImagePath("./images/%E6%B5%8B%E8%AF%95.png?x=1#top", baseDir);

  assert.equal(result, path.join(baseDir, "images/测试.png"));
});

test("signImagexRequest signs security token header without duplicating it", () => {
  const headers = signImagexRequest({
    search: {
      Action: "ApplyImageUpload",
      Version: "2018-08-01",
      ServiceId: "k3u1fbpfcp"
    },
    headers: {
      "X-Amz-Security-Token": "STS2token"
    },
    accessKeyId: "AKTPxxx",
    secretAccessKey: "secret",
    date: new Date("2026-05-24T03:00:00.000Z")
  });

  assert.equal(headers["X-Amz-Security-Token"], "STS2token");
  assert.equal(headers["X-Amz-Date"], "20260524T030000Z");
  assert.match(headers.Authorization, /Credential=AKTPxxx\/20260524\/cn-north-1\/imagex\/aws4_request/);
  assert.match(headers.Authorization, /SignedHeaders=x-amz-date;x-amz-security-token/);
});
