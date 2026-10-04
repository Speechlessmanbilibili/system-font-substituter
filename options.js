const { DEFAULT_CUSTOM_CSS, DEFAULTS, normalizeSettings, parseDomain, writeSettings, ruleOverride: normalizeOverride, OVERRIDE_KEYS } = SFS;

const TEXT = {
  "zh-CN": {
    pageTitle: "字体替换器",
    pageSubtitle: "替换常见西文与简中系统/UI 字体，并保留网站的设计字体、代码字体与图标字体。",
    enable: "启用",
    running: "运行中",
    paused: "已停用",
    replacementTitle: "替换字体",
    replacementDesc: "填写本机字体的 CSS font-family。可以使用单个字体，也可以填写完整 fallback 链。",
    replacementLabel: "字体族",
    preview: "预览",
    previewTag: "实时渲染 · 支持直接编辑",
    presetMixed: "综合",
    presetPunct: "标点破折号",
    presetLigatures: "连字数字",
    presetLatin: "西文短文",
    globalToggle: "全局启用/停用",
    targetsLabel: "目标字体族",
    targetsTitle: "默认替换名单",
    targetsDesc: "每行一个字体族。只有元素的首选字体命中此名单时才会替换。",
    families: "个字体族",
    targetsHint: "默认只包含常见西文与简中系统/UI 字体；Inter、Open Sans 等可能承担视觉设计的 WebFont 不在默认名单中。",
    siteRulesTitle: "站点特殊规则",
    siteRulesDesc: "对指定站点选择特殊行为：强制替换，或关闭扩展的一切覆盖以便查看网站原生字体设置。",
    addSite: "添加站点",
    removeSite: "删除该站点",
    siteFontPlaceholder: "留空使用全局替换字体",
    domainLabel: "域名或主机:端口",
    siteActionLabel: "动作",
    siteActionForce: "强制替换",
    siteActionOff: "关闭覆盖（旁观）",
    siteOverridesToggle: "覆盖选项",
    triInherit: "跟随全局",
    triOn: "开启",
    triOff: "关闭",
    emptyRulesTitle: "暂无站点特殊规则",
    emptyRulesHint: "点击上方「添加站点」可为特定域名配置强制替换或关闭覆盖。",
    siteRulesHint: "域名匹配主域名及其子域名；可填写 127.0.0.1:3350 或 [::1]:3350 指定端口，不填端口则匹配全部端口。同一主机下端口规则优先，更具体的域名优先；www.example.com 不匹配 example.com。字体留空则使用全局替换字体。动作选「关闭覆盖」时扩展对该站点完全静默（不替换、不注入自定义 CSS），适合查看网站原生字体设置；选「强制替换」时可展开规则对下列功能单独选择开启或关闭，选择「跟随全局」时使用全局设置。",
    customCSSTitle: "自定义 CSS",
    customCSSDesc: "向页面注入自定义样式，可用于 @font-face、字体栈或全局排版；跟随全局启用开关，默认关闭。",
    customCSSToggle: "插入自定义 CSS",
    customCSSReset: "恢复默认内容",
    customCSSHint: "开启时由自定义 CSS 接管页面字体，替换字体链自动失效（标记逻辑仅保留给标准连字与 Auto Spacing）。注入采用检测策略：仅当页面使用了替换名单字体时才全局注入，个人站等使用原生字体的页面保持原样；样式始终注入在扩展自身样式之后，站点特殊规则中也可按站点单独开关。留空则不注入、替换链恢复生效。",
    cssTooLarge: "同步存储配额不足，未保存更改；请缩短自定义 CSS 或站点规则。",
    invalidDomain: "站点格式无效，请填写域名、域名:端口或 HTTP/HTTPS 地址。",
    invalidFont: "字体族格式无效，请使用有效的 CSS font-family 语法。",
    loadFailed: "设置读取失败，请重新打开设置页。",
    saveFailed: "保存失败，请重试",
    protectionTitle: "保护与排版规则",
    protectionDesc: "避免全局替换破坏代码区域或图标字体，并优化高级排版特性。",
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
    howItWorks4: "自定义 CSS 开启时替换链自动失效，页面字体由自定义 CSS 接管；关闭时恢复替换链。",
    reset: "恢复默认",
    save: "保存设置",
    saved: "已保存，已打开的网页会自动更新",
    resetDone: "已恢复默认",
    emptyFont: "替换字体不能为空",
    unsavedChanges: "有未保存的更改"
  },
  en: {
    pageTitle: "System Font Substituter",
    pageSubtitle: "Replace common Western and Simplified Chinese system/UI fonts while preserving site design fonts, code fonts, and icon fonts.",
    enable: "Enable",
    running: "Active",
    paused: "Disabled",
    replacementTitle: "Replacement font",
    replacementDesc: "Enter a local font as CSS font-family syntax, or provide a complete fallback chain.",
    replacementLabel: "Font family",
    preview: "Preview",
    previewTag: "Live rendering · Editable",
    presetMixed: "Mixed",
    presetPunct: "Punctuation",
    presetLigatures: "Ligatures",
    presetLatin: "Latin",
    globalToggle: "Enable/disable globally",
    targetsLabel: "Target font families",
    targetsTitle: "Default replacement list",
    targetsDesc: "One family per line. Replacement only happens when the element's first-choice family matches this list.",
    families: "families",
    targetsHint: "The default list focuses on common Western and Simplified Chinese system/UI fonts. Design-oriented webfonts such as Inter and Open Sans are intentionally excluded.",
    siteRulesTitle: "Site special rules",
    siteRulesDesc: "Choose a special behavior per site: force replacement, or turn off all extension overrides to inspect the site's native font settings.",
    addSite: "Add site",
    removeSite: "Remove this site",
    siteFontPlaceholder: "Leave empty to use global font",
    domainLabel: "Domain or host:port",
    siteActionLabel: "Action",
    siteActionForce: "Force replacement",
    siteActionOff: "Off (bypass)",
    siteOverridesToggle: "Override options",
    triInherit: "Follow global",
    triOn: "On",
    triOff: "Off",
    emptyRulesTitle: "No site special rules",
    emptyRulesHint: "Click \"Add site\" above to configure forced replacement or bypass for specific domains.",
    siteRulesHint: "Domains match the domain and its subdomains. Add a port, e.g. 127.0.0.1:3350 or [::1]:3350, to match only that port; omit it to match all ports. More specific hosts take precedence, followed by explicit ports; www.example.com does not match example.com. An empty font falls back to the global replacement font. With the \"Off (bypass)\" action the extension goes fully silent on that site (no replacement, no custom CSS), useful for inspecting the site's native font settings. With \"Force replacement\" you can expand a rule to force individual features on or off; options left as \"Follow global\" use the global settings.",
    customCSSTitle: "Custom CSS",
    customCSSDesc: "Inject custom styles into pages for @font-face, font stacks, or global typography; follows the global enable switch, off by default.",
    customCSSToggle: "Insert custom CSS",
    customCSSReset: "Restore default content",
    customCSSHint: "When enabled, custom CSS takes over page typography and the replacement chain is suspended (marking is kept only for standard ligatures and Auto Spacing). Injection is detection-based: it only goes global when the page actually uses fonts from the replacement list, while pages using their own fonts (e.g. personal sites) stay untouched. It is always injected after the extension's own styles and can be toggled per site in the site rules. Leave empty to inject nothing and restore the chain.",
    cssTooLarge: "Sync storage quota exceeded. Changes were not saved; shorten the custom CSS or site rules.",
    invalidDomain: "Invalid site. Enter a domain, domain:port, or HTTP/HTTPS URL.",
    invalidFont: "Invalid font family. Use valid CSS font-family syntax.",
    loadFailed: "Could not load settings. Reopen this page.",
    saveFailed: "Save failed, please try again",
    protectionTitle: "Protection and typography rules",
    protectionDesc: "Prevent global replacement from breaking code areas or icon fonts, and optimize typographic features.",
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
    howItWorks4: "Enabling custom CSS suspends the replacement chain and lets it take over page typography; disabling restores the chain.",
    reset: "Restore defaults",
    save: "Save settings",
    saved: "Saved. Open pages will update automatically.",
    resetDone: "Defaults restored",
    emptyFont: "Replacement font cannot be empty",
    unsavedChanges: "Unsaved changes"
  }
};

