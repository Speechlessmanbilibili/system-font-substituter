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
  browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function pageFor(html, settings = {}, initialize) {
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
  if (initialize) await page.addInitScript(initialize);
  const route = "/case-" + fixtures.size;
  fixtures.set(route, '<!doctype html><html><head><style>.target { font-family: Arial; } .design { font-family: CustomFont; }</style></head><body>' + html + '<script src="/shared.js"></script><script src="/content.js"></script></body></html>');
  await page.goto(origin + route);
  await page.waitForFunction(customCSSOn => customCSSOn ? !!document.getElementById("sfs-custom-style") : !!document.getElementById("sfs-style"), settings.customCSSOn !== false);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.evaluate(() => { __styleReads = __sheetDisables = 0; });
  return page;
}

test("属性运算符、引号内容和转义标点保留字体缓存及真实依赖", async t => {
  for (const customCSSOn of [false, true]) {
    const css = '<style>.token[data-font~="normal"]{font-family:Arial}.token[data-font~="design"]{font-family:CustomFont}.quoted[data-label=".phantom #ghost :hover [class] [style] + ~"]{font-family:Arial}.font\\:hover\\+wide{font-family:Arial}</style>';
    const page = await pageFor(css + '<main id="shell"><p class="target">Primer</p></main>', { customCSSOn }, () => {
      window.__spanCreates = 0;
      const create = document.createElement;
      document.createElement = function (name, ...args) { if (name === "span") __spanCreates++; return Reflect.apply(create, this, [name, ...args]); };
    });
    await page.evaluate(() => {
      __styleReads = __sheetDisables = 0;
      document.getElementById("shell").insertAdjacentHTML("beforeend", '<p class="token" data-font="normal other">Token</p>'.repeat(200) + '<p class="quoted" data-label=".phantom #ghost :hover [class] [style] + ~">Quoted</p>'.repeat(200) + '<p class="font:hover+wide">Escaped</p>'.repeat(200));
    });
    await page.waitForFunction(() => document.querySelectorAll('#shell p[data-sfs-replaced="1"]').length === 601);
    const metrics = await page.evaluate(() => ({ reads: __styleReads, sheetDisables: __sheetDisables }));
    t.diagnostic(JSON.stringify({ customCSSOn, ...metrics }));
    assert.ok(metrics.reads <= 6, "静态属性条件和转义标点应复用相同字体结果");
    await page.evaluate(async () => {
      __styleReads = __sheetDisables = 0;
      for (let i = 0; i < 10; i++) {
        const el = document.createElement("p"); el.className = "token"; el.setAttribute("data-font", "normal other"); el.textContent = "Menu";
        document.getElementById("shell").appendChild(el);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!el.hasAttribute("data-sfs-replaced")) throw Error("新增菜单字体未替换");
        el.remove();
      }
    });
    assert.equal(await page.evaluate(() => __styleReads), 0);
    assert.equal(await page.evaluate(() => __sheetDisables), 0);
    await page.evaluate(async () => {
      __styleReads = __sheetDisables = __spanCreates = 0;
      const shell = document.getElementById("shell");
      for (let i = 0; i < 4; i++) {
        shell.className = "phantom layout-" + i; shell.id = i % 2 ? "shell" : "ghost"; shell.style.height = (40 + i) + "px";
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
    assert.equal(await page.evaluate(() => __styleReads), 0);
    assert.equal(await page.evaluate(() => __sheetDisables), 0);
    assert.equal(await page.evaluate(() => __spanCreates), 0);
    await page.locator(".token").first().evaluate(el => el.setAttribute("data-font", "design other"));
    await page.waitForFunction(() => !document.querySelector(".token").hasAttribute("data-sfs-replaced"));
    await page.locator(".quoted").first().evaluate(el => el.setAttribute("data-label", "changed"));
    await page.waitForFunction(() => !document.querySelector(".quoted").hasAttribute("data-sfs-replaced"));
    await page.locator('[class="font:hover+wide"]').first().evaluate(el => el.className = "design");
    await page.waitForFunction(() => document.querySelectorAll('#shell p[data-sfs-replaced="1"]').length === 598);
    await page.close();
  }
});

test("布局内联样式直接过滤，字体声明、注释、转义和变量变化仍重检", async t => {
  const page = await pageFor('<style>:root{--actual-font:Arial}.variable{font-family:var(--actual-font)}</style><div id="shell"><p id="text" class="target">Text</p><p id="variable" class="variable">Variable</p></div>', {}, () => {
    window.__spanCreates = 0;
    const create = document.createElement;
    document.createElement = function (name, ...args) { if (name === "span") __spanCreates++; return Reflect.apply(create, this, [name, ...args]); };
  });
  const metrics = await page.evaluate(async () => {
    __spanCreates = __styleReads = __sheetDisables = 0;
    for (let round = 0; round < 8; round++) {
      for (let i = 0; i < 100; i++) {
        const el = document.createElement("div"); el.style.cssText = "height:10px;left:0;opacity:0.8"; document.getElementById("shell").appendChild(el);
        el.style.height = (round + 20) + "px";
      }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    return { spans: __spanCreates, reads: __styleReads, sheetDisables: __sheetDisables };
  });
  t.diagnostic(JSON.stringify(metrics));
  assert.equal(metrics.spans, 0, "纯布局样式不应创建临时元素解析");
  assert.equal(metrics.reads, 0);
  for (const value of ['/* 字体 */ font-family:CustomFont', 'FONT-FAMILY:Arial', 'f\\6f nt-family:CustomFont', 'color:rgb(0,0,0)']) {
    await page.locator("#text").evaluate((el, value) => el.setAttribute("style", value), value);
    await page.waitForFunction(target => document.getElementById("text").hasAttribute("data-sfs-replaced") === target, !value.includes("CustomFont"));
  }
  await page.evaluate(() => document.documentElement.style.setProperty("--actual-font", "CustomFont"));
  await page.waitForFunction(() => !document.getElementById("variable").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => document.documentElement.style.removeProperty("--actual-font"));
  await page.waitForFunction(() => document.getElementById("variable").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("强制站点的原生连字和自定义 CSS 直接标记，切换保护与普通模式仍采样", async t => {
  const css = fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8");
  const page = await pageFor('<style>@container(width>9000px){p{font-family:CustomFont}}</style><p class="target">Primer</p><main id="added"></main>',
    { customCSS: css, ligatureLevel: "native", protectIcons: false, siteRules: [{ domain: "127.0.0.1", action: "force" }] });
  await page.evaluate(() => {
    __styleReads = __sheetDisables = 0;
    document.getElementById("added").innerHTML = 'Parent' + '<p class="target">Text</p>'.repeat(400) + '<pre><span class="target">Code</span></pre><svg><text>SVG</text></svg><span id="family" style="font-family:Material Icons">Icon</span><span id="own" class="target icon">Icon</span>';
  });
  await page.waitForFunction(() => document.querySelectorAll('#added [data-sfs-replaced="1"]').length === 402 && document.getElementById("added").hasAttribute("data-sfs-replaced"));
  const metrics = await page.evaluate(() => ({ reads: __styleReads, disables: __sheetDisables }));
  t.diagnostic(JSON.stringify(metrics));
  assert.equal(metrics.reads, 0);
  assert.equal(metrics.disables, 0);
  assert.equal(await page.locator('#added pre [data-sfs-replaced],#added svg [data-sfs-replaced]').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById("sfs-custom-style").textContent), css);
  await page.evaluate(() => { __settings.protectIcons = true; __storageChanged({ protectIcons: {} }, "sync"); });
  await page.waitForFunction(() => !document.getElementById("family").hasAttribute("data-sfs-replaced") && !document.getElementById("own").hasAttribute("data-sfs-replaced"));
  assert.ok(await page.evaluate(() => __styleReads) >= 400, "恢复图标家族保护后应读取原字体");
  await page.evaluate(() => { __settings.protectIcons = false; __settings.ligatureLevel = "standard"; __storageChanged({ protectIcons: {}, ligatureLevel: {} }, "sync"); });
  await page.waitForFunction(() => document.getElementById("family").hasAttribute("data-sfs-ligatures"));
  await page.evaluate(() => { __settings.customCSS = ""; __settings.ligatureLevel = "native"; __storageChanged({ customCSS: {}, ligatureLevel: {} }, "sync"); });
  await page.waitForFunction(() => document.querySelector("#added pre span").hasAttribute("data-sfs-preserve"));
  assert.equal(await page.locator('#added pre [data-sfs-replaced],#added svg [data-sfs-replaced]').count(), 0);
  await page.close();
});

test("简单转义及中文类名和 ID 精确索引，复合条件继续原生匹配", async t => {
  const css = '<style>.\\31 23{font-family:Arial}.font\\:normal\\+wide{font-family:Arial}.中文{font-family:Arial}.\\66 oo{font-family:Arial}#id\\+with{font-family:Arial}#\\000031 a{font-family:Arial}</style>';
  const page = await pageFor(css + '<p class="target">Primer</p><main id="indexed"></main>', {}, () => {
    window.__fontMatches = 0;
    const matches = Element.prototype.matches;
    Element.prototype.matches = function (selector) { if (/^[.#]/.test(selector)) __fontMatches++; return matches.call(this, selector); };
  });
  await page.evaluate(() => {
    __fontMatches = 0;
    document.getElementById("indexed").innerHTML = ['class="123"', 'class="font:normal+wide"', 'class="中文"', 'class="foo"', 'id="id+with"', 'id="1a"'].map(attribute => ('<p ' + attribute + '>Text</p>').repeat(100)).join("");
  });
  await page.waitForFunction(() => document.querySelectorAll('#indexed p[data-sfs-replaced="1"]').length === 600);
  const matches = await page.evaluate(() => __fontMatches);
  t.diagnostic(JSON.stringify({ matches }));
  assert.ok(matches <= 20, "单个转义名称不应逐元素匹配全部字体规则");
  await page.evaluate(() => {
    document.querySelectorAll('[class="123"]').forEach(el => { el.className = "design"; });
    document.querySelectorAll('[id="id+with"]').forEach(el => { el.id = "renamed"; });
  });
  await page.waitForFunction(() => document.querySelectorAll('#indexed p[data-sfs-replaced="1"]').length === 400);
  await page.evaluate(() => {
    const sheet = document.createElement("style"); sheet.textContent = '.scope .font\\:normal\\+wide{font-family:CustomFont}'; document.head.appendChild(sheet);
    document.getElementById("indexed").className = "scope";
  });
  await page.waitForFunction(() => document.querySelectorAll('#indexed p[data-sfs-replaced="1"]').length === 300);
  await page.close();
});

test("转义属性名和函数内的真实选择器仍跟踪字体依赖", async () => {
  const page = await pageFor('<style>[data\\2d font="design"],:is(.switch,[data-state="on"]) .target{font-family:CustomFont}</style><main id="shell"><p id="text" class="target">Text</p></main>');
  await page.locator("#text").evaluate(el => el.setAttribute("data-font", "design"));
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.locator("#text").evaluate(el => el.removeAttribute("data-font"));
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  for (const [attribute, value] of [["class", "switch"], ["data-state", "on"]]) {
    await page.locator("#shell").evaluate((el, { attribute, value }) => el.setAttribute(attribute, value), { attribute, value });
    await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
    await page.locator("#shell").evaluate((el, attribute) => el.removeAttribute(attribute), attribute);
    await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  }
  await page.close();
});

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

test("百万字符的同批更新和文本节点替换合并读取，字体变化仍重检", async t => {
  for (const customCSSOn of [false, true]) {
    const page = await pageFor('<p id="long" class="target">Start</p>', { customCSSOn }, () => {
      window.__textReads = 0;
      const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "nodeValue");
      Object.defineProperty(Node.prototype, "nodeValue", { ...descriptor, get() {
        if (this.parentElement?.id === "long") __textReads++;
        return descriptor.get.call(this);
      } });
    });
    const metrics = await page.evaluate(async () => {
      const parent = document.getElementById("long"), tail = " ".repeat(1000000);
      const values = ["文字 A" + tail, "文字 B" + tail];
      __textReads = __styleReads = __sheetDisables = 0;
      for (let round = 0; round < 4; round++) {
        for (let i = 0; i < 200; i++) {
          if (round % 2) parent.textContent = values[i % 2];
          else parent.firstChild.data = values[i % 2];
        }
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      if (parent.textContent !== values[1]) throw Error("长文字内容发生变化");
      return { textReads: __textReads, styleReads: __styleReads, sheetDisables: __sheetDisables };
    });
    assert.ok(metrics.textReads <= 8, "同批写入应按最终文本合并读取");
    assert.equal(metrics.styleReads, 0);
    assert.equal(metrics.sheetDisables, 0);
    t.diagnostic(JSON.stringify({ customCSSOn, ...metrics }));
    await page.evaluate(() => { document.getElementById("long").className = "design"; });
    await page.waitForFunction(() => !document.getElementById("long").hasAttribute("data-sfs-replaced"));
    await page.close();
  }
});

test("文字批处理保留 Unicode 空白、首次文字、关系字体和自动方向的最终状态", async () => {
  const page = await pageFor('<style>#holder:has(#text:empty) #sibling{font-family:CustomFont}.auto:dir(rtl){font-family:CustomFont}</style><div id="holder"><span id="text" class="target"></span><p id="sibling" class="target">Sibling</p></div><div id="auto" class="target auto" dir="auto">Latin</div>');
  await page.waitForFunction(() => !document.getElementById("sibling").hasAttribute("data-sfs-replaced"));
  const whitespace = "\t\n\r\f\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff";
  await page.evaluate(whitespace => {
    const text = document.getElementById("text"), auto = document.getElementById("auto");
    for (let i = 0; i < 100; i++) { text.textContent = i % 2 ? whitespace : "Interim"; auto.firstChild.data = i % 2 ? "مرحبا" : "Latin"; }
  }, whitespace);
  await page.waitForFunction(() => document.getElementById("sibling").hasAttribute("data-sfs-replaced") && !document.getElementById("auto").hasAttribute("data-sfs-replaced"));
  assert.equal(await page.locator('#text[data-sfs-replaced="1"]').count(), 0);
  await page.evaluate(() => {
    const text = document.getElementById("text"), auto = document.getElementById("auto");
    for (let i = 0; i < 100; i++) { text.firstChild.data = i % 2 ? "\u200b" : " "; auto.textContent = i % 2 ? "Latin" : "مرحبا"; }
  });
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced") && document.getElementById("auto").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => { const text = document.getElementById("text"); for (let i = 0; i < 100; i++) text.textContent = i % 2 ? "" : "Interim"; });
  await page.waitForFunction(() => !document.getElementById("sibling").hasAttribute("data-sfs-replaced"));
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

test("小分支字体变化和菜单移除保留其他分支的深层继承缓存", async t => {
  const rules = Array.from({ length: 500 }, (_, i) => ':is(.unused-' + i + ',.other-' + i + '){font-family:CustomFont}').join("");
  const page = await pageFor('<style>' + rules + '</style><main id="deep" class="target">' + '<div>'.repeat(100) + '<p>Primer</p>' + '</div>'.repeat(100) + '</main><section id="small" class="target"><span>Small</span></section>');
  const metrics = await page.evaluate(async () => {
    const original = Element.prototype.matches;
    let matches = 0;
    Element.prototype.matches = function(...args) { matches++; return Reflect.apply(original, this, args); };
    try {
      const small = document.getElementById("small");
      const parent = document.querySelector("#deep p").parentElement;
      for (let i = 0; i < 10; i++) {
        small.style.fontFamily = i % 2 ? "CustomFont" : "Arial";
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (small.firstElementChild.hasAttribute("data-sfs-replaced") !== !(i % 2)) throw Error("小分支原字体判断错误");
        const menu = document.createElement("p"); menu.textContent = "Menu"; parent.appendChild(menu);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!menu.hasAttribute("data-sfs-replaced")) throw Error("深层新增菜单未替换");
        menu.remove();
      }
      return { matches, reads: __styleReads };
    } finally { Element.prototype.matches = original; }
  });
  t.diagnostic(JSON.stringify(metrics));
  assert.ok(metrics.matches < 20000, "小分支及叶子移除应保留 100 层主分支的缓存");
  await page.close();
});

test("缓存子树在同批移除、增加包装和重挂后仍判断新的继承字体", async () => {
  const page = await pageFor('<main class="target" id="live"><section id="branch"><span id="text">Text</span></section></main><main class="design" id="destination"><span>Design</span></main>');
  await page.evaluate(() => {
    const branch = document.getElementById("branch"), text = document.getElementById("text"); branch.remove();
    const wrapper = document.createElement("div"); wrapper.className = "design"; wrapper.id = "wrapper";
    wrapper.appendChild(text); branch.appendChild(wrapper); document.getElementById("live").appendChild(branch);
  });
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => { document.getElementById("wrapper").className = ""; });
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => {
    const branch = document.getElementById("branch"), wrapper = document.getElementById("wrapper"); branch.remove();
    document.getElementById("destination").appendChild(branch); wrapper.replaceWith(document.getElementById("text"));
  });
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("深层区域的兄弟变更共享祖先去重路径，父子同时变化仍只扫描外层", async t => {
  const html = '<main class="target">' + '<div>'.repeat(250) + '<div id="middle">' + '<div>'.repeat(250) + '<p>Primer</p>' + '<p class="design">Text</p>'.repeat(300) + '</div>'.repeat(250) + '</div>' + '</div>'.repeat(250) + '</main>';
  const page = await pageFor(html, {}, () => {
    window.__parentReads = window.__walks = 0;
    const descriptor = Object.getOwnPropertyDescriptor(Node.prototype, "parentElement");
    Object.defineProperty(Node.prototype, "parentElement", { ...descriptor, get() { __parentReads++; return descriptor.get.call(this); } });
    const walk = document.createTreeWalker;
    document.createTreeWalker = function (...args) { __walks++; return Reflect.apply(walk, this, args); };
  });
  await page.evaluate(() => { __parentReads = 0; document.querySelectorAll('p.design').forEach(el => { el.className = 'target'; }); });
  await page.waitForFunction(() => document.querySelectorAll('p[data-sfs-replaced="1"]').length === 301);
  const parentReads = await page.evaluate(() => __parentReads);
  assert.ok(parentReads < 10000, "兄弟变更的共同祖先路径应只遍历一次");
  await page.evaluate(() => {
    __walks = 0; document.querySelectorAll('p.target').forEach(el => { el.className = 'design'; });
    document.getElementById('middle').style.fontFamily = 'CustomFont';
  });
  await page.waitForFunction(() => !document.querySelector('p[data-sfs-replaced="1"]'));
  const walks = await page.evaluate(() => __walks);
  assert.ok(walks <= 2, "同批父子字体变化只需外层收集与有界缓存清理");
  t.diagnostic(JSON.stringify({ parentReads, walks }));
  await page.close();
});

test("页面配置相同的存储更新保留任务和采样，CSS 新代次正文变化仍生效", async t => {
  for (const customCSSOn of [false, true]) {
    const page = await pageFor('<div id="composer" class="target" contenteditable="true">Start</div><div>' + '<p class="target">Text</p>'.repeat(600) + '</div>', { customCSSOn });
    const metrics = await page.evaluate(async () => {
      __styleReads = __sheetDisables = 0;
      for (let i = 0; i < 10; i++) {
        __settings.siteRules = [{ domain: 'other.example.com', action: i % 2 ? 'force' : 'off' }];
        __settings.customCSSChunks = { id: 'copy-' + i, count: 1 };
        __settings['customCSS#copy-' + i + '/0'] = __settings.customCSS;
        __storageChanged({ siteRules: {}, customCSSChunks: {} }, 'sync');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      return { reads: __styleReads, disables: __sheetDisables };
    });
    assert.deepEqual(metrics, { reads: 0, disables: 0 });
    t.diagnostic(JSON.stringify({ customCSSOn, ...metrics }));
    await page.evaluate(() => {
      composer.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      const el = document.createElement('p'); el.textContent = 'Deferred'; composer.appendChild(el);
      __settings.siteRules = [{ domain: 'other.example.com', action: 'inherit' }]; __storageChanged({ siteRules: {} }, 'sync');
    });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#composer p[data-sfs-replaced="1"]').count(), 0);
    await page.evaluate(() => composer.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    await page.waitForFunction(() => document.querySelector('#composer p[data-sfs-replaced="1"]'));
    await page.evaluate(() => {
      __settings['customCSS#copy-9/0'] = '[data-sfs-replaced="1"]{color:rgb(1,2,3)!important}';
      __storageChanged({ 'customCSS#copy-9/0': {} }, 'sync');
    });
    if (customCSSOn) await page.waitForFunction(() => getComputedStyle(composer).color === 'rgb(1, 2, 3)');
    await page.evaluate(() => {
      __settings.targets = ['CustomFont']; __storageChanged({ targets: {} }, 'sync');
    });
    await page.waitForFunction(() => !document.querySelector('p[data-sfs-replaced="1"]'));
    await page.close();
  }
});

test("同批兄弟共享保护和自动方向查询，移动及自身图标条件仍逐元素判断", async t => {
  const page = await pageFor('<div id="auto" class="target" dir="AUTO">Latin</div><pre id="code" class="target">Code</pre>', {}, () => {
    window.__ancestorQueries = window.__directionChecks = 0;
    const closest = Element.prototype.closest, matches = Element.prototype.matches;
    Element.prototype.closest = function (selector) {
      if (["code, pre, kbd, samp", "svg, img, canvas", '[dir="auto"]'].includes(selector)) __ancestorQueries++;
      return closest.call(this, selector);
    };
    Element.prototype.matches = function (selector) { if (selector === ':dir(rtl)') __directionChecks++; return matches.call(this, selector); };
  });
  await page.evaluate(() => {
    __ancestorQueries = __directionChecks = 0;
    document.getElementById('auto').insertAdjacentHTML('beforeend', '<p class="target">Text</p>'.repeat(300) + '<span class="target icon">Icon</span>');
  });
  await page.waitForFunction(() => document.querySelectorAll('#auto p[data-sfs-replaced="1"]').length === 300);
  const metrics = await page.evaluate(() => ({ ancestors: __ancestorQueries, directions: __directionChecks }));
  assert.ok(metrics.ancestors < 20 && metrics.directions < 10, "同批兄弟应共享祖先与实际方向查询");
  assert.equal(await page.locator('#auto .icon[data-sfs-replaced="1"]').count(), 0);
  t.diagnostic(JSON.stringify(metrics));
  await page.evaluate(() => { document.querySelectorAll('#auto p').forEach(el => document.getElementById('code').appendChild(el)); });
  await page.waitForFunction(() => !document.querySelector('#code [data-sfs-replaced="1"]'));
  await page.evaluate(() => { __settings.protectCode = false; __settings.protectIcons = false; __storageChanged({ protectCode: {}, protectIcons: {} }, 'sync'); });
  await page.waitForFunction(() => document.querySelectorAll('#code p[data-sfs-replaced="1"]').length === 300 && document.querySelector('#auto .icon[data-sfs-replaced="1"]'));
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

test("播放分片中移除大型子树会跳过旧节点，新文字及时处理且重挂后仍重检", async t => {
  const page = await pageFor('<p class="target">Primer</p><video id="video" muted></video><main id="outdated"></main><main id="current" class="design"></main>');
  await page.evaluate(async () => {
    const video = document.getElementById("video"), canvas = document.createElement("canvas");
    canvas.width = canvas.height = 32;
    const stream = canvas.captureStream(30);
    window.__videoStream = stream;
    window.__videoTimer = setInterval(() => canvas.getContext("2d").fillRect(0, 0, 32, 32), 30);
    video.srcObject = stream;
    await video.play();
    document.getElementById("outdated").innerHTML = '<p class="target">Outdated</p>'.repeat(5000);
  });
  await page.waitForFunction(() => document.querySelector('#outdated [data-sfs-replaced="1"]'));
  const markedBefore = await page.locator('#outdated [data-sfs-replaced="1"]').count();
  assert.ok(markedBefore < 5000, "移除发生在播放期间的分片尚未处理完时");
  await page.evaluate(() => {
    window.__detached = document.getElementById("outdated");
    __detached.remove();
    const node = document.createElement("p"); node.id = "fresh"; node.className = "target"; node.textContent = "Fresh";
    document.getElementById("current").appendChild(node);
  });
  await page.waitForFunction(() => document.querySelector('#fresh[data-sfs-replaced="1"]'), null, { timeout: 1500 });
  assert.equal(await page.evaluate(() => __detached.querySelectorAll('[data-sfs-replaced="1"]').length), markedBefore);
  t.diagnostic("5000 个旧节点移除后，播放期间的新文字在 1500 ms 内完成检查");
  await page.evaluate(() => {
    document.getElementById("video").pause(); clearInterval(__videoTimer); __videoStream.getTracks().forEach(track => track.stop());
    __detached.className = "design";
    for (const el of __detached.children) el.className = "";
    document.getElementById("current").appendChild(__detached);
  });
  await page.waitForFunction(() => !document.querySelector('#outdated [data-sfs-replaced="1"]'));
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

test("首次整页扫描包含空输入框、按钮和可编辑区域", async () => {
  for (const customCSSOn of [false, true]) {
    const page = await pageFor('<input class="target"><textarea class="target"></textarea><button class="target"></button><select class="target"></select><div class="target" contenteditable="true"></div>', { customCSSOn });
    assert.equal(await page.locator('[data-sfs-replaced="1"]').count(), 5);
    assert.ok(await page.locator("input").evaluate(el => getComputedStyle(el).fontFamily.includes("serif")));
    await page.close();
  }
});

test("大量字体规则按候选查找，保持标签、ID、转义及复合规则判断", async t => {
  const rules = Array.from({ length: 800 }, (_, i) => '.font-' + i + '{font-family:' + (i % 2 ? 'CustomFont' : 'Arial') + '}').join("");
  const page = await pageFor('<style>' + rules + ' article{font-family:CustomFont} #specific{font-family:CustomFont} .holder > .row{font-family:CustomFont}</style><p class="target">Primer</p><main id="rules"></main>');
  const result = await page.evaluate(async () => {
    let matches = 0;
    const original = Element.prototype.matches;
    Element.prototype.matches = function (...args) { matches++; return Reflect.apply(original, this, args); };
    document.getElementById("rules").innerHTML = Array.from({ length: 1600 }, (_, i) => '<p class="font-' + i % 800 + '">Text</p>').join("") + '<article>Tag</article><p id="specific">ID</p><div class="holder"><p class="row">Child</p></div>';
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    Element.prototype.matches = original;
    return { matches, replaced: document.querySelectorAll('#rules [data-sfs-replaced="1"]').length };
  });
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.replaced, 800);
  assert.ok(result.matches < 10000, "候选匹配应省去 1600 × 800 次完整选择器查询");
  assert.equal(await page.locator("article").getAttribute("data-sfs-replaced"), null);
  await page.close();
});

test("祖先及列表字体规则筛选候选，保留属性、函数与多分支匹配", async t => {
  const rules = Array.from({ length: 800 }, (_, i) => '#rules > .font-' + i + '[data-row],.alternate .alias-' + i + '{font-family:' + (i % 2 ? 'CustomFont' : 'Arial') + '}').join("");
  const page = await pageFor('<style>' + rules + '</style><p class="target">Primer</p><main id="rules"></main><main class="alternate" id="alternate"></main>');
  const result = await page.evaluate(async () => {
    const original = Element.prototype.matches;
    let matches = 0;
    Element.prototype.matches = function(...args) { matches++; return Reflect.apply(original, this, args); };
    try {
      document.getElementById("rules").innerHTML = Array.from({ length: 1600 }, (_, i) => '<p class="font-' + i % 800 + '" data-row>Text</p>').join("");
      document.getElementById("alternate").innerHTML = '<p class="alias-2">Alternate</p><p class="font-3 alias-3" data-row>Both branches</p>';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { matches, replaced: document.querySelectorAll('#rules [data-sfs-replaced="1"]').length };
    } finally { Element.prototype.matches = original; }
  });
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.replaced, 800);
  assert.ok(result.matches < 5000, "祖先及列表规则也应避免逐元素匹配全部 800 条规则");
  assert.equal(await page.locator('#alternate [data-sfs-replaced="1"]').count(), 1);
  await page.locator("#rules").evaluate(el => { el.id = "other"; });
  await page.waitForFunction(() => !document.querySelector('#other [data-sfs-replaced="1"]'));
  await page.close();

  const syntax = await pageFor('<style>#scope > .quoted[data-value="a,b > .other"]{font-family:CustomFont}:is(.fallback,.unused){font-family:CustomFont}.target:is(.functional,.unused){font-family:CustomFont}:not(.excluded,.unused).negative{font-family:CustomFont}.中文 .label{font-family:CustomFont}</style>' +
    '<p class="target">Primer</p><main id="scope"><p class="target quoted" data-value="a,b > .other">Quoted</p></main><p class="target fallback">Fallback</p><p class="target functional">Function</p><p class="target negative">Negation</p><div class="中文"><p class="target label">Unicode</p></div>');
  assert.equal(await syntax.locator('[data-sfs-replaced="1"]').count(), 1);
  await syntax.locator("#scope p").evaluate(el => { el.setAttribute("data-value", "different"); });
  await syntax.waitForFunction(() => document.querySelector('#scope p[data-sfs-replaced="1"]'));
  await syntax.close();
});

test("通用标签和类名之后选择较稀有的条件，函数和属性内部条件保留原义", async t => {
  const rules = Array.from({ length: 800 }, (_, i) => 'p.common.font-' + i + ',.common.alias-' + i + '[data-row]{font-family:' + (i % 2 ? 'CustomFont' : 'Arial') + '}').join("");
  const page = await pageFor('<style>' + rules + ' .common#specific{font-family:CustomFont} p.common:is(.a,.b){font-family:CustomFont} p.common[data-value=".inside #fake"]{font-family:CustomFont} :where(.never).outside{font-family:CustomFont}</style><p class="target">Primer</p><main id="rules"></main>');
  const result = await page.evaluate(async () => {
    const original = Element.prototype.matches;
    let matches = 0;
    Element.prototype.matches = function(...args) { matches++; return Reflect.apply(original, this, args); };
    try {
      document.getElementById("rules").innerHTML = Array.from({ length: 1600 }, (_, i) => i % 2
        ? '<span class="common alias-' + i % 800 + '" data-row>Alias</span>' : '<p class="common font-' + i % 800 + '">Font</p>').join("") +
        '<p class="target common" id="specific">ID</p><p class="target common b" id="function">Function</p><p class="target common" data-value=".inside #fake" id="attribute">Attribute</p><p class="target outside" id="outside">Native</p>';
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { matches, replaced: document.querySelectorAll('#rules [data-sfs-replaced="1"]').length };
    } finally { Element.prototype.matches = original; }
  });
  t.diagnostic(JSON.stringify(result));
  assert.equal(result.replaced, 801);
  assert.ok(result.matches < 6000, "通用标签和类名不应使全部 800 条规则成为候选");
  assert.equal(await page.locator('#specific[data-sfs-replaced], #function[data-sfs-replaced], #attribute[data-sfs-replaced]').count(), 0);
  await page.locator("#function").evaluate(el => { el.classList.replace("b", "c"); });
  await page.waitForFunction(() => document.getElementById("function").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("相同原字体共享连字结果，完整采样仍逐元素判断保护及设置重载", async t => {
  const features = Array.from({ length: 40 }, (_, i) => '"' + (i < 20 ? 'ss' : 'cv') + String(i % 20 + 1).padStart(2, '0') + '" 1').join(',');
  const page = await pageFor('<style>#holder{container-type:inline-size}@container(width>9000px){.features{font-family:CustomFont}}.features{font-family:Arial;font-feature-settings:' + features + '}</style><p class="target">Primer</p><main id="holder"></main>',
    { customCSSOn: false }, () => {
      let shared;
      window.__fontResults = 0;
      Object.defineProperty(globalThis, "SFS", { configurable: true, get() { return shared; }, set(value) {
        const original = value.ligatureDeclarations;
        value.ligatureDeclarations = function(...args) { __fontResults++; return Reflect.apply(original, this, args); };
        shared = value;
      } });
    });
  await page.evaluate(() => {
    __styleReads = __fontResults = 0;
    document.getElementById("holder").innerHTML = '<p class="features">Text</p>'.repeat(400) + '<code class="features">Code</code><span class="features icon">Icon</span>';
  });
  await page.waitForFunction(() => document.querySelectorAll('#holder [data-sfs-replaced="1"]').length === 400);
  const metrics = await page.evaluate(() => ({ reads: __styleReads, derived: __fontResults }));
  t.diagnostic(JSON.stringify(metrics));
  assert.equal(metrics.reads, 402, "容器条件下继续保留每个元素的原样式采样");
  assert.equal(metrics.derived, 1, "相同结果只生成一次完整连字声明");
  assert.equal(await page.locator("code[data-sfs-replaced], .icon[data-sfs-replaced]").count(), 0);
  await page.evaluate(() => { __settings.ligatureLevel = "extended"; __storageChanged({ ligatureLevel: {} }, "sync"); });
  await page.waitForFunction(() => {
    const features = Object.fromEntries([...getComputedStyle(document.querySelector(".features")).fontFeatureSettings.matchAll(/"(.{4})"(?:\s+(\d+))?/g)]
      .map(match => [match[1], Number(match[2] ?? 1)]));
    return features.dlig === 1 && features.cv20 === 1;
  });
  await page.close();
});

test("批量新增 4000 段文字共享一次收集，新增菜单叶子不创建遍历器", async t => {
  const page = await pageFor('<p class="target">Start</p><main id="added"></main>');
  await page.evaluate(() => {
    window.__walks = 0;
    const original = document.createTreeWalker;
    document.createTreeWalker = function (...args) { __walks++; return Reflect.apply(original, this, args); };
    document.getElementById("added").innerHTML = '<p class="target">Text</p>'.repeat(4000);
  });
  await page.waitForFunction(() => document.querySelectorAll('#added [data-sfs-replaced="1"]').length === 4000);
  assert.equal(await page.evaluate(() => __walks), 1);
  await page.evaluate(() => {
    __walks = 0; const menu = document.createElement("div"); menu.id = "menu"; menu.className = "target"; menu.textContent = "Menu"; document.body.appendChild(menu);
  });
  await page.waitForFunction(() => document.getElementById("menu").hasAttribute("data-sfs-replaced"));
  assert.equal(await page.evaluate(() => __walks), 0);
  t.diagnostic("4000 段新增文字：1 次遍历；菜单叶子：0 次遍历");
  await page.close();
});

test("自定义字体属性和控件 type 变化更新字体判断，无关 data 属性不采样", async () => {
  const page = await pageFor('<style>[data-font="design"],input[type="password"]{font-family:CustomFont}</style><p id="text" class="target">Text</p><input id="input" class="target">');
  await page.locator("#text").evaluate(el => el.setAttribute("data-layout", "new"));
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => __styleReads), 0);
  await page.locator("#text").evaluate(el => el.setAttribute("data-font", "design"));
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.locator("#input").evaluate(el => { el.type = "password"; });
  await page.waitForFunction(() => !document.getElementById("input").hasAttribute("data-sfs-replaced"));
  await page.locator("#text").evaluate(el => el.removeAttribute("data-font"));
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("字体媒体条件变化重检，只有布局声明的媒体条件不补扫", async () => {
  const page = await pageFor('<style>@media(max-width:800px){.target{font-family:CustomFont}}@media(max-width:1100px){p{color:red}}</style><p class="target" id="text">Text</p>');
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => __styleReads), 0);
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.evaluate(() => { __settings.enabled = false; __storageChanged({ enabled: {} }, "sync"); });
  await page.waitForFunction(() => !document.getElementById("sfs-style"));
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForTimeout(80);
  assert.equal(await page.locator('[data-sfs-replaced="1"]').count(), 0);
  await page.close();
});

test("关系选择器的新增、移除与兄弟属性变化重新检查已有文字", async () => {
  const page = await pageFor('<style>#holder:has(.alternate) .target,.switch + .target,.target:first-child{font-family:CustomFont}</style><div id="holder"><span id="toggle"></span><p id="text" class="target">Text</p></div>');
  await page.locator("#holder").evaluate(el => { const child = document.createElement("b"); child.className = "alternate"; child.id = "alternate"; el.appendChild(child); });
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.locator("#alternate").evaluate(el => el.remove());
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.locator("#toggle").evaluate(el => { el.className = "switch"; });
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.locator("#toggle").evaluate(el => el.remove());
  await page.waitForTimeout(80);
  assert.equal(await page.locator("#text").getAttribute("data-sfs-replaced"), null);
  await page.close();
});

test("视口变化后的容器字体条件重检，禁用时取消补扫", async () => {
  const page = await pageFor('<style>#host{container-type:inline-size;width:80vw}@container(width<700px){.target{font-family:CustomFont}}</style><main id="host"><p id="text" class="target">Text</p></main>');
  await page.setViewportSize({ width: 700, height: 800 });
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
  await page.setViewportSize({ width: 700, height: 800 });
  await page.evaluate(() => { __settings.enabled = false; __storageChanged({ enabled: {} }, "sync"); });
  await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-sfs-replaced="1"]').count(), 0);
  await page.close();
});

test("怪异模式保留类名和 ID 的浏览器匹配语义", async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.chrome = { storage: { sync: { get: async () => ({ targets: ["Arial"], replacement: "serif", customCSSOn: false }) }, onChanged: { addListener() {} } } };
  });
  const route = "/quirks-" + fixtures.size;
  fixtures.set(route, '<html><head><style>.TARGET{font-family:Arial}#SPECIAL{font-family:Arial}</style></head><body><p id="first" class="target">Class</p><p id="special">ID</p><p id="native">Native</p><script src="/shared.js"></script><script src="/content.js"></script></body></html>');
  await page.goto(origin + route);
  assert.equal(await page.evaluate(() => document.compatMode), "BackCompat");
  await page.waitForFunction(() => document.querySelectorAll('[data-sfs-replaced="1"]').length === 2);
  await page.close();
});

test("关系字体规则下已有非空文字更新仍复用采样", async () => {
  const page = await pageFor('<style>.row:nth-child(2){font-family:CustomFont}</style><main><p class="target">Start</p><p class="target">Design</p><p id="text" class="target">Text</p></main>');
  await page.evaluate(async () => {
    __styleReads = __sheetDisables = 0;
    for (let i = 0; i < 10; i++) { document.getElementById("text").textContent += " word"; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }
  });
  assert.equal(await page.evaluate(() => __styleReads), 0);
  await page.close();
});

test("深层继承和超过缓存容量的字体来源仍保持移动与重检正确", async () => {
  const page = await pageFor('<p class="target">Primer</p><main id="deep" class="target"></main><main id="sources"></main><main id="design" class="design"></main>', { ligatureLevel: "native" });
  await page.evaluate(() => {
    let parent = document.getElementById("deep");
    for (let i = 0; i < 250; i++) { const node = document.createElement("div"); node.textContent = "Depth"; parent.appendChild(node); parent = node; }
    document.getElementById("sources").innerHTML = Array.from({ length: 4200 }, (_, i) => '<p class="target" style="font-feature-settings:&quot;ss01&quot; ' + i + '">Text</p>').join("");
  });
  await page.waitForFunction(() => document.querySelectorAll('#sources [data-sfs-replaced="1"]').length === 4200);
  assert.equal(await page.locator('#deep [data-sfs-replaced="1"]').count(), 250);
  await page.evaluate(() => { const first = document.getElementById("deep").firstElementChild; document.getElementById("design").appendChild(first); });
  await page.waitForFunction(() => !document.querySelector('#design [data-sfs-replaced="1"]'));
  await page.locator("#sources p").first().evaluate(el => { el.className = "design"; });
  await page.waitForFunction(() => !document.querySelector("#sources p").hasAttribute("data-sfs-replaced"));
  await page.close();
});

test("多层与循环字体变量依赖完成分析，布局变量继续过滤", async () => {
  const page = await pageFor('<style>:root{--a:var(--b);--b:var(--c);--c:Arial;--loop1:var(--loop2);--loop2:var(--loop1)}.variable{font-family:var(--a)}.loop{font-family:var(--loop1,Arial)}</style><p id="text" class="variable">Variable</p><p class="loop">Cycle</p>');
  await page.evaluate(() => document.documentElement.style.setProperty("--layout", "10px"));
  await page.waitForTimeout(80);
  assert.equal(await page.evaluate(() => __styleReads), 0);
  await page.evaluate(() => document.documentElement.style.setProperty("--c", "CustomFont"));
  await page.waitForFunction(() => !document.getElementById("text").hasAttribute("data-sfs-replaced"));
  assert.equal(await page.locator('.loop[data-sfs-replaced="1"]').count(), 1);
  await page.close();
});

test("真实 MV3 完成 40 张跨域 CSS 读取，子框架和延后字体规则仍生效", async t => {
  let requests = 0;
  const remote = http.createServer((request, response) => {
    requests++;
    setTimeout(() => { response.setHeader("Content-Type", "text/css"); response.end('.remote-' + request.url.match(/\d+/)[0] + '{font-family:CustomFont}'); }, 20);
  });
  await new Promise(resolve => remote.listen(0, "127.0.0.1", resolve));
  let context;
  try {
    context = await chromium.launchPersistentContext("", { headless: true, executablePath: chromium.executablePath(),
      args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    await worker.evaluate(() => chrome.storage.sync.set({ enabled: false, targets: ["Arial"], replacement: "serif", customCSSOn: false }));
    fixtures.set("/child-frame", '<!doctype html><style>.target{font-family:Arial}</style><p class="target" id="child">Child</p><input class="target" placeholder="Empty">');
    fixtures.set("/many-cross", '<!doctype html><head><style>.target{font-family:Arial}</style>' + Array.from({ length: 40 }, (_, i) => '<link rel="stylesheet" href="http://127.0.0.1:' + remote.address().port + '/sheet-' + i + '.css">').join("") + '</head><body><main id="shell"><p class="target" id="text">Main</p></main><iframe src="/child-frame"></iframe></body>');
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page), worlds = [];
    cdp.on("Runtime.executionContextCreated", event => worlds.push(event.context));
    await cdp.send("Runtime.enable");
    await page.goto(origin + "/many-cross");
    assert.equal(requests, 40);
    await worker.evaluate(() => chrome.storage.sync.set({ enabled: true }));
    await page.waitForFunction(() => document.getElementById("text").hasAttribute("data-sfs-replaced"));
    const frame = page.frames().find(frame => frame.url().endsWith("/child-frame"));
    await frame.waitForFunction(() => document.getElementById("child").hasAttribute("data-sfs-replaced"));
    assert.equal(await frame.locator('input[data-sfs-replaced="1"]').count(), 1);
    const deadline = Date.now() + 5000;
    while (requests < 80 && Date.now() < deadline) await page.waitForTimeout(25);
    assert.equal(requests, 80, "每张 CSS 都应完成后台读取");
    await page.waitForTimeout(300);
    const world = worlds.find(world => world.origin.startsWith("chrome-extension://") && world.auxData?.isDefault === false && world.auxData?.frameId === worlds.find(world => world.auxData?.isDefault)?.auxData?.frameId);
    assert.ok(world);
    await cdp.send("Runtime.evaluate", { contextId: world.id, expression: 'window.__reads=0; const original=window.getComputedStyle; window.getComputedStyle=function(...args){__reads++;return Reflect.apply(original,this,args)}' });
    await page.evaluate(async () => { for (let i = 0; i < 8; i++) { document.getElementById("shell").className = "layout-" + i; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); } });
    const result = await cdp.send("Runtime.evaluate", { contextId: world.id, expression: "__reads", returnByValue: true });
    assert.equal(result.result.value, 0);
    await frame.evaluate(() => { const style = document.createElement("style"); style.textContent = '.target{font-family:CustomFont}'; document.head.appendChild(style); });
    await frame.waitForFunction(() => !document.getElementById("child").hasAttribute("data-sfs-replaced"));
    t.diagnostic("40 张 CSS 完整读取；主页面无关交互 0 次采样；子框架动态字体规则完成重检");
  } finally { await context?.close(); await new Promise(resolve => remote.close(resolve)); }
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
