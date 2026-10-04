# System Font Substituter

一个面向 Chromium 的 Manifest V3 字体替换扩展。它会全局检查网页元素的 `font-family`，仅在首选字体命中默认名单时替换，从而尽量保留网站主动选择的设计字体、图标字体和代码字体；还可对被替换文字强制开启 CSS Auto Spacing，或向页面注入自定义 CSS。

## 默认替换字体

```css
"Em Dash Bridge", "HarmonyOS Sans SC", "Noto Sans SC", "霞鹜新晰黑 屏幕阅读版 补全"
```

适合本机已经安装上述字体的环境。可在设置页自由修改。

## 默认目标

默认只覆盖常见西文与简体中文系统/UI 字体。名单包含 Windows、Apple、Android/Linux 常见系统字体以及微软雅黑、苹方、Noto Sans SC、思源黑体等简中 UI 字体。

`Inter`、`Open Sans`、`Source Sans` 等可能由网站主动用于视觉设计的 WebFont 不在默认名单中。繁体中文、日文、韩文字体也不在默认名单中。

默认名单包含 `-apple-system-body`、`ui-sans-serif`、`OpenAI Sans` 和 `OpenAI Sans SC`。

## 站点强制覆盖

在设置页点击“添加站点”，填写域名或主机:端口，例如 `chatgpt.com`、`127.0.0.1:3350`、`[::1]:3350`，也可粘贴 HTTP/HTTPS 地址。域名规则匹配该域名及其子域名；不指定端口时匹配全部端口，指定端口时只匹配该端口。HTTP 的默认端口按 80 匹配，HTTPS 按 443 匹配。

更具体的主机规则优先；同一主机下端口规则优先，同等规则按列表顺序处理。`www.example.com` 不匹配 `example.com`，`*.example.com` 保留匹配主域名和子域名的原有行为。字体留空时使用全局替换字体。动作可选择“强制替换”或“关闭覆盖”；后者撤销该站的扩展样式和标记。

强制覆盖的站点会跳过“首选字体命中名单”判断，所有文字元素直接替换；代码与图标保护规则仍然生效，避免破坏代码块和图标字体。

每条站点规则还支持三态覆盖：展开规则后，可对保护代码字体、保护图标字体、标准连字、Auto Spacing、自定义 CSS 分别选择“跟随全局 / 开启 / 关闭”。选择“关闭”后，即使全局开启，该站点也不会应用对应功能；选择“跟随全局”时完全使用全局设置。

## Auto Spacing

设置页可全局开启 Auto Spacing。启用后，扩展会对已标记为替换目标的文字强制应用 `text-autospace: normal !important`，覆盖网站自身设置；默认关闭。

## 自定义 CSS

设置页可向页面注入自定义 CSS，默认关闭，内置一套 Apple UI Mix 模板作为起点。模板的 `@font-face` 分段与 unicode-range 按本机字体源文件实测（fontTools）划定：西文命中 SF Pro Text，中文命中苹方 UI SC，中西文共有的标点符号交给苹方，PUA（E000-F8FF，含 Apple 标志）交给 SF Pro Text。模板以 SF Pro Text 静态套件提供西文，以苹方 UI SC 变量字体提供 CJK；其他文种经过 SF Arabic/SF Hebrew/SF Armenian/SF Georgian、苹方 UI HK/TC/MO、Hiragino Sans、Apple SD Gothic Neo，再回退至 Microsoft YaHei 与霞鹜新晰黑。注入跟随全局启用开关，也可在站点规则中按站点单独开启或关闭；内容留空则不注入。

自定义 CSS 开启且内容非空时接管替换：替换字体链自动失效，扩展照常检测并标记命中原名单的元素（检测阶段仍遵循代码与图标保护规则），这些元素及其占位文字改用自定义 CSS 的字体栈渲染；标准连字与 Auto Spacing 仍按各自开关作用于标记元素。关闭自定义 CSS 或将内容留空时，普通替换链恢复。自定义 CSS 按用户填写的选择器生效，全局选择器也会影响未标记元素。

## 安装

1. 下载 Release 中的 `system-font-substituter-v<VERSION>.zip`。
2. Edge 打开 `edge://extensions/`，Chrome 打开 `chrome://extensions/`。
3. 开启“开发人员模式”，将 ZIP 安装包拖入扩展管理页。
4. 点击扩展图标进入设置页。

## 行为

- 普通模式只替换首选 `font-family` 命中名单的元素；站点强制规则可以覆盖这一判断。
- 默认保护 `code`、`pre`、`kbd`、`samp`。
- 默认识别并保护常见图标字体。
- 通过 DOM 新增节点、文本和相关属性变化重新判断字体，并在样式表加载后补查。
- WebFont 加载完成后会重新检查页面。
- 浏览器受保护页面无法注入普通扩展。

## v2.1.1

