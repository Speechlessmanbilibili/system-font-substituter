const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");

function background(fetch) {
  let listener;
  vm.runInNewContext(source, { URL, TextDecoder, Uint8Array, AbortSignal, fetch,
    chrome: { action: { onClicked: { addListener() {} } }, runtime: { id: "test", onMessage: { addListener(callback) { listener = callback; } } } } });
  return (url, sender = { id: "test", tab: { id: 1 } }) => new Promise(resolve => {
    if (listener({ type: "sfs-read-stylesheet", url }, sender, resolve) !== true) resolve(null);
  });
}
function cssResponse(css = ".target{font-family:Arial}") {
  return new Response(css, { headers: { "Content-Type": "text/css; charset=utf-8" } });
}
test("40 张跨域 CSS 排队完成，最多并发 32 个并合并重复请求", async () => {
  let active = 0, maximum = 0, calls = 0;
  const read = background(async (url, options) => {
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal instanceof AbortSignal);
    calls++; active++; maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 10)); active--;
    return cssResponse();
  });
  const results = await Promise.all([...Array.from({ length: 40 }, (_, i) => read("https://example.com/" + i + ".css")), read("https://example.com/0.css")]);
  assert.equal(calls, 40);
  assert.equal(maximum, 32);
  assert.ok(results.every(result => result.css.includes("Arial")));
  await read("https://example.com/0.css");
  assert.equal(calls, 41, "完成后应允许重新读取网站更新的 CSS");
});
test("请求失败后继续排队，响应类型、大小和来源仍校验", async () => {
  const read = background(async url => {
    if (url.endsWith("error.css")) throw Error("network");
    if (url.endsWith("html.css")) return new Response("<html>", { headers: { "Content-Type": "text/html" } });
    if (url.endsWith("large.css")) return cssResponse("a".repeat(2 * 1024 * 1024 + 1));
    return cssResponse("/* 中文 */");
  });
  assert.equal(await read("file:///test.css"), null);
  assert.equal(await read("https://u:p@example.com/test.css"), null);
  assert.equal(await read("https://example.com/test.css", { id: "other", tab: {} }), null);
  assert.equal(await read("https://example.com/test.css", { id: "test" }), null);
  for (const name of ["error", "html", "large"]) assert.equal(await read("https://example.com/" + name + ".css"), null);
  const results = await Promise.all(Array.from({ length: 40 }, (_, i) => read("https://example.com/valid-" + i + ".css")));
  assert.ok(results.every(result => result.css === "/* 中文 */"));
});

test("大量读取保持队列容量上限，已接收请求完整结束", async () => {
  let release, calls = 0;
  const barrier = new Promise(resolve => { release = resolve; });
  const read = background(async () => { calls++; await barrier; return cssResponse(); });
  const pending = Array.from({ length: 160 }, (_, i) => read("https://example.com/burst-" + i + ".css"));
  assert.equal(calls, 32);
  release();
  const results = await Promise.all(pending);
  assert.equal(calls, 128);
  assert.ok(results.slice(0, 128).every(result => result?.css));
  assert.ok(results.slice(128).every(result => result === null));
});
