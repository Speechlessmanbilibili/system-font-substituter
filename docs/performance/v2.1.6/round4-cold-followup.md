# 字体扩展性能对比

基线：D:\Project\字体切换浏览器扩展\performance-results\round4-before。浏览器：151.0.7922.34。每组重复 5 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

高频选择器/遍历计数：关闭，表中对应调用量留空。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| appleUIMix/cold-common-prefix | disabled | 60.79 | 7.99 | 1.43 | 0 |  |  | 0 | 25 |
| appleUIMix/cold-common-prefix | before | 232.12 | 8.12 | 3.37 | 800 |  |  | 1 | 204.2 |
| appleUIMix/cold-common-prefix | after | 240.92 | 8.46 | 3.51 | 800 |  |  | 1 | 208.4 |