- 修复端口规则被截断的问题：`127.0.0.1:3350` 不再影响其他端口，并支持默认端口、IPv6 和国际化域名。
- 统一设置页与内容脚本的默认配置，保留 OpenAI Sans/SC。
- 修复空 CSS 恢复默认模板、保存失败时旧 CSS 丢失、新旧分块短暂混合的问题；按实际序列化字节分块，新块与引用一次发布，成功后清理旧块。
- 修复已替换祖先污染动态节点和后续扫描分片的字体判断，以及字体变化后标记未更新的问题。
- 修复代码、图标、SVG 和独立设计字体被继承样式影响的问题；连字与 Auto Spacing 使用直接标记规则。
- 修复禁用后残留扫描、删除网站自有内联属性、样式表异步加载漏检和设置页保存竞争。
- 补齐双语界面文案，保留恢复 CSS 按钮图标，并按平台显示保存快捷键。
- 新增自动回归测试、真实 MV3 加载验证和发布打包脚本；规范化 AGENTS.md。

## 开发验证与打包

```powershell
npm ci
npx playwright install chromium
npm test
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build-release.ps1
```

打包脚本生成 `dist/system-font-substituter-v<VERSION>.zip` 和 `dist/apple-ui-mix.css`，并将版本 ZIP 与日常 ZIP 同步至 Windows 定义的下载目录。ZIP 根目录直接包含 manifest，不包含测试和开发依赖。

当前扫描覆盖普通 DOM；Shadow DOM 内部节点和不产生 DOM 变动的 CSSOM 写入不在观察范围内。同步存储受总容量及单项配额限制；保存过程中旧块与新块短暂共存，超出配额时保存失败并保留原配置。

## v2.1.0

- **前端设置页全面重构与美化**：
  - 采用现代 Apple / macOS 视觉设计系统，深度打磨浅色与深色模式、精细圆角边框与微阴影。
  - **交互式字体渲染画板**：提供中英混排、标点破折号、连字数字等多种排版预设，支持 300 / 400 / 600 / 700 四档字重一键切换，画板支持直接点击在线编辑实时查看效果。
  - **保护规则卡片化**：升级为 2×2 现代化功能卡片网格，带有专属矢量图标与 iOS 风格微动效 Toggle。
  - **站点规则空状态**：新增友好的空规则插画引导卡片。
  - **macOS 风格代码编辑器视窗**：自定义 CSS 区域支持代码窗体、一键恢复预设按钮。
  - **悬浮毛玻璃底栏**：支持未保存更改指示（Dirty State）与 `Ctrl+S` / `Cmd+S` 快捷键极速保存。

## v1.9.1

- 自定义 CSS 开启时接管替换：替换字体链自动失效，扩展照常检测并标记命中原名单的元素（代码与图标保护规则不变），这些元素及其占位文字改用自定义 CSS 的字体栈渲染；关闭自定义 CSS 时替换链恢复。
- 模板全局规则选择器从 `html, body` 扩展到被标记元素（`[data-sfs] [data-sfs-replaced="1"]`），不再依赖 body 继承，并对被接管元素归一 `font-variation-settings`。
- 修复苹方 Regular 的 `local()` 命中：`@font-face` 的 `local()` 按**全名 / PostScript 名**匹配，族名 `"PingFang SC"`（全名为 `"PingFang SC Regular"`）无法命中，导致 400 字重的中文面悄悄回落雅黑、弯引号变成几何斜块；现改用全名并补充 PS 名 `PingFangSC-Regular`。
- 600-900 字重中文面拆分为四条单字重面，Semibold 补充 PS 名与 Medium 兜底。
- 模板全局栈精简：删去 B 站兼容段（Em Dash Bridge、CJKEmDash、Numbers、Onest、ShangguSansSCVF 与通用兜底），直接 fallback 链保留 SF 各文种版与苹方港繁日韩变体。
- 自定义 CSS 改为分块存储（`customCSS#0…`），绕过同步单键 8KB 配额，旧版单键自动迁移；模板体积不再受限。

## v1.9.0

- 新增“自定义 CSS”：可向所有页面注入自定义样式，默认关闭；内置 Apple UI Mix 模板（SF Pro → PingFang SC → Microsoft YaHei），unicode-range 按本机字体源文件实测划定，mix 未覆盖的文种以直接 fallback 兜底（SF Arabic / Hebrew / Armenian / Georgian 与 PingFang HK / TC / KR / JP）。
- 自定义 CSS 在扩展自身样式之后注入，与替换字体、标准连字、Auto Spacing 等扩展规则冲突时以自定义 CSS 为准。
- 站点强制覆盖升级为三态覆盖：每条规则可对保护代码字体、保护图标字体、标准连字、Auto Spacing、自定义 CSS 单独选择“跟随全局 / 开启 / 关闭”，不再只能单向强制开启 Auto Spacing。
- 默认替换字体改为 `"Em Dash Bridge", "HarmonyOS Sans SC", "Noto Sans SC", "霞鹜新晰黑 屏幕阅读版 补全"`。

## v1.8.0

