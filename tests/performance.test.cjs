const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
let browser, server, origin;
const fixtures = new Map();
before(async () => {
  server = http.createServer((request, response) => {
    const name = request.url.slice(1);
    response.setHeader("Content-Type", name.endsWith(".js") ? "text/javascript" : name.endsWith(".css") ? "text/css" : "text/html; charset=utf-8");
    if (["shared.js", "content.js"].includes(name)) response.end(fs.readFileSync(path.join(root, name)));
    else response.end(fixtures.get(request.url) || "");
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function pageFor(html, settings = {}) {
  const page = await browser.newPage();
  await page.addInitScript(settings => {
    window.__styleReads = 0;
    window.__sheetDisables = 0;
    const original = window.getComputedStyle;
    window.getComputedStyle = function (...args) {
      window.__styleReads++;
      return Reflect.apply(original, this, args);
    };
    const disabled = Object.getOwnPropertyDescriptor(StyleSheet.prototype, "disabled");
    Object.defineProperty(StyleSheet.prototype, "disabled", {
      ...disabled,
      set(value) {
        if (value && ["sfs-style", "sfs-custom-style"].includes(this.ownerNode?.id)) window.__sheetDisables++;
        disabled.set.call(this, value);
      }
    });
    window.__settings = { targets: ["Arial"], replacement: "serif", ligatureLevel: "standard", customCSSOn: true,
      customCSS: '[data-sfs-replaced="1"] { font-family: serif !important; }', ...settings };
    window.chrome = { storage: {
      sync: { get: async () => window.__settings },
      onChanged: { addListener(callback) { window.__storageChanged = callback; } }
    } };
  }, settings);
  const route = "/case-" + fixtures.size;
  fixtures.set(route, '<!doctype html><html><head><style>.target { font-family: Arial; } .design { font-family: CustomFont; }</style></head><body>' + html + '<script src="/shared.js"></script><script src="/content.js"></script></body></html>');
  await page.goto(origin + route);
  await page.waitForFunction(customCSSOn => customCSSOn ? !!document.getElementById("sfs-custom-style") : !!document.getElementById("sfs-style"), settings.customCSSOn !== false);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => { __styleReads = __sheetDisables = 0; });
  return page;
}

test("流式回答的稳态文字更新不重复停用样式和采样，字体变更仍重新检查", async t => {
  const history = Array.from({ length: 2500 }, (_, i) => '<p class="target">History ' + i + '</p>').join("");
  const page = await pageFor(history + '<p id="stream" class="target">Answer</p>');
  await page.waitForFunction(() => document.getElementById("stream").hasAttribute("data-sfs-replaced"));
  const metrics = await page.evaluate(async () => {
    __styleReads = __sheetDisables = 0;
    const parent = document.getElementById("stream");
    const started = performance.now();
    for (let i = 0; i < 40; i++) {
      if (i < 20) parent.firstChild.data += " token";
      else parent.textContent += " token";
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    return { styleReads: __styleReads, sheetDisables: __sheetDisables, elapsedMs: Math.round(performance.now() - started) };
  });
  t.diagnostic(JSON.stringify(metrics));
  assert.equal(metrics.styleReads, 0);
  assert.equal(metrics.sheetDisables, 0);
  await page.evaluate(() => { document.getElementById("stream").className = "design"; });
  await page.waitForFunction(() => !document.getElementById("stream").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("同一帧的独立分支变更合并采样，重复属性赋值不引发扫描", async t => {
  const branches = Array.from({ length: 64 }, (_, i) => '<p id="branch-' + i + '" class="design" style="font-feature-settings: &quot;ss01&quot; ' + i + '">Branch</p>').join("");
  const page = await pageFor('<p class="target">Start</p>' + branches);
  await page.evaluate(() => {
    __styleReads = __sheetDisables = 0;
    for (let i = 0; i < 64; i++) document.getElementById("branch-" + i).className = "target";
  });
  await page.waitForFunction(() => document.querySelectorAll('[id^="branch-"][data-sfs-replaced]').length === 64);
  const metrics = await page.evaluate(() => ({ styleReads: __styleReads, sheetDisables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.equal(metrics.styleReads, 64);
  assert.equal(metrics.sheetDisables, 2);
  await page.evaluate(async () => {
    __styleReads = __sheetDisables = 0;
    for (let i = 0; i < 64; i++) document.getElementById("branch-" + i).setAttribute("class", "target");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  assert.equal(await page.evaluate(() => __styleReads), 0);
  const markerWrites = await page.evaluate(async () => {
    let writes = 0;
    const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(document.body, { subtree: true, attributes: true,
      attributeFilter: ["data-sfs-replaced", "data-sfs-ligatures", "data-sfs-preserve"] });
    for (let i = 0; i < 64; i++) document.getElementById("branch-" + i).className = "target selected";
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    observer.disconnect();
    return writes;
  });
  assert.equal(markerWrites, 0);
  await page.close();
});

test("长页面悬停、输入框高度及布局变量变化不触发字体采样", async t => {
  const history = Array.from({ length: 2500 }, (_, i) => '<p class="target">History ' + i + '</p>').join("");
  const page = await pageFor('<style>@container (width > 100px) { .layout { width: 90%; font-size: 18px; } }</style><div id="shell">' + history + '<button id="title" class="target">Conversation</button><textarea id="editor" class="target"></textarea></div>');
  await page.evaluate(() => {
    const title = document.getElementById("title");
    title.addEventListener("mouseenter", () => { title.className = "target hovered"; });
    title.addEventListener("mouseleave", () => { title.className = "target"; });
    document.getElementById("editor").addEventListener("input", event => {
      event.target.style.height = (40 + event.target.value.length) + "px";
      document.getElementById("shell").className = "layout typing";
      document.documentElement.style.setProperty("--popover-available-height", event.target.value.length + "px");
    });
    __styleReads = __sheetDisables = 0;
  });
  for (let i = 0; i < 10; i++) {
    await page.locator("#title").hover();
    await page.locator("#editor").pressSequentially("abc");
  }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const metrics = await page.evaluate(() => ({ styleReads: __styleReads, sheetDisables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.deepEqual(metrics, { styleReads: 0, sheetDisables: 0 });
  await page.close();
});

test("相同字体来源的反复弹层新增节点复用采样，不停用全页 CSS", async t => {
  const page = await pageFor('<div class="target">Initial menu</div>');
  const metrics = await page.evaluate(async () => {
    __styleReads = __sheetDisables = 0;
    for (let i = 0; i < 30; i++) {
      const menu = document.createElement("div");
      menu.className = "target popup";
      menu.textContent = "Menu " + i;
      menu.style.left = i + "px";
      document.body.appendChild(menu);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (!menu.hasAttribute("data-sfs-replaced")) throw Error("新增菜单未替换");
      menu.remove();
    }
    return { styleReads: __styleReads, sheetDisables: __sheetDisables };
  });
  t.diagnostic(JSON.stringify(metrics));
  assert.deepEqual(metrics, { styleReads: 0, sheetDisables: 0 });
  await page.close();
});

test("新增节点复用祖先匹配结果，重挂节点仍判断继承字体", async t => {
  const page = await pageFor('<div id="target" class="target"><span id="moved">Moved</span></div><div id="design" class="design"><span>Primer</span></div>');
  const matches = await page.evaluate(async () => {
    const original = Element.prototype.matches;
    let matches = 0;
    Element.prototype.matches = function(selector) {
      if ([".target", ".design"].includes(selector)) matches++;
      return original.call(this, selector);
    };
    try {
      for (let i = 0; i < 30; i++) {
        const menu = document.createElement("div");
        menu.className = "target";
        menu.textContent = "Menu";
        document.body.appendChild(menu);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!menu.hasAttribute("data-sfs-replaced")) throw Error("新增菜单未替换");
      }
      return matches;
    } finally { Element.prototype.matches = original; }
  });
  t.diagnostic(JSON.stringify({ newNodes: 30, fontSelectorMatches: matches }));
  assert.ok(matches <= 80, "新增节点不应反复匹配未变化的祖先");
  await page.evaluate(() => document.getElementById("design").appendChild(document.getElementById("moved")));
  await page.waitForFunction(() => !document.getElementById("moved").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("注释节点的新增和移除不触发全页字体扫描", async t => {
  const page = await pageFor('<style>@container (width > 100px) { .conditional { font-family: Arial; } }</style>' + '<p class="target">History</p>'.repeat(1000));
  await page.evaluate(async () => {
    for (let i = 0; i < 10; i++) {
      const comment = document.createComment("Framework marker");
      document.body.appendChild(comment);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      comment.remove();
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const metrics = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.deepEqual(metrics, { reads: 0, disables: 0 });
  await page.close();
});

test("自定义 CSS 接管时，已明确受保护的新增代码和图标不采样字体", async t => {
  const customCSS = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  const page = await pageFor('<p class="target">Primer</p>', { customCSS });
  await page.evaluate(async () => {
    const code = document.createElement("section");
    code.id = "protected";
    code.innerHTML = Array.from({ length: 400 }, (_, i) => '<code style="font-feature-settings: &quot;ss01&quot; ' + i + '">Code</code>').join("") + '<span class="icon">Icon</span>';
    document.body.appendChild(code);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const metrics = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.deepEqual(metrics, { reads: 0, disables: 0 });
  assert.equal(await page.locator("#protected [data-sfs-replaced]").count(), 0);
  assert.equal(await page.locator("#sfs-custom-style").textContent(), customCSS);
  await page.evaluate(() => {
    __settings.protectCode = false;
    __settings.protectIcons = false;
    __settings.targets = ["Arial", "monospace"];
    __storageChanged({ protectCode: { newValue: false }, protectIcons: { newValue: false } }, "sync");
    document.getElementById("protected").className = "target";
  });
  await page.waitForFunction(() => document.querySelectorAll("#protected [data-sfs-replaced]").length === 401);
  await page.close();
});

test("CSS 字体变量、转义类名与保护规则仍重检，原始 CSS 保持不变", async () => {
  const css = '<style id="source">.font\\:design { font-family: CustomFont; } #shell { --actual-font: Arial; font-family: var(--actual-font); } .dependent { --font-alias: var(--actual-font); font-family: var(--font-alias); }</style>';
  const page = await pageFor(css + '<div id="shell"><p id="text" class="dependent">Text</p></div><p id="escape" class="target">Escape</p><p id="icon" class="target">Icon</p>');
  const before = await page.locator("#source").textContent();
  const customBefore = await page.locator("#sfs-custom-style").textContent();
  await page.evaluate(() => {
    document.getElementById("shell").style.setProperty("--actual-font", "CustomFont");
    document.getElementById("escape").className = "font:design";
    document.getElementById("icon").className = "target icon";
  });
  await page.waitForFunction(() => ["text", "escape", "icon"].every(id => !document.getElementById(id).hasAttribute("data-sfs-replaced")));
  assert.equal(await page.locator("#source").textContent(), before);
  assert.equal(await page.locator("#sfs-custom-style").textContent(), customBefore);
  await page.close();
});

test("普通替换和完整 Apple UI Mix 原文都跳过无关交互，CSS 逐字保持一致", async () => {
  const customCSS = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  for (const customCSSOn of [false, true]) {
    const page = await pageFor('<div class="target">Primer</div><section id="shell"><p class="target">History</p><textarea id="editor" class="target"></textarea></section>', { customCSSOn, customCSS });
    await page.evaluate(async () => {
      __styleReads = __sheetDisables = 0;
      for (let i = 0; i < 10; i++) {
        document.getElementById("shell").className = "layout hover-" + i;
        document.getElementById("editor").style.height = i + 40 + "px";
        const menu = document.createElement("div");
        menu.className = "target popup";
        menu.textContent = "Menu";
        document.body.appendChild(menu);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!menu.hasAttribute("data-sfs-replaced")) throw Error("新增文字未替换");
        menu.remove();
      }
    });
    assert.equal(await page.evaluate(() => __styleReads), 0);
    assert.equal(await page.evaluate(() => __sheetDisables), 0);
    if (customCSSOn) assert.equal(await page.locator("#sfs-custom-style").textContent(), customCSS);
    await page.close();
  }
});

test("自动文字方向、语言变化和空文本首次出现仍更新字体判断", async () => {
  const page = await pageFor('<style>#direction:dir(rtl), #language:lang(fr) { font-family: CustomFont; }</style><p id="direction" class="target" dir="auto">English</p><p id="language" class="target" lang="en">Text</p><p id="empty" class="target"></p>');
  await page.evaluate(() => {
    document.getElementById("direction").firstChild.data = "مرحبا";
    document.getElementById("language").lang = "fr";
    const node = document.createTextNode("");
    document.getElementById("empty").appendChild(node);
    node.data = "First text";
  });
  await page.waitForFunction(() => !document.getElementById("direction").hasAttribute("data-sfs-replaced") && !document.getElementById("language").hasAttribute("data-sfs-replaced") && document.getElementById("empty").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("容器查询改变字体时保留原始采样，不误用布局变化过滤", async () => {
  const page = await pageFor('<style>#wrap { container-type: inline-size; width: 200px; } @container (width > 300px) { .conditional { font-family: CustomFont; } }</style><div id="wrap"><p id="conditional" class="target conditional">Text</p></div>');
  await page.waitForFunction(() => document.getElementById("conditional").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => { document.getElementById("wrap").style.width = "400px"; });
  await page.waitForFunction(() => !document.getElementById("conditional").hasAttribute("data-sfs-replaced"));
  assert.ok(await page.evaluate(() => __styleReads > 0));
  await page.close();
});

test("播放中的弹幕和动画变化合并空闲采样，暂停后完整处理字体变化", async t => {
  const customCSS = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  const page = await pageFor('<style>#player { container-type: inline-size; width: 200px; } @container (width > 300px) { .conditional { font-family: CustomFont; } }</style><div id="player"><video id="video" muted></video>' +
    '<p class="target conditional">Control</p>'.repeat(160) + '<div id="danmaku"></div></div>', { customCSS });
  const during = await page.evaluate(async () => {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const context = canvas.getContext("2d");
    const stream = canvas.captureStream(30);
    video.srcObject = stream;
    const frame = setInterval(() => context.fillRect(0, 0, 32, 32), 30);
    await video.play();
    __styleReads = __sheetDisables = 0;
    for (let i = 0; i < 30; i++) {
      document.getElementById("player").style.width = (200 + i) + "px";
      const row = document.createElement("div");
      row.className = "target";
      row.style.transform = "translateX(" + i + "px)";
      row.textContent = "Danmaku " + i;
      document.getElementById("danmaku").appendChild(row);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    clearInterval(frame);
    const metrics = { reads: __styleReads, disables: __sheetDisables, playing: !video.paused && video.readyState >= 2 };
    document.getElementById("player").style.width = "400px";
    video.pause();
    stream.getTracks().forEach(track => track.stop());
    return metrics;
  });
  t.diagnostic(JSON.stringify(during));
  assert.equal(during.playing, true);
  assert.ok(during.disables <= 12, "播放期间不应每帧停用全页 CSS");
  assert.ok(during.reads <= 384, "空闲分片应限制单次和累计采样量");
  await page.waitForFunction(() => !document.querySelector(".conditional[data-sfs-replaced]") && document.querySelectorAll("#danmaku [data-sfs-replaced]").length === 30);
  assert.equal(await page.locator("#sfs-custom-style").textContent(), customCSS);
  await page.close();
});

test("禁用配置会取消播放期间尚未执行的检查，旧任务不恢复标记", async () => {
  const page = await pageFor('<p class="target">Primer</p><video id="video" muted></video><div id="new"></div>');
  await page.evaluate(async () => {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const stream = canvas.captureStream(30);
    video.srcObject = stream;
    const frame = setInterval(() => canvas.getContext("2d").fillRect(0, 0, 32, 32), 30);
    await video.play();
    document.getElementById("new").innerHTML = '<p class="target">New text</p>';
    await new Promise(resolve => requestAnimationFrame(resolve));
    __settings.enabled = false;
    __storageChanged({ enabled: { newValue: false } }, "sync");
    setTimeout(() => { clearInterval(frame); video.pause(); stream.getTracks().forEach(track => track.stop()); }, 500);
  });
  await page.waitForTimeout(650);
  assert.equal(await page.locator("[data-sfs-replaced], #sfs-custom-style, #sfs-style").count(), 0);
  await page.close();
});

test("子树内新增和移除样式表仍重新判断已有文字字体", async () => {
  const page = await pageFor('<p id="outside" class="target">Existing text</p>');
  await page.evaluate(() => {
    const panel = document.createElement("section");
    panel.id = "panel";
    panel.innerHTML = '<style>#outside { font-family: CustomFont !important; }</style><p>Panel</p>';
    document.body.appendChild(panel);
  });
  await page.waitForFunction(() => !document.getElementById("outside").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => document.getElementById("panel").remove());
  await page.waitForFunction(() => document.getElementById("outside").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("自定义 CSS 下受保护的 SVG 动画属性不引发重复子树遍历", async t => {
  const page = await pageFor('<style>@container (width > 100px) { .conditional { font-family: Arial; } }</style><p class="target">Primer</p><svg><g id="animation">' + '<text>Protected</text>'.repeat(1000) + '</g></svg>');
  const traversals = await page.evaluate(async () => {
    const original = document.createTreeWalker;
    let traversals = 0;
    document.createTreeWalker = function(...args) { traversals++; return Reflect.apply(original, this, args); };
    try {
      for (let i = 0; i < 12; i++) {
        document.getElementById("animation").style.display = i % 2 ? "block" : "none";
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      return traversals;
    } finally { document.createTreeWalker = original; }
  });
  t.diagnostic(JSON.stringify({ svgTextElements: 1000, traversals }));
  assert.equal(traversals, 0);
  assert.equal(await page.locator("svg [data-sfs-replaced]").count(), 0);
  // SVG 中的样式表仍可能影响外部 HTML，不能把整棵 SVG 从观察范围删除。
  await page.evaluate(() => {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = '.target { font-family: CustomFont !important; }';
    document.querySelector("svg").appendChild(style);
  });
  await page.waitForFunction(() => !document.querySelector("p").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("持续播放中的新文字最终替换，不重复查询全页视频", async t => {
  const page = await pageFor('<p class="target">Primer</p><video id="video" muted></video><div id="rows"></div>');
  const metrics = await page.evaluate(async () => {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const stream = canvas.captureStream(30);
    const frame = setInterval(() => canvas.getContext("2d").fillRect(0, 0, 32, 32), 30);
    video.srcObject = stream;
    await video.play();
    const original = document.querySelectorAll;
    let videoQueries = 0;
    document.querySelectorAll = function(selector) {
      if (selector === "video") videoQueries++;
      return original.call(this, selector);
    };
    try {
      for (let i = 0; i < 20; i++) {
        document.getElementById("rows").insertAdjacentHTML("beforeend", '<p class="target">New ' + i + '</p>');
        await new Promise(resolve => setTimeout(resolve, 40));
      }
      const start = performance.now();
      while (document.querySelectorAll("#rows [data-sfs-replaced]").length !== 20 && performance.now() - start < 2500) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { videoQueries, replaced: document.querySelectorAll("#rows [data-sfs-replaced]").length, playing: !video.paused };
    } finally {
      document.querySelectorAll = original;
      clearInterval(frame);
      video.pause();
      stream.getTracks().forEach(track => track.stop());
    }
  });
  t.diagnostic(JSON.stringify(metrics));
  assert.equal(metrics.playing, true);
  assert.equal(metrics.replaced, 20);
  assert.equal(metrics.videoQueries, 0);
  await page.close();
});

test("持续播放时完成分片重检，多视频暂停和移除保持调度正确", async () => {
  const page = await pageFor('<style>#wrap { container-type: inline-size; width: 200px; } @container (width > 300px) { .conditional { font-family: CustomFont; } }</style><video id="first" muted></video><video id="second" muted></video><div id="wrap">' +
    '<p class="target conditional">Control</p>'.repeat(160) + '</div><div id="new"></div>');
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const stream = canvas.captureStream(30);
    const frame = setInterval(() => canvas.getContext("2d").fillRect(0, 0, 32, 32), 30);
    for (const id of ["first", "second"]) document.getElementById(id).srcObject = stream;
    await Promise.all([document.getElementById("first").play(), document.getElementById("second").play()]);
    window.__stopVideos = () => { clearInterval(frame); stream.getTracks().forEach(track => track.stop()); };
    document.getElementById("wrap").style.width = "400px";
  });
  await page.waitForFunction(() => !document.querySelector(".conditional[data-sfs-replaced]"), undefined, { timeout: 2500 });
  assert.equal(await page.evaluate(() => document.getElementById("second").paused), false);
  const early = await page.evaluate(async () => {
    document.getElementById("first").pause();
    document.getElementById("new").innerHTML = '<p id="late" class="target">New</p>';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return document.getElementById("late").hasAttribute("data-sfs-replaced");
  });
  assert.equal(early, false, "仍有视频播放时不应提前恢复普通调度");
  await page.evaluate(() => document.getElementById("second").remove());
  await page.waitForFunction(() => document.getElementById("late").hasAttribute("data-sfs-replaced"), undefined, { timeout: 180 });
  await page.evaluate(() => window.__stopVideos());
  await page.close();
});

test("多张跨域样式表读取完成后合并补扫", async t => {
  const page = await pageFor('<p class="target">Primer</p>' + '<p class="target">Text</p>'.repeat(40));
  await page.evaluate(() => {
    chrome.runtime = { sendMessage: async ({ url }) => {
      await new Promise(resolve => setTimeout(resolve, 20 + Number(url.match(/font-(\d)/)[1]) * 20));
      return { css: '.target { font-family: Arial; }' };
    } };
    for (let i = 0; i < 3; i++) {
      const style = document.createElement("style");
      style.textContent = '.target { font-family: Arial; }';
      document.head.appendChild(style);
      Object.defineProperty(style.sheet, "href", { value: "https://example.com/font-" + i + ".css" });
      Object.defineProperty(style.sheet, "cssRules", { get() { throw new DOMException("Cross-origin", "SecurityError"); } });
    }
    __styleReads = __sheetDisables = 0;
  });
  await page.waitForTimeout(450);
  const metrics = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.ok(metrics.reads <= 50, "跨域读取结果不应逐张引发整页补扫");
  assert.ok(metrics.disables <= 4);
  await page.close();
});

test("dir=auto 的富文本输入保持方向时不反复停用全页 CSS", async t => {
  const customCSS = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  const page = await pageFor('<style>#composer:dir(rtl) p { font-family: CustomFont; }</style><div id="composer" class="target" contenteditable="true" dir="auto"><p id="draft">Start</p></div>', { customCSS });
  await page.locator("#composer").click();
  await page.locator("#composer").press("End");
  await page.evaluate(() => { __styleReads = __sheetDisables = 0; });
  await page.locator("#composer").pressSequentially("abcdefghijklmnopqrst", { delay: 25 });
  await page.waitForTimeout(250);
  const metrics = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.deepEqual(metrics, { reads: 0, disables: 0 });
  await page.evaluate(() => {
    const composer = document.getElementById("composer");
    composer.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertText" }));
    document.getElementById("draft").firstChild.data = "مرحبا";
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  });
  await page.waitForFunction(() => document.getElementById("composer").matches(":dir(rtl)") && !document.getElementById("draft").hasAttribute("data-sfs-replaced"));
  assert.ok(await page.evaluate(() => __styleReads > 0));
  assert.equal(await page.locator("#sfs-custom-style").textContent(), customCSS);
  await page.close();
});

test("连续输入中的新段落和未知字体依赖延后合并，停顿后仍正确替换与保护", async t => {
  const customCSS = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  for (const customCSSOn of [false, true]) {
    const page = await pageFor('<style>@container (width > 100px) { .conditional { font-family: Arial; } }</style><div id="composer" class="target" contenteditable="true" dir="auto"><p>Start</p></div>', { customCSSOn, customCSS });
    const during = await page.evaluate(async () => {
      __styleReads = __sheetDisables = 0;
      const composer = document.getElementById("composer");
      for (let i = 0; i < 20; i++) {
        composer.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, inputType: "insertParagraph" }));
        composer.insertAdjacentHTML("beforeend", '<p id="line-' + i + '">Line ' + i + '<code>Code</code></p>');
        document.body.style.height = (100 + i) + "px";
        composer.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertParagraph" }));
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      return { reads: __styleReads, disables: __sheetDisables };
    });
    assert.deepEqual(during, { reads: 0, disables: 0 });
    await page.waitForFunction(() => document.querySelectorAll('[id^="line-"][data-sfs-replaced]').length === 20);
    assert.equal(await page.locator("code[data-sfs-replaced]").count(), 0);
    const after = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
    t.diagnostic(JSON.stringify({ customCSSOn, during, after }));
    assert.equal(after.disables, customCSSOn ? 2 : 1);
    if (customCSSOn) assert.equal(await page.locator("#sfs-custom-style").textContent(), customCSS);
    await page.close();
  }
});

test("输入法组词期间暂停字体扫描，完成后恢复；失焦可释放未结束的组词", async t => {
  const page = await pageFor('<div id="composer" class="target" contenteditable="true" dir="auto"><p>Start</p></div>');
  await page.locator("#composer").focus();
  await page.evaluate(async () => {
    const composer = document.getElementById("composer");
    composer.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    composer.insertAdjacentHTML("beforeend", '<p id="composed">输入法组词</p>');
    composer.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
    await new Promise(resolve => setTimeout(resolve, 350));
  });
  assert.deepEqual(await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables })), { reads: 0, disables: 0 });
  await page.evaluate(() => document.getElementById("composer").dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
  await page.waitForFunction(() => document.getElementById("composed").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => {
    __styleReads = __sheetDisables = 0;
    const composer = document.getElementById("composer");
    composer.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    composer.insertAdjacentHTML("beforeend", '<p id="cancelled">取消组词</p>');
    composer.blur();
  });
  await page.waitForFunction(() => document.getElementById("cancelled").hasAttribute("data-sfs-replaced"));
  t.diagnostic("组词未结束时没有采样；结束或失焦后均完成字体判断");
  await page.close();
});

test("延迟输入扫描在禁用后取消，重新启用及 textarea 自动方向仍正常", async () => {
  const page = await pageFor('<style>#editor:dir(rtl) { font-family: CustomFont; }</style><textarea id="editor" class="target" dir="auto">Start</textarea><div id="composer" class="target" contenteditable="true">Start</div>');
  await page.locator("#editor").fill("مرحبا");
  await page.waitForFunction(() => !document.getElementById("editor").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => {
    const composer = document.getElementById("composer");
    composer.dispatchEvent(new InputEvent("beforeinput", { bubbles: true }));
    composer.insertAdjacentHTML("beforeend", '<p id="delayed">Delayed text</p>');
    composer.dispatchEvent(new InputEvent("input", { bubbles: true }));
    __settings.enabled = false;
    __storageChanged({ enabled: { newValue: false } }, "sync");
  });
  await page.waitForFunction(() => !document.getElementById("sfs-style"));
  await page.waitForTimeout(300);
  assert.equal(await page.locator("[data-sfs-replaced], [data-sfs-ligatures], [data-sfs-preserve]").count(), 0);
  await page.evaluate(() => {
    __settings.enabled = true;
    __storageChanged({ enabled: { newValue: true } }, "sync");
  });
  await page.waitForFunction(() => document.getElementById("delayed").hasAttribute("data-sfs-replaced"));
  assert.equal(await page.locator("#editor").getAttribute("data-sfs-replaced"), null);
  await page.close();
});

test("按住鼠标拖选文字时暂缓全页采样，松开后恢复字体判断", async t => {
  const customCSS = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  const history = '<p class="target">History</p>'.repeat(1000);
  for (const customCSSOn of [false, true]) {
    for (const editable of [false, true]) {
      const page = await pageFor('<style>@container (width > 100px) { .conditional { font-family: Arial; } }</style><div id="composer" class="target" contenteditable="' + editable + '" dir="auto" style="width: 600px"><p id="draft">The selected draft contains enough text for a continuous mouse drag.</p></div><p id="changed" class="target">Font change</p>' + history, { customCSSOn, customCSS });
      await page.evaluate(() => {
        let updates = 0;
        document.addEventListener("selectionchange", () => {
          if (getSelection().isCollapsed) return;
          document.documentElement.style.setProperty("--selection-left", (++updates) + "px");
          document.getElementById("changed").className = "design";
        });
        __styleReads = __sheetDisables = 0;
      });
      const box = await page.locator("#draft").boundingBox();
      await page.mouse.move(box.x + 2, box.y + box.height / 2);
      await page.mouse.down();
      try {
        for (let i = 1; i <= 16; i++) {
          await page.mouse.move(box.x + 2 + i * 10, box.y + box.height / 2);
          await page.waitForTimeout(25);
        }
        const during = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables, selected: getSelection().toString().length }));
        t.diagnostic(JSON.stringify({ customCSSOn, editable, during }));
        assert.ok(during.selected > 5, "应实际拖选出文字");
        assert.deepEqual({ reads: during.reads, disables: during.disables }, { reads: 0, disables: 0 });
      } finally {
        await page.mouse.up();
      }
      await page.waitForFunction(() => !document.getElementById("changed").hasAttribute("data-sfs-replaced"));
      const after = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
      assert.equal(after.disables, customCSSOn ? 2 : 1);
      if (customCSSOn) assert.equal(await page.locator("#sfs-custom-style").textContent(), customCSS);
      t.diagnostic(JSON.stringify({ customCSSOn, editable, after }));
      await page.close();
    }
  }
});

test("拖选取消、窗口失焦和未按键的指针移动都释放延迟任务", async () => {
  for (const ending of ["pointercancel", "blur", "pointermove"]) {
    const page = await pageFor('<div id="composer" class="target" contenteditable="true">Drag here</div><p id="changed" class="target">Font change</p>');
    await page.evaluate(() => {
      window.addEventListener("pointerdown", event => { window.__pointerId = event.pointerId; });
    });
    const box = await page.locator("#composer").boundingBox();
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      await page.evaluate(() => { document.getElementById("changed").className = "design"; });
      await page.waitForTimeout(250);
      assert.equal(await page.locator("#changed").getAttribute("data-sfs-replaced"), "1");
      assert.equal(await page.evaluate(() => __sheetDisables), 0);
      await page.evaluate(ending => {
        window.dispatchEvent(ending === "blur" ? new Event("blur") : new PointerEvent(ending, { pointerId: __pointerId, buttons: 0 }));
      }, ending);
      await page.waitForFunction(() => !document.getElementById("changed").hasAttribute("data-sfs-replaced"));
    } finally {
      await page.mouse.up();
    }
    await page.close();
  }
});

test("拖选中切换启用状态取消旧任务，恢复后的扫描等待松开鼠标", async () => {
  const page = await pageFor('<div id="composer" class="target" contenteditable="true">Drag here</div><p id="changed" class="target">Font change</p>');
  const box = await page.locator("#composer").boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  try {
    await page.evaluate(() => {
      document.getElementById("changed").className = "design";
      __settings.enabled = false;
      __storageChanged({ enabled: { newValue: false } }, "sync");
    });
    await page.waitForFunction(() => !document.getElementById("sfs-style"));
    await page.evaluate(() => {
      __settings.enabled = true;
      __storageChanged({ enabled: { newValue: true } }, "sync");
    });
    await page.waitForFunction(() => !!document.getElementById("sfs-style"));
    await page.waitForTimeout(250);
    assert.equal(await page.locator("[data-sfs-replaced]").count(), 0);
    assert.equal(await page.evaluate(() => __styleReads), 0);
  } finally {
    await page.mouse.up();
  }
  await page.waitForFunction(() => document.getElementById("composer").hasAttribute("data-sfs-replaced"));
  assert.equal(await page.locator("#changed").getAttribute("data-sfs-replaced"), null);
  await page.close();
});

test("图标伪元素的 class 条件不扩大成播放器和搜索栏的字体依赖", async t => {
  const controls = Array.from({ length: 180 }, (_, i) => '<span class="target">Control ' + i + '</span>').join("");
  const page = await pageFor('<style>[class^="van-icon-"]::before { font-family: vanfont; } .tip:hover::after { font-family: IconFont; }</style>' +
    '<div id="player">' + controls + '</div><div id="nav"><input class="target"><span class="target">Search</span></div>');
  const result = await page.evaluate(async () => {
    const original = document.createTreeWalker;
    let traversals = 0;
    document.createTreeWalker = function(...args) { traversals++; return Reflect.apply(original, this, args); };
    for (let i = 0; i < 15; i++) {
      document.getElementById("player").className = "bpx-state-hover-" + i;
      document.getElementById("nav").className = "search-focus-" + i;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    document.createTreeWalker = original;
    return { traversals, reads: __styleReads, disables: __sheetDisables };
  });
  t.diagnostic(JSON.stringify(result));
  assert.deepEqual(result, { traversals: 0, reads: 0, disables: 0 });
  await page.close();
});

test("混合伪元素列表保留真正的字体规则，选择器中的逗号和冒号保持原义", async () => {
  const page = await pageFor('<style>.glyph::before, :is(.switch, .alternate) { font-family: CustomFont; } [data-label="x,::before"] { font-family: CustomFont; }</style>' +
    '<p id="change" class="target">Change</p><p id="quoted" class="target" data-label="x,::before">Quoted</p>');
  assert.equal(await page.locator("#quoted").getAttribute("data-sfs-replaced"), null);
  await page.locator("#change").evaluate(el => { el.classList.add("switch"); });
  await page.waitForFunction(() => !document.getElementById("change").hasAttribute("data-sfs-replaced"));
  await page.locator("#change").evaluate(el => { el.classList.remove("switch"); });
  await page.waitForFunction(() => document.getElementById("change").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("真实 MV3 读取跨域 CSS 后，交互优化生效且字体变化仍重检", async t => {
  let requests = 0;
  const remote = http.createServer((request, response) => {
    requests++;
    response.setHeader("Content-Type", "text/css");
    response.end('.target { font-family: Arial; } .design { font-family: CustomFont; } [class^="van-icon-"]::before { font-family: vanfont; }');
  });
  await new Promise(resolve => remote.listen(0, "127.0.0.1", resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
      args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.sync.set({ targets: ["Arial"], replacement: "serif", customCSSOn: true,
      customCSS: 'html, body, [data-sfs-replaced="1"] { font-family: serif !important; }' }));
    const route = "/cross-case";
    fixtures.set(route, '<!doctype html><html><head><link rel="stylesheet" href="http://127.0.0.1:' + remote.address().port + '/font.css"></head><body><div id="shell"><p id="text" class="target">Text</p><textarea id="editor" class="target"></textarea><div id="composer" class="target" contenteditable="true" dir="auto"><p>Start</p></div></div></body></html>');
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const worlds = [];
    cdp.on("Runtime.executionContextCreated", event => worlds.push(event.context));
    await cdp.send("Runtime.enable");
    await page.goto(origin + route);
    await page.waitForFunction(() => !!document.getElementById("sfs-custom-style"));
    await page.waitForFunction(() => { try { document.styleSheets[0].cssRules; return false; } catch { return true; } });
    assert.ok(requests >= 2, "页面加载和扩展读取都应请求跨域 CSS");
    await page.evaluate(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => requestAnimationFrame(resolve)); });
    const world = worlds.find(world => world.origin.startsWith("chrome-extension://"));
    assert.ok(world, "应找到扩展的隔离执行环境");
    await cdp.send("Runtime.evaluate", { contextId: world.id, expression: `
      window.__reads = window.__disables = window.__walks = 0;
      const walk = document.createTreeWalker;
      document.createTreeWalker = function(...args) { __walks++; return Reflect.apply(walk, this, args); };
      const getStyle = window.getComputedStyle;
      window.getComputedStyle = function(...args) { __reads++; return Reflect.apply(getStyle, this, args); };
      const disabled = Object.getOwnPropertyDescriptor(StyleSheet.prototype, "disabled");
      Object.defineProperty(StyleSheet.prototype, "disabled", {...disabled, set(value) {
        if(value && ["sfs-style","sfs-custom-style"].includes(this.ownerNode?.id)) __disables++;
        disabled.set.call(this, value);
      }});
    ` });
    // 样式表加载会延迟补扫；等待计数稳定，避免将初始化开销算作交互开销。
    const idle = await cdp.send("Runtime.evaluate", { contextId: world.id, awaitPromise: true, returnByValue: true, expression: `
      (async () => {
        const start = performance.now();
        let stableSince = start;
        let previous = __reads + __disables;
        while (performance.now() - start < 5000) {
          await new Promise(resolve => setTimeout(resolve, 25));
          const current = __reads + __disables;
          if (current !== previous) { stableSince = performance.now(); previous = current; }
          if (performance.now() - stableSince >= 200) return true;
        }
        return false;
      })()
    ` });
    assert.equal(idle.result.value, true, "初始化字体扫描应稳定后再测量交互");
    await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "__reads = __disables = __walks = 0" });
    await page.evaluate(async () => {
      for (let i = 0; i < 10; i++) {
        document.getElementById("shell").className = "layout hover-" + i;
        document.getElementById("editor").style.height = (40 + i) + "px";
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
    const result = await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "({reads: __reads, disables: __disables, walks: __walks})", returnByValue: true });
    t.diagnostic(JSON.stringify(result.result.value));
    assert.deepEqual(result.result.value, { reads: 0, disables: 0, walks: 0 });
    await page.evaluate(() => { document.getElementById("text").className = "design"; });
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
    await page.locator("#composer").click();
    await page.locator("#composer").press("End");
    await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "__reads = __disables = 0" });
    for (let i = 0; i < 20; i++) {
      await page.locator("#composer").press("Enter");
      await page.locator("#composer").pressSequentially("abc", { delay: 25 });
    }
    const during = await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "({reads: __reads, disables: __disables})", returnByValue: true });
    assert.deepEqual(during.result.value, { reads: 0, disables: 0 });
    // 浏览器回车可能复制前段的标记，不能以标记存在代替停顿后的重检完成。
    await page.waitForTimeout(250);
    await page.waitForFunction(() => document.querySelectorAll('#composer [data-sfs-replaced="1"]').length >= 21);
    const settled = await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "({reads: __reads, disables: __disables})", returnByValue: true });
    assert.equal(settled.result.value.disables, 2);
    assert.ok(settled.result.value.reads >= 20);
    t.diagnostic(JSON.stringify({ mv3Input: { during: during.result.value, settled: settled.result.value } }));
    await page.evaluate(() => {
      document.addEventListener("selectionchange", () => {
        if (!getSelection().isCollapsed) document.getElementById("composer").style.fontFamily = "CustomFont";
      });
    });
    const firstParagraph = page.locator("#composer p").first();
    await firstParagraph.scrollIntoViewIfNeeded();
    const box = await firstParagraph.boundingBox();
    await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "__reads = __disables = 0" });
    await page.mouse.move(box.x + 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      for (let i = 1; i <= 12; i++) {
        await page.mouse.move(box.x + 60, box.y + box.height / 2 + i * 12);
        await page.waitForTimeout(25);
      }
      assert.ok(await page.evaluate(() => getSelection().toString().length > 10), "隔离脚本用例应实际拖选出跨段文字");
      const drag = await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "({reads: __reads, disables: __disables})", returnByValue: true });
      assert.deepEqual(drag.result.value, { reads: 0, disables: 0 });
      t.diagnostic(JSON.stringify({ mv3DragDuring: drag.result.value }));
    } finally {
      await page.mouse.up();
    }
    await page.waitForFunction(() => !document.querySelector("#composer p").hasAttribute("data-sfs-replaced"));
    const dragSettled = await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "({reads: __reads, disables: __disables})", returnByValue: true });
    assert.equal(dragSettled.result.value.disables, 2);
    t.diagnostic(JSON.stringify({ mv3DragSettled: dragSettled.result.value }));
  } finally {
    await context?.close();
    await new Promise(resolve => remote.close(resolve));
  }
});
