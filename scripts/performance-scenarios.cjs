const assert = require("node:assert/strict");
const rows = (count, css = "target") => Array.from({ length: count }, (_, i) => `<p class="${css}">文字 Text ${i}</p>`).join("");
const frames = page => page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => requestAnimationFrame(resolve)); });
const marked = async (page, selector, count, active = true) => {
  if (active) assert.equal(await page.locator(selector + '[data-sfs-replaced="1"]').count(), count);
};
const ready = count => page => page.waitForFunction(count => __disabledRun || document.querySelectorAll('[data-sfs-replaced="1"]').length >= count, count);
const base = '<p class="target" id="primer">Start</p>';
const scenarios = [
  { id: "cold-wide-text", label: "首次加载 6000 段文字", cold: true, body: '<main id="wide">' + rows(6000) + '</main>', ready: ready(6000), check: (p, a) => marked(p, "#wide p", 6000, a) },
  { id: "cold-long-text", label: "首次加载 200 段合计百万字符长文本", cold: true, head: '<style>#long{max-height:400px;overflow:auto}</style>',
    body: '<main id="long">' + ('<p class="target">' + '文字 Text '.repeat(625) + '</p>').repeat(200) + '</main>', ready: ready(200), check: (p, a) => marked(p, "#long p", 200, a) },
  { id: "cold-wide", label: "首次加载 6000 段文字及空控件", cold: true, body: '<main id="wide">' + rows(6000) + '<input class="target">'.repeat(100) + '</main>', ready: ready(6000), check: (p, a) => marked(p, "#wide p", 6000, a) },
  { id: "cold-deep", label: "首次加载 250 层继承路径", cold: true, body: '<main id="deep" class="target"></main>', setup: function () {
    let parent = document.getElementById("deep");
    for (let i = 0; i < 250; i++) { const el = document.createElement("div"); el.textContent = "Depth " + i; parent.appendChild(el); parent = el; }
  }, ready: ready(250), check: (p, a) => marked(p, "#deep div", 250, a) },
  { id: "cold-rules", label: "800 条字体规则和 1600 个元素", cold: true, head: '<style>' + Array.from({ length: 800 }, (_, i) => `.font-${i}{font-family:${i % 2 ? "CustomFont" : "Arial"}}`).join("") + '</style>',
    body: '<main id="rules">' + Array.from({ length: 1600 }, (_, i) => `<p class="font-${i % 800}">Rule ${i}</p>`).join("") + '</main>', ready: ready(800), check: (p, a) => marked(p, "#rules p", 800, a) },
  { id: "cold-compound-rules", label: "800 条祖先及列表字体规则和 1600 个元素", cold: true,
    head: '<style>' + Array.from({ length: 800 }, (_, i) => `#rules > .font-${i}[data-row],.alternate .alias-${i}{font-family:${i % 2 ? "CustomFont" : "Arial"}}`).join("") + '</style>',
    body: '<main id="rules">' + Array.from({ length: 1600 }, (_, i) => `<p class="font-${i % 800}" data-row>Rule ${i}</p>`).join("") + '</main>', ready: ready(800), check: (p, a) => marked(p, "#rules p", 800, a) },
  { id: "cold-common-prefix", label: "800 条通用标签/类名前缀字体规则", cold: true,
    head: '<style>' + Array.from({ length: 800 }, (_, i) => `p.common.font-${i},.common.alias-${i}[data-row]{font-family:${i % 2 ? "CustomFont" : "Arial"}}`).join("") + '</style>',
    body: '<main id="rules">' + Array.from({ length: 1600 }, (_, i) => `<p class="common font-${i % 800}">Rule ${i}</p>`).join("") + '</main>', ready: ready(800), check: (p, a) => marked(p, "#rules p", 800, a) },
  { id: "cold-features", label: "6000 个元素共享 40 项 OpenType 特性", cold: true,
    head: '<style>.features{font-family:Arial;font-feature-settings:' + Array.from({ length: 40 }, (_, i) => `"${i < 20 ? 'ss' : 'cv'}${String(i % 20 + 1).padStart(2, '0')}" 1`).join(',') + '}</style>',
    body: '<main id="features">' + rows(6000, "features") + '</main>', ready: ready(6000), check: (p, a) => marked(p, "#features p", 6000, a) },
  { id: "cold-variables", label: "1000 条布局规则及 24 层字体变量依赖", cold: true, head: '<style>:root{' + Array.from({ length: 24 }, (_, i) => `--font-${i}:${i === 23 ? "Arial" : `var(--font-${i + 1})`};`).join("") + '}.variable{font-family:var(--font-0)}' + Array.from({ length: 1000 }, (_, i) => `.layout-${i}{color:var(--color-${i});--color-${i}:black}`).join("") + '</style>',
    body: '<main id="variables">' + rows(1000, "variable") + '</main>', ready: ready(1000), check: (p, a) => marked(p, "#variables p", 1000, a) },
  { id: "cold-static-selectors", label: "6000 个元素的属性运算符、引号内容与转义标点", cold: true,
    head: '<style>.token[data-font~="normal"]{font-family:Arial}.quoted[data-label=".phantom #ghost :hover [class] [style] + ~"]{font-family:Arial}.font\\:hover\\+wide{font-family:Arial}</style>',
    body: '<main id="static">' + '<p class="token" data-font="normal other">Token</p>'.repeat(2000) + '<p class="quoted" data-label=".phantom #ghost :hover [class] [style] + ~">Quoted</p>'.repeat(2000) + '<p class="font:hover+wide">Escaped</p>'.repeat(2000) + '</main>',
    ready: ready(6000), check: (p, a) => marked(p, "#static p", 6000, a) },
  { id: "nontext", label: "新增 4000 个无文字布局节点", body: base + '<main id="added"></main>', ready: ready(1), action: page => page.evaluate(() => { added.innerHTML = '<div><span></span></div>'.repeat(4000); }), check: (p, a) => marked(p, "#primer", 1, a) },
  { id: "layout", label: "大型页面无关类名、属性与布局样式", body: '<main id="shell">' + rows(2500) + '</main><textarea id="editor" class="target"></textarea>', ready: ready(2500), async action(page) {
    await page.evaluate(async () => { for (let i = 0; i < 30; i++) {
      shell.className = "layout hover-" + i; shell.setAttribute("data-layout", i); editor.style.height = (30 + i) + "px";
      document.documentElement.style.setProperty("--layout-height", i + "px"); await new Promise(resolve => requestAnimationFrame(resolve));
    } });
  } },
  { id: "text", label: "字符更新与整段文字节点替换", body: '<main>' + rows(2500) + '</main><p id="stream" class="target">Start</p>', ready: ready(2501), action: page => page.evaluate(async () => {
    for (let i = 0; i < 40; i++) { if (i % 2) stream.firstChild.data += " text"; else stream.textContent += " text"; await new Promise(resolve => requestAnimationFrame(resolve)); }
  }), check: (p, a) => marked(p, "#stream", 1, a) },
  { id: "layout-inline", label: "300 个布局节点的 3600 次内联位置、尺寸与透明度更新", body: base + '<main id="layout">' + '<div style="height:10px;position:absolute;left:0;opacity:0.8"></div>'.repeat(300) + '</main>', ready: ready(1), action: page => page.evaluate(async () => {
    const nodes = [...document.getElementById("layout").children];
    for (let round = 0; round < 12; round++) {
      nodes.forEach((el, i) => { el.style.height = (round + 20) + "px"; el.style.left = (i % 20 + round) + "px"; el.style.opacity = round % 2 ? "0.8" : "0.9"; });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  }), check: (p, a) => marked(p, "#primer", 1, a) },
  { id: "static-selector-menus", label: "2500 段历史文字、静态属性字体条件及 40 次菜单创建", head: '<style>.token[data-font~="normal"]{font-family:Arial}</style>',
    body: rows(2500) + '<p class="token" data-font="normal">Primer</p><main id="menus"></main>', ready: ready(2501), action: page => page.evaluate(async () => {
      for (let i = 0; i < 40; i++) {
        const el = document.createElement("p"); el.className = "token"; el.setAttribute("data-font", "normal other"); el.textContent = "Menu";
        document.getElementById("menus").appendChild(el);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        el.remove();
      }
    }), check: (p, a) => marked(p, ".token", 1, a) },
  { id: "long-text-burst", label: "百万字符文本的 800 次同批写入/节点替换", body: base + '<p id="stream" class="target">Start</p>', ready: ready(2), action: page => page.evaluate(async () => {
    const tail = ' '.repeat(1000000), values = ['文字 A' + tail, '文字 B' + tail];
    for (let round = 0; round < 4; round++) {
      for (let i = 0; i < 200; i++) { if (round % 2) stream.textContent = values[i % 2]; else stream.firstChild.data = values[i % 2]; }
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    if (stream.textContent !== values[1]) throw Error('长文本内容发生变化');
  }), check: (p, a) => marked(p, '#stream', 1, a) },
  { id: "text-states", label: "空白/非空文本与关系字体状态切换", head: '<style>#holder:has(#text:empty) #sibling{font-family:CustomFont}</style>',
    body: base + '<div id="holder"><span id="text" class="target"></span><p id="sibling" class="target">Sibling</p></div>', ready: ready(1), async action(page) {
      for (const text of [' ', 'Text', '', '\u3000\ufeff', 'Text']) {
        await page.evaluate(text => { const el = document.getElementById('text'); for (let i = 0; i < 100; i++) el.textContent = i % 2 ? text : 'Interim'; }, text);
        await page.waitForFunction(populated => __disabledRun || document.getElementById('sibling').hasAttribute('data-sfs-replaced') === populated, !!text);
      }
    }, async check(page, active) { if (active) { await marked(page, '#text', 1); await marked(page, '#sibling', 1); } } },
  { id: "auto-direction", label: "自动方向富文本及 textarea 值变化", head: '<style>.auto:dir(rtl){font-family:CustomFont}</style>',
    body: base + '<div id="auto" class="target auto" dir="auto">Latin</div><textarea id="area" class="target auto" dir="auto">Latin</textarea>', ready: ready(3), async action(page) {
      for (const text of ['مرحبا', 'Latin', 'مرحبا', 'Latin']) {
        await page.evaluate(text => {
          const auto = document.getElementById('auto'), area = document.getElementById('area');
          for (let i = 0; i < 100; i++) auto.firstChild.data = i % 2 ? text : 'Interim';
          area.value = text; area.dispatchEvent(new InputEvent('input', { bubbles: true }));
        }, text);
        await page.waitForFunction(latin => __disabledRun || ['auto', 'area'].every(id => document.getElementById(id).hasAttribute('data-sfs-replaced') === latin), text === 'Latin');
      }
    }, async check(page, active) { if (active) { await marked(page, '#auto', 1); await marked(page, '#area', 1); } } },
  { id: "composition", label: "组词事件、新段落及失焦恢复", body: base + '<div id="composer" class="target" contenteditable="true">Start</div>', ready: ready(2), async action(page) {
      await page.evaluate(() => {
        composer.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        for (let i = 0; i < 200; i++) {
          const p = document.createElement('p'); p.textContent = '组词 ' + i; composer.appendChild(p);
          composer.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
        }
      });
      await frames(page);
      assert.equal(await page.locator('#composer p[data-sfs-replaced="1"]').count(), 0);
      await page.evaluate(() => composer.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
      await page.waitForFunction(() => __disabledRun || document.querySelectorAll('#composer p[data-sfs-replaced="1"]').length === 200);
      await page.evaluate(() => {
        composer.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })); composer.style.fontFamily = 'CustomFont';
        window.dispatchEvent(new Event('blur'));
      });
    }, async check(page, active) { if (active) assert.equal(await page.locator('#composer [data-sfs-replaced="1"]').count(), 0); } },
  { id: "menus", label: "重复菜单创建与销毁", body: base + '<div class="target popup">Primer</div>', ready: ready(2), action: page => page.evaluate(async () => {
    for (let i = 0; i < 20; i++) { const el = document.createElement("div"); el.className = "target popup"; el.textContent = "Menu"; document.body.appendChild(el);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); el.remove(); }
  }) },
  { id: "branch-cache", label: "小分支字体切换及 100 层主分支菜单更新", head: '<style>' + Array.from({ length: 500 }, (_, i) => `:is(.unused-${i},.other-${i}){font-family:CustomFont}`).join('') + '</style>',
    body: '<main id="deep" class="target">' + '<div>'.repeat(100) + '<p>Primer</p>' + '</div>'.repeat(100) + '</main><section id="small" class="target"><span>Small</span></section>', ready: ready(2),
    action: page => page.evaluate(async () => {
      const small = document.getElementById("small"), parent = document.querySelector("#deep p").parentElement;
      for (let i = 0; i < 12; i++) {
        small.style.fontFamily = i % 2 ? "CustomFont" : "Arial";
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const menu = document.createElement("p"); menu.textContent = "Menu"; parent.appendChild(menu);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!__disabledRun && !menu.hasAttribute("data-sfs-replaced")) throw Error("主分支菜单未替换");
        menu.remove();
      }
    }), async check(page, active) { if (active) { assert.equal(await page.locator('#small [data-sfs-replaced="1"]').count(), 0); assert.equal(await page.locator('#deep p[data-sfs-replaced="1"]').count(), 1); } } },
  { id: "insert-wide", label: "批量插入 4000 个元素", body: base + '<main id="added"></main>', ready: ready(1), action: page => page.evaluate(html => { added.innerHTML = html; }, rows(4000)), check: (p, a) => marked(p, "#added p", 4000, a) },
  { id: "move", label: "已有 400 个节点跨父级移动", body: base + '<div id="source" class="target">' + rows(400, "row") + '</div><div id="destination" class="design"></div>', ready: ready(401), action: page => page.evaluate(() => { while (source.firstChild) destination.appendChild(source.firstChild); }),
    async check(page, active) { if (active) assert.equal(await page.locator('#destination [data-sfs-replaced="1"]').count(), 0); } },
  { id: "font-attributes", label: "128 个独立字体属性变更", body: base + '<main id="fonts">' + rows(128, "design") + '</main>', ready: ready(1), action: page => page.evaluate(() => { for (const el of fonts.children) el.className = "target"; }), check: (p, a) => marked(p, "#fonts p", 128, a) },
  { id: "deep-incremental", label: "500 层共同祖先下 300 个兄弟字体切换", body: '<main class="target">' + '<div>'.repeat(500) + '<p>Primer</p><section id="fonts">' + rows(300, 'design') + '</section>' + '</div>'.repeat(500) + '</main>', ready: ready(1), async action(page) {
    for (const css of ['target', 'design', 'target', 'design']) {
      await page.evaluate(css => { document.getElementById('fonts').querySelectorAll('p').forEach(el => { el.className = css; }); }, css);
      await page.waitForFunction(target => __disabledRun || document.querySelectorAll('#fonts p[data-sfs-replaced="1"]').length === (target ? 300 : 0), css === 'target');
    }
  }, async check(page, active) { if (active) assert.equal(await page.locator('#fonts [data-sfs-replaced="1"]').count(), 0); } },
  { id: "inline-unique", label: "128 个不同内联 OpenType 特性", body: base + '<main id="fonts">' + rows(128) + '</main>', ready: ready(129), action: page => page.evaluate(() => { [...fonts.children].forEach((el, i) => { el.style.fontFeatureSettings = '"ss01" ' + i; }); }), check: (p, a) => marked(p, "#fonts p", 128, a) },
  { id: "stylesheet", label: "整页字体样式更新", head: '<style id="dynamic"></style>', body: '<main id="sheet">' + rows(3000) + '</main>', ready: ready(3000), action: page => page.evaluate(() => { dynamic.textContent = ".target{font-family:CustomFont}"; }),
    async check(page, active) { if (active) assert.equal(await page.locator('#sheet [data-sfs-replaced="1"]').count(), 0); } },
  { id: "protected", label: "新增 3000 个代码和 SVG 文本节点", body: base + '<main id="protected"></main>', ready: ready(1), action: page => page.evaluate(() => { document.getElementById("protected").innerHTML = '<pre>' + '<span class="target">Code</span>'.repeat(2000) + '</pre><svg>' + '<text>Icon</text>'.repeat(1000) + '</svg>'; }),
    async check(page, active) { if (active) assert.equal(await page.locator('#protected [data-sfs-replaced="1"]').count(), 0); } },
  { id: "complex", label: "无法缓存的状态字体与无关布局更新", head: '<style>.target:hover{font-family:CustomFont}#shell{container-type:inline-size}@container(width>2000px){.target{font-family:CustomFont}}</style>', body: '<main id="shell">' + rows(800) + '</main>', ready: ready(800), action: page => page.evaluate(async () => {
    for (let i = 0; i < 8; i++) { shell.style.width = (400 + i) + "px"; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); }
  }) },
  { id: "font-media", label: "字体媒体条件随视口来回切换", head: '<style>@media(max-width:700px){.target{font-family:CustomFont}}</style>', body: rows(600), ready: ready(600), async action(page) {
    for (const width of [640, 1400, 600, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForFunction(wide => __disabledRun || document.querySelectorAll('p[data-sfs-replaced="1"]').length === (wide ? 600 : 0), width > 700);
    }
  }, check: (p, a) => marked(p, 'p', 600, a) },
  { id: "input", label: "真实富文本输入与新段落", body: base + '<div id="composer" class="target" contenteditable="true">Start</div>', ready: ready(2), async action(page) {
    await page.locator("#composer").focus(); for (let i = 0; i < 12; i++) { await page.keyboard.press("End"); await page.keyboard.press("Enter"); await page.keyboard.type("文字abc", { delay: 10 }); }
    await page.locator("#composer").blur();
  }, async check(page, active) { if (active) assert.ok(await page.locator('#composer [data-sfs-replaced="1"]').count() >= 12); } },
  { id: "selection", label: "真实鼠标跨段拖选与字体属性更新", body: '<div id="composer" contenteditable="true" class="target">' + rows(20, "row") + '</div>', ready: ready(20), async action(page) {
    await page.evaluate(() => { document.addEventListener("selectionchange", () => { if (!getSelection().isCollapsed) composer.style.fontFamily = "CustomFont"; }); });
    const box = await page.locator("#composer p").first().boundingBox();
    await page.mouse.move(box.x + 1, box.y + 8); await page.mouse.down();
    try { for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 100, box.y + i * 10); assert.ok(await page.evaluate(() => getSelection().toString().length) > 5); }
    finally { await page.mouse.up(); }
  }, async check(page, active) { if (active) assert.equal(await page.locator('#composer [data-sfs-replaced="1"]').count(), 0); } },
  { id: "video", label: "原生播放、400 个控件与持续新弹幕", head: '<style>#player{container-type:inline-size}@container(width>9000px){.target{font-family:CustomFont}}</style>', body: '<main id="player"><video muted></video>' + rows(400) + '<div id="danmaku"></div></main>', ready: ready(400), async action(page) {
    await page.evaluate(async () => { const video = document.querySelector("video"), canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
      const stream = canvas.captureStream(30), timer = setInterval(() => canvas.getContext("2d").fillRect(0, 0, 32, 32), 30); video.srcObject = stream; await video.play();
      for (let i = 0; i < 30; i++) { player.style.width = (400 + i) + "px"; const el = document.createElement("p"); el.className = "target"; el.textContent = "Danmaku"; danmaku.appendChild(el); await new Promise(resolve => requestAnimationFrame(resolve)); }
      video.pause(); clearInterval(timer); stream.getTracks().forEach(track => track.stop());
    });
  }, check: (p, a) => marked(p, "#danmaku p", 30, a) },
  { id: "video-detached", label: "播放扫描中移除 512 个旧节点并新增文字", body: base + '<video muted></video><main id="obsolete"></main><main id="fresh"></main>', ready: ready(1), async action(page) {
    await page.evaluate(async () => {
      const video = document.querySelector("video"), canvas = document.createElement("canvas"); canvas.width = canvas.height = 32;
      window.__mediaStream = canvas.captureStream(30);
      window.__mediaTimer = setInterval(() => canvas.getContext("2d").fillRect(0, 0, 32, 32), 30);
      video.srcObject = __mediaStream; await video.play();
      document.getElementById("obsolete").innerHTML = '<p class="target">Old</p>'.repeat(512);
    });
    try {
      if (await page.evaluate(() => __disabledRun)) await page.waitForTimeout(400);
      else await page.waitForFunction(() => document.querySelector('#obsolete [data-sfs-replaced="1"]'));
      await page.evaluate(() => { document.getElementById("obsolete").remove(); document.getElementById("fresh").innerHTML = '<p class="target">Fresh</p>'; });
      await page.waitForFunction(() => __disabledRun || document.querySelector('#fresh p[data-sfs-replaced="1"]'));
    } finally {
      await page.evaluate(() => { document.querySelector("video").pause(); clearInterval(__mediaTimer); __mediaStream.getTracks().forEach(track => track.stop()); });
    }
  }, check: (p, a) => marked(p, "#fresh p", 1, a) },
  { id: "site-states", label: "站点强制/关闭/继承及保护、连字切换", body: rows(500) + rows(500, 'design') + '<pre class="target">Code</pre><span class="target icon">Icon</span>', ready: ready(500), async action(page) {
    for (const [action, protect, level, count] of [['force', false, 'none', 1002], ['off', true, 'native', 0], ['force', true, 'extended', 1000], ['inherit', true, 'standard', 500]]) {
      await page.evaluate(({ action, protect, level }) => {
        if (__disabledRun) return;
        __settings.siteRules = [{ domain: location.hostname, action }]; __settings.protectCode = __settings.protectIcons = protect;
        __settings.ligatureLevel = level; __storageChanged({ siteRules: {}, protectCode: {}, protectIcons: {}, ligatureLevel: {} }, 'sync');
      }, { action, protect, level });
      await page.waitForFunction(count => __disabledRun || document.querySelectorAll('[data-sfs-replaced="1"]').length === count, count);
    }
  }, async check(page, active) { if (active) assert.equal(await page.locator('[data-sfs-replaced="1"]').count(), 500); } },
  { id: "force-native", label: "强制站点、原生连字、关闭图标保护及 2000 个新元素", head: '<style>@container(width>9000px){p{font-family:CustomFont}}</style>',
    body: base + '<main id="forced"></main>', setup: function () {
      __settings.siteRules = [{ domain: location.hostname, action: "force" }]; __settings.protectIcons = false; __settings.ligatureLevel = "native";
    }, ready: ready(1), action: page => page.evaluate(html => { document.getElementById("forced").innerHTML = html + '<pre><span class="target">Code</span></pre><svg><text>SVG</text></svg>'; }, rows(2000)),
    async check(page, active) { if (active) { await marked(page, "#forced p", 2000); assert.equal(await page.locator('#forced pre [data-sfs-replaced],#forced svg [data-sfs-replaced]').count(), 0); } } },
  { id: "unchanged-settings", label: "6000 段文字、其他站点规则及相同 CSS 新分块", body: rows(6000), ready: ready(6000), async action(page) {
    await page.evaluate(async () => {
      if (__disabledRun) return;
      for (let i = 0; i < 8; i++) {
        __settings.siteRules = [{ domain: 'other.example.com', action: i % 2 ? 'force' : 'off' }];
        __settings.customCSSChunks = { id: 'copy-' + i, count: 1 };
        __settings['customCSS#copy-' + i + '/0'] = __settings.customCSS;
        __storageChanged({ siteRules: {}, customCSSChunks: {} }, 'sync');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    });
  }, check: (p, a) => marked(p, 'p', 6000, a) },
  { id: "reload", label: "大型页面禁用、重启和设置重载", body: '<main id="reload">' + rows(3000) + '</main>', ready: ready(3000), async action(page) {
    await page.evaluate(() => { if (!__disabledRun) { __settings.enabled = false; __storageChanged({ enabled: {} }, "sync"); } }); await frames(page);
    assert.equal(await page.locator('[data-sfs-replaced="1"]').count(), 0);
    await page.evaluate(() => { if (!__disabledRun) { __settings.enabled = true; __storageChanged({ enabled: {} }, "sync"); } });
  }, check: (p, a) => marked(p, "#reload p", 3000, a) }
];
module.exports = { scenarios };
