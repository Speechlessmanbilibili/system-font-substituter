// 与 content.js 中的 DEFAULT_CUSTOM_CSS 保持一致。
const DEFAULT_CUSTOM_CSS = `/* =========================================================
   Apple UI Mix
   =========================================================

   Western:      SF Pro → PingFang SC → Microsoft YaHei
   CJK:          PingFang SC → Microsoft YaHei
   共有标点:      PingFang SC    PUA: SF Pro（E000-F8FF）
   直接 fallback（不参与 mix 构建）:
   SF Pro / SF Arabic / SF Hebrew / SF Armenian / SF Georgian
   → PingFang HK / TC / KR / JP → Microsoft YaHei
   → 霞鹜新晰黑 屏幕阅读版 补全
   其余字体族用于兼容 B 站原有字体栈。unicode-range 按本机字体
   源文件实测（fontTools）划定。
   ========================================================= */

/* ======== Western / Latin（SF Pro 优先） ======== */

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Ultralight"), local("SF Pro Display Ultralight"), local("PingFang SC Ultralight"), local("Microsoft YaHei Light");
  font-weight: 100;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Thin"), local("SF Pro Display Thin"), local("PingFang SC Thin"), local("Microsoft YaHei Light");
  font-weight: 200;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Light"), local("SF Pro Display Light"), local("PingFang SC Light"), local("Microsoft YaHei Light");
  font-weight: 300;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro"), local("SF Pro Display"), local("PingFang SC"), local("Microsoft YaHei");
  font-weight: 400;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Medium"), local("SF Pro Display Medium"), local("PingFang SC Medium"), local("Microsoft YaHei");
  font-weight: 500;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Semibold"), local("SF Pro Display Semibold"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 600;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Bold"), local("SF Pro Display Bold"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 700;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Heavy"), local("SF Pro Display Heavy"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 800;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Black"), local("SF Pro Display Black"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 900;
  unicode-range: U+0020-00B6, U+00B8-024F, U+0250-02AF, U+0370-03FF, U+0400-04FF, U+1E00-1EFF, U+2070-209F, U+20A0-20BF, U+E000-F8FF;
}


/* ======== Chinese / CJK（苹方优先，共有标点走苹方） ======== */

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Ultralight"), local("Microsoft YaHei Light");
  font-weight: 100;
  unicode-range: U+00B7, U+2010-2016, U+2018-2019, U+201C-201D, U+2020-2027, U+203B, U+2103, U+2160-217F, U+2460-24FF, U+2208, U+2229-222A, U+2266-2267, U+226E-226F, U+22EF, U+2E80-2FFF, U+3000-303F, U+3105-312F, U+3300-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Thin"), local("Microsoft YaHei Light");
  font-weight: 200;
  unicode-range: U+00B7, U+2010-2016, U+2018-2019, U+201C-201D, U+2020-2027, U+203B, U+2103, U+2160-217F, U+2460-24FF, U+2208, U+2229-222A, U+2266-2267, U+226E-226F, U+22EF, U+2E80-2FFF, U+3000-303F, U+3105-312F, U+3300-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Light"), local("Microsoft YaHei Light");
  font-weight: 300;
  unicode-range: U+00B7, U+2010-2016, U+2018-2019, U+201C-201D, U+2020-2027, U+203B, U+2103, U+2160-217F, U+2460-24FF, U+2208, U+2229-222A, U+2266-2267, U+226E-226F, U+22EF, U+2E80-2FFF, U+3000-303F, U+3105-312F, U+3300-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC"), local("Microsoft YaHei");
  font-weight: 400;
  unicode-range: U+00B7, U+2010-2016, U+2018-2019, U+201C-201D, U+2020-2027, U+203B, U+2103, U+2160-217F, U+2460-24FF, U+2208, U+2229-222A, U+2266-2267, U+226E-226F, U+22EF, U+2E80-2FFF, U+3000-303F, U+3105-312F, U+3300-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Medium"), local("Microsoft YaHei");
  font-weight: 500;
  unicode-range: U+00B7, U+2010-2016, U+2018-2019, U+201C-201D, U+2020-2027, U+203B, U+2103, U+2160-217F, U+2460-24FF, U+2208, U+2229-222A, U+2266-2267, U+226E-226F, U+22EF, U+2E80-2FFF, U+3000-303F, U+3105-312F, U+3300-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 600 900;
  unicode-range: U+00B7, U+2010-2016, U+2018-2019, U+201C-201D, U+2020-2027, U+203B, U+2103, U+2160-217F, U+2460-24FF, U+2208, U+2229-222A, U+2266-2267, U+226E-226F, U+22EF, U+2E80-2FFF, U+3000-303F, U+3105-312F, U+3300-33FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF;
}


/* =========================================================
   Global
   ========================================================= */

html,
body {
  font-family:
    "Apple UI Mix",

    /* 直接 fallback（不参与 mix） */
    "SF Pro",
    "SF Arabic",
    "SF Hebrew",
    "SF Armenian",
    "SF Georgian",
    "PingFang HK",
    "PingFang TC",
    "PingFang KR",
    "PingFang JP",

    /* 真正的 fallback */
    "Microsoft YaHei",
    "霞鹜新晰黑 屏幕阅读版 补全",

    /* 以下主要用于兼容 B 站原有字体栈 */
    "Em Dash Bridge",
    "HarmonyOS Sans SC",
    CJKEmDash,
    Numbers,
    Onest,
    ShangguSansSCVF,
    -apple-system,
    BlinkMacSystemFont,
    InterVariable,
    Inter,
    "Segoe UI",
    Cantarell,
    "Noto Sans",
    "Roboto Flex",
    Roboto,
    sans-serif,
    ui-sans-serif,
    system-ui,
    "Apple Color Emoji",
    "Twemoji Mozilla",
    "Noto Color Emoji",
    "Segoe UI Emoji",
    "Segoe UI Symbol",
    emoji !important;

  text-autospace: normal !important;
}
`;

