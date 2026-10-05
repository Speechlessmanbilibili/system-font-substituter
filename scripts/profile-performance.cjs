// 在同一模拟对话页面上比较指定 Git 版本与工作区的内容脚本。
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const ref = process.argv[2] || "HEAD";
const original = spawnSync("git", ["show", ref + ":content.js"], { cwd: root, encoding: "utf8" });
if (original.status !== 0) throw Error(original.stderr);
const scripts = {
  "/before.js": original.stdout,
  "/after.js": fs.readFileSync(path.join(root, "content.js"), "utf8"),
  "/shared.js": fs.readFileSync(path.join(root, "shared.js"), "utf8")
};
const history = Array.from({ length: 2500 }, (_, i) => '<p class="target">History ' + i + '</p>').join("");
const branches = Array.from({ length: 64 }, (_, i) => '<p id="branch-' + i + '" class="design">Branch <span>A</span><span>B</span><span>C</span></p>').join("");
const server = http.createServer((request, response) => {
  if (scripts[request.url]) {
    response.setHeader("Content-Type", "text/javascript");
    response.end(scripts[request.url]);
  } else {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const script = request.url === "/before" ? "before" : "after";
    response.end('<!doctype html><html><head><style>.target{font-family:Arial}.design{font-family:CustomFont}</style></head><body><main id="history">' + history + '</main><div class="target">Menu primer</div><textarea id="editor" class="target"></textarea><p id="stream" class="target">Answer</p>' + branches + '<script src="/shared.js"></script><script src="/' + script + '.js"></script></body></html>');
  }
});

async function measure(browser, origin, version, customCSSOn) {
  const page = await browser.newPage();
  await page.addInitScript(({ customCSSOn, customCSS }) => {
    window.__reads = window.__disables = 0;
    const original = window.getComputedStyle;
    window.getComputedStyle = function (...args) { __reads++; return Reflect.apply(original, this, args); };
    const disabled = Object.getOwnPropertyDescriptor(StyleSheet.prototype, "disabled");
    Object.defineProperty(StyleSheet.prototype, "disabled", { ...disabled, set(value) {
      if (value && ["sfs-style", "sfs-custom-style"].includes(this.ownerNode?.id)) __disables++;
      disabled.set.call(this, value);
    } });
    window.chrome = { storage: {
      sync: { get: async () => ({ targets: ["Arial"], replacement: "serif", ligatureLevel: "standard", customCSSOn, customCSS }) },
      onChanged: { addListener() {} }
    } };
    window.__longTasks = [];
    new PerformanceObserver(list => __longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: "longtask" });
  }, { customCSSOn, customCSS: fs.readFileSync(path.join(root, "apple-ui-mix.css"), "utf8") });
  await page.goto(origin + "/" + version);
  await page.waitForFunction(() => document.getElementById("stream").hasAttribute("data-sfs-replaced"));
  await page.evaluate(async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => requestAnimationFrame(resolve)); });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  async function snapshot() {
    return Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(item => [item.name, item.value]));
  }
  async function scenario(action) {
    await page.evaluate(() => { __reads = __disables = 0; __longTasks.length = 0; });
    const start = await snapshot();
    await action();
    const end = await snapshot();
    const counters = await page.evaluate(() => ({ styleReads: __reads, sheetDisables: __disables,
      longTasks: __longTasks.length, longestTaskMs: Math.round(Math.max(0, ...__longTasks)) }));
    return { ...counters, styleRecalculations: end.RecalcStyleCount - start.RecalcStyleCount,
      styleRecalculationMs: Math.round((end.RecalcStyleDuration - start.RecalcStyleDuration) * 1000),
      scriptMs: Math.round((end.ScriptDuration - start.ScriptDuration) * 1000) };
  }
  const streaming = await scenario(() => page.evaluate(async () => {
    const parent = document.getElementById("stream");
    for (let i = 0; i < 40; i++) {
      if (i < 20) parent.firstChild.data += " token";
      else parent.textContent += " token";
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
  }));
  const branches = await scenario(async () => {
    await page.evaluate(() => {
      for (let i = 0; i < 64; i++) document.getElementById("branch-" + i).className = "target";
    });
    await page.waitForFunction(() => document.querySelectorAll('[id^="branch-"][data-sfs-replaced]').length === 64);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  });
  const interaction = await scenario(() => page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      document.getElementById("history").className = "layout hovered-" + i;
      document.getElementById("editor").style.height = (40 + i) + "px";
      document.documentElement.style.setProperty("--popover-available-height", i + "px");
      for (let frame = 0; frame < 4; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
    }
  }));
  const popups = await scenario(() => page.evaluate(async () => {
    for (let i = 0; i < 30; i++) {
      const menu = document.createElement("div");
      menu.className = "target popup";
      menu.textContent = "Menu " + i;
      document.body.appendChild(menu);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      menu.remove();
    }
  }));
  await page.close();
  return { streaming, branches, interaction, popups };
}

(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const origin = "http://127.0.0.1:" + server.address().port;
    const modes = {};
    for (const [mode, customCSSOn] of [["ordinary", false], ["appleUIMix", true]]) {
      modes[mode] = { before: await measure(browser, origin, "before", customCSSOn), after: await measure(browser, origin, "after", customCSSOn) };
    }
    process.stdout.write(JSON.stringify({ baseline: ref, historyTextElements: 2500, streamingUpdates: 40, independentBranches: 64, interactionUpdates: 20, popupUpdates: 30, modes }, null, 2) + "\n");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
