import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputFile = path.join(process.cwd(), "dist", "release-notes.md");

const content = `# Juejin Skill

Dual-platform release for Codex and Claude Code.

## Install

### Codex

\`\`\`bash
tar -xzf juejin-skill-codex.tar.gz
cd juejin-skill
bash ./scripts/install-codex.sh
\`\`\`

### Claude Code

\`\`\`bash
tar -xzf juejin-skill-claude.tar.gz
bash ./juejin-skill/scripts/install-claude.sh /path/to/your-project
\`\`\`

## Bundles

- \`juejin-skill-codex.tar.gz\`
- \`juejin-skill-claude.tar.gz\`

## Runtime

- Node.js 20.11+
- npm 10+
- Playwright Chromium
`;

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, content, "utf8");
