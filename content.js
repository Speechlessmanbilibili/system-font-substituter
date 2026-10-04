(() => {
  "use strict";

  const { DEFAULTS, normalizeSettings, siteState, CC_PREFIX, META_KEY, OVERRIDE_KEYS: SITE_OVERRIDE_KEYS } = SFS;

  const MARK = "data-sfs-replaced";
  const ROOT_MARK = "data-sfs";
  const STYLE_ID = "sfs-style";
  const CUSTOM_STYLE_ID = "sfs-custom-style";
  const SCAN_CHUNK = 2000;

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

  function cancelScans() {
    scanEpoch++;
    scanQueue = [];
    queuedNodes.clear();
    pending.clear();
    scanning = false;
    scheduled = false;
    styleNeedsReposition = false;
    clearTimeout(stylesheetTimer);
    stylesheetTimer = null;
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
      const v = siteOverrides[key];
      if (v === "on") settings[key] = true;
      else if (v === "off") settings[key] = false;
    }
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

    const descendantLigatures = settings.standardLigatures
      ? `
        ${rootSel} [${MARK}="1"] {
          font-variant-ligatures: common-ligatures !important;
          font-feature-settings: "liga" 1, "clig" 1 !important;
        }
      `
      : "";

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
    document.querySelectorAll(`[${MARK}], [${PRESERVE}]`).forEach(el => {
      el.removeAttribute(MARK);
      el.removeAttribute(PRESERVE);
    });
    preserved.clear();
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

  function applyReplacement(el) {
    if (el instanceof Element) el.setAttribute(MARK, "1");
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
    try {
      sheets.forEach(sheet => { sheet.disabled = true; });
      for (const el of nodes) {
        if (!el.isConnected) continue;
        const cs = getComputedStyle(el);
        snapshots.push({
          el, match: shouldReplace(el, cs.fontFamily),
          css: `font-family: ${cs.fontFamily} !important; font-variant-ligatures: ${cs.fontVariantLigatures} !important; font-feature-settings: ${cs.fontFeatureSettings} !important; text-autospace: ${cs.getPropertyValue("text-autospace") || "normal"} !important;`
        });
      }
    } finally {
      sheets.forEach((sheet, i) => { sheet.disabled = disabled[i]; });
    }

    for (const { el, match } of snapshots) {
      if (match) {
        if (!el.hasAttribute(MARK)) applyReplacement(el);
      } else {
        el.removeAttribute(MARK);
      }
      el.removeAttribute(PRESERVE);
    }
    for (const { el, match, css } of snapshots) {
      if (!match && el.parentElement?.closest(`[${MARK}="1"]`)) {
        if (!preserved.has(css)) preserved.set(css, preserved.size + 1);
        el.setAttribute(PRESERVE, preserved.get(css));
      }
    }
    if (snapshots.some(item => item.match) && settings.customCSSOn && !cssDetected) {
      cssDetected = true;
      ensureCustomStyle();
    }
    ensureStyle();
    ensureStylePosition();
  }

  function scanSubtree(root) {
    if (!(root instanceof Element) && root !== document) return;

    const nodes = collectTextElements(root);
    if (nodes.size <= SCAN_CHUNK) {
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
        requestAnimationFrame(step);
      } else {
        scanning = false;
      }
    };

    requestAnimationFrame(step);
  }

  function flushPending() {
    scheduled = false;

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

    for (const node of work) {
      if (node.isConnected) scanSubtree(node);
    }
  }

  function queue(node) {
    if (!(node instanceof Element)) return;
    pending.add(node);
    if (!scheduled) {
      scheduled = true;
      const epoch = scanEpoch;
      requestAnimationFrame(() => { if (epoch === scanEpoch) flushPending(); });
    }
  }

  // 合并密集的样式表变化；加载完成的 LINK 也会触发检查。
  function queueStylesheetScan() {
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
        if (m.type === "attributes" && parent.matches("style, link[rel='stylesheet']")) {
          queueStylesheetScan();
        } else if (m.type === "attributes") {
          queue(parent);
        } else if (parent.matches("style, link[rel='stylesheet']")) {
          queueStylesheetScan();
        } else if (m.type === "characterData") {
          queue(parent);
        } else {
          for (const node of [...m.addedNodes, ...m.removedNodes]) {
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
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["class", "style", "id", "contenteditable", "aria-hidden", "href", "media", "disabled"]
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
    targetSet = new Set(settings.targets.map(normalizeFamily).filter(Boolean));
    const site = computeSiteState();
    siteOff = site.off;
    forceSite = site.force;
    siteFont = site.font;
    siteOverrides = site.overrides;
    applySiteOverrides();
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
    if (document.fonts?.ready) {
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
