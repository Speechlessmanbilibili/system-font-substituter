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
  const VIDEO_SCAN_INTERVAL_MS = 200;
  const VIDEO_SCAN_CHUNK = 64;

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
  let viewportTimer = null;
  let scanQueue = [];
  let scanOffset = 0;
  const queuedNodes = new Set();
  let scanning = false;
  let scanEpoch = 0;
  let loadEpoch = 0;
  let appliedConfiguration = null;
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
  let videoTimer = null;
  let videoIdleTask = null;
  const videoFontWork = new Set();
  const activeVideos = new Set();
  let typographyIndex = null;
  let typographyContexts = new WeakMap();
  const contextIds = new Map();
  let nextContextId = 1;
  const CONTEXT_LIMIT = 4096;
  const CONTEXT_INVALIDATION_LIMIT = 128;
  const fontSamples = new Map();
  const fontResults = new Map();
  const FONT_SAMPLE_LIMIT = 1024;
  const NONSPACE_RE = /\S/;
  // 字号、字重等仍由浏览器正常排版；只有影响判断或原样式快照的声明参与索引。
  const FONT_PROPERTY_RE = /^(?:font|font-family|font-feature-settings|font-variant|font-variant-ligatures|text-autospace|direction|unicode-bidi|all)$/;
  const FONT_INLINE_RE = /(?:^|;)\s*(?:font|font-family|font-feature-settings|font-variant|font-variant-ligatures|text-autospace|direction|unicode-bidi|all)\s*:/i;
  const externalSheetRules = new WeakMap();
  const externalSheetPending = new WeakSet();
  const mediaListeners = [];
  const OBSERVER_ATTRIBUTES = ["class", "style", "id", "type", "contenteditable", "aria-hidden", "href", "media", "disabled", "dir", "lang", "rel"];
  let observedAttributes = "";

  function observeAttributes(index) {
    if (!observer) return;
    const attributes = [...new Set([...OBSERVER_ATTRIBUTES, ...(index?.attributes || [])])]
      .filter(name => !name.startsWith("data-sfs")).sort();
    const signature = attributes.join("/");
    if (signature === observedAttributes) return;
    observedAttributes = signature;
    observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true,
      attributes: true, attributeOldValue: true, attributeFilter: attributes });
  }

  function cancelScans() {
    scanEpoch++;
    scanQueue = [];
    scanOffset = 0;
    queuedNodes.clear();
    pending.clear();
    pendingAttributes.clear();
    deferredFontWork.clear();
    videoFontWork.clear();
    activeVideos.clear();
    clearTimeout(videoTimer);
    videoTimer = null;
    if (videoIdleTask !== null) cancelIdleCallback(videoIdleTask);
    videoIdleTask = null;
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
    clearTimeout(viewportTimer);
    viewportTimer = null;
  }

  function editingBusy() {
    return composing || selecting || performance.now() < inputDeadline;
  }

  function videoPlaying() {
    for (const video of activeVideos) trackVideo(video);
    return activeVideos.size > 0;
  }

  function trackVideo(video) {
    if (video.isConnected && !video.paused && !video.ended && video.readyState >= 2) activeVideos.add(video);
    else activeVideos.delete(video);
  }

  // 播放期间把动画、弹幕等变动合并到空闲时段，限制单批采样量。
  // 设置和真正的字体变化仍最终处理，不改变用户 CSS 或播放器行为。
  function scheduleVideoWork(task) {
    videoFontWork.add(task);
    if (videoTimer !== null || videoIdleTask !== null) return;
    videoTimer = setTimeout(() => {
      videoTimer = null;
      videoIdleTask = requestIdleCallback(() => {
        videoIdleTask = null;
        const work = [...videoFontWork];
        videoFontWork.clear();
        work.forEach(run => run());
      }, { timeout: VIDEO_SCAN_INTERVAL_MS });
    }, VIDEO_SCAN_INTERVAL_MS);
  }

  function releaseVideoWork() {
    if (!videoFontWork.size || videoPlaying()) return;
    clearTimeout(videoTimer);
    videoTimer = null;
    if (videoIdleTask !== null) cancelIdleCallback(videoIdleTask);
    videoIdleTask = null;
    const work = [...videoFontWork];
    videoFontWork.clear();
    work.forEach(run => requestAnimationFrame(run));
  }

  // 由原生事件维护正在播放的视频，避免每次调度都查询整页 DOM。
  // 暂停、结束或移除最后一个视频后恢复普通调度。
  for (const type of ["playing", "loadeddata", "canplay", "pause", "ended", "emptied"]) {
    document.addEventListener(type, event => {
      if (!(event.target instanceof HTMLVideoElement)) return;
      trackVideo(event.target);
      videoPlaying();
      releaseVideoWork();
    }, true);
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
    work.forEach(task => videoPlaying() ? scheduleVideoWork(task) : requestAnimationFrame(task));
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
    if (videoPlaying()) scheduleVideoWork(run);
    else requestAnimationFrame(run);
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
    for (const [query, listener] of mediaListeners) query.removeEventListener("change", listener);
    mediaListeners.length = 0;
    typographyIndex = null;
    typographyContexts = new WeakMap();
    contextIds.clear();
    nextContextId = 1;
    fontSamples.clear();
    fontResults.clear();
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
      queueStylesheetScan();
    }).catch(() => {});
  }

  // 只为可能改变字体的属性变化重检。高度、颜色、位置等交互样式由浏览器
  // 正常处理，不必为它们停用整张扩展样式表。无法读取的样式表保留完整采样。
  function selectorList(selector) {
    // 选择器列表中的逗号可能位于函数、属性或引号中，不能直接按逗号拆分。
    const selectors = [];
    let start = 0, depth = 0, quote = null;
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      if (char === "\\") { i++; continue; }
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === "(" || char === "[") depth++;
      else if (char === ")" || char === "]") depth--;
      else if (char === "," && !depth) { selectors.push(selector.slice(start, i)); start = i + 1; }
    }
    selectors.push(selector.slice(start));
    return selectors;
  }

  function elementSelectors(selector) {
    // 伪元素的字体不参与 getComputedStyle(element) 的结果，也不会传回宿主。
    // 不把图标 ::before 等规则的 [class] 条件扩大成全页属性依赖。
    return selectorList(selector).filter(part => {
      let bracket = 0, quote = null;
      for (let i = 0; i < part.length; i++) {
        const char = part[i];
        if (char === "\\") { i++; continue; }
        if (quote) { if (char === quote) quote = null; continue; }
        if (char === '"' || char === "'") quote = char;
        else if (char === "[") bracket++;
        else if (char === "]") bracket--;
        else if (!bracket && char === ":" && /^(?:::|:(?:before|after|first-letter|first-line)\b)/i.test(part.slice(i))) return false;
      }
      return true;
    }).join(",");
  }

  // 收集最后一个复合选择器中的必要条件，保留函数和属性内部的原义。
  // 函数与属性内部的分隔符不参与切分；转义、命名空间等继续完整匹配。
  function selectorAnchors(selector) {
    if (/\\|[^\x00-\x7f]|\/\*/.test(selector)) return null;
    let start = 0, depth = 0, quote = null;
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") quote = char;
      else if (char === "(" || char === "[") depth++;
      else if (char === ")" || char === "]") depth--;
      else if (!depth && /[\s>+~]/.test(char)) start = i + 1;
    }
    const compound = selector.slice(start).trim();
    const anchors = [];
    depth = 0;
    quote = null;
    for (let i = 0; i < compound.length; i++) {
      const char = compound[i];
      if (quote) { if (char === quote) quote = null; continue; }
      if (char === '"' || char === "'") { quote = char; continue; }
      if (char === "(" || char === "[") { depth++; continue; }
      if (char === ")" || char === "]") { depth--; continue; }
      if (depth) continue;
      if (char === "|") return null;
      if (i === 0 || char === "." || char === "#") {
        const match = compound.slice(i).match(/^([.#]?)([a-zA-Z_][\w-]*)(?=[.#\[:]|$)/);
        if (match) {
          anchors.push({ kind: match[1], name: match[1] ? match[2] : match[2].toUpperCase() });
          i += match[0].length - 1;
        }
      }
    }
    return anchors.length ? anchors : null;
  }

  function decodeIdentifier(value) {
    return value.replace(/\\([0-9a-fA-F]{1,6})(?:\r\n|[ \t\r\n\f])?|\\([^\r\n\f])/g, (_, hex, char) => {
      const code = parseInt(hex, 16);
      return hex ? String.fromCodePoint(code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? code : 0xfffd) : char;
    });
  }

  function cssIdentifierAt(value, offset) {
    const raw = value.slice(offset).match(/^(?:\\[0-9a-fA-F]{1,6}(?:\r\n|[ \t\r\n\f])?|\\[^\r\n\f]|[-_a-zA-Z0-9\u0080-\uffff])+/)?.[0];
    return raw ? { name: decodeIdentifier(raw), end: offset + raw.length } : null;
  }

  function cssSpaceEnd(value, offset) {
    while (offset < value.length) {
      if (/[ \t\r\n\f]/.test(value[offset])) offset++;
      else if (value.startsWith("/*", offset)) {
        const end = value.indexOf("*/", offset + 2);
        offset = end < 0 ? value.length : end + 2;
      } else break;
    }
    return offset;
  }

  // CSSOM 会保留 var() 参数的原始转义、大小写和注释；按标识符读取并解码。
  // 字符串、注释及非 var 函数名称中的文字不建立依赖，嵌套回退继续遍历。
  function variableReferences(value) {
    if (!value.includes("(")) return [];
    const names = new Set();
    for (let i = 0; i < value.length;) {
      const next = cssSpaceEnd(value, i);
      if (next !== i) { i = next; continue; }
      const char = value[i];
      if (char === '"' || char === "'") {
        for (i++; i < value.length; i++) {
          if (value[i] === "\\") i++;
          else if (value[i] === char) { i++; break; }
        }
        continue;
      }
      if (char === "@" || char === "#") { i = cssIdentifierAt(value, i + 1)?.end || i + 1; continue; }
      const token = cssIdentifierAt(value, i);
      if (!token) { i++; continue; }
      const fn = token.name.toLowerCase();
      if (value[token.end] === "(") {
        const start = cssSpaceEnd(value, token.end + 1);
        if (fn === "var") {
          const reference = cssIdentifierAt(value, start);
          const end = reference ? cssSpaceEnd(value, reference.end) : start;
          if (reference?.name.startsWith("--") && reference.name !== "--" && [",", ")"].includes(value[end])) names.add(reference.name);
        } else if (fn === "url" && value[start] !== '"' && value[start] !== "'") {
          // 未加引号的 URL 是独立词法单元，内部文字不作为函数解析。
          i = start;
          while (i < value.length && value[i] !== ")") { if (value[i] === "\\") i++; i++; }
          i++;
          continue;
        }
      }
      i = token.end;
    }
    return [...names];
  }

  function inlineAddsVariableDependency(style, index) {
    for (const name of style) {
      if (FONT_PROPERTY_RE.test(name)) {
        if (variableReferences(style.getPropertyValue(name)).some(reference => !index.variables.has(reference))) return true;
      } else if (index.variables.has(name)) {
        if (variableReferences(style.getPropertyValue(name)).some(reference => !index.variableDependencies.get(name)?.has(reference))) return true;
      }
    }
    return false;
  }

  // 属性值和字符串中的标点不表示关系或状态；转义标点也保留标识符原义。
  // 函数内部的选择器继续分析，属性名单独记录，供观察器跟踪真实依赖。
  function selectorDependencies(selector) {
    const identifier = /^(?:\\[0-9a-fA-F]{1,6}\s?|\\[^\r\n\f]|[\w\u0080-\uffff-])+/;
    const classes = new Set(), attributes = new Set();
    let syntax = "", id = false;
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      if (char === "\\") {
        const escape = selector.slice(i).match(/^\\(?:[0-9a-fA-F]{1,6}\s?|[^\r\n\f])/);
        if (!escape) { syntax += "_"; continue; }
        const decoded = decodeIdentifier(escape[0]);
        syntax += /^[\w-]$/.test(decoded) ? decoded : "_";
        i += escape[0].length - 1;
        continue;
      }
      if (char === "[" || char === '"' || char === "'") {
        if (char === "[") {
          let start = i + 1;
          while (/\s/.test(selector[start] || "") && start < selector.length) start++;
          let name = selector.slice(start).match(identifier)?.[0] || "";
          start += name.length;
          if (selector[start] === "*" && !name) start++;
          if (selector[start] === "|" && selector[start + 1] !== "=") name = selector.slice(start + 1).match(identifier)?.[0] || "";
          if (name) attributes.add(decodeIdentifier(name).toLowerCase());
        }
        let quote = char === "[" ? null : char;
        for (i++; i < selector.length; i++) {
          const next = selector[i];
          if (next === "\\") { i++; continue; }
          if (quote) {
            if (next === quote) { quote = null; if (char !== "[") break; }
          } else if (next === '"' || next === "'") quote = next;
          else if (next === "]" && char === "[") break;
        }
        syntax += " ";
        continue;
      }
      if (char === ".") {
        const name = selector.slice(i + 1).match(identifier)?.[0];
        if (name) classes.add(decodeIdentifier(name));
      } else if (char === "#") id = true;
      syntax += char;
    }
    return { syntax, classes, attributes, id };
  }

  function getTypographyIndex() {
    if (typographyIndex) return typographyIndex;
    const index = { rules: [], classes: new Set(), attributes: new Set(), variables: new Set(), media: [],
      classRules: new Map(), idRules: new Map(), tagRules: new Map(), generalRules: [], exactRules: new Set(),
      unknown: false, cacheable: true, relational: false, classAttribute: false, styleAttribute: false };
    const declarations = [];
    const anchoredRules = [];
    const anchorFrequency = new Map();
    const keyframeStyles = [];
    const visit = (rules, ancestors = [], unsafe = false, media = []) => {
      for (const rule of rules) {
        const queries = rule.media?.mediaText ? [...media, rule.media.mediaText] : media;
        if (rule.styleSheet) {
          try { visit(rule.styleSheet.cssRules, ancestors, unsafe, queries); } catch { index.unknown = true; }
        }
        const selector = rule.selectorText ? elementSelectors(rule.selectorText) : "";
        const selectors = selector ? [...ancestors, selector] : ancestors;
        if (rule.style && selector) declarations.push({ rule, selector, selectors, unsafe, media: queries });
        const childUnsafe = unsafe || rule.constructor.name === "CSSContainerRule" || rule.constructor.name === "CSSScopeRule";
        // 字体动画的中间值和嵌套选择器不能通过静态匹配确定，走原始采样路径。
        if (rule.style && !rule.selectorText && rule.keyText && [...rule.style].some(name => FONT_PROPERTY_RE.test(name))) index.unknown = true;
        if (rule.style && rule.keyText) keyframeStyles.push(rule.style);
        if (rule.cssRules) visit(rule.cssRules, selectors, childUnsafe, queries);
      }
    };
    for (const sheet of document.styleSheets) {
      if ([STYLE_ID, CUSTOM_STYLE_ID].includes(sheet.ownerNode?.id)) continue;
      const media = sheet.media?.mediaText ? [sheet.media.mediaText] : [];
      try { visit(sheet.cssRules, [], false, media); } catch {
        const external = externalSheetRules.get(sheet);
        if (external?.href === sheet.href) visit(external.rules, [], false, media);
        else { index.unknown = true; readExternalSheet(sheet); }
      }
    }
    // 字体可能间接依赖 CSS 变量；只跟踪这条依赖链，避免布局变量引发整页补扫。
    const variableDependencies = index.variableDependencies = new Map();
    const variableStyles = [...declarations.map(({ rule }) => rule.style),
      ...[...document.querySelectorAll("[style]")].map(el => el.style)];
    for (const style of variableStyles) {
      for (const name of style) {
        if (FONT_PROPERTY_RE.test(name)) variableReferences(style.getPropertyValue(name)).forEach(name => index.variables.add(name));
        if (name.startsWith("--")) {
          if (!variableDependencies.has(name)) variableDependencies.set(name, new Set());
          variableReferences(style.getPropertyValue(name)).forEach(reference => variableDependencies.get(name).add(reference));
        }
      }
    }
    const variables = [...index.variables];
    for (let i = 0; i < variables.length; i++) {
      for (const name of variableDependencies.get(variables[i]) || []) {
        if (!index.variables.has(name)) { index.variables.add(name); variables.push(name); }
      }
    }
    if (keyframeStyles.some(style => [...style].some(name => index.variables.has(name)))) index.unknown = true;
    for (const { rule, selector: elementSelector, selectors, unsafe, media } of declarations) {
      const names = [...rule.style].filter(name => FONT_PROPERTY_RE.test(name) || index.variables.has(name));
      if (!names.length) continue;
      index.media.push(...media);
      if (unsafe) index.unknown = true;
      const selector = selectors.join(" ");
      const dependencies = selectorDependencies(selector);
      const syntax = dependencies.syntax;
      const id = index.rules.push(elementSelector) - 1;
      // 列表中每个分支都有必要条件时，按这些条件查找候选，再由浏览器判断。
      const simple = elementSelector.trim().match(/^([.#]?)([a-zA-Z_][\w-]*)$/);
      // 单个类名或 ID 解码后可精确索引；复合转义选择器继续完整匹配。
      const literal = elementSelector.trim().match(/^([.#])((?:\\[0-9a-fA-F]{1,6}\s?|\\[^\r\n\f]|[\w\u0080-\uffff-])+)$/);
      const branches = literal ? [[{ kind: literal[1], name: decodeIdentifier(literal[2]) }]]
        : selectorList(elementSelector.trim()).map(part => selectorAnchors(part.trim()));
      if (branches.every(Boolean) && document.compatMode !== "BackCompat") {
        anchoredRules.push({ id, branches });
        for (const branch of branches) {
          for (const key of new Set(branch.map(anchor => anchor.kind + anchor.name))) {
            anchorFrequency.set(key, (anchorFrequency.get(key) || 0) + 1);
          }
        }
        if (literal) index.exactRules.add(id);
      } else index.generalRules.push(id);
      if (selectors.length > 1 || /:(?:hover|focus|active|visited|has|nth-|first-|last-|only-|empty|dir|lang|target|checked|disabled|enabled|valid|invalid|read-|placeholder|open)|[+~]|data-sfs-/i.test(syntax) || [...dependencies.attributes].some(name => name.startsWith("data-sfs-"))) index.cacheable = false;
      if (selectors.length > 1 || /:(?:has|nth-|first-|last-|only-|empty)|[+~]/i.test(syntax)) index.relational = true;
      if (/:(?:disabled|enabled)/i.test(syntax)) index.attributes.add("disabled");
      if (/:(?:link|visited)/i.test(syntax)) index.attributes.add("href");
      if (names.some(name => /\b(?:attr|env)\(/.test(rule.style.getPropertyValue(name)))) index.cacheable = false;
      dependencies.classes.forEach(name => index.classes.add(name));
      dependencies.attributes.forEach(name => index.attributes.add(name));
      if (dependencies.id) index.attributes.add("id");
      if (index.attributes.has("class")) index.classAttribute = true;
      if (index.attributes.has("style")) index.styleAttribute = true;
      if (!simple || document.compatMode === "BackCompat") {
        try { document.documentElement.matches(elementSelector); } catch { index.unknown = true; }
      }
    }
    // 优先使用在字体规则中较少出现的条件，省去通用标签和类名的大量候选。
    const priority = kind => kind === "#" ? 0 : kind === "." ? 1 : 2;
    for (const { id, branches } of anchoredRules) {
      for (const branch of branches) {
        const anchor = branch.reduce((best, next) => {
          const a = anchorFrequency.get(best.kind + best.name), b = anchorFrequency.get(next.kind + next.name);
          return b < a || b === a && priority(next.kind) < priority(best.kind) ? next : best;
        });
        const map = anchor.kind === "." ? index.classRules : anchor.kind === "#" ? index.idRules : index.tagRules;
        if (!map.has(anchor.name)) map.set(anchor.name, []);
        map.get(anchor.name).push(id);
      }
    }
    typographyIndex = index;
    index.media = [...new Set(index.media)];
    for (const media of index.media) {
      const query = matchMedia(media);
      const listener = () => { if (settings.enabled && !siteOff) queue(document.documentElement); };
      query.addEventListener("change", listener);
      mediaListeners.push([query, listener]);
    }
    observeAttributes(index);
    return index;
  }

  function typographyInline(style, index) {
    return [...style].filter(name => FONT_PROPERTY_RE.test(name) || index.variables.has(name))
      .sort().map(name => [name, style.getPropertyValue(name), style.getPropertyPriority(name)]);
  }

  function inlineCouldAffectTypography(value, index) {
    return FONT_INLINE_RE.test(value) || /\\|\/\*/.test(value) || index.variables.size && value.includes("--");
  }

  // 小分支变化只清除该分支的继承路径；大分支直接重建整页缓存，限制清理开销。
  function forgetTypographyBranch(root) {
    if (!typographyContexts.has(root)) return;
    if (root === document.documentElement || root === document.body || root.childElementCount > CONTEXT_INVALIDATION_LIMIT) {
      typographyContexts = new WeakMap();
      return;
    }
    typographyContexts.delete(root);
    if (!root.firstElementChild) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
      // 已缓存的后代在采样时也会缓存其祖先；缺少缓存的分支可整体跳过。
      acceptNode(node) { return typographyContexts.has(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    let count = 0, node;
    while ((node = walker.nextNode())) {
      typographyContexts.delete(node);
      if (++count >= CONTEXT_INVALIDATION_LIMIT) {
        typographyContexts = new WeakMap();
        break;
      }
    }
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
      const before = m.oldValue || "", after = parent.getAttribute("style") || "";
      // 无字体声明的布局样式直接过滤；转义、注释和变量保留完整 CSS 解析。
      if (!inlineCouldAffectTypography(before, index) && !inlineCouldAffectTypography(after, index)) return false;
      const oldStyle = document.createElement("span").style;
      oldStyle.cssText = before;
      const relevant = new Set([...oldStyle, ...parent.style].filter(name => FONT_PROPERTY_RE.test(name) || index.variables.has(name)));
      // 引用关系变化时重新分析当前样式，纳入新依赖并更新相关规则/媒体条件。
      if ([...relevant].some(name => JSON.stringify(variableReferences(oldStyle.getPropertyValue(name)))
          !== JSON.stringify(variableReferences(parent.style.getPropertyValue(name))))) {
        invalidateTypography();
        getTypographyIndex();
        return true;
      }
      return JSON.stringify(typographyInline(oldStyle, index)) !== JSON.stringify(typographyInline(parent.style, index));
    }
    return name === "id" && settings.protectIcons;
  }

  // 相同字体规则、内联字体声明及继承路径复用原样式快照；不改写用户 CSS。
  // 跨域不可读样式、复杂状态选择器和自动文字方向区域使用完整采样。
  function typographyKey(el, index, mediaKey, auto) {
    if (index.unknown || !index.cacheable || auto) return null;
    const path = [];
    let ancestor = el;
    while (ancestor && !typographyContexts.has(ancestor)) {
      path.push(ancestor);
      ancestor = ancestor.parentElement;
    }
    let parentId = ancestor ? typographyContexts.get(ancestor) : 0;
    while (path.length) {
      const node = path.pop();
      const candidates = new Set([...index.generalRules, ...(index.tagRules.get(node.tagName.toUpperCase()) || []),
        ...(index.idRules.get(node.id) || [])]);
      // 标准模式下，已通过 classList/id 精确命中的简单规则无需再次调用 matches。
      const matches = [];
      for (const name of node.classList) for (const id of index.classRules.get(name) || []) candidates.add(id);
      candidates.forEach(id => { if (index.exactRules.has(id) || node.matches(index.rules[id])) matches.push(id); });
      matches.sort((a, b) => a - b);
      const key = JSON.stringify([parentId, node.tagName, node.getAttribute("type"),
        node.getAttribute("dir"), node.getAttribute("lang"), matches, typographyInline(node.style, index)]);
      let id = contextIds.get(key);
      if (id === undefined) {
        id = nextContextId++;
        if (contextIds.size >= CONTEXT_LIMIT) contextIds.delete(contextIds.keys().next().value);
        contextIds.set(key, id);
      }
      typographyContexts.set(node, id);
      parentId = id;
    }
    return mediaKey + "/" + parentId;
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

  function elementState(el, parents) {
    const parent = el.parentElement;
    let inherited = parents.get(parent);
    if (!inherited) {
      // 仅在本批内复用共同父级的祖先查询，下一批重新读取结构与方向。
      inherited = {
        code: settings.protectCode && !!parent?.closest("code, pre, kbd, samp"),
        graphics: !!parent?.closest("svg, img, canvas"),
        auto: parent?.closest('[dir="auto"]') || null
      };
      parents.set(parent, inherited);
    }
    const tag = el.tagName.toUpperCase();
    return {
      protected: inherited.graphics || ["SVG", "PATH", "USE", "IMG", "CANVAS"].includes(tag)
        || settings.protectCode && (inherited.code || ["CODE", "PRE", "KBD", "SAMP"].includes(tag)),
      auto: el.hasAttribute("dir") && el.matches('[dir="auto"]') ? el : inherited.auto
    };
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

  function fontResult(original, preserveActive) {
    const values = [original.fontFamily, original.fontFeatureSettings, original.fontVariantLigatures,
      original.getPropertyValue("text-autospace") || "normal"];
    const key = JSON.stringify(values);
    let result = fontResults.get(key);
    if (!result) {
      const [fontFamily, fontFeatureSettings, fontVariantLigatures, textAutospace] = values;
      result = { fontFamily, target: forceSite || targetSet.has(firstFamily(fontFamily)),
        ligatures: ligatureDeclarations(settings.ligatureLevel, fontFeatureSettings, fontVariantLigatures),
        preserveCSS: preserveActive
          ? `font-family: ${fontFamily} !important; font-variant-ligatures: ${fontVariantLigatures} !important; font-feature-settings: ${fontFeatureSettings} !important; text-autospace: ${textAutospace} !important;` : "" };
      if (fontResults.size >= FONT_SAMPLE_LIMIT) fontResults.delete(fontResults.keys().next().value);
      fontResults.set(key, result);
    }
    return result;
  }

  // 只判断是否含有非空白字符，不截取长文本或扫描已有文字之后的大段空白。
  function hasText(node) {
    return NONSPACE_RE.test(node.nodeValue || "");
  }

  function collectTextElements(root) {
    const out = new Set();
    const walkerRoot = root === document ? document.documentElement : root;
    if (!walkerRoot) return out;

    if (walkerRoot instanceof Element) {
      if (walkerRoot.matches(EDITABLE_SELECTOR)) out.add(walkerRoot);
      // 叶子节点直接收集文本，省去高频菜单和批量新增节点的查询与遍历器创建。
      if (!walkerRoot.firstElementChild) {
        if (!["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(walkerRoot.tagName)) {
          for (const node of walkerRoot.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && hasText(node)) {
              nonemptyTextNodes.add(node);
              out.add(walkerRoot);
            }
          }
        }
        return out;
      }
      walkerRoot.querySelectorAll(EDITABLE_SELECTOR).forEach(el => out.add(el));
    }

    const walker = document.createTreeWalker(
      walkerRoot,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
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

          if (!hasText(node)) return NodeFilter.FILTER_REJECT;

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
    const parents = new Map();
    const autoRoots = new Set();
    const preserveActive = !(settings.customCSSOn && settings.customCSS.trim());
    // 强制站点无需名单判断；原生连字、关闭图标保护且由 CSS 接管时无需原样式。
    const directForce = forceSite && !preserveActive && !settings.protectIcons && settings.ligatureLevel === "native";
    let stylesChanged = false;
    let index;
    let mediaKey;
    let sampling = false;
    try {
      for (const el of nodes) {
        if (!el.isConnected) continue;
        const state = elementState(el, parents);
        let cs = null;
        let match = false;
        // 自定义 CSS 接管时不生成保护快照；由 DOM 已能确定受保护的元素无需采样。
        // 普通替换仍读取原字体，以保留已替换祖先下的代码和图标样式。
        if (directForce) {
          match = !state.protected;
        } else if (preserveActive || !state.protected && !looksLikeIconElement(el, "")) {
          index ||= getTypographyIndex();
          mediaKey ??= index.media.map(query => matchMedia(query).matches ? "1" : "0").join("");
          const key = typographyKey(el, index, mediaKey, state.auto);
          cs = key === null ? null : fontSamples.get(key);
          if (!cs) {
            if (!sampling) {
              sheets.forEach(sheet => { sheet.disabled = true; });
              sampling = true;
            }
            // 相同原字体结果共享名单判断、连字声明和保护样式，包括完整采样路径。
            cs = fontResult(getComputedStyle(el), preserveActive);
            if (key !== null) {
              if (fontSamples.size >= FONT_SAMPLE_LIMIT) fontSamples.delete(fontSamples.keys().next().value);
              fontSamples.set(key, cs);
            }
          }
          match = cs.target && !state.protected && !looksLikeIconElement(el, cs.fontFamily);
        }
        snapshots.push({
          el, match,
          ligatures: match ? cs?.ligatures || "" : "",
          css: preserveActive && !match ? cs.preserveCSS : ""
        });
        sampledElements.add(el);
        if (state.auto) autoRoots.add(state.auto);
      }
    } finally {
      if (sampling) sheets.forEach((sheet, i) => { sheet.disabled = disabled[i]; });
    }
    for (const auto of autoRoots) autoDirections.set(auto, auto.matches(":dir(rtl)"));

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
    const chunk = videoPlaying() ? VIDEO_SCAN_CHUNK : SCAN_CHUNK;
    if (!scanning && nodes.size <= chunk && !editingBusy()) {
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
      if (scanOffset < scanQueue.length) {
        const batch = [];
        const chunk = videoPlaying() ? VIDEO_SCAN_CHUNK : SCAN_CHUNK;
        // 按游标消耗队列，及时释放已处理节点；已移除节点不占后续采样分片。
        while (scanOffset < scanQueue.length && batch.length < chunk) {
          const node = scanQueue[scanOffset];
          scanQueue[scanOffset++] = null;
          queuedNodes.delete(node);
          if (node.isConnected) batch.push(node);
        }
        if (batch.length) applyBatch(batch);
        if (scanOffset < scanQueue.length) {
          // 连续入队时合并释放前半段空槽，限制游标队列长期积累的数组空间。
          if (scanOffset >= SCAN_CHUNK && scanOffset >= scanQueue.length / 2) {
            scanQueue = scanQueue.slice(scanOffset);
            scanOffset = 0;
          }
          scheduleFontWork(step, epoch);
        }
        else {
          scanQueue = [];
          scanOffset = 0;
          scanning = false;
        }
      } else {
        scanQueue = [];
        scanOffset = 0;
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
          forgetTypographyBranch(parent);
          pending.add(typographyIndex?.relational ? document.documentElement : parent);
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
    const ancestorCoverage = new Map();
    for (const node of pending) {
      let p = node.parentElement;
      const path = [];
      let redundant = false;
      while (p) {
        if (pending.has(p)) {
          redundant = true;
          break;
        }
        if (ancestorCoverage.has(p)) {
          redundant = ancestorCoverage.get(p);
          break;
        }
        path.push(p);
        p = p.parentElement;
      }
      // 同批兄弟节点复用共同祖先的覆盖结果，深层区域无需逐节点走到根部。
      for (const ancestor of path) ancestorCoverage.set(ancestor, redundant);
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

  // 新增、移动和移除整段子树时，同步发现内部样式表和已在播放的视频。
  // 包含样式表的变动由整页补扫覆盖，不再单独重复扫描该子树。
  function inspectResources(node) {
    const selector = "style, link[rel='stylesheet'], video, [style]";
    const resources = node.firstElementChild ? [...node.querySelectorAll(selector)] : [];
    if (node.matches(selector)) resources.push(node);
    let stylesheet = false;
    let video = false;
    for (const resource of resources) {
      if (resource instanceof HTMLVideoElement) {
        trackVideo(resource);
        video = true;
      } else if (resource.matches("style, link[rel='stylesheet']")) {
        if (![STYLE_ID, CUSTOM_STYLE_ID].includes(resource.id)) stylesheet = true;
      } else if (resource.isConnected && typographyIndex && inlineAddsVariableDependency(resource.style, typographyIndex)) stylesheet = true;
    }
    if (video) releaseVideoWork();
    if (stylesheet) queueStylesheetScan();
    return stylesheet;
  }

  function startObserver() {
    if (observer) observer.disconnect();
    observer = new MutationObserver(mutations => {
      // 同批多次写入只判断最终文字；节点移动、字体属性和资源变化仍逐条处理。
      const characterTargets = new Set();
      const textParents = new Set();
      for (const m of mutations) {
        if (m.type === "characterData") {
          if (characterTargets.has(m.target)) continue;
          characterTargets.add(m.target);
        }
        const parent = m.target instanceof Element ? m.target : m.target.parentElement;
        if (!parent || parent.closest(`#${STYLE_ID}, #${CUSTOM_STYLE_ID}`)) continue;
        if (m.type === "attributes" && m.oldValue === parent.getAttribute(m.attributeName)) continue;
        if (m.type === "attributes" && (parent.matches("style, link[rel='stylesheet']")
            || parent.tagName === "LINK" && m.attributeName === "rel" && /(?:^|\s)stylesheet(?:\s|$)/i.test(m.oldValue || ""))) {
          queueStylesheetScan();
        } else if (m.type === "attributes") {
          // SVG 本身始终受保护；自定义 CSS 接管时无需保存原样式快照。
          // 保留 SVG 内样式表和结构变化的观察，动画属性则不重复遍历文字。
          if (settings.customCSSOn && settings.customCSS.trim() && parent.closest("svg")) continue;
          if (!pendingAttributes.has(parent)) pendingAttributes.set(parent, new Map());
          const attributes = pendingAttributes.get(parent);
          if (!attributes.has(m.attributeName)) attributes.set(m.attributeName, { attributeName: m.attributeName, oldValue: m.oldValue });
          schedulePending();
        } else if (parent.matches("style, link[rel='stylesheet']")) {
          queueStylesheetScan();
        } else if (m.type === "characterData") {
          const populated = hasText(m.target);
          const remainedPopulated = populated && nonemptyTextNodes.has(m.target);
          if (populated) nonemptyTextNodes.add(m.target);
          else nonemptyTextNodes.delete(m.target);
          // 流式回答只改变已有非空文本时，字体判断仍有效；属性、结构和样式表
          // 变化分别走重检路径。自动方向只在实际方向改变时重检整个区域。
          const directionRoot = textRecheckRoot(parent);
          if (typographyIndex?.relational && !remainedPopulated) queue(document.documentElement);
          if (remainedPopulated && sampledElements.has(parent) && !directionRoot) continue;
          queue(directionRoot || parent);
        } else {
          // React 也可能通过替换文本节点更新内容；非空文本之间的替换不会改变
          // 元素选择器匹配。新元素、首次文字和实际方向变化仍走完整检查。
          const changed = [...m.addedNodes, ...m.removedNodes].filter(node => node instanceof Element || node.nodeType === Node.TEXT_NODE);
          if (!changed.length) continue;
          const textOnly = changed.every(node => node.nodeType === Node.TEXT_NODE);
          if (textOnly) {
            if (textParents.has(parent)) continue;
            textParents.add(parent);
          }
          // 注释不参与字体判断；新节点不影响可缓存选择器的已有祖先匹配。
          // 移动或移除曾参与缓存的元素时，重建继承路径，避免复用旧父级字体。
          for (const node of changed) if (node instanceof Element) forgetTypographyBranch(node);
          const directionRoot = textRecheckRoot(parent);
          if (sampledElements.has(parent) && textOnly
              && !directionRoot) {
            const textNodes = [...parent.childNodes].filter(node => node.nodeType === Node.TEXT_NODE && hasText(node));
            const previouslyPopulated = [...m.removedNodes, ...textNodes].some(node => nonemptyTextNodes.has(node));
            if (textNodes.length && previouslyPopulated) {
              textNodes.forEach(node => nonemptyTextNodes.add(node));
              continue;
            }
          }
          if (typographyIndex?.relational) queue(document.documentElement);
          if (directionRoot) queue(directionRoot);
          // 一次插入大量兄弟节点且覆盖父级主要内容时，共用一次收集与资源查询。
          const collectParent = m.addedNodes.length > 16 && m.addedNodes.length >= parent.childNodes.length / 2;
          const added = collectParent ? new Set(m.addedNodes) : null;
          const addedStylesheet = collectParent && inspectResources(parent);
          if (collectParent && !addedStylesheet) queue(parent);
          for (const node of changed) {
            if (node instanceof Element && [STYLE_ID, CUSTOM_STYLE_ID].includes(node.id)) {
              if (!node.isConnected) queue(document.documentElement);
              continue;
            }
            if (added?.has(node) && node.isConnected && node.parentElement === parent) continue;
            if (node instanceof Element && inspectResources(node)) continue;
            if (node.isConnected) queue(node instanceof Element ? node : node.parentElement);
          }
        }
      }
    });
    observedAttributes = "";
    observeAttributes(typographyIndex);
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
    // 比较当前页面实际生效的配置；其他站点规则及相同 CSS 的新分块不重扫。
    // 分块引用已在上方更新，后续正文变化仍按当前代次加载。
    const configuration = [settings.enabled, siteOff, forceSite,
      forceSite && siteFont ? siteFont : settings.replacement,
      settings.protectCode, settings.protectIcons, settings.ligatureLevel, settings.autoSpacing,
      settings.customCSSOn, settings.customCSSOn ? settings.customCSS : "",
      forceSite ? "" : JSON.stringify([...targetSet].sort())];
    const unchanged = appliedConfiguration?.every((value, i) => value === configuration[i]);
    appliedConfiguration = configuration;
    if (unchanged) return;
    if (observer) observer.disconnect();
    cancelScans();
    cssDetected = false;
    if (siteOff || !settings.enabled) {
      sleepForSite();
      return;
    }
    unmarkAll();
    ensureRootMark();
    ensureStyle();
    ensureCustomStyle();
    document.querySelectorAll("video").forEach(trackVideo);
    startObserver();
    scanSubtree(document);
    if (document.fonts?.status === "loading") {
      const fontEpoch = scanEpoch;
      document.fonts.ready.then(() => {
        if (fontEpoch === scanEpoch && settings.enabled && !siteOff && document.fonts.size) queue(document.documentElement);
      }).catch(() => {});
    }
  }

  document.addEventListener("load", event => {
    if (event.target instanceof Element && event.target.matches("link[rel='stylesheet']")) queueStylesheetScan();
  }, true);

  // 容器条件及尚未读出的跨域字体条件在视口变化后补扫，连续缩放合并处理。
  window.addEventListener("resize", () => {
    if (!settings.enabled || siteOff || !typographyIndex?.unknown) return;
    clearTimeout(viewportTimer);
    const epoch = scanEpoch;
    viewportTimer = setTimeout(() => {
      viewportTimer = null;
      if (epoch === scanEpoch) queue(document.documentElement);
    }, 100);
  }, { passive: true });

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
