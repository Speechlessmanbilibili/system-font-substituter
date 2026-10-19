const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "..");
const id = "ecgcpjehkelnjfcgldmifejcoefohdcp";
let context, settings, server, origin;
before(async () => {
  server = http.createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end('<style>#t{font-family:Arial}#t:focus,#t:hover,#c:checked + #t{font-family:Georgia}</style><input id=c type=checkbox><p id=t tabindex=0>ABC中文</p>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
  context.setDefaultTimeout(5000);
  settings = await context.newPage();
  await settings.goto("chrome-extension://" + id + "/options.html");
  await settings.waitForFunction(() => !document.getElementById("save").disabled);
});
after(async () => { await context?.close(); if (server) await new Promise(resolve => server.close(resolve)); });

test("真实同步存储复用大段 CSS，网站规则分块往返，弹窗仅更新全局字段", async () => {
  const result = await settings.evaluate(async () => {
    await chrome.storage.sync.clear();
    const css = "/*" + "x".repeat(56000) + "*/";
    const rules = Array.from({ length: 50 }, (_, i) => ({ domain: "site" + i + ".example.com", action: "inherit" }));
    rules[0].customCSSMode = "site"; rules[0].customCSS = "body{color:red}";
    await SFS.writeSettings(chrome.storage.sync, { enabled: true, siteRules: rules }, css);
    const first = await chrome.storage.sync.get(null);
    await SFS.writeSettings(chrome.storage.sync, { enabled: false, siteRules: rules }, css);
    const second = await chrome.storage.sync.get(null);
    return { first: first.customCSSChunks, second: second.customCSSChunks, ruleChunks: second.siteRulesChunks,
      rules: SFS.normalizeSettings(second).siteRules, bytes: await chrome.storage.sync.getBytesInUse(null) };
  });
  assert.deepEqual(result.first, result.second);
  assert.ok(result.ruleChunks.count > 1);
  assert.equal(result.rules.length, 50);
  assert.equal(result.rules[0].customCSS, "body{color:red}");
  await settings.evaluate(async () => {
    await chrome.storage.sync.clear();
    const original = "/* 原内容 */body{color:black}";
    await SFS.writeSettings(chrome.storage.sync, { enabled: true }, original);
    const baseline = SFS.normalizeSettings(await chrome.storage.sync.get(null));
    await Promise.all([
      SFS.writeSettings(chrome.storage.sync, {}, "body{color:red}"),
      SFS.writeSettings(chrome.storage.sync, { enabled: false }, original, undefined, baseline)
    ]);
    const stored = await chrome.storage.sync.get(null);
    if (SFS.assembleCustomCSS(stored) !== "body{color:red}" || stored.enabled !== false) throw new Error("并发保存覆盖了独立修改");
    await SFS.writeSettings(chrome.storage.sync, { enabled: false, siteRules: baseline.siteRules }, "/*" + "x".repeat(56000) + "*/");
  });
  const beforePopup = await settings.evaluate(() => chrome.storage.sync.get("customCSSChunks"));
  const popup = await context.newPage();
  await popup.goto("chrome-extension://" + id + "/popup.html");
  await popup.waitForFunction(() => document.getElementById("global-state").textContent !== "读取中");
  await popup.locator("#enabled").check();
  await popup.waitForFunction(() => document.getElementById("status").textContent === "已保存");
  const stored = await settings.evaluate(() => chrome.storage.sync.get(null));
  assert.equal(stored.enabled, true);
  assert.deepEqual(stored.customCSSChunks, beforePopup.customCSSChunks);
  await popup.close();
  await settings.evaluate(async () => {
    await SFS.writeSettings(chrome.storage.sync, { siteRules: [] }, "");
    const stored = await chrome.storage.sync.get(null);
    if (Object.keys(stored).some(key => key.startsWith(SFS.RULE_PREFIX) || key.startsWith(SFS.SITE_CC_PREFIX))) throw new Error("旧分块未释放");
  });
});

test("设置页合并其他窗口的开关及网站规则，默认端口弹窗编辑原规则", async () => {
  await settings.evaluate(() => chrome.storage.sync.set({ enabled: true, siteRules: [{ domain: "example.com:443", action: "off" }] }));
  await settings.reload();
  await settings.waitForFunction(() => !document.getElementById("save").disabled);
  await settings.locator("#replacement").fill("Georgia");
  await settings.evaluate(() => chrome.storage.sync.set({ enabled: false, siteRules: [
    { domain: "example.com:443", action: "off" }, { domain: "new.example.com", action: "inherit" }
  ] }));
  await settings.locator("#save").click();
  await settings.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("success"));
  assert.equal(await settings.evaluate(async () => (await chrome.storage.sync.get("enabled")).enabled), false);
  assert.equal(await settings.locator(".site-rule-row").count(), 2);
  const popup = await context.newPage();
  await popup.addInitScript(() => { chrome.tabs.query = async () => [{ url: "https://example.com/" }]; });
  await popup.goto("chrome-extension://" + id + "/popup.html");
  await popup.waitForFunction(() => document.getElementById("host").textContent === "example.com");
  await popup.locator('input[name="site-mode"][value="force"]').click();
  await popup.waitForFunction(() => document.getElementById("status").textContent === "已保存");
  const rules = await settings.evaluate(async () => SFS.normalizeSettings(await chrome.storage.sync.get(null)).siteRules);
  assert.equal(rules.length, 2); assert.equal(rules[0].action, "force");
  await popup.close();
});

test("纯 CSS 聚焦、悬停及勾选切换重新判断字体，退出状态恢复替换", async () => {
  await settings.evaluate(async () => {
    await chrome.storage.sync.clear();
    await chrome.storage.sync.set({ enabled: true, replacement: "Courier New", targets: ["Arial"], customCSSOn: false });
  });
  const page = await context.newPage(); await page.goto(origin);
  const marked = value => page.waitForFunction(value => (document.getElementById("t").getAttribute("data-sfs-replaced") === "1") === value, value);
  await marked(true);
  await page.locator("#t").focus(); await marked(false);
  assert.equal(await page.locator("#t").evaluate(node => getComputedStyle(node).fontFamily), "Georgia");
  await page.locator("#t").evaluate(node => node.blur()); await marked(true);
  await page.locator("#t").hover(); await marked(false);
  await page.mouse.move(0, 0); await marked(true);
  await page.locator("#c").check(); await marked(false);
  await page.locator("#c").uncheck(); await marked(true);
  await page.close();
});
