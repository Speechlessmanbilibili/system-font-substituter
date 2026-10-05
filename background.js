chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

// 读取页面已引用、但受同源策略限制的 CSS；只返回样式文本，不执行或注入。
// 不携带站点凭据，限制响应类型、大小与等待时间，并合并同时到来的重复请求。
const stylesheetRequests = new Map();
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message?.type !== "sfs-read-stylesheet" || sender.id !== chrome.runtime.id || !sender.tab) return;
  let url;
  try { url = new URL(message.url); } catch { respond(null); return; }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) { respond(null); return; }
  const key = url.href;
  if (stylesheetRequests.size >= 32 && !stylesheetRequests.has(key)) { respond(null); return; }
  if (!stylesheetRequests.has(key)) {
    const request = (async () => {
      const response = await fetch(key, { credentials: "omit", signal: AbortSignal.timeout(5000) });
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
      const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(response.headers.get("content-type") || "")?.[1] || "utf-8";
      return { css: new TextDecoder(charset).decode(bytes) };
    })().catch(() => null).finally(() => stylesheetRequests.delete(key));
    stylesheetRequests.set(key, request);
  }
  stylesheetRequests.get(key).then(respond);
  return true;
});
