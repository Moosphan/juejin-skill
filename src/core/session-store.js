import { DEFAULT_COOKIE_PATH } from "./config.js";
import { expandHome, fileExists, readJsonIfExists, writeJson } from "./fs.js";

export class SessionStore {
  constructor({ filePath = DEFAULT_COOKIE_PATH } = {}) {
    this.filePath = expandHome(filePath);
  }

  async load() {
    const data = await readJsonIfExists(this.filePath);
    return data?.cookie || "";
  }

  async save(cookie, extra = {}) {
    await writeJson(this.filePath, {
      cookie,
      updatedAt: new Date().toISOString(),
      ...extra
    });
  }

  async clear() {
    if (await fileExists(this.filePath)) {
      const fs = await import("node:fs/promises");
      await fs.rm(this.filePath, { force: true });
    }
  }
}
