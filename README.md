# System Font Substituter

一个面向 Chromium 的 Manifest V3 字体替换扩展。它会全局检查网页元素的 `font-family`，仅在首选字体命中默认名单时替换，从而尽量保留网站主动选择的设计字体、图标字体和代码字体。

## 默认替换字体

```css
"CJK Punct Bridge", "Hanken Grotesk", "HarmonyOS Sans SC"
```

适合本机已经安装上述字体的环境。可在设置页自由修改。

## 默认目标

默认只覆盖常见西文与简体中文系统 / UI 字体。名单包含 Windows、Apple、Android / Linux 常见系统字体以及微软雅黑、苹方、Noto Sans SC、思源黑体等简中 UI 字体。

`Inter`、`Open Sans`、`Source Sans` 等可能由网站主动用于视觉设计的 WebFont 不在默认名单中。繁体中文、日文、韩文字体也不在默认名单中。

为覆盖当前 ChatGPT Web 使用的平台系统字体栈，默认名单包含 `-apple-system-body` 与 `ui-sans-serif`。

## 安装

1. 解压发布包。
2. Edge 打开 `edge://extensions/`，Chrome 打开 `chrome://extensions/`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”，选择解压后的目录。
5. 点击扩展图标进入设置页。

## 行为

- 只在元素的首选 `font-family` 命中名单时替换。
- 默认保护 `code`、`pre`、`kbd`、`samp`。
- 默认识别并保护常见图标字体。
- 使用 `MutationObserver` 跟踪动态页面。
- WebFont 加载完成后会重新检查页面。
- 浏览器受保护页面无法注入普通扩展。

## v1.4.0

- 设置页重做为更克制的系统设置风格，保留中英文界面与深色模式。
- 默认字体链改为 CJK Punct Bridge → Hanken Grotesk → HarmonyOS Sans SC。
- 加入 `-apple-system-body`、`ui-sans-serif`，覆盖当前 ChatGPT Web 的系统字体栈。

## v1.5.0

- 新增“标准连字”开关，默认关闭。
- 开启后只对已经命中替换名单、实际被扩展替换字体的元素生效。
- 使用 `common-ligatures` 并强制开启 OpenType `liga` / `clig`，可覆盖网站对标准连字的关闭设置。
- 未被字体替换的网页文字不受连字设置影响。

## v1.5.1

- 在 `manifest.json` 中加入固定 Chromium `key`。
- 开发者模式下，即使扩展解压到不同目录，加载后也会保持同一个扩展 ID。
- 固定扩展 ID：`ecgcpjehkelnjfcgldmifejcoefohdcp`。
- 私钥不包含在仓库或 Release 中；扩展运行与开发者模式加载只需要 manifest 中的公钥。

## v1.5.2

- 修复部分网站开启“标准连字”后偶尔失效的问题。
- 连字强制规则改为仅对已被字体替换的元素写入 inline `font-feature-settings: ... !important`。
- 该方式可以压过网站自身高特异性的 author `!important` 规则。
- 会保留原有的其他 OpenType feature，只强制 `liga` / `clig` 为开启。
- 网站之后若动态改写元素样式，扩展会重新识别并恢复连字强制状态。
- 未命中字体替换名单的元素仍完全不受连字设置影响。
