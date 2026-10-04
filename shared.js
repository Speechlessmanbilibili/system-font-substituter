(() => {
  "use strict";

  const DEFAULT_CUSTOM_CSS = `/* =========================================================
   Apple UI Mix
   =========================================================

   Western: SF Pro Text→苹方UI SC→YaHei  CJK: 苹方UI SC→YaHei
   共有标点:苹方UI  弯引号:苹方UI  PUA:SF Pro Text
   fallback: SF Pro Text/SF Arabic/SF Hebrew/SF Armenian/SF Georgian
   →苹方UI SC→苹方UI HK/TC/MO→Hiragino Sans→Apple SD Gothic Neo→YaHei→霞鹜新晰黑
   西文用 SF Pro Text 静态套件（opsz 固定 Text 端）；苹方 UI 为变量全权重。
   ========================================================= */

/* ======== Western / Latin（SF Pro Text 静态套件：opsz 烤死 Text 端，
   不受浏览器光学尺寸行为影响；单 family 九权重由 DWrite 按字重选面） ======== */

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Text");
  font-weight: 100 900;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

/* ======== Chinese / CJK（苹方 UI SC 变量全权重，共有标点/弯引号归苹方） ======== */

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang UI SC");
  font-weight: 100 900;
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
    "SF Pro Text",
    "SF Arabic",
    "SF Hebrew",
    "SF Armenian",
    "SF Georgian",
    "PingFang UI SC",
    "PingFang UI HK",
    "PingFang UI TC",
    "PingFang UI MO",
    "Hiragino Sans",
    "Apple SD Gothic Neo",

    /* 真正的 fallback */
    "Microsoft YaHei",
    "霞鹜新晰黑 屏幕阅读版 补全" !important;

  font-variation-settings: normal !important;
  text-autospace: normal !important;
}`;

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
      "OpenAI Sans",
      "OpenAI Sans SC",
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



  const CC_PREFIX = "customCSS#";
  const META_KEY = "customCSSChunks";
  const OVERRIDE_KEYS = ["protectCode", "protectIcons", "standardLigatures", "autoSpacing", "customCSSOn"];

  function ruleOverride(value) {
    return value === "on" || value === true ? "on" : value === "off" ? "off" : "";
  }

  function parseDomain(value) {
    const text = String(value ?? "").trim();
    if (!text || /\s/.test(text)) return null;
    const scheme = text.match(/^([a-z][a-z\d+.-]*):\/\//i);
    if (scheme && !/^https?$/i.test(scheme[1])) return null;
    const authority = text.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^\*\./, "");
    if (!authority || authority.includes("@")) return null;
    // URL 会省略默认端口，因此从原始 authority 单独保留显式端口。
    const parts = authority.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
    if (!parts) return null;
    try {
      const url = new URL("http://" + authority);
      const host = url.hostname.toLowerCase().replace(/\.$/, "");
      if (!host) return null;
      const port = parts[2] === undefined ? null : String(Number(parts[2]));
      return { host, port };
    } catch {
      return null;
    }
  }

  function siteState(rules, address) {
    const url = typeof address === "string" ? new URL(address) : address;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    const port = url.port || (url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "");
    let selected = null;
    let score = -1;
    for (const rule of rules) {
      const domain = parseDomain(rule?.domain);
      if (!domain || !(host === domain.host || host.endsWith("." + domain.host))) continue;
      if (domain.port !== null && domain.port !== port) continue;
      // 优先采用更具体的主机规则，同一主机下端口规则优先；同等规则沿用列表顺序。
      const specificity = domain.host.length * 2 + (domain.port !== null ? 1 : 0);
      if (specificity <= score) continue;
      score = specificity;
      selected = rule;
    }
    if (!selected) return { off: false, force: false, font: "", overrides: {} };
    return {
      off: selected.action === "off",
      force: selected.action !== "off",
      font: typeof selected.font === "string" ? selected.font.trim() : "",
      overrides: Object.fromEntries(OVERRIDE_KEYS.map(key => [key, ruleOverride(selected[key])]))
    };
  }

  function assembleCustomCSS(stored) {
    const meta = stored[META_KEY];
    if (meta && typeof meta.id === "string" && /^[a-z\d-]+$/i.test(meta.id)
        && Number.isInteger(meta.count) && meta.count >= 0 && meta.count <= 512) {
      const parts = Array.from({ length: meta.count }, (_, i) => stored[CC_PREFIX + meta.id + "/" + i]);
      return parts.every(part => typeof part === "string") ? parts.join("") : null;
    }
    // 兼容旧版连续编号分块；忽略无效后缀，缺块时不拼接损坏内容。
    const keys = Object.keys(stored).filter(key => /^customCSS#\d+$/.test(key));
    if (keys.length) {
      keys.sort((a, b) => Number(a.slice(CC_PREFIX.length)) - Number(b.slice(CC_PREFIX.length)));
      if (keys.every((key, index) => key === CC_PREFIX + index && typeof stored[key] === "string")) {
        return keys.map(key => stored[key]).join("");
      }
    }
    return typeof stored.customCSS === "string" ? stored.customCSS : null;
  }

  function normalizeSettings(stored = {}) {
    const result = structuredClone(DEFAULTS);
    for (const key of ["enabled", ...OVERRIDE_KEYS]) {
      if (typeof stored[key] === "boolean") result[key] = stored[key];
    }
    if (typeof stored.replacement === "string" && stored.replacement.trim()) result.replacement = stored.replacement;
    if (Array.isArray(stored.targets)) result.targets = stored.targets.filter(value => typeof value === "string");
    if (Array.isArray(stored.siteRules)) {
      result.siteRules = stored.siteRules.filter(rule => rule && typeof rule === "object" && typeof rule.domain === "string");
    }
    result.customCSS = assembleCustomCSS(stored) ?? DEFAULT_CUSTOM_CSS;
    return result;
  }

  function chunkCustomCSS(css, id) {
    const items = {};
    let offset = 0;
    let count = 0;
    const encoder = new TextEncoder();
    while (offset < css.length) {
      const key = CC_PREFIX + id + "/" + count;
      let lo = 1, hi = Math.min(2500, css.length - offset);
      while (lo < hi) {
        const middle = Math.ceil((lo + hi) / 2);
        const bytes = encoder.encode(key + JSON.stringify(css.slice(offset, offset + middle))).length;
        if (bytes <= 7500) lo = middle;
        else hi = middle - 1;
      }
      items[key] = css.slice(offset, offset + lo);
      offset += lo;
      count++;
    }
    return { items, meta: { id, count } };
  }

  async function writeSettings(storage, payload, css, id = crypto.randomUUID()) {
    const old = await storage.get(null);
    const { items, meta } = chunkCustomCSS(css, id);
    // 新块与引用一次发布，读者不会看到新旧 CSS 拼接。失败时保留旧数据。
    await storage.set({ ...payload, ...items, [META_KEY]: meta });
    const stale = Object.keys(old).filter(key => key === "customCSS" || key.startsWith(CC_PREFIX) && !(key in items));
    if (stale.length) {
      try { await storage.remove(stale); }
      catch (error) { console.warn("sfs CSS cleanup failed:", error); }
    }
  }

  globalThis.SFS = {
    DEFAULT_CUSTOM_CSS, DEFAULTS, CC_PREFIX, META_KEY, OVERRIDE_KEYS,
    ruleOverride, parseDomain, siteState, assembleCustomCSS, normalizeSettings, chunkCustomCSS, writeSettings
  };
})();
