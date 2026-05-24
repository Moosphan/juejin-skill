---
description: 将 Markdown 文件发布到掘金，默认仅创建草稿。
allowed-tools: Bash
---

使用共享 CLI，并保持公开发布为显式确认模式。

流程：
1. 先确认用户提供的 Markdown 文件路径。
2. 如果用户未指定分类，先执行：
   `node ./.juejin-skill/bin/juejin-skill.js publish --file <path>`
   然后根据返回的推荐分类向用户确认。
3. 用户确认分类后，默认仅创建草稿：
   `node ./.juejin-skill/bin/juejin-skill.js publish --file <path> --category <categoryId> --tags <comma-separated-tag-ids>`
4. 只有用户明确要求公开发布时，才附加 `--publish` 和 `--confirm-publish`
5. 最终将 `draftId` 或公开文章链接返回给用户
