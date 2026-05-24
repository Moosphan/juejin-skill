import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { ENDPOINTS } from "./config.js";

const IMAGE_SERVICE_ID = "k3u1fbpfcp";
const IMAGE_HOST = "imagex.bytedanceapi.com";
const IMAGE_REGION = "cn-north-1";
const IMAGE_SERVICE = "imagex";
const IMAGE_VERSION = "2018-08-01";
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const UNSIGNABLE_HEADERS = [
  "authorization",
  "content-type",
  "content-length",
  "user-agent",
  "presigned-expires",
  "expect",
  "x-amzn-trace-id"
];

export class JuejinImageUploader {
  constructor({ client, fetchImpl = fetch } = {}) {
    this.client = client;
    this.fetchImpl = fetchImpl;
  }

  async uploadLocalImage(filePath) {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      throw new Error(`Local image is not a file: ${filePath}`);
    }

    if (stats.size > MAX_IMAGE_SIZE) {
      throw new Error(`Local image is larger than 20MB: ${filePath}`);
    }

    const data = await fs.readFile(filePath);
    const token = await this.#getUploadToken();
    const applyResponse = await this.#signedImagexRequest({
      action: "ApplyImageUpload",
      token,
      params: {
        ServiceId: IMAGE_SERVICE_ID
      }
    });

    const uploadAddress = applyResponse?.Result?.UploadAddress;
    const storeInfo = uploadAddress?.StoreInfos?.[0];
    const uploadHost = uploadAddress?.UploadHosts?.[0];
    if (!uploadAddress || !storeInfo || !uploadHost) {
      throw new Error("Juejin image upload did not return an upload address.");
    }

    await this.#putImage({
      uploadHost,
      storeInfo,
      data,
      contentType: getImageContentType(filePath)
    });

    const commitResponse = await this.#signedImagexRequest({
      method: "POST",
      action: "CommitImageUpload",
      token,
      params: {
        ServiceId: IMAGE_SERVICE_ID,
        SessionKey: uploadAddress.SessionKey
      }
    });

    const uri = commitResponse?.Result?.Results?.[0]?.Uri;
    if (!uri) {
      throw new Error("Juejin image upload did not return an image uri.");
    }

    return this.#getImageUrl(uri);
  }

  async #getUploadToken() {
    const response = await this.client.get(ENDPOINTS.imagexToken);
    const token = response?.data?.token;
    if (!token?.AccessKeyId || !token?.SecretAccessKey || !token?.SessionToken) {
      throw new Error("Failed to get Juejin image upload token.");
    }
    return token;
  }

  async #signedImagexRequest({ method = "GET", action, token, params = {} }) {
    const search = {
      Action: action,
      Version: IMAGE_VERSION,
      ...params
    };
    const headers = signImagexRequest({
      method,
      search,
      headers: {
        "X-Amz-Security-Token": token.SessionToken
      },
      accessKeyId: token.AccessKeyId,
      secretAccessKey: token.SecretAccessKey
    });
    const url = `https://${IMAGE_HOST}/?${new URLSearchParams(search).toString()}`;
    const response = await this.fetchImpl(url, {
      method,
      headers
    });
    const body = await parseJsonResponse(response, "Juejin imagex request failed");
    const error = body?.ResponseMetadata?.Error;
    if (error) {
      throw new Error(`Juejin imagex request failed: ${error.Code || "UNKNOWN"} - ${error.Message || ""}`);
    }
    return body;
  }

  async #putImage({ uploadHost, storeInfo, data, contentType }) {
    const response = await this.fetchImpl(`https://${uploadHost}/${storeInfo.StoreUri}`, {
      method: "POST",
      headers: {
        Authorization: storeInfo.Auth,
        "Content-CRC32": "Ignore",
        "Specified-Content-Type": contentType
      },
      body: data
    });
    const body = await parseJsonResponse(response, "Juejin image upload failed");
    if (body?.success !== 0) {
      throw new Error(`Juejin image upload failed: ${body?.error?.message || "unknown error"}`);
    }
  }

  async #getImageUrl(uri) {
    const response = await this.client.get(`${ENDPOINTS.imagexUrl}?uri=${encodeURIComponent(uri)}`);
    const url = response?.data?.main_url || response?.data?.backup_url;
    if (!url) {
      throw new Error("Failed to get Juejin image URL.");
    }
    return url;
  }
}