const PRESET_TEXTS = {
  mixed: `The quick brown fox jumps over the lazy dog.
天地玄黄，宇宙洪荒。汉字与西文字符协同排版预览。
0123456789 · fi fl ffi ffl · “弯引号” 与 ‘单引号’ — 破折号`,
  punct: `“双引号包裹内容”与‘单引号’测试，全角标点【】（）！：；？。
破折号——与省略号……连接号与西文 Em Dash — En Dash –`,
  ligatures: `fi fl ff ffi ffl fj ft fb Th st ct
0123456789 (89/100) $123.45 €99.00 ¥688.00`,
  latin: `Typography is the art and technique of arranging type to make written language legible, readable and appealing when displayed.
SF Pro, Helvetica, HarmonyOS, PingFang SC.`
};

const $ = id => document.getElementById(id);
const locale = ((chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language || "en").toLowerCase().startsWith("zh") ? "zh-CN" : "en";
const t = key => TEXT[locale][key] || TEXT.en[key] || key;

let isDirty = false;
let editRevision = 0;
let busy = false;
let loaded = false;
function markDirty() {
  editRevision++;
  if (!isDirty) {
    isDirty = true;
    const hint = $("unsavedHint");
    if (hint) hint.classList.add("visible");
  }
}

function clearDirty() {
  isDirty = false;
  const hint = $("unsavedHint");
  if (hint) hint.classList.remove("visible");
}

function applyLanguage() {
  document.documentElement.lang = locale;
  document.title = t("pageTitle");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    el.setAttribute("aria-label", t(el.dataset.i18nAria));
  });
  const shortcut = document.querySelector(".shortcut-badge");
  if (shortcut) shortcut.textContent = /Mac/i.test(navigator.platform) ? "⌘S" : "Ctrl+S";
}

