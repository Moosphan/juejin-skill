import assert from "node:assert/strict";
import test from "node:test";

import { JuejinAuthenticator } from "../src/core/auth.js";

test("loginWithBrowser saves session when context cookies contain Juejin session cookie", async () => {
  let savedCookie = "";
  let savedMeta = null;
  let browserClosed = false;

  const store = {
    async save(cookie, meta) {
      savedCookie = cookie;
      savedMeta = meta;
    }
  };

  const browserFactory = {
    async launch() {
      return {
        async newContext() {
          return {
            async newPage() {
              return {
                async goto() {
                  return undefined;
                }
              };
            },
            async cookies() {
              return [
                { name: "foo", value: "bar", domain: ".example.com" },
                { name: "sessionid", value: "abc123", domain: ".juejin.cn" },
                { name: "sid_tt", value: "def456", domain: ".juejin.cn" }
              ];
            }
          };
        },
        async close() {
          browserClosed = true;
        }
      };
    }
  };

  const auth = new JuejinAuthenticator({
    store,
    browserFactory
  });

  const cookie = await auth.loginWithBrowser();

  assert.equal(cookie, "sessionid=abc123; sid_tt=def456");
  assert.equal(savedCookie, "sessionid=abc123; sid_tt=def456");
  assert.deepEqual(savedMeta, { cookiesCaptured: 2 });
  assert.equal(browserClosed, true);
});
