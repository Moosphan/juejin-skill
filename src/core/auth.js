import { chromium } from "playwright";

import { ENDPOINTS, JUEJIN_ORIGIN } from "./config.js";
import { JuejinHttpClient } from "./http.js";

const LOGIN_COOKIE_NAMES = new Set(["sessionid", "sid_tt"]);

export class JuejinAuthenticator {
  constructor({ store, headless = false, browserFactory = chromium } = {}) {
    this.store = store;
    this.headless = headless;
    this.browserFactory = browserFactory;
  }

  async loginWithBrowser() {
    const browser = await this.browserFactory.launch({ headless: this.headless });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(`${JUEJIN_ORIGIN}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 120000
      });

      const cookies = await waitForJuejinSessionCookies(context, {
        timeoutMs: 300000
      });
      const cookieHeader = buildCookieHeader(cookies);

      if (!cookieHeader) {
        throw new Error("Login completed but no Juejin cookies were captured.");
      }

      if (this.store) {
        await this.store.save(cookieHeader, {
          cookiesCaptured: cookies.length
        });
      }

      return cookieHeader;
    } finally {
      await browser.close();
    }
  }

  async loadCookie() {
    if (!this.store) {
      return "";
    }
    return this.store.load();
  }

  async verify(cookie) {
    if (!cookie) {
      return false;
    }

    const client = new JuejinHttpClient({ cookie });
    try {
      const response = await client.get(ENDPOINTS.currentUser);
      return response?.err_no === 0 && Boolean(response?.data);
    } catch {
      return false;
    }
  }
}

function buildCookieHeader(cookies) {
  return cookies
    .filter((entry) => entry.domain.includes("juejin.cn"))
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");
}

async function waitForJuejinSessionCookies(context, {
  timeoutMs = 300000,
  intervalMs = 1000
} = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const cookies = await context.cookies();
    const juejinCookies = cookies.filter((entry) => entry.domain.includes("juejin.cn"));
    const hasSessionCookie = juejinCookies.some((entry) => LOGIN_COOKIE_NAMES.has(entry.name));

    if (hasSessionCookie) {
      return juejinCookies;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Timed out waiting for Juejin session cookies.");
}
