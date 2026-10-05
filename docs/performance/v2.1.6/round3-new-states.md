# 字体扩展性能对比

基线：D:\Project\字体切换浏览器扩展\performance-results\round3-before。浏览器：151.0.7922.34。每组重复 1 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

高频选择器/遍历计数：开启。

主线程任务包含脚本、解析、样式和布局等；ScriptDuration 是 CDP 的脚本回调计时。堆内存为采样值，受垃圾回收影响。帧间隔为独立测试浏览器的 requestAnimationFrame 间隔。

| 模式/场景 | 版本 | 主线程/ms | 脚本/ms | 样式/ms | 采样 | matches 调用 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-long-text | disabled | 269.14 | 6.57 | 0.27 | 0 | 0 | 0 | 1 | 41.6 |
| ordinary/cold-long-text | before | 400.42 | 8.45 | 0.58 | 1 | 6 | 200 | 2 | 233.3 |
| ordinary/cold-long-text | after | 392.38 | 8.06 | 0.56 | 1 | 6 | 200 | 2 | 237.5 |
| ordinary/long-text-burst | disabled | 185.75 | 1.77 | 0.03 | 0 | 0 | 0 | 0 | 50 |
| ordinary/long-text-burst | before | 381.08 | 215.86 | 0.03 | 0 | 800 | 0 | 4 | 95.9 |
| ordinary/long-text-burst | after | 164.17 | 3.14 | 0.04 | 0 | 402 | 0 | 0 | 41.6 |
| ordinary/text-states | disabled | 8.34 | 1.89 | 0.14 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/text-states | before | 11.81 | 3.74 | 0.37 | 9 | 504 | 9 | 0 | 4.3 |
| ordinary/text-states | after | 10.67 | 2.99 | 0.28 | 9 | 504 | 9 | 0 | 4.3 |
| ordinary/auto-direction | disabled | 9.86 | 1.8 | 0.17 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/auto-direction | before | 29.78 | 5.99 | 0.69 | 8 | 824 | 0 | 0 | 4.3 |
| ordinary/auto-direction | after | 30.25 | 6.04 | 0.67 | 8 | 32 | 0 | 0 | 4.3 |
| ordinary/composition | disabled | 20.49 | 1.84 | 0.38 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/composition | before | 32.01 | 5.71 | 0.96 | 3 | 805 | 201 | 0 | 4.3 |
| ordinary/composition | after | 33.55 | 6.63 | 1.06 | 3 | 805 | 201 | 0 | 4.3 |
| ordinary/font-media | disabled | 32.26 | 2.29 | 3.21 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/font-media | before | 41.86 | 7.73 | 4.79 | 1 | 4 | 2400 | 0 | 8.3 |
| ordinary/font-media | after | 43.54 | 8.06 | 5.12 | 1 | 4 | 2400 | 0 | 8.3 |
| ordinary/site-states | disabled | 18.26 | 1.85 | 0 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/site-states | before | 45.2 | 2.44 | 5.66 | 12 | 15 | 3006 | 0 | 8.3 |
| ordinary/site-states | after | 47.78 | 2.76 | 5.71 | 12 | 15 | 3006 | 0 | 8.4 |
| appleUIMix/cold-long-text | disabled | 265.64 | 6.11 | 0.28 | 0 | 0 | 0 | 1 | 237.6 |
| appleUIMix/cold-long-text | before | 562.36 | 7.02 | 180.47 | 1 | 10 | 200 | 1 | 524.9 |
| appleUIMix/cold-long-text | after | 551.25 | 7.38 | 173.79 | 1 | 10 | 200 | 1 | 516.6 |
| appleUIMix/long-text-burst | disabled | 186.86 | 1.7 | 0.04 | 0 | 0 | 0 | 1 | 54.2 |
| appleUIMix/long-text-burst | before | 367.49 | 210.75 | 0.04 | 0 | 800 | 0 | 4 | 91.7 |
| appleUIMix/long-text-burst | after | 164.29 | 3.17 | 0.04 | 0 | 402 | 0 | 0 | 41.7 |
| appleUIMix/text-states | disabled | 8.11 | 1.7 | 0.13 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/text-states | before | 10.59 | 2.3 | 0.94 | 9 | 504 | 9 | 0 | 4.3 |
| appleUIMix/text-states | after | 11.59 | 2.31 | 1.05 | 9 | 504 | 9 | 0 | 4.3 |
| appleUIMix/auto-direction | disabled | 10.86 | 2.15 | 0.14 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/auto-direction | before | 37.4 | 5.68 | 1.71 | 8 | 824 | 0 | 0 | 4.3 |
| appleUIMix/auto-direction | after | 36.04 | 5.33 | 1.73 | 8 | 32 | 0 | 0 | 4.3 |
| appleUIMix/composition | disabled | 21.74 | 1.83 | 0.41 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/composition | before | 106.33 | 5.99 | 74.07 | 3 | 805 | 201 | 1 | 75 |
| appleUIMix/composition | after | 106.12 | 6.36 | 75.58 | 3 | 805 | 201 | 1 | 75.1 |
| appleUIMix/font-media | disabled | 30.52 | 1.95 | 2.66 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/font-media | before | 43.34 | 6.79 | 5.32 | 1 | 4 | 2400 | 0 | 8.4 |
| appleUIMix/font-media | after | 41.62 | 6.25 | 5.37 | 1 | 4 | 2400 | 0 | 8.3 |
| appleUIMix/site-states | disabled | 13.85 | 1.9 | 0 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/site-states | before | 46.08 | 1.55 | 6.54 | 8 | 21 | 3006 | 0 | 8.3 |
| appleUIMix/site-states | after | 44.87 | 1.5 | 6.56 | 8 | 21 | 3006 | 0 | 8.3 |
