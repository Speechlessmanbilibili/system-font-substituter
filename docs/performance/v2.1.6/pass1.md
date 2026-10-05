# 字体扩展性能对比

基线：v2.1.5。浏览器：151.0.7922.34。每组重复 1 次，表中为中位数。

使用本地模拟页面；浏览器耗时包含页面及测量钩子开销。完整样本、最小值和最大值见同名 JSON。

| 模式/场景 | 版本 | 脚本/ms | 样式/ms | 采样 | 选择器匹配 | 遍历节点 | 长任务 | 最长帧/ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ordinary/cold-deep | disabled | 6.9 | 0.79 | 0 | 0 | 0 | 0 | 79.2 |
| ordinary/cold-deep | before | 7.69 | 1.35 | 250 | 513 | 250 | 0 | 8.3 |
| ordinary/cold-deep | after | 7.14 | 1.43 | 250 | 9 | 250 | 0 | 16.6 |
| ordinary/cold-rules | disabled | 6 | 1.27 | 0 | 0 | 0 | 0 | 24.9 |
| ordinary/cold-rules | before | 8.14 | 2.48 | 800 | 1286415 | 1600 | 1 | 475 |
| ordinary/cold-rules | after | 7.69 | 2.25 | 800 | 2410 | 1600 | 0 | 45.8 |
| ordinary/insert-wide | disabled | 1.84 | 2.58 | 0 | 0 | 0 | 0 | 25 |
| ordinary/insert-wide | before | 34.94 | 7.17 | 1 | 16003 | 4000 | 0 | 37.5 |
| ordinary/insert-wide | after | 34.14 | 7.04 | 1 | 12001 | 4000 | 0 | 37.5 |
| ordinary/complex | disabled | 1.66 | 0.25 | 0 | 0 | 0 | 0 | 4.3 |
| ordinary/complex | before | 24.02 | 16.22 | 6400 | 16 | 6400 | 0 | 8.4 |
| ordinary/complex | after | 24.1 | 15.76 | 6400 | 16 | 6400 | 0 | 12.5 |
| appleUIMix/cold-deep | disabled | 6.46 | 0.89 | 0 | 0 | 0 | 0 | 12.6 |
| appleUIMix/cold-deep | before | 7.16 | 8.73 | 250 | 516 | 250 | 1 | 200.1 |
| appleUIMix/cold-deep | after | 7.44 | 1.59 | 250 | 12 | 250 | 1 | 187.5 |
| appleUIMix/cold-rules | disabled | 7.05 | 1.24 | 0 | 0 | 0 | 0 | 25 |
| appleUIMix/cold-rules | before | 9.11 | 3.1 | 800 | 1286417 | 1600 | 2 | 629.2 |
| appleUIMix/cold-rules | after | 7.55 | 3.2 | 800 | 2412 | 1600 | 1 | 208.3 |
| appleUIMix/insert-wide | disabled | 1.69 | 2.57 | 0 | 0 | 0 | 0 | 24.9 |
| appleUIMix/insert-wide | before | 35.5 | 86.11 | 1 | 16003 | 4000 | 1 | 108.3 |
| appleUIMix/insert-wide | after | 35.24 | 83.39 | 1 | 12001 | 4000 | 1 | 108.3 |
| appleUIMix/complex | disabled | 1.59 | 0.23 | 0 | 0 | 0 | 0 | 4.3 |
| appleUIMix/complex | before | 28.73 | 167.85 | 6400 | 16 | 6400 | 1 | 158.3 |
| appleUIMix/complex | after | 27.81 | 169.26 | 6400 | 16 | 6400 | 1 | 162.4 |
