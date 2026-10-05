const { DEFAULT_CUSTOM_CSS, DEFAULTS, normalizeSettings, normalizeSiteRule, parseDomain, writeSettings, OVERRIDE_KEYS, LIGATURE_LEVELS } = SFS;

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
    siteRulesDesc: "优先调整本站的 Auto Spacing、自定义 CSS 和连字程度；各项可跟随全局或独立设置。",
    addSite: "添加站点",
    removeSite: "删除该站点",
    siteFontPlaceholder: "留空使用全局替换字体",
    domainLabel: "域名或主机:端口",
    siteActionLabel: "站点行为",
    siteActionInherit: "沿用全局策略",
    siteActionForce: "强制替换",
    siteActionOff: "关闭覆盖（旁观）",
    siteOverridesToggle: "其他设置",
    siteOverridesDefault: "代码保护、图标保护、站点字体",
    siteFontSummary: "独立字体",
    siteFontHint: "站点字体仅在强制替换且自定义 CSS 未接管字体时生效。",
    siteOffHint: "本站保留网站原生设置；以下配置暂不生效，切回后恢复。",
    sitePausedHint: "全局已停用；本站配置将在全局启用后生效。",
    siteRulesHelp: "域名匹配与规则优先级",
    siteDeleted: "已删除站点规则",
    undoDelete: "撤销删除",
    missingDomain: "请补全域名后保存此条规则。",
    ligatureLevel: "连字程度",
    ligatureLevelDesc: "仅调整已替换文字的连字；扩展连字取决于字体支持，必要塑形与其他字体特性保持原样。",
    ligatureNative: "保持网站设置",
    ligatureNone: "关闭可选连字",
    ligatureStandard: "标准连字",
    ligatureExtended: "扩展连字",
    triInherit: "跟随全局",
    triOn: "开启",
    triOff: "关闭",
    emptyRulesTitle: "暂无站点特殊规则",
    emptyRulesHint: "添加站点后，可独立调整排版和保护规则。",
    siteRulesHint: "域名匹配主域名及其子域名；可填写 example.com:3350 指定端口，不填端口则匹配全部端口。更具体的主机优先，同一主机下端口规则优先，同等规则保持列表顺序；www.example.com 不匹配 example.com。“沿用全局策略”继续按全局目标名单判断替换，“强制替换”跳过名单判断，代码与图标保护仍按配置生效。“关闭覆盖”停止本站的字体替换、排版覆盖与自定义 CSS。所有站点规则均受全局启用开关控制。",
    customCSSTitle: "自定义 CSS",
    customCSSDesc: "向页面注入自定义样式，可用于 @font-face、字体栈或全局排版；跟随全局启用开关，默认关闭。",
    customCSSToggle: "插入自定义 CSS",
    customCSSReset: "恢复默认内容",
    siteCSSTitle: "本站自定义 CSS",
    siteCSSDesc: "本站内容替换全局 CSS 内容；跟随本站 CSS 开关和站点行为，与整页设置一起保存。",
    siteCSSSource: "CSS 内容来源",
    siteCSSSwitch: "本站 CSS 开关",
    siteCSSGlobal: "使用全局内容",
    siteCSSLocal: "使用本站内容",
    siteCSSEdit: "编辑 CSS",
    siteCSSGlobalSummary: "全局内容",
    siteCSSLocalSummary: "本站内容",
    siteCSSDraftDomain: "尚未填写域名",
    siteCSSReadOnly: "正在查看全局 CSS；选择“使用本站内容”后可独立编辑。",
    siteCSSLocalHint: "编辑内容会保留在当前设置草稿中，点击“保存设置”后生效。留空时不注入 CSS，也不会回退到全局内容。",
    siteCSSActiveHint: "CSS 仅在页面命中替换条件时注入；与扩展排版规则冲突时，以 CSS 为准。",
    siteCSSDisabledHint: "本站 CSS 当前关闭；内容仍会保存，开启后生效。",
    copyGlobalCSS: "复制全局内容到本站",
    backToRules: "返回站点规则",
    customCSSHint: "开启时由自定义 CSS 接管页面字体，替换字体链自动失效（标记逻辑仍用于连字程度与 Auto Spacing）。注入采用检测策略：仅当页面命中替换条件时才全局注入；样式始终注入在扩展自身样式之后，冲突时以自定义 CSS 为准。站点特殊规则中可按站点单独开关。留空则不注入、替换链恢复生效。",
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
    targetsDesc: "One family per line. Replacement only happens when the element’s first-choice family matches this list.",
    families: "families",
    targetsHint: "The default list focuses on common Western and Simplified Chinese system/UI fonts. Design-oriented webfonts such as Inter and Open Sans are intentionally excluded.",
    siteRulesTitle: "Site special rules",
    siteRulesDesc: "Adjust Auto Spacing, custom CSS, and ligature level for each site. Follow global settings or choose an override.",
    addSite: "Add site",
    removeSite: "Remove this site",
    siteFontPlaceholder: "Leave empty to use global font",
    domainLabel: "Domain or host:port",
    siteActionLabel: "Site behavior",
    siteActionInherit: "Use global strategy",
    siteActionForce: "Force replacement",
    siteActionOff: "Off (bypass)",
    siteOverridesToggle: "Other settings",
    siteOverridesDefault: "Code protection, icon protection, site font",
    siteFontSummary: "Site font",
    siteFontHint: "The site font applies only with forced replacement when custom CSS is not controlling fonts.",
    siteOffHint: "This site keeps its native settings. Overrides are inactive and will return when you switch back.",
    sitePausedHint: "The extension is disabled globally. Site settings apply after it is enabled.",
    siteRulesHelp: "Domain matching and rule priority",
    siteDeleted: "Site rule removed",
    undoDelete: "Undo removal",
    missingDomain: "Add a domain before saving this rule.",
    ligatureLevel: "Ligature level",
    ligatureLevelDesc: "Adjust ligatures on replaced text. Extended ligatures depend on font support; required shaping and other font features are preserved.",
    ligatureNative: "Keep site settings",
    ligatureNone: "Disable optional ligatures",
    ligatureStandard: "Standard ligatures",
    ligatureExtended: "Extended ligatures",
    triInherit: "Follow global",
    triOn: "On",
    triOff: "Off",
    emptyRulesTitle: "No site special rules",
    emptyRulesHint: "Add a site to customize its typography and protection settings.",
    siteRulesHint: "Domains match themselves and their subdomains. Add a port, e.g. example.com:3350, to match only that port; omit it to match all ports. More specific hosts win, then explicit ports on the same host; equal rules keep list order. www.example.com does not match example.com. “Use global strategy” checks the global target list; “Force replacement” skips that check while respecting code and icon protection. “Off (bypass)” stops font replacement, typography overrides, and custom CSS on this site. The global enable switch controls every site rule.",
    customCSSTitle: "Custom CSS",
    customCSSDesc: "Inject custom styles into pages for @font-face, font stacks, or global typography; follows the global enable switch, off by default.",
    customCSSToggle: "Insert custom CSS",
    customCSSReset: "Restore default content",
    siteCSSTitle: "Site custom CSS",
    siteCSSDesc: "Site content replaces global CSS. It follows the site CSS switch and behavior, and saves with all settings.",
    siteCSSSource: "CSS content source",
    siteCSSSwitch: "Site CSS switch",
    siteCSSGlobal: "Use global content",
    siteCSSLocal: "Use site content",
    siteCSSEdit: "Edit CSS",
    siteCSSGlobalSummary: "Global content",
    siteCSSLocalSummary: "Site content",
    siteCSSDraftDomain: "Domain not entered yet",
    siteCSSReadOnly: "Viewing global CSS. Choose “Use site content” to edit independently.",
    siteCSSLocalHint: "Edits stay in the current settings draft until you click “Save settings”. Empty site content injects no CSS and does not fall back to global content.",
    siteCSSActiveHint: "CSS is injected only after the page matches replacement conditions, and takes precedence over the extension’s typography rules.",
    siteCSSDisabledHint: "Site CSS is currently off. Content is still saved and applies when enabled.",
    copyGlobalCSS: "Copy global content to this site",
    backToRules: "Back to site rules",
    customCSSHint: "When enabled, custom CSS controls page fonts and suspends the replacement chain; marking still controls ligature level and Auto Spacing. CSS is injected globally only after the page matches replacement conditions. It follows the extension’s own styles and takes precedence when they conflict. Toggle it per site in site rules. Leave empty to inject nothing and restore the chain.",
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
    howItWorks1: "The extension checks each element’s computed font-family instead of forcing one font across the whole page.",
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