const DEFAULTS = {
  enabled: true,
  replacement: '"Em Dash Bridge", "HarmonyOS Sans SC", "Noto Sans SC", "霞鹜新晰黑 屏幕阅读版 补全"',
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
  autoSpacing: false,
  customCSSOn: false,
  customCSS: DEFAULT_CUSTOM_CSS,
  siteRules: []
};

// 站点规则可三态覆盖的功能项，与 content.js 的 SITE_OVERRIDE_KEYS 保持一致。
const OVERRIDE_KEYS = ["protectCode", "protectIcons", "standardLigatures", "autoSpacing", "customCSSOn"];

const TEXT = {
  "zh-CN": {
    pageTitle: "字体替换器",
    pageSubtitle: "替换常见西文与简中系统/UI 字体，并保留网站的设计字体、代码字体与图标字体。",
    enable: "启用全局替换",
    replacementTitle: "替换字体",
    replacementDesc: "填写本机字体的 CSS font-family。可以使用单个字体，也可以填写完整 fallback 链。",
    replacementLabel: "字体族",
    preview: "预览",
    targetsTitle: "默认替换名单",
    targetsDesc: "每行一个字体族。只有元素的首选字体命中此名单时才会替换。",
    families: "个字体族",
    targetsHint: "默认只包含常见西文与简中系统/UI 字体；Inter、Open Sans 等可能承担视觉设计的 WebFont 不在默认名单中。",
    siteRulesTitle: "站点强制覆盖",
    siteRulesDesc: "对指定站点跳过字体名单判断，直接强制替换。",
    addSite: "添加站点",
    removeSite: "删除该站点",
    siteFontPlaceholder: "留空使用全局替换字体",
    siteOverridesToggle: "覆盖选项",
    triInherit: "跟随全局",
    triOn: "开启",
    triOff: "关闭",
    siteRulesHint: "域名支持主域名与子域名，例如 chatgpt.com、*.example.com；字体留空则使用全局替换字体。命中站点后除强制替换外，还可展开规则对下列功能单独选择开启或关闭，选择「跟随全局」时使用全局设置。",
    customCSSTitle: "自定义 CSS",
    customCSSDesc: "向页面注入自定义样式，可用于 @font-face、字体栈或全局排版；跟随全局启用开关，默认关闭。",
    customCSSToggle: "插入自定义 CSS",
    customCSSReset: "恢复默认内容",
    customCSSHint: "自定义 CSS 始终注入在扩展自身样式之后：与替换字体、标准连字、Auto Spacing 等扩展规则冲突时，以自定义 CSS 为准；留空则不注入。站点强制覆盖中也可按站点单独开关。",
    cssTooLarge: "自定义 CSS 过大，未能保存（其余设置已保存；同步存储单条上限约 8KB）",
    saveFailed: "保存失败，请重试",
    protectionTitle: "保护规则",
    protectionDesc: "避免全局替换破坏代码区域或图标字体。",
    protectCode: "保护代码字体",
    protectCodeDesc: "跳过 code、pre、kbd、samp 及其内部元素",
    protectIcons: "保护图标字体",
    protectIconsDesc: "识别常见 Material Icons、Font Awesome 等图标字体",
    standardLigatures: "标准连字",
    standardLigaturesDesc: "仅对已被替换字体的文字强制开启 OpenType liga / clig，并覆盖网站的关闭设置；默认关闭",
    autoSpacing: "Auto Spacing",
    autoSpacingDesc: "对已被替换字体的文字强制启用 CSS text-autospace: normal，并覆盖网站设置；默认关闭",
    howItWorks: "工作方式",
    howItWorks1: "扩展逐个检查元素计算后的 font-family，不对整个页面强制指定同一个字体。",
    howItWorks2: "只有第一个字体族命中名单时才会替换；动态页面会继续检查新增内容。",
    howItWorks3: "edge://、chrome://、扩展商店等浏览器受保护页面无法注入普通扩展。",
    howItWorks4: "自定义 CSS 在扩展样式之后注入，与替换字体、连字、Auto Spacing 等扩展规则冲突时以自定义 CSS 为准。",
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
    siteOverridesToggle: "Override options",
    triInherit: "Follow global",
    triOn: "On",
    triOff: "Off",
    siteRulesHint: "Domains match the main domain and subdomains, e.g. chatgpt.com, *.example.com. An empty font falls back to the global replacement font. Expand a rule to force individual features on or off for that site; options left as \"Follow global\" use the global settings.",
    customCSSTitle: "Custom CSS",
    customCSSDesc: "Inject custom styles into pages for @font-face, font stacks, or global typography; follows the global enable switch, off by default.",
    customCSSToggle: "Insert custom CSS",
    customCSSReset: "Restore default content",
    customCSSHint: "Custom CSS is always injected after the extension's own styles: when it conflicts with the replacement font, standard ligatures, Auto Spacing or other extension rules, the custom CSS wins. Leave empty to inject nothing. It can also be toggled per site in the site rules.",
    cssTooLarge: "Custom CSS is too large to save (other settings were saved; the per-item sync storage limit is about 8KB)",
    saveFailed: "Save failed, please try again",
    protectionTitle: "Protection rules",
    protectionDesc: "Prevent global replacement from breaking code areas or icon fonts.",
    protectCode: "Protect code fonts",
    protectCodeDesc: "Skip code, pre, kbd, samp and their descendants",
    protectIcons: "Protect icon fonts",
    protectIconsDesc: "Detect common icon fonts such as Material Icons and Font Awesome",
    standardLigatures: "Standard ligatures",
    standardLigaturesDesc: "Force OpenType liga/clig only on text whose font is replaced, overriding site-level disabling; off by default",
    autoSpacing: "Auto Spacing",
    autoSpacingDesc: "Force CSS text-autospace: normal on replaced text, overriding site styles; off by default",
    howItWorks: "How it works",
    howItWorks1: "The extension checks each element's computed font-family instead of forcing one font across the whole page.",
    howItWorks2: "Replacement happens only when the first family matches your list. Newly added dynamic content is checked as well.",
    howItWorks3: "Protected browser pages such as edge://, chrome:// and extension stores do not allow normal extension injection.",
    howItWorks4: "Custom CSS is injected after the extension's styles and wins conflicts with replacement, ligature, or Auto Spacing rules.",
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

// 归一化三态覆盖值。旧版本规则存的是布尔值：true 视为开启，
// false / 缺省视为跟随全局，与 content.js 的 ruleOverride 一致。
function normalizeOverride(value) {
  if (value === "on" || value === true) return "on";
  if (value === "off") return "off";
  return "";
}

function overrideLabel(key) {
  return key === "customCSSOn" ? t("customCSSToggle") : t(key);
}

function addSiteRuleRow(rule = {}) {
  const row = document.createElement("div");
  row.className = "site-rule-row";
  row.innerHTML = `
    <div class="site-rule-main">
      <input class="text-input rule-domain" type="text" spellcheck="false" placeholder="chatgpt.com" aria-label="Domain">
      <input class="text-input rule-font" type="text" spellcheck="false" placeholder="${t("siteFontPlaceholder")}" aria-label="Font">
      <button class="rule-expand" type="button" title="${t("siteOverridesToggle")}" aria-label="${t("siteOverridesToggle")}" aria-expanded="false"></button>
      <button class="rule-remove" type="button" title="${t("removeSite")}" aria-label="${t("removeSite")}">×</button>
    </div>
    <div class="site-rule-overrides">
      ${OVERRIDE_KEYS.map(key => `
        <label class="override-item">
          <span>${overrideLabel(key)}</span>
          <select class="rule-override" data-key="${key}" aria-label="${overrideLabel(key)}">
            <option value="">${t("triInherit")}</option>
            <option value="on">${t("triOn")}</option>
            <option value="off">${t("triOff")}</option>
          </select>
        </label>
      `).join("")}
    </div>
  `;
  row.querySelector(".rule-domain").value = rule.domain || "";
  row.querySelector(".rule-font").value = rule.font || "";
  for (const select of row.querySelectorAll(".rule-override")) {
    select.value = normalizeOverride(rule[select.dataset.key]);
  }

  // 已设置过覆盖项的规则默认展开，方便直接看到当前生效的覆盖。
  if (OVERRIDE_KEYS.some(key => normalizeOverride(rule[key]))) {
    row.classList.add("expanded");
    row.querySelector(".rule-expand").setAttribute("aria-expanded", "true");
  }

  row.querySelector(".rule-expand").addEventListener("click", () => {
    const open = row.classList.toggle("expanded");
    row.querySelector(".rule-expand").setAttribute("aria-expanded", open ? "true" : "false");
  });
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
    if (!domain) continue;
    const rule = {
      domain,
      font: row.querySelector(".rule-font").value.trim()
    };
    for (const select of row.querySelectorAll(".rule-override")) {
      rule[select.dataset.key] = select.value;
    }
    rules.push(rule);
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
  $("autoSpacing").checked = s.autoSpacing;
  $("customCSSOn").checked = s.customCSSOn;
  $("customCSS").value = s.customCSS;
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

  const payload = {
    enabled: $("enabled").checked,
    replacement,
    targets: parseTargets(),
    protectCode: $("protectCode").checked,
    protectIcons: $("protectIcons").checked,
    standardLigatures: $("standardLigatures").checked,
    autoSpacing: $("autoSpacing").checked,
    customCSSOn: $("customCSSOn").checked,
    customCSS: $("customCSS").value,
    siteRules: collectSiteRules()
  };

  try {
    await chrome.storage.sync.set(payload);
    showStatus(t("saved"));
  } catch (firstError) {
    // 单键超过同步配额时整体写入会失败：先保住其余设置，
    // 再单独提示自定义 CSS 过大。
    const { customCSS, ...rest } = payload;
    try {
      await chrome.storage.sync.set(rest);
      showStatus(t("cssTooLarge"), "error");
    } catch {
      console.warn("sfs save failed:", firstError);
      showStatus(t("saveFailed"), "error");
    }
  }
}

async function reset() {
  await chrome.storage.sync.set(DEFAULTS);
  fill(DEFAULTS);
  showStatus(t("resetDone"));
}

$("replacement").addEventListener("input", updatePreview);
$("targets").addEventListener("input", updateCount);
$("addSiteRule").addEventListener("click", () => addSiteRuleRow());
$("resetCustomCSS").addEventListener("click", () => {
  $("customCSS").value = DEFAULT_CUSTOM_CSS;
});
$("save").addEventListener("click", save);
$("reset").addEventListener("click", reset);

applyLanguage();
load();
