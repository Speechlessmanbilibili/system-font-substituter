// 设置页批量规则加载、编辑和保存的独立对比；存储使用本地测试替身。
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "..");
const ref = process.argv.slice(2).find(arg => !arg.startsWith("--")) || "v2.1.5";
const repeats = Number(process.argv.find(arg => arg.startsWith("--repeats="))?.split("=")[1] || 3);
if (!Number.isInteger(repeats) || repeats < 1) throw Error("重复次数应为正整数");
// 按版本和运行时间保存独立报告，保留每次设置页测量。
const reportVersion = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8")).version;
const output = path.resolve(root, process.argv.find(arg => arg.startsWith("--output="))?.split("=")[1]
  || path.join("docs", "performance", "v" + reportVersion, new Date().toISOString().replace(/[:.]/g, "-") + "-settings"));
const sources = {};
for (const version of ["before", "after"]) {
  sources[version] = {};
  for (const name of ["options.html", "options.css", "options.js", "shared.js"]) {
    const result = version === "before" ? spawnSync("git", ["show", ref + ":" + name], { cwd: root, encoding: "utf8" }) : null;
    if (result && result.status !== 0) throw Error(result.stderr);
    sources[version][name] = result ? result.stdout : fs.readFileSync(path.join(root, name), "utf8");
  }
}
const server = http.createServer((request, response) => {
  const [, version, name = ""] = request.url.split("/");
  response.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : name.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8");
  response.end(sources[version]?.[name] || "");
});
async function run(browser, origin, version, count) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(count => {
      window.__rowQueries = 0; window.__longTasks = [];
      const query = Element.prototype.querySelectorAll;
      Element.prototype.querySelectorAll = function (selector) { if (this.id === "siteRules" && selector === ".site-rule-row") __rowQueries++; return query.call(this, selector); };
      new PerformanceObserver(list => __longTasks.push(...list.getEntries().map(entry => entry.duration))).observe({ type: "longtask" });
      window.__store = { replacement: "serif", siteRules: Array.from({ length: count }, (_, i) => ({ domain: "site" + i + ".example.com", action: "inherit" })), customCSS: "/* CSS */".repeat(4000) };
      const storage = { get: async () => structuredClone(__store), set: async values => Object.assign(__store, values), remove: async keys => keys.forEach(key => delete __store[key]) };
      window.chrome = { storage: { sync: storage }, i18n: { getUILanguage: () => "zh-CN" } };
    }, count);
    const cdp = await context.newCDPSession(page);
    await cdp.send("Performance.enable");
    const snapshot = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(item => [item.name, item.value]));
    const started = await snapshot();
    await page.goto(origin + "/" + version + "/options.html");
    await page.waitForFunction(() => !document.getElementById("save").disabled);
    assert.equal(await page.locator(".site-rule-row").count(), count);
    const loaded = await snapshot();
    const initial = await page.evaluate(() => ({ rowQueries: __rowQueries, longestTaskMs: Math.max(0, ...__longTasks) }));
    await page.evaluate(() => { __rowQueries = 0; __longTasks.length = 0; });
    const actionStart = await snapshot();
    await page.locator(".rule-domain").first().fill("changed.example.com");
    await page.locator("#customCSS").fill("/* 新草稿 */".repeat(4000));
    await page.waitForFunction(() => document.getElementById("unsavedHint").classList.contains("visible"));
    await page.locator("#save").click();
    await page.waitForFunction(() => document.getElementById("status").classList.contains("success"));
    assert.equal(await page.evaluate(() => SFS.normalizeSettings(__store).siteRules[0].domain), "changed.example.com");
    assert.equal(await page.evaluate(() => SFS.assembleCustomCSS(__store)), "/* 新草稿 */".repeat(4000));
    const saved = await snapshot(), editing = await page.evaluate(() => ({ rowQueries: __rowQueries, longestTaskMs: Math.max(0, ...__longTasks) }));
    assert.deepEqual(errors, []);
    return { load: { ...initial, taskMs: (loaded.TaskDuration - started.TaskDuration) * 1000, styleMs: (loaded.RecalcStyleDuration - started.RecalcStyleDuration) * 1000 },
      editSave: { ...editing, taskMs: (saved.TaskDuration - actionStart.TaskDuration) * 1000, scriptMs: (saved.ScriptDuration - actionStart.ScriptDuration) * 1000 } };
  } finally { await context.close(); }
}
(async () => {
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
    const report = { baseline: ref, browser: browser.version(), measuredAt: new Date().toISOString(), repeats,
      sourceHashes: Object.fromEntries(Object.entries(sources).map(([version, files]) => [version,
        Object.fromEntries(Object.entries(files).map(([name, text]) => [name, createHash("sha256").update(text).digest("hex")]))])), samples: {} };
    for (const count of [100, 400]) {
      report.samples[count] = { before: [], after: [] };
      for (let i = 0; i < repeats; i++) for (const version of i % 2 ? ["after", "before"] : ["before", "after"]) {
        const result = await run(browser, "http://127.0.0.1:" + server.address().port, version, count);
        report.samples[count][version].push(result);
        process.stdout.write(JSON.stringify({ rules: count, version, ...result }) + "\n");
      }
    }
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output + ".json", JSON.stringify(report, null, 2) + "\n");
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