// ============================================================================
// 状态管理：智能脏数据检测
// ============================================================================

let originalState = null;  // 初始加载的快照
let busy = false;
let loaded = false;
let checkDirtyTimer = null;

/**
 * 深度比较两个状态对象是否相等
 */
function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (!deepEqual(keysA, keysB)) return false;
    return keysA.every(key => deepEqual(a[key], b[key]));
  }

  return false;
}

/**
 * 从当前表单收集状态
 */
function collectCurrentState() {
  const ligatureLevel = $("ligatureLevel").value;
  return {
    enabled: $("enabled").checked,
    replacement: $("replacement").value.trim(),
    targets: parseTargets(),
    protectCode: $("protectCode").checked,
    protectIcons: $("protectIcons").checked,
    standardLigatures: ["standard", "extended"].includes(ligatureLevel),
    ligatureLevel,
    autoSpacing: $("autoSpacing").checked,
    customCSSOn: $("customCSSOn").checked,
    customCSS: $("customCSS").value,
    siteRules: [...$("siteRules").querySelectorAll(".site-rule-row")].map(readSiteRule).filter(rule => !isEmptyRule(rule))
  };
}

/**
 * 检查当前状态是否与原始状态不同，智能更新脏标记
 * @param {boolean} immediate - 是否立即检查（不防抖）
 */