function updateGlobalStatusBadge() {
  const enabled = $("enabled").checked;
  const badge = $("globalStatusBadge");
  const text = $("globalStatusText");
  if (!badge || !text) return;

  if (enabled) {
    badge.classList.remove("disabled");
    text.textContent = t("running");
  } else {
    badge.classList.add("disabled");
    text.textContent = t("paused");
  }
}

function updateEmptyRulesState() {
  const siteRules = $("siteRules");
  const emptyBox = $("emptySiteRules");
  if (!siteRules || !emptyBox) return;
  const count = siteRules.querySelectorAll(".site-rule-row").length;
  if (count === 0) {
    emptyBox.classList.remove("hidden");
  } else {
    emptyBox.classList.add("hidden");
  }
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
  }, 2800);
}

function overrideLabel(key) {
  return key === "customCSSOn" ? t("customCSSToggle") : t(key);
}

function addSiteRuleRow(rule = {}) {
  const row = document.createElement("div");
  row.className = "site-rule-row";
  row.innerHTML = `
    <div class="site-rule-main">
      <input class="text-input rule-domain" type="text" spellcheck="false" placeholder="chatgpt.com" aria-label="${t("domainLabel")}">
      <input class="text-input rule-font" type="text" spellcheck="false" placeholder="${t("siteFontPlaceholder")}" aria-label="${t("replacementLabel")}">
      <button class="rule-expand" type="button" title="${t("siteOverridesToggle")}" aria-label="${t("siteOverridesToggle")}" aria-expanded="false"></button>
      <button class="rule-remove" type="button" title="${t("removeSite")}" aria-label="${t("removeSite")}">×</button>
    </div>
    <div class="site-rule-overrides">
      <label class="override-item">
        <span>${t("siteActionLabel")}</span>
        <select class="rule-action" aria-label="${t("siteActionLabel")}">
          <option value="force">${t("siteActionForce")}</option>
          <option value="off">${t("siteActionOff")}</option>
        </select>
      </label>
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
  row.querySelector(".rule-action").value = rule.action === "off" ? "off" : "force";
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
    updateEmptyRulesState();
    markDirty();
  });

  row.querySelectorAll("input, select").forEach(input => {
    input.addEventListener("input", markDirty);
    input.addEventListener("change", markDirty);
  });

  $("siteRules").appendChild(row);
  updateEmptyRulesState();
}

function renderSiteRules(rules) {
  $("siteRules").innerHTML = "";
  for (const rule of rules) addSiteRuleRow(rule);
  updateEmptyRulesState();
}

function collectSiteRules() {
  const rules = [];
  for (const row of $("siteRules").querySelectorAll(".site-rule-row")) {
    const domain = row.querySelector(".rule-domain").value.trim();
    if (!domain) continue;
    const rule = {
      domain,
      font: row.querySelector(".rule-font").value.trim(),
      action: row.querySelector(".rule-action").value === "off" ? "off" : "force"
    };
    for (const select of row.querySelectorAll(".rule-override")) {
      rule[select.dataset.key] = select.value;
    }
    if (!parseDomain(domain)) {
      row.querySelector(".rule-domain").focus();
      throw new Error(t("invalidDomain"));
    }
    if (rule.font && !CSS.supports("font-family", rule.font)) {
      row.querySelector(".rule-font").focus();
      throw new Error(t("invalidFont"));
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
  updateGlobalStatusBadge();
  clearDirty();
}

function setBusy(value) {
  busy = value;
  $("save").disabled = value || !loaded;
  $("reset").disabled = value || !loaded;
}

async function load() {
  setBusy(true);
  try {
    fill(normalizeSettings(await chrome.storage.sync.get(null)));
    loaded = true;
  } catch (error) {
    console.warn("sfs settings load failed:", error);
    showStatus(t("loadFailed"), "error");
  } finally {
    setBusy(false);
  }
}

async function save() {
  if (busy || !loaded) return;
  const replacement = $("replacement").value.trim();
  if (!replacement || !CSS.supports("font-family", replacement)) {
    showStatus(t(replacement ? "invalidFont" : "emptyFont"), "error");
    $("replacement").focus();
    return;
  }
  const revision = editRevision;
  let payload;
  try {
    payload = {
      enabled: $("enabled").checked,
      replacement,
      targets: parseTargets(),
      protectCode: $("protectCode").checked,
      protectIcons: $("protectIcons").checked,
      standardLigatures: $("standardLigatures").checked,
      autoSpacing: $("autoSpacing").checked,
      customCSSOn: $("customCSSOn").checked,
      siteRules: collectSiteRules()
    };
  } catch (error) {
    showStatus(error.message, "error");
    return;
  }
  const css = $("customCSS").value;
  setBusy(true);
  try {
    await writeSettings(chrome.storage.sync, payload, css);
    showStatus(t("saved"));
    if (revision === editRevision) clearDirty();
  } catch (error) {
    console.warn("sfs save failed:", error);
    showStatus(t(/quota/i.test(error.message || "") ? "cssTooLarge" : "saveFailed"), "error");
  } finally {
    setBusy(false);
  }
}

async function reset() {
  if (busy || !loaded) return;
  const revision = editRevision;
  setBusy(true);
  try {
    const { customCSS, ...payload } = DEFAULTS;
    await writeSettings(chrome.storage.sync, payload, customCSS);
    if (revision === editRevision) fill(DEFAULTS);
    showStatus(t("resetDone"));
  } catch (error) {
    console.warn("sfs reset failed:", error);
    showStatus(t("saveFailed"), "error");
  } finally {
    setBusy(false);
  }
}

// 实时预览的文本预设与字重按钮
function initPreviewControls() {
  const presetGroup = $("presetButtons");
  if (presetGroup) {
    presetGroup.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        presetGroup.querySelectorAll(".preset-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const key = btn.dataset.preset;
        if (PRESET_TEXTS[key]) {
          $("previewText").textContent = PRESET_TEXTS[key];
        }
      });
    });
  }

  const weightGroup = $("weightButtons");
  if (weightGroup) {
    weightGroup.querySelectorAll(".weight-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        weightGroup.querySelectorAll(".weight-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const weight = btn.dataset.weight;
        $("previewText").style.fontWeight = weight;
      });
    });
  }
}

// 设置项与操作按钮的事件
$("replacement").addEventListener("input", () => {
  updatePreview();
  markDirty();
});

$("targets").addEventListener("input", () => {
  updateCount();
  markDirty();
});

$("enabled").addEventListener("change", () => {
  updateGlobalStatusBadge();
  markDirty();
});

["protectCode", "protectIcons", "standardLigatures", "autoSpacing", "customCSSOn"].forEach(id => {
  $(id).addEventListener("change", markDirty);
});

$("customCSS").addEventListener("input", markDirty);

$("addSiteRule").addEventListener("click", () => {
  addSiteRuleRow();
  markDirty();
});

$("resetCustomCSS").addEventListener("click", () => {
  $("customCSS").value = DEFAULT_CUSTOM_CSS;
  markDirty();
});

$("save").addEventListener("click", save);
$("reset").addEventListener("click", reset);

// Ctrl/Cmd + S 保存设置
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  }
});

initPreviewControls();
applyLanguage();
load();
