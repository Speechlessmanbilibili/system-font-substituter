# 字体扩展性能对比

基线：D:\Project\字体切换浏览器扩展\performance-results\round4-before。浏览器：151.0.7922.34。每组重复 1 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

高频选择器/遍历计数：开启。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ordinary/static-selector-menus | disabled | 45.57 | 1.92 | 0.6 | 0 | 0 | 0 | 0 | 6.6 |
| ordinary/static-selector-menus | before | 934.15 | 182.04 | 300.01 | 92521 | 201 | 102581 | 0 | 18.5 |
| ordinary/static-selector-menus | after | 104.17 | 8.06 | 7.18 | 1 | 240 | 0 | 0 | 12 |
| appleUIMix/static-selector-menus | disabled | 46.83 | 2.09 | 0.74 | 0 | 0 | 0 | 0 | 6.4 |
| appleUIMix/static-selector-menus | before | 2242.75 | 184 | 1361.31 | 92521 | 201 | 102581 | 7 | 177.2 |
| appleUIMix/static-selector-menus | after | 96.78 | 5.05 | 6.35 | 1 | 240 | 0 | 0 | 11.5 |