function checkDirty(immediate = false) {
  if (!loaded || !originalState) return;

  const doCheck = () => {
    const current = collectCurrentState();
    const isDirty = !deepEqual(current, originalState);
    if (isDirty && $("status").classList.contains("success")) {
      clearTimeout(showStatus.timer);
      $("status").textContent = "";
      $("status").className = "status";
    }

    const hint = $("unsavedHint");
    const saveBtn = $("save");
    if (hint) {
      if (isDirty) {
        hint.classList.add("visible");
      } else {
        hint.classList.remove("visible");
      }
    }

    // 保存按钮状态也跟随脏状态
    if (saveBtn && !busy) {
      saveBtn.disabled = false;  // 总是可以保存，即使没修改
    }
  };

  if (immediate) {
    clearTimeout(checkDirtyTimer);
    doCheck();
  } else {
    // 防抖：延迟检查，避免频繁计算
    clearTimeout(checkDirtyTimer);
    checkDirtyTimer = setTimeout(doCheck, 150);
  }
}

function clearDirty() {
  const hint = $("unsavedHint");
  if (hint) hint.classList.remove("visible");
}

// ============================================================================
// UI 辅助函数
// ============================================================================

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function initAnimatedDetails(details) {
  const summary = details.querySelector("summary");
  const content = details.querySelector(":scope > :not(summary)");
  let expanded = details.open;
  let heightAnimation = null;
  let contentAnimation = null;

  function finish() {
    heightAnimation?.cancel();
    contentAnimation?.cancel();
    heightAnimation = contentAnimation = null;
    details.open = expanded;
    details.dataset.expanded = String(expanded);
    details.style.removeProperty("height");
    details.style.removeProperty("overflow");
  }

  summary.addEventListener("click", event => {
    event.preventDefault();
    // 反向操作从当前画面继续，避免快速点击时跳回动画起点。
    const startHeight = details.getBoundingClientRect().height;
    const startOpacity = details.open ? Number(getComputedStyle(content).opacity) : 0;
    expanded = !expanded;
    if (reducedMotion.matches) { finish(); return; }
    heightAnimation?.cancel();
    contentAnimation?.cancel();
    details.open = true;
    details.dataset.expanded = String(expanded);
    details.style.height = "auto";
    const style = getComputedStyle(details);
    const endHeight = expanded ? details.getBoundingClientRect().height
      : summary.getBoundingClientRect().height + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    details.style.height = startHeight + "px";
    details.style.overflow = "hidden";
    const timing = { duration: expanded ? 280 : 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };
    heightAnimation = details.animate([{ height: startHeight + "px" }, { height: endHeight + "px" }], timing);
    contentAnimation = content.animate([{ opacity: startOpacity }, { opacity: expanded ? 1 : 0 }], timing);
    heightAnimation.onfinish = finish;
  });

  // 视口或动效偏好改变时恢复自然高度，避免截断内容。
  window.addEventListener("resize", finish);
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) finish(); });
}

// 自绘下拉菜单：按钮承载值，列表浮层统一管理，避免原生菜单与页面主题脱节。
const selectStates = new WeakMap();
let openSelectState = null;
let selectSequence = 0;
const selectMenu = document.createElement("div");
selectMenu.className = "select-menu";
selectMenu.id = "sfs-select-menu";
selectMenu.setAttribute("role", "listbox");
selectMenu.hidden = true;
document.body.appendChild(selectMenu);

function initCustomSelect(control, choices) {
  const state = { control, choices, value: choices[0].value, active: 0, id: ++selectSequence, search: "", searchAt: 0 };
  selectStates.set(control, state);
  control.innerHTML = '<span class="select-value"></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  Object.defineProperty(control, "value", {
    get: () => state.value,
    set: value => {
      state.value = choices.some(choice => choice.value === value) ? value : choices[0].value;
      updateCustomSelect(control);
    }
  });
  updateCustomSelect(control);
}

function updateCustomSelect(control) {
  const state = selectStates.get(control);
  control.querySelector(".select-value").textContent = state.choices.find(choice => choice.value === state.value)?.label || "";
  if (openSelectState === state) renderSelectMenu();
}

function closeCustomSelect(focus = false) {
  const state = openSelectState;
  if (!state) return;
  openSelectState = null;
  state.control.setAttribute("aria-expanded", "false");
  state.control.removeAttribute("aria-controls");
  state.control.removeAttribute("aria-activedescendant");
  selectMenu.hidden = true;
  if (focus && state.control.isConnected && !state.control.disabled) state.control.focus();
}