export async function uploadLocalMarkdownImages(markdownContent, {
  baseDir = process.cwd(),
  uploader
} = {}) {
  if (!uploader) {
    throw new Error("Image uploader is required.");
  }

  const links = findMarkdownImageLinks(markdownContent);
  const localLinks = links.filter((link) => isLocalImageReference(link.url));
  if (!localLinks.length) {
    return {
      content: markdownContent,
      uploadedImages: []
    };
  }

  const uploadsByPath = new Map();
  for (const link of localLinks) {
    const filePath = resolveLocalImagePath(link.url, baseDir);
    if (!uploadsByPath.has(filePath)) {
      uploadsByPath.set(filePath, uploader.uploadLocalImage(filePath));
    }
  }

  const replacements = new Map();
  const uploadedImages = [];
  for (const link of localLinks) {
    const filePath = resolveLocalImagePath(link.url, baseDir);
    const remoteUrl = await uploadsByPath.get(filePath);
    replacements.set(link.url, remoteUrl);
    if (!uploadedImages.some((item) => item.filePath === filePath)) {
      uploadedImages.push({
        filePath,
        url: remoteUrl
      });
    }
  }

  return {
    content: replaceMarkdownImageUrls(markdownContent, replacements),
    uploadedImages
  };
}

export function findMarkdownImageLinks(markdownContent) {
  const links = [];
  const imageRegex = /!\[([^\]\n]*(?:\][^\]\n]*)*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = imageRegex.exec(markdownContent)) !== null) {
    links.push({
      raw: match[0],
      alt: match[1],
      url: stripWrapping(match[2])
    });
  }
  return links;
}

export function replaceMarkdownImageUrls(markdownContent, replacements) {
  return markdownContent.replace(/(!\[[^\]\n]*(?:\][^\]\n]*)*\]\()([^) \t\n]+)((?:\s+"[^"]*")?\))/g, (match, prefix, url, suffix) => {
    const cleanUrl = stripWrapping(url);
    const replacement = replacements.get(cleanUrl);
    return replacement ? `${prefix}${replacement}${suffix}` : match;
  });
}

export function isLocalImageReference(imageUrl) {
  if (!imageUrl || imageUrl.startsWith("#")) {
    return false;
  }

  if (/^(?:https?:|data:|blob:|mailto:|ftp:|\/\/)/i.test(imageUrl)) {
    return false;
  }

  return true;
}

export function resolveLocalImagePath(imageUrl, baseDir) {
  const withoutQuery = stripWrapping(imageUrl).split("#")[0].split("?")[0];
  const decoded = decodeURIComponent(withoutQuery);
  return path.isAbsolute(decoded) ? decoded : path.resolve(baseDir, decoded);
}

export function signImagexRequest({
  method = "GET",
  search,
  headers = {},
  body = "",
  accessKeyId,
  secretAccessKey,
  date = new Date()
}) {
  const xAmzDate = formatAmzDate(date);
  const requestHeaders = {
    ...headers,
    "X-Amz-Date": xAmzDate
  };
  const canonicalHeaderEntries = Object.entries(requestHeaders)
    .map(([key, value]) => [key.toLowerCase(), `${value}`.replace(/\s+/g, " ").trim()])
    .filter(([key]) => !UNSIGNABLE_HEADERS.includes(key))
    .sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = canonicalHeaderEntries.map(([key, value]) => `${key}:${value}`).join("\n");
  const signedHeaders = canonicalHeaderEntries.map(([key]) => key).join(";");
  const scope = [xAmzDate.slice(0, 8), IMAGE_REGION, IMAGE_SERVICE, "aws4_request"].join("/");
  const canonicalRequest = [
    method.toUpperCase(),
    "/",
    canonicalQuery(search),
    `${canonicalHeaders}\n`,
    signedHeaders,
    body ? sha256Hex(body) : sha256Hex("")
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    xAmzDate,
    scope,
    sha256Hex(canonicalRequest)
  ].join("\n");
  const dateKey = hmac(`AWS4${secretAccessKey}`, xAmzDate.slice(0, 8));
  const regionKey = hmac(dateKey, IMAGE_REGION);
  const serviceKey = hmac(regionKey, IMAGE_SERVICE);
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");

  return {
    ...requestHeaders,
    Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  };
}

function canonicalQuery(search) {
  return Object.keys(search)
    .sort()
    .map((key) => {
      const value = search[key];
      if (value === null || value === undefined) {
        return "";
      }
      const encodedKey = encodeImagexURIComponent(key);
      if (Array.isArray(value)) {
        return `${encodedKey}=${value.map(encodeImagexURIComponent).sort().join(`&${encodedKey}=`)}`;
      }
      return `${encodedKey}=${encodeImagexURIComponent(value)}`;
    })
    .filter(Boolean)
    .join("&");
}

function encodeImagexURIComponent(value) {
  return encodeURIComponent(`${value}`)
    .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
    .replace(/[*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data).digest(encoding);
}

function sha256Hex(data) {
  return crypto.createHash("sha256").update(data).digest("hex");
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function stripWrapping(value) {
  return `${value}`.replace(/^<|>$/g, "");
}

function getImageContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".apng": "image/apng",
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  };
  return types[extension] || "application/octet-stream";
}

async function parseJsonResponse(response, prefix) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${prefix}: ${response.status} ${response.statusText} - ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${prefix}: invalid JSON response`);
  }
}
