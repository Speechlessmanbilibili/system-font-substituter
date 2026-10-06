(() => {
  "use strict";

  const DEFAULT_CUSTOM_CSS = `/* =========================================================
   Apple UI Mix 字体模板
   =========================================================

   按 Unicode 范围分配本机字体：西文使用 SF Pro Text，汉字使用苹方 UI SC。
   中西文共有标点、弯引号和带圈数字使用苹方 UI SC；私用区使用 SF Pro Text。
   西文段按 SF Pro Text 静态套件配置，使用 Text 光学尺寸；汉字段支持变量字重。
   模板未覆盖的字符或字体缺失时，按下方字体链依次回退。
   所有字体均从本机读取，使用前需安装相应字体。
   ========================================================= */

/* 西文与私用区：使用 SF Pro Text 静态套件，避免光学尺寸自动切换至 Display。
   同一字体族声明 100～900 的字重范围，由字体匹配机制选择对应字重。 */

@font-face {
  font-family: "Apple UI Mix";
  src: local("SF Pro Text");
  font-weight: 100 900;
  unicode-range: U+0020-00B6,U+00B8-024F,U+0250-02AF,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2070-209F,U+20A0-20BF,U+E000-F8FF;
}

/* 汉字与中文标点：使用苹方 UI SC 变量字体，支持 100～900 的字重范围。
   中西文共有标点与弯引号划入本段，以保持中文排版中的字形一致。 */

@font-face {
  font-family: "Apple UI Mix";
  src: local("PingFang UI SC");
  font-weight: 100 900;
  unicode-range: U+00B7,U+2010-2016,U+2018-2019,U+201C-201D,U+2020-2027,U+203B,U+2103,U+2160-217F,U+2460-24FF,U+2208,U+2229-222A,U+2266-2267,U+226E-226F,U+22EF,U+2E80-2FFF,U+3000-303F,U+3300-33FF,U+3400-4DBF,U+4E00-9FFF,U+F900-FAFF,U+FF00-FFEF;
}


/* =========================================================
   全局字体链与排版规则
   ========================================================= */

html,
body,
[data-sfs] [data-sfs-replaced="1"],
[data-sfs] [data-sfs-replaced="1"]::placeholder {
  font-family:
    "Apple UI Mix",

    /* 模板范围之外的字符按本机字体依次回退，不参与 Unicode 范围分配。 */
    "SF Pro Text",
    "SF Arabic",
    "SF Hebrew",
    "SF Armenian",
    "SF Georgian",
    "PingFang UI SC",
    "PingFang UI HK",
    "PingFang UI TC",
    "PingFang UI MO",

    /* 前述字体缺失或缺字时，回退至微软雅黑。 */
    "Microsoft YaHei" !important;

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
    ligatureLevel: "native",
    autoSpacing: false,
    customCSSOn: false,
    customCSS: DEFAULT_CUSTOM_CSS,
    siteRules: []
  };



  const CC_PREFIX = "customCSS#";
  const SITE_CC_PREFIX = "siteCSS#";
  const META_KEY = "customCSSChunks";
  const OVERRIDE_KEYS = ["protectCode", "protectIcons", "standardLigatures", "autoSpacing", "customCSSOn"];
  const LIGATURE_LEVELS = ["native", "none", "standard", "extended"];

  function ruleOverride(value) {
    return value === "on" || value === true ? "on" : value === "off" ? "off" : "";
  }

  function normalizeLigatureLevel(value, fallback = "native") {
    return LIGATURE_LEVELS.includes(value) ? value : fallback;
  }

  function siteLigatureLevel(rule) {
    // 显式空值表示继承，优先于旧版标准连字开关。
    if (rule.ligatureLevel === "" || LIGATURE_LEVELS.includes(rule.ligatureLevel)) return rule.ligatureLevel;
    const legacy = ruleOverride(rule.standardLigatures);
    return legacy === "on" ? "standard" : legacy === "off" ? "native" : "";
  }

  function normalizeSiteRule(rule, stored = null) {
    const level = siteLigatureLevel(rule);
    return {
      domain: String(rule.domain || "").trim(),
      font: typeof rule.font === "string" ? rule.font.trim() : "",
      action: rule.action === "off" || rule.action === "inherit" ? rule.action : "force",
      ...Object.fromEntries(OVERRIDE_KEYS.map(key => [key, ruleOverride(rule[key])])),
      // 保留旧键供旧版本读取，等级设置以新枚举为准。
      standardLigatures: level ? (["standard", "extended"].includes(level) ? "on" : "off") : "",
      ligatureLevel: level,
      customCSSMode: rule.customCSSMode === "site" ? "site" : "global",
      customCSS: typeof rule.customCSS === "string" ? rule.customCSS
        : stored ? assembleCSSChunks(stored, rule.customCSSChunks, SITE_CC_PREFIX) ?? "" : ""
    };
  }

  function ligatureDeclarations(level, features = "normal", variants = "normal") {
    if (level === "native") return "";
    // 只改连字相关标签，保留 tnum、zero、calt、rlig 等原有特性。
    const values = new Map();
    for (const match of features.matchAll(/"([\x20-\x7e]{4})"\s*(on|off|\d+)?/g)) {
      values.set(match[1], match[2] === "off" ? 0 : match[2] === "on" || !match[2] ? 1 : Number(match[2]));
    }
    const common = level !== "none";
    values.set("liga", common ? 1 : 0);
    values.set("clig", common ? 1 : 0);
    values.set("dlig", level === "extended" ? 1 : 0);
    values.set("hlig", 0);
    const contextual = variants === "none" || variants.includes("no-contextual") ? "no-contextual" : "contextual";
    return `font-variant-ligatures: ${common ? "common-ligatures" : "no-common-ligatures"} ${level === "extended" ? "discretionary-ligatures" : "no-discretionary-ligatures"} no-historical-ligatures ${contextual} !important; font-feature-settings: ${[...values].map(([tag, value]) => `"${tag.replace(/["\\]/g, "\\$&")}" ${value}`).join(", ")} !important;`;
  }

  function parseDomain(value) {
    const text = String(value ?? "").trim();
    if (!text || /\s/.test(text)) return null;
    const scheme = text.match(/^([a-z][a-z\d+.-]*):\/\//i);
    if (scheme && !/^https?$/i.test(scheme[1])) return null;
    const authority = text.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].replace(/^\*\./, "");
    if (!authority || authority.includes("@") || authority.includes("*")) return null;
    // URL 会省略默认端口，因此从原始 authority 单独保留显式端口。
    const parts = authority.match(/^(\[[^\]]+\]|[^:]+)(?::(\d+))?$/);
    if (!parts) return null;
    try {
      const url = new URL("http://" + authority);
      const host = url.hostname.toLowerCase().replace(/\.$/, "");
      if (!host || host.includes("*")) return null;
      const port = parts[2] === undefined ? null : String(Number(parts[2]));
      return { host, port };
    } catch {
      return null;
    }
  }

  function sourceAddress(address, ...sources) {
    if (!/^(?:about:(?:blank|srcdoc)(?:[#?]|$)|blob:|data:|filesystem:)/i.test(address || "")) return address;
    for (const source of [address, ...sources]) {
      try {
        const url = new URL(source);
        if (["http:", "https:", "file:"].includes(url.protocol)) return url.href;
        if (/^https?:\/\//.test(url.origin)) return url.origin;
      } catch {}
    }
    return address;
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
    if (!selected) return { off: false, force: false, font: "", customCSS: null, overrides: {} };
    return {
      off: selected.action === "off",
      force: selected.action !== "off" && selected.action !== "inherit",
      font: typeof selected.font === "string" ? selected.font.trim() : "",
      customCSS: selected.customCSSMode === "site" ? String(selected.customCSS || "") : null,
      overrides: {
        ...Object.fromEntries(OVERRIDE_KEYS.map(key => [key, ruleOverride(selected[key])])),
        ligatureLevel: siteLigatureLevel(selected)
      }
    };
  }

  function assembleCSSChunks(stored, meta, prefix = CC_PREFIX) {
    if (meta && typeof meta.id === "string" && /^[a-z\d-]+$/i.test(meta.id)
        && Number.isInteger(meta.count) && meta.count >= 0 && meta.count <= 512) {
      const parts = Array.from({ length: meta.count }, (_, i) => stored[prefix + meta.id + "/" + i]);
      return parts.every(part => typeof part === "string") ? parts.join("") : null;
    }
    return null;
  }

  function assembleCustomCSS(stored) {
    const chunks = assembleCSSChunks(stored, stored[META_KEY]);
    if (chunks !== null) return chunks;
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
    result.ligatureLevel = normalizeLigatureLevel(stored.ligatureLevel, result.standardLigatures ? "standard" : "native");
    result.standardLigatures = ["standard", "extended"].includes(result.ligatureLevel);
    if (typeof stored.replacement === "string" && stored.replacement.trim()) result.replacement = stored.replacement;
    if (Array.isArray(stored.targets)) result.targets = stored.targets.filter(value => typeof value === "string");
    if (Array.isArray(stored.siteRules)) {
      result.siteRules = stored.siteRules.filter(rule => rule && typeof rule === "object" && typeof rule.domain === "string").map(rule => normalizeSiteRule(rule, stored));
    }
    result.customCSS = assembleCustomCSS(stored) ?? DEFAULT_CUSTOM_CSS;
    return result;
  }

  function chunkCustomCSS(css, id, prefix = CC_PREFIX) {
    const items = {};
    let offset = 0;
    let count = 0;
    const encoder = new TextEncoder();
    while (offset < css.length) {
      const key = prefix + id + "/" + count;
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
    const siteRules = (payload.siteRules || []).map((rule, index) => {
      const normalized = normalizeSiteRule(rule);
      const { customCSS, ...reference } = normalized;
      // 本站 CSS 同样分块，正文不写入 siteRules 单项。
      if (customCSS || normalized.customCSSMode === "site") {
        const chunks = chunkCustomCSS(customCSS, id + "-" + index, SITE_CC_PREFIX);
        Object.assign(items, chunks.items);
        reference.customCSSChunks = chunks.meta;
      }
      return reference;
    });
    // 新块与引用一次发布，读者不会看到新旧 CSS 拼接。失败时保留旧数据。
    await storage.set({ ...payload, ...(Array.isArray(payload.siteRules) ? { siteRules } : {}), ...items, [META_KEY]: meta });
    const stale = Object.keys(old).filter(key => key === "customCSS" || (key.startsWith(CC_PREFIX) || Array.isArray(payload.siteRules) && key.startsWith(SITE_CC_PREFIX)) && !(key in items));
    if (stale.length) {
      try { await storage.remove(stale); }
      catch (error) { console.warn("sfs CSS cleanup failed:", error); }
    }
  }

  globalThis.SFS = {
    DEFAULT_CUSTOM_CSS, DEFAULTS, CC_PREFIX, SITE_CC_PREFIX, META_KEY, OVERRIDE_KEYS, LIGATURE_LEVELS,
    ruleOverride, normalizeLigatureLevel, normalizeSiteRule, siteLigatureLevel, ligatureDeclarations,
    parseDomain, sourceAddress, siteState, assembleCSSChunks, assembleCustomCSS, normalizeSettings, chunkCustomCSS, writeSettings
  };
})();
