import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const codexDir = path.join(distDir, "codex", "juejin-skill");
const claudeDir = path.join(distDir, "claude", "juejin-skill");
const dryRun = process.argv.includes("--dry-run");

const sharedFiles = [
  "bin/juejin-skill.js",
  "package.json",
  "package-lock.json",
  "README.md",
  "SKILL.md"
];

const sharedDirectories = [
  "src",
  "scripts",
  "agents"
];

const claudeDirectories = [
  ".claude"
];

async function main() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(codexDir, { recursive: true });
  await fs.mkdir(claudeDir, { recursive: true });

  await copyInto(codexDir, sharedFiles, sharedDirectories);
  await copyInto(claudeDir, sharedFiles, [...sharedDirectories, ...claudeDirectories]);

  const manifest = {
    generatedAt: new Date().toISOString(),
    packages: {
      codex: {
        path: "dist/codex/juejin-skill"
      },
      claude: {
        path: "dist/claude/juejin-skill"
      }
    }
  };

  await fs.writeFile(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  if (!dryRun) {
    console.log(`Built release bundles in ${distDir}`);
  }
}

async function copyInto(destinationRoot, files, directories) {
  for (const file of files) {
    await copyItem(file, path.join(destinationRoot, file));
  }

  for (const directory of directories) {
    await copyDirectory(directory, path.join(destinationRoot, directory));
  }
}

async function copyDirectory(sourceRelative, destination) {
  const source = path.join(rootDir, sourceRelative);
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(path.relative(rootDir, sourcePath), destinationPath);
    } else {
      await copyItem(path.relative(rootDir, sourcePath), destinationPath);
    }
  }
}

async function copyItem(sourceRelative, destination) {
  const source = path.join(rootDir, sourceRelative);
  if (shouldSkipEntry(path.basename(source))) {
    return;
  }
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

function shouldSkipEntry(name) {
  return name === ".DS_Store";
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
