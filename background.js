chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// 读取页面已引用、但受同源策略限制的 CSS；只返回样式文本，不执行或注入。
// 不携带站点凭据，限制响应类型、大小与等待时间，并合并同时到来的重复请求。
const stylesheetRequests = new Map();
const stylesheetQueue = [];
let activeStylesheetRequests = 0;

function drainStylesheets() {
  while (activeStylesheetRequests < 32 && stylesheetQueue.length) {
    const { key, url, encoding, resolve, deadline } = stylesheetQueue.shift();
    const remaining = deadline - Date.now();
    if (remaining <= 0) { stylesheetRequests.delete(key); resolve(null); continue; }
    activeStylesheetRequests++;
    readStylesheet(url, remaining, encoding).catch(() => null).then(resolve).finally(() => {
      activeStylesheetRequests--;
      stylesheetRequests.delete(key);
      drainStylesheets();
    });
  }
}

function cssDecoder(label) {
  if (typeof label !== "string" || label.length > 64) return null;
  try { return new TextDecoder(label); } catch { return null; }
}

function stylesheetCharset(contentType) {
  let i = contentType.indexOf(";");
  if (i < 0) return null;
  while (i < contentType.length) {
    const start = ++i;
    while (i < contentType.length && contentType[i] !== "=" && contentType[i] !== ";") i++;
    const name = contentType.slice(start, i).trim().toLowerCase();
    if (contentType[i] !== "=") continue;
    i++;
    while (/[\t ]/.test(contentType[i] || "")) i++;
    let value = "";
    if (contentType[i] === '"') {
      for (i++; i < contentType.length && contentType[i] !== '"'; i++) {
        if (contentType[i] === "\\" && i + 1 < contentType.length) i++;
        value += contentType[i];
      }
      if (contentType[i] === '"') i++;
    } else {
      const valueStart = i;
      while (i < contentType.length && contentType[i] !== ";") i++;
      value = contentType.slice(valueStart, i).trim();
    }
    if (name === "charset") return value;
    while (i < contentType.length && contentType[i] !== ";") i++;
  }
  return null;
}

function decodeStylesheet(bytes, contentType, environmentEncoding) {
  // BOM 优先于 HTTP、精确的 @charset 声明及引用页面编码。
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder().decode(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  let decoder = cssDecoder(stylesheetCharset(contentType));
  if (!decoder) {
    const prefix = String.fromCharCode(...bytes.subarray(0, 1024));
    const label = /^@charset "([\x00-\x21\x23-\x7f]*)";/.exec(prefix)?.[1];
    decoder = cssDecoder(label);
    if (decoder?.encoding === "utf-16le" || decoder?.encoding === "utf-16be") decoder = new TextDecoder();
  }
  return (decoder || cssDecoder(environmentEncoding) || new TextDecoder()).decode(bytes);
}

async function readStylesheet(key, remaining, environmentEncoding) {
  const response = await fetch(key, { credentials: "omit", signal: AbortSignal.timeout(remaining) });
  if (!response.ok || !/^text\/css\b/i.test(response.headers.get("content-type") || "")) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 2 * 1024 * 1024) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return { css: decodeStylesheet(bytes, response.headers.get("content-type") || "", environmentEncoding) };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "sfs-read-stylesheet" || sender.id !== chrome.runtime.id || !sender.tab) return;
  let url;
  try { url = new URL(message.url); } catch { respond(null); return; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) { respond(null); return; }
  const encoding = (cssDecoder(message.encoding) || new TextDecoder()).encoding;
  const key = url.href + "\n" + encoding;
  if (stylesheetRequests.size >= 128 && !stylesheetRequests.has(key)) { respond(null); return; }
  let request = stylesheetRequests.get(key);
  if (!request) {
    let resolve;
    request = new Promise(done => { resolve = done; });
    stylesheetRequests.set(key, request);
    stylesheetQueue.push({ key, url: url.href, encoding, resolve, deadline: Date.now() + 5000 });
    drainStylesheets();
  }
  request.then(respond);
  return true;
});
