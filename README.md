<img src="icons/source.svg" width="64" height="64" alt="字体替换器图标">

# 字体替换器

**把常用网页，排成你喜欢的样子。**

System Font Substituter 为 Chrome、Edge 等 Chromium 浏览器提供可定制的网页字体替换。选一组喜欢的本机字体，让常见系统字体按你的偏好显示；再为阅读、代码、标点与不同网站安排各自的规则。

[下载安装](https://github.com/Speechlessmanbilibili/system-font-substituter/releases/latest) · [开始使用](#安装与开始使用) · [更新日志](CHANGELOG.md) · [反馈问题](https://github.com/Speechlessmanbilibili/system-font-substituter/issues)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/ui/options-dark.png">
  <img src="docs/ui/options-light.png" alt="字体替换器的工作台式设置页，包含章节目录、字体输入与常驻试样">
</picture>

[完整设置页](docs/ui/options-full.png) · [工具栏弹窗](docs/ui/popup-light.png) · [窄屏布局](docs/ui/options-mobile.png) · [界面设计](docs/ui/README.md)

## 从字形开始，把阅读调顺手

- **按名单替换**：以元素原始 `font-family` 的首项判断目标。常见系统/UI 字体进入替换范围，未命中的设计字体继续沿用网站设置。
- **先试排，再保存**：直接编辑预览文字，切换中西文、标点、连字样例与字重，比较一组字体的实际效果。
- **按网站细调**：为域名或端口配置替换行为、字体、自动间距、连字和自定义 CSS。
- **保留代码与图标**：默认保护 `code`、`pre`、`kbd`、`samp`，并识别常见图标字体。
- **从字体扩展到排版**：使用内置 Apple UI Mix 模板，或编写全局/本站 CSS，调整字体之外的阅读样式。

设置页以纸色、衬线标题、朱砂色控件和三栏工作台组织内容，右侧试样常驻并跟随草稿更新；支持明暗主题、窄屏与键盘操作。代码编辑区优先使用 Consolas。

## 安装与开始使用

1. 在系统中安装准备使用的字体。
2. 从 [最新 Release](https://github.com/Speechlessmanbilibili/system-font-substituter/releases/latest) 下载 `system-font-substituter-v<VERSION>.zip`。
3. 打开 `edge://extensions/` 或 `chrome://extensions/`，开启开发者模式，将 ZIP 拖入扩展管理页。
4. 点击扩展图标，在“替换字体”中填写字体列表，查看预览后保存。

字体列表使用 CSS `font-family` 语法，例如：

```css
"Microsoft YaHei", Arial, sans-serif
```

浏览器依次选择可用字体，并在缺字时继续尝试后备项。扩展引用本机字体，字体文件需要单独安装。

更新时拖入新版 ZIP，即可覆盖原扩展并沿用设置。固定扩展 ID：`ecgcpjehkelnjfcgldmifejcoefohdcp`。

<details>
<summary>查看默认字体与替换名单</summary>

默认替换字体列表为：

```css
"Em Dash Bridge", "HarmonyOS Sans SC", "Noto Sans SC", "霞鹜新晰黑 屏幕阅读版 补全"
```

可按本机已经安装的字体修改。替换名单涵盖常见 Windows、Apple、Android/Linux 系统字体，以及微软雅黑、苹方、Noto/思源简中黑体等名称；也包含 `-apple-system-body`、`ui-sans-serif`、`OpenAI Sans` 和 `OpenAI Sans SC`。

`Inter`、`Open Sans`、`Source Sans` 等网站设计字体不在默认名单中。名单支持逐行编辑，新增或删除名称后保存生效。

</details>

## 每个网站，都可以有自己的排版

站点规则提供三种行为：

| 行为 | 适合的用法 |
|---|---|
| 沿用全局策略 | 继续按目标名单判断，单独调整本站的排版选项 |
| 强制替换 | 为本站文字统一应用替换字体，仍遵循代码与图标保护设置 |
| 关闭覆盖 | 恢复本站原有样式，同时保留已填写的本站配置 |

站点字体在“强制替换”且自定义 CSS 未接管字体时使用；留空则沿用全局字体。全局停用会关闭所有站点的替换。

域名可以直接填写，也可以粘贴 HTTP/HTTPS 地址：

| 规则示例 | 匹配范围 |
|---|---|
| `example.com` | 主域名及其子域名，全部端口 |
| `docs.example.com` | 该子域名及其下级子域名 |
| `example.com:443` | 对应域名及其子域名的 443 端口 |

更具体的主机优先；同一主机下，指定端口的规则优先；条件相同时按列表顺序处理。HTTP/HTTPS 默认端口分别为 80/443。`www.example.com` 保持自身域名含义。

站点条目常驻显示自动间距、自定义 CSS 和连字程度，其余设置折叠收纳。删除规则后可撤销，返回 CSS 编辑子页前后的草稿和滚动位置也会保留。

## 调整间距与连字

自动间距默认关闭。开启后，为已标记的替换目标应用 `text-autospace: normal`，由浏览器排出中西文及中文与数字之间的间距。此项需要浏览器支持 `text-autospace`。

连字可全局设置，也可按站点覆盖：

| 连字程度 | 字体特性 |
|---|---|
| 保持网站设置 | 沿用网站的连字配置，默认选项 |
| 关闭可选连字 | 关闭 `liga`、`clig`、`dlig`、`hlig` |
| 标准连字 | 开启 `liga`、`clig`，关闭 `dlig`、`hlig` |
| 扩展连字 | 在标准连字基础上开启 `dlig`，关闭 `hlig` |

其他 OpenType 特性和必要塑形继续保留，字形效果由所用字体提供。

## 用 CSS 定制阅读样式

开启自定义 CSS 后，可以从内置的 [Apple UI Mix](apple-ui-mix.css) 模板开始，也可以填写自己的样式。模板通过字符范围组合本机 SF Pro Text 与 PingFang UI SC，让西文、中文及共用标点分别使用对应字形。

非空自定义 CSS 会接管普通替换字体链；检测与标记继续按目标名单和保护规则执行，连字与自动间距仍各自生效。内容留空或关闭该功能后，恢复普通字体替换。

本站 CSS 在独立子页中编辑：

- “使用全局内容”沿用全局 CSS。
- “使用本站内容”以本站 CSS 替换全局内容。
- 本站内容显式留空时，保持空内容。
- 所有草稿通过页面的“保存设置”统一保存。

自定义 CSS 在检测命中后注入，并按填写的选择器生效；全局选择器可以影响未被标记的元素。

<details>
<summary>处理方式、适用范围与设置存储</summary>

扩展以 Manifest V3 运行，读取网页原始字体并维护替换/保护标记。新节点、字体相关属性与样式资源变化会触发重检；已有非空文字的更新可复用判断。

连续输入、输入法组词和拖动文字选区期间，字体任务会延后合并。播放视频时按空闲时间分批处理；高度、位置、颜色及无关布局变量变化会被过滤。性能测量与完整样本保存在 [性能报告归档](docs/performance/README.md)。

当前扫描范围为普通 DOM；Shadow DOM 内部节点与未产生 DOM 变动的 CSSOM 写入位于观察范围之外。浏览器内部页及扩展商店等受保护页面受浏览器注入限制。

设置使用 `chrome.storage.sync`，由浏览器账号的同步设置决定是否跨设备同步。全局及本站 CSS 分块保存，较大的网站规则也自动分块；未变化的 CSS 沿用原分块。设置页合并其他窗口的新配置，并保留保存期间继续编辑的草稿。

跨域样式表无法直接读取时，后台会向原地址请求 CSS，以分析字体依赖，请求不附带站点凭据。详情见 [隐私说明](PRIVACY.md)。

</details>

## 按需要搭配同系列扩展

| 想调整的内容 | 对应扩展 |
|---|---|
| 中西文字体搭配、共用标点、宋体/楷体或衬线组合 | [中西文字体替换](https://github.com/Speechlessmanbilibili/chinese-western-font-replacer) |
| 整个网页的中西文自动间距与本站开关 | [中西文自动间距](https://github.com/Speechlessmanbilibili/native-auto-space) |

三个扩展可以分别安装、独立配置。与中西文字体替换同时启用时，本扩展会识别前置的专用标点范围字体，并按其后的原首选字体判断正文名单。

## 开发与构建

```powershell
npm ci
npx playwright install chromium
npm test
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ./build-release.ps1
```

构建生成 `dist/system-font-substituter-v<VERSION>.zip` 与 `dist/apple-ui-mix.css`，并将版本 ZIP 复制到系统下载目录。ZIP 根目录直接包含 `manifest.json`。

内容脚本与设置页性能可分别测量：

```powershell
node scripts/profile-performance.cjs v2.1.9 --repeats=3
node scripts/profile-settings.cjs v2.1.9 --repeats=3
```

场景、报告与比较基线见 [性能报告索引](docs/performance/README.md)，维护约定见 [AGENTS.md](AGENTS.md)。

## 开源与反馈

采用 [GNU GPL v3.0 或更新版本](LICENSE)（GPL-3.0-or-later）。

[查看更新日志](CHANGELOG.md) · [报告问题或提出建议](https://github.com/Speechlessmanbilibili/system-font-substituter/issues) · [隐私说明](PRIVACY.md)
