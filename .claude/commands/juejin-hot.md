---
description: 查询掘金分类、标签或热榜文章。
allowed-tools: Bash
---

使用共享的 `juejin-skill` CLI，不要重复实现流程。

示例：
- `/juejin-hot 获取掘金前端热门文章`
- `/juejin-hot 列出掘金分类`

规则：
- 如果用户要看分类，执行 `node ./.juejin-skill/bin/juejin-skill.js categories --json`
- 如果用户要看标签，先确定分类，再执行 `node ./.juejin-skill/bin/juejin-skill.js tags --category <categoryId> --json`
- 其他情况下执行 `node ./.juejin-skill/bin/juejin-skill.js hot --limit 10`；如果用户指定了分类，再补上 `--category <categoryId>`
- 用中文总结结果，并在热榜回复中附带掘金文章链接
