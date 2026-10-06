# 性能报告归档

按发布版本长期保存性能测量的汇总、完整 JSON 样本、Markdown 报告和比较基线。新增测量默认保存到对应版本目录，以 UTC 时间戳命名，每次运行保留独立文件。各报告记录测量时间、浏览器版本、重复次数及源码摘要。

## v2.1.7

[字体变量识别修复](v2.1.7/summary.md)：保留 [完整样本](v2.1.7/2026-10-06T03-50-16-071Z-content.json)、[测量报告](v2.1.7/2026-10-06T03-50-16-071Z-content.md)及[摘要清单](v2.1.7/archive-manifest.json)，基线为 v2.1.6。

## v2.1.6

| 阶段 | 汇总 | 主要数据 |
|---|---|---|
| 第一轮：内容脚本、后台和设置页 | [第一轮记录](v2.1.6/summary.md) | [内容脚本计数](v2.1.6/final.json)、[低干扰计时](v2.1.6/timing.json)、[设置页](v2.1.6/settings-final.json) |
| 第二轮：复合规则、共享结果和扫描队列 | [第二轮记录](v2.1.6/round2-summary.md) | [计数](v2.1.6/round2-final-counts.json)、[计时](v2.1.6/round2-final-timing.json) |
| 第三轮：长文本、分支缓存和配置更新 | [第三轮记录](v2.1.6/round3-summary.md) | [计数](v2.1.6/round3-final-counts.json)、[计时](v2.1.6/round3-final-timing.json) |
| 第四轮：静态条件、转义名称和布局更新 | [第四轮记录](v2.1.6/round4-summary.md) | [计数](v2.1.6/round4-final-counts.json)、[计时](v2.1.6/round4-final-timing.json)、[冷启动补测](v2.1.6/round4-cold-followup.json) |

第二至第四轮的比较基线分别位于 `v2.1.6/round2-before/`、`v2.1.6/round3-before/` 和 `v2.1.6/round4-before/`，保留测量时使用的 `content.js`、`shared.js` 及 CSS。其他阶段性报告也按原文件名保存，其测量时间和源码摘要见对应 JSON。[归档清单](v2.1.6/archive-manifest.json)记录原路径、文件大小和 SHA-256。

归档文件固定使用 LF 换行。源码摘要按测量时读取的 UTF-8 文本计算；历史基线与工作区的换行差异在各轮汇总中记录。

## 使用

```powershell
node scripts/profile-performance.cjs v2.1.5 --repeats=3
node scripts/profile-settings.cjs v2.1.5 --repeats=3
node scripts/profile-performance.cjs --baseline-dir=docs/performance/v2.1.6/round4-before --counts=off --repeats=3
```

通过 `--output` 可以指定完整输出前缀；归档内容脚本报告时保留同名 JSON 与 Markdown、对应基线和汇总，设置页报告保留完整 JSON，更新本页索引。JSON 的原始测量数据保持原样，其中的绝对路径记录当时的运行位置；基线文件在本归档中按同名目录保存。复现历史汇总中的命令时，将 `--baseline-dir` 和 `--output` 的旧前缀替换为本归档目录。

所有耗时来自独立测试浏览器中的本地模拟页面，包含页面和测量钩子的开销。冷启动、重复交互、完整采样和配置切换分别记录；较高耗时与波动也保留在原始样本和汇总中。
