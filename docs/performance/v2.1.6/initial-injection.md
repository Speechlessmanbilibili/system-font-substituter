# 字体扩展性能对比

基线：v2.1.5。浏览器：151.0.7922.34。每组重复 3 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | 选择器匹配 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-wide | disabled | 86.74 | 6.39 | 13.44 | 0 | 0 | 0 | 1 | 54.2 |
| ordinary/cold-wide | before | 160.13 | 39.09 | 19.49 | 1 | 12014 | 6000 | 1 | 79.2 |
| ordinary/cold-wide | after | 166.93 | 40.35 | 23.17 | 2 | 7 | 6000 | 1 | 83.3 |
| ordinary/cold-rules | disabled | 49.39 | 6.75 | 1.22 | 0 | 0 | 0 | 0 | 24.9 |
| ordinary/cold-rules | before | 522.25 | 8.22 | 2.28 | 800 | 1286415 | 1600 | 1 | 491.7 |
| ordinary/cold-rules | after | 69.08 | 8.24 | 2.49 | 800 | 8 | 1600 | 0 | 45.8 |
| ordinary/insert-wide | disabled | 43.17 | 1.98 | 2.59 | 0 | 0 | 0 | 0 | 25 |
| ordinary/insert-wide | before | 95.21 | 33.91 | 7.03 | 1 | 16003 | 4000 | 0 | 37.4 |
| ordinary/insert-wide | after | 92.21 | 30.03 | 7.24 | 1 | 3 | 4000 | 0 | 33.4 |
| appleUIMix/cold-wide | disabled | 86.39 | 6.35 | 13.48 | 0 | 0 | 0 | 1 | 58.3 |
| appleUIMix/cold-wide | before | 411.42 | 41.22 | 187.39 | 1 | 12016 | 6000 | 1 | 329.2 |
| appleUIMix/cold-wide | after | 506.84 | 41.74 | 268.49 | 2 | 9 | 6000 | 2 | 358.4 |
| appleUIMix/cold-rules | disabled | 48.01 | 6.51 | 1.24 | 0 | 0 | 0 | 0 | 24.9 |
| appleUIMix/cold-rules | before | 680.66 | 7.96 | 3.2 | 800 | 1286417 | 1600 | 2 | 650.1 |
| appleUIMix/cold-rules | after | 233.49 | 8.2 | 3.2 | 800 | 10 | 1600 | 1 | 208.5 |
| appleUIMix/insert-wide | disabled | 43.58 | 1.86 | 2.71 | 0 | 0 | 0 | 0 | 25 |
| appleUIMix/insert-wide | before | 185.63 | 36.41 | 85.8 | 1 | 16003 | 4000 | 1 | 108.3 |
| appleUIMix/insert-wide | after | 184.21 | 32.46 | 86.75 | 1 | 3 | 4000 | 1 | 112.5 |
