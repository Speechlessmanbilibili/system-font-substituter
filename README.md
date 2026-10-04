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

## 站点特殊规则

在设置页点击“添加站点”，填写域名或主机:端口，例如 `example.com`、`example.com:3350`，也可粘贴 HTTP/HTTPS 地址。域名规则匹配该域名及其子域名，也支持 IPv4/IPv6 主机；不指定端口时匹配全部端口，指定端口时只匹配该端口。HTTP 的默认端口按 80 匹配，HTTPS 按 443 匹配。

更具体的主机规则优先；同一主机下端口规则优先，同等规则按列表顺序处理。`www.example.com` 不匹配 `example.com`，`*.example.com` 保留匹配主域名和子域名的原有行为。站点行为可选择“沿用全局策略 / 强制替换 / 关闭覆盖”。新条目默认沿用全局策略，继续按全局目标名单判断替换；关闭覆盖会撤销该站的扩展样式和标记，停用条目选项并保留原值。全局停用优先于所有站点规则。

强制覆盖的站点会跳过“首选字体命中名单”判断，所有文字元素直接替换；代码与图标保护规则仍然生效，避免破坏代码块和图标字体。

条目常驻显示 Auto Spacing、自定义 CSS 和连字程度。前两项提供“跟随全局 / 开启 / 关闭”，连字程度提供全局继承和四个等级；继承选项会显示当前全局值。代码保护、图标保护和站点字体位于“其他设置”，折叠时显示独立配置摘要。站点字体仅在强制替换且自定义 CSS 未接管字体时生效；留空使用全局替换字体。删除后可撤销并恢复原位置和完整设置；有内容但缺少域名的草稿会阻止保存，字段错误在原处显示。

下拉选项使用与页面浅色/深色主题一致的自定义浮层，支持方向键、Home/End、Enter、Esc、Tab 和按文字定位，打开时平滑显现。“工作方式”与“域名匹配与规则优先级”支持展开/收起动画；系统开启减少动态效果时省去过渡。

点击条目中的“编辑 CSS”进入本站编辑子界面。默认使用全局内容，也可选择“使用本站内容”独立编辑，或复制全局内容作为起点。本站内容替换全局 CSS；留空时不注入，也不回退到全局。内容仍由本站 CSS 开关和站点行为控制，按原有检测条件注入。返回列表与切换内容来源都会保留本站草稿，点击整页“保存设置”后生效。关闭覆盖时可查看，编辑控件停用。

本站 CSS 使用 `siteCSS#<generation>/<index>` 分块，规则仅保存内容来源和块引用；正文不放入 `siteRules` 单项。全局内容、本站内容及引用一次发布，写入成功后清理旧块，删除站点后也会在保存时清理对应块。所有 CSS 仍共同受同步存储总配额限制。

## 连字程度

全局及站点设置均支持以下等级，仅作用于已标记的替换目标文字。

| 等级 | 行为 |
|---|---|
| 保持网站设置 | 不主动改变连字；默认选项 |
| 关闭可选连字 | 关闭 `liga`、`clig`、`dlig`、`hlig` |
| 标准连字 | 开启 `liga`、`clig`，关闭 `dlig`、`hlig` |
| 扩展连字 | 在标准连字基础上开启 `dlig`，关闭 `hlig` |

保留网站的上下文设置、必要塑形和其他 OpenType 特性。实际字形取决于字体提供的连字。旧版标准连字开启映射为“标准连字”，关闭映射为“保持网站设置”；站点的旧继承项仍继承全局。自定义 CSS 在扩展规则之后注入，冲突时以自定义 CSS 为准。

## Auto Spacing

设置页可全局开启 Auto Spacing。启用后，扩展会对已标记为替换目标的文字强制应用 `text-autospace: normal !important`，覆盖网站自身设置；默认关闭。

## 自定义 CSS

设置页可向页面注入自定义 CSS，默认关闭，内置一套 Apple UI Mix 模板作为起点。模板的 `@font-face` 分段与 unicode-range 按本机字体源文件实测（fontTools）划定：西文命中 SF Pro Text，中文命中苹方 UI SC，中西文共有的标点符号交给苹方，PUA（E000-F8FF，含 Apple 标志）交给 SF Pro Text。模板以 SF Pro Text 静态套件提供西文，以苹方 UI SC 变量字体提供 CJK；其他文种经过 SF Arabic/SF Hebrew/SF Armenian/SF Georgian、苹方 UI HK/TC/MO、Hiragino Sans、Apple SD Gothic Neo，再回退至 Microsoft YaHei 与霞鹜新晰黑。注入跟随全局启用开关，也可在站点规则中按站点单独开启或关闭；内容留空则不注入。

自定义 CSS 开启且内容非空时接管替换：替换字体链自动失效，扩展照常检测并标记命中替换条件的元素（检测阶段仍遵循代码与图标保护规则），这些元素及其占位文字改用自定义 CSS 的字体栈渲染；连字程度与 Auto Spacing 仍按各自配置作用于标记元素。关闭自定义 CSS 或将内容留空时，普通替换链恢复。自定义 CSS 按用户填写的选择器生效，全局选择器也会影响未标记元素。

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

## 更新记录

各版本的功能修改见 [CHANGELOG.md](CHANGELOG.md)。

## 开发验证与打包

```powershell
npm ci
npx playwright install chromium
npm test
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build-release.ps1
```

打包脚本生成 `dist/system-font-substituter-v<VERSION>.zip` 和 `dist/apple-ui-mix.css`，并将版本 ZIP 与日常 ZIP 同步至 Windows 定义的下载目录。ZIP 根目录直接包含 manifest，不包含测试和开发依赖。

当前扫描覆盖普通 DOM；Shadow DOM 内部节点和不产生 DOM 变动的 CSSOM 写入不在观察范围内。同步存储受总容量及单项配额限制；保存过程中旧块与新块短暂共存，超出配额时保存失败并保留原配置。

## 许可证

本项目采用 **GNU General Public License v3.0 or later（GPL-3.0-or-later）** 发布。你可以选择 GNU GPL 第 3 版或自由软件基金会发布的任何后续版本。完整条款见 `LICENSE`。
