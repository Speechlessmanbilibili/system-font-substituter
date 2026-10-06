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
  for (const domain of ["", "example.com:99999", "example.com:abc", "http://u:p@example.com", "ftp://example.com", "::1", "bad host", ":80", "example.com:", "foo*.example.com", "**.example.com", "*", "https://foo*.example.com/path", "foo%2a.example.com", "%2a.example.com"]) {
    assert.equal(SFS.parseDomain(domain), null, domain);
  }
});

test("特殊地址按最近的有效来源匹配，保留来源端口及 blob 自身来源", () => {
  const cases = [
    ["https://own.example.com:8080/path", ["https://parent.example.com"], "https://own.example.com:8080/path"],
    ["about:blank", ["https://parent.example.com:8080/path", "https://top.example.com"], "https://parent.example.com:8080/path"],
    ["about:srcdoc", ["", "null", "https://parent.example.com:8080", "https://top.example.com"], "https://parent.example.com:8080/"],
    ["data:text/html,Text", ["https://parent.example.com:8080/path"], "https://parent.example.com:8080/path"],
    ["blob:https://creator.example.com:8080/id", ["https://parent.example.com"], "https://creator.example.com:8080"],
    ["blob:null/id", ["", "https://parent.example.com:8080"], "https://parent.example.com:8080/"],
    ["about:blank", ["", "null"], "about:blank"]
  ];
  for (const [address, sources, expected] of cases) assert.equal(SFS.sourceAddress(address, ...sources), expected, address);
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

test("连字等级兼容旧开关，显式等级优先且站点继承不强制替换", () => {
  assert.equal(SFS.normalizeSettings({ standardLigatures: true }).ligatureLevel, "standard");
  assert.equal(SFS.normalizeSettings({ standardLigatures: false }).ligatureLevel, "native");
  assert.equal(SFS.normalizeSettings({ standardLigatures: true, ligatureLevel: "none" }).ligatureLevel, "none");
  assert.equal(SFS.normalizeSettings({ ligatureLevel: "extended" }).standardLigatures, true);
  assert.equal(SFS.siteLigatureLevel({ standardLigatures: "off" }), "native");
  assert.equal(SFS.siteLigatureLevel({ standardLigatures: "on" }), "standard");
  assert.equal(SFS.siteLigatureLevel({ standardLigatures: "on", ligatureLevel: "" }), "");
  const site = SFS.siteState([{ domain: "example.com", action: "inherit", autoSpacing: "on", ligatureLevel: "none" }], "https://example.com");
  assert.equal(site.force, false);
  assert.equal(site.off, false);
  assert.equal(site.overrides.autoSpacing, "on");
  assert.equal(site.overrides.ligatureLevel, "none");
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

test("本站 CSS 分块与引用一次发布，显式空内容不继承，失败与删除正确处理", async () => {
  let store = { customCSS: "global-old", "siteCSS#old/0": "site-old" };
  const reads = [];
  const storage = {
    get: async () => structuredClone(store),
    set: async values => { Object.assign(store, values); reads.push(SFS.normalizeSettings(store)); },
    remove: async keys => keys.forEach(key => delete store[key])
  };
  const css = "/*中文𬎆*/".repeat(1400);
  await SFS.writeSettings(storage, { siteRules: [
    { domain: "example.com", action: "inherit", customCSSMode: "site", customCSS: css },
    { domain: "empty.example.com", customCSSMode: "site", customCSS: "" },
    { domain: "global.example.com" }
  ] }, "global-new", "sites");
  assert.equal(reads[0].siteRules[0].customCSS, css);
  assert.equal(SFS.normalizeSettings(store).siteRules[1].customCSS, "");
  assert.equal(SFS.siteState(SFS.normalizeSettings(store).siteRules, "https://empty.example.com").customCSS, "");
  assert.equal(SFS.siteState(SFS.normalizeSettings(store).siteRules, "https://global.example.com").customCSS, null);
  assert.ok(!("customCSS" in store.siteRules[0]));
  assert.ok(Buffer.byteLength(JSON.stringify(store.siteRules)) < 7500);
  for (const [key, value] of Object.entries(store).filter(([key]) => key.startsWith("siteCSS#"))) {
    assert.ok(value.length <= 2500);
    assert.ok(Buffer.byteLength(key + JSON.stringify(value)) <= 7500);
  }
  assert.equal(store["siteCSS#old/0"], undefined);
  const before = JSON.stringify(store);
  storage.set = async () => { throw Error("quota"); };
  await assert.rejects(SFS.writeSettings(storage, { siteRules: [] }, "", "failed"), /quota/);
  assert.equal(JSON.stringify(store), before);
  storage.set = async values => Object.assign(store, values);
  await SFS.writeSettings(storage, { siteRules: [] }, "global-new", "removed");
  assert.equal(Object.keys(store).some(key => key.startsWith("siteCSS#")), false);
});

let browser, server, origin;
const fixtures = new Map();
before(async () => {
  server = http.createServer((request, response) => {
    const file = request.url.split("?")[0];
    if (fixtures.has(file)) {
      const fixture = fixtures.get(file);
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      if (fixture.csp) response.setHeader("Content-Security-Policy", fixture.csp);
      response.end(typeof fixture === "string" ? fixture : fixture.html);
      return;
    }
    if (file === "/attribute-font.css") {
      response.setHeader("Content-Type", "text/css");
      response.end('#text{font-family:attr(data-font type(<custom-ident>),Arial)}');
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

async function pageFor(html, stored = {}, options = false, language = "zh-CN", initHook = null) {
  const page = await browser.newPage();
  if (initHook) await page.addInitScript(initHook);
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
async function selectChoice(page, control, value) {
  await control.click();
  await page.locator('.select-option[data-value="' + value + '"]').click();
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

test("各档连字保留其他 OpenType 特性，动态切换与旁观恢复网站样式", async () => {
  const page = await pageFor('<div id="text" style="font-family:Arial;font-variant-ligatures:no-contextual;font-feature-settings:&quot;tnum&quot; 1,&quot;zero&quot; 1,&quot;calt&quot; 0,&quot;rlig&quot; 1">fi fl ct st <code id="code">fi fl</code></div>', { ...base, ligatureLevel: "none" });
  await marked(page, "text");
  for (const [level, liga, dlig] of [["none", 0, 0], ["standard", 1, 0], ["extended", 1, 1]]) {
    await page.evaluate(level => __change({ ligatureLevel: level }), level);
    await page.waitForFunction(({ liga, dlig }) => {
      const css = getComputedStyle(document.getElementById("text"));
      const features = Object.fromEntries([...css.fontFeatureSettings.matchAll(/"(.{4})"(?:\s+(\d+))?/g)].map(match => [match[1], Number(match[2] ?? 1)]));
      return features.liga === liga && features.dlig === dlig;
    }, { liga, dlig });
    const css = await page.locator("#text").evaluate(el => ({ features: Object.fromEntries([...getComputedStyle(el).fontFeatureSettings.matchAll(/"(.{4})"(?:\s+(\d+))?/g)].map(match => [match[1], Number(match[2] ?? 1)])), variants: getComputedStyle(el).fontVariantLigatures }));
    for (const [feature, value] of Object.entries({ tnum: 1, zero: 1, calt: 0, rlig: 1, hlig: 0 })) assert.equal(css.features[feature], value, level + ": " + feature);
    assert.ok(css.variants === "none" || css.variants.includes("no-contextual"));
    assert.equal(await page.locator("#code").evaluate(el => getComputedStyle(el).fontFeatureSettings), '"calt" 0, "rlig", "tnum", "zero"');
  }
  await page.evaluate(() => __change({ ligatureLevel: "native" }));
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-ligatures"));
  assert.equal(await page.locator("#text").evaluate(el => getComputedStyle(el).fontFeatureSettings), '"calt" 0, "rlig", "tnum", "zero"');
  await page.evaluate(() => __change({ ligatureLevel: "extended", siteRules: [{ domain: "127.0.0.1", action: "off" }] }));
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("[data-sfs-ligatures]").count(), 0);
  assert.equal(await family(page, "text"), "Arial");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("站点沿用全局策略仅替换名单字体，各项覆盖仍生效", async () => {
  const page = await pageFor('<p id="text" style="font-family:Arial;text-autospace:no-autospace">中文text</p><p id="design" style="font-family:CustomFont">Design</p><code id="code" style="font-family:Arial">Code</code>', {
    ...base, autoSpacing: false, ligatureLevel: "standard",
    siteRules: [{ domain: "127.0.0.1", action: "inherit", autoSpacing: "on", ligatureLevel: "none", protectCode: "off", font: "monospace" }]
  });
  await marked(page, "text");
  await marked(page, "code");
  assert.equal(await family(page, "text"), "serif");
  assert.equal(await page.locator("#design").getAttribute("data-sfs-replaced"), null);
  assert.equal(await page.locator("#text").evaluate(el => getComputedStyle(el).getPropertyValue("text-autospace")), "normal");
  assert.ok((await page.locator("#text").evaluate(el => getComputedStyle(el).fontFeatureSettings)).includes('"liga" 0'));
  await page.evaluate(() => __change({ enabled: false }));
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("连字等级改变实际字形渲染，保持网站设置恢复原图", async t => {
  for (const [font, enabled] of [["Cambria", "standard"], ["Times New Roman", "extended"]]) {
    const page = await pageFor('<style>@font-face{font-family:LigatureTest;src:local("' + font + '")}#text{display:inline-block;font-size:72px;line-height:1.5;color:black;background:white}</style><span id="text" style="font-family:Arial;font-variant-ligatures:none">fi fl ffi ffl Th</span>', { targets: ["Arial"], replacement: "LigatureTest, serif", ligatureLevel: "none" });
    await marked(page, "text");
    const faces = await page.evaluate(async () => (await document.fonts.load('72px LigatureTest')).length);
    if (!faces) { await page.close(); t.skip("本机缺少连字渲染测试字体：" + font); return; }
    const original = await page.locator("#text").screenshot();
    await page.evaluate(level => __change({ ligatureLevel: level }), enabled);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).fontFeatureSettings.includes('"liga"'));
    const ligatures = await page.locator("#text").screenshot();
    assert.equal(original.equals(ligatures), false, font + " 应显示不同连字字形");
    await page.evaluate(() => __change({ ligatureLevel: "native" }));
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-ligatures"));
    assert.equal(original.equals(await page.locator("#text").screenshot()), true, font + " 应恢复网站原图");
    assert.deepEqual(page.__errors, []);
    await page.close();
  }
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

test("网站移除扩展样式或替换 head 后，恢复自定义 CSS 及原有顺序", async () => {
  const customCSS = '#text{font-family:monospace!important;color:rgb(0,128,0)!important}';
  const page = await pageFor('<p id="text" style="font-family:Arial">Text</p>', { ...base, customCSSOn: true, customCSS });
  await page.waitForFunction(() => !!document.getElementById("sfs-custom-style"));
  for (const replaceHead of [false, true]) {
    await page.evaluate(replaceHead => {
      if (replaceHead) document.head.replaceWith(document.createElement("head"));
      else document.getElementById("sfs-custom-style").remove();
    }, replaceHead);
    await page.waitForFunction(() => document.getElementById("sfs-custom-style")?.textContent.includes("monospace"), null, { timeout: 1000 });
    assert.equal(await family(page, "text"), "monospace");
    assert.equal(await page.locator("#text").evaluate(el => getComputedStyle(el).color), "rgb(0, 128, 0)");
    assert.equal(await page.evaluate(() => !!(document.getElementById("sfs-style").compareDocumentPosition(document.getElementById("sfs-custom-style")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
  }
  await page.evaluate(() => {
    document.getElementById("text").remove();
    document.head.replaceWith(document.createElement("head"));
  });
  await page.waitForFunction(() => !!document.getElementById("sfs-custom-style"), null, { timeout: 1000 });
  await page.evaluate(() => __change({ enabled: false }));
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("#sfs-style, #sfs-custom-style").count(), 0);
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("字体 attr() 依赖随已有属性变化更新，支持变量和后来加入的内联声明", async () => {
  const fixtures = [
    '<style>.target{font-family:attr(data-font type(<custom-ident>),Arial)}</style><p id="text" class="target" data-font="Arial">Text</p>',
    '<style>.target{--family:attr(data-font type(<custom-ident>),Arial);font-family:var(--family)}</style><p id="text" class="target" data-font="Arial">Text</p>',
    '<p id="text" data-font="Arial" style="font-family:Arial">Text</p>'
  ];
  for (const [index, fixture] of fixtures.entries()) {
    const page = await pageFor(fixture, base, false, "zh-CN", () => {
      window.__fontReads = 0;
      const original = window.getComputedStyle;
      window.getComputedStyle = (...args) => { window.__fontReads++; return original(...args); };
    });
    await marked(page, "text");
    if (index === 2) await page.evaluate(() => { document.getElementById("text").style.fontFamily = "attr(data-font type(<custom-ident>),Arial)"; });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      __fontReads = 0;
      document.getElementById("text").setAttribute("data-layout", "20");
    });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => __fontReads), 0, "无关属性仍不采样字体");
    await page.evaluate(() => document.getElementById("text").setAttribute("data-font", "CustomFont"));
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"), null, { timeout: 1000 });
    assert.equal(await family(page, "text"), "CustomFont");
    await page.evaluate(() => document.getElementById("text").setAttribute("data-font", "Arial"));
    await marked(page, "text");
    assert.equal(await family(page, "text"), "serif");
    assert.deepEqual(page.__errors, []);
    await page.close();
  }
});

test("新增内联 attr() 字体不会复用仅在选择器中出现过的属性缓存", async () => {
  const page = await pageFor('<style>.unused[data-font]{font-family:Arial}</style><p id="text" style="font-family:Arial">Text</p>', base);
  await marked(page, "text");
  await page.evaluate(() => {
    for (const [id, family] of [["added-target", "Arial"], ["added-design", "CustomFont"]]) {
      const element = document.createElement("p");
      element.id = id;
      element.textContent = "Added";
      element.dataset.font = family;
      element.style.fontFamily = "attr(data-font type(<custom-ident>),Arial)";
      document.body.appendChild(element);
    }
  });
  await marked(page, "added-target");
  await page.waitForFunction(() => getComputedStyle(document.getElementById("added-design")).fontFamily === "CustomFont", null, { timeout: 1000 });
  assert.equal(await page.locator("#added-design").getAttribute("data-sfs-replaced"), null);
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("SVG 的 attr() 保留属性名大小写，保护快照随原字体更新", async () => {
  const page = await pageFor('<style>text{font-family:attr(data-Font type(<custom-ident>),Arial)}</style><div id="parent" style="font-family:Arial">Root<svg><text id="graphic"></text></svg></div>', base);
  await marked(page, "parent");
  await page.locator("#graphic").evaluate(el => { el.setAttribute("data-Font", "Arial"); el.textContent = "Graphic"; });
  await page.waitForFunction(() => document.getElementById("graphic").hasAttribute("data-sfs-preserve"));
  assert.equal(await family(page, "graphic"), "Arial");
  await page.locator("#graphic").evaluate(el => el.setAttribute("data-Font", "CustomFont"));
  await page.waitForFunction(() => getComputedStyle(document.getElementById("graphic")).fontFamily === "CustomFont", null, { timeout: 1000 });
  assert.equal(await page.locator("#graphic").getAttribute("data-sfs-replaced"), null);
  await page.locator("#graphic").evaluate(el => el.setAttribute("data-Font", "Arial"));
  await page.waitForFunction(() => getComputedStyle(document.getElementById("graphic")).fontFamily === "Arial");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("网站同名字体未注册专用范围时，保持首选字体的名单判断", async () => {
  for (const registered of [false, true]) {
    const page = await pageFor('<p id="text" style="font-family:&quot;Shared Punctuation Font&quot;,Arial">Text</p>', base, false, "zh-CN", registered ? () => {
      document.fonts.add(new FontFace("Shared Punctuation Font", 'local("Arial")'));
    } : null);
    await page.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#text").getAttribute("data-sfs-replaced"), null);
    assert.match(await family(page, "text"), /^"Shared Punctuation Font", Arial$/);
    assert.deepEqual(page.__errors, []);
    await page.close();
  }
});

test("本站 CSS 替换全局内容，分块更新、空内容与关闭覆盖均正确应用", async () => {
  const globalCSS = "#text{color:rgb(255,0,0)!important}";
  const rule = { domain: "127.0.0.1", action: "inherit", customCSSMode: "site", customCSSOn: "on", customCSS: "#text{color:rgb(0,0,255)!important}" };
  const page = await pageFor('<p id="text" style="font-family:Arial">Text</p>', { ...base, customCSSOn: true, customCSS: globalCSS, siteRules: [rule] });
  await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).color === "rgb(0, 0, 255)");
  assert.ok(!(await page.locator("#sfs-custom-style").textContent()).includes("255,0,0"));
  await page.evaluate(({ rule, globalCSS }) => SFS.writeSettings(chrome.storage.sync, { siteRules: [{ ...rule, customCSS: "#text{color:rgb(0,128,0)!important}" }] }, globalCSS, "local"), { rule, globalCSS });
  await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).color === "rgb(0, 128, 0)");
  await page.evaluate(() => __change({ "siteCSS#local-0/0": "#text{color:rgb(128,0,128)!important}" }));
  await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).color === "rgb(128, 0, 128)");
  await page.evaluate(rule => __change({ siteRules: [{ ...rule, customCSSMode: "global" }] }), rule);
  await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).color === "rgb(255, 0, 0)");
  await page.evaluate(rule => __change({ siteRules: [{ ...rule, customCSS: "" }] }), rule);
  await page.waitForFunction(() => !document.getElementById("sfs-custom-style"));
  assert.equal(await family(page, "text"), "serif");
  await page.evaluate(rule => __change({ siteRules: [{ ...rule, action: "off" }] }), rule);
  await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
  assert.equal(await page.locator("#sfs-custom-style").count(), 0);
  assert.equal(await family(page, "text"), "Arial");
  assert.deepEqual(page.__errors, []);
  await page.close();
  const other = await pageFor('<p id="text" style="font-family:Arial">Text</p>', { ...base, customCSSOn: true, customCSS: globalCSS, siteRules: [{ ...rule, domain: "example.com" }] });
  await other.waitForFunction(() => getComputedStyle(document.getElementById("text")).color === "rgb(255, 0, 0)");
  await other.close();
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

test("批量站点规则加载保持配置，编辑和保存复用字段且避免逐条查询整份列表", async () => {
  const siteRules = Array.from({ length: 240 }, (_, i) => ({ domain: "site" + i + ".example.com", action: "inherit", font: i % 2 ? "serif" : "" }));
  const options = await pageFor("", { replacement: "serif", siteRules }, true, "zh-CN", () => {
    window.__rowQueries = 0;
    const query = Element.prototype.querySelectorAll;
    Element.prototype.querySelectorAll = function (selector) {
      if (this.id === "siteRules" && selector === ".site-rule-row") __rowQueries++;
      return query.call(this, selector);
    };
  });
  await options.waitForFunction(() => !document.getElementById("save").disabled);
  assert.equal(await options.locator(".site-rule-row").count(), 240);
  assert.ok(await options.evaluate(() => __rowQueries) < 10, "批量加载应避免随条目数增长的整份列表查询");
  await options.locator(".rule-domain").first().fill("changed.example.com");
  await options.locator(".rule-secondary summary").last().click();
  await options.locator(".rule-font").last().fill("monospace");
  await options.locator("#save").click();
  await options.waitForFunction(() => document.getElementById("status").classList.contains("success"));
  const saved = await options.evaluate(() => SFS.normalizeSettings(__store).siteRules);
  assert.equal(saved.length, 240);
  assert.equal(saved[0].domain, "changed.example.com");
  assert.equal(saved[239].font, "monospace");
  assert.equal(saved[17].domain, "site17.example.com");
  await options.close();
});

test("屏外站点规则可聚焦和操作菜单，CSS 子界面返回后保持滚动位置", async () => {
  const siteRules = Array.from({ length: 120 }, (_, i) => ({ domain: "site" + i + ".example.com", action: "inherit" }));
  const page = await pageFor("", { siteRules }, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  const row = page.locator(".site-rule-row").last();
  await row.locator(".rule-domain").focus();
  await row.locator(".rule-domain").fill("last.example.com");
  const action = row.locator(".rule-action");
  await action.click();
  await action.press("ArrowDown");
  await action.press("Enter");
  assert.equal(await action.evaluate(el => el.value), "force");
  assert.ok(await page.evaluate(() => scrollY) > 5000, "应实际操作此前位于屏外的最后一条规则");
  await row.locator(".rule-edit-css").click();
  const before = await page.evaluate(() => rulesScrollPosition);
  await page.locator("#useSiteCSS").click();
  await page.locator("#siteCSSContent").fill("body { color: red; }");
  await page.locator("#backToRules").click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const after = await page.evaluate(() => scrollY);
  assert.ok(Math.abs(after - before) < 30, "滚动位置：" + before + " → " + after);
  assert.equal(await row.locator(".rule-domain").inputValue(), "last.example.com");
  await row.locator(".rule-edit-css").click();
  assert.equal(await page.locator("#siteCSSContent").inputValue(), "body { color: red; }");
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

test("站点条目三个主设置常驻，继承提示更新，旁观保留配置", async () => {
  const page = await pageFor("", { siteRules: [{ domain: "example.com", action: "inherit", autoSpacing: "on", ligatureLevel: "extended" }] }, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  assert.equal(await page.locator(".site-rule-primary .rule-override").count(), 3);
  assert.equal(await page.locator(".rule-secondary").evaluate(el => el.open), false);
  assert.equal(await page.locator("button button").count(), 0);
  await selectChoice(page, page.locator("#ligatureLevel"), "none");
  await page.locator('[data-key="ligatureLevel"]').click();
  assert.ok((await page.locator('.select-option[data-value=""]').textContent()).includes("关闭可选连字"));
  await page.keyboard.press("Escape");
  await selectChoice(page, page.locator(".rule-action"), "off");
  assert.equal(await page.locator('.rule-override[data-key="autoSpacing"]').isEnabled(), false);
  assert.equal(await page.locator(".site-rule-row .rule-state-note").isVisible(), true);
  await selectChoice(page, page.locator(".rule-action"), "inherit");
  assert.equal(await page.locator('.rule-override[data-key="autoSpacing"]').evaluate(el => el.value), "on");
  assert.equal(await page.locator('.rule-override[data-key="ligatureLevel"]').evaluate(el => el.value), "extended");
  await page.locator("#save").click();
  await page.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("success"));
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  assert.equal(await page.evaluate(() => __store.siteRules[0].action), "inherit");
  assert.equal(await page.evaluate(() => __store.ligatureLevel), "none");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("自绘下拉框支持键盘选择和取消，窄屏浮层保持在视口内", async () => {
  const page = await pageFor("", { siteRules: [{ domain: "example.com", action: "inherit" }] }, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  assert.equal(await page.locator("select").count(), 0);
  await page.locator("#ligatureLevel").press("ArrowDown");
  assert.equal(await page.locator("#ligatureLevel").getAttribute("aria-expanded"), "true");
  await page.locator("#ligatureLevel").press("End");
  await page.locator("#ligatureLevel").press("Enter");
  assert.equal(await page.locator("#ligatureLevel").evaluate(el => el.value), "extended");
  await page.locator("#ligatureLevel").press("ArrowUp");
  await page.locator("#ligatureLevel").press("Home");
  await page.locator("#ligatureLevel").press("Escape");
  assert.equal(await page.locator("#ligatureLevel").evaluate(el => el.value), "extended");
  assert.equal(await page.locator("#ligatureLevel").evaluate(el => document.activeElement === el), true);
  for (const width of [360, 480, 720, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator('[data-key="ligatureLevel"]').click();
    assert.ok(await page.locator("#sfs-select-menu").evaluate(el => {
      const rect = el.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
    }));
    await page.keyboard.press("Escape");
  }
  await page.locator(".rule-action").click();
  await page.locator(".rule-domain").click();
  assert.equal(await page.locator("#sfs-select-menu").isVisible(), false);
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("本站 CSS 子界面保留草稿，保存大段 CSS，删除撤销与失败不丢失内容", async () => {
  const page = await pageFor("", { customCSS: "/* global */", siteRules: [{ domain: "example.com", action: "inherit", customCSSOn: "on" }] }, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  await page.locator(".rule-edit-css").click();
  assert.equal(await page.locator("#siteCSSView").isVisible(), true);
  assert.equal(await page.locator("#settingsView").isVisible(), false);
  assert.equal(await page.locator("#siteCSSContent").inputValue(), "/* global */");
  assert.equal(await page.locator("#siteCSSContent").evaluate(el => el.readOnly), true);
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  await page.locator("#copyGlobalCSS").click();
  assert.equal(await page.locator("#siteCSSContent").inputValue(), "/* global */");
  const css = "/*本站 CSS 中文*/".repeat(900);
  await page.locator("#siteCSSContent").fill(css);
  await page.locator("#useGlobalCSS").click();
  await page.locator("#useSiteCSS").click();
  assert.equal(await page.locator("#siteCSSContent").inputValue(), css);
  await page.locator("#save").click();
  await page.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("success"));
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  assert.equal(await page.evaluate(() => "customCSS" in __store.siteRules[0]), false);
  assert.equal(await page.evaluate(() => SFS.normalizeSettings(__store).siteRules[0].customCSS), css);
  await page.locator("#backToRules").click();
  await page.locator(".rule-delete").click();
  await page.locator("#undoSiteRule").click();
  await page.locator(".rule-edit-css").click();
  assert.equal(await page.locator("#siteCSSContent").inputValue(), css);
  await page.evaluate(() => { __failSet = true; });
  await page.locator("#siteCSSContent").fill("/* changed */");
  await page.locator("#save").click();
  await page.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("error"));
  assert.equal(await page.evaluate(() => SFS.normalizeSettings(__store).siteRules[0].customCSS), css);
  assert.equal(await page.locator("#siteCSSContent").inputValue(), "/* changed */");
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("本站 CSS 草稿缺少域名时，保存会返回并定位规则错误", async () => {
  const page = await pageFor("", {}, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  await page.locator("#addSiteRule").click();
  assert.equal(await page.locator(".rule-domain").getAttribute("placeholder"), "example.com");
  await page.locator(".rule-edit-css").click();
  await page.locator("#useSiteCSS").click();
  await page.locator("#siteCSSContent").fill("body{color:red}");
  await page.locator("#save").click();
  assert.equal(await page.evaluate(() => __writes), 0);
  assert.equal(await page.locator("#settingsView").isVisible(), true);
  assert.equal(await page.locator(".domain-error").isVisible(), true);
  assert.equal(await page.locator(".rule-domain").evaluate(el => document.activeElement === el), true);
  await page.close();
});

test("删除撤销恢复原位置和完整设置，展开和恢复原值不计为修改", async () => {
  const rules = [{ domain: "first.example", action: "force", font: "serif", protectCode: "off", ligatureLevel: "extended" }, { domain: "second.example", action: "off" }];
  const page = await pageFor("", { siteRules: rules }, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  await page.locator(".rule-secondary summary").first().click();
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  await selectChoice(page, page.locator(".rule-action").first(), "inherit");
  assert.equal(await page.locator("#unsavedHint").isVisible(), true);
  await selectChoice(page, page.locator(".rule-action").first(), "force");
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  await page.locator(".rule-delete").first().click();
  assert.equal(await page.locator(".site-rule-row").count(), 1);
  assert.equal(await page.locator(".rule-domain").evaluate(el => document.activeElement === el), true);
  await page.locator("#undoSiteRule").click();
  assert.equal(await page.locator(".rule-domain").first().inputValue(), "first.example");
  assert.equal(await page.locator(".rule-font").first().inputValue(), "serif");
  assert.equal(await page.locator('[data-key="protectCode"]').first().evaluate(el => el.value), "off");
  assert.equal(await page.locator('[data-key="ligatureLevel"]').first().evaluate(el => el.value), "extended");
  assert.equal(await page.locator(".rule-secondary").first().evaluate(el => el.open), true);
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  assert.deepEqual(page.__errors, []);
  await page.close();
});

test("无域名草稿不能静默丢弃，字体错误显示在对应字段", async () => {
  const page = await pageFor("", {}, true);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  await page.locator("#addSiteRule").click();
  assert.equal(await page.locator(".rule-domain").evaluate(el => document.activeElement === el), true);
  await selectChoice(page, page.locator('[data-key="autoSpacing"]'), "on");
  await page.locator("#save").click();
  assert.equal(await page.evaluate(() => __writes), 0);
  assert.equal(await page.locator(".domain-error").isVisible(), true);
  assert.equal(await page.locator(".rule-domain").getAttribute("aria-invalid"), "true");
  await page.locator(".rule-domain").fill("example.com");
  assert.equal(await page.locator(".domain-error").isVisible(), false);
  await page.locator(".rule-secondary summary").click();
  await page.locator(".rule-font").fill("serif;");
  await page.locator("#save").click();
  assert.equal(await page.locator(".font-error").isVisible(), true);
  assert.equal(await page.evaluate(() => __writes), 0);
  await page.locator(".rule-font").fill("serif");
  await page.locator("#save").click();
  await page.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("success"));
  assert.equal(await page.locator("#unsavedHint").isVisible(), false);
  assert.deepEqual(page.__errors, []);
  await page.close();
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
  for (const language of ["zh-CN", "en"]) {
  const page = await pageFor("", { siteRules: [{ domain: "example.com", action: "force", protectCode: "off", ligatureLevel: "extended" }, { domain: "native.example.com", action: "off" }] }, true, language);
  await page.waitForFunction(() => !document.getElementById("save").disabled);
  for (const width of [360, 480, 720, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "width=" + width);
    assert.ok(await page.locator(".site-rule-row").evaluateAll(rows => rows.every(row => {
      const bounds = row.getBoundingClientRect();
      return [...row.querySelectorAll("input, .sfs-select, .rule-delete")].filter(el => el.getBoundingClientRect().width).every(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right;
      });
    })), language + " fields width=" + width);
    assert.equal(await page.locator(".rule-delete svg").first().evaluate(el => el.getBoundingClientRect().width), 16);
  }
  await page.locator(".rule-edit-css").first().click();
  for (const width of [360, 480, 720, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), language + " CSS editor width=" + width);
    assert.ok(await page.locator("#siteCSSView").evaluate(view => {
      const bounds = view.getBoundingClientRect();
      return [...view.querySelectorAll("button, textarea")].every(el => {
        const rect = el.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right;
      });
    }), language + " CSS editor controls width=" + width);
  }
  await page.close();
  }
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
    const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), manifest.version);
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

test("真实 MV3 在严格 CSP 中跟踪字体属性并恢复被页面移除的自定义 CSS", async () => {
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(base => chrome.storage.sync.set(base), base);
    fixtures.set("/strict-attributes", {
      csp: "default-src 'self'; script-src 'self'; style-src 'self'",
      html: '<!doctype html><html><head><link rel="stylesheet" href="/attribute-font.css"></head><body><p id="text" data-font="Arial">Text</p></body></html>'
    });
    const page = await context.newPage();
    await page.goto(origin + "/strict-attributes");
    await marked(page, "text");
    assert.equal(await family(page, "text"), "serif");
    await page.locator("#text").evaluate(el => el.setAttribute("data-font", "CustomFont"));
    await marked(page, "text", false);
    assert.equal(await family(page, "text"), "CustomFont");
    await page.locator("#text").evaluate(el => el.setAttribute("data-font", "Arial"));
    await marked(page, "text");
    const customCSS = '#text{font-family:monospace!important}';
    await worker.evaluate(customCSS => chrome.storage.sync.set({ customCSSOn: true, customCSS }), customCSS);
    await page.waitForFunction(() => !!document.getElementById("sfs-custom-style"));
    await page.evaluate(() => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/attribute-font.css";
      const head = document.createElement("head");
      head.appendChild(link);
      document.head.replaceWith(head);
    });
    await page.waitForFunction(() => document.getElementById("sfs-custom-style")?.textContent.includes("monospace"));
    assert.equal(await family(page, "text"), "monospace");
    await worker.evaluate(() => chrome.storage.sync.set({ enabled: false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
    assert.equal(await family(page, "text"), "Arial");
  } finally {
    await context.close();
  }
});

const punctuationRoot = process.env.SFS_PUNCTUATION_EXTENSION_ROOT || path.join(path.dirname(root), "共用标点字体替换浏览器扩展");

test("真实 MV3 在 document.open 重写页面后继续替换、保护及跟踪输入方向", async () => {
  const context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.sync.set({ enabled: true, targets: ["Arial"], replacement: "serif", customCSSOn: false, ligatureLevel: "native" }));
    fixtures.set("/rewritten-document", '<!doctype html><p id="text" style="font-family:Arial">Before</p>');
    const page = await context.newPage();
    await page.goto(origin + "/rewritten-document");
    await marked(page, "text");
    await page.evaluate(() => {
      document.open();
      document.write('<!doctype html><style>.target{font-family:Arial}.design{font-family:CustomFont}textarea:dir(ltr){font-family:Arial}textarea:dir(rtl){font-family:CustomFont}</style><p id="text" class="target">After</p><code id="code" class="target">Code</code><textarea id="edit" dir="auto">abc</textarea>');
      document.close();
    });
    await page.waitForFunction(() => document.getElementById("text")?.hasAttribute("data-sfs-replaced"), null, { timeout: 1500 });
    assert.equal(await family(page, "text"), "serif");
    assert.equal(await page.locator("#code").getAttribute("data-sfs-replaced"), null);
    assert.equal(await family(page, "code"), "Arial");
    await marked(page, "edit");
    await page.locator("#edit").evaluate(el => { el.value = "مرحبا"; el.dispatchEvent(new InputEvent("input", { bubbles: true })); });
    await page.waitForFunction(() => !document.getElementById("edit").hasAttribute("data-sfs-replaced"), null, { timeout: 1500 });
    assert.equal(await family(page, "edit"), "CustomFont");
    await page.locator("#edit").evaluate(el => { el.value = "abc"; el.dispatchEvent(new InputEvent("input", { bubbles: true })); });
    await marked(page, "edit");
    await worker.evaluate(() => chrome.storage.sync.set({ enabled: false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
    assert.equal(await family(page, "text"), "Arial");
    await page.evaluate(() => {
      const html = document.createElement("html");
      html.innerHTML = '<head></head><body><p id="text" style="font-family:Arial">Replaced root</p></body>';
      document.documentElement.replaceWith(html);
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator("#sfs-style, #sfs-custom-style, [data-sfs-replaced]").count(), 0);
    await worker.evaluate(() => chrome.storage.sync.set({ enabled: true }));
    await marked(page, "text");
    assert.equal(await family(page, "text"), "serif");
  } finally { await context.close(); }
});

test("真实 MV3 的跨域转义 import 保留导入字体判断及动态变化", async () => {
  let reads = 0;
  const remote = http.createServer((request, response) => {
    response.setHeader("Content-Type", "text/css");
    if (request.url === "/parent.css") {
      reads++;
      response.end('@\\69mport "./imported.css";');
    } else response.end('.target{font-family:Arial}.design{font-family:CustomFont}');
  });
  await new Promise(resolve => remote.listen(0, "127.0.0.1", resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
      args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.sync.set({ targets: ["Arial"], replacement: "serif", customCSSOn: false }));
    fixtures.set("/escaped-import", '<!doctype html><html><head><link rel="stylesheet" href="http://127.0.0.1:' + remote.address().port + '/parent.css"></head><body><p id="text" class="target">Text</p><p id="design" class="design">Design</p></body></html>');
    const page = await context.newPage();
    await page.goto(origin + "/escaped-import");
    await marked(page, "text");
    await page.waitForFunction(() => document.getElementById("design").hasAttribute("data-sfs-preserve") === false);
    await page.waitForTimeout(250);
    assert.ok(reads >= 2, "已完成后台跨域读取");
    assert.equal(await page.locator("#design").getAttribute("data-sfs-replaced"), null);
    assert.equal(await family(page, "design"), "CustomFont");
    await page.locator("#text").evaluate(el => el.className = "design");
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"), null, { timeout: 1000 });
    assert.equal(await family(page, "text"), "CustomFont");
    await page.locator("#text").evaluate(el => el.className = "target");
    await marked(page, "text");
  } finally {
    await context?.close();
    await new Promise(resolve => remote.close(resolve));
  }
});

test("真实 MV3 的跨域 CSS 按 charset 声明及页面编码读取中文字体变量", async () => {
  let reads = 0;
  const bytes = Buffer.concat([Buffer.from('@charset "gbk";:root{--'), Buffer.from("d7d6cce5", "hex"),
    Buffer.from(':Arial}.target{font-family:var(--'), Buffer.from("d7d6cce5", "hex"), Buffer.from(')}')]);
  const remote = http.createServer((request, response) => {
    if (request.url === "/legacy") {
      response.setHeader("Content-Type", "text/html; charset=gbk");
      response.end('<!doctype html><link rel="stylesheet" href="http://localhost:' + remote.address().port + '/bare.css"><p id="text" class="target">Text</p>');
    } else {
      reads++;
      response.setHeader("Content-Type", "text/css");
      response.end(request.url === "/bare.css" ? bytes.subarray(Buffer.byteLength('@charset "gbk";')) : bytes);
    }
  });
  await new Promise(resolve => remote.listen(0, "127.0.0.1", resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
      args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.sync.set({ targets: ["Arial"], replacement: "serif", customCSSOn: false }));
    fixtures.set("/charset-variable", '<!doctype html><html><head><link rel="stylesheet" href="http://127.0.0.1:' + remote.address().port + '/font.css"></head><body><p id="text" class="target">Text</p></body></html>');
    const page = await context.newPage();
    await page.goto(origin + "/charset-variable");
    await marked(page, "text");
    await page.waitForTimeout(250);
    assert.ok(reads >= 2, "已完成后台跨域读取");
    await page.evaluate(() => document.documentElement.style.setProperty("--字体", "CustomFont"));
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"), null, { timeout: 1500 });
    assert.equal(await family(page, "text"), "CustomFont");
    await page.evaluate(() => document.documentElement.style.setProperty("--字体", "Arial"));
    await marked(page, "text");
    await page.goto("http://127.0.0.1:" + remote.address().port + "/legacy");
    assert.equal(await page.evaluate(() => document.characterSet), "GBK");
    await marked(page, "text");
    await page.waitForTimeout(250);
    assert.ok(reads >= 4, "页面编码场景已完成后台跨域读取");
    await page.evaluate(() => document.documentElement.style.setProperty("--字体", "CustomFont"));
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"), null, { timeout: 1500 });
    assert.equal(await family(page, "text"), "CustomFont");
    await page.evaluate(() => document.documentElement.style.setProperty("--字体", "Arial"));
    await marked(page, "text");
  } finally {
    await context?.close();
    await new Promise(resolve => remote.close(resolve));
  }
});

test("真实 MV3 的特殊子框架继承父站与显式端口规则，跨站框架按自身地址匹配", async () => {
  const context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const port = new URL(origin).port;
    await worker.evaluate(port => chrome.storage.sync.set({ enabled: true, targets: ["Arial"], replacement: "serif", customCSSOn: false,
      siteRules: [{ domain: "127.0.0.1:" + port, action: "force" }, { domain: "localhost:" + port, action: "off" }] }), port);
    fixtures.set("/special-frames", '<!doctype html><p id="parent" style="font-family:CustomFont">Parent</p>');
    fixtures.set("/ordinary-frame", '<!doctype html><p id="text" style="font-family:Arial">Ordinary</p>');
    const page = await context.newPage();
    await page.goto(origin + "/special-frames");
    await marked(page, "parent");
    await page.evaluate(async url => {
      const html = '<!doctype html><p id="text" style="font-family:CustomFont">Special</p>';
      for (const type of ["srcdoc", "blank", "blob", "data", "ordinary"]) {
        const frame = document.createElement("iframe");
        frame.name = type;
        if (type === "srcdoc") frame.srcdoc = html;
        else if (type === "blob") frame.src = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        else if (type === "data") frame.src = "data:text/html," + encodeURIComponent(html);
        else if (type === "ordinary") frame.src = url;
        const loaded = new Promise(resolve => frame.onload = resolve);
        document.body.appendChild(frame);
        if (type === "blank") {
          frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close();
        }
        await loaded;
      }
    }, origin.replace("127.0.0.1", "localhost") + "/ordinary-frame");
    const frames = page.frames().filter(frame => frame !== page.mainFrame());
    assert.equal(frames.length, 5);
    for (const frame of frames.filter(frame => frame.name() !== "ordinary")) {
      await frame.waitForFunction(() => document.getElementById("text")?.hasAttribute("data-sfs-replaced"), null, { timeout: 1500 });
      assert.equal(await frame.locator("#text").evaluate(el => getComputedStyle(el).fontFamily), "serif", frame.name());
    }
    const ordinary = frames.find(frame => frame.name() === "ordinary");
    assert.equal(await ordinary.locator("#text").getAttribute("data-sfs-replaced"), null);
    assert.equal(await ordinary.locator("#text").evaluate(el => getComputedStyle(el).fontFamily), "Arial");
    await ordinary.evaluate(async () => {
      const frame = document.createElement("iframe");
      frame.name = "nested-srcdoc";
      frame.referrerPolicy = "no-referrer";
      frame.srcdoc = '<!doctype html><p id="text" style="font-family:CustomFont">Nested</p>';
      const loaded = new Promise(resolve => frame.onload = resolve);
      document.body.appendChild(frame);
      await loaded;
    });
    const nested = page.frames().find(frame => frame.name() === "nested-srcdoc");
    assert.ok(nested);
    await nested.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
    assert.equal(await nested.locator("#text").evaluate(el => getComputedStyle(el).fontFamily), "CustomFont");
    assert.equal(await nested.evaluate(() => document.referrer), "");
    await worker.evaluate(port => chrome.storage.sync.set({ siteRules: [{ domain: "127.0.0.1:" + port, action: "off" }] }), port);
    for (const frame of frames.filter(frame => frame.name() !== "ordinary")) {
      await frame.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
      assert.equal(await frame.locator("#text").evaluate(el => getComputedStyle(el).fontFamily), "CustomFont");
    }
    await ordinary.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
    assert.equal(await ordinary.locator("#text").evaluate(el => getComputedStyle(el).fontFamily), "serif");
    await nested.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
    assert.equal(await nested.locator("#text").getAttribute("data-sfs-replaced"), null);
    await worker.evaluate(port => chrome.storage.sync.set({ siteRules: [{ domain: "127.0.0.1:" + (Number(port) + 1), action: "force" }] }), port);
    for (const frame of frames.filter(frame => frame.name() !== "ordinary")) {
      await frame.waitForFunction(() => document.documentElement.hasAttribute("data-sfs"));
      assert.equal(await frame.locator("#text").getAttribute("data-sfs-replaced"), null, frame.name());
    }
  } finally { await context.close(); }
});

test("主字体与共用标点真实 MV3 联合加载，分别关闭及恢复保持正文和标点字体", {
  skip: !fs.existsSync(path.join(punctuationRoot, "main-runtime.js"))
}, async () => {
  const extensions = root + "," + punctuationRoot;
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + extensions, "--load-extension=" + extensions]
  });
  try {
    const workerFor = async id => context.serviceWorkers().find(worker => new URL(worker.url()).host === id)
      || await context.waitForEvent("serviceworker", { predicate: worker => new URL(worker.url()).host === id });
    const mainWorker = await workerFor("ecgcpjehkelnjfcgldmifejcoefohdcp");
    const punctuationWorker = await workerFor("leodnciablfoggcacioldiippnfdonmg");
    await mainWorker.evaluate(() => chrome.storage.sync.set({ enabled: true, replacement: '"Times New Roman"', targets: ["Arial"], protectCode: true, protectIcons: true, ligatureLevel: "native", customCSSOn: false, autoSpacing: false, siteRules: [] }));
    await punctuationWorker.evaluate(() => chrome.storage.local.set({ settings: { enabled: true, font: "Courier New", groups: ["quotes", "ellipsis"], cjkMode: "off", siteRules: [] } }));
    fixtures.set("/joint-fonts", '<!doctype html><html><head><style>body{font:24px Arial}#text{font-family:Arial}#design{font-family:CustomFont}#code{font-family:Arial}</style></head><body><p id="text">AB“…”中文English2026</p><p id="design">Design</p><code id="code">Code“…”</code></body></html>');
    const page = await context.newPage();
    await page.goto(origin + "/joint-fonts");
    const hasPunctuation = () => [...document.fonts].some(face => face.family.includes("Shared Punctuation Font"));
    await page.waitForFunction(hasPunctuation);
    await marked(page, "text");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).fontFamily === '"Shared Punctuation Font", "Times New Roman"');
    assert.equal(await page.locator("#design").getAttribute("data-sfs-replaced"), null);
    assert.equal(await page.locator("#code").getAttribute("data-sfs-replaced"), null);
    assert.equal(await family(page, "code"), '"Shared Punctuation Font", Arial');

    const cdp = await context.newCDPSession(page);
    await cdp.send("DOM.enable");
    await cdp.send("CSS.enable");
    await page.evaluate(() => document.fonts.ready);
    const { root: documentRoot } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: documentRoot.nodeId, selector: "#text" });
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    assert.ok(fonts.some(font => font.familyName === "Times New Roman" && font.glyphCount > 0));
    assert.ok(fonts.some(font => font.familyName === "Courier New" && font.glyphCount > 0));
    await cdp.detach();

    await mainWorker.evaluate(() => chrome.storage.sync.set({ enabled: false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
    assert.equal(await family(page, "text"), '"Shared Punctuation Font", Arial');
    assert.equal(await page.evaluate(hasPunctuation), true);
    await mainWorker.evaluate(() => chrome.storage.sync.set({ enabled: true }));
    await marked(page, "text");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).fontFamily.includes("Times New Roman"));

    const setPunctuation = enabled => punctuationWorker.evaluate(async enabled => {
      const { settings } = await chrome.storage.local.get("settings");
      await chrome.storage.local.set({ settings: { ...settings, enabled } });
    }, enabled);
    await setPunctuation(false);
    await page.waitForFunction(() => ![...document.fonts].some(face => face.family.includes("Shared Punctuation Font")));
    await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).fontFamily === '"Times New Roman"');
    assert.equal(await page.locator("#text").getAttribute("data-sfs-replaced"), "1");
    await page.waitForFunction(() => getComputedStyle(document.getElementById("code")).fontFamily === "Arial");
    await setPunctuation(true);
    await page.waitForFunction(hasPunctuation);
    await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).fontFamily === '"Shared Punctuation Font", "Times New Roman"');
    assert.equal(await page.locator("#text").getAttribute("data-sfs-replaced"), "1");
    await setPunctuation(false);
    await mainWorker.evaluate(() => chrome.storage.sync.set({ enabled: false }));
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-sfs"));
    await page.waitForFunction(() => getComputedStyle(document.getElementById("text")).fontFamily === "Arial");
    assert.equal(await page.locator("#design").getAttribute("data-sfs-replaced"), null);
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
