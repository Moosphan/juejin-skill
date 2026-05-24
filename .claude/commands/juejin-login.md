---
description: 打开浏览器登录掘金，并保存本地会话 Cookie。
allowed-tools: Bash
---

使用共享的 `juejin-skill` CLI：

```bash
node ./.juejin-skill/bin/juejin-skill.js login
```

向用户说明：
- 会打开一个由 Playwright 控制的浏览器窗口
- 掘金 Cookie 默认保存在 `~/.juejin-skill/session.json`
- 后续删除该文件即可撤销本地登录态
