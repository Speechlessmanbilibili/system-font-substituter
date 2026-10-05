# AGENTS.md

本文件记录本仓库的开发要求、发布流程、项目架构和技术限制。

## 开发与发布要求

### 安装与测试

用户通过向 Chrome/Edge 扩展管理页（`chrome://extensions` 或 `edge://extensions`）拖入 ZIP 文件的方式安装、更新和测试扩展。

- 每次完成代码修改或功能更新后，重新生成 ZIP 安装包。
- 按 ZIP 拖入安装的流程准备交付物，不要假定用户通过“加载已解压的扩展”指向项目根目录。

### 发布资产与下载目录

ZIP 安装包也是 GitHub Release 的发布资产。Windows 的下载目录可由 `(New-Object -ComObject Shell.Application).Namespace('shell:Downloads').Self.Path` 获取；本机当前路径为 `D:\Downloads`。

- 将每次生成的版本 ZIP 文件自动复制到系统定义的下载目录，包括日常测试构建和 Release 构建。
- 在运行时获取下载目录，不要硬编码本机路径。
- 将 Release 安装包命名为 `system-font-substituter-v<VERSION>.zip`，并同时发布 `apple-ui-mix.css`。

### 更新日志与 Release 说明

- `CHANGELOG.md` 是版本更新日志，依据 Git 提交、标签与实际发布记录维护；日期按北京时间记录。
- 每次发版前更新对应版本条目，并保持 README 的更新日志链接有效。
- GitHub Release 说明只列具体功能修改，省略主语；不写测试结果、验证过程、打包清单或发布资产清单。
- 样式注释使用清晰的中文表述与中国大陆常用标点；内置 CSS 模板与独立 CSS 资产保持一致。

### 打包内容

- 将扩展文件直接放在 ZIP 根目录，确保 `manifest.json` 位于最顶层，不要添加外层文件夹。
- ZIP 中央目录与本地文件头的文件名必须一致，目录分隔符均使用 `/`；不能只检查解压后的内容。PowerShell 5.1 的 `Compress-Archive` 会留下反斜杠文件头，因此使用 `ZipArchive` 显式创建标准路径条目。
- 包含 `manifest.json`、`background.js`、`shared.js`、`content.js`、`apple-ui-mix.css`、`options.html`、`options.css`、`options.js`、`icons/`、`_locales/`、`README.md`、`CHANGELOG.md`、`LICENSE` 和 `PRIVACY.md`。
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
| `background.js` | 打开设置页，读取页面引用的跨域 CSS 并仅返回样式文本；不携带站点凭据，不执行或注入远程内容 |
| `shared.js` | 统一默认值、站点与端口匹配、存储校验和 CSS 分块读写；先于内容脚本和设置页加载 |
| `content.js` | 监控 DOM 节点、文本、相关属性和样式表加载；采样页面原始字体，维护替换/保护标记，并应用站点三态规则 |
| `options.html`、`options.css`、`options.js` | 提供字体配置、实时预览、目标名单、站点规则、保护规则和自定义 CSS 编辑功能；支持中文和英文 |
| `apple-ui-mix.css` | 提供基于 SF Pro 和 PingFang UI SC 的 Unicode 范围划分与回退模板 |
| `build-release.ps1` | 打包版本 ZIP 与 CSS，获取系统下载目录并复制版本 ZIP |
| `CHANGELOG.md` | 按版本集中记录功能修改与历史变化，供 README 和发版时查阅 |
| `tests/regression.test.cjs` | 验证匹配、存储、内容脚本与设置页，并通过独立测试浏览器加载真实 MV3 扩展 |
| `tests/package.test.cjs` | 运行 PowerShell 5.1 打包，验证 ZIP 文件头、中央目录、路径和逐文件内容 |
| `tests/performance.test.cjs` | 验证文字更新、缓存复用、输入、组词与鼠标拖选期间的调度，以及字体、保护规则、语言和自动方向变化的重检 |
| `scripts/profile-performance.cjs` | 在模拟长对话页面上比较指定 Git 版本与工作区的采样次数、样式表停用次数及浏览器耗时 |

内容脚本使用 `[data-sfs-replaced="1"]` 标记替换元素，使用 `data-sfs-preserve` 保存已替换祖先下非目标文字的原样式。采样时暂时停用扩展样式表，标记更新不在观察属性列表内。普通替换和保护规则作用于直接标记；用户自定义 CSS 按其选择器生效。

已有非空文字的内容更新或文本节点替换复用字体采样结果；`dir="auto"` 区域通过 `:dir()` 比较实际方向，方向不变时复用，改变时重检整个区域。textarea 值变化也需检查自动方向。新元素、首次出现的文字、相关属性和样式表变化继续触发检查；重新加载设置时清空采样缓存。同一帧的待检区域应合并采样，避免逐区域停用全局样式表；标记值未变化时不写入属性。性能改动需运行对应回归用例，可用 `node scripts/profile-performance.cjs v2.1.2` 比较发布版本与工作区，模拟结果不能表述为真实站点实测。

