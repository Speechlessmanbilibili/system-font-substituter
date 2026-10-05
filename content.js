(() => {
  "use strict";

  const { DEFAULTS, normalizeSettings, siteState, ligatureDeclarations, CC_PREFIX, SITE_CC_PREFIX, META_KEY, OVERRIDE_KEYS: SITE_OVERRIDE_KEYS } = SFS;

  const MARK = "data-sfs-replaced";
  const LIGATURE_MARK = "data-sfs-ligatures";
  const ligatureStyles = new Map();
  const ROOT_MARK = "data-sfs";
  const STYLE_ID = "sfs-style";
  const CUSTOM_STYLE_ID = "sfs-custom-style";
  const SCAN_CHUNK = 2000;
  const INPUT_QUIET_MS = 180;

  let settings = DEFAULTS;
  let targetSet = new Set();
  let siteOff = false;
  let forceSite = false;
  let siteFont = null;
  let siteOverrides = {};
  // 自定义 CSS 采用"检测到名单字体才全局注入"策略：扫描器首次命中
  // 替换名单字体时置位并注入；个人站等未使用名单字体的页面保持原样。
  let cssDetected = false;

  const ICON_CLASS_RE = /(^|[\s_-])(icon|icons|fa|fas|far|fal|fab|material-icons?|glyph|symbol)([\s_-]|$)/;
  const ICON_FAMILY_RE = /fontawesome|material symbols|material icons|bootstrap-icons|remixicon|tabler-icons|lucide/;
  // 表单控件与可编辑区域：即使内容为空也需要参与替换（空输入框/占位文字
  // 同样展示字体），contenteditable 区域初始无文本节点时尤其需要。
  const EDITABLE_SELECTOR = "input, textarea, select, button, [contenteditable]:not([contenteditable='false'])";

  let observer = null;
  let pending = new Set();
  let scheduled = false;
  let styleNeedsReposition = false;
  let stylesheetTimer = null;
  let scanQueue = [];
  const queuedNodes = new Set();
  let scanning = false;
  let scanEpoch = 0;
  let loadEpoch = 0;
  let cssGeneration = null;
  let siteCSSGenerations = [];
  let sampledElements = new WeakSet();
  let nonemptyTextNodes = new WeakSet();
  let autoDirections = new WeakMap();
  const pendingAttributes = new Map();
  const deferredFontWork = new Set();
  let inputDeadline = 0;
  let composing = false;
  let selectionPointer = null;
  let selecting = false;
  let inputTimer = null;
  let typographyIndex = null;
  let typographyContexts = new WeakMap();
  const fontSamples = new Map();
  const FONT_SAMPLE_LIMIT = 1024;
  // 字号、字重等仍由浏览器正常排版；只有影响判断或原样式快照的声明参与索引。
  const FONT_PROPERTY_RE = /^(?:font|font-family|font-feature-settings|font-variant|font-variant-ligatures|text-autospace|direction|unicode-bidi|all)$/;
  const externalSheetRules = new WeakMap();
  const externalSheetPending = new WeakSet();

  function cancelScans() {
    scanEpoch++;
    scanQueue = [];
    queuedNodes.clear();
    pending.clear();
    pendingAttributes.clear();
    deferredFontWork.clear();
    clearTimeout(inputTimer);
    inputTimer = null;
    scanning = false;
    scheduled = false;
    styleNeedsReposition = false;
    sampledElements = new WeakSet();
    nonemptyTextNodes = new WeakSet();
    autoDirections = new WeakMap();
    invalidateTypography();
    clearTimeout(stylesheetTimer);
    stylesheetTimer = null;
  }

  function editingBusy() {
    return composing || selecting || performance.now() < inputDeadline;
  }

  function releaseFontWork() {
    clearTimeout(inputTimer);
    inputTimer = null;
    if (!deferredFontWork.size || composing || selecting) return;
    const remaining = inputDeadline - performance.now();
    if (remaining > 0) {
      inputTimer = setTimeout(releaseFontWork, remaining);
      return;
    }
    const work = [...deferredFontWork];
    deferredFontWork.clear();
    work.forEach(task => requestAnimationFrame(task));
  }

  // 连续输入、组词和鼠标拖选时暂缓扫描，结束后合并处理，避免反复开关全页样式。
  function scheduleFontWork(task, epoch = scanEpoch) {
    const run = () => {
      if (epoch !== scanEpoch || !settings.enabled || siteOff) return;
      if (editingBusy()) {
        deferredFontWork.add(run);
        releaseFontWork();
      } else task();
    };
    requestAnimationFrame(run);
  }

  function trackEditing(event) {
    const target = event.target;
    if (!(target instanceof Element) || !(target.matches("input, textarea") || target.isContentEditable)) return;
    if (event.type === "compositionstart") composing = true;
    else if (event.type === "compositionend" || event.type === "focusout") composing = false;
    inputDeadline = performance.now() + INPUT_QUIET_MS;
    if (event.type === "input" && settings.enabled && !siteOff) {
      const directionRoot = textRecheckRoot(target);
      if (directionRoot) queue(directionRoot);
    }
    releaseFontWork();
  }

  for (const type of ["beforeinput", "input", "compositionstart", "compositionupdate", "compositionend", "focusout"]) {
    document.addEventListener(type, trackEditing, true);
  }

  function finishSelection() {
    selectionPointer = null;
    if (selecting) inputDeadline = Math.max(inputDeadline, performance.now() + INPUT_QUIET_MS);
    selecting = false;
    releaseFontWork();
  }

  // 编辑框从按下鼠标开始暂停；普通网页文字由原生 selectstart 确认拖选。
  // 只跟踪主指针左键，不取消事件，也不接管选区或指针捕获。
  window.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    selectionPointer = event.pointerId;
    const target = event.target;
    selecting = target instanceof Element && (target.matches("input, textarea") || target.isContentEditable);
    if (selecting) releaseFontWork();
  }, { capture: true, passive: true });
  document.addEventListener("selectstart", () => {
    if (selectionPointer === null) return;
    selecting = true;
    releaseFontWork();
  }, { capture: true, passive: true });
  for (const type of ["pointerup", "pointercancel"]) {
    window.addEventListener(type, event => {
      if (event.pointerId === selectionPointer) finishSelection();
    }, { capture: true, passive: true });
  }
  // 在窗口外松开后返回时，以 buttons 校正状态，防止扫描一直暂停。
  window.addEventListener("pointermove", event => {
    if (event.pointerId === selectionPointer && !(event.buttons & 1)) finishSelection();
  }, { capture: true, passive: true });
  window.addEventListener("blur", () => {
    composing = false;
    finishSelection();
  });

  // :dir() 读取 HTML 的实际文字方向，不受扩展 CSS 干扰，也不需要停用样式表。
  function textRecheckRoot(parent) {
    const auto = parent.closest('[dir="auto"]');
    if (!auto) return null;
    return autoDirections.get(auto) === auto.matches(":dir(rtl)") ? null : auto;
  }

  function invalidateTypography() {
    typographyIndex = null;
    typographyContexts = new WeakMap();
    fontSamples.clear();
  }

  function readExternalSheet(sheet) {
    if (!sheet.href || externalSheetPending.has(sheet) || !chrome.runtime?.sendMessage) return;
    externalSheetPending.add(sheet);
    const href = sheet.href;
    chrome.runtime.sendMessage({ type: "sfs-read-stylesheet", url: href }).then(result => {
      if (!result?.css || /@import\b/i.test(result.css) || sheet.href !== href || ![...document.styleSheets].includes(sheet)) return;
      const parsed = new CSSStyleSheet();
      parsed.replaceSync(result.css);
      externalSheetRules.set(sheet, { href, rules: parsed.cssRules });
      invalidateTypography();
      if (settings.enabled && !siteOff) queue(document.documentElement);
    }).catch(() => {});
  }

  // 只为可能改变字体的属性变化重检。高度、颜色、位置等交互样式由浏览器
  // 正常处理，不必为它们停用整张扩展样式表。无法读取的样式表保留完整采样。
  function getTypographyIndex() {
    if (typographyIndex) return typographyIndex;
    const index = { rules: [], classes: new Set(), attributes: new Set(), variables: new Set(), media: [],
      unknown: false, cacheable: true, classAttribute: false, styleAttribute: false };
    const declarations = [];
    const keyframeStyles = [];
    const variableReferences = value => [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map(match => match[1]);
    const visit = (rules, ancestors = [], unsafe = false) => {
      for (const rule of rules) {
        if (rule.styleSheet) {
          try { visit(rule.styleSheet.cssRules, ancestors, unsafe); } catch { index.unknown = true; }
        }
        const selectors = rule.selectorText ? [...ancestors, rule.selectorText] : ancestors;
        if (rule.style && rule.selectorText) declarations.push({ rule, selectors, unsafe });
        if (rule.media) index.media.push(rule.media.mediaText);
        const childUnsafe = unsafe || rule.constructor.name === "CSSContainerRule" || rule.constructor.name === "CSSScopeRule";
        // 字体动画的中间值和嵌套选择器不能通过静态匹配确定，走原始采样路径。
        if (rule.style && !rule.selectorText && rule.keyText && [...rule.style].some(name => FONT_PROPERTY_RE.test(name))) index.unknown = true;
        if (rule.style && rule.keyText) keyframeStyles.push(rule.style);
        if (rule.cssRules) visit(rule.cssRules, selectors, childUnsafe);
      }
    };
    for (const sheet of document.styleSheets) {
      if ([STYLE_ID, CUSTOM_STYLE_ID].includes(sheet.ownerNode?.id)) continue;
      if (sheet.media?.mediaText) index.media.push(sheet.media.mediaText);
      try { visit(sheet.cssRules); } catch {
        const external = externalSheetRules.get(sheet);
        if (external?.href === sheet.href) visit(external.rules);
        else { index.unknown = true; readExternalSheet(sheet); }
      }
    }
    // 字体可能间接依赖 CSS 变量；只跟踪这条依赖链，避免布局变量引发整页补扫。
    for (const { rule } of declarations) {
      for (const name of rule.style) {
        if (FONT_PROPERTY_RE.test(name)) variableReferences(rule.style.getPropertyValue(name)).forEach(name => index.variables.add(name));
      }
    }
    let previousSize;
    do {
      previousSize = index.variables.size;
      for (const { rule } of declarations) {
        for (const name of index.variables) variableReferences(rule.style.getPropertyValue(name)).forEach(name => index.variables.add(name));
      }
    } while (previousSize !== index.variables.size);
    if (keyframeStyles.some(style => [...style].some(name => index.variables.has(name)))) index.unknown = true;
    const identifier = /\.((?:\\[0-9a-fA-F]{1,6}\s?|\\[^\r\n\f]|[\w\u0080-\uffff-])+)/g;
    for (const { rule, selectors, unsafe } of declarations) {
      const names = [...rule.style].filter(name => FONT_PROPERTY_RE.test(name) || index.variables.has(name));
      if (!names.length) continue;
      if (unsafe) index.unknown = true;
      const selector = selectors.join(" ");
      index.rules.push(rule.selectorText);
      if (selectors.length > 1 || /:(?:hover|focus|active|visited|has|nth-|first-|last-|only-|empty|dir|lang|target|checked|disabled|enabled|valid|invalid|read-|placeholder|open)|[+~]|data-sfs-/i.test(selector)) index.cacheable = false;
      if (/:(?:disabled|enabled)/i.test(selector)) index.attributes.add("disabled");
      if (/:(?:link|visited)/i.test(selector)) index.attributes.add("href");
      if (names.some(name => /\b(?:attr|env)\(/.test(rule.style.getPropertyValue(name)))) index.cacheable = false;
      for (const match of selector.matchAll(identifier)) {
        index.classes.add(match[1].replace(/\\([0-9a-fA-F]{1,6})\s?|\\(.)/g, (_, hex, char) => {
          const value = parseInt(hex, 16);
          return hex ? String.fromCodePoint(value > 0 && value <= 0x10ffff ? value : 0xfffd) : char;
        }));
      }
      for (const match of selector.matchAll(/\[\s*([\w-]+)/g)) index.attributes.add(match[1].toLowerCase());
      if (selector.includes("#")) index.attributes.add("id");
      if (index.attributes.has("class")) index.classAttribute = true;
      if (index.attributes.has("style")) index.styleAttribute = true;
      try { document.documentElement.matches(rule.selectorText); } catch { index.unknown = true; }
    }
    typographyIndex = index;
    return index;
  }

  function typographyInline(style, index) {
    return [...style].filter(name => FONT_PROPERTY_RE.test(name) || index.variables.has(name))
      .sort().map(name => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]);
  }

  function attributeAffectsTypography(m, parent) {
    const index = getTypographyIndex();
    if (index.unknown) return true;
    const name = m.attributeName;
    if (["dir", "lang", "contenteditable", "aria-hidden"].includes(name) || index.attributes.has(name) && name !== "class" && name !== "style") return true;
    if (name === "class") {
      if (index.classAttribute) return true;
      const before = new Set((m.oldValue || "").split(/\s+/).filter(Boolean));
      const after = new Set(parent.classList);
      const changed = [...new Set([...before, ...after])].filter(name => before.has(name) !== after.has(name));
      return changed.some(name => index.classes.has(name) || settings.protectIcons && ICON_CLASS_RE.test(name.toLowerCase()));
    }
    if (name === "style") {
      if (index.styleAttribute) return true;
      const oldStyle = document.createElement("span").style;
      oldStyle.cssText = m.oldValue || "";
      return JSON.stringify(typographyInline(oldStyle, index)) !== JSON.stringify(typographyInline(parent.style, index));
    }
    return name === "id" && settings.protectIcons;
  }

  // 相同字体规则、内联字体声明及继承路径复用原样式快照；不改写用户 CSS。
  // 跨域不可读样式、复杂状态选择器和自动文字方向区域使用完整采样。
  function typographyKey(el, index) {
    if (index.unknown || !index.cacheable || el.closest('[dir="auto"]')) return null;
    const context = node => {
      if (!node) return "";
      if (typographyContexts.has(node)) return typographyContexts.get(node);
      const matches = [];
      index.rules.forEach((selector, id) => { if (node.matches(selector)) matches.push(id); });
      const key = context(node.parentElement) + "/" + JSON.stringify([node.tagName, node.getAttribute("type"),
        node.getAttribute("dir"), node.getAttribute("lang"), matches, typographyInline(node.style, index)]);
      typographyContexts.set(node, key);
      return key;
    };
    return index.media.map(query => matchMedia(query).matches ? "1" : "0").join("") + context(el);
  }

  function normalizeFamily(name) {
    return name.trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
  }

  function splitFamilies(value) {
    const out = [];
    let buf = "";
    let quote = null;

    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (quote) {
        buf += ch;
        if (ch === quote && value[i - 1] !== "\\") quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
        buf += ch;
      } else if (ch === ",") {
        if (buf.trim()) out.push(buf.trim());
        buf = "";
      } else {
        buf += ch;
      }
    }
    if (buf.trim()) out.push(buf.trim());
    return out;
  }

  function firstFamily(value) {
    const parts = splitFamilies(value || "");
    return parts.length ? normalizeFamily(parts[0]) : "";
  }

  function computeSiteState() {
    return siteState(settings.siteRules, location);
  }

  // 把站点覆盖落到工作副本上：settings 在每次 loadSettings 时都会
  // 从存储重建，这里的改写不会跨会话残留。
  function applySiteOverrides() {
    for (const key of SITE_OVERRIDE_KEYS) {
      if (key === "standardLigatures") continue;
      const v = siteOverrides[key];
      if (v === "on") settings[key] = true;
      else if (v === "off") settings[key] = false;
    }
    if (siteOverrides.ligatureLevel) settings.ligatureLevel = siteOverrides.ligatureLevel;
  }

  function looksLikeIconElement(el, family) {
    if (!settings.protectIcons) return false;

    const cls = typeof el.className === "string" ? el.className : "";
    const id = el.id || "";
    const signature = `${family} ${cls} ${id}`.toLowerCase();

    return ICON_CLASS_RE.test(signature)
      || ICON_FAMILY_RE.test(signature)
      || el.getAttribute("aria-hidden") === "true" && /icon|symbol|glyph/.test(signature);
  }

  function isProtected(el, computedFamily) {
    if (!(el instanceof Element)) return true;

    const tag = el.tagName.toUpperCase();
    if (tag === "SVG" || tag === "PATH" || tag === "USE" || tag === "IMG" || tag === "CANVAS") {
      return true;
    }

    if (settings.protectCode && (tag === "CODE" || tag === "PRE" || tag === "KBD" || tag === "SAMP")) {
      return true;
    }

    if (settings.protectCode && el.closest("code, pre, kbd, samp")) {
      return true;
    }

    if (el.closest("svg, img, canvas") || looksLikeIconElement(el, computedFamily)) {
      return true;
    }

    return false;
  }

  function ensureRootMark() {
    const root = document.documentElement;
    if (root && !root.hasAttribute(ROOT_MARK)) root.setAttribute(ROOT_MARK, "1");
  }

  // 替换规则挂在 html[data-sfs] 下提高特异性，避免被网站的
  // CSS-in-JS 动态注入样式（如 ChatGPT 的 emotion）压掉。
  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    const font = forceSite && siteFont ? siteFont : settings.replacement;
    const rootSel = `html[${ROOT_MARK}]`;

    // 非空自定义 CSS 接管字体；内容为空时继续使用普通替换链。
    const chainActive = settings.enabled && !(settings.customCSSOn && settings.customCSS.trim());
    const chainRules = chainActive
      ? `
        ${rootSel} [${MARK}="1"] { font-family: ${font} !important; }
        ${rootSel} [${MARK}="1"]::placeholder { font-family: ${font} !important; }
      `
      : "";

    const descendantLigatures = settings.ligatureLevel === "native" ? "" :
      [...ligatureStyles].map(([css, id]) => `${rootSel} [${MARK}="1"][${LIGATURE_MARK}="${id}"] { ${css} }`).join("\n");

    const descendantAutoSpacing = settings.autoSpacing
      ? `
        ${rootSel} [${MARK}="1"] {
          text-autospace: normal !important;
        }
      `
      : "";

    const css = settings.enabled
      ? `
        ${chainRules}
        ${descendantLigatures}
        ${descendantAutoSpacing}
        ${preserveRules()}
      `
      : "";
    if (style.textContent !== css) style.textContent = css;
  }

  // 自定义 CSS 开启时接管页面字体（替换链自动失效），始终注入在扩展自身
  // 样式之后；跟随全局启用开关，也可被站点规则按站点单独开关；空内容不注入。
  // v2：采用"检测到名单字体才注入"策略——cssDetected 为假时保持页面原样。
  function ensureCustomStyle() {
    const css = settings.enabled && settings.customCSSOn && cssDetected
      ? String(settings.customCSS || "")
      : "";

    let style = document.getElementById(CUSTOM_STYLE_ID);

    if (!css.trim()) {
      if (style) style.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = CUSTOM_STYLE_ID;
    }
    if (style.textContent !== css) style.textContent = css;
    const parent = document.head || document.documentElement;
    if (style.parentNode !== parent) parent.appendChild(style);
  }

  // 把扩展样式表挪回 head 末尾，保证同优先级下声明顺序靠后；
  // 自定义样式压轴，冲突时优先于扩展自身规则。
  // 仅在顺序实际改变时移动，避免自身的 DOM 变动触发反复追加。
  function ensureStylePosition() {
    if (!document.head) return;
    const styles = [STYLE_ID, CUSTOM_STYLE_ID].map(id => document.getElementById(id)).filter(Boolean);
    const lastExternal = [...document.head.children].reverse().find(el => !styles.includes(el) && el.matches("style, link[rel='stylesheet']"));
    if (!lastExternal && styles.every(el => el.parentNode === document.head)) return;
    for (const style of styles) {
      if (style.parentNode !== document.head || lastExternal && (style.compareDocumentPosition(lastExternal) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        document.head.appendChild(style);
      }
    }
    const custom = document.getElementById(CUSTOM_STYLE_ID);
    const normal = document.getElementById(STYLE_ID);
    if (custom && normal && (custom.compareDocumentPosition(normal) & Node.DOCUMENT_POSITION_FOLLOWING)) document.head.appendChild(custom);
  }

  const PRESERVE = "data-sfs-preserve";
  const preserved = new Map();
  function preserveRules() {
    if (!settings.enabled || settings.customCSSOn && settings.customCSS.trim()) return "";
    return [...preserved.entries()].map(([css, id]) => `html[${ROOT_MARK}] [${PRESERVE}="${id}"] { ${css} }`).join("\n");
  }

  function unmarkAll() {
    document.querySelectorAll(`[${MARK}], [${PRESERVE}], [${LIGATURE_MARK}]`).forEach(el => {
      el.removeAttribute(MARK);
      el.removeAttribute(PRESERVE);
      el.removeAttribute(LIGATURE_MARK);
    });
    preserved.clear();
    ligatureStyles.clear();
  }

  // 站点规则"关闭覆盖"：撤样式、撤标记、断开观察器，
  // 扩展对当前站点完全静默（用于查看网站原生字体设置）。
  function sleepForSite() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    cancelScans();
    unmarkAll();
    document.documentElement.removeAttribute(ROOT_MARK);
    for (const id of [STYLE_ID, CUSTOM_STYLE_ID]) {
      document.getElementById(id)?.remove();
    }
  }

  function shouldReplace(el, family) {
    if (!settings.enabled || !(el instanceof Element)) return false;

    if (isProtected(el, family)) return false;

    // 站点强制覆盖：跳过首选字体命中名单的判断，保护规则仍然生效。
    if (forceSite) return true;

    return targetSet.has(firstFamily(family));
  }

  function collectTextElements(root) {
    const out = new Set();

    if (root instanceof Element) {
      if (root.matches(EDITABLE_SELECTOR)) out.add(root);
      root.querySelectorAll?.(EDITABLE_SELECTOR).forEach(el => out.add(el));
    }

    const walkerRoot = root === document ? document.documentElement : root;
    if (!walkerRoot) return out;

    const walker = document.createTreeWalker(
      walkerRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }

          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tag = parent.tagName;
          if (
            tag === "SCRIPT" ||
            tag === "STYLE" ||
            tag === "NOSCRIPT" ||
            tag === "TEMPLATE"
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          nonemptyTextNodes.add(node);
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement) out.add(node.parentElement);
    }

    return out;
  }

  // 采样时暂时关闭扩展样式，避免已替换祖先污染动态节点和后续分片。
  function applyBatch(nodes) {
    if (!settings.enabled || siteOff) return;
    const sheets = [STYLE_ID, CUSTOM_STYLE_ID].map(id => document.getElementById(id)?.sheet).filter(Boolean);
    const disabled = sheets.map(sheet => sheet.disabled);
    const snapshots = [];
    const preserveActive = !(settings.customCSSOn && settings.customCSS.trim());
    let stylesChanged = false;
    let index;
    let sampling = false;
    try {
      for (const el of nodes) {
        if (!el.isConnected) continue;
        let cs = null;
        let match = false;
        // 自定义 CSS 接管时不生成保护快照；由 DOM 已能确定受保护的元素无需采样。
        // 普通替换仍读取原字体，以保留已替换祖先下的代码和图标样式。
        if (preserveActive || !isProtected(el, "")) {
          index ||= getTypographyIndex();
          const key = typographyKey(el, index);
          cs = key === null ? null : fontSamples.get(key);
          if (!cs) {
            if (!sampling) {
              sheets.forEach(sheet => { sheet.disabled = true; });
              sampling = true;
            }
            const original = getComputedStyle(el);
            cs = { fontFamily: original.fontFamily, fontFeatureSettings: original.fontFeatureSettings,
              fontVariantLigatures: original.fontVariantLigatures, textAutospace: original.getPropertyValue("text-autospace") || "normal" };
            if (key !== null) {
              if (fontSamples.size >= FONT_SAMPLE_LIMIT) fontSamples.delete(fontSamples.keys().next().value);
              fontSamples.set(key, cs);
            }
          }
          match = shouldReplace(el, cs.fontFamily);
        }
        snapshots.push({
          el, match,
          ligatures: match && settings.ligatureLevel !== "native"
            ? ligatureDeclarations(settings.ligatureLevel, cs.fontFeatureSettings, cs.fontVariantLigatures) : "",
          css: preserveActive && !match
            ? `font-family: ${cs.fontFamily} !important; font-variant-ligatures: ${cs.fontVariantLigatures} !important; font-feature-settings: ${cs.fontFeatureSettings} !important; text-autospace: ${cs.textAutospace} !important;` : ""
        });
        sampledElements.add(el);
        const auto = el.closest('[dir="auto"]');
        if (auto) autoDirections.set(auto, auto.matches(":dir(rtl)"));
      }
    } finally {
      if (sampling) sheets.forEach((sheet, i) => { sheet.disabled = disabled[i]; });
    }

    for (const { el, match, ligatures } of snapshots) {
      setMarker(el, MARK, match ? "1" : null);
      if (match && ligatures) {
        if (!ligatureStyles.has(ligatures)) {
          ligatureStyles.set(ligatures, ligatureStyles.size + 1);
          stylesChanged = true;
        }
        setMarker(el, LIGATURE_MARK, String(ligatureStyles.get(ligatures)));
      } else {
        setMarker(el, LIGATURE_MARK, null);
      }
    }
    for (const { el, match, css } of snapshots) {
      if (css && !match && el.parentElement?.closest(`[${MARK}="1"]`)) {
        if (!preserved.has(css)) {
          preserved.set(css, preserved.size + 1);
          stylesChanged = true;
        }
        setMarker(el, PRESERVE, String(preserved.get(css)));
      } else {
        setMarker(el, PRESERVE, null);
      }
    }
    if (snapshots.some(item => item.match) && settings.customCSSOn && !cssDetected) {
      cssDetected = true;
      ensureCustomStyle();
    }
    const styleMissing = !document.getElementById(STYLE_ID);
    if (stylesChanged || styleMissing) ensureStyle();
    if (styleMissing) ensureStylePosition();
  }

  // 保留未变化的标记，避免同值写入触发页面自身的观察器和样式失效。
  function setMarker(el, name, value) {
    if (value === null) {
      if (el.hasAttribute(name)) el.removeAttribute(name);
    } else if (el.getAttribute(name) !== value) {
      el.setAttribute(name, value);
    }
  }

  function scanSubtree(root) {
    if (!(root instanceof Element) && root !== document) return;

    scanNodes(collectTextElements(root));
  }

  function scanNodes(nodes) {
    if (!nodes.size) return;
    if (!scanning && nodes.size <= SCAN_CHUNK && !editingBusy()) {
      applyBatch(nodes);
      return;
    }

    // 大子树分片处理，避免一次扫描阻塞主线程。
    for (const node of nodes) {
      if (!queuedNodes.has(node)) {
        queuedNodes.add(node);
        scanQueue.push(node);
      }
    }
    scheduleScan();
  }

  function scheduleScan() {
    if (scanning) return;
    scanning = true;

    const epoch = scanEpoch;
    const step = () => {
      if (epoch !== scanEpoch) return;
      if (scanQueue.length) {
        const batch = scanQueue.splice(0, SCAN_CHUNK);
        batch.forEach(node => queuedNodes.delete(node));
        applyBatch(batch);
        scheduleFontWork(step, epoch);
      } else {
        scanning = false;
      }
    };

    scheduleFontWork(step, epoch);
  }

  function flushPending() {
    scheduled = false;

    // 将同一属性的密集写入合并为最初值与最终值，索引分析也避开输入阶段。
    for (const [parent, attributes] of pendingAttributes) {
      if (!parent.isConnected) continue;
      for (const m of attributes.values()) {
        if (m.oldValue !== parent.getAttribute(m.attributeName) && attributeAffectsTypography(m, parent)) {
          typographyContexts = new WeakMap();
          pending.add(parent);
          break;
        }
      }
    }
    pendingAttributes.clear();

    if (styleNeedsReposition) {
      styleNeedsReposition = false;
      ensureStylePosition();
    }

    if (!pending.size) return;

    // 祖先去重：若节点位于另一个待处理节点内部，扫外层一次即可覆盖。
    const work = [];
    for (const node of pending) {
      let p = node.parentElement;
      let redundant = false;
      while (p) {
        if (pending.has(p)) {
          redundant = true;
          break;
        }
        p = p.parentElement;
      }
      if (!redundant) work.push(node);
    }
    pending.clear();

    // 同一帧的独立分支共享一次原始样式采样，避免逐分支开关全局样式表。
    const nodes = new Set();
    for (const node of work) {
      if (node.isConnected) collectTextElements(node).forEach(el => nodes.add(el));
    }
    scanNodes(nodes);
  }

  function queue(node) {
    if (!(node instanceof Element)) return;
    pending.add(node);
    schedulePending();
  }

  function schedulePending() {
    if (!scheduled) {
      scheduled = true;
      scheduleFontWork(flushPending);
    }
  }

  // 合并密集的样式表变化；加载完成的 LINK 也会触发检查。
  function queueStylesheetScan() {
    invalidateTypography();
    if (!settings.enabled || siteOff || stylesheetTimer !== null) return;
    const epoch = scanEpoch;
    stylesheetTimer = setTimeout(() => {
      stylesheetTimer = null;
      if (epoch !== scanEpoch) return;
      styleNeedsReposition = true;
      queue(document.documentElement);
    }, 100);
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        const parent = m.target instanceof Element ? m.target : m.target.parentElement;
        if (!parent || parent.closest(`#${STYLE_ID}, #${CUSTOM_STYLE_ID}`)) continue;
        if (m.type === "attributes" && m.oldValue === parent.getAttribute(m.attributeName)) continue;
        if (m.type === "attributes" && (parent.matches("style, link[rel='stylesheet']")
            || parent.tagName === "LINK" && m.attributeName === "rel" && /(?:^|\s)stylesheet(?:\s|$)/i.test(m.oldValue || ""))) {
          queueStylesheetScan();
        } else if (m.type === "attributes") {
          if (!pendingAttributes.has(parent)) pendingAttributes.set(parent, new Map());
          const attributes = pendingAttributes.get(parent);
          if (!attributes.has(m.attributeName)) attributes.set(m.attributeName, { attributeName: m.attributeName, oldValue: m.oldValue });
          schedulePending();
        } else if (parent.matches("style, link[rel='stylesheet']")) {
          queueStylesheetScan();
        } else if (m.type === "characterData") {
          const populated = !!m.target.nodeValue?.trim();
          const remainedPopulated = populated && nonemptyTextNodes.has(m.target);
          if (populated) nonemptyTextNodes.add(m.target);
          else nonemptyTextNodes.delete(m.target);
          // 流式回答只改变已有非空文本时，字体判断仍有效；属性、结构和样式表
          // 变化分别走重检路径。自动方向只在实际方向改变时重检整个区域。
          const directionRoot = textRecheckRoot(parent);
          if (remainedPopulated && sampledElements.has(parent) && !directionRoot) continue;
          queue(directionRoot || parent);
        } else {
          // React 也可能通过替换文本节点更新内容；非空文本之间的替换不会改变
          // 元素选择器匹配。新元素、首次文字和实际方向变化仍走完整检查。
          const changed = [...m.addedNodes, ...m.removedNodes].filter(node => node instanceof Element || node.nodeType === Node.TEXT_NODE);
          if (!changed.length) continue;
          // 注释不参与字体判断；新节点不影响可缓存选择器的已有祖先匹配。
          // 移动或移除曾参与缓存的元素时，重建继承路径，避免复用旧父级字体。
          if (changed.some(node => node instanceof Element && typographyContexts.has(node))) typographyContexts = new WeakMap();
          const directionRoot = textRecheckRoot(parent);
          if (sampledElements.has(parent) && changed.length && changed.every(node => node.nodeType === Node.TEXT_NODE)
              && !directionRoot) {
            const textNodes = [...parent.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim());
            const previouslyPopulated = [...m.removedNodes, ...textNodes].some(node => nonemptyTextNodes.has(node));
            if (textNodes.length && previouslyPopulated) {
              textNodes.forEach(node => nonemptyTextNodes.add(node));
              continue;
            }
          }
          if (directionRoot) queue(directionRoot);
          for (const node of changed) {
            if (node instanceof Element && [STYLE_ID, CUSTOM_STYLE_ID].includes(node.id)) {
              if (!node.isConnected) queue(document.documentElement);
              continue;
            }
            if (node instanceof Element && node.matches("style, link[rel='stylesheet']")) {
              queueStylesheetScan();
            } else if (node.isConnected) {
              queue(node instanceof Element ? node : node.parentElement);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true,
      attributeFilter: ["class", "style", "id", "contenteditable", "aria-hidden", "href", "media", "disabled", "dir", "lang", "rel"]
    });
  }

  async function loadSettings() {
    const epoch = ++loadEpoch;
    let stored;
    try {
      stored = await chrome.storage.sync.get(null);
    } catch (error) {
      console.warn("sfs settings load failed:", error);
      return;
    }
    if (epoch !== loadEpoch) return;
    if (observer) observer.disconnect();
    cancelScans();
    settings = normalizeSettings(stored);
    cssGeneration = stored[META_KEY]?.id || null;
    siteCSSGenerations = Array.isArray(stored.siteRules) ? stored.siteRules.map(rule => rule?.customCSSChunks?.id).filter(Boolean) : [];
    targetSet = new Set(settings.targets.map(normalizeFamily).filter(Boolean));
    const site = computeSiteState();
    siteOff = site.off;
    forceSite = site.force;
    siteFont = site.font;
    siteOverrides = site.overrides;
    applySiteOverrides();
    if (site.customCSS !== null) settings.customCSS = site.customCSS;
    cssDetected = false;
    if (siteOff || !settings.enabled) {
      sleepForSite();
      return;
    }
    unmarkAll();
    ensureRootMark();
    ensureStyle();
    ensureCustomStyle();
    startObserver();
    scanSubtree(document);
    if (document.fonts?.status === "loading") {
      document.fonts.ready.then(() => {
        if (epoch === loadEpoch && settings.enabled && !siteOff && document.fonts.size) queue(document.documentElement);
      }).catch(() => {});
    }
  }

  document.addEventListener("load", event => {
    if (event.target instanceof Element && event.target.matches("link[rel='stylesheet']")) queueStylesheetScan();
  }, true);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    // 已发布的新引用不受旧块清理影响；仅重新读取设置与当前 CSS 块。
    const relevant = Object.keys(changes).some(key =>
      key === META_KEY || key in DEFAULTS && key !== "customCSS"
      || siteCSSGenerations.some(id => key.startsWith(SITE_CC_PREFIX + id + "/"))
      || (cssGeneration ? key.startsWith(CC_PREFIX + cssGeneration + "/") : key === "customCSS" || /^customCSS#\d+$/.test(key))
    );
    if (relevant) loadSettings();
  });

  if (document.documentElement) {
    loadSettings();
  } else {
    new MutationObserver((_, obs) => {
      if (document.documentElement) {
        obs.disconnect();
        loadSettings();
      }
    }).observe(document, { childList: true, subtree: true });
  }
})();
