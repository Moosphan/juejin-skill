import { DEFAULT_HEADERS } from "./config.js";

export class JuejinHttpClient {
  constructor({ cookie = "", fetchImpl = fetch } = {}) {
    this.cookie = cookie;
    this.fetchImpl = fetchImpl;
  }

  withCookie(cookie) {
    this.cookie = cookie;
    return this;
  }

  async get(url, { headers = {} } = {}) {
    return this.#request(url, {
      method: "GET",
      headers
    });
  }

  async post(url, body = {}, { headers = {} } = {}) {
    return this.#request(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  }

  async #request(url, init) {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: this.#headers(init.headers)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Juejin request failed: ${response.status} ${response.statusText} - ${text.slice(0, 300)}`);
    }

    return response.json();
  }

  #headers(extraHeaders) {
    const headers = {
      ...DEFAULT_HEADERS,
      ...extraHeaders
    };

    if (this.cookie) {
      headers.cookie = this.cookie;
    }

    return headers;
  }
}
