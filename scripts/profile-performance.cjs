// 使用独立页面、交替执行顺序和重复测量，比较发布版本、工作区及无扩展基线。
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");
const { createHash } = require("node:crypto");
const { scenarios } = require("./performance-scenarios.cjs");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const ref = args.find(arg => !arg.startsWith("--")) || "v2.1.5";
const option = (name, fallback) => args.find(arg => arg.startsWith("--" + name + "="))?.split("=").slice(1).join("=") || fallback;
const repeats = Number(option("repeats", "3"));
if (!Number.isInteger(repeats) || repeats < 1) throw Error("重复次数应为正整数");
const selected = option("cases", "").split(",").filter(Boolean);
const cases = selected.length ? scenarios.filter(item => selected.includes(item.id)) : scenarios;
if (!cases.length || selected.some(id => !cases.some(item => item.id === id))) throw Error("场景名称无效");
const modes = option("modes", "ordinary,appleUIMix").split(",");
const countCalls = option("counts", "on") !== "off";
const baselineDir = option("baseline-dir", "");
// 按版本和运行时间长期保存测量结果，避免覆盖上一轮样本。
const reportVersion = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).version;
const output = path.resolve(root, option("output", path.join("docs", "performance", "v" + reportVersion,
  new Date().toISOString().replace(/[:.]/g, "-") + "-content")));
if (modes.some(mode => !["ordinary", "appleUIMix"].includes(mode))) throw Error("模式名称无效");
function gitFile(name) {
  const result = spawnSync("git", ["show", ref + ":" + name], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw Error(result.stderr);
  return result.stdout;
}
const sources = {
  before: Object.fromEntries(["shared", "content", "css"].map((name, i) => {
    const file = ["shared.js", "content.js", "apple-ui-mix.css"][i];
    return [name, baselineDir ? fs.readFileSync(path.resolve(root, baselineDir, file), "utf8") : gitFile(file)];
  })),
  after: Object.fromEntries(["shared", "content", "css"].map((name, i) => [name, fs.readFileSync(path.join(root, ["shared.js", "content.js", "apple-ui-mix.css"][i]), "utf8")]))
};
const routes = new Map();
const server = http.createServer((request, response) => {
  const route = routes.get(request.url);
  response.setHeader("Content-Type", route?.type || "text/html; charset=utf-8");
  response.end(route?.body || "");
});

// 测量钩子只存在于测试浏览器，不进入发布内容脚本。
function instrument({ settings, disabled, countCalls }) {
  const state = window.__profile = { reads: 0, sheetDisables: 0, walks: 0, walkedNodes: 0, matches: 0, markerWrites: 0,
    lastWork: performance.now(), frames: [], longTasks: [], errors: [] };
  const tick = name => { state[name]++; state.lastWork = performance.now(); };
  const getStyle = window.getComputedStyle;
  window.__nativeStyle = getStyle;
  window.getComputedStyle = function (...args) { tick("reads"); return Reflect.apply(getStyle, this, args); };
  if (countCalls) {
    const walk = document.createTreeWalker;
    document.createTreeWalker = function (...args) { tick("walks"); return Reflect.apply(walk, this, args); };
    const next = TreeWalker.prototype.nextNode;
    TreeWalker.prototype.nextNode = function () { const node = next.call(this); if (node) tick("walkedNodes"); return node; };
    const matches = Element.prototype.matches;
    Element.prototype.matches = function (...args) { state.matches++; return Reflect.apply(matches, this, args); };
  }
  const set = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) { if (/^data-sfs-/.test(name)) tick("markerWrites"); return set.call(this, name, value); };
  const remove = Element.prototype.removeAttribute;
  Element.prototype.removeAttribute = function (name) { if (/^data-sfs-/.test(name) && this.hasAttribute(name)) tick("markerWrites"); return remove.call(this, name); };
  const descriptor = Object.getOwnPropertyDescriptor(StyleSheet.prototype, "disabled");
  Object.defineProperty(StyleSheet.prototype, "disabled", { ...descriptor, set(value) {
    if (value && ["sfs-style", "sfs-custom-style"].includes(this.ownerNode?.id)) tick("sheetDisables");
    descriptor.set.call(this, value);
  } });
  new PerformanceObserver(list => state.longTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })))).observe({ type: "longtask" });
  let previous;
  function frame(now) { if (previous !== undefined) state.frames.push(now - previous); previous = now; requestAnimationFrame(frame); }
  requestAnimationFrame(frame);
  window.__settings = settings;
  window.__disabledRun = disabled;
  window.chrome = { storage: { sync: { get: async () => window.__settings }, onChanged: { addListener(callback) { window.__storageChanged = callback; } } },
    runtime: { sendMessage: async ({ url }) => { const response = await fetch(url); return { css: await response.text() }; } } };
  window.addEventListener("error", event => state.errors.push(event.message));
}