连续输入期间，将字体依赖分析、子树收集和分片采样延后至停顿 180 ms 后；输入法组词期间暂停，组词结束或失焦后恢复。同一元素的属性写入按最初值与最终值合并。禁用或重新加载配置时取消延迟任务，旧任务不得恢复标记。延期只影响重检时机，不改写 CSS 或跳过最终的字体与保护判断。

主指针左键拖选文字时暂停字体扫描，松开后等待 180 ms 再合并重检；指针取消、窗口失焦及返回窗口时未按键的指针移动应释放暂停状态。只监听事件，不取消默认操作、不接管选区或指针捕获。输入框从按下开始暂停，普通网页文字通过原生 `selectstart` 确认；配置重载时保留当前拖选状态，取消旧扫描任务。

注释节点变动不触发字体扫描；新节点和纯文字更新保留未变化的祖先匹配缓存，移动或移除曾参与缓存的元素时重建继承路径。自定义 CSS 接管且不生成保护快照时，跳过已由 DOM 确定受保护元素的字体采样；普通替换仍读取原样式，以保护已替换祖先下的代码与图标。仅依据字体家族才能识别的图标仍需采样。

内容脚本分析原始网站样式表中的字体声明及相关 CSS 变量依赖，筛选属性变化；高度、位置、颜色及无关布局变量不触发字体采样。相同规则、内联字体声明、媒体条件及继承路径可复用原样式快照，最多保存 1024 份。样式表变化清空索引和快照；相关属性与节点结构变化清空继承路径缓存。跨域不可读 CSS 通过扩展后台读取，仅在内存中解析；响应必须为 CSS，限制为 2 MiB、5 秒及 32 个并发请求，不携带站点凭据。读取失败、含有 `@import`、字体动画、容器查询、复杂状态或嵌套选择器等无法可靠复用的情况保留原始采样。不得为性能优化改写用户自定义 CSS 或内置模板。

站点规则保留显式端口，不填端口时匹配全部端口；HTTP/HTTPS 默认端口分别为 80/443。域名匹配主域名和子域名，更具体的主机优先，同一主机下端口规则优先，同等规则保持列表顺序。带 www 的域名保持原义。站点动作支持 `inherit`（沿用全局名单策略）、`force`、`off`；新条目默认 `inherit`，旧规则保持原动作。

全局连字等级 `ligatureLevel` 为 `native`、`none`、`standard`、`extended`；站点还支持空字符串继承。旧 `standardLigatures` 开启映射到 `standard`、关闭映射到 `native`，显式新等级优先。连字规则按元素原始计算样式保留其他 OpenType 特性与上下文设置，仅修改 `liga`、`clig`、`dlig`、`hlig`。

设置页下拉框使用 `sfs-select` 按钮与统一的列表浮层，保持键盘和 ARIA 状态一致；不使用原生 `select`。界面示例域名使用 `example.com`。本站 CSS 在设置页子界面编辑，`customCSSMode` 为 `global` 或 `site`；本站内容替换全局内容，显式空内容不回退，并受原有 `customCSSOn` 站点覆盖与全局启用控制。子界面与主界面共用保存快照，返回和删除撤销必须保留 CSS 草稿。

## 数据兼容要求与限制

`chrome.storage.sync` 的单项容量上限约为 8 KB。当前 CSS 使用 `customCSS#<generation>/<index>` 分块，每块最多 2500 个字符，序列化字节预算为 7500；`customCSSChunks` 保存代次与块数，块数为零表示显式空内容。读取兼容旧版连续编号块与单键 CSS。站点覆盖项采用“跟随全局/开启/关闭”三态。

本站 CSS 使用相同算法及 `siteCSS#<generation>/<index>` 前缀；每条规则的 `customCSSChunks` 保存引用。`normalizeSettings` 在内存中还原规则正文，`writeSettings` 写入时剥离正文并一次发布所有分块与引用。不要将本站 CSS 正文直接写进 `siteRules`，也不要在内容脚本迁移写入。

当前观察范围为普通 DOM；Shadow DOM 内部节点和不产生 DOM 变动的 CSSOM 写入不在范围内。保存时旧块与新块短暂共存，仍受同步存储总配额限制。

- 使用分块机制保存自定义 CSS，不要将大段 CSS 写入单个存储项。
- 将共有数据结构、默认值和分块算法集中维护在 `shared.js`，并保持默认 CSS 与独立资产一致。
- 一次发布新 CSS 块与引用，等待写入成功后再清理旧数据；不要在内容脚本中执行存储迁移写入。
- 将旧布尔站点覆盖键保持为 `protectCode`、`protectIcons`、`standardLigatures`、`autoSpacing`、`customCSSOn`，并与 `OVERRIDE_KEYS` 一致。连字新等级通过独立的 `ligatureLevel` 解析；保存时保留旧 `standardLigatures` 兼容值。
- 新增设置项时，同步更新 `TEXT["zh-CN"]` 与 `TEXT["en"]`。
- 修改后运行回归测试，校验发布 ZIP 的根目录、manifest 版本及文件内容，再执行发布。
- 将供 PowerShell 5.1 执行的脚本保存为 UTF-8 带 BOM。
