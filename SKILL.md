---
name: juejin-skill
description: 当用户需要查询掘金分类或热榜、登录掘金、发布 Markdown 文章到掘金，或将掘金文章下载为本地 Markdown 文件时使用此技能。该技能提供共享的 Node.js CLI，并兼容 Claude Code 命令封装。
---

# 掘金技能

当任务明确与 `juejin.cn` 相关时，使用此技能。

## 能力范围

- 获取掘金分类与标签
- 获取全站或指定分类热榜
- 通过 Playwright 登录并保存本地会话
- 将 Markdown 文件发布到掘金，默认仅创建草稿
- 用 Markdown 更新已发布文章，默认仅更新草稿
- 下载单篇掘金文章或作者文章归档为 Markdown

## 安全约束

- 默认不会公开发布文章。
- 如需公开发布，必须同时显式传入 `--publish` 与 `--confirm-publish`，或设置 `JUEJIN_CONFIRM_PUBLISH=1`。
- 会话 Cookie 默认保存在 `~/.juejin-skill/session.json`，也可以通过 `--cookie-path` 覆盖。

## 工作流程

1. 如果任务需要账号能力，先执行 `juejin-skill login`。
2. 查询类任务优先使用 `categories`、`tags`、`hot`。
3. 发布类任务中，如果用户未指定分类，先读取文章标题和正文内容，推荐合适的掘金分类，并在发布前向用户确认。
4. 更新类任务必须提供文章 URL 或 ID；默认只更新关联草稿，公开更新必须确认。
5. 下载类任务优先走 API；如果详情接口失败，再使用页面回退逻辑。

## 常用命令

```bash
juejin-skill categories --json
juejin-skill hot --category 6809637767543259144 --limit 10
juejin-skill login
juejin-skill publish --file ./article.md --category 6809637767543259144 --tags 6809640407484334093
juejin-skill publish --file ./article.md
juejin-skill update --article https://juejin.cn/post/1234567890123456789 --file ./article.md
juejin-skill download --article https://juejin.cn/post/1234567890123456789
```

## 关键文件

- 共享 CLI：`bin/juejin-skill.js`
- 核心实现：`src/core/`
- Claude Code 命令：`.claude/commands/`
- 发布构建脚本：`scripts/build-release.js`

只有在需要安装或发布细节时再查看 [README.md](README.md)。
