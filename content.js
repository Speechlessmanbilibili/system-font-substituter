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
    protectIcons: true
  };

  const MARK = "data-sfs-replaced";
  const STYLE_ID = "sfs-style";

  let settings = DEFAULTS;
  let targetSet = new Set();
  let observer = null;
  let pending = new Set();
  let scheduled = false;

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

  function looksLikeIconElement(el, family) {
    if (!settings.protectIcons) return false;

    const cls = typeof el.className === "string" ? el.className : "";
    const id = el.id || "";
    const signature = `${family} ${cls} ${id}`.toLowerCase();

    return /(^|[\s_-])(icon|icons|fa|fas|far|fal|fab|material-icons?|glyph|symbol)([\s_-]|$)/.test(signature)
      || /fontawesome|material symbols|material icons|bootstrap-icons|remixicon|tabler-icons|lucide/.test(signature)
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

  function ensureStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }

    // The replacement string is user-controlled CSS font-family syntax.
    style.textContent = settings.enabled
      ? `[${MARK}="1"] { font-family: ${settings.replacement} !important; }`
      : "";
  }

  function unmarkAll() {
    document.querySelectorAll(`[${MARK}]`).forEach(el => el.removeAttribute(MARK));
  }

  function evaluate(el) {
    if (!settings.enabled || !(el instanceof Element)) return;
    if (el.hasAttribute(MARK)) return;

    let cs;
    try {
      cs = getComputedStyle(el);
    } catch {
      return;
    }

    const family = cs.fontFamily || "";
    if (isProtected(el, family)) return;

    const first = firstFamily(family);
    if (targetSet.has(first)) {
      el.setAttribute(MARK, "1");
    }
  }

  function scanSubtree(root) {
    if (!(root instanceof Element) && root !== document) return;

    if (root instanceof Element) evaluate(root);
    const nodes = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const el of nodes) evaluate(el);
  }

  function flushPending() {
    scheduled = false;
    const work = Array.from(pending);
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
        if (m.type === "childList") {
          for (const node of m.addedNodes) queue(node);
        } else if (m.type === "attributes" && m.target instanceof Element) {
          // Re-evaluate elements whose class/style changed.
          if (m.attributeName === "class" || m.attributeName === "style") {
            if (m.target.hasAttribute(MARK)) m.target.removeAttribute(MARK);
            queue(m.target);
          }
        }
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style"]
    });
  }

  async function loadSettings() {
    const saved = await chrome.storage.sync.get(DEFAULTS);
    settings = { ...DEFAULTS, ...saved };
    targetSet = new Set((settings.targets || []).map(normalizeFamily).filter(Boolean));

    ensureStyle();
    unmarkAll();

    if (settings.enabled) {
      scanSubtree(document);
      startObserver();

      // Re-check after webfonts finish loading. This helps avoid decisions based
      // on transient fallback fonts during initial page load.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          unmarkAll();
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
