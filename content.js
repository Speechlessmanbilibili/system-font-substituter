(() => {
  "use strict";

  // 默认自定义 CSS：Apple UI Mix（SF Pro → PingFang SC → Microsoft YaHei）
  // 的 @font-face 分段与全局字体栈。内容不含反引号与 ${，可安全内联。
  const DEFAULT_CUSTOM_CSS = `/* =========================================================
   Apple UI Mix
   =========================================================

   Western: SF Pro→苹方SC→YaHei  CJK: 苹方SC→YaHei
   共有标点:苹方  弯引号:苹方  PUA:SF Pro
   fallback: SF Pro/SF Arabic/SF Hebrew/SF Armenian/SF Georgian
   →苹方HK/TC/KR/JP→YaHei→霞鹜新晰黑unicode-range 按本机字体
   源文件实测（fontTools）划定。
   ========================================================= */

/* ======== Western / Latin（SF Pro 优先） ======== */

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Ultralight"), local("SF Pro Display Ultralight"), local("PingFang SC Ultralight"), local("Microsoft YaHei Light");
  font-weight: 100;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Thin"), local("SF Pro Display Thin"), local("PingFang SC Thin"), local("Microsoft YaHei Light");
  font-weight: 200;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Light"), local("SF Pro Display Light"), local("PingFang SC Light"), local("Microsoft YaHei Light");
  font-weight: 300;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro"), local("SF Pro Display"), local("PingFang SC"), local("Microsoft YaHei");
  font-weight: 400;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Medium"), local("SF Pro Display Medium"), local("PingFang SC Medium"), local("Microsoft YaHei");
  font-weight: 500;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Semibold"), local("SF Pro Display Semibold"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 600;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Bold"), local("SF Pro Display Bold"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 700;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Heavy"), local("SF Pro Display Heavy"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 800;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Black"), local("SF Pro Display Black"), local("PingFang SC Semibold"), local("Microsoft YaHei Bold");
  font-weight: 900;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}


/* ======== Chinese / CJK（苹方优先，共有标点走苹方） ======== */

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Ultralight"), local("Microsoft YaHei Light");
  font-weight: 100;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Thin"), local("Microsoft YaHei Light");
  font-weight: 200;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Light"), local("Microsoft YaHei Light");
  font-weight: 300;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Regular"), local("PingFangSC-Regular"), local("Microsoft YaHei");
  font-weight: 400;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Medium"), local("Microsoft YaHei");
  font-weight: 500;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Semibold"), local("PingFangSC-Semibold"), local("PingFang SC Medium"), local("Microsoft YaHei Bold");
  font-weight: 600;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Semibold"), local("PingFangSC-Semibold"), local("PingFang SC Medium"), local("Microsoft YaHei Bold");
  font-weight: 700;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Semibold"), local("PingFangSC-Semibold"), local("PingFang SC Medium"), local("Microsoft YaHei Bold");
  font-weight: 800;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang SC Semibold"), local("PingFangSC-Semibold"), local("PingFang SC Medium"), local("Microsoft YaHei Bold");
  font-weight: 900;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}


/* =========================================================
   Global
   ========================================================= */

html,
body,
[data-sfs] [data-sfs-replaced="1"],
[data-sfs] [data-sfs-replaced="1"]::placeholder {
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
    "霞鹜新晰黑 屏幕阅读版 补全" !important;

  font-variation-settings: normal !important;
  text-autospace: normal !important;
}
`;

  const DEFAULTS = {
    enabled: true,
    replacement: '"Em Dash Bridge", "HarmonyOS Sans SC", "Noto Sans SC", "霞鹜新晰黑 屏幕阅读版 补全"',
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
    autoSpacing: false,
    customCSSOn: false,
    customCSS: DEFAULT_CUSTOM_CSS,
    siteRules: []
  };

  // 自定义 CSS 超过 sync 单键 8KB 配额，按 2500 字符切块存储
  // （customCSS#0、customCSS#1…），读取时按序号拼回；
  // 旧版单键 customCSS 在读取时自动迁移为分块。
  const CC_PREFIX = "customCSS#";
  function chunkCustomCSS(css) {
    const items = {};
    const count = Math.ceil(css.length / 2500);
    for (let i = 0; i < count; i++) items[CC_PREFIX + i] = css.slice(i * 2500, (i + 1) * 2500);
    return { items, count };
  }
  function assembleCustomCSS(stored) {
    const parts = [];
    for (const key of Object.keys(stored)) {
      if (key.startsWith(CC_PREFIX)) parts.push([Number(key.slice(CC_PREFIX.length)), stored[key]]);
    }
    parts.sort((a, b) => a[0] - b[0]);
    if (parts.length) return parts.map(p => p[1]).join("");
    return typeof stored.customCSS === "string" ? stored.customCSS : null;
  }

  const MARK = "data-sfs-replaced";
  const ROOT_MARK = "data-sfs";
  const STYLE_ID = "sfs-style";
  const CUSTOM_STYLE_ID = "sfs-custom-style";
  const SCAN_CHUNK = 2000;

  // 站点规则可三态覆盖的功能项："on" / "off" 为强制开关，其余值跟随全局。
  const SITE_OVERRIDE_KEYS = [
    "protectCode",
    "protectIcons",
    "standardLigatures",
    "autoSpacing",
    "customCSSOn"
  ];

  let settings = DEFAULTS;
  let targetSet = new Set();
  let forceSite = false;
  let siteFont = null;
  let siteOverrides = {};

  const ICON_CLASS_RE = /(^|[\s_-])(icon|icons|fa|fas|far|fal|fab|material-icons?|glyph|symbol)([\s_-]|$)/;
  const ICON_FAMILY_RE = /fontawesome|material symbols|material icons|bootstrap-icons|remixicon|tabler-icons|lucide/;
  // 表单控件与可编辑区域：即使内容为空也需要参与替换（空输入框/占位文字
  // 同样展示字体），contenteditable 区域初始无文本节点时尤其需要。
  const EDITABLE_SELECTOR = "input, textarea, select, button, [contenteditable]:not([contenteditable='false'])";

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

  // 归一化站点规则里的三态覆盖值。旧版本存的是布尔值：
  // true 视为强制开启，false / 缺省视为跟随全局。
  function ruleOverride(value) {
    if (value === "on" || value === true) return "on";
    if (value === "off") return "off";
    return "";
  }

  // 返回站点强制覆盖状态。font 为空表示沿用全局替换字体；
  // overrides 内各键为 "" / "on" / "off"，可对单个功能强制开关或放行全局。
  function computeSiteState() {
    const rules = settings.siteRules || [];
    const host = (location.hostname || "").toLowerCase();
    for (const rule of rules) {
      const d = normalizeDomain(rule && rule.domain);
      if (!d) continue;
      if (host === d || host.endsWith("." + d)) {
        const overrides = {};
        for (const key of SITE_OVERRIDE_KEYS) {
          overrides[key] = ruleOverride(rule && rule[key]);
        }
        return {
          force: true,
          font: String(rule.font || "").trim(),
          overrides
        };
      }
    }
    return { force: false, font: "", overrides: {} };
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

    // 自定义 CSS 开启时由它接管页面字体：替换链（含 ::placeholder）整体
    // 失效，标记仅保留给标准连字与 Auto Spacing 使用；关闭时恢复替换链。
    const chainActive = settings.enabled && !settings.customCSSOn;
    const chainRules = chainActive
      ? `
        ${rootSel} [${MARK}="1"] { font-family: ${font} !important; }
        ${rootSel} [${MARK}="1"]::placeholder { font-family: ${font} !important; }
      `
      : "";

    const descendantLigatures = settings.standardLigatures
      ? `
        ${rootSel} [${MARK}="1"],
        ${rootSel} [${MARK}="1"] * {
          font-variant-ligatures: common-ligatures !important;
          font-feature-settings: "liga" 1, "clig" 1 !important;
        }
      `
      : "";

    const descendantAutoSpacing = settings.autoSpacing
      ? `
        ${rootSel} [${MARK}="1"],
        ${rootSel} [${MARK}="1"] * {
          text-autospace: normal !important;
        }
      `
      : "";

    style.textContent = settings.enabled
      ? `
        ${chainRules}
        ${descendantLigatures}
        ${descendantAutoSpacing}
      `
      : "";
  }

  // 自定义 CSS 开启时接管页面字体（替换链自动失效），始终注入在扩展自身
  // 样式之后；跟随全局启用开关，也可被站点规则按站点单独开关；空内容不注入。
  function ensureCustomStyle() {
    const css = settings.enabled && settings.customCSSOn
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
    (document.head || document.documentElement).appendChild(style);
  }

  // 把扩展样式表挪回 head 末尾，保证同优先级下声明顺序靠后；
  // 自定义样式压轴，冲突时优先于扩展自身规则。
  // 限流：CSS-in-JS 站点（如 ChatGPT）会频繁插入 style 标签，
  // 每次移动都会触发级联重算，节流避免持续抢占主线程。
  let lastReposition = 0;
  function ensureStylePosition() {
    const now = performance.now();
    if (now - lastReposition < 500) return;
    lastReposition = now;

    if (!document.head) return;
    for (const id of [STYLE_ID, CUSTOM_STYLE_ID]) {
      const style = document.getElementById(id);
      if (style && style.parentNode === document.head) {
        document.head.appendChild(style);
      }
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
    const stored = await chrome.storage.sync.get(null);
    settings = { ...DEFAULTS, ...stored };
    settings.customCSS = assembleCustomCSS(stored) ?? DEFAULT_CUSTOM_CSS;
    targetSet = new Set((settings.targets || []).map(normalizeFamily).filter(Boolean));

    // 旧版单键 customCSS 迁移为分块
    if (typeof stored.customCSS === "string") {
      const { items } = chunkCustomCSS(stored.customCSS);
      chrome.storage.sync.set(items);
      chrome.storage.sync.remove("customCSS");
    }

    const site = computeSiteState();
    forceSite = site.force;
    siteFont = site.font;
    siteOverrides = site.overrides;
    applySiteOverrides();

    scanQueue = [];
    ensureRootMark();
    ensureStyle();
    ensureCustomStyle();
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
