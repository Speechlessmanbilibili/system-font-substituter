# 字体扩展性能对比

基线：D:\Project\字体切换浏览器扩展\performance-results\round2-before。浏览器：151.0.7922.34。每组重复 3 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

高频选择器/遍历计数：关闭，表中对应调用量留空。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-wide-text | disabled | 97.23 | 8.53 | 3.59 | 0 |  |  | 1 | 58.4 |
| ordinary/cold-wide-text | before | 155.1 | 38.23 | 9.81 | 1 |  |  | 1 | 79.2 |
| ordinary/cold-wide-text | after | 148.72 | 29.23 | 10.44 | 1 |  |  | 1 | 74.9 |
| ordinary/cold-wide | disabled | 98.79 | 7.99 | 14.78 | 0 |  |  | 1 | 58.4 |
| ordinary/cold-wide | before | 160.15 | 38.91 | 22.57 | 2 |  |  | 1 | 79.1 |
| ordinary/cold-wide | after | 154.96 | 29.79 | 22.69 | 2 |  |  | 1 | 79.2 |
| ordinary/cold-rules | disabled | 63.23 | 8.41 | 1.34 | 0 |  |  | 0 | 25 |
| ordinary/cold-rules | before | 70.22 | 8.97 | 2.17 | 800 |  |  | 0 | 41.7 |
| ordinary/cold-rules | after | 70.9 | 9.66 | 2.39 | 800 |  |  | 0 | 41.6 |
| ordinary/cold-compound-rules | disabled | 62.17 | 7.98 | 1.45 | 0 |  |  | 0 | 25.1 |
| ordinary/cold-compound-rules | before | 653.08 | 8.85 | 2.5 | 800 |  |  | 1 | 616.5 |
| ordinary/cold-compound-rules | after | 74.51 | 9.14 | 2.58 | 800 |  |  | 0 | 49.9 |
| ordinary/cold-features | disabled | 99.12 | 7.78 | 3.59 | 0 |  |  | 1 | 62.5 |
| ordinary/cold-features | before | 196.56 | 77.07 | 10.02 | 1 |  |  | 1 | 100 |
| ordinary/cold-features | after | 151.6 | 29.39 | 9.85 | 1 |  |  | 1 | 79.2 |
| ordinary/nontext | disabled | 32.88 | 2.05 | 3.97 | 0 |  |  | 0 | 16.7 |
| ordinary/nontext | before | 26.69 | 4.37 | 3.6 | 0 |  |  | 0 | 16.7 |
| ordinary/nontext | after | 25.9 | 4.2 | 3.6 | 0 |  |  | 0 | 16.7 |
| ordinary/insert-wide | disabled | 47.25 | 2.05 | 2.85 | 0 |  |  | 0 | 29.2 |
| ordinary/insert-wide | before | 89.29 | 29.16 | 7.3 | 1 |  |  | 0 | 37.5 |
| ordinary/insert-wide | after | 85.47 | 18.59 | 7.13 | 1 |  |  | 0 | 33.4 |
| ordinary/complex | disabled | 35.19 | 2.16 | 0.22 | 0 |  |  | 0 | 4.3 |
| ordinary/complex | before | 105.11 | 23.9 | 18.03 | 6400 |  |  | 0 | 12.5 |
| ordinary/complex | after | 97.82 | 15.89 | 15.75 | 6400 |  |  | 0 | 8.4 |
| ordinary/video | disabled | 66.1 | 2.62 | 0.94 | 0 |  |  | 0 | 4.3 |
| ordinary/video | before | 60.27 | 5.36 | 1.91 | 430 |  |  | 0 | 4.3 |
| ordinary/video | after | 62.96 | 5.1 | 1.94 | 430 |  |  | 0 | 4.3 |
| ordinary/video-detached | disabled | 23.17 | 3.55 | 0.54 | 0 |  |  | 0 | 4.3 |
| ordinary/video-detached | before | 59.54 | 12.96 | 0.72 | 1 |  |  | 0 | 4.5 |
| ordinary/video-detached | after | 33.76 | 6.81 | 0.7 | 1 |  |  | 0 | 4.3 |
| appleUIMix/cold-wide-text | disabled | 96.49 | 7.98 | 3.5 | 0 |  |  | 1 | 58.4 |
| appleUIMix/cold-wide-text | before | 404.11 | 39.88 | 181.83 | 1 |  |  | 1 | 325 |
| appleUIMix/cold-wide-text | after | 396.78 | 31.24 | 182.11 | 1 |  |  | 1 | 320.8 |
| appleUIMix/cold-wide | disabled | 97.44 | 8.03 | 14.05 | 0 |  |  | 1 | 54.2 |
| appleUIMix/cold-wide | before | 481.88 | 40.21 | 264.86 | 2 |  |  | 1 | 400 |
| appleUIMix/cold-wide | after | 477.29 | 31.71 | 263.08 | 2 |  |  | 1 | 391.7 |
| appleUIMix/cold-rules | disabled | 61.02 | 8.52 | 1.25 | 0 |  |  | 0 | 25 |
| appleUIMix/cold-rules | before | 226.19 | 7.76 | 3.22 | 800 |  |  | 1 | 204 |
| appleUIMix/cold-rules | after | 226.02 | 8.24 | 3.2 | 800 |  |  | 1 | 204.1 |
| appleUIMix/cold-compound-rules | disabled | 59.5 | 8.42 | 1.47 | 0 |  |  | 0 | 25 |
| appleUIMix/cold-compound-rules | before | 812.31 | 8.41 | 3.52 | 800 |  |  | 2 | 783.4 |
| appleUIMix/cold-compound-rules | after | 234.4 | 7.63 | 3.5 | 800 |  |  | 1 | 212.4 |
| appleUIMix/cold-features | disabled | 99.01 | 8.16 | 3.49 | 0 |  |  | 1 | 58.3 |
| appleUIMix/cold-features | before | 447.19 | 79.72 | 180.73 | 1 |  |  | 1 | 337.5 |
| appleUIMix/cold-features | after | 401.53 | 30.98 | 180.32 | 1 |  |  | 1 | 320.8 |
| appleUIMix/nontext | disabled | 31.38 | 2.07 | 3.9 | 0 |  |  | 0 | 16.7 |
| appleUIMix/nontext | before | 20.37 | 3.28 | 3.56 | 0 |  |  | 0 | 12.5 |
| appleUIMix/nontext | after | 20.85 | 3.33 | 3.58 | 0 |  |  | 0 | 12.5 |
| appleUIMix/insert-wide | disabled | 42.5 | 1.99 | 2.56 | 0 |  |  | 0 | 25 |
| appleUIMix/insert-wide | before | 175.14 | 29.3 | 83.6 | 1 |  |  | 1 | 108.3 |
| appleUIMix/insert-wide | after | 172.67 | 20.15 | 84.55 | 1 |  |  | 1 | 104.1 |
| appleUIMix/complex | disabled | 32.61 | 1.91 | 0.23 | 0 |  |  | 0 | 4.3 |
| appleUIMix/complex | before | 268.85 | 28.45 | 165.14 | 6400 |  |  | 1 | 162.5 |
| appleUIMix/complex | after | 103.7 | 16.65 | 16.94 | 6400 |  |  | 0 | 8.4 |
| appleUIMix/video | disabled | 66.63 | 2.83 | 0.9 | 0 |  |  | 0 | 4.3 |
| appleUIMix/video | before | 62.77 | 5.97 | 2.24 | 430 |  |  | 0 | 4.3 |
| appleUIMix/video | after | 61 | 5.32 | 2.32 | 430 |  |  | 0 | 4.3 |
| appleUIMix/video-detached | disabled | 23.35 | 3.62 | 0.42 | 0 |  |  | 0 | 4.3 |
| appleUIMix/video-detached | before | 61.96 | 12.82 | 1.98 | 1 |  |  | 0 | 4.3 |
| appleUIMix/video-detached | after | 37.41 | 6.65 | 1.87 | 1 |  |  | 0 | 4.3 |
