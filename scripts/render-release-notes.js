import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const outputFile = path.join(process.cwd(), "dist", "release-notes.md");

const currentRef = resolveCurrentRef();
const previousTag = resolvePreviousTag(currentRef);
const commits = resolveCommits(previousTag, currentRef);

const content = [
  `# Juejin Skill ${currentRef}`,
  "",
  "Dual-platform release for Codex and Claude Code.",
  "",
  "## Changes",
  "",
  ...renderCommitLines(commits),
  "",
  "## Install",
  "",
  "### Codex",
  "",
  "```bash",
  "tar -xzf juejin-skill-codex.tar.gz",
  "cd juejin-skill",
  "bash ./scripts/install-codex.sh",
  "```",
  "",
  "### Claude Code",
  "",
  "```bash",
  "tar -xzf juejin-skill-claude.tar.gz",
  "bash ./juejin-skill/scripts/install-claude.sh /path/to/your-project",
  "```",
  "",
  "## Bundles",
  "",
  "- `juejin-skill-codex.tar.gz`",
  "- `juejin-skill-claude.tar.gz`",
  "",
  "## Runtime",
  "",
  "- Node.js 20.11+",
  "- npm 10+",
  "- Playwright Chromium",
  ""
].join("\n");

await fs.mkdir(path.dirname(outputFile), { recursive: true });
await fs.writeFile(outputFile, content, "utf8");

function resolveCurrentRef() {
  const githubRefName = process.env.GITHUB_REF_NAME || "";
  if (githubRefName) {
    return githubRefName;
  }

  const exactTag = runGit(["describe", "--tags", "--exact-match", "HEAD"], {
    optional: true
  });
  return exactTag || runGit(["rev-parse", "--short", "HEAD"]);
}

function resolvePreviousTag(currentRef) {
  const allTags = runGit(["tag", "--list", "v*", "--sort=-v:refname"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const currentIndex = allTags.indexOf(currentRef);
  if (currentIndex >= 0) {
    return allTags[currentIndex + 1] || "";
  }

  return runGit(["describe", "--tags", "--abbrev=0", "HEAD^"], {
    optional: true
  });
}

function resolveCommits(previousTag, currentRef) {
  const range = previousTag ? `${previousTag}..${currentRef}` : currentRef;
  const output = runGit(["log", "--pretty=format:%h%x09%s", range], {
    optional: true
  });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, ...subjectParts] = line.split("\t");
      return {
        hash,
        subject: subjectParts.join("\t")
      };
    })
    .filter((commit) => commit.hash && commit.subject);
}

function renderCommitLines(commits) {
  if (!commits.length) {
    return ["- No commits found for this release."];
  }

  return commits.map((commit) => `- ${commit.subject} (${commit.hash})`);
}

function runGit(args, { optional = false } = {}) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", optional ? "ignore" : "pipe"]
    }).trim();
  } catch (error) {
    if (optional) {
      return "";
    }
    throw error;
  }
}
