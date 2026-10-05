# 字体扩展性能对比

基线：v2.1.5。浏览器：151.0.7922.34。每组重复 3 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

高频选择器/遍历计数：关闭，表中对应调用量留空。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-wide-text | disabled | 102.53 | 8.46 | 3.7 | 0 |  |  | 1 | 62.5 |
| ordinary/cold-wide-text | before | 164.53 | 38.62 | 10.14 | 1 |  |  | 1 | 83.3 |
| ordinary/cold-wide-text | after | 165.71 | 39.57 | 10.27 | 1 |  |  | 1 | 83.3 |
| ordinary/cold-wide | disabled | 106.6 | 8.91 | 13.78 | 0 |  |  | 1 | 62.5 |
| ordinary/cold-wide | before | 165.85 | 40.11 | 20.37 | 1 |  |  | 1 | 83.3 |
| ordinary/cold-wide | after | 168.73 | 41.19 | 22.76 | 2 |  |  | 1 | 83.3 |
| ordinary/cold-rules | disabled | 58.56 | 8.03 | 1.27 | 0 |  |  | 0 | 25 |
| ordinary/cold-rules | before | 376.67 | 9.83 | 2.25 | 800 |  |  | 1 | 341.6 |
| ordinary/cold-rules | after | 69.35 | 9.32 | 2.25 | 800 |  |  | 0 | 41.7 |
| ordinary/nontext | disabled | 31 | 1.84 | 3.54 | 0 |  |  | 0 | 16.7 |
| ordinary/nontext | before | 28.83 | 7.51 | 3.49 | 0 |  |  | 0 | 20.8 |
| ordinary/nontext | after | 26.03 | 4.14 | 3.54 | 0 |  |  | 0 | 16.7 |
| ordinary/insert-wide | disabled | 43.07 | 2.13 | 2.64 | 0 |  |  | 0 | 25 |
| ordinary/insert-wide | before | 90.99 | 30.82 | 6.98 | 1 |  |  | 0 | 33.4 |
| ordinary/insert-wide | after | 97.09 | 31.16 | 7.2 | 1 |  |  | 0 | 33.3 |
| ordinary/complex | disabled | 33.62 | 2.01 | 0.24 | 0 |  |  | 0 | 4.3 |
| ordinary/complex | before | 105.37 | 24.13 | 16.63 | 6400 |  |  | 0 | 12.5 |
| ordinary/complex | after | 105.6 | 22.72 | 15.77 | 6400 |  |  | 0 | 12.5 |
| ordinary/video | disabled | 73.41 | 3.33 | 1.44 | 0 |  |  | 0 | 4.3 |
| ordinary/video | before | 63.01 | 5.98 | 2.18 | 430 |  |  | 0 | 4.3 |
| ordinary/video | after | 67.33 | 6.25 | 2.25 | 430 |  |  | 0 | 4.3 |
| appleUIMix/cold-wide-text | disabled | 96.51 | 8.11 | 3.52 | 0 |  |  | 1 | 58.3 |
| appleUIMix/cold-wide-text | before | 414.71 | 40.44 | 185.82 | 1 |  |  | 1 | 329.2 |
| appleUIMix/cold-wide-text | after | 417.33 | 40.75 | 187.37 | 1 |  |  | 1 | 333.3 |
| appleUIMix/cold-wide | disabled | 100.71 | 8.84 | 13.61 | 0 |  |  | 1 | 54.2 |
| appleUIMix/cold-wide | before | 413 | 41.32 | 186.41 | 1 |  |  | 1 | 325 |
| appleUIMix/cold-wide | after | 493.75 | 42.22 | 270.11 | 2 |  |  | 1 | 404.2 |
| appleUIMix/cold-rules | disabled | 59.57 | 8.1 | 1.22 | 0 |  |  | 0 | 25 |
| appleUIMix/cold-rules | before | 532.83 | 7.86 | 3.25 | 800 |  |  | 2 | 508.2 |
| appleUIMix/cold-rules | after | 232.59 | 7.74 | 3.19 | 800 |  |  | 1 | 208.3 |
| appleUIMix/nontext | disabled | 31.23 | 2.29 | 3.52 | 0 |  |  | 0 | 16.7 |
| appleUIMix/nontext | before | 24.14 | 6.64 | 3.58 | 0 |  |  | 0 | 16.7 |
| appleUIMix/nontext | after | 22 | 3.6 | 3.5 | 0 |  |  | 0 | 12.5 |
| appleUIMix/insert-wide | disabled | 44.08 | 2.16 | 2.67 | 0 |  |  | 0 | 25 |
| appleUIMix/insert-wide | before | 180.37 | 31.43 | 86.13 | 1 |  |  | 1 | 112.5 |
| appleUIMix/insert-wide | after | 180.74 | 30.41 | 85.55 | 1 |  |  | 1 | 112.5 |
| appleUIMix/complex | disabled | 33.38 | 2 | 0.26 | 0 |  |  | 0 | 4.3 |
| appleUIMix/complex | before | 286.62 | 28.06 | 175.37 | 6400 |  |  | 1 | 170.9 |
| appleUIMix/complex | after | 289.13 | 29.1 | 175.11 | 6400 |  |  | 1 | 170.8 |
| appleUIMix/video | disabled | 67.35 | 2.95 | 1.22 | 0 |  |  | 0 | 4.3 |
| appleUIMix/video | before | 68.35 | 6.53 | 2.53 | 430 |  |  | 0 | 4.3 |
| appleUIMix/video | after | 66.1 | 6.43 | 2.39 | 430 |  |  | 0 | 4.3 |