function renderSelectMenu() {
  const state = openSelectState;
  if (!state) return;
  selectMenu.replaceChildren();
  selectMenu.setAttribute("aria-label", state.control.getAttribute("aria-label"));
  state.choices.forEach((choice, index) => {
    const option = document.createElement("button");
    option.type = "button";
    option.tabIndex = -1;
    option.className = "select-option";
    option.id = `sfs-option-${state.id}-${index}`;
    option.dataset.index = index;
    option.dataset.value = choice.value;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(choice.value === state.value));
    const label = document.createElement("span");
    label.textContent = choice.label;
    const check = document.createElement("span");
    check.className = "select-check";
    check.setAttribute("aria-hidden", "true");
    check.textContent = choice.value === state.value ? "✓" : "";
    option.append(label, check);
    selectMenu.appendChild(option);
  });
  updateActiveOption();
}

function updateActiveOption() {
  const state = openSelectState;
  if (!state) return;
  [...selectMenu.children].forEach((option, index) => option.classList.toggle("is-active", index === state.active));
  const option = selectMenu.children[state.active];
  state.control.setAttribute("aria-activedescendant", option.id);
  if (option.offsetTop < selectMenu.scrollTop) selectMenu.scrollTop = option.offsetTop;
  if (option.offsetTop + option.offsetHeight > selectMenu.scrollTop + selectMenu.clientHeight) selectMenu.scrollTop = option.offsetTop + option.offsetHeight - selectMenu.clientHeight;
}

function openCustomSelect(control) {
  if (control.disabled) return;
  closeCustomSelect();
  const state = selectStates.get(control);
  if (!state) return;
  openSelectState = state;
  state.active = Math.max(0, state.choices.findIndex(choice => choice.value === state.value));
  state.search = "";
  selectMenu.hidden = false;
  control.setAttribute("aria-expanded", "true");
  control.setAttribute("aria-controls", selectMenu.id);
  renderSelectMenu();
  positionSelectMenu();
}

function positionSelectMenu() {
  const state = openSelectState;
  if (!state) return;
  const rect = state.control.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.top >= innerHeight) { closeCustomSelect(); return; }
  const below = innerHeight - rect.bottom - 14;
  const above = rect.top - 14;
  const upward = below < 200 && above > below;
  selectMenu.dataset.placement = upward ? "above" : "below";
  selectMenu.style.width = Math.min(Math.max(rect.width, 250), innerWidth - 24) + "px";
  selectMenu.style.left = Math.max(12, Math.min(rect.left, innerWidth - parseFloat(selectMenu.style.width) - 12)) + "px";
  selectMenu.style.maxHeight = Math.max(40, Math.min(320, upward ? above : below)) + "px";
  selectMenu.style.top = (upward ? Math.max(12, rect.top - selectMenu.offsetHeight - 6) : rect.bottom + 6) + "px";
  updateActiveOption();
}

function chooseSelectOption(index) {
  const state = openSelectState;
  if (!state) return;
  const value = state.choices[index].value;
  const changed = state.value !== value;
  state.control.value = value;
  closeCustomSelect(true);
  if (changed) state.control.dispatchEvent(new Event("change", { bubbles: true }));
}

document.addEventListener("click", event => {
  const option = event.target.closest(".select-option");
  if (option && selectMenu.contains(option)) { chooseSelectOption(Number(option.dataset.index)); return; }
  const control = event.target.closest(".sfs-select");
  if (control) {
    if (openSelectState?.control === control) closeCustomSelect();
    else openCustomSelect(control);
  }
});
document.addEventListener("pointerdown", event => {
  if (openSelectState && !selectMenu.contains(event.target) && !openSelectState.control.contains(event.target)) closeCustomSelect();
});
document.addEventListener("keydown", event => {
  const control = event.target.closest(".sfs-select");
  if (!control || control.disabled) return;
  const key = event.key;
  if (key === "Tab") { closeCustomSelect(); return; }
  if (key === "Escape") { if (openSelectState) { event.preventDefault(); closeCustomSelect(true); } return; }
  if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(key)) {
    event.preventDefault();
    if (!openSelectState || openSelectState.control !== control) {
      openCustomSelect(control);
      if (key === "Home") openSelectState.active = 0;
      if (key === "End") openSelectState.active = openSelectState.choices.length - 1;
    } else if (key === "Enter" || key === " ") {
      chooseSelectOption(openSelectState.active);
      return;
    } else {
      const state = openSelectState;
      state.active = key === "Home" ? 0 : key === "End" ? state.choices.length - 1
        : (state.active + (key === "ArrowDown" ? 1 : -1) + state.choices.length) % state.choices.length;
    }
    updateActiveOption();
  } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!openSelectState) openCustomSelect(control);
    const state = openSelectState;
    state.search = Date.now() - state.searchAt > 900 ? key : state.search + key;
    state.searchAt = Date.now();
    const match = state.choices.findIndex(choice => choice.label.toLocaleLowerCase().startsWith(state.search.toLocaleLowerCase()));
    if (match >= 0) { state.active = match; updateActiveOption(); }
  }
});
document.addEventListener("scroll", event => {
  if (openSelectState && !selectMenu.contains(event.target)) positionSelectMenu();
}, true);
window.addEventListener("resize", () => closeCustomSelect());

