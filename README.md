# Juejin Skill

`Juejin Skill` 是一套面向 `Codex` 与 `Claude Code` 的掘金自动化文章获取和发布工具，提供统一的 JavaScript 运行时与双平台安装产物。

## 功能

- 获取掘金分类与标签
- 获取全站或分类热榜
- 通过 Playwright 登录并保存本地会话
- 发布本地 Markdown 到掘金
- 下载单篇文章或作者文章归档为 Markdown

## 自然语言调用示例

安装到 `Codex` 或 `Claude Code` 后，可以直接用自然语言触发。

- 查询分类：`掘金有哪些文章分类？`
- 查询热榜：`帮我看看掘金最近最火的文章`
- 登录掘金：`帮我登录掘金账号`
- 发布文章：`我想发布 ./test/fixtures/sample-ai-article.md 到掘金`
- 下载文章：`下载这篇掘金文章：https://juejin.cn/post/1234567890123456789`

如果用户未指定分类，技能会先读取文章内容并推荐分类，再向用户确认后继续发布。

## 运行要求

- Node.js `20.11+`
- npm `10+`
- Playwright Chromium

## 安装

### Codex

在发布产物目录中执行：

```bash
cd dist/codex/juejin-skill
bash ./scripts/install-codex.sh
```

安装脚本会自动：

- 复制技能到 `~/.codex/skills/juejin-skill`
- 安装 npm 依赖
- 安装 Playwright Chromium

安装完成后重启 Codex 即可。

### Claude Code

在发布产物目录中执行，并将参数替换为你的项目根目录：

```bash
bash /path/to/dist/claude/juejin-skill/scripts/install-claude.sh /path/to/your-project
```

安装脚本会自动：

- 将命令文件写入 `your-project/.claude/commands`
- 将共享运行时写入 `your-project/.juejin-skill`
- 安装 npm 依赖
- 安装 Playwright Chromium

## 发布

GitHub Actions 会生成两套发布产物：

- `dist/codex/juejin-skill`
- `dist/claude/juejin-skill`

推送 `v*` 标签后，工作流会自动上传对应压缩包到 GitHub Releases，并附带安装说明。

## 安全

- 会话文件默认保存在 `~/.juejin-skill/session.json`
- 默认不会公开发布文章
- 删除会话文件即可撤销本地登录态

## 验证

```bash
npm run lint
npm test
npm run build
```

## License

本项目基于 [MIT](./LICENSE) 协议开源。
