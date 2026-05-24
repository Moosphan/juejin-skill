import fs from "node:fs/promises";
import path from "node:path";

import {
  ArticleDownloader,
  ArticlePublisher,
  DEFAULT_CATEGORY_ID,
  HotArticleService,
  JuejinAuthenticator,
  JuejinHttpClient,
  readMarkdownFile,
  recommendCategories,
  resolveCategoryInput,
  SessionStore,
  SORT_TYPES,
  formatRankingTable
} from "../core/index.js";

export async function runCli(argv) {
  const [command = "help", ...rest] = argv;

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return;
    case "login":
      await handleLogin(rest);
      return;
    case "verify":
      await handleVerify(rest);
      return;
    case "categories":
      await handleCategories(rest);
      return;
    case "hot":
      await handleHot(rest);
      return;
    case "download":
      await handleDownload(rest);
      return;
    case "download-user":
      await handleDownloadUser(rest);
      return;
    case "publish":
      await handlePublish(rest);
      return;
    case "update":
      await handleUpdate(rest);
      return;
    case "tags":
      await handleTags(rest);
      return;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHelp() {
  console.log(`juejin-skill

Usage:
  juejin-skill login [--cookie-path path] [--headless]
  juejin-skill verify [--cookie-path path]
  juejin-skill categories [--json]
  juejin-skill hot [--category id] [--sort hot|latest|threeDays|sevenDays|thirtyDays|history] [--limit 10] [--json]
  juejin-skill tags [--category id] [--keyword text] [--limit 20] [--json]
  juejin-skill publish --file article.md [--title text] [--category id] [--tags id1,id2] [--brief text] [--cover url] [--publish] [--confirm-publish]
  juejin-skill update --article urlOrId --file article.md [--title text] [--brief text] [--cover url] [--publish] [--confirm-publish]
  juejin-skill download --article urlOrId [--output-dir dir] [--download-images]
  juejin-skill download-user --user urlOrId [--output-dir dir] [--max-count 20] [--download-images]
`);
}

async function handleLogin(args) {
  const options = parseOptions(args);
  const store = new SessionStore({ filePath: options["cookie-path"] });
  const auth = new JuejinAuthenticator({
    store,
    headless: Boolean(options.headless)
  });
  const cookie = await auth.loginWithBrowser();
  console.log(JSON.stringify({
    success: true,
    cookiePath: store.filePath,
    cookieLength: cookie.length
  }, null, 2));
}

async function handleVerify(args) {
  const options = parseOptions(args);
  const store = new SessionStore({ filePath: options["cookie-path"] });
  const auth = new JuejinAuthenticator({ store });
  const cookie = await resolveCookie(options, store);
  const valid = await auth.verify(cookie);
  console.log(JSON.stringify({
    success: valid,
    cookiePath: store.filePath
  }, null, 2));
}

async function handleCategories(args) {
  const options = parseOptions(args);
  const service = new HotArticleService({
    client: new JuejinHttpClient()
  });
  const categories = await service.getCategories();
  printData(categories, options.json);
}

async function handleTags(args) {
  const options = parseOptions(args);
  const service = new HotArticleService({
    client: new JuejinHttpClient()
  });
  const categories = await service.getCategories();
  const resolvedCategory = resolveCategoryInput(categories, options.category) || categories.find((item) => item.categoryId === DEFAULT_CATEGORY_ID);
  const tags = await service.getTags(resolvedCategory?.categoryId || DEFAULT_CATEGORY_ID, {
    limit: Number(options.limit || 20)
  });
  const filtered = options.keyword
    ? tags.filter((tag) => tag.tagName.toLowerCase().includes(`${options.keyword}`.toLowerCase()))
    : tags;
  printData(filtered, options.json);
}

async function handleHot(args) {
  const options = parseOptions(args);
  const service = new HotArticleService({
    client: new JuejinHttpClient()
  });
  const categories = await service.getCategories();
  const resolvedCategory = options.category ? resolveCategoryInput(categories, options.category) : null;
  const articles = await service.getHotArticles({
    categoryId: resolvedCategory?.categoryId || "",
    sortType: SORT_TYPES[options.sort] || SORT_TYPES.hot,
    limit: Number(options.limit || 10)
  });

  if (options.json) {
    printData(articles, true);
    return;
  }

  console.log(formatRankingTable(articles, Number(options.limit || 10)));
}

async function handlePublish(args) {
  const options = parseOptions(args);
  if (!options.file) {
    throw new Error("--file is required for publish");
  }

  const service = new HotArticleService({
    client: new JuejinHttpClient()
  });
  const categories = await service.getCategories();
  const article = await readMarkdownFile(options.file, options.title || "");
  const resolvedCategory = options.category ? resolveCategoryInput(categories, options.category) : null;

  if (options.category && !resolvedCategory) {
    throw new Error(`Unknown category: ${options.category}`);
  }

  if (!resolvedCategory) {
    const recommendation = recommendCategories({
      title: article.title,
      content: article.content,
      categories
    });

    printData({
      success: false,
      requiresCategoryConfirmation: true,
      article: {
        filePath: options.file,
        title: article.title,
        preview: article.content.slice(0, 180)
      },
      recommendedCategory: recommendation.recommended,
      alternativeCategories: recommendation.alternatives,
      nextStep: "请先向用户确认推荐分类，再使用 --category <分类名或分类ID> 重新执行 publish。"
    }, true);
    return;
  }

  const store = new SessionStore({ filePath: options["cookie-path"] });
  const cookie = await resolveCookie(options, store);
  if (!cookie) {
    throw new Error("No Juejin cookie found. Run `juejin-skill login` first.");
  }

  const publishRequested = Boolean(options.publish);
  const publishConfirmed = Boolean(options["confirm-publish"]) || process.env.JUEJIN_CONFIRM_PUBLISH === "1";
  const publisher = new ArticlePublisher({
    client: new JuejinHttpClient({ cookie })
  });

  const result = await publisher.publishMarkdown({
    filePath: options.file,
    title: options.title || "",
    categoryId: resolvedCategory.categoryId || DEFAULT_CATEGORY_ID,
    tagIds: splitCsv(options.tags),
    briefContent: options.brief || "",
    coverImage: options.cover || "",
    saveDraftOnly: !publishRequested,
    allowPublicPublish: publishRequested && publishConfirmed
  });

  printData({
    ...result,
    category: {
      categoryId: resolvedCategory.categoryId,
      categoryName: resolvedCategory.categoryName
    }
  }, true);
}

async function handleUpdate(args) {
  const options = parseOptions(args);
  if (!options.article) {
    throw new Error("--article is required for update");
  }

  if (!options.file) {
    throw new Error("--file is required for update");
  }

  const store = new SessionStore({ filePath: options["cookie-path"] });
  const cookie = await resolveCookie(options, store);
  if (!cookie) {
    throw new Error("No Juejin cookie found. Run `juejin-skill login` first.");
  }

  const publishRequested = Boolean(options.publish);
  const publishConfirmed = Boolean(options["confirm-publish"]) || process.env.JUEJIN_CONFIRM_PUBLISH === "1";
  const publisher = new ArticlePublisher({
    client: new JuejinHttpClient({ cookie })
  });

  const result = await publisher.updateMarkdown({
    articleIdOrUrl: options.article,
    filePath: options.file,
    title: options.title || "",
    briefContent: options.brief || "",
    coverImage: options.cover,
    saveDraftOnly: !publishRequested,
    allowPublicPublish: publishRequested && publishConfirmed
  });

  printData(result, true);
}

async function handleDownload(args) {
  const options = parseOptions(args);
  if (!options.article) {
    throw new Error("--article is required");
  }

  const cookie = await maybeLoadCookie(options);
  const downloader = new ArticleDownloader({
    client: new JuejinHttpClient({ cookie })
  });
  const result = await downloader.downloadArticle(options.article, {
    outputDir: options["output-dir"] || "./output",
    downloadImages: Boolean(options["download-images"])
  });
  printData(result, true);
}

async function handleDownloadUser(args) {
  const options = parseOptions(args);
  if (!options.user) {
    throw new Error("--user is required");
  }

  const cookie = await maybeLoadCookie(options);
  const downloader = new ArticleDownloader({
    client: new JuejinHttpClient({ cookie })
  });
  const result = await downloader.downloadUserArticles(options.user, {
    outputDir: options["output-dir"] || "./output",
    maxCount: Number(options["max-count"] || 20),
    downloadImages: Boolean(options["download-images"])
  });
  printData(result, true);
}

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return options;
}