function customSelectButton(className, label, attributes = "") {
  return `<button class="sfs-select ${className}" type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="${label}" ${attributes}></button>`;
}

function overrideChoices(key) {
  return [{ value: "", label: t("triInherit") }, ...(key === "ligatureLevel"
    ? LIGATURE_LEVELS.map(level => ({ value: level, label: t(LIGATURE_LABELS[level]) }))
    : [{ value: "on", label: t("triOn") }, { value: "off", label: t("triOff") }])];
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
  return key === "customCSSOn" ? t("customCSSTitle") : t(key);
}

// ============================================================================
// 站点规则管理
// ============================================================================

let ruleSequence = 0;
let deletedRule = null;
let editingCSSRow = null;
let rulesScrollPosition = 0;
const LIGATURE_LABELS = { native: "ligatureNative", none: "ligatureNone", standard: "ligatureStandard", extended: "ligatureExtended" };

function overrideField(key) {
  return `<div class="override-item">
    <span>${overrideLabel(key)}</span>
    ${customSelectButton("rule-override", overrideLabel(key), `data-key="${key}"`)}
    ${key === "customCSSOn" ? `<button class="rule-edit-css" type="button"><span>${t("siteCSSEdit")}</span><span class="rule-css-summary"></span><span aria-hidden="true">›</span></button>` : ""}
  </div>`;
}

function readSiteRule(row) {
  const fields = row.ruleFields;
  const rule = {
    domain: fields.domain.value,
    font: fields.font.value,
    action: fields.action.value,
    customCSSMode: row.siteCSS.mode,
    customCSS: row.siteCSS.css
  };
  for (const select of fields.overrides) rule[select.dataset.key] = select.value;
  return normalizeSiteRule(rule);
}

function isEmptyRule(rule) {
  return !rule.domain && !rule.font && rule.action === "inherit" && !rule.ligatureLevel && rule.customCSSMode === "global" && !rule.customCSS
    && OVERRIDE_KEYS.every(key => !rule[key]);
}

function refreshSiteRule(row) {
  const off = row.querySelector(".rule-action").value === "off";
  row.classList.toggle("is-off", off);
  for (const field of row.querySelectorAll(".rule-override, .rule-font")) field.disabled = off;
  const hint = row.querySelector(".rule-state-note");
  hint.textContent = off ? t("siteOffHint") : !$("enabled").checked ? t("sitePausedHint") : "";
  hint.hidden = !hint.textContent;
  if (openSelectState?.control.disabled) closeCustomSelect();
  for (const select of row.querySelectorAll(".rule-override")) {
    const key = select.dataset.key;
    const globalValue = key === "ligatureLevel" ? t(LIGATURE_LABELS[$("ligatureLevel").value])
      : t($(key).checked ? "triOn" : "triOff");
    selectStates.get(select).choices[0].label = `${t("triInherit")} · ${globalValue}`;
    updateCustomSelect(select);
  }
  const rule = readSiteRule(row);
  const summary = ["protectCode", "protectIcons"].filter(key => rule[key]).map(key => `${t(key)} · ${t(rule[key] === "on" ? "triOn" : "triOff")}`);
  if (rule.font) summary.push(t("siteFontSummary"));
  row.querySelector(".rule-secondary-summary").textContent = summary.join(" / ") || t("siteOverridesDefault");
  row.querySelector(".rule-css-summary").textContent = t(rule.customCSSMode === "site" ? "siteCSSLocalSummary" : "siteCSSGlobalSummary");
  if (editingCSSRow === row) refreshSiteCSSEditor();
}

function refreshSiteRules() {
  $("siteRules").querySelectorAll(".site-rule-row").forEach(refreshSiteRule);
}

