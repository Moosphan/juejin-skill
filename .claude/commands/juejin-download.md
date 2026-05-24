---
description: 下载掘金文章或作者文章归档为本地 Markdown 文件。
allowed-tools: Bash
---

使用共享 CLI：

- 单篇文章：
  `node ./.juejin-skill/bin/juejin-skill.js download --article <url-or-id> --output-dir ./output`
- 作者归档：
  `node ./.juejin-skill/bin/juejin-skill.js download-user --user <url-or-id> --output-dir ./output --max-count 20`

如果用户还需要下载图片，附加 `--download-images`。
在回复里返回最终保存的文件路径。
