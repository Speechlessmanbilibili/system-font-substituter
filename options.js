const DEFAULTS = {
  enabled: true,
  replacement: '"CJK Punct Bridge", "Hanken Grotesk", "HarmonyOS Sans SC"',
  targets: [
    "-apple-system-body", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont",
    "Segoe UI", "Segoe UI Variable", "Segoe UI Variable Text", "Segoe UI Variable Display",
    "Arial", "Arial Unicode MS", "Helvetica", "Helvetica Neue", "Tahoma", "Verdana", "Trebuchet MS",
    "Calibri", "Aptos", "Aptos Display", "Aptos Narrow",
    "SF Pro", "SF Pro Text", "SF Pro Display", "SF UI Text", "SF UI Display",
    "Roboto", "Roboto Flex", "Roboto Condensed", "Ubuntu", "Ubuntu Sans", "Cantarell", "Liberation Sans", "DejaVu Sans", "Droid Sans",
    "Microsoft YaHei", "Microsoft YaHei UI", "微软雅黑", "PingFang SC", "苹方-简", "Hiragino Sans GB", "冬青黑体简体中文",
    "Noto Sans SC", "Noto Sans CJK SC", "Source Han Sans SC", "思源黑体 CN", "思源黑体"
  ],
  protectCode: true,
  protectIcons: true,
  standardLigatures: false,
  siteRules: []
};

const TEXT = {
  "zh-CN": {
    pageTitle: "字体替换器",
    pageSubtitle: "替换常见西文与简中系统 / UI 字体，并保留网站的设计字体、代码字体与图标字体。",
    enable: "启用全局替换",
    replacementTitle: "替换字体",
    replacementDesc: "填写本机字体的 CSS font-family。可以使用单个字体，也可以填写完整 fallback 链。",
    replacementLabel: "字体族",
    preview: "预览",
    targetsTitle: "默认替换名单",
    targetsDesc: "每行一个字体族。只有元素的首选字体命中此名单时才会替换。",
    families: "个字体族",
    targetsHint: "默认只包含常见西文与简中系统 / UI 字体；Inter、Open Sans 等可能承担视觉设计的 WebFont 不在默认名单中。",
    siteRulesTitle: "站点强制覆盖",
    siteRulesDesc: "对指定站点跳过字体名单判断，直接强制替换为所选字体。",
    addSite: "添加站点",
    removeSite: "删除该站点",
    siteFontPlaceholder: "留空使用全局替换字体",
    siteRulesHint: "域名支持主域名与子域名，例如 chatgpt.com、*.example.com；字体留空则使用全局替换字体。代码与图标保护规则仍然生效。",
    protectionTitle: "保护规则",
    protectionDesc: "避免全局替换破坏代码区域或图标字体。",
    protectCode: "保护代码字体",
    protectCodeDesc: "跳过 code、pre、kbd、samp 及其内部元素",
    protectIcons: "保护图标字体",
    protectIconsDesc: "识别常见 Material Icons、Font Awesome 等图标字体",
    standardLigatures: "标准连字",
    standardLigaturesDesc: "仅对已被替换字体的文字强制开启 OpenType liga / clig，并覆盖网站的关闭设置；默认关闭",
    howItWorks: "工作方式",
    howItWorks1: "扩展逐个检查元素计算后的 font-family，不对整个页面强制指定同一个字体。",
    howItWorks2: "只有第一个字体族命中名单时才会替换；动态页面会继续检查新增内容。",
    howItWorks3: "edge://、chrome://、扩展商店等浏览器受保护页面无法注入普通扩展。",
    reset: "恢复默认",
    save: "保存设置",
    saved: "已保存，已打开的网页会自动更新",
    resetDone: "已恢复默认",
    emptyFont: "替换字体不能为空"
  },
  en: {
    pageTitle: "System Font Substituter",
    pageSubtitle: "Replace common Western and Simplified Chinese system/UI fonts while preserving site design fonts, code fonts, and icon fonts.",
    enable: "Enable globally",
    replacementTitle: "Replacement font",
    replacementDesc: "Enter a local font as CSS font-family syntax, or provide a complete fallback chain.",
    replacementLabel: "Font family",
    preview: "Preview",
    targetsTitle: "Default replacement list",
    targetsDesc: "One family per line. Replacement only happens when the element's first-choice family matches this list.",
    families: "families",
    targetsHint: "The default list focuses on common Western and Simplified Chinese system/UI fonts. Design-oriented webfonts such as Inter and Open Sans are intentionally excluded.",
    siteRulesTitle: "Site force override",
    siteRulesDesc: "Skip the font list check on these sites and force replacement.",
    addSite: "Add site",
    removeSite: "Remove this site",
    siteFontPlaceholder: "Leave empty to use the global font",
    siteRulesHint: "Domains match the main domain and subdomains, e.g. chatgpt.com, *.example.com. An empty font falls back to the global replacement font. Code and icon protection still applies.",
    protectionTitle: "Protection rules",
    protectionDesc: "Prevent global replacement from breaking code areas or icon fonts.",
    protectCode: "Protect code fonts",
    protectCodeDesc: "Skip code, pre, kbd, samp and their descendants",
    protectIcons: "Protect icon fonts",
    protectIconsDesc: "Detect common icon fonts such as Material Icons and Font Awesome",
    standardLigatures: "Standard ligatures",
    standardLigaturesDesc: "Force OpenType liga/clig only on text whose font is replaced, overriding site-level disabling; off by default",
    howItWorks: "How it works",
    howItWorks1: "The extension checks each element's computed font-family instead of forcing one font across the whole page.",
    howItWorks2: "Replacement happens only when the first family matches your list. Newly added dynamic content is checked as well.",
    howItWorks3: "Protected browser pages such as edge://, chrome:// and extension stores do not allow normal extension injection.",
    reset: "Restore defaults",
    save: "Save settings",
    saved: "Saved. Open pages will update automatically.",
    resetDone: "Defaults restored",
    emptyFont: "Replacement font cannot be empty"
  }
};

