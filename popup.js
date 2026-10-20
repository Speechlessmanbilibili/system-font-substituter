(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let settings = SFS.normalizeSettings({});
  let url = null;
  let busy = false;
  let statusTimer = 0;

  function status(text, type = "") {
    clearTimeout(statusTimer);
    $("status").textContent = text;
    $("status").className = "popup-status" + (type ? " " + type : "");
    if (type === "success") statusTimer = setTimeout(() => { $("status").textContent = ""; }, 2400);
  }

  async function read() {
    return SFS.normalizeSettings(await chrome.storage.sync.get(null));
  }

  async function write(change) {
    settings = await SFS.writeSettings(chrome.storage.sync, change);
  }

  const matchRule = (rules, href) => SFS.matchRule(rules, href);

  function currentDomain(matched) {
    if (!url) return null;
    const parsed = SFS.parseDomain(url.href);
    if (!parsed) return null;
    const matchedDomain = matched ? SFS.parseDomain(matched.domain) : null;
    if (matchedDomain && matchedDomain.host === parsed.host && matchedDomain.port !== null && matchedDomain.port === (parsed.port || (url.protocol === "https:" ? "443" : "80"))) return matched.domain;
    return parsed.port ? parsed.host + ":" + parsed.port : parsed.host;
  }

  function render() {
    $("enabled").checked = settings.enabled;
    $("global-state").textContent = settings.enabled ? "已启用" : "已关闭";
    $("font-summary").textContent = "替换字体：" + (settings.replacement || "未设置");
    const supported = Boolean(url?.hostname);
    $("site-mode").disabled = !supported;
    if (!supported) {
      $("host").textContent = url ? "本地文件" : "此页面不支持扩展注入";
      $("effective").textContent = "当前页面无法使用站点规则，仍可调整全局开关。";
      return;
    }
    $("host").textContent = url.hostname;
    const rule = matchRule(settings.siteRules, url.href);
    for (const input of document.querySelectorAll('input[name="site-mode"]')) input.checked = input.value === (rule?.action || "inherit");
    const state = SFS.siteState(settings.siteRules, url.href);
    const mode = state.off ? "关闭覆盖" : state.force ? "强制替换" : "沿用全局策略";
    const parts = [settings.enabled ? "已启用" : "已停用", mode];
    parts.push(rule ? "匹配" + rule.domain : "跟随全局");
    $("effective").textContent = "当前：" + parts.join(" · ");
  }

  function setBusy(value) {
    busy = value;
    $("enabled").disabled = value;
    $("site-mode").disabled = value || !url?.hostname;
  }

  async function updateSite(value) {
    if (busy || !url?.hostname) return;
    setBusy(true);
    try {
      await write(latest => {
        const domain = currentDomain(matchRule(latest.siteRules, url.href));
        const index = latest.siteRules.findIndex(rule => rule.domain === domain);
        const rules = latest.siteRules.slice();
        if (index >= 0) rules[index] = { ...rules[index], action: value };
        else rules.push({ domain, action: value });
        return { siteRules: rules };
      });
      render();
      status("已保存", "success");
    } catch {
      status("保存失败，请重试。", "error");
      render();
    } finally {
      setBusy(false);
    }
  }

  $("site-mode").addEventListener("change", event => {
    if (event.target.name === "site-mode") updateSite(event.target.value);
  });

  $("enabled").addEventListener("change", async () => {
    if (busy) return;
    const next = $("enabled").checked;
    setBusy(true);
    try {
      await write(() => ({ enabled: next }));
      render();
      status("已保存", "success");
    } catch {
      $("enabled").checked = settings.enabled;
      status("保存失败，请重试。", "error");
    } finally {
      setBusy(false);
    }
  });

  $("open-options").addEventListener("click", () => chrome.runtime.openOptionsPage());

  (async () => {
    try {
      settings = await read();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      try {
        const candidate = new URL(tab?.url);
        if (["http:", "https:", "file:"].includes(candidate.protocol)) url = candidate;
      } catch {}
      render();
    } catch {
      status("读取设置失败，请重新打开此页面。", "error");
    }
  })();
})();