function addSiteRuleRow(rule = {}, focus = false, parent = $("siteRules")) {
  const normalized = normalizeSiteRule({ action: "inherit", ...rule });
  const row = document.createElement("div");
  row.className = "site-rule-row";
  row.siteCSS = { mode: normalized.customCSSMode, css: normalized.customCSS };
  const id = `site-rule-${++ruleSequence}`;
  row.innerHTML = `
    <div class="site-rule-main">
      <div class="rule-domain-field">
        <label class="field-label" for="${id}-domain">${t("domainLabel")}</label>
        <input id="${id}-domain" class="text-input rule-domain" type="text" spellcheck="false" placeholder="example.com" aria-describedby="${id}-domain-error">
        <p id="${id}-domain-error" class="field-error domain-error" hidden></p>
      </div>
      <div class="override-item rule-action-field">
        <span>${t("siteActionLabel")}</span>
        ${customSelectButton("rule-action", t("siteActionLabel"))}
      </div>
      <button class="rule-delete" type="button" title="${t("removeSite")}" aria-label="${t("removeSite")}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6"/>
        </svg>
      </button>
    </div>
    <p class="rule-state-note" hidden></p>
    <div class="site-rule-primary">
      ${["autoSpacing", "customCSSOn", "ligatureLevel"].map(overrideField).join("")}
    </div>
    <details class="rule-secondary">
      <summary><span>${t("siteOverridesToggle")}</span><span class="rule-secondary-summary"></span></summary>
      <div class="site-rule-secondary-fields">
        ${["protectCode", "protectIcons"].map(overrideField).join("")}
        <div class="rule-font-field">
          <label class="field-label" for="${id}-font">${t("replacementLabel")}</label>
          <input id="${id}-font" class="text-input rule-font" type="text" spellcheck="false" placeholder="${t("siteFontPlaceholder")}" aria-describedby="${id}-font-error ${id}-font-hint">
          <p id="${id}-font-error" class="field-error font-error" hidden></p>
          <p id="${id}-font-hint" class="rule-font-hint">${t("siteFontHint")}</p>
        </div>
      </div>
    </details>
  `;
  row.ruleFields = { domain: row.querySelector(".rule-domain"), font: row.querySelector(".rule-font"),
    action: row.querySelector(".rule-action"), overrides: [...row.querySelectorAll(".rule-override")] };
  initCustomSelect(row.querySelector(".rule-action"), [
    { value: "inherit", label: t("siteActionInherit") },
    { value: "force", label: t("siteActionForce") },
    { value: "off", label: t("siteActionOff") }
  ]);
  for (const control of row.querySelectorAll(".rule-override")) initCustomSelect(control, overrideChoices(control.dataset.key));
  row.querySelector(".rule-domain").value = normalized.domain;
  row.querySelector(".rule-font").value = normalized.font;
  row.querySelector(".rule-action").value = normalized.action;
  for (const select of row.querySelectorAll(".rule-override")) {
    select.value = normalized[select.dataset.key];
  }
  parent.appendChild(row);
  refreshSiteRule(row);
  if (parent === $("siteRules")) updateEmptyRulesState();
  if (focus) row.querySelector(".rule-domain").focus();
  return row;
}

function renderSiteRules(rules) {
  closeCustomSelect();
  if (editingCSSRow) closeSiteCSSEditor(false);
  deletedRule = null;
  $("siteRuleUndo").hidden = true;
  $("siteRules").innerHTML = "";
  // 在文档片段中完成规则初始化，再一次挂入页面。
  const fragment = document.createDocumentFragment();
  for (const rule of rules) addSiteRuleRow(rule, false, fragment);
  $("siteRules").appendChild(fragment);
  updateEmptyRulesState();
}

function validateRuleField(row, kind) {
  const rule = readSiteRule(row);
  const input = row.querySelector(`.rule-${kind}`);
  let message = "";
  if (kind === "domain" && !isEmptyRule(rule)) message = !rule.domain ? t("missingDomain") : !parseDomain(rule.domain) ? t("invalidDomain") : "";
  if (kind === "font" && rule.action !== "off" && rule.font && !CSS.supports("font-family", rule.font)) message = t("invalidFont");
  const error = row.querySelector(`.${kind}-error`);
  error.textContent = message;
  error.hidden = !message;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  return message;
}

function collectSiteRules() {
  const rules = [];
  let firstError = null;
  for (const row of $("siteRules").querySelectorAll(".site-rule-row")) {
    const rule = readSiteRule(row);
    for (const kind of ["domain", "font"]) {
      const message = validateRuleField(row, kind);
      if (message && !firstError) firstError = { row, kind, message };
    }
    if (!isEmptyRule(rule)) rules.push(rule);
  }
  if (firstError) {
    const { row, kind, message } = firstError;
    if (editingCSSRow) closeSiteCSSEditor(false);
    if (kind === "font") row.querySelector(".rule-secondary").open = true;
    row.querySelector(`.rule-${kind}`).focus();
    throw new Error(message);
  }
  return rules;
}

