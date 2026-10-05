# v2.1.6 继续优化记录

基线为上一轮交付的 2.1.6 测试构建源码快照，本轮结果对应当前工作区。测试浏览器为 Chromium 151.0.7922.34。用户 CSS 和 Apple UI Mix 模板正文保持原样。

## 本轮修改

- 将祖先条件、复合选择器和逗号列表纳入字体规则候选筛选；每个列表分支都有可靠的必要条件时才建立索引，实际命中继续交给浏览器判断。
- 相同原字体结果共享名单判断、连字声明和保护样式，缓存最多保留 1024 个结果；字体索引或设置失效时清空。包含容器条件的完整采样路径也复用这些生成结果。
- 将分片队列改为游标处理，及时释放已处理节点引用；已移除节点不占后续采样分片。持续入队时合并回收前段空槽，重新挂入的节点仍按当前字体重检。

候选筛选依据 [W3C 的选择器匹配步骤](https://www.w3.org/TR/selectors-4/#match-against-element)：末端复合选择器中的必要条件不满足时，该分支不会命中。函数、属性、引号和转义按各自语义处理；怪异模式继续使用浏览器匹配。

## 测试与测量

- 82 项自动回归全部通过，包括真实 MV3、跨域 CSS、子框架、配置重载、输入法、拖选、保护规则、站点 CSS、屏外规则与安装包加载。
- 新增祖先/列表规则、复杂 OpenType 特性和播放中移除旧节点三类压力场景，场景总数增至 23 类。
- 最终源码的完整调用量复核覆盖全部 23 类、两种模式及无扩展/改动前/改动后三组，共 138 个样本。调用量复核每组运行一次。
- 另对 10 类关键场景关闭高频选择器/遍历计数，交替执行前后版本，每组重复 3 次，共 180 个低干扰计时样本。下表耗时使用这一轮的中位数。
- 独立页面运行，各场景检查最终字体标记；JSON 保存原始样本、最小值、最大值、浏览器版本和源码摘要。两份最终报告的源码摘要均与当前内容脚本一致。

浏览器耗时包含模拟页面和保留的采样/标记钩子开销。主线程任务包含解析、脚本、样式和布局；脚本指标为 CDP 的 ScriptDuration。完成时间包含场景操作和字体检查的调度。堆内存受垃圾回收影响，帧间隔来自独立测试浏览器。

## 主要结果

| 场景/指标 | 本轮改动前 | 本轮改动后 |
|---|---:|---:|
| 800 条祖先/列表规则，普通替换，主线程 | 653.08 ms | 74.51 ms |
| 800 条祖先/列表规则，完整 CSS，主线程 | 812.31 ms | 234.4 ms |
| 6000 个元素共享 40 项 OpenType 特性，普通替换，脚本 | 77.07 ms | 29.39 ms |
| 同一 OpenType 场景，完整 CSS，脚本 | 79.72 ms | 30.98 ms |
| 批量插入 4000 个元素，普通替换，脚本 | 29.16 ms | 18.59 ms |
| 复杂字体条件、6400 次采样，完整 CSS，脚本 | 28.45 ms | 16.65 ms |
| 播放中移除 512 个旧节点并新增文字，普通替换，完成时间 | 2139.7 ms | 669.1 ms |
| 同一规则压力场景，Element.matches API 调用 | 1,283,208 | 2,408 |

复杂条件场景两版均保留 6400 次字体采样。另有回归用例逐元素采样 402 次、只生成一次共享连字结果，并检查代码/图标保护和连字设置重载。移除 5000 个待检节点的播放用例中，新文字在 1500 ms 内处理完成，重新挂入后完成原样式重检。

## 当前耗时重点

完整 CSS 在极端长页首次应用时仍有较多浏览器排版开销。6000 段文字及 100 个空控件的主线程中位数为 481.88 → 477.29 ms，其中样式重算为 264.86 → 263.08 ms；脚本耗时为 40.21 → 31.71 ms。普通视频持续更新场景的主线程结果为 60.27 → 62.96 ms，完整 CSS 为 62.77 → 61.00 ms。完整样本中也记录了耗时接近或略高的场景。

## 复现与文件

```powershell
npm test
node scripts/profile-performance.cjs --baseline-dir=performance-results/round2-before --repeats=1 --output=performance-results/round2-final-counts
node scripts/profile-performance.cjs --baseline-dir=performance-results/round2-before --counts=off --cases=cold-wide-text,cold-wide,cold-rules,cold-compound-rules,cold-features,insert-wide,nontext,complex,video,video-detached --repeats=3 --output=performance-results/round2-final-timing
```

基线快照位于 `round2-before/`。最终计数：[JSON](round2-final-counts.json)、[Markdown](round2-final-counts.md)。最终计时：[JSON](round2-final-timing.json)、[Markdown](round2-final-timing.md)。前一轮的后台及设置页优化见[第一轮记录](summary.md)。
