const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { inflateRawSync } = require("node:zlib");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
let packagedEntries;

test("PowerShell 5.1 安装包的文件头与中央目录一致，路径和内容符合拖入安装要求", { skip: process.platform !== "win32" }, () => {
  const script = path.join(root, "build-release.ps1");
  // 从 PowerShell 7 启动 npm 时，补齐子进程的 Windows PowerShell 5.1 内置模块路径。
  const modulePath = path.join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "Modules");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script], {
    cwd: root, encoding: "utf8", env: { ...process.env, PSModulePath: modulePath + path.delimiter + (process.env.PSModulePath || "") }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const zip = fs.readFileSync(path.join(root, "dist", `system-font-substituter-v${manifest.version}.zip`));
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "ZIP 缺少中央目录尾部");
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const entries = new Map();
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const nameLength = zip.readUInt16LE(offset + 28);
    const centralName = zip.subarray(offset + 46, offset + 46 + nameLength);
    const name = centralName.toString("utf8");
    assert.ok(!name.includes("\\"), "ZIP 路径不能含反斜杠：" + name);
    const local = zip.readUInt32LE(offset + 42);
    assert.equal(zip.readUInt32LE(local), 0x04034b50);
    const localLength = zip.readUInt16LE(local + 26);
    const localName = zip.subarray(local + 30, local + 30 + localLength);
    assert.deepEqual(localName, centralName, "本地文件头与中央目录文件名不同：" + name);
    const start = local + 30 + localLength + zip.readUInt16LE(local + 28);
    const compressed = zip.subarray(start, start + zip.readUInt32LE(offset + 20));
    const method = zip.readUInt16LE(offset + 10);
    assert.ok(method === 0 || method === 8, "不支持的压缩方式");
    assert.ok(!entries.has(name), "ZIP 中存在重名文件");
    entries.set(name, method === 0 ? compressed : inflateRawSync(compressed));
    offset += 46 + nameLength + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }

  const expected = ["manifest.json", "background.js", "shared.js", "content.js", "apple-ui-mix.css", "options.html", "options.css", "options.js", "LICENSE", "README.md", "CHANGELOG.md", "PRIVACY.md"];
  function collect(directory) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      const name = directory + "/" + entry.name;
      if (entry.isDirectory()) collect(name);
      else expected.push(name);
    }
  }
  collect("icons");
  collect("_locales");
  assert.deepEqual([...entries.keys()].sort(), expected.sort());
  for (const [name, bytes] of entries) assert.deepEqual(bytes, fs.readFileSync(path.join(root, name)), name);
  assert.equal(JSON.parse(entries.get("manifest.json")).version, manifest.version);
  assert.ok(entries.has("_locales/en/messages.json"));
  assert.ok(entries.has("_locales/zh_CN/messages.json"));
  packagedEntries = entries;
});

test("从安装包的本地文件头路径解包后，真实 MV3 与设置页可以加载", { skip: process.platform !== "win32" }, async () => {
  assert.ok(packagedEntries, "打包校验必须先成功");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sfs-package-"));
  for (const [name, bytes] of packagedEntries) {
    const file = path.join(directory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  const context = await chromium.launchPersistentContext("", {
    headless: true,
    executablePath: chromium.executablePath(),
    args: ["--disable-extensions-except=" + directory, "--load-extension=" + directory]
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
    const id = new URL(worker.url()).host;
    assert.equal(id, "ecgcpjehkelnjfcgldmifejcoefohdcp");
    const manifest = JSON.parse(packagedEntries.get("manifest.json"));
    assert.equal(await worker.evaluate(() => chrome.runtime.getManifest().version), manifest.version);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("chrome-extension://" + id + "/options.html");
    await page.waitForFunction(() => !document.getElementById("save").disabled);
    assert.equal(await page.locator("#ligatureLevel").evaluate(el => el.value), "native");
    await page.locator("#addSiteRule").click();
    await page.locator(".rule-domain").fill("example.com");
    await page.locator(".rule-edit-css").click();
    await page.locator("#useSiteCSS").click();
    const siteCSS = "/* 本站 CSS 分块保存 */\n".repeat(500) + "body { line-height: 1.8; }";
    await page.locator("#siteCSSContent").fill(siteCSS);
    await page.locator("#save").click();
    await page.waitForFunction(() => !document.getElementById("save").disabled && document.getElementById("status").classList.contains("success"));
    const stored = await worker.evaluate(() => chrome.storage.sync.get(null));
    assert.equal(stored.siteRules[0].customCSSMode, "site");
    assert.ok(stored.siteRules[0].customCSSChunks.count > 1);
    assert.equal("customCSS" in stored.siteRules[0], false);
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("save").disabled);
    await page.locator(".rule-edit-css").click();
    assert.equal(await page.locator("#siteCSSContent").inputValue(), siteCSS);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