- 新增全局 Auto Spacing 开关，对已替换文字强制应用 CSS `text-autospace: normal`。
- 站点强制覆盖规则新增独立 Auto Spacing 开关，可只对指定站点开启。
- 简体中文文案统一使用半角 `/`。

## 许可证

本项目采用 **GNU General Public License v3.0 or later（GPL-3.0-or-later）** 发布。你可以选择 GNU GPL 第 3 版或自由软件基金会发布的任何后续版本。完整条款见 `LICENSE`。

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

- 修复“标准连字”在部分网站上无法覆盖原有设置的问题。
- 连字开关仍默认关闭，且只作用于已经被扩展替换字体的元素。
- 开启后改为对目标元素写入可恢复的 inline `font-feature-settings` `!important`，强制 `liga` / `clig`，优先级高于网站 author CSS。
- 会保留元素当前其他 OpenType feature，只覆盖 `liga` 与 `clig`。
- 关闭功能、修改设置或元素不再匹配时，会恢复元素原有的 inline `font-feature-settings`。

## v1.5.3

- 修复标准连字“偶尔有效、随后失效”的扫描顺序问题。
- 原因是父元素先被替换后，会立刻改变子元素继承得到的 computed `font-family`；
  后续子元素因此不再命中原系统字体名单，导致子级没有收到连字强制规则。
- DOM 扫描改成两阶段：先快照整棵子树的原始字体判断，再统一应用替换。
- 对已经位于被替换祖先下的新动态节点，会识别其继承的替换字体并继续应用连字规则。
- 未使用被替换字体的独立设计字体仍不会被强制开启连字。

## v1.5.4

- 修复 ChatGPT 等 React 页面中连字“先有效、使用一会儿又失效”的问题。
- 重新判断字体时，会临时撤掉当前元素及祖先上的扩展替换标记，再读取网站原始的 computed `font-family`，避免继承后的 Hanken 反过来污染判断。
- 已替换元素发生 `class` / `style` 动态变化时，不再简单撤掉标记后盲目重扫。
- 标准连字开启时增加 1.2 秒低频校正，只重新维护仍属于字体替换目标的元素。
- 未命中目标字体名单的网站设计字体仍不会被强制开启连字。

## v1.5.5

- 紧急回退 v1.5.4 中会导致页面卡死的 marker 暂停 / 周期校正逻辑。
- v1.5.4 的问题来自在 MutationObserver 处理期间反复增删标记并触发同步样式重算，动态页面上会形成极高开销。
- 恢复 v1.5.3 的安全两阶段扫描。
- 连字稳定性改用纯 CSS 补强：只在已替换区域 `[data-sfs-replaced="1"]` 及其后代强制 `liga` / `clig`。
- 不再使用定时器，不会周期性遍历整页 DOM。

## v1.6.0

- 增加正式扩展图标，并在 Manifest 中声明 16/32/48/128 图标与工具栏图标。
- 增加英文与简体中文 Manifest 本地化。
- 增加公开隐私政策 `PRIVACY.md`。

## v1.7.2

- 替换规则同时作用于 `::placeholder`，输入框等控件的占位文字若声明了独立字体也会被替换，避免空输入框看起来“没生效”。
- 扫描范围加入 `contenteditable` 可编辑区域（Claude、Notion 等站点输入框的实现方式），即使内容为空也会参与替换。

## v1.7.1

- 修复字体加载完成后的补扫会造成整页字体闪回、并在大页面上持续卡顿的问题：补扫不再撤销已有替换标记，只标记此前漏掉的元素，已替换区域保持稳定。
- “挪回 head 末尾”的保底动作加 500ms 限流，避免 ChatGPT 等 CSS-in-JS 站点频繁插入样式标签时反复触发整页级联重算。

## v1.7.0

- 新增“站点强制覆盖”：设置页可添加站点规则（域名 + 可选专属字体），命中站点后跳过字体名单判断、直接强制替换，解决 ChatGPT 等站点个别区域字体回退的问题；代码与图标保护规则仍然生效。
- 替换规则改为挂在 `html[data-sfs]` 下并提高特异性，同时检测到页面新插入样式时把扩展样式表挪回 `head` 末尾，抵抗 ChatGPT 等 CSS-in-JS 应用动态注入样式的覆盖。
- 大页面扫描改为分帧处理（每帧约 2000 个元素），消除整页扫描的长任务卡顿；MutationObserver 增量扫描增加祖先去重，避免父子节点重复扫描同一子树。
- 页面没有 webfont 时跳过字体加载完成后的整页重扫，减少无谓开销。

## v1.6.1

- 大幅降低哔哩哔哩等大型动态网页上的运行开销。
- 不再监听全站 `class` / `style` 属性变化，只处理 DOM / 文本新增。
- 扫描范围从整棵 DOM 的全部元素改为实际承载文字的元素和常见表单控件。
- 移除逐元素 inline 连字写入；标准连字继续由已替换区域的纯 CSS 规则负责。
- 保留两阶段判断，避免字体替换的继承结果污染同一批次的字体判断。