async function quiet(page) {
  await page.waitForFunction(() => performance.now() - __profile.lastWork >= 300, null, { timeout: 20000 });
}
async function snapshot(cdp) {
  return Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(item => [item.name, item.value]));
}
async function run(browser, origin, scenario, version, mode) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const source = sources[version === "disabled" ? "after" : version];
  await page.addInitScript(instrument, { disabled: version === "disabled", countCalls, settings: {
    targets: ["Arial"], replacement: "serif", ligatureLevel: "standard", customCSSOn: mode === "appleUIMix", customCSS: source.css
  } });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const route = "/" + scenario.id + "/" + version;
  routes.set(route, { body: '<!doctype html><html><head><meta charset="utf-8"><style>body{margin:8px}.target{font-family:Arial}.design{font-family:CustomFont}</style>' + (scenario.head || "") + '</head><body>' + scenario.body + (scenario.setup ? '<script>(' + scenario.setup.toString() + ')()</script>' : "") +
    (version === "disabled" ? "" : '<script src="/' + version + '/shared.js"></script><script src="/' + version + '/content.js"></script>') + '</body></html>' });
  let start = await snapshot(cdp);
  try {
    await page.goto(origin + route);
    await quiet(page);
    await scenario.ready?.(page);
    await quiet(page);
    if (!scenario.cold) {
      await page.evaluate(() => {
        for (const key of ["reads", "sheetDisables", "walks", "walkedNodes", "matches", "markerWrites"]) __profile[key] = 0;
        __profile.frames = []; __profile.longTasks = []; __profile.lastWork = performance.now();
      });
      start = await snapshot(cdp);
    }
    await page.evaluate(cold => { window.__measureStart = cold ? 0 : performance.now(); }, !!scenario.cold);
    await scenario.action?.(page);
    await page.evaluate(() => { __profile.lastWork = Math.max(__profile.lastWork, performance.now()); });
    await quiet(page);
    const end = await snapshot(cdp);
    const counters = await page.evaluate(() => {
      const p = __profile, frames = p.frames.slice().sort((a, b) => a - b);
      return { styleReads: p.reads, sheetDisables: p.sheetDisables, treeWalks: p.walks, walkedNodes: p.walkedNodes,
        selectorMatches: p.matches, markerWrites: p.markerWrites, longTasks: p.longTasks.length,
        longestTaskMs: Math.max(0, ...p.longTasks.map(task => task.duration)), frameP95Ms: frames[Math.max(0, Math.ceil(frames.length * .95) - 1)] || 0,
        longestFrameMs: Math.max(0, ...frames), completionMs: Math.max(0, p.lastWork - __measureStart), errors: p.errors };
    });
    if (counters.errors.length) throw Error(counters.errors.join("；"));
    // 正确性检查在采样结束后执行，避免把断言查询计入扩展扫描量。
    await scenario.check?.(page, version !== "disabled");
    const dom = await cdp.send("Memory.getDOMCounters");
    return { ...counters, domNodes: dom.nodes, eventListeners: dom.jsEventListeners, heapUsedKiB: end.JSHeapUsedSize / 1024,
      styleRecalculations: end.RecalcStyleCount - start.RecalcStyleCount,
      styleMs: (end.RecalcStyleDuration - start.RecalcStyleDuration) * 1000,
      layoutMs: (end.LayoutDuration - start.LayoutDuration) * 1000,
      scriptMs: (end.ScriptDuration - start.ScriptDuration) * 1000,
      taskMs: (end.TaskDuration - start.TaskDuration) * 1000,
      heapDeltaKiB: (end.JSHeapUsedSize - start.JSHeapUsedSize) / 1024 };
  } finally { await context.close(); }
}
function summarize(samples) {
  return Object.fromEntries(Object.keys(samples[0]).filter(key => typeof samples[0][key] === "number").map(key => {
    const values = samples.map(sample => sample[key]).sort((a, b) => a - b);
    const round = value => Math.round(value * 100) / 100;
    return [key, { median: round(values[Math.floor(values.length / 2)]), min: round(values[0]), max: round(values.at(-1)) }];
  }));
}
function markdown(report) {
  const rows = ["# 字体扩展性能对比", "", "基线：" + report.baseline + "。浏览器：" + report.browser + "。每组重复 " + report.repeats + " 次，表中为中位数。", "",
    "使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。", "",
    "高频选择器/遍历计数：" + (report.countCalls ? "开启" : "关闭，表中对应调用量留空") + "。", "",
    "主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。", "",
    "| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |", "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|"];
  for (const [key, group] of Object.entries(report.results)) for (const [version, result] of Object.entries(group)) {
    const m = name => result.summary[name].median;
    rows.push("| " + [key, version, m("taskMs"), m("scriptMs"), m("styleMs"), m("styleReads"), report.countCalls ? m("selectorMatches") : "", report.countCalls ? m("walkedNodes") : "", m("longTasks"), m("longestFrameMs")].join(" | ") + " |");
  }
  return rows.join("\n") + "\n";
}
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    for (const [version, source] of Object.entries(sources)) for (const name of ["shared", "content"]) routes.set("/" + version + "/" + name + ".js", { type: "text/javascript; charset=utf-8", body: source[name] });
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const report = { baseline: baselineDir ? path.resolve(root, baselineDir) : ref, revision: spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim(),
      measuredAt: new Date().toISOString(), browser: browser.version(), platform: process.platform, repeats, countCalls, scenarios: cases.map(({ id, label }) => ({ id, label })), results: {} };
    report.sourceHashes = Object.fromEntries(Object.entries(sources).map(([version, source]) => [version,
      Object.fromEntries(Object.entries(source).map(([name, value]) => [name, createHash("sha256").update(value).digest("hex")]))]));
    const origin = "http://127.0.0.1:" + server.address().port;
    for (const mode of modes) for (const scenario of cases) {
      const key = mode + "/" + scenario.id, samples = { disabled: [], before: [], after: [] };
      for (let repeat = 0; repeat < repeats; repeat++) {
        const order = repeat % 2 ? ["after", "before", "disabled"] : ["disabled", "before", "after"];
        for (const version of order) {
          try { samples[version].push(await run(browser, origin, scenario, version, mode)); }
          catch (error) { error.message = key + "/" + version + "：" + error.message; throw error; }
        }
      }
      report.results[key] = Object.fromEntries(Object.entries(samples).map(([version, values]) => [version, { summary: summarize(values), samples: values }]));
      process.stdout.write(key + " " + JSON.stringify(Object.fromEntries(Object.entries(report.results[key]).map(([v, r]) => [v, { scriptMs: r.summary.scriptMs.median, reads: r.summary.styleReads.median, matches: r.summary.selectorMatches.median }]))) + "\n");
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output + ".json", JSON.stringify(report, null, 2) + "\n");
      fs.writeFileSync(output + ".md", markdown(report));
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
