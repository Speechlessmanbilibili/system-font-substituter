# 字体扩展性能对比

基线：v2.1.5。浏览器：151.0.7922.34。每组重复 1 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

| 模式/场景 | 版本 | 脚本/ms | 样式/ms | 采样 | 选择器匹配 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-wide | disabled | 6.91 | 6.46 | 0 | 0 | 0 | 1 | 83.3 |
| ordinary/cold-wide | before | 40.65 | 13.32 | 1 | 12014 | 6000 | 1 | 79.1 |
| ordinary/cold-wide | after | 40.22 | 17.05 | 2 | 6108 | 6000 | 1 | 54.1 |
| ordinary/cold-deep | disabled | 7.87 | 0.71 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/cold-deep | before | 7.6 | 1.25 | 250 | 514 | 250 | 0 | 16.7 |
| ordinary/cold-deep | after | 7.25 | 1.24 | 250 | 10 | 250 | 0 | 25 |
| ordinary/cold-rules | disabled | 7.32 | 1.45 | 0 | 0 | 0 | 0 | 29.2 |
| ordinary/cold-rules | before | 7.89 | 2.22 | 800 | 1286415 | 1600 | 1 | 479.1 |
| ordinary/cold-rules | after | 7.88 | 2.25 | 800 | 2410 | 1600 | 0 | 45.7 |
| ordinary/insert-wide | disabled | 1.94 | 2.71 | 0 | 0 | 0 | 0 | 25 |
| ordinary/insert-wide | before | 35.97 | 7.31 | 1 | 16003 | 4000 | 0 | 41.7 |
| ordinary/insert-wide | after | 32.31 | 7.29 | 1 | 4003 | 4000 | 0 | 37.5 |
| ordinary/move | disabled | 1.87 | 0.33 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/move | before | 5.72 | 0.43 | 1 | 2806 | 400 | 0 | 8.3 |
| ordinary/move | after | 5.49 | 0.43 | 1 | 2001 | 0 | 0 | 8.4 |
| ordinary/protected | disabled | 2.41 | 2.08 | 0 | 0 | 0 | 0 | 20.9 |
| ordinary/protected | before | 13.18 | 2.81 | 2 | 6011 | 3000 | 0 | 20.8 |
| ordinary/protected | after | 14.18 | 2.85 | 2 | 2005 | 3000 | 0 | 20.8 |
| ordinary/complex | disabled | 1.81 | 0.3 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/complex | before | 24.65 | 15.92 | 6400 | 16 | 6400 | 0 | 12.6 |
| ordinary/complex | after | 23.89 | 16.25 | 6400 | 16 | 6400 | 0 | 8.5 |
| appleUIMix/cold-wide | disabled | 6.82 | 13.78 | 0 | 0 | 0 | 1 | 62.5 |
| appleUIMix/cold-wide | before | 45.79 | 203.91 | 1 | 12016 | 6000 | 1 | 350 |
| appleUIMix/cold-wide | after | 44.37 | 317.9 | 2 | 6111 | 6000 | 1 | 466.8 |
| appleUIMix/cold-deep | disabled | 6.15 | 0.67 | 0 | 0 | 0 | 0 | 12.5 |
| appleUIMix/cold-deep | before | 6.87 | 1.67 | 250 | 516 | 250 | 1 | 187.5 |
| appleUIMix/cold-deep | after | 7.8 | 1.58 | 250 | 12 | 250 | 1 | 200 |
| appleUIMix/cold-rules | disabled | 6 | 1.26 | 0 | 0 | 0 | 0 | 29.2 |
| appleUIMix/cold-rules | before | 8.59 | 3.34 | 800 | 1286417 | 1600 | 2 | 670.9 |
| appleUIMix/cold-rules | after | 7.87 | 3.22 | 800 | 2412 | 1600 | 1 | 216.7 |
| appleUIMix/insert-wide | disabled | 1.94 | 2.54 | 0 | 0 | 0 | 0 | 25.1 |
| appleUIMix/insert-wide | before | 34.5 | 84.91 | 1 | 16003 | 4000 | 1 | 108.4 |
| appleUIMix/insert-wide | after | 32.31 | 84.01 | 1 | 4003 | 4000 | 1 | 104.1 |
| appleUIMix/move | disabled | 1.78 | 0.29 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/move | before | 5.91 | 0.99 | 1 | 2806 | 400 | 0 | 8.2 |
| appleUIMix/move | after | 5.47 | 1.07 | 1 | 2001 | 0 | 0 | 8.3 |
| appleUIMix/protected | disabled | 2.17 | 1.99 | 0 | 0 | 0 | 0 | 16.6 |
| appleUIMix/protected | before | 7.94 | 2.14 | 0 | 5 | 3000 | 0 | 16.7 |
| appleUIMix/protected | after | 7.56 | 2.06 | 0 | 5 | 3000 | 0 | 16.7 |
| appleUIMix/complex | disabled | 1.74 | 0.19 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/complex | before | 29.71 | 167.02 | 6400 | 16 | 6400 | 1 | 162.6 |
| appleUIMix/complex | after | 29.97 | 167.26 | 6400 | 16 | 6400 | 1 | 162.5 |