function splitCsv(value) {
  if (!value) {
    return [];
  }
  return `${value}`.split(",").map((item) => item.trim()).filter(Boolean);
}

function printData(data, asJson) {
  if (asJson) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (Array.isArray(data)) {
    console.log(data.map((item) => JSON.stringify(item)).join("\n"));
    return;
  }

  console.log(JSON.stringify(data, null, 2));
}

async function maybeLoadCookie(options) {
  const store = new SessionStore({ filePath: options["cookie-path"] });
  return resolveCookie(options, store, false);
}

async function resolveCookie(options, store, required = true) {
  if (options.cookie) {
    return `${options.cookie}`;
  }
  const cookie = await store.load();
  if (!cookie && required) {
    throw new Error(`Cookie not found at ${store.filePath}`);
  }
  return cookie;
}

export async function runNaturalLanguagePrompt({
  prompt,
  outputFile,
  cwd = process.cwd()
}) {
  const normalized = `${prompt}`.toLowerCase();
  let content = "";

  if (normalized.includes("分类")) {
    content = "Run `juejin-skill categories --json` and summarize the categories.";
  } else if (normalized.includes("热门") || normalized.includes("热榜")) {
    content = "Run `juejin-skill hot --limit 10` and summarize the ranking.";
  } else if (normalized.includes("更新") || normalized.includes("编辑")) {
    content = "Run `juejin-skill update --article <url-or-id> --file <path-to-markdown>` after making sure the user confirmed whether to update the published article publicly.";
  } else if (normalized.includes("发布")) {
    content = "Run `juejin-skill publish --file <path-to-markdown>` after making sure the user confirmed the category, tags, and whether to publish publicly.";
  } else if (normalized.includes("下载")) {
    content = "Run `juejin-skill download --article <url-or-id>` or `download-user` depending on whether the user wants one article or a whole author archive.";
  } else if (normalized.includes("登录")) {
    content = "Run `juejin-skill login` and wait for browser sign-in to finish.";
  } else {
    content = "Use the juejin-skill CLI to inspect categories, fetch rankings, publish markdown, or download articles as needed.";
  }

  const destination = path.resolve(cwd, outputFile);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, content, "utf8");
}
