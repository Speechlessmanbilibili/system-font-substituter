# 字体扩展性能对比

基线：D:\Project\字体切换浏览器扩展\performance-results\round2-before。浏览器：151.0.7922.34。每组重复 3 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

高频选择器/遍历计数：关闭，表中对应调用量留空。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-wide-text | disabled | 95.27 | 8.12 | 3.65 | 0 |  |  | 1 | 54.1 |
| ordinary/cold-wide-text | before | 155.27 | 37.78 | 9.9 | 1 |  |  | 1 | 79.1 |
| ordinary/cold-wide-text | after | 149.06 | 28.72 | 9.72 | 1 |  |  | 1 | 75 |
| ordinary/cold-wide | disabled | 100.81 | 8.55 | 14.29 | 0 |  |  | 1 | 62.4 |
| ordinary/cold-wide | before | 159.96 | 38.33 | 22.35 | 2 |  |  | 1 | 79.2 |
| ordinary/cold-wide | after | 156.03 | 29.73 | 22.78 | 2 |  |  | 1 | 75 |
| ordinary/cold-compound-rules | disabled | 61.77 | 8.16 | 1.45 | 0 |  |  | 0 | 25 |
| ordinary/cold-compound-rules | before | 658.67 | 9 | 2.55 | 800 |  |  | 1 | 625.1 |
| ordinary/cold-compound-rules | after | 75.04 | 8.95 | 2.51 | 800 |  |  | 0 | 45.7 |
| ordinary/cold-features | disabled | 96.57 | 7.84 | 3.53 | 0 |  |  | 1 | 58.3 |
| ordinary/cold-features | before | 194.25 | 75.88 | 9.94 | 1 |  |  | 1 | 95.9 |
| ordinary/cold-features | after | 153.86 | 28.9 | 9.78 | 1 |  |  | 1 | 79.2 |
| appleUIMix/cold-wide-text | disabled | 94 | 7.74 | 3.49 | 0 |  |  | 1 | 54.2 |
| appleUIMix/cold-wide-text | before | 399.5 | 39.44 | 181.52 | 1 |  |  | 1 | 320.8 |
| appleUIMix/cold-wide-text | after | 391.78 | 30.95 | 180.08 | 1 |  |  | 1 | 316.6 |
| appleUIMix/cold-wide | disabled | 97.62 | 7.9 | 13.63 | 0 |  |  | 1 | 58.3 |
| appleUIMix/cold-wide | before | 480.16 | 41.45 | 262.6 | 2 |  |  | 1 | 395.9 |
| appleUIMix/cold-wide | after | 475.29 | 31.55 | 263.97 | 2 |  |  | 1 | 392 |
| appleUIMix/cold-compound-rules | disabled | 63.85 | 8.88 | 1.43 | 0 |  |  | 0 | 25 |
| appleUIMix/cold-compound-rules | before | 819.56 | 8.44 | 3.56 | 800 |  |  | 2 | 791.7 |
| appleUIMix/cold-compound-rules | after | 246.26 | 8.07 | 3.58 | 800 |  |  | 1 | 208.2 |
| appleUIMix/cold-features | disabled | 99.27 | 8.01 | 3.55 | 0 |  |  | 1 | 58.4 |
| appleUIMix/cold-features | before | 462.7 | 79.03 | 180.78 | 1 |  |  | 1 | 337.5 |
| appleUIMix/cold-features | after | 400.16 | 30.87 | 180.44 | 1 |  |  | 1 | 320.8 |
