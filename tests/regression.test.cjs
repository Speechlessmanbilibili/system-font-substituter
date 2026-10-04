const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { webcrypto } = require("node:crypto");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "shared.js"), "utf8");
const scope = vm.createContext({ URL, TextEncoder, structuredClone, crypto: webcrypto, console: { warn() {} } });
vm.runInContext(source, scope);
const SFS = scope.SFS;

test("站点规则保留端口，识别默认端口与 IPv6", () => {
  const cases = [
    ["127.0.0.1:3350", "http://127.0.0.1:3350/", true],
    ["127.0.0.1:3350", "http://127.0.0.1:3351/", false],
    ["127.0.0.1:3350", "http://127.0.0.1/", false],
    ["127.0.0.1", "http://127.0.0.1:8080/", true],
    ["http://127.0.0.1:3350/path?q=1", "http://127.0.0.1:3350/", true],
    ["localhost:003350", "http://localhost:3350/", true],
    ["example.com:80", "http://example.com/", true],
    ["https://example.com:443/path", "https://example.com/", true],
    ["https://example.com:443", "http://example.com/", false],
    ["[::1]:3350", "http://[::1]:3350/", true],
    ["[::1]:3350", "http://[::1]:8080/", false],
    ["[0:0:0:0:0:0:0:1]:3350", "http://[::1]:3350/", true],
    ["[::1]", "http://[::1]:8080/", true],
    ["example.com", "https://sub.example.com/", true],
    ["*.example.com", "https://example.com/", true],
    ["example.com", "https://evil-example.com/", false],
    ["example.com", "https://example.com.evil.test/", false],
    ["www.example.com", "https://example.com/", false],
    ["www.example.com", "https://www.example.com/", true],
    ["example.com.", "https://example.com/", true],
    ["例子.测试", "https://xn--fsqu00a.xn--0zwm56d/", true]
  ];
  for (const [domain, url, force] of cases) {
    assert.equal(SFS.siteState([{ domain }], new URL(url)).force, force, domain + " => " + url);
  }
  for (const domain of ["", "example.com:99999", "example.com:abc", "http://u:p@example.com", "ftp://example.com", "::1", "bad host", ":80", "example.com:"]) {
    assert.equal(SFS.parseDomain(domain), null, domain);
  }
});

test("更具体的站点规则优先，同等规则维持顺序", () => {
  const rules = [
    { domain: "example.com", action: "off" },
    { domain: "sub.example.com", font: "Arial", autoSpacing: "on" },
    { domain: "sub.example.com:3350", action: "off" }
  ];
  assert.equal(SFS.siteState(rules, "http://sub.example.com:3350").off, true);
  assert.equal(SFS.siteState(rules, "http://sub.example.com:8080").font, "Arial");
  assert.equal(SFS.siteState(rules, "http://example.com:8080").off, true);
  assert.equal(SFS.siteState([{ domain: "example.com", action: "off" }, { domain: "example.com" }], "https://example.com").off, true);
  assert.equal(SFS.ruleOverride(false), "");
  assert.equal(SFS.ruleOverride(true), "on");
  assert.equal(SFS.ruleOverride("off"), "off");
});