function refreshSiteCSSEditor() {
  if (!editingCSSRow) return;
  const row = editingCSSRow;
  const local = row.siteCSS.mode === "site";
  const off = row.querySelector(".rule-action").value === "off";
  const switchValue = row.querySelector('[data-key="customCSSOn"]').value;
  $("siteCSSDomain").textContent = row.querySelector(".rule-domain").value.trim() || t("siteCSSDraftDomain");
  $("useGlobalCSS").setAttribute("aria-pressed", String(!local));
  $("useSiteCSS").setAttribute("aria-pressed", String(local));
  $("useGlobalCSS").disabled = off;
  $("useSiteCSS").disabled = off;
  $("copyGlobalCSS").disabled = off;
  $("siteCSSEnabled").disabled = off;
  selectStates.get($("siteCSSEnabled")).choices[0].label = `${t("triInherit")} · ${t($("customCSSOn").checked ? "triOn" : "triOff")}`;
  $("siteCSSEnabled").value = switchValue;
  $("siteCSSContent").value = local ? row.siteCSS.css : $("customCSS").value;
  $("siteCSSContent").readOnly = !local || off;
  $("siteCSSContentHint").textContent = t(local ? "siteCSSLocalHint" : "siteCSSReadOnly");
  const enabled = switchValue === "on" || !switchValue && $("customCSSOn").checked;
  $("siteCSSEffect").textContent = off ? t("siteOffHint") : !$("enabled").checked ? t("sitePausedHint")
    : !enabled ? t("siteCSSDisabledHint") : t("siteCSSActiveHint");
}

function openSiteCSSEditor(row) {
  closeCustomSelect();
  editingCSSRow = row;
  rulesScrollPosition = window.scrollY;
  $("settingsView").hidden = true;
  $("siteCSSView").hidden = false;
  refreshSiteCSSEditor();
  window.scrollTo(0, 0);
  $("siteCSSHeading").focus({ preventScroll: true });
}

function closeSiteCSSEditor(focus = true) {
  const row = editingCSSRow;
  closeCustomSelect();
  editingCSSRow = null;
  $("siteCSSView").hidden = true;
  $("settingsView").hidden = false;
  window.scrollTo(0, rulesScrollPosition);
  if (focus && row?.isConnected) row.querySelector(".rule-edit-css").focus({ preventScroll: true });
}

// ============================================================================
// 表单填充与数据持久化
// ============================================================================

function fill(s) {
  $("enabled").checked = s.enabled;
  $("replacement").value = s.replacement;
  $("targets").value = s.targets.join("\n");
  $("protectCode").checked = s.protectCode;
  $("protectIcons").checked = s.protectIcons;
  $("ligatureLevel").value = s.ligatureLevel;
  $("autoSpacing").checked = s.autoSpacing;
  $("customCSSOn").checked = s.customCSSOn;
  $("customCSS").value = s.customCSS;
  renderSiteRules(s.siteRules || []);
  updateCount();
  updatePreview();
  updateGlobalStatusBadge();
  clearDirty();

  // 保存原始状态快照
  originalState = collectCurrentState();
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
    if (editingCSSRow) closeSiteCSSEditor(false);
    $("replacement").focus();
    return;
  }

  let payload;
  try {
    payload = {
      enabled: $("enabled").checked,
      replacement,
      targets: parseTargets(),
      protectCode: $("protectCode").checked,
      protectIcons: $("protectIcons").checked,
      standardLigatures: ["standard", "extended"].includes($("ligatureLevel").value),
      ligatureLevel: $("ligatureLevel").value,
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
    // 保存成功后更新原始状态快照为刚保存的内容
    originalState = structuredClone({ ...payload, customCSS: css });
    // 保存后重新检查，如果保存期间用户又修改了，会重新标记为未保存
    checkDirty(true);
    if (deepEqual(collectCurrentState(), originalState)) showStatus(t("saved"));
  } catch (error) {
    console.warn("sfs save failed:", error);
    showStatus(t(/quota/i.test(error.message || "") ? "cssTooLarge" : "saveFailed"), "error");
  } finally {
    setBusy(false);
  }
}

async function reset() {
  if (busy || !loaded) return;
  setBusy(true);
  try {
    const { customCSS, ...payload } = DEFAULTS;
    await writeSettings(chrome.storage.sync, payload, customCSS);
    fill(DEFAULTS);
    showStatus(t("resetDone"));
  } catch (error) {
    console.warn("sfs reset failed:", error);
    showStatus(t("saveFailed"), "error");
  } finally {
    setBusy(false);
  }
}

// ============================================================================
// 预览控件
// ============================================================================

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

// ============================================================================
// 事件绑定
// ============================================================================

$("replacement").addEventListener("input", () => {
  updatePreview();
  checkDirty();  // 使用防抖
});

$("targets").addEventListener("input", () => {
  updateCount();
  checkDirty();  // 使用防抖
});

$("enabled").addEventListener("change", () => {
  updateGlobalStatusBadge();
  refreshSiteRules();
  checkDirty(true);  // change 事件立即检查
});