const $ = id => document.getElementById(id);
const locale = ((chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language || "en").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
const t = key => TEXT[locale][key] || TEXT.en[key] || key;

function applyLanguage() {
  document.documentElement.lang = locale;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
}

function parseTargets() {
  return $("targets").value.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function updateCount() {
  $("targetCount").textContent = parseTargets().length;
}

function updatePreview() {
  const family = $("replacement").value.trim();
  $("previewText").style.fontFamily = family || "inherit";
}

function showStatus(message, type = "success") {
  const el = $("status");
  el.textContent = message;
  el.className = `status ${type}`;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => {
    el.textContent = "";
    el.className = "status";
  }, 2400);
}

function addSiteRuleRow(rule = {}) {
  const row = document.createElement("div");
  row.className = "site-rule-row";
  row.innerHTML = `
    <input class="text-input rule-domain" type="text" spellcheck="false" placeholder="chatgpt.com" aria-label="Domain">
    <input class="text-input rule-font" type="text" spellcheck="false" placeholder="${t("siteFontPlaceholder")}" aria-label="Font">
    <button class="rule-remove" type="button" title="${t("removeSite")}" aria-label="${t("removeSite")}">×</button>
  `;
  row.querySelector(".rule-domain").value = rule.domain || "";
  row.querySelector(".rule-font").value = rule.font || "";
  row.querySelector(".rule-remove").addEventListener("click", () => {
    row.remove();
  });
  $("siteRules").appendChild(row);
}

function renderSiteRules(rules) {
  $("siteRules").innerHTML = "";
  for (const rule of rules) addSiteRuleRow(rule);
}

function collectSiteRules() {
  const rules = [];
  for (const row of $("siteRules").querySelectorAll(".site-rule-row")) {
    const domain = row.querySelector(".rule-domain").value.trim();
    const font = row.querySelector(".rule-font").value.trim();
    if (domain) rules.push({ domain, font });
  }
  return rules;
}

function fill(s) {
  $("enabled").checked = s.enabled;
  $("replacement").value = s.replacement;
  $("targets").value = s.targets.join("\n");
  $("protectCode").checked = s.protectCode;
  $("protectIcons").checked = s.protectIcons;
  $("standardLigatures").checked = s.standardLigatures;
  renderSiteRules(s.siteRules || []);
  updateCount();
  updatePreview();
}

async function load() {
  const saved = await chrome.storage.sync.get(DEFAULTS);
  fill({ ...DEFAULTS, ...saved });
}

async function save() {
  const replacement = $("replacement").value.trim();
  if (!replacement) {
    showStatus(t("emptyFont"), "error");
    $("replacement").focus();
    return;
  }

  await chrome.storage.sync.set({
    enabled: $("enabled").checked,
    replacement,
    targets: parseTargets(),
    protectCode: $("protectCode").checked,
    protectIcons: $("protectIcons").checked,
    standardLigatures: $("standardLigatures").checked,
    siteRules: collectSiteRules()
  });
  showStatus(t("saved"));
}

async function reset() {
  await chrome.storage.sync.set(DEFAULTS);
  fill(DEFAULTS);
  showStatus(t("resetDone"));
}

$("replacement").addEventListener("input", updatePreview);
$("targets").addEventListener("input", updateCount);
$("addSiteRule").addEventListener("click", () => addSiteRuleRow());
$("save").addEventListener("click", save);
$("reset").addEventListener("click", reset);

applyLanguage();
load();
