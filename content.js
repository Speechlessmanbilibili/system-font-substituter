(() => {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    replacement: '"CJK Punct Bridge", "Hanken Grotesk", "HarmonyOS Sans SC"',
    targets: [
    "-apple-system-body",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Segoe UI Variable",
    "Segoe UI Variable Text",
    "Segoe UI Variable Display",
    "Arial",
    "Arial Unicode MS",
    "Helvetica",
    "Helvetica Neue",
    "Tahoma",
    "Verdana",
    "Trebuchet MS",
    "Calibri",
    "Aptos",
    "Aptos Display",
    "Aptos Narrow",
    "SF Pro",
    "SF Pro Text",
    "SF Pro Display",
    "SF UI Text",
    "SF UI Display",
    "Roboto",
    "Roboto Flex",
    "Roboto Condensed",
    "Ubuntu",
    "Ubuntu Sans",
    "Cantarell",
    "Liberation Sans",
    "DejaVu Sans",
    "Droid Sans",
    "Microsoft YaHei",
    "Microsoft YaHei UI",
    "微软雅黑",
    "PingFang SC",
    "苹方-简",
    "Hiragino Sans GB",
    "冬青黑体简体中文",
    "Noto Sans SC",
    "Noto Sans CJK SC",
    "Source Han Sans SC",
    "思源黑体 CN",
    "思源黑体"
],
    protectCode: true,
    protectIcons: true,
    standardLigatures: false,
    siteRules: []
  };

  const MARK = "data-sfs-replaced";
  const ROOT_MARK = "data-sfs";
  const STYLE_ID = "sfs-style";
  const SCAN_CHUNK = 2000;

  const ICON_CLASS_RE = /(^|[\s_-])(icon|icons|fa|fas|far|fal|fab|material-icons?|glyph|symbol)([\s_-]|$)/;
  const ICON_FAMILY_RE = /fontawesome|material symbols|material icons|bootstrap-icons|remixicon|tabler-icons|lucide/;
  // 表单控件与可编辑区域：即使内容为空也需要参与替换（空输入框/占位文字
  // 同样展示字体），contenteditable 区域初始无文本节点时尤其需要。
  const EDITABLE_SELECTOR = "input, textarea, select, button, [contenteditable]:not([contenteditable='false'])";

  let settings = DEFAULTS;
  let targetSet = new Set();
  let forceSite = false;
  let siteFont = null;
  let observer = null;
  let pending = new Set();
  let scheduled = false;
  let styleNeedsReposition = false;
  let scanQueue = [];
  let scanning = false;

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

  function normalizeDomain(value) {
    let s = String(value || "").trim().toLowerCase();
    s = s.replace(/^https?:\/\//, "").replace(/^\*\./, "").replace(/^www\./, "");
    s = s.split("/")[0].split(":")[0];
    return s;
  }

  // 返回 { force, font }：force 表示当前站点命中强制覆盖规则，
  // font 为站点专属字体（空字符串表示沿用全局替换字体）。
  function computeSiteState() {
    const rules = settings.siteRules || [];
    const host = (location.hostname || "").toLowerCase();
    for (const rule of rules) {
      const d = normalizeDomain(rule && rule.domain);
      if (!d) continue;
      if (host === d || host.endsWith("." + d)) {
        return { force: true, font: String(rule.font || "").trim() };
      }
    }
    return { force: false, font: "" };
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

    const tag = el.tagName;
    if (tag === "SVG" || tag === "PATH" || tag === "USE" || tag === "IMG" || tag === "CANVAS") {
      return true;
    }

    if (settings.protectCode && (tag === "CODE" || tag === "PRE" || tag === "KBD" || tag === "SAMP")) {
      return true;
    }

    if (settings.protectCode && el.closest("code, pre, kbd, samp")) {
      return true;
    }

    if (looksLikeIconElement(el, computedFamily)) {
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

    const descendantLigatures = settings.standardLigatures
      ? `
        ${rootSel} [${MARK}="1"],
        ${rootSel} [${MARK}="1"] * {
          font-variant-ligatures: common-ligatures !important;
          font-feature-settings: "liga" 1, "clig" 1 !important;
        }
      `
      : "";

    style.textContent = settings.enabled
      ? `
        ${rootSel} [${MARK}="1"] { font-family: ${font} !important; }
        ${rootSel} [${MARK}="1"]::placeholder { font-family: ${font} !important; }
        ${descendantLigatures}
      `
      : "";
  }

  // 把扩展样式表挪回 head 末尾，保证同优先级下声明顺序靠后。
  // 限流：CSS-in-JS 站点（如 ChatGPT）会频繁插入 style 标签，
  // 每次移动都会触发级联重算，节流避免持续抢占主线程。
  let lastReposition = 0;
  function ensureStylePosition() {
    const now = performance.now();
    if (now - lastReposition < 500) return;
    lastReposition = now;

    const style = document.getElementById(STYLE_ID);
    if (style && document.head && style.parentNode === document.head) {
      document.head.appendChild(style);
    }
  }

  function unmarkAll() {
    document.querySelectorAll(`[${MARK}]`).forEach(el => el.removeAttribute(MARK));
  }

  function shouldReplace(el) {
    if (!settings.enabled || !(el instanceof Element)) return false;

    let cs;
    try {
      cs = getComputedStyle(el);
    } catch {
      return false;
    }

    const family = cs.fontFamily || "";
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

  // 片内两阶段：先快照判断、再统一打标，避免同批内父元素先被替换
  // 而污染子元素继承后的 font-family 判断。
  function applyBatch(nodes) {
    const matches = [];

    for (const el of nodes) {
      if (el.hasAttribute(MARK)) continue;
      if (shouldReplace(el)) matches.push(el);
    }

    for (const el of matches) applyReplacement(el);
  }

  function scanSubtree(root) {
    if (!(root instanceof Element) && root !== document) return;

    const nodes = collectTextElements(root);
    if (nodes.size <= SCAN_CHUNK) {
      applyBatch(nodes);
      return;
    }

    // 大子树分片处理，避免一次扫描阻塞主线程。
    scanQueue.push(...nodes);
    scheduleScan();
  }

  function scheduleScan() {
    if (scanning) return;
    scanning = true;

    const step = () => {
      if (scanQueue.length) {
        applyBatch(scanQueue.splice(0, SCAN_CHUNK));
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
      requestAnimationFrame(flushPending);
    }
  }

  function startObserver() {
    if (observer) observer.disconnect();

    observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type !== "childList") continue;

        for (const node of m.addedNodes) {
          if (node instanceof Element) {
            const tag = node.tagName;
            if (tag === "STYLE" || tag === "LINK") styleNeedsReposition = true;
            queue(node);
          } else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            queue(node.parentElement);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true
    });
  }

  async function loadSettings() {
    const saved = await chrome.storage.sync.get(DEFAULTS);
    settings = { ...DEFAULTS, ...saved };
    targetSet = new Set((settings.targets || []).map(normalizeFamily).filter(Boolean));

    const site = computeSiteState();
    forceSite = site.force;
    siteFont = site.font;

    scanQueue = [];
    ensureRootMark();
    ensureStyle();
    unmarkAll();

    if (settings.enabled) {
      scanSubtree(document);
      startObserver();

      // 页面存在 webfont 时，加载完成后补扫一次：只标记此前漏掉的元素，
      // 不撤销已有标记，避免整页字体闪回；无 webfont 则跳过。
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          if (document.fonts.size === 0) return;
          scanSubtree(document);
        }).catch(() => {});
      }
    } else if (observer) {
      observer.disconnect();
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") loadSettings();
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
