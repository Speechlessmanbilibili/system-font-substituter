# AGENTS.md

本文件为协助开发本仓库的 AI Agent 提供指引、项目架构说明与必须严格遵守的工程与发布规范。

---

## ⚠️ 核心工作流与发布规范（必须强制遵守）

### 1. 扩展安装与测试方式（Zip 拖入安装）
- **用户的核心习惯**：用户在 Chrome / Edge 浏览器（`chrome://extensions` 或 `edge://extensions`）中，**完全通过直接拖拽 `.zip` 压缩包的方式进行安装与更新测试**。
- **禁止假设**：不要假定用户通过「加载已解压的扩展」直接指向项目根目录。每次完成代码修改或功能更新后，**必须同步重新打包生成 `.zip` 文件**，以便用户即时拖入浏览器验证。

### 2. GitHub Release 发布资产与系统下载目录要求
- 该 `.zip` 压缩包不仅是用户日常测试的载体，**也是每次 GitHub 发布 Release 时的核心发布资产（Release Asset）**。
- **系统「下载」目录放置规则**：打包生成的 `.zip` 文件（无论日常测试构建还是 Release 版本构建），**必须自动同步拷贝一份到系统所定义的「下载」文件夹位置**（通过 `(New-Object -ComObject Shell.Application).Namespace('shell:Downloads').Self.Path` 获取，本机当前为 `D:\Downloads`），方便用户直接从系统下载目录拖拽安装或分发。
- 发布资产命名惯例：
  - 本地测试/日常构建：`system-font-substituter.zip`
  - Release 归档版本：`system-font-substituter-v<VERSION>.zip` 与 `apple-ui-mix.css`

### 3. 打包规范与目录结构要求
- **根目录规范**：压缩包解压后必须直接是扩展文件，**`manifest.json` 必须位于 zip 的最顶层根目录**，严禁套一层外层文件夹。
- **必须包含的文件与目录**：
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `apple-ui-mix.css`
  - `options.html`
  - `options.css`
  - `options.js`
  - `icons/`
  - `_locales/`
  - `README.md`
  - `LICENSE`
  - `PRIVACY.md`
- **必须排除的内容**：
  - `.git/` 及相关 Git 配置文件
  - `test-*.html`（如 `test-kr-jp.html`、`test-mix-simple.html` 等本地测试页面）
  - 临时测试脚本或开发缓存

### 4. 标准打包命令（PowerShell）
在项目根目录下执行：
```powershell
Compress-Archive -Path 'manifest.json', 'background.js', 'content.js', 'apple-ui-mix.css', 'options.html', 'options.css', 'options.js', 'icons', '_locales', 'LICENSE', 'README.md', 'PRIVACY.md' -DestinationPath 'system-font-substituter.zip' -Force
```

---

## 🛠️ 项目架构与技术要点

### 1. 项目定位
`system-font-substituter` 是一个基于 Chromium Manifest V3 的网页字体替换扩展。其核心特征是**仅在元素首选计算字体命中指定名单时才进行替换**，最大限度保护网站自身设计的 WebFont、代码字体与图标字体。

### 2. 核心模块与职责划分
- `manifest.json`：MV3 声明文件，固定了 Chromium Extension `key`（确保开发者模式与发布后 ID 一致：`ecgcpjehkelnjfcgldmifejcoefohdcp`）。
- `content.js`：注入页面的核心脚本。
  - 使用 `MutationObserver` 监控动态加载节点。
  - 针对命中替换名单的元素注入标记 `[data-sfs-replaced="1"]`。
  - 包含 `DEFAULT_CUSTOM_CSS` 与自定义 CSS 分块读取逻辑（`customCSS#0`, `customCSS#1`... 规避 sync 8KB 单键配额限制）。
  - 处理站点特殊规则（`SITE_OVERRIDE_KEYS` 三态覆盖：跟随全局 / 开启 / 关闭）。
- `options.html` / `options.css` / `options.js`：扩展设置页前端。
  - 包含字体配置、多段排版实时渲染画板、目标替换名单、站点特殊规则、保护规则及自定义 CSS 视窗。
  - 拥有中英双语国际化支持（`TEXT["zh-CN"]` 和 `TEXT["en"]`）。
  - 与 `content.js` 保持相同的数据存储结构与分块算法。
- `apple-ui-mix.css`：内置模板样式文件（基于 `SF Pro` + `PingFang UI SC` 的 Unicode Range 精确切分与回退）。

### 3. 数据兼容性注意事项
- **单键配额限制**：`chrome.storage.sync` 单键大小上限约为 8KB，`customCSS` 必须使用 `customCSS#<index>` 分块存储机制（单块上限 2500 字符），严禁直接用单键大字符串覆盖。
- **三态覆盖键名**：站点规则的覆盖项必须与 `OVERRIDE_KEYS`（`["protectCode", "protectIcons", "standardLigatures", "autoSpacing", "customCSSOn"]`）保持严格一致。
- **国际化**：新增设置项必须同步更新 `TEXT["zh-CN"]` 与 `TEXT["en"]`。