test("默认值一致，损坏的存储项不会导致崩溃", () => {
  const settings = SFS.normalizeSettings({ enabled: "false", targets: [null, 12, "Arial"], siteRules: [null, "bad", { domain: "example.com" }], replacement: "" });
  assert.equal(settings.enabled, true);
  assert.equal(settings.targets.length, 1);
  assert.equal(settings.siteRules.length, 1);
  assert.ok(SFS.DEFAULTS.targets.includes("OpenAI Sans"));
  assert.ok(SFS.DEFAULTS.targets.includes("OpenAI Sans SC"));
  assert.equal(SFS.DEFAULT_CUSTOM_CSS.trim(), fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8").replace(/\r\n/g, "\n").trim());
});

test("旧版 CSS 读取兼容，缺块与无效键不会静默拼接", () => {
  assert.equal(SFS.assembleCustomCSS({ customCSS: "" }), "");
  assert.equal(SFS.assembleCustomCSS({ "customCSS#1": "b", "customCSS#0": "a", "customCSS#junk": "wrong" }), "ab");
  assert.equal(SFS.assembleCustomCSS({ "customCSS#0": "a", "customCSS#2": "c" }), null);
  assert.equal(SFS.assembleCustomCSS({ "customCSS#0": 1, customCSS: "legacy" }), "legacy");
  assert.equal(SFS.assembleCustomCSS({ customCSSChunks: { id: "test", count: 2 }, "customCSS#test/0": "a" }), null);
});

test("CSS 按实际字节预算分块，空内容保留为空", () => {
  for (const css of ["", "a".repeat(9000), "中文".repeat(4000), "\u0001\\".repeat(6000), "𬎆".repeat(4000)]) {
    const { items, meta } = SFS.chunkCustomCSS(css, "unit");
    assert.equal(SFS.assembleCustomCSS({ ...items, customCSSChunks: meta }), css);
    for (const [key, value] of Object.entries(items)) {
      assert.ok(value.length <= 2500);
      assert.ok(Buffer.byteLength(key + JSON.stringify(value)) <= 7500);
    }
  }
});

test("CSS 发布一次切换引用，失败保留旧内容，清理失败不改变成功结果", async () => {
  let store = { "customCSS#0": "legacy", unrelated: 1 };
  const reads = [];
  const storage = {
    get: async () => structuredClone(store),
    set: async values => { Object.assign(store, values); reads.push(SFS.assembleCustomCSS(store)); },
    remove: async keys => { keys.forEach(key => delete store[key]); reads.push(SFS.assembleCustomCSS(store)); }
  };
  await SFS.writeSettings(storage, { enabled: false }, "new".repeat(3000), "new");
  assert.ok(reads.every(css => css === "new".repeat(3000)));
  assert.equal(store.unrelated, 1);
  assert.equal(store["customCSS#0"], undefined);
  const before = JSON.stringify(store);
  storage.set = async () => { throw Error("quota"); };
  await assert.rejects(SFS.writeSettings(storage, { enabled: true }, "", "failed"), /quota/);
  assert.equal(JSON.stringify(store), before);
  storage.set = async values => Object.assign(store, values);
  storage.remove = async () => { throw Error("cleanup"); };
  await SFS.writeSettings(storage, {}, "", "empty");
  assert.equal(SFS.assembleCustomCSS(store), "");
});

let browser, server, origin;
const fixtures = new Map();
before(async () => {
  server = http.createServer((request, response) => {
    const file = request.url.split("?")[0];
    if (fixtures.has(file)) {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(fixtures.get(file));
      return;
    }
    if (file === "/slow.css") {
      response.setHeader("Content-Type", "text/css");
      setTimeout(() => response.end(".delayed{font-family:Arial}"), 150);
      return;
    }
    const allowed = ["options.html", "options.css", "options.js", "content.js", "shared.js"];
    const name = file.slice(1);
    if (!allowed.includes(name)) { response.writeHead(404); response.end(); return; }
    response.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : name.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript");
    response.end(fs.readFileSync(path.join(root, name)));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function pageFor(html, stored = {}, options = false, language = "zh-CN") {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ stored, language }) => {
    window.__store = stored;
    window.__writes = 0;
    window.__setDelay = 0;
    window.__failSet = false;
    const listeners = [];
    const storage = {
      get: async () => structuredClone(window.__store),
      set: async values => {
        window.__writes++;
        if (window.__setDelay) await new Promise(resolve => setTimeout(resolve, window.__setDelay));
        if (window.__failSet) throw Error("quota");
        const changes = {};
        for (const [key, value] of Object.entries(values)) {
          if (JSON.stringify(value) !== JSON.stringify(window.__store[key])) {
            changes[key] = { oldValue: window.__store[key], newValue: value };
          }
        }
        Object.assign(window.__store, values);
        if (Object.keys(changes).length) listeners.forEach(callback => callback(changes, "sync"));
      },
      remove: async keys => {
        const changes = {};
        for (const key of typeof keys === "string" ? [keys] : keys) {
          if (key in window.__store) {
            changes[key] = { oldValue: window.__store[key] };
            delete window.__store[key];
          }
        }
        if (Object.keys(changes).length) listeners.forEach(callback => callback(changes, "sync"));
      }
    };
    window.chrome = { storage: { sync: storage, onChanged: { addListener: callback => listeners.push(callback) } }, i18n: { getUILanguage: () => language } };
    window.__change = values => storage.set(values);
  }, { stored, language });
  if (options) await page.goto(origin + "/options.html");
  else {
    const url = "/case-" + fixtures.size;
    fixtures.set(url, "<!doctype html><html><head></head><body>" + html + '<script src="/shared.js"></script><script src="/content.js"></script></body></html>');
    await page.goto(origin + url);
  }
  page.__errors = errors;
  return page;
}

async function family(page, id) {
  return page.locator("#" + id).evaluate(el => getComputedStyle(el).fontFamily);
}
async function marked(page, id, value = true) {
  await page.waitForFunction(({ id, value }) => document.getElementById(id).hasAttribute("data-sfs-replaced") === value, { id, value });
}
const base = { targets: ["Arial"], replacement: "serif", standardLigatures: true, autoSpacing: true };

test("端口规则在真实内容脚本中只命中指定端口", async () => {
  const port = new URL(origin).port;
  const page = await pageFor('<p id="text" style="font-family: CustomFont">Text</p>', { ...base, siteRules: [{ domain: "127.0.0.1:" + (Number(port) + 1) }] });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("#text").getAttribute("data-sfs-replaced"), null);
  await page.evaluate(port => __change({ siteRules: [{ domain: "127.0.0.1:" + port }] }), port);
  await marked(page, "text");
  assert.equal(await family(page, "text"), "serif");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("代码、图标和 SVG 保护不会被已替换祖先的继承样式破坏", async () => {
  const page = await pageFor('<div id="parent" style="font-family: Arial; font-variant-ligatures:none; text-autospace:no-autospace">Root <span id="child">Child</span><code id="code" style="font-family:inherit">Code</code><i id="icon" class="material-icons" style="font-family:inherit">home</i><svg><text id="svg">SVG</text></svg><span id="design" style="font-family: CustomFont">Design</span></div>', base);
  await marked(page, "parent");
  await marked(page, "child");
  for (const id of ["code", "icon", "svg", "design"]) {
    assert.equal(await page.locator("#" + id).getAttribute("data-sfs-replaced"), null, id);
    assert.notEqual(await family(page, id), "serif", id);
  }
  assert.equal(await page.locator("#code").evaluate(el => getComputedStyle(el).fontVariantLigatures), "none");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("属性、文本、继承字体与新增样式变化会重新检查", async () => {
  const page = await pageFor('<style>.target{font-family:Arial}.design{font-family:CustomFont}</style><div id="parent" class="target">Parent<span id="child">Child</span></div><p id="dynamic" class="design">Old</p><p id="empty" class="target"></p>', base);
  await marked(page, "child");
  await page.evaluate(() => {
    document.getElementById("dynamic").className = "target";
    document.getElementById("empty").appendChild(document.createTextNode(""));
    document.getElementById("empty").firstChild.nodeValue = "New";
    const span = document.createElement("span"); span.id = "added"; span.textContent = "Added"; document.getElementById("parent").appendChild(span);
  });
  await marked(page, "dynamic");
  await marked(page, "empty");
  await marked(page, "added");
  await page.evaluate(() => { document.getElementById("parent").className = "design"; });
  await marked(page, "parent", false);
  await marked(page, "child", false);
  await page.evaluate(() => { const style = document.createElement("style"); style.textContent = ".design{font-family:Arial}"; document.body.appendChild(style); });
  await marked(page, "parent");
  await marked(page, "child");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("大页面分片保持原字体判断，关闭后没有遗留标记或网站样式损失", async () => {
  const children = Array.from({ length: 4200 }, (_, i) => '<span id="n' + i + '">Text</span>').join("");
  const page = await pageFor('<div id="parent" style="font-family:Arial">Root' + children + "</div>", base);
  await marked(page, "n4199");
  assert.equal(await page.locator("[data-sfs-replaced]").count(), 4201);
  await page.evaluate(() => {
    document.documentElement.style.fontVariationSettings = '"wght" 500';
    __change({ siteRules: [{ domain: "127.0.0.1", action: "off" }] });
  });
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("[data-sfs-replaced], [data-sfs-preserve]").count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.style.fontVariationSettings), '"wght" 500');
  assert.equal(await page.locator("#sfs-style, #sfs-custom-style").count(), 0);
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("空 CSS 恢复普通链，非空 CSS 只在检测命中后注入，禁用后清理", async () => {
  const page = await pageFor('<p id="text" style="font-family: CustomFont">Text</p>', { ...base, customCSSOn: true, customCSS: "" });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("#sfs-custom-style").count(), 0);
  await page.evaluate(() => { document.getElementById("text").style.fontFamily = "Arial"; });
  await marked(page, "text");
  assert.equal(await family(page, "text"), "serif");
  await page.evaluate(() => __change({ customCSS: '[data-sfs-replaced="1"]{font-family: monospace !important}' }));
  await page.waitForFunction(() => !!document.getElementById("sfs-custom-style"));
  assert.equal(await family(page, "text"), "monospace");
  await page.evaluate(() => __change({ enabled: false }));
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("#sfs-style, #sfs-custom-style").count(), 0);
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("内容脚本只读取旧 CSS，不在多个网页中触发迁移写入", async () => {
  const page = await pageFor('<p style="font-family:Arial">Text</p>', { ...base, customCSS: "legacy" });
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.evaluate(() => __writes), 0);
  assert.equal(await page.evaluate(() => __store.customCSS), "legacy");
  await page.close();
});

test("设置页统一默认名单、保存空 CSS、失败保留旧内容", async () => {
  const page = await pageFor("", {}, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  assert.ok((await page.locator("#targets").inputValue()).includes("OpenAI Sans"));
  await page.locator("#customCSS").fill("");
  await page.locator("#save").click();
  await page.waitForFunction(() => !!__store.customCSSChunks && !document.getElementById("save").disabled);
  assert.equal(await page.evaluate(() => SFS.assembleCustomCSS(__store)), "");
  await page.evaluate(() => { __failSet = true; });
  await page.locator("#customCSS").fill("changed");
  await page.locator("#save").click();
  await page.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("error"));
  assert.equal(await page.evaluate(() => SFS.assembleCustomCSS(__store)), "");
  assert.equal(await page.locator("#customCSS").inputValue(), "changed");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("设置页阻止重复保存，保存期间的新编辑继续标记未保存", async () => {
  const page = await pageFor("", {}, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  await page.evaluate(() => { __setDelay = 200; });
  await page.locator("#replacement").fill("serif");
  await page.locator("#save").click();
  await page.locator("#replacement").fill("monospace");
  await page.keyboard.press("Control+s");
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  assert.equal(await page.evaluate(() => __store.replacement), "serif");
  assert.equal(await page.evaluate(() => __writes), 1);
  assert.ok((await page.locator("#unsavedHint").getAttribute("class")).includes("visible"));
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("规则格式验证和双语设置页", async () => {
  for (const language of ["zh-CN", "en"]) {
    const page = await pageFor("", {}, true, language);
    await page.waitForFunction(() => !document.getElementById("save").disabled);
    await page.locator("#addSiteRule").click();
    await page.locator(".rule-domain").fill("localhost:bad");
    await page.locator("#save").click();
    assert.equal(await page.evaluate(() => __writes), 0);
    assert.ok((await page.locator("#status").getAttribute("class")).includes("error"));
    await page.locator(".rule-domain").fill("[::1]:3350");
    await page.locator("#save").click();
    await page.waitForFunction(() => !document.getElementById("save").disabled && !!__store.siteRules);
    assert.equal(await page.evaluate(() => __store.siteRules[0].domain), "[::1]:3350");
    assert.equal(await page.evaluate(() => document.documentElement.lang), language);
    assert.equal(await page.locator('[data-preset="mixed"]').innerText(), language === "en" ? "Mixed" : "综合");
    assert.deepEqual(page.__errors, []);
    await page.close();
  }
});

test("异步样式表加载与扩展样式被移除后的恢复", async () => {
  const page = await pageFor('<p id="text" class="delayed">Text</p>', base);
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
  await page.evaluate(() => {
    const link = document.createElement("link"); link.rel = "stylesheet"; link.href = "/slow.css"; document.head.appendChild(link);
  });
  await marked(page, "text");
  await page.evaluate(() => document.getElementById("sfs-style").remove());
  await page.waitForFunction(() => !!document.getElementById("sfs-style"));
  assert.equal(await family(page, "text"), "serif");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("未完成扫描时禁用与恢复默认失败都保留正确状态", async () => {
  const html = Array.from({ length: 12000 }, (_, i) => '<span id="n' + i + '" style="font-family:Arial">Text</span>').join("");
  const page = await pageFor(html, base);
  await page.evaluate(() => __change({ enabled: false }));
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  // 等待旧分片回调有机会执行，验证它们不能再次写入标记。
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.locator("[data-sfs-replaced]").count(), 0);
  assert.deepEqual(page.__errors, []);
  await page.close();
  const options = await pageFor("", { ...base, customCSS: "legacy" }, true);
  await options.waitForFunction(() => !document.getElementById("reset").disabled);
  await options.evaluate(() => { __failSet = true; });
  await options.locator("#reset").click();
  await options.waitForFunction(() => !document.getElementById("reset").disabled && document.getElementById("status").classList.contains("error"));
  assert.equal(await options.evaluate(() => __store.customCSS), "legacy");
  assert.equal(await options.locator("#customCSS").inputValue(), "legacy");
  assert.deepEqual(options.__errors, []);
  await options.close();
});

test("中文与英文设置页在常用窄屏宽度下不发生水平溢出", async () => {
  const page = await pageFor("", {}, true, "en");
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  for (const width of [360, 480, 720, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "width=" + width);
  }
  await page.close();
});

test("真实 MV3 加载、隔离内容脚本与同步存储联动", async () => {
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    assert.equal(id, "ecgcpjehkelnjfcgldmifejcoefohdcp");
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), "2.1.1");
    const port = new URL(origin).port;
    await worker.evaluate(({ port, base }) => chrome.storage.sync.set({
      ...base, siteRules: [{ domain: "127.0.0.1:" + port }]
    }), { port, base });
    fixtures.set("/real-case", '<!doctype html><html><head></head><body><p id="text" style="font-family:CustomFont">Text</p></body></html>');
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/real-case");
    await marked(page, "text");
    assert.equal(await family(page, "text"), "serif");
    await worker.evaluate(port => chrome.storage.sync.set({ siteRules: [{ domain: "127.0.0.1:" + (Number(port) + 1) }] }), port);
    await marked(page, "text", false);
    assert.equal(await family(page, "text"), "CustomFont");
    const options = await context.newPage();
    await options.goto("chrome-extension://" + id + "/options.html");
    await options.waitForFunction(() => !document.getElementById("save").disabled);
    await options.locator("#customCSS").fill("\u0001\\".repeat(6000));
    await options.locator("#save").click();
    await options.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").textContent);
    assert.ok((await options.locator("#status").getAttribute("class")).includes("success"));
    assert.equal(await options.evaluate(async () => SFS.assembleCustomCSS(await chrome.storage.sync.get(null))), "\u0001\\".repeat(6000));
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test("交错读取设置时只应用最后一次结果", async () => {
  const page = await pageFor('<p id="text" style="font-family:Arial">Text</p>', base);
  await marked(page, "text");
  await page.evaluate(async () => {
    let calls = 0;
    let done;
    const slow = new Promise(resolve => { done = resolve; });
    chrome.storage.sync.get = async () => {
      const snapshot = structuredClone(__store);
      if (calls++ === 0) {
        await new Promise(resolve => setTimeout(resolve, 150));
        done();
      }
      return snapshot;
    };
    await __change({ enabled: false });
    await __change({ enabled: true });
    await slow;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await page.locator("#text").getAttribute("data-sfs-replaced"), "1");
  assert.deepEqual(page.__errors, []);
  await page.close();
});
