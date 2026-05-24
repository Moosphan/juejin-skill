const CATEGORY_PROFILES = {
  frontend: {
    keywords: [
      "frontend", "前端", "react", "vue", "angular", "svelte", "javascript", "typescript",
      "css", "html", "dom", "vite", "webpack", "next.js", "nuxt", "浏览器", "组件", "ui"
    ]
  },
  backend: {
    keywords: [
      "backend", "后端", "java", "spring", "golang", "go ", "rust", "node.js", "nestjs",
      "数据库", "mysql", "postgres", "redis", "kafka", "api", "服务端", "微服务", "docker", "kubernetes"
    ]
  },
  android: {
    keywords: [
      "android", "kotlin", "jetpack", "compose", "apk", "gradle", "room", "android studio"
    ]
  },
  ios: {
    keywords: [
      "ios", "swift", "swiftui", "xcode", "objective-c", "uikit", "cocoapods"
    ]
  },
  ai: {
    keywords: [
      "ai", "llm", "rag", "gpt", "agent", "prompt", "embedding", "transformer", "人工智能",
      "大模型", "机器学习", "深度学习", "向量数据库", "多模态", "推理模型"
    ]
  },
  freebie: {
    keywords: [
      "工具", "tool", "cli", "命令行", "vscode", "neovim", "编辑器", "效率", "工作流",
      "github actions", "devops", "自动化", "脚手架"
    ]
  },
  career: {
    keywords: [
      "面试", "简历", "职场", "成长", "职业", "涨薪", "求职", "管理", "团队协作", "复盘", "面经"
    ]
  },
  article: {
    keywords: [
      "读书", "阅读", "书评", "随笔", "思考", "写作", "方法论", "知识管理"
    ]
  }
};

export function recommendCategories({ title = "", content = "", categories = [] }) {
  const source = `${title}\n${content}`.toLowerCase();

  const scored = categories.map((category) => {
    const profile = CATEGORY_PROFILES[category.categoryUrl] || CATEGORY_PROFILES[normalizeCategoryKey(category.categoryName)];
    const matches = [];
    let score = 0;

    for (const keyword of profile?.keywords || []) {
      const occurrences = countOccurrences(source, keyword.toLowerCase());
      if (!occurrences) {
        continue;
      }
      matches.push(keyword);
      score += occurrences * (title.toLowerCase().includes(keyword.toLowerCase()) ? 3 : 1);
    }

    if (!score && category.categoryName === "前端") {
      score = 1;
    }

    return {
      ...category,
      score,
      matches: unique(matches).slice(0, 6)
    };
  });

  const sorted = scored.sort((left, right) => right.score - left.score);
  const top = sorted[0];

  return {
    recommended: top ? toRecommendation(top, sorted[1]?.score || 0) : null,
    alternatives: sorted.slice(1, 4).map((item) => toRecommendation(item, 0))
  };
}

export function resolveCategoryInput(categories, rawInput) {
  if (!rawInput) {
    return null;
  }

  const normalized = `${rawInput}`.trim().toLowerCase();
  return categories.find((category) => {
    return (
      category.categoryId === rawInput ||
      category.categoryName.toLowerCase() === normalized ||
      category.categoryUrl.toLowerCase() === normalized
    );
  }) || null;
}

function toRecommendation(category, runnerUpScore) {
  const gap = category.score - runnerUpScore;
  return {
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    categoryUrl: category.categoryUrl,
    score: category.score,
    confidence: category.score >= 6 ? "high" : category.score >= 3 && gap >= 1 ? "medium" : "low",
    reason: category.matches.length
      ? `匹配关键词：${category.matches.join("、")}`
      : "未命中明显关键词，按默认技术文章分类回退",
    matches: category.matches
  };
}

function normalizeCategoryKey(categoryName) {
  const mapping = {
    "前端": "frontend",
    "后端": "backend",
    "人工智能": "ai",
    "开发工具": "freebie",
    "代码人生": "career",
    "阅读": "article"
  };
  return mapping[categoryName] || "";
}

function countOccurrences(source, keyword) {
  if (!keyword) {
    return 0;
  }
  let count = 0;
  let start = 0;
  while (true) {
    const index = source.indexOf(keyword, start);
    if (index === -1) {
      return count;
    }
    count += 1;
    start = index + keyword.length;
  }
}

function unique(values) {
  return [...new Set(values)];
}
