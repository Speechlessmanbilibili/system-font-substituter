# AGENTS.md

本文件记录本仓库的开发要求、发布流程、项目架构和技术限制。

## 开发与发布要求

### 安装与测试

用户通过向 Chrome/Edge 扩展管理页（`chrome://extensions` 或 `edge://extensions`）拖入 ZIP 文件的方式安装、更新和测试扩展。

- 每次完成代码修改或功能更新后，重新生成 ZIP 安装包。
- 按 ZIP 拖入安装的流程准备交付物，不要假定用户通过“加载已解压的扩展”指向项目根目录。

### 发布资产与下载目录

ZIP 安装包也是 GitHub Release 的发布资产。Windows 的下载目录可由 `(New-Object -ComObject Shell.Application).Namespace('shell:Downloads').Self.Path` 获取；本机当前路径为 `D:\Downloads`。

- 将每次生成的 ZIP 文件自动复制到系统定义的下载目录，包括日常测试构建和 Release 构建。
- 在运行时获取下载目录，不要硬编码本机路径。
- 将日常构建命名为 `system-font-substituter.zip`。
- 将 Release 安装包命名为 `system-font-substituter-v<VERSION>.zip`，并同时发布 `apple-ui-mix.css`。

### 打包内容

- 将扩展文件直接放在 ZIP 根目录，确保 `manifest.json` 位于最顶层，不要添加外层文件夹。
- 包含 `manifest.json`、`background.js`、`shared.js`、`content.js`、`apple-ui-mix.css`、`options.html`、`options.css`、`options.js`、`icons/`、`_locales/`、`README.md`、`LICENSE` 和 `PRIVACY.md`。
- 排除 `.git/`、Git 配置文件、`test-*.html`、临时测试脚本和开发缓存。

在项目根目录执行以下 PowerShell 命令：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\build-release.ps1
```

## 项目架构与技术事实

`system-font-substituter` 是基于 Chromium Manifest V3 的网页字体替换扩展。普通名单模式依据元素计算样式中的首选字体判断是否替换；站点强制规则可以覆盖这一判断。代码和图标保护由对应设置控制，自定义 CSS 在检测命中后注入。

| 文件 | 职责 |
|---|---|
| `manifest.json` | 声明 MV3 配置和固定的扩展 `key`；对应 ID 为 `ecgcpjehkelnjfcgldmifejcoefohdcp` |
| `shared.js` | 统一默认值、站点与端口匹配、存储校验和 CSS 分块读写；先于内容脚本和设置页加载 |
| `content.js` | 监控 DOM 节点、文本、相关属性和样式表加载；采样页面原始字体，维护替换/保护标记，并应用站点三态规则 |
| `options.html`、`options.css`、`options.js` | 提供字体配置、实时预览、目标名单、站点规则、保护规则和自定义 CSS 编辑功能；支持中文和英文 |
| `apple-ui-mix.css` | 提供基于 SF Pro 和 PingFang UI SC 的 Unicode 范围划分与回退模板 |
| `build-release.ps1` | 打包版本 ZIP 与 CSS，获取系统下载目录并复制版本 ZIP 和日常 ZIP |
| `tests/regression.test.cjs` | 验证匹配、存储、内容脚本与设置页，并通过独立测试浏览器加载真实 MV3 扩展 |

内容脚本使用 `[data-sfs-replaced="1"]` 标记替换元素，使用 `data-sfs-preserve` 保存已替换祖先下非目标文字的原样式。采样时暂时停用扩展样式表，标记更新不在观察属性列表内。普通替换和保护规则作用于直接标记；用户自定义 CSS 按其选择器生效。

站点规则保留显式端口，不填端口时匹配全部端口；HTTP/HTTPS 默认端口分别为 80/443。域名匹配主域名和子域名，更具体的主机优先，同一主机下端口规则优先，同等规则保持列表顺序。带 www 的域名保持原义。

## 数据兼容要求与限制

`chrome.storage.sync` 的单项容量上限约为 8 KB。当前 CSS 使用 `customCSS#<generation>/<index>` 分块，每块最多 2500 个字符，序列化字节预算为 7500；`customCSSChunks` 保存代次与块数，块数为零表示显式空内容。读取兼容旧版连续编号块与单键 CSS。站点覆盖项采用“跟随全局/开启/关闭”三态。

当前观察范围为普通 DOM；Shadow DOM 内部节点和不产生 DOM 变动的 CSSOM 写入不在范围内。保存时旧块与新块短暂共存，仍受同步存储总配额限制。

- 使用分块机制保存自定义 CSS，不要将大段 CSS 写入单个存储项。
- 将共有数据结构、默认值和分块算法集中维护在 `shared.js`，并保持默认 CSS 与独立资产一致。
- 一次发布新 CSS 块与引用，等待写入成功后再清理旧数据；不要在内容脚本中执行存储迁移写入。
- 将站点覆盖键保持为 `protectCode`、`protectIcons`、`standardLigatures`、`autoSpacing`、`customCSSOn`，并与 `OVERRIDE_KEYS` 一致。
- 新增设置项时，同步更新 `TEXT["zh-CN"]` 与 `TEXT["en"]`。
- 修改后运行回归测试，校验发布 ZIP 的根目录、manifest 版本及文件内容，再执行发布。
- 将供 PowerShell 5.1 执行的脚本保存为 UTF-8 带 BOM。