["protectCode", "protectIcons", "ligatureLevel", "autoSpacing", "customCSSOn"].forEach(id => {
  $(id).addEventListener("change", () => {
    refreshSiteRules();
    checkDirty(true);
  });
});

$("customCSS").addEventListener("input", () => checkDirty());  // 使用防抖

$("addSiteRule").addEventListener("click", () => {
  addSiteRuleRow({}, true);
  checkDirty();
});

// 事件集中在列表上，重绘与撤销无需创建或清理文档监听器。
$("siteRules").addEventListener("click", event => {
  const edit = event.target.closest(".rule-edit-css");
  if (edit) { openSiteCSSEditor(edit.closest(".site-rule-row")); return; }
  const button = event.target.closest(".rule-delete");
  if (!button) return;
  const row = button.closest(".site-rule-row");
  const rows = [...$("siteRules").children];
  const index = rows.indexOf(row);
  const next = rows[index + 1] || rows[index - 1];
  deletedRule = { row, index };
  row.remove();
  $("siteRuleUndoText").textContent = t("siteDeleted");
  $("siteRuleUndo").hidden = false;
  updateEmptyRulesState();
  (next?.querySelector(".rule-domain") || $("addSiteRule")).focus();
  checkDirty(true);
});

$("undoSiteRule").addEventListener("click", () => {
  if (!deletedRule) return;
  const { row, index } = deletedRule;
  $("siteRules").insertBefore(row, $("siteRules").children[index] || null);
  deletedRule = null;
  $("siteRuleUndo").hidden = true;
  refreshSiteRule(row);
  updateEmptyRulesState();
  row.querySelector(".rule-domain").focus();
  checkDirty(true);
});

function onRuleEdit(event) {
  const row = event.target.closest(".site-rule-row");
  if (!row || !event.target.matches("input, .sfs-select")) return;
  refreshSiteRule(row);
  for (const kind of ["domain", "font"]) {
    if (row.querySelector(`.rule-${kind}`).getAttribute("aria-invalid") === "true") validateRuleField(row, kind);
  }
  checkDirty(event.type === "change");
}
$("siteRules").addEventListener("input", onRuleEdit);
$("siteRules").addEventListener("change", onRuleEdit);
$("siteRules").addEventListener("focusout", event => {
  const row = event.target.closest(".site-rule-row");
  if (!row) return;
  if (event.target.matches(".rule-domain")) validateRuleField(row, "domain");
  if (event.target.matches(".rule-font")) validateRuleField(row, "font");
});

$("resetCustomCSS").addEventListener("click", () => {
  $("customCSS").value = DEFAULT_CUSTOM_CSS;
  checkDirty();
});

$("backToRules").addEventListener("click", () => closeSiteCSSEditor());
for (const [id, mode] of [["useGlobalCSS", "global"], ["useSiteCSS", "site"]]) {
  $(id).addEventListener("click", () => {
    if (!editingCSSRow) return;
    editingCSSRow.siteCSS.mode = mode;
    refreshSiteRule(editingCSSRow);
    checkDirty(true);
  });
}
$("copyGlobalCSS").addEventListener("click", () => {
  if (!editingCSSRow) return;
  editingCSSRow.siteCSS = { mode: "site", css: $("customCSS").value };
  refreshSiteRule(editingCSSRow);
  checkDirty(true);
  $("siteCSSContent").focus();
});
$("siteCSSContent").addEventListener("input", () => {
  if (!editingCSSRow || $("siteCSSContent").readOnly) return;
  editingCSSRow.siteCSS.css = $("siteCSSContent").value;
  checkDirty();
});
$("siteCSSEnabled").addEventListener("change", () => {
  if (!editingCSSRow) return;
  editingCSSRow.querySelector('[data-key="customCSSOn"]').value = $("siteCSSEnabled").value;
  refreshSiteRule(editingCSSRow);
  checkDirty(true);
});

$("save").addEventListener("click", save);
$("reset").addEventListener("click", reset);

// Ctrl/Cmd + S 保存
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
    e.preventDefault();
    save();
  }
});

// 防止意外关闭时丢失未保存的更改
window.addEventListener("beforeunload", e => {
  if (!loaded || !originalState) return;
  const current = collectCurrentState();
  if (!deepEqual(current, originalState)) {
    e.preventDefault();
    e.returnValue = "";
  }
});

// ============================================================================
// 初始化
// ============================================================================

initPreviewControls();
applyLanguage();
document.querySelectorAll(".details-section, .site-rules-help").forEach(initAnimatedDetails);
initCustomSelect($("ligatureLevel"), LIGATURE_LEVELS.map(level => ({ value: level, label: t(LIGATURE_LABELS[level]) })));
initCustomSelect($("siteCSSEnabled"), overrideChoices("customCSSOn"));
load();
